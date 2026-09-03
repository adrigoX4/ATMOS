from celery import Celery
from celery.schedules import crontab
from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "weather_blending",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=1800,
    task_soft_time_limit=1500,
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=100,
)

celery_app.conf.beat_schedule = {
    "ingest-gfs-forecasts": {
        "task": "workers.tasks.ingest_model_forecasts",
        "schedule": crontab(hour="0,6,12,18", minute=0),
        "args": ("GFS",),
    },
    "ingest-ecmwf-forecasts": {
        "task": "workers.tasks.ingest_model_forecasts",
        "schedule": crontab(hour="0,12", minute=30),
        "args": ("ECMWF",),
    },
    "run-blending-pipeline": {
        "task": "workers.tasks.run_full_pipeline",
        "schedule": crontab(hour="1,7,13,19", minute=0),
    },
    "compute-verification-metrics": {
        "task": "workers.tasks.compute_verification_metrics",
        "schedule": crontab(hour="2", minute=0),
    },
}
