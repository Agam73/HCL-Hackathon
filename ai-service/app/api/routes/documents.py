from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, Request, UploadFile, status
from psycopg.errors import Error as PsycopgError

from app.api.db_guard import require_pool
from app.core.security import INTERNAL_ACTOR_HEADER, require_service_auth
from app.repositories.document_repository import DocumentRecord, DocumentRepository
from app.schemas.documents import DocumentListResponse, DocumentMetadata, DocumentUploadResponse
from app.services.embedding_service import EmbeddingService
from app.services.ingestion_service import IngestionError, IngestionMetadata, IngestionService
from app.utils.file_validation import FileValidationError, http_from_validation, validate_upload

router = APIRouter(
    prefix="/api/v1/admin/documents",
    tags=["documents"],
    dependencies=[Depends(require_service_auth)],
)


def _to_schema(record: DocumentRecord) -> DocumentMetadata:
    return DocumentMetadata(
        id=record.id,
        title=record.title,
        original_filename=record.original_filename,
        file_type=record.file_type,
        version=record.version,
        effective_date=record.effective_date,
        expiration_date=record.expiration_date,
        region=record.region,
        category=record.category,
        document_type=record.document_type,
        membership_tier=record.membership_tier,
        publication_status=record.publication_status,
        ingestion_status=record.ingestion_status,
        content_checksum=record.content_checksum,
        created_by=record.created_by,
        created_at=record.created_at,
        updated_at=record.updated_at,
        chunk_count=record.chunk_count,
    )


async def _read_limited(upload: UploadFile, max_bytes: int) -> bytes:
    chunks: list[bytes] = []
    size = 0
    while True:
        piece = await upload.read(64 * 1024)
        if not piece:
            break
        size += len(piece)
        if size > max_bytes:
            raise FileValidationError(
                f"File exceeds the maximum size of {max_bytes} bytes.",
                code="FILE_TOO_LARGE",
            )
        chunks.append(piece)
    return b"".join(chunks)


@router.post("", response_model=DocumentUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    request: Request,
    file: Annotated[UploadFile, File()],
    title: Annotated[str, Form(min_length=1, max_length=300)],
    version: Annotated[str, Form(min_length=1, max_length=64)],
    effective_date: Annotated[date, Form()],
    region: Annotated[str, Form(min_length=1, max_length=32)],
    category: Annotated[str, Form(min_length=1, max_length=64)],
    document_type: Annotated[str, Form(min_length=1, max_length=64)],
    expiration_date: Annotated[date | None, Form()] = None,
    membership_tier: Annotated[str | None, Form()] = None,
    publication_status: Annotated[str, Form()] = "approved",
    x_internal_actor: Annotated[str | None, Header(alias=INTERNAL_ACTOR_HEADER)] = None,
) -> DocumentUploadResponse:
    if publication_status not in {"draft", "approved", "superseded", "expired"}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "VALIDATION_ERROR", "message": "Invalid publication_status."},
        )
    settings = request.app.state.settings
    try:
        raw = await _read_limited(file, settings.max_upload_bytes)
        validated = validate_upload(file.filename, raw, settings.max_upload_bytes)
    except FileValidationError as exc:
        raise http_from_validation(exc) from exc

    pool = require_pool(request)
    gateway = request.app.state.gateway
    metadata = IngestionMetadata(
        title=title,
        version=version,
        effective_date=effective_date,
        expiration_date=expiration_date,
        region=region,
        category=category,
        document_type=document_type,
        membership_tier=membership_tier or None,
        publication_status=publication_status,
        created_by=x_internal_actor,
    )
    try:
        with pool.connection() as conn:
            service = IngestionService(
                conn,
                EmbeddingService(gateway, settings.embedding_dimensions),
                settings,
            )
            result = service.ingest(validated, metadata)
    except IngestionError as exc:
        code = 400
        if exc.code in {"MODEL_UNAVAILABLE", "DB_UNAVAILABLE"}:
            code = 503
        raise HTTPException(status_code=code, detail={"code": exc.code, "message": exc.message}) from exc
    except PsycopgError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "DB_UNAVAILABLE", "message": "Database is unavailable."},
        ) from exc

    status_code = status.HTTP_200_OK if result.duplicate else status.HTTP_201_CREATED
    response = DocumentUploadResponse(
        document_id=result.document.id,
        ingestion_status=result.document.ingestion_status,
        chunk_count=result.chunk_count,
        duplicate=result.duplicate,
    )
    # FastAPI uses the decorator status; duplicates still return 201 unless we override.
    if result.duplicate:
        from fastapi.responses import JSONResponse

        return JSONResponse(status_code=status_code, content=response.model_dump(mode="json"))  # type: ignore[return-value]
    return response


@router.get("", response_model=DocumentListResponse)
def list_documents(
    request: Request,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    document_type: str | None = None,
    ingestion_status: str | None = None,
    region: str | None = None,
) -> DocumentListResponse:
    pool = require_pool(request)
    try:
        with pool.connection() as conn:
            repo = DocumentRepository(conn)
            items, total = repo.list(
                limit=limit,
                offset=offset,
                document_type=document_type,
                ingestion_status=ingestion_status,
                region=region,
            )
    except PsycopgError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "DB_UNAVAILABLE", "message": "Database is unavailable."},
        ) from exc
    return DocumentListResponse(
        items=[_to_schema(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{document_id}", response_model=DocumentMetadata)
def get_document(request: Request, document_id: UUID) -> DocumentMetadata:
    pool = require_pool(request)
    try:
        with pool.connection() as conn:
            record = DocumentRepository(conn).get(document_id)
    except PsycopgError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "DB_UNAVAILABLE", "message": "Database is unavailable."},
        ) from exc
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Document not found."},
        )
    return _to_schema(record)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(request: Request, document_id: UUID) -> None:
    pool = require_pool(request)
    settings = request.app.state.settings
    gateway = request.app.state.gateway
    try:
        with pool.connection() as conn:
            service = IngestionService(
                conn,
                EmbeddingService(gateway, settings.embedding_dimensions),
                settings,
            )
            deleted = service.delete(document_id)
            if not deleted:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={"code": "NOT_FOUND", "message": "Document not found."},
                )
    except HTTPException:
        raise
    except PsycopgError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "DB_UNAVAILABLE", "message": "Database is unavailable."},
        ) from exc
