import httpx
import numpy as np
import xarray as xr
import logging
import time
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
ENSEMBLE_URL = "https://ensemble-api.open-meteo.com/v1/ensemble"

# Reduced to core operational models to minimize payload weight and avoid Open-Meteo 429
DETERMINISTIC_MODELS = {
    "ecmwf_ifs025": "ECMWF",
    "gfs_seamless": "GFS",
    "icon_seamless": "ICON",
    "ecmwf_aifs025": "AIFS",
}

ENSEMBLE_MODELS = {
    "gfs_seamless_eps": ("GEFS", 31),
    "ecmwf_ifs025": ("ECMWF_EPS", 51),
    "ecmwf_aifs025": ("AIFS_EPS", 51),
    "icon_seamless_eps": ("ICON_EPS", 40),
    "weathernext2": ("WeatherNext", 64),
    "ukmo_global_20km": ("UKMO_EPS", 18),
    "gem_global": ("GEM_EPS", 21),
}

ALL_MODELS = {**DETERMINISTIC_MODELS}

VARIABLE_MAP = {
    "t2m": "temperature_2m",
    "tp": "precipitation",
    "u10": "wind_speed_10m",
    "r": "relative_humidity_2m",
    "msl": "pressure_msl",
    "d2m": "dew_point_2m",
    "wdir": "wind_direction_10m",
    "wgust": "wind_gusts_10m",
    "cape": "cape",
}

INDIA_GRID_2DEG = [
    (lat, lon)
    for lat in np.arange(6, 38, 2)
    for lon in np.arange(66, 100, 2)
]

INDIA_GRID_3DEG = [
    (lat, lon)
    for lat in np.arange(8, 37, 3)
    for lon in np.arange(68, 99, 3)
]

INDIA_KEY_CITIES = [
    (28.61, 77.21), (19.08, 72.88), (22.57, 88.36), (13.08, 80.27),
    (23.02, 72.57), (26.91, 75.79), (23.26, 77.41), (17.38, 78.49),
    (12.97, 77.59), (25.61, 85.14), (26.85, 80.95), (21.17, 72.83),
    (30.73, 76.78), (24.58, 73.71), (26.45, 80.35), (25.32, 82.97),
    (29.39, 76.96), (22.30, 73.18), (15.36, 75.12), (10.85, 76.27),
    (8.52, 76.94), (11.01, 76.97), (9.93, 78.12), (23.80, 91.28),
    (27.47, 94.91), (25.10, 97.02),
]


