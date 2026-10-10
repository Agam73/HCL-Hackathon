from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

FileType = Literal["pdf", "md", "txt", "csv", "json"]
IngestionStatus = Literal["pending", "processing", "completed", "failed"]
PublicationStatus = Literal["draft", "approved", "superseded", "expired"]


class DocumentMetadata(BaseModel):
    id: UUID
    title: str
    original_filename: str
    file_type: str
    version: str
    effective_date: date
    expiration_date: date | None
    region: str
    category: str
    document_type: str
    membership_tier: str | None
    publication_status: str
    ingestion_status: str
    content_checksum: str
    created_by: str | None
    created_at: datetime
    updated_at: datetime
    chunk_count: int = 0


class DocumentUploadResponse(BaseModel):
    document_id: UUID
    ingestion_status: str
    chunk_count: int
    duplicate: bool = False


class DocumentListResponse(BaseModel):
    items: list[DocumentMetadata]
    total: int
    limit: int
    offset: int
