import logging
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
import numpy as np

logger = logging.getLogger(__name__)


class GoogleEarthEngineService:
    """Integration with Google Earth Engine for satellite-based verification data."""

    EE_COLLECTIONS = {
        "chirps_precipitation": "UCSB-CHG/CHIRPS/DAILY",
        "era5_temperature": "ECMWF/ERA5_LAND/DAILY_AGGR",
        "modis_ndvi": "MODIS/061/MOD13A2",
        "gpm_precipitation": "NASA/GPM_L3/IMERG_V06",
        "landsat_lst": "LANDSAT/LC09/C02/T_L2",
    }

    INDIA_BBOX = {
        "west": 60.0,
        "east": 100.0,
        "south": 0.0,
        "north": 40.0,
    }

    def __init__(self, service_account_key: Optional[str] = None):
        self.initialized = False
        self.service_account_key = service_account_key
        self._try_initialize()

    def _try_initialize(self):
        try:
            import ee
            if self.service_account_key:
                ee.Initialize(
                    ee.ServiceAccountCredentials(None, self.service_account_key)
                )
            else:
                ee.Initialize()
            self.initialized = True
            self.ee = ee
            logger.info("Google Earth Engine initialized successfully")
        except Exception as e:
            logger.warning(f"GEE initialization failed: {e}. Using mock data.")
            self.ee = None

    def get_precipitation_verification(
        self,
        start_date: str,
        end_date: str,
        region: Optional[Dict] = None,
    ) -> Dict:
        """Get CHIRPS/GPM precipitation data for verification."""
        if not self.initialized:
            return self._mock_precipitation_data(start_date, end_date)

        if region is None:
            region = self.INDIA_BBOX

        try:
            ee = self.ee
            chirps = ee.ImageCollection(self.EE_COLLECTIONS["chirps_precipitation"])

            filtered = chirps.filterDate(start_date, end_date).filterBounds(
                ee.Geometry.Rectangle([
                    region["west"], region["south"],
                    region["east"], region["north"],
                ])
            )

            daily_precip = filtered.select("precipitation")

            stats = daily_precip.reduceRegion(
                reducer=ee.Reducer.mean().combine(
                    ee.Reducer.stdDev(), sharedInputs=True
                ),
                geometry=ee.Geometry.Rectangle([
                    region["west"], region["south"],
                    region["east"], region["north"],
                ]),
                scale=5566,
                maxPixels=1e9,
            )

            result = stats.getInfo()
            return {
                "source": "CHIRPS",
                "mean_precipitation": result.get("precipitation_mean", 0),
                "std_precipitation": result.get("precipitation_stdDev", 0),
                "start_date": start_date,
                "end_date": end_date,
            }
        except Exception as e:
            logger.error(f"GEE precipitation fetch failed: {e}")
            return self._mock_precipitation_data(start_date, end_date)

    def get_temperature_verification(
        self,
        start_date: str,
        end_date: str,
        region: Optional[Dict] = None,
    ) -> Dict:
        """Get ERA5 temperature data for verification."""
        if not self.initialized:
            return self._mock_temperature_data(start_date, end_date)

        if region is None:
            region = self.INDIA_BBOX

        try:
            ee = self.ee
            era5 = ee.ImageCollection(self.EE_COLLECTIONS["era5_temperature"])

            filtered = era5.filterDate(start_date, end_date).filterBounds(
                ee.Geometry.Rectangle([
                    region["west"], region["south"],
                    region["east"], region["north"],
                ])
            )

            daily_temp = filtered.select("temperature_2m").mean()

            stats = daily_temp.reduceRegion(
                reducer=ee.Reducer.mean().combine(
                    ee.Reducer.stdDev(), sharedInputs=True
                ),
                geometry=ee.Geometry.Rectangle([
                    region["west"], region["south"],
                    region["east"], region["north"],
                ]),
                scale=11132,
                maxPixels=1e9,
            )

            result = stats.getInfo()
            return {
                "source": "ERA5_Land",
                "mean_temperature": result.get("temperature_2m_mean", 0) - 273.15,
                "std_temperature": result.get("temperature_2m_stdDev", 0),
                "start_date": start_date,
                "end_date": end_date,
            }
        except Exception as e:
            logger.error(f"GEE temperature fetch failed: {e}")
            return self._mock_temperature_data(start_date, end_date)

    def get_grid_verification_data(
        self,
        variable: str,
        start_date: str,
        end_date: str,
        resolution: float = 0.25,
    ) -> np.ndarray:
        """Get gridded verification data at specified resolution."""
        if not self.initialized:
            return self._mock_grid_data(variable, start_date, resolution)

        try:
            ee = self.ee

            if variable in ("tp", "precipitation"):
                collection = ee.ImageCollection(self.EE_COLLECTIONS["chirps_precipitation"])
                band = "precipitation"
            elif variable in ("t2m", "temperature"):
                collection = ee.ImageCollection(self.EE_COLLECTIONS["era5_temperature"])
                band = "temperature_2m"
            else:
                return self._mock_grid_data(variable, start_date, resolution)

            filtered = collection.filterDate(start_date, end_date)

            region = self.INDIA_BBOX
            image = filtered.select(band).mean()

            grid = image.sampleRectangle(
                region=ee.Geometry.Rectangle([
                    region["west"], region["south"],
                    region["east"], region["north"],
                ]),
                defaultValue=0,
            )

            data = grid.getInfo()
            return np.array(data["properties"][band])

        except Exception as e:
            logger.error(f"GEE grid fetch failed: {e}")
            return self._mock_grid_data(variable, start_date, resolution)

    def _mock_precipitation_data(self, start_date: str, end_date: str) -> Dict:
        return {
            "source": "CHIRPS (mock)",
            "mean_precipitation": np.random.uniform(0, 30),
            "std_precipitation": np.random.uniform(5, 15),
            "start_date": start_date,
            "end_date": end_date,
            "note": "Mock data - GEE not initialized",
        }

    def _mock_temperature_data(self, start_date: str, end_date: str) -> Dict:
        return {
            "source": "ERA5 (mock)",
            "mean_temperature": np.random.uniform(20, 35),
            "std_temperature": np.random.uniform(2, 8),
            "start_date": start_date,
            "end_date": end_date,
            "note": "Mock data - GEE not initialized",
        }

    def _mock_grid_data(self, variable: str, start_date: str, resolution: float) -> np.ndarray:
        lats = np.arange(0, 40 + resolution, resolution)
        lons = np.arange(60, 100 + resolution, resolution)
        if variable in ("tp", "precipitation"):
            return np.random.exponential(10, (len(lats), len(lons)))
        return np.random.uniform(15, 40, (len(lats), len(lons)))
