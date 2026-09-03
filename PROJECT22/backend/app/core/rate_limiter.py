import time
import logging
from typing import Dict, Optional, Callable
from fastapi import Request, Response, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from collections import defaultdict
import asyncio

logger = logging.getLogger(__name__)


class RateLimitConfig:
    def __init__(
        self,
        requests_per_minute: int = 60,
        requests_per_hour: int = 1000,
        burst_limit: int = 10,
    ):
        self.requests_per_minute = requests_per_minute
        self.requests_per_hour = requests_per_hour
        self.burst_limit = burst_limit


DEFAULT_CONFIGS = {
    "default": RateLimitConfig(60, 1000, 10),
    "forecast": RateLimitConfig(30, 500, 5),
    "alerts": RateLimitConfig(120, 2000, 20),
    "tiles": RateLimitConfig(200, 5000, 50),
    "export": RateLimitConfig(10, 100, 2),
}


class RateLimiter:
    """Token bucket rate limiter with sliding window."""

    def __init__(self):
        self.requests: Dict[str, list] = defaultdict(list)
        self.burst_counters: Dict[str, int] = defaultdict(int)
        self.last_reset: Dict[str, float] = {}

    def is_allowed(self, client_id: str, config: RateLimitConfig) -> bool:
        now = time.time()

        self.requests[client_id] = [
            t for t in self.requests[client_id] if now - t < 3600
        ]

        minute_requests = [
            t for t in self.requests[client_id] if now - t < 60
        ]

        if len(minute_requests) >= config.requests_per_minute:
            logger.warning(f"Rate limit exceeded for {client_id}: {len(minute_requests)}/min")
            return False

        if len(self.requests[client_id]) >= config.requests_per_hour:
            logger.warning(f"Hourly rate limit exceeded for {client_id}")
            return False

        if self.burst_counters[client_id] >= config.burst_limit:
            if now - self.last_reset.get(client_id, 0) < 1:
                return False
            self.burst_counters[client_id] = 0

        self.requests[client_id].append(now)
        self.burst_counters[client_id] += 1
        self.last_reset[client_id] = now

        return True

    def get_remaining(self, client_id: str, config: RateLimitConfig) -> Dict:
        now = time.time()
        minute_requests = [
            t for t in self.requests.get(client_id, []) if now - t < 60
        ]
        hour_requests = [
            t for t in self.requests.get(client_id, []) if now - t < 3600
        ]

        return {
            "remaining_minute": max(0, config.requests_per_minute - len(minute_requests)),
            "remaining_hour": max(0, config.requests_per_hour - len(hour_requests)),
            "reset_minute": 60 - (now - minute_requests[0]) if minute_requests else 60,
            "reset_hour": 3600 - (now - hour_requests[0]) if hour_requests else 3600,
        }


rate_limiter = RateLimiter()


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, default_config: Optional[RateLimitConfig] = None):
        super().__init__(app)
        self.default_config = default_config or DEFAULT_CONFIGS["default"]

    def _get_client_id(self, request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _get_config_for_path(self, path: str) -> RateLimitConfig:
        if "/tiles/" in path:
            return DEFAULT_CONFIGS["tiles"]
        elif "/alerts/" in path:
            return DEFAULT_CONFIGS["alerts"]
        elif "/export/" in path:
            return DEFAULT_CONFIGS["export"]
        elif "/forecast/" in path:
            return DEFAULT_CONFIGS["forecast"]
        return self.default_config

    async def dispatch(self, request: Request, call_next):
        if request.url.path in ("/docs", "/redoc", "/openapi.json", "/"):
            return await call_next(request)

        client_id = self._get_client_id(request)
        config = self._get_config_for_path(request.url.path)

        if not rate_limiter.is_allowed(client_id, config):
            remaining = rate_limiter.get_remaining(client_id, config)
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "Rate limit exceeded",
                    "retry_after": int(remaining["reset_minute"]),
                    "limits": {
                        "per_minute": config.requests_per_minute,
                        "per_hour": config.requests_per_hour,
                    },
                },
                headers={
                    "X-RateLimit-Limit": str(config.requests_per_minute),
                    "X-RateLimit-Remaining": str(remaining["remaining_minute"]),
                    "Retry-After": str(int(remaining["reset_minute"])),
                },
            )

        response = await call_next(request)

        remaining = rate_limiter.get_remaining(client_id, config)
        response.headers["X-RateLimit-Limit"] = str(config.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(remaining["remaining_minute"])

        return response


def rate_limit(category: str = "default"):
    """Decorator for per-endpoint rate limiting."""
    config = DEFAULT_CONFIGS.get(category, DEFAULT_CONFIGS["default"])

    def decorator(func: Callable):
        func._rate_limit_config = config
        func._rate_limit_category = category
        return func

    return decorator
