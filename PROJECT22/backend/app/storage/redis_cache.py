import json
import logging
import hashlib
from typing import Any, Optional, Dict
from datetime import timedelta
import redis
import numpy as np

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class RedisCacheService:
    """Redis-based caching for model performance metrics and forecasts."""

    def __init__(self):
        self.client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        self.default_ttl = 3600

    def _make_key(self, prefix: str, *args) -> str:
        parts = [str(a) for a in args]
        raw = f"{prefix}:{':'.join(parts)}"
        return f"weather:{raw}"

    def get(self, key: str) -> Optional[Any]:
        try:
            data = self.client.get(key)
            if data:
                return json.loads(data)
            return None
        except Exception as e:
            logger.error(f"Redis get error: {e}")
            return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None):
        try:
            serialized = json.dumps(value, default=str)
            self.client.setex(key, ttl or self.default_ttl, serialized)
        except Exception as e:
            logger.error(f"Redis set error: {e}")

    def delete(self, key: str):
        try:
            self.client.delete(key)
        except Exception as e:
            logger.error(f"Redis delete error: {e}")

    def cache_model_metrics(
        self, model_name: str, variable: str, metrics: Dict, ttl: int = 1800
    ):
        key = self._make_key("metrics", model_name, variable)
        self.set(key, metrics, ttl)
        logger.info(f"Cached metrics for {model_name}/{variable}")

    def get_model_metrics(self, model_name: str, variable: str) -> Optional[Dict]:
        key = self._make_key("metrics", model_name, variable)
        return self.get(key)

    def cache_weight_tensor(
        self, variable: str, lead_time: int, weights: np.ndarray, ttl: int = 3600
    ):
        key = self._make_key("weights", variable, str(lead_time))
        weight_list = weights.tolist() if hasattr(weights, "tolist") else list(weights)
        self.set(key, {"weights": weight_list}, ttl)
        logger.info(f"Cached weights for {variable}/{lead_time}h")

    def get_weight_tensor(self, variable: str, lead_time: int) -> Optional[np.ndarray]:
        key = self._make_key("weights", variable, str(lead_time))
        data = self.get(key)
        if data and "weights" in data:
            return np.array(data["weights"])
        return None

    def cache_forecast(self, variable: str, lead_time: int, data: Dict, ttl: int = 7200):
        key = self._make_key("forecast", variable, str(lead_time))
        self.set(key, data, ttl)

    def get_forecast(self, variable: str, lead_time: int) -> Optional[Dict]:
        key = self._make_key("forecast", variable, str(lead_time))
        return self.get(key)

    def cache_extreme_alerts(self, alerts: list, ttl: int = 300):
        key = self._make_key("alerts", "active")
        self.set(key, {"alerts": alerts, "count": len(alerts)}, ttl)

    def get_extreme_alerts(self) -> Optional[Dict]:
        key = self._make_key("alerts", "active")
        return self.get(key)

    def invalidate_model_cache(self, model_name: str):
        pattern = self._make_key("*", model_name, "*")
        keys = self.client.keys(pattern)
        if keys:
            self.client.delete(*keys)
            logger.info(f"Invalidated {len(keys)} cache entries for {model_name}")

    def get_cache_stats(self) -> Dict:
        try:
            info = self.client.info("memory")
            keys_count = self.client.dbsize()
            return {
                "total_keys": keys_count,
                "used_memory": info.get("used_memory_human", "unknown"),
                "connected": True,
            }
        except Exception as e:
            return {"connected": False, "error": str(e)}
