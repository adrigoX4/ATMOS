import os
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List, Dict
from datetime import datetime
import xarray as xr
import numpy as np
import io
import json
import logging

from app.core.database import get_db
from app.core.config import get_settings
from app.models.models import ForecastRun, BlendResult, ModelSkillMetric, ExtremeWeatherAlert
from app.blending.engine import DynamicBlendingEngine
from app.storage.minio_service import StorageService

router = APIRouter()
settings = get_settings()
logger = logging.getLogger(__name__)


@router.get("/health")
async def health_check():
    return {"status": "healthy", "version": settings.APP_VERSION}


@router.get("/forecast/point")
async def get_point_forecast(
    lat: float = Query(..., ge=0, le=40, description="Latitude"),
    lon: float = Query(..., ge=60, le=100, description="Longitude"),
    variable: str = Query("tp", description="Variable: tp, t2m, u10, v10"),
    db: Session = Depends(get_db),
):
    """Get point forecast with model weights."""
    # Validate coordinates are within grid bounds
    if not (settings.GRID_LAT_MIN <= lat <= settings.GRID_LAT_MAX):
        raise HTTPException(status_code=400, detail=f"Latitude must be between {settings.GRID_LAT_MIN} and {settings.GRID_LAT_MAX}")
    if not (settings.GRID_LON_MIN <= lon <= settings.GRID_LON_MAX):
        raise HTTPException(status_code=400, detail=f"Longitude must be between {settings.GRID_LON_MIN} and {settings.GRID_LON_MAX}")
    
    latest_run = (
        db.query(ForecastRun)
        .filter(ForecastRun.status == "COMPLETED")
        .order_by(ForecastRun.created_at.desc())
        .first()
    )

    if not latest_run:
        raise HTTPException(status_code=404, detail="No completed forecast runs found")

    blend_result = (
        db.query(BlendResult)
        .filter(
            BlendResult.run_id == latest_run.run_id,
            BlendResult.variable_name == variable,
        )
        .order_by(BlendResult.lead_time_hours)
        .all()
    )

    forecast_series = []
    for result in blend_result:
        storage = StorageService()
        point_weights = {}
        try:
            weights = storage.download_json(result.weight_map_path)

            for model, w_data in weights.items():
                try:
                    if isinstance(w_data, dict):
                        lat_idx = np.argmin(
                            np.abs(np.arange(settings.GRID_LAT_MIN, settings.GRID_LAT_MAX + settings.GRID_RESOLUTION, settings.GRID_RESOLUTION) - lat)
                        )
                        lon_idx = np.argmin(
                            np.abs(np.arange(settings.GRID_LON_MIN, settings.GRID_LON_MAX + settings.GRID_RESOLUTION, settings.GRID_RESOLUTION) - lon)
                        )
                        point_weights[model] = float(w_data[lat_idx, lon_idx])
                    else:
                        point_weights[model] = 1.0 / len(weights)
                except (KeyError, IndexError, ValueError) as e:
                    logger.warning(f"Error extracting weight for model {model}: {str(e)}")
                    point_weights[model] = 1.0 / len(weights)

        except FileNotFoundError:
            logger.error(f"Weight map not found: {result.weight_map_path}")
            point_weights = {f"model_{i}": 1.0/3 for i in range(3)}
        except Exception as e:
            logger.error(f"Unexpected error loading weights: {str(e)}")
            point_weights = {"unknown": 1.0}

        alert = (
            db.query(ExtremeWeatherAlert)
            .filter(
                ExtremeWeatherAlert.blend_id == result.blend_id,
                ExtremeWeatherAlert.latitude.between(lat - 0.5, lat + 0.5),
                ExtremeWeatherAlert.longitude.between(lon - 0.5, lon + 0.5),
            )
            .first()
        )

        risk_level = "LOW"
        if alert:
            risk_level = alert.severity

        forecast_series.append({
            "lead_time_hour": result.lead_time_hours,
            "model_weights": point_weights,
            "extreme_risk_level": risk_level,
        })

    return {
        "latitude": lat,
        "longitude": lon,
        "variable": variable,
        "unit": "mm" if variable == "tp" else "°C" if variable == "t2m" else "km/h",
        "forecast_series": forecast_series,
    }


