from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any
from uuid import UUID

from psycopg import Connection

from app.services.chunking_service import ChunkDraft


@dataclass
class RetrievedChunkRow:
    chunk_id: UUID
    document_id: UUID
    chunk_index: int
    content: str
    section: str | None
    page_number: int | None
    source_locator: str | None
    title: str
    version: str
    region: str
    category: str
    document_type: str
    membership_tier: str | None
    relevance_score: float


class ChunkRepository:
    def __init__(self, conn: Connection) -> None:
        self._conn = conn

    def insert_chunks(
        self,
        document_id: UUID,
        drafts: list[ChunkDraft],
        embeddings: list[list[float]],
    ) -> int:
        rows = [
            (
                document_id,
                draft.chunk_index,
                draft.content,
                embedding,
                draft.section,
                draft.page_number,
                draft.source_locator,
            )
            for draft, embedding in zip(drafts, embeddings, strict=True)
        ]
        with self._conn.cursor() as cursor:
            cursor.executemany(
                """
                INSERT INTO document_chunks (
                    document_id, chunk_index, content, embedding, section, page_number, source_locator
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                rows,
            )
        return len(rows)

    def search(
        self,
        query_embedding: list[float],
        *,
        region: str,
        as_of: date,
        category: str | None,
        membership_tier: str | None,
        top_k: int,
    ) -> list[RetrievedChunkRow]:
        # Cosine distance: <=> . Similarity reported as 1 - distance.
        # Filters are parameterized so caller input cannot change the SQL shape.
        rows = self._conn.execute(
            """
            SELECT
                c.id AS chunk_id,
                c.document_id,
                c.chunk_index,
                c.content,
                c.section,
                c.page_number,
                c.source_locator,
                d.title,
                d.version,
                d.region,
                d.category,
                d.document_type,
                d.membership_tier,
                1 - (c.embedding <=> %s::vector) AS relevance_score
            FROM document_chunks c
            INNER JOIN documents d ON d.id = c.document_id
            WHERE d.ingestion_status = 'completed'
              AND d.publication_status = 'approved'
              AND d.superseded_by IS NULL
              AND d.region = %s
              AND d.effective_date <= %s
              AND (d.expiration_date IS NULL OR d.expiration_date >= %s)
              AND (%s::text IS NULL OR d.category = %s OR d.category = 'ALL')
              AND (
                    d.membership_tier IS NULL
                    OR d.membership_tier = 'ALL'
                    OR (%s::text IS NOT NULL AND d.membership_tier = %s)
                  )
            ORDER BY c.embedding <=> %s::vector
            LIMIT %s
            """,
            (
                query_embedding,
                region,
                as_of,
                as_of,
                category,
                category,
                membership_tier,
                membership_tier,
                query_embedding,
                top_k,
            ),
        ).fetchall()
        return [_row_to_chunk(row) for row in rows]


def _row_to_chunk(row: dict[str, Any]) -> RetrievedChunkRow:
    return RetrievedChunkRow(
        chunk_id=row["chunk_id"],
        document_id=row["document_id"],
        chunk_index=row["chunk_index"],
        content=row["content"],
        section=row["section"],
        page_number=row["page_number"],
        source_locator=row["source_locator"],
        title=row["title"],
        version=row["version"],
        region=row["region"],
        category=row["category"],
        document_type=row["document_type"],
        membership_tier=row["membership_tier"],
        relevance_score=float(row["relevance_score"]),
    )
