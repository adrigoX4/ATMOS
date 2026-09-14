from fastapi import FastAPI, WebSocket, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import uuid
import os
import logging
import asyncio
from typing import Optional

from app.core.config import get_settings
from app.api.endpoints import router as api_router
from app.api.websocket import websocket_endpoint, manager
from app.workers.alert_scanner import alert_engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Application startup: Initializing database and operational services")
    from app.core.database import engine, Base
    Base.metadata.create_all(bind=engine)
    logger.info("Database schema verified and ensured")

    # 1. Existing pipeline thread initialization
    import threading
    def _startup_pipeline():
        try:
            from app.workers.tasks import run_real_pipeline
            result = run_real_pipeline()
            logger.info(f"Startup pipeline baseline execution complete: {result}")
        except Exception as e:
            logger.error(f"Startup pipeline execution error: {e}", exc_info=True)

    thread = threading.Thread(target=_startup_pipeline, daemon=True)
    thread.start()
    logger.info("Real Open-Meteo blending pipeline running in background thread")

    # 2. Asynchronous Pan-India Operational Hazard Daemon
    async def periodic_subdivision_audit():
        logger.info("Starting automated Pan-India IMD threshold audit daemon...")
        while True:
            try:
                await alert_engine.scan_all_stations()
            except Exception as e:
                logger.error(f"Pan-India daemon audit error: {e}", exc_info=True)
            # Repeat surveillance cycle every 15 minutes (900 seconds)
            await asyncio.sleep(900)

    scanner_task = asyncio.create_task(periodic_subdivision_audit())

    yield

    # Clean shutdown
    scanner_task.cancel()
    logger.info("Application shutdown: Operational services terminated cleanly")


def create_application() -> FastAPI:
    application = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="Dynamic AI-NWP Blending Platform API",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    application.include_router(api_router, prefix=settings.API_PREFIX)

    @application.exception_handler(ValueError)
    async def value_error_handler(request, exc):
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

    @application.get("/health", tags=["System"])
    async def health_check():
        return {
            "status": "healthy",
            "version": settings.APP_VERSION,
            "regime": alert_engine.active_regime,
            "active_alerts_count": len(alert_engine.cached_alerts),
            "last_sync": alert_engine.last_sync_time or "Initializing...",
        }

    @application.get("/", tags=["System"])
    async def root():
        return {
            "name": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "docs": "/docs",
            "health": "/health",
        }

    @application.websocket("/ws/{client_id}")
    async def websocket_route(websocket: WebSocket, client_id: Optional[str] = None):
        try:
            if client_id is None:
                client_id = str(uuid.uuid4())[:8]
            await websocket_endpoint(websocket, client_id)
        except Exception as e:
            logger.error(f"WebSocket error for {client_id}: {str(e)}")
            raise

    @application.get("/ws/stats", tags=["WebSocket"])
    async def websocket_stats():
        return manager.get_connection_stats()

    # Outermost CORS Middleware wrapper
    application.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    return application


app = create_application()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level="info",
    )