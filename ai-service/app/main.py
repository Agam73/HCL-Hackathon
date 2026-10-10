import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.routes import documents, health, knowledge
from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.core.logging import configure_logging
from app.db.connection import create_pool
from app.services.model_gateway import build_gateway

logger = logging.getLogger(__name__)


def _build_lifespan(connect_db: bool):
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        settings = get_settings()
        configure_logging(settings)
        app.state.settings = settings
        app.state.gateway = build_gateway(settings)
        app.state.pool = None
        if connect_db:
            try:
                pool = create_pool(settings)
                pool.wait(timeout=3.0)
                app.state.pool = pool
            except Exception:
                logger.exception("PostgreSQL is unavailable; knowledge and ingest endpoints will return 503")
                app.state.pool = None
        try:
            yield
        finally:
            pool = getattr(app.state, "pool", None)
            if pool is not None:
                pool.close()

    return lifespan


def create_app(*, connect_db: bool = True) -> FastAPI:
    app = FastAPI(
        title="RetailPulse AI Service",
        version="0.1.0",
        description="RAG microservice for NovaMart (fictional retailer).",
        lifespan=_build_lifespan(connect_db),
    )
    register_error_handlers(app)
    app.include_router(health.router)
    app.include_router(documents.router)
    app.include_router(knowledge.router)
    return app


app = create_app()
