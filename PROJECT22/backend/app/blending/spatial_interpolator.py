import numpy as np
import xarray as xr
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class SpatialGridInterpolator:
    """
    Handles spatial interpolation across both 2D regular meshes and
    1D discrete station networks (location dimension).
    """

    @staticmethod
    def interpolate_point(
        dataset: xr.Dataset,
        target_lat: float,
        target_lon: float,
        variable: str,
        lead_time_idx: int = 0,
    ) -> float:
        if variable not in dataset:
            return 0.0

        try:
            data_slice = dataset[variable]

            # Slice lead time or time dimension
            if "time" in data_slice.dims and data_slice.sizes.get("time", 0) > lead_time_idx:
                data_slice = data_slice.isel(time=lead_time_idx)
            elif "lead_time" in data_slice.dims and data_slice.sizes.get("lead_time", 0) > lead_time_idx:
                data_slice = data_slice.isel(lead_time=lead_time_idx)

            # Case A: Standard 2D Grid with independent lat/lon dimensions
            if "latitude" in data_slice.dims and "longitude" in data_slice.dims:
                interpolated = data_slice.interp(
                    latitude=target_lat,
                    longitude=target_lon,
                    method="linear",
                )
                val = float(interpolated.values)
                return 0.0 if np.isnan(val) else val

            # Case B: Unstructured network of stations indexed by 'location'
            if "location" in data_slice.dims and "latitude" in data_slice.coords and "longitude" in data_slice.coords:
                lats = data_slice["latitude"].values
                lons = data_slice["longitude"].values
                vals = data_slice.values

                # Exact coordinate match check (< 10 km)
                dists = np.sqrt((lats - target_lat) ** 2 + (lons - target_lon) ** 2)
                min_idx = int(np.argmin(dists))
                if dists[min_idx] < 0.1:
                    val = float(vals[min_idx])
                    return 0.0 if np.isnan(val) else round(val, 2)

                # Inverse Distance Weighting (IDW) interpolation
                weights = 1.0 / np.maximum(dists, 1e-4) ** 2
                valid_mask = ~np.isnan(vals)
                if not np.any(valid_mask):
                    return 0.0

                idw_val = float(np.sum(vals[valid_mask] * weights[valid_mask]) / np.sum(weights[valid_mask]))
                return round(idw_val, 2)

            return 0.0

        except Exception as e:
            logger.warning(f"Spatial interpolation error for ({target_lat}, {target_lon}): {e}")
            return 0.0

    @staticmethod
    def apply_orographic_adjustment(base_temp: float, lat: float, lon: float) -> float:
        if base_temp == 0.0:
            return 0.0

        is_himalayan_belt = (30.0 <= lat <= 37.0) and (73.0 <= lon <= 96.0)
        is_western_ghats = (8.0 <= lat <= 20.0) and (73.0 <= lon <= 77.0)

        if is_himalayan_belt:
            return round(base_temp - 3.5, 1)
        elif is_western_ghats:
            return round(base_temp - 1.2, 1)

        return base_temp