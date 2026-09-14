import os
import logging
from pathlib import Path
from typing import Optional, Dict, List, Tuple
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
import xarray as xr

logger = logging.getLogger(__name__)


class DataIngestionService:
    """Standardizes weather model ingest to a 0.25 deg South Asian bounding grid."""

    STANDARD_VARIABLES = {
        "tp": "total_precipitation",
        "t2m": "temperature_2m",
        "u10": "wind_u_component_10m",
        "v10": "wind_v_component_10m",
        "msl": "mean_sea_level_pressure",
        "r": "relative_humidity",
        "tmax": "maximum_temperature",
        "tmin": "minimum_temperature",
    }

    MODEL_SOURCES = {
        "GFS": {
            "base_url": "https://nomads.ncep.noaa.gov",
            "product": "gfs_0p25",
            "resolution": 0.25,
        },
        "ECMWF": {
            "base_url": "https://ecmwfapi.cloud",
            "product": "ifs",
            "resolution": 0.25,
        },
        "NCUM": {
            "base_url": "https://ncmrwf.gov.in",
            "product": "global",
            "resolution": 0.25,
        },
    }

    def __init__(self, storage_base: str = "./data/raw"):
        self.storage_base = Path(storage_base)
        self.storage_base.mkdir(parents=True, exist_ok=True)

    def ingest_grib_file(
        self,
        file_path: str,
        model_name: str,
        variables: Optional[List[str]] = None,
        region: Optional[Dict[str, float]] = None,
    ) -> xr.Dataset:
        """Ingest a GRIB2 file and convert to standardized format."""
        if variables is None:
            variables = list(self.STANDARD_VARIABLES.keys())

        if region is None:
            region = {
                "lat_min": 0.0,
                "lat_max": 40.0,
                "lon_min": 60.0,
                "lon_max": 100.0,
            }

        logger.info(f"Ingesting {model_name} file: {file_path}")

        ds = xr.open_dataset(
            file_path,
            engine="cfgrib",
            backend_kwargs={"indexkeys": ["time", "step", "latitude", "longitude"]},
        )

        ds = self._standardize_grid(ds, region)
        ds = self._rename_variables(ds)

        output_path = self.storage_base / model_name / f"{model_name}_latest.nc"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        ds.to_netcdf(str(output_path))

        logger.info(f"Successfully ingested to {output_path}")
        return ds

    def ingest_netcdf_file(
        self,
        file_path: str,
        model_name: str,
        variables: Optional[List[str]] = None,
    ) -> xr.Dataset:
        """Ingest a NetCDF file."""
        ds = xr.open_dataset(file_path)

        region = {
            "lat_min": 0.0,
            "lat_max": 40.0,
            "lon_min": 60.0,
            "lon_max": 100.0,
        }
        ds = self._standardize_grid(ds, region)

        output_path = self.storage_base / model_name / f"{model_name}_latest.nc"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        ds.to_netcdf(str(output_path))

        return ds

    def create_sample_data(
        self, model_name: str, n_times: int = 5
    ) -> xr.Dataset:
        """Create synthetic forecast datasets across standard grid for pipeline runs."""
        lats = np.arange(0, 40.25, 0.25)
        lons = np.arange(60, 100.25, 0.25)
        times = pd.date_range(
            start=datetime.utcnow(), periods=n_times, freq="6h"
        )
        lead_times = list(range(0, 241, 6))

        np.random.seed(abs(hash(model_name)) % (2**32))

        base_temp = 25 + 5 * np.sin(np.radians(lats[:, None] * 9))
        base_precip = np.maximum(0, 10 + 5 * np.random.randn(len(lats), len(lons)))
        base_wind = 5 + 3 * np.random.rand(len(lats), len(lons))

        data_vars = {"t2m": [], "tp": [], "u10": [], "v10": []}

        for _ in times:
            for _ in lead_times:
                noise_t = np.random.randn(len(lats), len(lons)) * 2
                noise_p = np.random.rand(len(lats), len(lons)) * 5
                noise_w = np.random.rand(len(lats), len(lons)) * 3

                data_vars["t2m"].append(base_temp + noise_t)
                data_vars["tp"].append(np.maximum(0, base_precip + noise_p))
                data_vars["u10"].append(base_wind + noise_w)
                data_vars["v10"].append(base_wind * 0.5 + noise_w * 0.5)

        data = {
            var: (
                ["time", "lead_time", "latitude", "longitude"],
                np.array(vals).reshape(len(times), len(lead_times), len(lats), len(lons)),
            )
            for var, vals in data_vars.items()
        }

        ds = xr.Dataset(
            data_vars=data,
            coords={
                "latitude": lats,
                "longitude": lons,
                "time": times,
                "lead_time": lead_times,
            },
        )

        ds.attrs["model_name"] = model_name
        ds.attrs["source"] = "operational_simulation"
        ds.attrs["created_at"] = datetime.utcnow().isoformat()

        output_path = self.storage_base / model_name / f"{model_name}_latest.nc"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        ds.to_netcdf(str(output_path))

        return ds

    def _standardize_grid(
        self, ds: xr.Dataset, region: Dict[str, float]
    ) -> xr.Dataset:
        """Reproject dataset to standard 0.25 degree grid."""
        target_lats = np.arange(region["lat_min"], region["lat_max"] + 0.25, 0.25)
        target_lons = np.arange(region["lon_min"], region["lon_max"] + 0.25, 0.25)

        lat_dim = [d for d in ds.dims if "lat" in d.lower()][0]
        lon_dim = [d for d in ds.dims if "lon" in d.lower()][0]

        ds = ds.reindex(
            {lat_dim: target_lats, lon_dim: target_lons}, method="nearest"
        )
        return ds

    def _rename_variables(self, ds: xr.Dataset) -> xr.Dataset:
        """Rename model-specific variable names to standard names."""
        rename_map = {}
        for var in ds.data_vars:
            for std_var in self.STANDARD_VARIABLES.keys():
                if std_var in var.lower():
                    rename_map[var] = std_var
                    break
        if rename_map:
            ds = ds.rename(rename_map)
        return ds