import numpy as np
import logging
from typing import Dict, List, Tuple, Optional
from datetime import datetime
from app.ingestion.open_meteo_service import ALL_MODELS

logger = logging.getLogger(__name__)

REGION_BOUNDS = {
    "coastal_west": {"lat": (8, 24), "lon": (66, 74)},
    "coastal_east": {"lat": (8, 22), "lon": (80, 88)},
    "northern_plains": {"lat": (24, 36), "lon": (70, 82)},
    "central_india": {"lat": (18, 26), "lon": (74, 82)},
    "south_peninsular": {"lat": (8, 18), "lon": (74, 80)},
    "northeast": {"lat": (22, 30), "lon": (88, 98)},
    "western_ghats": {"lat": (8, 20), "lon": (73, 77)},
    "thar_desert": {"lat": (24, 30), "lon": (68, 74)},
}

SEASON_MONTHS = {
    "winter": [12, 1, 2],
    "pre_monsoon": [3, 4, 5],
    "monsoon": [6, 7, 8, 9],
    "post_monsoon": [10, 11],
}

MODEL_STRENGTHS = {
    "GFS": {
        "global_coverage": 1.0,
        "tropical_skill": 0.7,
        "extratropical_skill": 0.85,
        "precipitation_skill": 0.65,
        "temperature_skill": 0.8,
        "wind_skill": 0.8,
        "short_range_bias": 0.05,
        "extended_range_degradation": 0.15,
    },
    "ECMWF": {
        "global_coverage": 1.0,
        "tropical_skill": 0.9,
        "extratropical_skill": 0.95,
        "precipitation_skill": 0.85,
        "temperature_skill": 0.92,
        "wind_skill": 0.9,
        "short_range_bias": 0.02,
        "extended_range_degradation": 0.08,
    },
    "ICON": {
        "global_coverage": 0.8,
        "tropical_skill": 0.75,
        "extratropical_skill": 0.9,
        "precipitation_skill": 0.78,
        "temperature_skill": 0.85,
        "wind_skill": 0.85,
        "short_range_bias": 0.04,
        "extended_range_degradation": 0.12,
    },
    "AIFS": {
        "global_coverage": 1.0,
        "tropical_skill": 0.92,
        "extratropical_skill": 0.93,
        "precipitation_skill": 0.88,
        "temperature_skill": 0.94,
        "wind_skill": 0.88,
        "short_range_bias": 0.015,
        "extended_range_degradation": 0.06,
    },
    "GraphCast": {
        "global_coverage": 1.0,
        "tropical_skill": 0.91,
        "extratropical_skill": 0.94,
        "precipitation_skill": 0.82,
        "temperature_skill": 0.93,
        "wind_skill": 0.87,
        "short_range_bias": 0.02,
        "extended_range_degradation": 0.07,
    },
    "UKMO": {
        "global_coverage": 0.9,
        "tropical_skill": 0.78,
        "extratropical_skill": 0.88,
        "precipitation_skill": 0.75,
        "temperature_skill": 0.82,
        "wind_skill": 0.82,
        "short_range_bias": 0.04,
        "extended_range_degradation": 0.13,
    },
    "JMA": {
        "global_coverage": 0.85,
        "tropical_skill": 0.82,
        "extratropical_skill": 0.85,
        "precipitation_skill": 0.72,
        "temperature_skill": 0.8,
        "wind_skill": 0.78,
        "short_range_bias": 0.05,
        "extended_range_degradation": 0.14,
    },
    "MF": {
        "global_coverage": 0.85,
        "tropical_skill": 0.8,
        "extratropical_skill": 0.88,
        "precipitation_skill": 0.76,
        "temperature_skill": 0.83,
        "wind_skill": 0.81,
        "short_range_bias": 0.035,
        "extended_range_degradation": 0.11,
    },
    "CMA": {
        "global_coverage": 0.8,
        "tropical_skill": 0.75,
        "extratropical_skill": 0.78,
        "precipitation_skill": 0.7,
        "temperature_skill": 0.76,
        "wind_skill": 0.74,
        "short_range_bias": 0.06,
        "extended_range_degradation": 0.18,
    },
}

