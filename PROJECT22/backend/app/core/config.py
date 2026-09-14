from pydantic_settings import BaseSettings
from functools import lru_cache
import os
from pathlib import Path

_backend_dir = Path(__file__).resolve().parent.parent.parent
_data_dir = str(_backend_dir / "data")


class Settings(BaseSettings):
    APP_NAME: str = "Dynamic AI-NWP Blending Platform"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    API_PREFIX: str = "/api/v1"

    DATABASE_URL: str = f"sqlite:///{_data_dir}/weather.db"

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

    # Local storage paths
    DATA_DIR: str = _data_dir

    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
