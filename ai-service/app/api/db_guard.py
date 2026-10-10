from fastapi import HTTPException, Request, status
from psycopg_pool import ConnectionPool


def require_pool(request: Request) -> ConnectionPool:
    pool = getattr(request.app.state, "pool", None)
    if pool is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "DB_UNAVAILABLE", "message": "Database is unavailable."},
        )
    return pool
