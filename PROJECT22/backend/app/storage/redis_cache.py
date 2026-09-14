import json
import logging
import time
from typing import Any, Optional, Dict
import numpy as np

logger = logging.getLogger(__name__)


class RedisCacheService:
    """In-memory cache replacing Redis."""

    def __init__(self):
        self._store: Dict[str, Dict] = {}
        self.default_ttl = 3600

    def _make_key(self, prefix: str, *args) -> str:
        parts = [str(a) for a in args]
        raw = f"{prefix}:{':'.join(parts)}"
        return f"weather:{raw}"

    def _is_expired(self, key: str) -> bool:
        entry = self._store.get(key)
        if entry is None:
            return True
        if entry["expires_at"] and time.time() > entry["expires_at"]:
            del self._store[key]
            return True
        return False

    def get(self, key: str) -> Optional[Any]:
        if self._is_expired(key):
            return None
        entry = self._store.get(key)
        return entry["value"] if entry else None

    def set(self, key: str, value: Any, ttl: Optional[int] = None):
        self._store[key] = {
            "value": value,
            "expires_at": time.time() + (ttl or self.default_ttl) if (ttl or self.default_ttl) > 0 else None,
        }

    def delete(self, key: str):
        self._store.pop(key, None)

    def cache_model_metrics(self, model_name: str, variable: str, metrics: Dict, ttl: int = 1800):
        key = self._make_key("metrics", model_name, variable)
        self.set(key, metrics, ttl)

    def get_model_metrics(self, model_name: str, variable: str) -> Optional[Dict]:
        key = self._make_key("metrics", model_name, variable)
        return self.get(key)

    def cache_weight_tensor(self, variable: str, lead_time: int, weights: np.ndarray, ttl: int = 3600):
        key = self._make_key("weights", variable, str(lead_time))
        weight_list = weights.tolist() if hasattr(weights, "tolist") else list(weights)
        self.set(key, {"weights": weight_list}, ttl)

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
        prefix = f"weather:*:{model_name}:*"
        keys_to_delete = [k for k in self._store if model_name in k]
        for k in keys_to_delete:
            del self._store[k]
        logger.info(f"Invalidated {len(keys_to_delete)} cache entries for {model_name}")

    def get_cache_stats(self) -> Dict:
        return {
            "total_keys": len(self._store),
            "connected": True,
        }