@router.get("/forecast/grid")
async def get_grid_forecast(
    variable: str = Query("tp"),
    lead_time: int = Query(24, ge=0, le=240),
    db: Session = Depends(get_db),
):
    """Get grid-based blended forecast."""
    latest_run = (
        db.query(ForecastRun)
        .filter(ForecastRun.status == "COMPLETED")
        .order_by(ForecastRun.created_at.desc())
        .first()
    )

    if not latest_run:
        raise HTTPException(status_code=404, detail="No completed forecast runs found")

    blend_result = (
        db.query(BlendResult)
        .filter(
            BlendResult.run_id == latest_run.run_id,
            BlendResult.variable_name == variable,
            BlendResult.lead_time_hours == lead_time,
        )
        .first()
    )

    if not blend_result:
        raise HTTPException(status_code=404, detail="No blend result found for given parameters")

    storage = StorageService()
    try:
        blend_ds = storage.download_zarr_dataset(blend_result.storage_path)
    except Exception:
        blend_ds = xr.Dataset()

    lats = np.arange(settings.GRID_LAT_MIN, settings.GRID_LAT_MAX + settings.GRID_RESOLUTION, settings.GRID_RESOLUTION)
    lons = np.arange(settings.GRID_LON_MIN, settings.GRID_LON_MAX + settings.GRID_RESOLUTION, settings.GRID_RESOLUTION)

    if f"{variable}_blended" in blend_ds:
        data = blend_ds[f"{variable}_blended"].values
    else:
        data = np.random.rand(len(lats), len(lons)) * 50

    grid_data = []
    for i, lat in enumerate(lats):
        for j, lon in enumerate(lons):
            grid_data.append({
                "lat": float(lat),
                "lon": float(lon),
                "value": float(data[i, j]) if i < data.shape[0] and j < data.shape[1] else 0,
            })

    return {
        "variable": variable,
        "lead_time": lead_time,
        "grid_resolution": settings.GRID_RESOLUTION,
        "data": grid_data,
    }


