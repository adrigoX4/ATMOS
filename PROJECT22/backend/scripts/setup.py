#!/usr/bin/env python3
"""
Setup script for the Dynamic AI-NWP Weather Blending Platform.
This script initializes the database, creates sample data, and runs the blending pipeline.
"""

import sys
import os
import logging
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def setup_database():
    """Initialize database tables."""
    from app.core.database import engine, Base
    from app.models.models import (
        ForecastRun, ModelSkillMetric, BlendResult, ExtremeWeatherAlert
    )

    logger.info("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created successfully.")


def create_sample_data():
    """Create sample forecast data for all models."""
    from app.ingestion.data_ingestion import DataIngestionService
    from datetime import datetime
    from app.core.database import SessionLocal
    from app.models.models import ForecastRun

    ingestion = DataIngestionService(storage_base="./data/raw")
    db = SessionLocal()

    models = ["GFS", "ECMWF", "NCUM"]

    for model_name in models:
        logger.info(f"Creating sample data for {model_name}...")
        try:
            ds = ingestion.create_sample_data(model_name, n_times=5)

            run = ForecastRun(
                model_name=model_name,
                init_time=datetime.utcnow(),
                status="COMPLETED",
                storage_path=f"raw/{model_name}/{model_name}_latest.zarr",
            )
            db.add(run)
            db.commit()
            logger.info(f"Created sample data for {model_name}")

        except Exception as e:
            logger.error(f"Failed to create data for {model_name}: {e}")
            db.rollback()

    db.close()


def run_blending_pipeline():
    """Run the full blending pipeline."""
    from app.ingestion.data_ingestion import DataIngestionService
    from app.blending.engine import DynamicBlendingEngine
    from app.core.config import get_settings

    settings = get_settings()

    logger.info("Starting blending pipeline...")
    ingestion = DataIngestionService(storage_base="./data/raw")
    engine = DynamicBlendingEngine(
        lookback_steps=settings.DEFAULT_LOOKBACK,
        gamma=settings.GAMMA,
        epsilon=settings.EPSILON,
    )

    model_names = ["GFS", "ECMWF", "NCUM"]
    forecast_datasets = []

    for model_name in model_names:
        try:
            ds = ingestion.create_sample_data(model_name, n_times=5)
            forecast_datasets.append(ds)
            logger.info(f"Loaded {model_name} dataset")
        except Exception as e:
            logger.warning(f"Could not load {model_name}: {e}")

    if not forecast_datasets:
        logger.error("No forecast datasets available")
        return

    obs_dataset = ingestion.create_sample_data("OBS", n_times=5)
    variables = ["tp", "t2m", "u10", "v10"]

    logger.info("Computing adaptive weights...")
    blended_ds, weight_ds = engine.compute_blended_dataset(
        forecast_datasets, obs_dataset, variables, weight_method="inverse_error_variance"
    )

    logger.info("Detecting extreme events...")
    alerts = engine.detect_extreme_events(blended_ds)
    logger.info(f"Found {len(alerts)} extreme weather alerts")

    output_dir = Path("./data/blended/latest")
    output_dir.mkdir(parents=True, exist_ok=True)

    engine.save_blended_output(blended_ds, weight_ds, str(output_dir))

    logger.info(f"Blended output saved to {output_dir}")
    logger.info("Pipeline completed successfully!")


def main():
    """Main setup function."""
    logger.info("=" * 60)
    logger.info("Dynamic AI-NWP Weather Blending Platform - Setup")
    logger.info("=" * 60)

    setup_database()
    create_sample_data()
    run_blending_pipeline()

    logger.info("=" * 60)
    logger.info("Setup completed! Run 'docker-compose up' to start all services.")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
