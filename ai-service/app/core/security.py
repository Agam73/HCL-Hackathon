from fastapi import Depends, Header, HTTPException, status

from app.core.config import Settings, get_settings

# Express should send this after it has already authenticated the end user.
# It is audit metadata only — it is never treated as authorization.
INTERNAL_ACTOR_HEADER = "X-Internal-Actor"


def require_service_auth(
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> None:
    """Reject any caller that does not present the shared service API key.

    The AI service does not accept a client-supplied role. Express holds the
    user JWT, authorizes admin vs customer routes, then calls this service
    with AI_SERVICE_API_KEY.
    """
    expected = settings.ai_service_api_key
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "CONFIG_ERROR", "message": "AI_SERVICE_API_KEY is not configured."},
        )
    if authorization is None or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Missing service bearer token."},
        )
    token = authorization.removeprefix("Bearer ").strip()
    if token != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Invalid service bearer token."},
        )