VAR_SKILL_KEY = {
    "t2m": "temperature_skill",
    "tp": "precipitation_skill",
    "u10": "wind_skill",
    "r": "temperature_skill",
    "msl": "extratropical_skill",
}

WEATHER_REGIME_THRESHOLDS = {
    "cyclone": {
        "wind_speed": 62,
        "pressure_drop": 10,
    },
    "heavy_monsoon": {
        "precipitation_rate": 15,
        "humidity_min": 80,
    },
    "heatwave": {
        "temperature_min": 40,
        "duration_hours": 48,
    },
    "cold_wave": {
        "temperature_max": 5,
        "duration_hours": 48,
    },
    "normal": {},
}


def classify_region(lat: float, lon: float) -> str:
    for region_name, bounds in REGION_BOUNDS.items():
        if (bounds["lat"][0] <= lat <= bounds["lat"][1] and
                bounds["lon"][0] <= lon <= bounds["lon"][1]):
            return region_name
    return "inland_general"


def classify_season(month: int) -> str:
    for season, months in SEASON_MONTHS.items():
        if month in months:
            return season
    return "unknown"


def detect_weather_regime(
    blended: np.ndarray,
    ensemble_spread: Optional[np.ndarray] = None,
    variable: str = "t2m",
) -> str:
    if variable == "tp":
        max_val = np.nanmax(blended)
        if max_val > WEATHER_REGIME_THRESHOLDS["heavy_monsoon"]["precipitation_rate"]:
            return "heavy_monsoon"
    elif variable == "t2m":
        max_val = np.nanmax(blended)
        min_val = np.nanmin(blended)
        if max_val > WEATHER_REGIME_THRESHOLDS["heatwave"]["temperature_min"]:
            return "heatwave"
        if min_val < WEATHER_REGIME_THRESHOLDS["cold_wave"]["temperature_max"]:
            return "cold_wave"
    elif variable == "u10":
        max_val = np.nanmax(blended)
        if max_val > WEATHER_REGIME_THRESHOLDS["cyclone"]["wind_speed"]:
            return "cyclone"
    return "normal"


def compute_smart_weights(
    model_datasets: Dict[str, any],
    obs_dataset: any,
    variables: List[str],
    grid_points: List[Tuple[float, float]],
    current_month: Optional[int] = None,
) -> Dict[str, Dict[str, float]]:
    if current_month is None:
        current_month = datetime.utcnow().month

    season = classify_season(current_month)
    model_names = [k for k in model_datasets.keys() if not k.startswith("_")]

    weights_per_var = {}

    for var in variables:
        model_scores = {}

        for model_name in model_names:
            ds = model_datasets.get(model_name)
            if ds is None or var not in ds:
                continue

            fc = ds[var].values
            if fc.ndim > 2:
                fc = fc.reshape(fc.shape[0], -1)

            obs = obs_dataset[var].values if var in obs_dataset else None
            if obs is not None and obs.ndim > 2:
                obs = obs.reshape(obs.shape[0], -1)

            if obs is not None:
                min_t = min(fc.shape[0], obs.shape[0])
                min_l = min(fc.shape[1], obs.shape[1])
                errors = fc[:min_t, :min_l] - obs[:min_t, :min_l]
                valid = ~np.isnan(errors)
                if valid.sum() > 0:
                    rmse = np.sqrt(np.mean(errors[valid] ** 2))
                    mae = np.mean(np.abs(errors[valid]))
                    bias = np.mean(errors[valid])
                else:
                    rmse, mae, bias = 1e6, 1e6, 0
            else:
                rmse, mae, bias = 1e6, 1e6, 0

            model_info = MODEL_STRENGTHS.get(model_name, {})
            skill_key = VAR_SKILL_KEY.get(var, "global_coverage")
            base_skill = model_info.get(skill_key, 0.5)

            region_bonus = 0.0
            if "ECMWF" in model_name or "AIFS" in model_name:
                region_bonus = 0.05
            elif "GFS" in model_name:
                region_bonus = 0.02

            season_bonus = 0.0
            if season == "monsoon" and var == "tp":
                if "ECMWF" in model_name or "AIFS" in model_name:
                    season_bonus = 0.08
            elif season == "winter" and var == "t2m":
                if "ECMWF" in model_name:
                    season_bonus = 0.05

            skill_score = base_skill * (1 + region_bonus + season_bonus)
            penalty = 1.0 / (1.0 + rmse / 10.0)
            model_scores[model_name] = skill_score * penalty

        total = sum(model_scores.values()) + 1e-10
        weights = {m: round(s / total, 4) for m, s in model_scores.items()}
        weights_per_var[var] = weights

    return weights_per_var


