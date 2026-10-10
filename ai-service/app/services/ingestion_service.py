from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass
from datetime import date
from uuid import UUID

from psycopg import Connection
from psycopg.errors import Error as PsycopgError

from app.core.config import Settings
from app.repositories.chunk_repository import ChunkRepository
from app.repositories.document_repository import (
    DocumentRecord,
    DocumentRepository,
    DuplicateDocumentError,
)
from app.services.chunking_service import chunk_document
from app.services.embedding_service import EmbeddingService
from app.services.model_gateway import ModelGatewayError
from app.services.parsing_service import ParseError, parse_document
from app.utils.file_validation import ValidatedFile

logger = logging.getLogger(__name__)


class IngestionError(Exception):
    def __init__(self, message: str, code: str = "INGESTION_FAILED") -> None:
        super().__init__(message)
        self.message = message
        self.code = code


@dataclass
class IngestionResult:
    document: DocumentRecord
    chunk_count: int
    duplicate: bool


@dataclass
class IngestionMetadata:
    title: str
    version: str
    effective_date: date
    expiration_date: date | None
    region: str
    category: str
    document_type: str
    membership_tier: str | None
    publication_status: str
    created_by: str | None


class IngestionService:
    def __init__(
        self,
        conn: Connection,
        embedding_service: EmbeddingService,
        settings: Settings,
    ) -> None:
        self._conn = conn
        self._documents = DocumentRepository(conn)
        self._chunks = ChunkRepository(conn)
        self._embedding_service = embedding_service
        self._settings = settings

    def ingest(self, validated: ValidatedFile, metadata: IngestionMetadata) -> IngestionResult:
        checksum = hashlib.sha256(validated.content).hexdigest()
        existing = self._documents.find_duplicate(
            checksum,
            metadata.region,
            metadata.category,
            metadata.document_type,
            metadata.version,
        )
        if existing and existing.ingestion_status == "completed":
            logger.info("Duplicate upload ignored for document %s", existing.id)
            return IngestionResult(document=existing, chunk_count=existing.chunk_count, duplicate=True)

        try:
            parsed = parse_document(validated.file_type, validated.content)
        except ParseError as exc:
            raise IngestionError(exc.message, code=exc.code) from exc

        drafts = chunk_document(
            parsed,
            chunk_size_chars=self._settings.chunk_size_chars,
            overlap_chars=self._settings.chunk_overlap_chars,
        )
        try:
            embeddings = self._embedding_service.embed_texts([draft.content for draft in drafts])
        except ModelGatewayError as exc:
            raise IngestionError("Embedding provider failed.", code="MODEL_UNAVAILABLE") from exc

        title = metadata.title or parsed.title_hint or validated.filename
        try:
            document = self._documents.insert_processing(
                {
                    "title": title,
                    "original_filename": validated.filename,
                    "file_type": validated.file_type,
                    "version": metadata.version,
                    "effective_date": metadata.effective_date,
                    "expiration_date": metadata.expiration_date,
                    "region": metadata.region,
                    "category": metadata.category,
                    "document_type": metadata.document_type,
                    "membership_tier": metadata.membership_tier,
                    "publication_status": metadata.publication_status,
                    "content_checksum": checksum,
                    "created_by": metadata.created_by,
                }
            )
            chunk_count = self._chunks.insert_chunks(document.id, drafts, embeddings)
            self._documents.mark_completed(document.id)
            self._conn.commit()
        except DuplicateDocumentError:
            self._conn.rollback()
            again = self._documents.find_duplicate(
                checksum,
                metadata.region,
                metadata.category,
                metadata.document_type,
                metadata.version,
            )
            if again:
                return IngestionResult(document=again, chunk_count=again.chunk_count, duplicate=True)
            raise IngestionError("Duplicate document could not be resolved.")
        except Exception as exc:
            self._conn.rollback()
            logger.exception("Ingestion rolled back")
            if isinstance(exc, PsycopgError):
                raise IngestionError("Database error while saving the document.", code="DB_UNAVAILABLE") from exc
            raise

        stored = self._documents.get(document.id)
        assert stored is not None
        logger.info("Ingested document %s with %s chunks", stored.id, chunk_count)
        return IngestionResult(document=stored, chunk_count=chunk_count, duplicate=False)

    def delete(self, document_id: UUID) -> bool:
        deleted = self._documents.delete(document_id)
        if deleted:
            self._conn.commit()
        return deleted