class OpenMeteoService:
    def __init__(self):
        self.client = httpx.Client(
            timeout=45.0,
            headers={"User-Agent": "ATMOS-WeatherAI/1.0 (academic research)"}
        )

    def _get_with_retry(self, url: str, params: dict, max_retries: int = 4) -> Optional[dict]:
        for attempt in range(1, max_retries + 1):
            try:
                resp = self.client.get(url, params=params)
                if resp.status_code == 429:
                    wait_time = attempt * 3.0
                    logger.warning(
                        f"Open-Meteo 429 hit. Rate limit backing off for {wait_time}s (attempt {attempt}/{max_retries})..."
                    )
                    time.sleep(wait_time)
                    continue

                resp.raise_for_status()
                return resp.json()
            except httpx.HTTPStatusError as e:
                logger.warning(f"HTTP error on attempt {attempt}: {e}")
                time.sleep(attempt * 1.5)
            except Exception as e:
                logger.warning(f"Request failed on attempt {attempt}: {e}")
                time.sleep(attempt * 1.5)

        logger.error(f"Failed to fetch data from {url} after {max_retries} attempts.")
        return None

    def fetch_deterministic_point(
        self,
        lat: float,
        lon: float,
        variables: Optional[List[str]] = None,
        models: Optional[List[str]] = None,
        forecast_days: int = 3,
    ) -> Dict[str, Dict[str, np.ndarray]]:
        if variables is None:
            variables = ["t2m", "tp", "u10"]
        if models is None:
            models = list(DETERMINISTIC_MODELS.keys())

        om_vars = [VARIABLE_MAP[v] for v in variables if v in VARIABLE_MAP]
        if not om_vars:
            return {}

        params = {
            "latitude": lat,
            "longitude": lon,
            "hourly": ",".join(om_vars),
            "models": ",".join(models),
            "forecast_days": forecast_days,
            "timezone": "Asia/Kolkata",
        }

        data = self._get_with_retry(OPEN_METEO_URL, params)
        if not data:
            return {}

        hourly = data.get("hourly", {})
        result = {}

        for api_key, display_name in DETERMINISTIC_MODELS.items():
            if api_key not in models:
                continue
            model_data = {}
            for var in variables:
                om_var = VARIABLE_MAP.get(var)
                if not om_var:
                    continue
                key = f"{om_var}_{api_key}"
                if key in hourly and hourly[key] is not None:
                    raw_arr = [np.nan if x is None else x for x in hourly[key]]
                    model_data[var] = np.array(raw_arr, dtype=np.float64)
            if any(v is not None for v in model_data.values()):
                result[display_name] = model_data

        if "time" in hourly:
            result["_time"] = hourly["time"]

        return result

    def fetch_multi_model_grid(
        self,
        grid_points: Optional[List[Tuple[float, float]]] = None,
        variables: Optional[List[str]] = None,
        forecast_days: int = 3,
        include_ai: bool = True,
        include_ensemble: bool = False,
    ) -> Dict[str, xr.Dataset]:
        if grid_points is None:
            grid_points = INDIA_KEY_CITIES[:6]
        if variables is None:
            variables = ["t2m", "tp", "u10"]

        deterministic_models = list(DETERMINISTIC_MODELS.keys())
        if not include_ai:
            deterministic_models = [
                m for m in deterministic_models if "aifs" not in m and "graphcast" not in m
            ]

        model_accum: Dict[str, Dict[str, List[np.ndarray]]] = {}
        times_ref = None
        lats = []
        lons = []
        total = len(grid_points)

        for i, (lat, lon) in enumerate(grid_points):
            logger.info(f"Fetching point {i+1}/{total}: ({lat},{lon})")
            point_data = self.fetch_deterministic_point(
                lat, lon, variables, deterministic_models, forecast_days
            )

            # Pacing delay to stay well below Open-Meteo's per-minute threshold
            time.sleep(1.5)

            if not point_data or "_time" not in point_data:
                logger.warning(f"Skipping point ({lat},{lon}) due to empty API payload.")
                continue

            if times_ref is None:
                times_ref = point_data["_time"]

            lats.append(lat)
            lons.append(lon)

            for model_label, var_dict in point_data.items():
                if model_label == "_time":
                    continue
                if model_label not in model_accum:
                    model_accum[model_label] = {v: [] for v in variables}
                for var in variables:
                    vals = var_dict.get(var)
                    if vals is not None and len(vals) > 0:
                        model_accum[model_label][var].append(vals)
                    else:
                        model_accum[model_label][var].append(
                            np.full(len(times_ref), np.nan)
                        )

        if not times_ref or not lats:
            logger.error("No grid points succeeded. Returning empty dataset mapping.")
            return {}

        target_len = len(times_ref)
        times = np.array(times_ref, dtype="datetime64[ns]")

        datasets = {}
        for model_label, var_dict in model_accum.items():
            data_vars = {}
            for var in variables:
                if not var_dict[var]:
                    continue
                raw = np.array(var_dict[var]).T
                if raw.ndim == 2:
                    if raw.shape[0] > target_len:
                        raw = raw[:target_len, :]
                    elif raw.shape[0] < target_len:
                        pad = np.full((target_len - raw.shape[0], raw.shape[1]), np.nan)
                        raw = np.concatenate([raw, pad], axis=0)
                    data_vars[var] = (["time", "location"], raw)
                else:
                    data_vars[var] = (["time", "location"], np.full((target_len, len(lats)), np.nan))

            ds = xr.Dataset(
                data_vars,
                coords={
                    "time": times,
                    "location": list(range(len(lats))),
                    "latitude": ("location", lats),
                    "longitude": ("location", lons),
                },
                attrs={"model_name": model_label, "source": "open-meteo-deterministic"},
            )
            datasets[model_label] = ds

        return datasets

    def fetch_observations(
        self,
        grid_points: Optional[List[Tuple[float, float]]] = None,
        variables: Optional[List[str]] = None,
        forecast_days: int = 3,
    ) -> Optional[xr.Dataset]:
        if grid_points is None:
            grid_points = INDIA_KEY_CITIES[:6]
        if variables is None:
            variables = ["t2m", "tp", "u10"]

        om_vars = [VARIABLE_MAP[v] for v in variables if v in VARIABLE_MAP]
        obs_accum: Dict[str, List[np.ndarray]] = {v: [] for v in variables}
        times_ref = None
        lats = []
        lons = []

        for lat, lon in grid_points:
            params = {
                "latitude": lat,
                "longitude": lon,
                "hourly": ",".join(om_vars),
                "past_days": forecast_days,
                "forecast_days": 0,
                "timezone": "Asia/Kolkata",
            }

            data = self._get_with_retry(OPEN_METEO_URL, params)
            time.sleep(1.0)

            if not data:
                continue

            hourly = data.get("hourly", {})
            if not hourly or "time" not in hourly:
                continue

            if times_ref is None:
                times_ref = hourly["time"]

            lats.append(lat)
            lons.append(lon)

            for var in variables:
                om_var = VARIABLE_MAP.get(var)
                if om_var and om_var in hourly:
                    raw_arr = [np.nan if x is None else x for x in hourly[om_var]]
                    obs_accum[var].append(np.array(raw_arr, dtype=np.float64))
                else:
                    obs_accum[var].append(np.full(len(times_ref), np.nan))

        if not times_ref or not lats:
            return None

        target_len = len(times_ref)
        times = np.array(times_ref, dtype="datetime64[ns]")

        data_vars = {}
        for var in variables:
            raw = np.array(obs_accum[var])
            if raw.ndim == 2:
                raw = raw.T
                if raw.shape[0] > target_len:
                    raw = raw[:target_len, :]
                elif raw.shape[0] < target_len:
                    pad = np.full((target_len - raw.shape[0], raw.shape[1]), np.nan)
                    raw = np.concatenate([raw, pad], axis=0)
                data_vars[var] = (["time", "location"], raw)
            else:
                data_vars[var] = (["time", "location"], np.full((target_len, len(lats)), np.nan))

        return xr.Dataset(
            data_vars,
            coords={
                "time": times,
                "location": list(range(len(lats))),
                "latitude": ("location", lats),
                "longitude": ("location", lons),
            },
            attrs={"model_name": "OBS", "source": "open-meteo-historical"},
        )

    def close(self):
        self.client.close()