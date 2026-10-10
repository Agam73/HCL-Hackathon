from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone

from app.core.config import Settings
from app.repositories.chunk_repository import ChunkRepository, RetrievedChunkRow
from app.services.embedding_service import EmbeddingService
from app.services.model_gateway import ModelGatewayError


class RetrievalError(Exception):
    def __init__(self, message: str, code: str = "RETRIEVAL_FAILED") -> None:
        super().__init__(message)
        self.message = message
        self.code = code


@dataclass
class RetrievalResult:
    chunks: list[RetrievedChunkRow]
    as_of: date
    below_threshold_count: int
    conflict: bool


class RetrievalService:
    def __init__(
        self,
        chunks: ChunkRepository,
        embedding_service: EmbeddingService,
        settings: Settings,
    ) -> None:
        self._chunks = chunks
        self._embedding_service = embedding_service
        self._settings = settings

    def retrieve(
        self,
        question: str,
        *,
        region: str,
        category: str | None,
        membership_tier: str | None,
        as_of: date | None,
        top_k: int | None = None,
    ) -> RetrievalResult:
        query_date = as_of or datetime.now(timezone.utc).date()
        try:
            [query_vector] = self._embedding_service.embed_texts([question])
        except ModelGatewayError as exc:
            raise RetrievalError("Embedding provider failed.", code="MODEL_UNAVAILABLE") from exc
        except Exception as exc:
            raise RetrievalError("Embedding provider failed.", code="MODEL_UNAVAILABLE") from exc

        k = top_k or self._settings.retrieval_top_k
        try:
            ranked = self._chunks.search(
                query_vector,
                region=region,
                as_of=query_date,
                category=category,
                membership_tier=membership_tier,
                top_k=k,
            )
        except Exception as exc:
            raise RetrievalError("Database error during retrieval.", code="DB_UNAVAILABLE") from exc

        kept: list[RetrievedChunkRow] = []
        rejected = 0
        for row in ranked:
            if row.relevance_score >= self._settings.retrieval_min_score:
                kept.append(row)
            else:
                rejected += 1
        return RetrievalResult(
            chunks=kept,
            as_of=query_date,
            below_threshold_count=rejected,
            conflict=_has_version_conflict(kept),
        )


def _has_version_conflict(chunks: list[RetrievedChunkRow]) -> bool:
    """Same document type with different versions, both scoring closely, is unsafe to merge."""
    if len(chunks) < 2:
        return False
    top = chunks[0].relevance_score
    close = [c for c in chunks if top - c.relevance_score <= 0.05]
    by_type: dict[str, set[str]] = {}
    for chunk in close:
        by_type.setdefault(chunk.document_type, set()).add(chunk.version)
    return any(len(versions) > 1 for versions in by_type.values())
