from celery import shared_task
from app.core.database import SessionLocal
from app.models.models import ForecastRun
import logging

logger = logging.getLogger(__name__)


@shared_task
def process_forecast_run(run_id: str):
    """Process a forecast run asynchronously."""
    db = SessionLocal()
    try:
        forecast_run = db.query(ForecastRun).filter(ForecastRun.run_id == run_id).first()
        if forecast_run:
            forecast_run.status = "PROCESSING"
            db.commit()
            logger.info(f"Processing forecast run: {run_id}")
            # Add processing logic here
    except Exception as e:
        logger.error(f"Error processing forecast run {run_id}: {str(e)}")
    finally:
        db.close()


@shared_task
def retrain_models():
    """Periodic task to retrain models with new data."""
    logger.info("Starting model retraining task")
    try:
        # Add retraining logic here
        pass
    except Exception as e:
        logger.error(f"Error during model retraining: {str(e)}")
