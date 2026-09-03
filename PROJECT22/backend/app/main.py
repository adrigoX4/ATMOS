from fastapi import FastAPI, WebSocket, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZIPMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import uuid
import os
import logging
from typing import Optional

from app.core.config import get_settings
from app.core.rate_limiter import RateLimitMiddleware
from app.api.endpoints import router as api_router
from app.api.websocket import websocket_endpoint, manager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()

# Configure allowed origins for CORS
ALLOWED_ORIGINS = [
    origin.strip() 
    for origin in os.getenv(
        "ALLOWED_ORIGINS", 
        "http://localhost:3000,http://localhost:5173"
    ).split(",")
]

logger.info(f"Allowed CORS origins: {ALLOWED_ORIGINS}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle manager."""
    logger.info("🚀 Application startup")
    try:
        # Startup logic here
        yield
    finally:
        logger.info("🛑 Application shutdown")
        # Cleanup logic here


def create_application() -> FastAPI:
    application = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="Dynamic AI-NWP Blending Platform API",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # Security: Trust host middleware
    application.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["localhost", "127.0.0.1", "frontend", "*.local"]
    )

    # Compression middleware
    application.add_middleware(GZIPMiddleware, minimum_size=1000)

    # CORS middleware
    application.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    # Rate limiting middleware
    application.add_middleware(RateLimitMiddleware)

    # Include API routes
    application.include_router(api_router, prefix=settings.API_PREFIX)

    # Global exception handlers
    @application.exception_handler(ValueError)
    async def value_error_handler(request, exc):
        logger.error(f"ValueError: {str(exc)}")
        return JSONResponse(
            status_code=400,
            content={"detail": "Invalid value provided", "error": str(exc)},
        )

    @application.exception_handler(Exception)
    async def general_exception_handler(request, exc):
        logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
        )

    # Health check endpoint
    @application.get("/health", tags=["System"])
    async def health_check():
        """Health check endpoint."""
        return {
            "status": "healthy",
            "version": settings.APP_VERSION,
            "environment": "production" if not settings.DEBUG else "development",
        }

    # Root endpoint
    @application.get("/", tags=["System"])
    async def root():
        """Root endpoint with API information."""
        return {
            "name": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "docs": "/docs",
            "health": "/health",
            "features": [
                "WebSocket real-time alerts",
                "Quantile regression probabilistic forecasts",
                "Google Earth Engine integration",
                "Redis performance caching",
                "A/B testing framework",
                "Automated seasonal retraining",
                "GeoTIFF export",
                "Rate limiting",
            ],
        }

    # WebSocket endpoint
    @application.websocket("/ws/{client_id}")
    async def websocket_route(websocket: WebSocket, client_id: Optional[str] = None):
        """WebSocket endpoint for real-time alert streaming."""
        try:
            if client_id is None:
                client_id = str(uuid.uuid4())[:8]
            logger.info(f"WebSocket connection attempt: {client_id}")
            await websocket_endpoint(websocket, client_id)
        except Exception as e:
            logger.error(f"WebSocket error for {client_id}: {str(e)}")
            raise

    # WebSocket stats endpoint
    @application.get("/ws/stats", tags=["WebSocket"])
    async def websocket_stats():
        """Get WebSocket connection statistics."""
        try:
            return manager.get_connection_stats()
        except Exception as e:
            logger.error(f"Error fetching WebSocket stats: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to fetch stats")

    return application


# Create and export the application instance
app = create_application()
# For development/debugging
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level="info",
    )
