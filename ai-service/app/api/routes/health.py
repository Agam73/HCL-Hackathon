from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from psycopg.errors import Error as PsycopgError

from app.core.config import get_settings

router = APIRouter(tags=["health"])


@router.get("/health")
def health(request: Request) -> JSONResponse:
    checks = {"service": "ok", "database": "unknown", "models": "unknown"}
    settings = getattr(request.app.state, "settings", None) or get_settings()
    pool = getattr(request.app.state, "pool", None)
    if pool is None:
        checks["database"] = "unavailable"
    else:
        try:
            with pool.connection() as conn:
                conn.execute("SELECT 1")
            checks["database"] = "ok"
        except PsycopgError:
            checks["database"] = "error"

    provider = f"{settings.chat_model_provider}/{settings.embedding_model_provider}"
    if settings.chat_model_provider in {"openai", "gemini"} and not settings.model_api_key:
        checks["models"] = "not_configured"
    else:
        checks["models"] = f"ok:{provider}"

    degraded = checks["database"] != "ok" or checks["models"].startswith("not_")
    status_code = 200 if not degraded else 503
    body = {
        "status": "degraded" if degraded else "ok",
        "checks": checks,
    }
    return JSONResponse(status_code=status_code, content=body)