def compute_lead_time_adaptive_weights(
    base_weights: Dict[str, float],
    lead_time_hours: int,
    model_datasets: Dict[str, any],
    obs_dataset: any,
    variable: str,
) -> Dict[str, float]:
    adjusted = {}
    degradation_rates = {
        "GFS": 0.15,
        "ECMWF": 0.08,
        "ICON": 0.12,
        "AIFS": 0.06,
        "GraphCast": 0.07,
        "UKMO": 0.13,
        "JMA": 0.14,
        "MF": 0.11,
        "CMA": 0.18,
    }

    for model_name, base_w in base_weights.items():
        degradation = degradation_rates.get(model_name, 0.12)
        factor = 1.0 - degradation * (lead_time_hours / 72.0)
        adjusted[model_name] = base_w * max(factor, 0.3)

    total = sum(adjusted.values()) + 1e-10
    return {m: round(w / total, 4) for m, w in adjusted.items()}


def compute_regime_adaptive_weights(
    base_weights: Dict[str, float],
    regime: str,
    variable: str,
) -> Dict[str, float]:
    regime_adjustments = {
        "cyclone": {
            "ECMWF": 1.15,
            "AIFS": 1.1,
            "GraphCast": 1.05,
            "GFS": 0.9,
        },
        "heavy_monsoon": {
            "ECMWF": 1.1,
            "AIFS": 1.12,
            "GFS": 0.85,
            "ICON": 0.95,
        },
        "heatwave": {
            "ECMWF": 1.08,
            "AIFS": 1.1,
            "GFS": 0.95,
            "JMA": 0.9,
        },
        "cold_wave": {
            "ECMWF": 1.1,
            "GFS": 0.95,
            "UKMO": 0.92,
        },
    }

    if regime == "normal":
        return base_weights

    adjustments = regime_adjustments.get(regime, {})
    adjusted = {}
    for model_name, base_w in base_weights.items():
        factor = adjustments.get(model_name, 1.0)
        adjusted[model_name] = base_w * factor

    total = sum(adjusted.values()) + 1e-10
    return {m: round(w / total, 4) for m, w in adjusted.items()}


def blend_forecasts(
    model_datasets: Dict[str, any],
    weights: Dict[str, Dict[str, float]],
    variables: List[str],
) -> Dict[str, np.ndarray]:
    blended = {}
    model_names = [k for k in model_datasets.keys() if not k.startswith("_")]

    for var in variables:
        model_arrays = {}
        for model_name in model_names:
            ds = model_datasets.get(model_name)
            if ds is not None and var in ds:
                raw_arr = ds[var].values.astype(np.float64)
                if raw_arr.ndim > 2:
                    raw_arr = raw_arr.reshape(raw_arr.shape[0], -1)
                model_arrays[model_name] = raw_arr

        if not model_arrays:
            continue

        min_t = min(arr.shape[0] for arr in model_arrays.values())
        min_l = min(arr.shape[1] for arr in model_arrays.values())
        w = weights.get(var, {})

        accum_vals = np.zeros((min_t, min_l), dtype=np.float64)
        accum_weights = np.zeros((min_t, min_l), dtype=np.float64)

        for model_name, arr in model_arrays.items():
            weight = float(w.get(model_name, 1.0 / len(model_arrays)))
            if weight <= 0:
                continue

            slice_arr = arr[:min_t, :min_l]
            valid_mask = ~np.isnan(slice_arr)

            accum_vals[valid_mask] += weight * slice_arr[valid_mask]
            accum_weights[valid_mask] += weight

        # Normalize by valid weights; fallback to first available valid model value if zero
        result = np.zeros((min_t, min_l), dtype=np.float64)
        has_weights = accum_weights > 0
        result[has_weights] = accum_vals[has_weights] / accum_weights[has_weights]

        if not np.all(has_weights):
            fallback_mask = ~has_weights
            for arr in model_arrays.values():
                slice_arr = arr[:min_t, :min_l]
                valid = ~np.isnan(slice_arr) & fallback_mask
                result[valid] = slice_arr[valid]
                fallback_mask &= ~valid
                if not np.any(fallback_mask):
                    break

        blended[var] = result

    return blended


