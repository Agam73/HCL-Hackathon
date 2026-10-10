from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Any
from uuid import UUID

from psycopg import Connection
from psycopg.errors import UniqueViolation


@dataclass
class DocumentRecord:
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


def _row_to_document(row: dict[str, Any], chunk_count: int = 0) -> DocumentRecord:
    return DocumentRecord(
        id=row["id"],
        title=row["title"],
        original_filename=row["original_filename"],
        file_type=row["file_type"],
        version=row["version"],
        effective_date=row["effective_date"],
        expiration_date=row["expiration_date"],
        region=row["region"],
        category=row["category"],
        document_type=row["document_type"],
        membership_tier=row["membership_tier"],
        publication_status=row["publication_status"],
        ingestion_status=row["ingestion_status"],
        content_checksum=row["content_checksum"],
        created_by=row["created_by"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        chunk_count=chunk_count if "chunk_count" not in row else int(row.get("chunk_count") or 0),
    )


class DocumentRepository:
    def __init__(self, conn: Connection) -> None:
        self._conn = conn

    def find_duplicate(
        self,
        checksum: str,
        region: str,
        category: str,
        document_type: str,
        version: str,
    ) -> DocumentRecord | None:
        row = self._conn.execute(
            """
            SELECT d.*, (
                SELECT COUNT(*) FROM document_chunks c WHERE c.document_id = d.id
            ) AS chunk_count
            FROM documents d
            WHERE d.content_checksum = %s
              AND d.region = %s
              AND d.category = %s
              AND d.document_type = %s
              AND d.version = %s
            """,
            (checksum, region, category, document_type, version),
        ).fetchone()
        return _row_to_document(row) if row else None

    def insert_processing(self, fields: dict[str, Any]) -> DocumentRecord:
        try:
            row = self._conn.execute(
                """
                INSERT INTO documents (
                    title, original_filename, file_type, version, effective_date,
                    expiration_date, region, category, document_type, membership_tier,
                    publication_status, ingestion_status, content_checksum, created_by
                )
                VALUES (
                    %(title)s, %(original_filename)s, %(file_type)s, %(version)s,
                    %(effective_date)s, %(expiration_date)s, %(region)s, %(category)s,
                    %(document_type)s, %(membership_tier)s, %(publication_status)s,
                    'processing', %(content_checksum)s, %(created_by)s
                )
                RETURNING *
                """,
                fields,
            ).fetchone()
        except UniqueViolation as exc:
            raise DuplicateDocumentError() from exc
        assert row is not None
        return _row_to_document(row)

    def mark_completed(self, document_id: UUID) -> None:
        self._conn.execute(
            "UPDATE documents SET ingestion_status = 'completed' WHERE id = %s",
            (document_id,),
        )

    def get(self, document_id: UUID) -> DocumentRecord | None:
        row = self._conn.execute(
            """
            SELECT d.*, (
                SELECT COUNT(*) FROM document_chunks c WHERE c.document_id = d.id
            ) AS chunk_count
            FROM documents d
            WHERE d.id = %s
            """,
            (document_id,),
        ).fetchone()
        return _row_to_document(row) if row else None

    def list(
        self,
        *,
        limit: int,
        offset: int,
        document_type: str | None = None,
        ingestion_status: str | None = None,
        region: str | None = None,
    ) -> tuple[list[DocumentRecord], int]:
        filters = []
        params: list[Any] = []
        if document_type:
            filters.append("d.document_type = %s")
            params.append(document_type)
        if ingestion_status:
            filters.append("d.ingestion_status = %s")
            params.append(ingestion_status)
        if region:
            filters.append("d.region = %s")
            params.append(region)
        where = f"WHERE {' AND '.join(filters)}" if filters else ""
        total_row = self._conn.execute(
            f"SELECT COUNT(*) AS n FROM documents d {where}",
            params,
        ).fetchone()
        total = int(total_row["n"]) if total_row else 0
        rows = self._conn.execute(
            f"""
            SELECT d.*, (
                SELECT COUNT(*) FROM document_chunks c WHERE c.document_id = d.id
            ) AS chunk_count
            FROM documents d
            {where}
            ORDER BY d.created_at DESC
            LIMIT %s OFFSET %s
            """,
            [*params, limit, offset],
        ).fetchall()
        return [_row_to_document(row) for row in rows], total

    def delete(self, document_id: UUID) -> bool:
        row = self._conn.execute(
            "DELETE FROM documents WHERE id = %s RETURNING id",
            (document_id,),
        ).fetchone()
        return row is not None


class DuplicateDocumentError(Exception):
    pass
