import logging
from datetime import datetime
from workers.celery_app import celery_app
from app.ingestion.data_ingestion import DataIngestionService
from app.blending.engine import DynamicBlendingEngine
from app.storage.minio_service import StorageService
from app.core.config import get_settings
import numpy as np

logger = logging.getLogger(__name__)
settings = get_settings()


@celery_app.task(bind=True, name="workers.tasks.ingest_model_forecasts")
def ingest_model_forecasts(self, model_name: str):
    """Ingest forecast data from a specific model."""
    logger.info(f"Starting ingestion for {model_name}")

    try:
        ingestion = DataIngestionService()
        ds = ingestion.create_sample_data(model_name, n_times=5)

        storage = StorageService()
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        object_name = f"raw/{model_name}/{timestamp}/data.zarr"
        storage.upload_zarr_dataset(ds, object_name)

        logger.info(f"Completed ingestion for {model_name}: {object_name}")
        return {"status": "success", "model": model_name, "path": object_name}

    except Exception as e:
        logger.error(f"Ingestion failed for {model_name}: {e}")
        raise self.retry(exc=e, countdown=300)


@celery_app.task(bind=True, name="workers.tasks.run_full_pipeline")
def run_full_pipeline(self):
    """Run the complete blending pipeline."""
    logger.info("Starting full blending pipeline")

    try:
        ingestion = DataIngestionService()
        blending_engine = DynamicBlendingEngine(
            lookback_steps=settings.DEFAULT_LOOKBACK,
            gamma=settings.GAMMA,
            epsilon=settings.EPSILON,
        )
        storage = StorageService()

        model_names = ["GFS", "ECMWF", "NCUM"]
        forecast_datasets = []

        for model_name in model_names:
            try:
                ds = ingestion.create_sample_data(model_name, n_times=5)
                forecast_datasets.append(ds)
                logger.info(f"Loaded data for {model_name}")
            except Exception as e:
                logger.warning(f"Could not load {model_name}: {e}")

        if not forecast_datasets:
            logger.error("No forecast datasets available")
            return {"status": "failed", "error": "No datasets"}

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

        alerts_data = {
            "timestamp": timestamp,
            "alerts": alerts,
            "total_alerts": len(alerts),
        }
        storage.upload_json(alerts_data, f"{blend_path}/alerts.json")

        logger.info(f"Pipeline completed: {blend_path}, {len(alerts)} alerts")

        return {
            "status": "success",
            "blend_path": blend_path,
            "alerts_count": len(alerts),
        }

    except Exception as e:
        logger.error(f"Pipeline failed: {e}")
        raise self.retry(exc=e, countdown=600)


@celery_app.task(bind=True, name="workers.tasks.compute_verification_metrics")
def compute_verification_metrics(self):
    """Compute verification metrics for all models."""
    logger.info("Computing verification metrics")

    try:
        ingestion = DataIngestionService()
        blending_engine = DynamicBlendingEngine()

        model_names = ["GFS", "ECMWF", "NCUM"]
        obs_dataset = ingestion.create_sample_data("OBS", n_times=5)

        metrics = {}
        for model_name in model_names:
            try:
                model_ds = ingestion.create_sample_data(model_name, n_times=5)
                model_metrics = {}

                for var in ["tp", "t2m", "u10", "v10"]:
                    m = blending_engine.compute_verification_metrics(
                        model_ds, obs_dataset, var
                    )
                    if m:
                        model_metrics[var] = m

                metrics[model_name] = model_metrics
                logger.info(f"Metrics for {model_name}: {model_metrics}")

            except Exception as e:
                logger.warning(f"Could not compute metrics for {model_name}: {e}")

        storage = StorageService()
        storage.upload_json(metrics, f"metrics/{datetime.utcnow().strftime('%Y%m%d')}.json")

        return {"status": "success", "metrics": metrics}

    except Exception as e:
        logger.error(f"Metrics computation failed: {e}")
        raise self.retry(exc=e, countdown=300)