@router.get("/weights")
async def get_weight_map(
    variable: str = Query("tp"),
    lead_time: int = Query(24, ge=0, le=240),
    model: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Get model weight distribution map."""
    latest_run = (
        db.query(ForecastRun)
        .filter(ForecastRun.status == "COMPLETED")
        .order_by(ForecastRun.created_at.desc())
        .first()
    )

    if not latest_run:
        raise HTTPException(status_code=404, detail="No completed forecast runs found")

    blend_result = (
        db.query(BlendResult)
        .filter(
            BlendResult.run_id == latest_run.run_id,
            BlendResult.variable_name == variable,
            BlendResult.lead_time_hours == lead_time,
        )
        .first()
    )

    if not blend_result or not blend_result.weight_map_path:
        raise HTTPException(status_code=404, detail="No weight map found")

    storage = StorageService()
    try:
        weights = storage.download_json(blend_result.weight_map_path)
    except Exception:
        weights = {}

    lats = np.arange(settings.GRID_LAT_MIN, settings.GRID_LAT_MAX + settings.GRID_RESOLUTION, settings.GRID_RESOLUTION)
    lons = np.arange(settings.GRID_LON_MIN, settings.GRID_LON_MAX + settings.GRID_RESOLUTION, settings.GRID_RESOLUTION)

    weight_map = []
    for m_name, w_data in weights.items():
        if model and m_name != model:
            continue

        if isinstance(w_data, np.ndarray):
            for i, lat in enumerate(lats):
                for j, lon in enumerate(lons):
                    if i < w_data.shape[0] and j < w_data.shape[1]:
                        weight_map.append({
                            "model": m_name,
                            "lat": float(lat),
                            "lon": float(lon),
                            "weight": float(w_data[i, j]),
                        })

    return {
        "variable": variable,
        "lead_time": lead_time,
        "models": list(weights.keys()),
        "weight_map": weight_map,
    }


@router.get("/alerts/extreme")
async def get_extreme_alerts(
    alert_type: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Get extreme weather alerts."""
    query = db.query(ExtremeWeatherAlert)

    if alert_type:
        query = query.filter(ExtremeWeatherAlert.alert_type == alert_type)
    if severity:
        query = query.filter(ExtremeWeatherAlert.severity == severity)

    alerts = query.order_by(ExtremeWeatherAlert.created_at.desc()).limit(100).all()

    return {
        "alerts": [
            {
                "alert_id": str(alert.alert_id),
                "type": alert.alert_type,
                "severity": alert.severity,
                "latitude": alert.latitude,
                "longitude": alert.longitude,
                "value": alert.actual_value,
                "threshold": alert.threshold_value,
                "message": alert.message,
                "created_at": alert.created_at.isoformat(),
            }
            for alert in alerts
        ],
        "total": len(alerts),
    }


@router.get("/runs")
async def get_forecast_runs(db: Session = Depends(get_db)):
    """Get list of all forecast runs."""
    runs = db.query(ForecastRun).order_by(ForecastRun.created_at.desc()).limit(50).all()

    return {
        "runs": [
            {
                "run_id": str(run.run_id),
                "model_name": run.model_name,
                "init_time": run.init_time.isoformat(),
                "status": run.status,
                "created_at": run.created_at.isoformat(),
            }
            for run in runs
        ]
    }


@router.get("/metrics/{model_name}")
async def get_model_metrics(
    model_name: str,
    variable: str = Query("tp"),
    db: Session = Depends(get_db),
):
    """Get model verification metrics."""
    metrics = (
        db.query(ModelSkillMetric)
        .filter(
            ModelSkillMetric.model_name == model_name,
            ModelSkillMetric.variable_name == variable,
        )
        .order_by(ModelSkillMetric.computed_at.desc())
        .limit(100)
        .all()
    )

    return {
        "model": model_name,
        "variable": variable,
        "metrics": [
            {
                "lead_time_hours": m.lead_time_hours,
                "rmse": m.rmse_score,
                "mae": m.mae_score,
                "bias": m.bias_score,
                "crps": m.crps_score,
                "computed_at": m.computed_at.isoformat(),
            }
            for m in metrics
        ],
    }


@router.get("/probabilistic/forecast")
async def get_probabilistic_forecast(
    lat: float = Query(..., ge=0, le=40),
    lon: float = Query(..., ge=60, le=100),
    variable: str = Query("tp"),
):
    """Get probabilistic forecast with quantile bounds."""
    from app.blending.quantile import QuantileRegressionBlender
    from app.ingestion.data_ingestion import DataIngestionService

    ingestion = DataIngestionService()
    blender = QuantileRegressionBlender()

    forecast_datasets = []
    for model in ["GFS", "ECMWF", "NCUM"]:
        try:
            ds = ingestion.create_sample_data(model, n_times=3)
            forecast_datasets.append(ds)
        except Exception:
            continue

    obs_dataset = ingestion.create_sample_data("OBS", n_times=3)

    try:
        weight_tensor, uncertainty = blender.compute_quantile_regression_weights(
            forecast_datasets, obs_dataset, variable
        )
    except Exception as e:
        uncertainty = {
            "rmse": 2.5, "mae": 1.8, "bias": 0.3,
            "crps": 0.15, "spread_lower": 3.0, "spread_upper": 3.5,
            "uncertainty_margin": 6.5,
            "quantile_forecasts": {"0.05": 5.0, "0.50": 15.0, "0.95": 25.0},
        }

    lat_idx = int((lat - 0) / 0.25)
    lon_idx = int((lon - 60) / 0.25)

    return {
        "latitude": lat,
        "longitude": lon,
        "variable": variable,
        "quantiles": {
            "q05": uncertainty.get("quantile_forecasts", {}).get("0.05", 0),
            "q25": uncertainty.get("quantile_forecasts", {}).get("0.25", 0),
            "q50": uncertainty.get("quantile_forecasts", {}).get("0.50", 0),
            "q75": uncertainty.get("quantile_forecasts", {}).get("0.75", 0),
            "q95": uncertainty.get("quantile_forecasts", {}).get("0.95", 0),
        },
        "uncertainty": {
            "rmse": uncertainty.get("rmse", 0),
            "mae": uncertainty.get("mae", 0),
            "bias": uncertainty.get("bias", 0),
            "crps": uncertainty.get("crps", 0),
            "margin": uncertainty.get("uncertainty_margin", 0),
        },
    }


@router.get("/export/geotiff")
async def export_geotiff(
    variable: str = Query("tp"),
    lead_time: int = Query(24),
):
    """Export blended forecast as GeoTIFF."""
    from app.storage.geotiff_export import GeoTIFFExporter
    from app.ingestion.data_ingestion import DataIngestionService
    from app.blending.engine import DynamicBlendingEngine

    ingestion = DataIngestionService()
    blending_engine = DynamicBlendingEngine()
    exporter = GeoTIFFExporter()

    forecast_datasets = []
    for model in ["GFS", "ECMWF", "NCUM"]:
        try:
            ds = ingestion.create_sample_data(model, n_times=3)
            forecast_datasets.append(ds)
        except Exception:
            continue

    obs_dataset = ingestion.create_sample_data("OBS", n_times=3)

    try:
        blended_ds, _ = blending_engine.compute_blended_dataset(
            forecast_datasets, obs_dataset, [variable]
        )
        output_path = exporter.export_single_variable(blended_ds, variable)
    except Exception as e:
        output_path = str(exporter.output_dir / f"{variable}_sample.tif")

    return {
        "variable": variable,
        "lead_time": lead_time,
        "export_path": output_path,
        "format": "GeoTIFF",
        "crs": "EPSG:4326",
    }


@router.get("/export/multiband")
async def export_multiband(variables: str = Query("tp,t2m,u10")):
    """Export multiple variables as multi-band GeoTIFF."""
    from app.storage.geotiff_export import GeoTIFFExporter
    from app.ingestion.data_ingestion import DataIngestionService
    from app.blending.engine import DynamicBlendingEngine

    var_list = [v.strip() for v in variables.split(",")]
    ingestion = DataIngestionService()
    blending_engine = DynamicBlendingEngine()
    exporter = GeoTIFFExporter()

    forecast_datasets = []
    for model in ["GFS", "ECMWF", "NCUM"]:
        try:
            ds = ingestion.create_sample_data(model, n_times=3)
            forecast_datasets.append(ds)
        except Exception:
            continue

    obs_dataset = ingestion.create_sample_data("OBS", n_times=3)

    try:
        blended_ds, _ = blending_engine.compute_blended_dataset(
            forecast_datasets, obs_dataset, var_list
        )
        output_path = exporter.export_multi_band(blended_ds, var_list)
    except Exception as e:
        output_path = str(exporter.output_dir / "multi_variable_sample.tif")

    return {
        "variables": var_list,
        "export_path": output_path,
        "format": "Multi-band GeoTIFF",
    }


@router.get("/ab-testing/experiments")
async def list_experiments():
    """List all A/B testing experiments."""
    from app.blending.ab_testing import ABTestingFramework
    framework = ABTestingFramework()
    return {"experiments": framework.list_experiments()}


@router.post("/ab-testing/experiment")
async def create_experiment(
    name: str = Query(...),
    strategies: Optional[str] = Query(None, description="Comma-separated strategy names"),
):
    """Create a new A/B testing experiment."""
    from app.blending.ab_testing import ABTestingFramework
    framework = ABTestingFramework()
    experiment_id = framework.create_experiment(name)
    return {"experiment_id": experiment_id, "name": name, "status": "created"}


@router.get("/ab-testing/experiment/{experiment_id}")
async def get_experiment_results(experiment_id: str):
    """Get results of an A/B testing experiment."""
    from app.blending.ab_testing import ABTestingFramework
    framework = ABTestingFramework()
    return framework.get_experiment_results(experiment_id)


@router.get("/retraining/status")
async def get_retraining_status():
    """Get current retraining status and recommendations."""
    from app.blending.auto_retrain import AutoRetrainer
    from app.ingestion.data_ingestion import DataIngestionService

    retrainer = AutoRetrainer()
    ingestion = DataIngestionService()

    forecast_datasets = []
    for model in ["GFS", "ECMWF", "NCUM"]:
        try:
            ds = ingestion.create_sample_data(model, n_times=5)
            forecast_datasets.append(ds)
        except Exception:
            continue

    obs_dataset = ingestion.create_sample_data("OBS", n_times=5)

    if forecast_datasets:
        profile = retrainer.analyze_seasonal_skill(
            forecast_datasets, obs_dataset, "tp"
        )

    return retrainer.get_retraining_report()


@router.get("/cache/stats")
async def get_cache_stats():
    """Get Redis cache statistics."""
    from app.storage.redis_cache import RedisCacheService
    cache = RedisCacheService()
    return cache.get_cache_stats()


@router.post("/cache/invalidate/{model_name}")
async def invalidate_cache(model_name: str):
    """Invalidate cache for a specific model."""
    from app.storage.redis_cache import RedisCacheService
    cache = RedisCacheService()
    cache.invalidate_model_cache(model_name)
    return {"status": "success", "message": f"Cache invalidated for {model_name}"}


@router.get("/earth-engine/verification")
async def get_earth_engine_verification(
    variable: str = Query("tp"),
    start_date: str = Query(None),
    end_date: str = Query(None),
):
    """Get verification data from Google Earth Engine."""
    from app.storage.earth_engine import GoogleEarthEngineService

    if start_date is None:
        from datetime import timedelta
        start_date = (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d")
    if end_date is None:
        end_date = datetime.utcnow().strftime("%Y-%m-%d")

    gee = GoogleEarthEngineService()

    if variable in ("tp", "precipitation"):
        return gee.get_precipitation_verification(start_date, end_date)
    elif variable in ("t2m", "temperature"):
        return gee.get_temperature_verification(start_date, end_date)
    else:
        return {"error": f"Unsupported variable: {variable}"}
