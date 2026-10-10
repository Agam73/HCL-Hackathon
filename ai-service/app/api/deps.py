from fastapi import Request
from psycopg_pool import ConnectionPool

from app.core.config import Settings
from app.services.model_gateway import ModelGateway


def get_settings_dep(request: Request) -> Settings:
    return request.app.state.settings


def get_pool(request: Request) -> ConnectionPool:
    pool = getattr(request.app.state, "pool", None)
    if pool is None:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "DB_UNAVAILABLE", "message": "Database pool is not available."},
        )
    return pool


def get_gateway(request: Request) -> ModelGateway:
    return request.app.state.gateway
