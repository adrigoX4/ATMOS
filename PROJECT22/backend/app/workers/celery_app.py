"""
Simplified scheduler module.
Original Celery tasks are now simple synchronous functions.
"""
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


def run_pipeline_sync():
    """Run the full blending pipeline synchronously."""
    from app.ingestion.data_ingestion import DataIngestionService
    from app.blending.engine import DynamicBlendingEngine
    from app.storage.minio_service import StorageService
    from app.core.config import get_settings

    settings = get_settings()
    logger.info("Starting full blending pipeline...")

    ingestion = DataIngestionService()
    blending_engine = DynamicBlendingEngine(
        lookback_steps=settings.DEFAULT_LOOKBACK,
        gamma=settings.GAMMA,
        epsilon=settings.EPSILON,
    )
    storage = StorageService()

    models = ["GFS", "ECMWF", "NCUM"]
    forecast_datasets = []
    for model in models:
        try:
            ds = ingestion.create_sample_data(model, n_times=5)
            forecast_datasets.append(ds)
        except Exception as ex:
            logger.warning(f"Could not load dataset for {model}: {ex}")

    if not forecast_datasets:
        return {"status": "failed", "reason": "No forecast datasets available"}

    obs_dataset = ingestion.create_sample_data("OBS", n_times=5)
    variables = ["tp", "t2m", "u10", "v10"]

    blended_ds, weight_ds = blending_engine.compute_blended_dataset(
        forecast_datasets, obs_dataset, variables, weight_method="inverse_error_variance"
    )
    alerts = blending_engine.detect_extreme_events(blended_ds)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    blend_path = f"blended/{timestamp}"
    storage.upload_zarr_dataset(blended_ds, f"{blend_path}/data.zarr")
    storage.upload_zarr_dataset(weight_ds, f"{blend_path}/weights.zarr")
    storage.upload_json({"timestamp": timestamp, "alerts": alerts}, f"{blend_path}/alerts.json")

    logger.info(f"Pipeline complete: {blend_path}, {len(alerts)} alerts")
    return {"status": "success", "blend_path": blend_path, "alerts": len(alerts)}
