from fastapi import APIRouter, Depends, HTTPException, Request, status
from psycopg.errors import Error as PsycopgError

from app.api.db_guard import require_pool
from app.core.security import require_service_auth
from app.repositories.chunk_repository import ChunkRepository
from app.schemas.knowledge import (
    KnowledgeQueryRequest,
    KnowledgeQueryResponse,
    RetrieveResponse,
    RetrievedChunk,
)
from app.services.answer_service import AnswerService, fallback_response
from app.services.embedding_service import EmbeddingService
from app.services.retrieval_service import RetrievalError, RetrievalService

router = APIRouter(
    prefix="/api/v1/knowledge",
    tags=["knowledge"],
    dependencies=[Depends(require_service_auth)],
)


def _retrieval_service(request: Request, conn) -> RetrievalService:
    settings = request.app.state.settings
    gateway = request.app.state.gateway
    return RetrievalService(
        ChunkRepository(conn),
        EmbeddingService(gateway, settings.embedding_dimensions),
        settings,
    )


@router.post("/query", response_model=KnowledgeQueryResponse)
def query_knowledge(request: Request, body: KnowledgeQueryRequest) -> KnowledgeQueryResponse:
    settings = request.app.state.settings
    pool = require_pool(request)
    try:
        with pool.connection() as conn:
            retrieval = _retrieval_service(request, conn).retrieve(
                body.question,
                region=body.region,
                category=body.category,
                membership_tier=body.membershipTier,
                as_of=body.asOfDate,
            )
            return AnswerService(request.app.state.gateway, settings).generate(body.question, retrieval)
    except RetrievalError as exc:
        code = 503 if exc.code in {"MODEL_UNAVAILABLE", "DB_UNAVAILABLE"} else 400
        raise HTTPException(status_code=code, detail={"code": exc.code, "message": exc.message}) from exc
    except PsycopgError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "DB_UNAVAILABLE", "message": "Database is unavailable."},
        ) from exc
    except Exception:
        return fallback_response()


@router.post("/retrieve", response_model=RetrieveResponse)
def retrieve_evidence(request: Request, body: KnowledgeQueryRequest) -> RetrieveResponse:
    if not request.app.state.settings.enable_retrieve_debug:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Not found."},
        )
    pool = require_pool(request)
    try:
        with pool.connection() as conn:
            retrieval = _retrieval_service(request, conn).retrieve(
                body.question,
                region=body.region,
                category=body.category,
                membership_tier=body.membershipTier,
                as_of=body.asOfDate,
            )
    except RetrievalError as exc:
        code = 503 if exc.code in {"MODEL_UNAVAILABLE", "DB_UNAVAILABLE"} else 400
        raise HTTPException(status_code=code, detail={"code": exc.code, "message": exc.message}) from exc
    except PsycopgError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "DB_UNAVAILABLE", "message": "Database is unavailable."},
        ) from exc
    return RetrieveResponse(
        as_of_date=retrieval.as_of,
        below_threshold_count=retrieval.below_threshold_count,
        chunks=[
            RetrievedChunk(
                document_id=str(row.document_id),
                document=row.title,
                section=row.section or "n/a",
                version=row.version,
                page_number=row.page_number,
                source_locator=row.source_locator,
                relevance_score=row.relevance_score,
                content=row.content,
            )
            for row in retrieval.chunks
        ],
    )