def detect_extreme_events(
    blended: Dict[str, np.ndarray],
    model_datasets: Dict[str, any],
    variables: List[str],
    grid_points: List[Tuple[float, float]],
    ensemble_stats: Optional[Dict] = None,
) -> List[Dict]:
    alerts = []
    model_names = [k for k in model_datasets.keys() if not k.startswith("_")]

    thresholds = {
        "t2m": {
            "heatwave": {"threshold": 40.0, "direction": "above"},
            "severe_heatwave": {"threshold": 45.0, "direction": "above"},
            "cold_wave": {"threshold": 5.0, "direction": "below"},
            "severe_cold_wave": {"threshold": 0.0, "direction": "below"},
        },
        "tp": {
            "heavy_rain": {"threshold": 64.5, "direction": "above"},
            "very_heavy_rain": {"threshold": 115.5, "direction": "above"},
            "extreme_rain": {"threshold": 200.0, "direction": "above"},
            "extremely_heavy_rain": {"threshold": 300.0, "direction": "above"},
        },
        "u10": {
            "strong_wind": {"threshold": 40.0, "direction": "above"},
            "very_strong_wind": {"threshold": 60.0, "direction": "above"},
            "storm_force_wind": {"threshold": 90.0, "direction": "above"},
            "hurricane_force_wind": {"threshold": 120.0, "direction": "above"},
        },
    }

    for var in variables:
        if var not in blended:
            continue
        arr = blended[var]
        var_thresholds = thresholds.get(var, {})

        for thresh_name, thresh_info in var_thresholds.items():
            thresh_val = thresh_info["threshold"]
            direction = thresh_info["direction"]

            if direction == "above":
                mask = arr > thresh_val
            else:
                mask = arr < thresh_val

            model_agreement = np.zeros_like(arr, dtype=float)
            for model_name in model_names:
                ds = model_datasets.get(model_name)
                if ds is not None and var in ds:
                    m_raw = ds[var].values
                    if m_raw.ndim > 2:
                        m_raw = m_raw.reshape(m_raw.shape[0], -1)
                    m_arr = m_raw[:arr.shape[0], :arr.shape[1]]
                    if direction == "above":
                        m_mask = m_arr > thresh_val
                    else:
                        m_mask = m_arr < thresh_val
                    model_agreement += m_mask.astype(float)
            model_agreement /= max(len(model_names), 1)

            for t_idx in range(mask.shape[0]):
                for l_idx in range(mask.shape[1]):
                    if mask[t_idx, l_idx] and l_idx < len(grid_points):
                        lat, lon = grid_points[l_idx]
                        val = float(arr[t_idx, l_idx])
                        agreement = float(model_agreement[t_idx, l_idx])

                        if agreement >= 0.8:
                            severity = "EXTREME"
                        elif agreement >= 0.6:
                            severity = "SEVERE"
                        elif agreement >= 0.4:
                            severity = "MODERATE"
                        else:
                            severity = "LOW"

                        confidence = agreement * 100
                        msg = (
                            f"{thresh_name.upper()} at ({lat:.1f},{lon:.1f}): "
                            f"{val:.1f} | {severity} | "
                            f"Model agreement: {confidence:.0f}% | "
                            f"Models: {', '.join(m for m in model_names if m in ALL_MODELS)}"
                        )

                        alerts.append({
                            "variable": var,
                            "type": thresh_name,
                            "severity": severity,
                            "latitude": lat,
                            "longitude": lon,
                            "value": val,
                            "threshold": thresh_val,
                            "message": msg,
                            "confidence": confidence,
                            "lead_time_hours": t_idx,
                            "regime": detect_weather_regime(
                                arr[t_idx:t_idx+1, l_idx:l_idx+1],
                                variable=var,
                            ),
                        })

    return alerts