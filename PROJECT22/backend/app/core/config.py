from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    APP_NAME: str = "Dynamic AI-NWP Blending Platform"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    API_PREFIX: str = "/api/v1"

    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://weather:weather123@localhost:5432/weather_blending"
    )
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    MINIO_ENDPOINT: str = os.getenv("MINIO_ENDPOINT", "localhost:9000")
    MINIO_ACCESS_KEY: str = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    MINIO_SECRET_KEY: str = os.getenv("MINIO_SECRET_KEY", "minioadmin")
    MINIO_BUCKET: str = os.getenv("MINIO_BUCKET", "weather-forecasts")

    # Grid configuration (South Asia 0.25 degree)
    GRID_LAT_MIN: float = 0.0
    GRID_LAT_MAX: float = 40.0
    GRID_LON_MIN: float = 60.0
    GRID_LON_MAX: float = 100.0
    GRID_RESOLUTION: float = 0.25

    # Blending parameters
    DEFAULT_LOOKBACK: int = 30
    GAMMA: float = 2.0
    EPSILON: float = 1e-6

    # Extreme weather thresholds (IMD standards)
    EXTREME_RAIN_THRESHOLD_MM: float = 115.5
    HEAVY_RAIN_THRESHOLD_MM: float = 64.5
    HEATWAVE_TEMP_THRESHOLD: float = 40.0
    SEVERE_WIND_THRESHOLD_KMH: float = 60.0

    class Config:
        case_sensitive = True
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
