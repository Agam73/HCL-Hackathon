"""Apply SQL migrations. Embedding dimension is injected from settings.

The VECTOR column width must match EMBEDDING_DIMENSIONS. Changing the
embedding model later requires a new migration and re-embedding — this
script will not silently alter an existing column.
"""

from __future__ import annotations

import logging
from pathlib import Path

import psycopg

from app.core.config import get_settings

logger = logging.getLogger(__name__)

MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"


def split_sql(script: str) -> list[str]:
    """Split SQL on semicolons, ignoring semicolons inside $$ dollar quotes."""
    parts: list[str] = []
    buf: list[str] = []
    in_dollar = False
    i = 0
    while i < len(script):
        if script.startswith("$$", i):
            in_dollar = not in_dollar
            buf.append("$$")
            i += 2
            continue
        if script[i] == ";" and not in_dollar:
            stmt = "".join(buf).strip()
            if stmt:
                parts.append(stmt)
            buf = []
            i += 1
            continue
        buf.append(script[i])
        i += 1
    tail = "".join(buf).strip()
    if tail:
        parts.append(tail)
    return parts


def apply_migrations(database_url: str | None = None, embedding_dimensions: int | None = None) -> None:
    settings = get_settings()
    url = database_url or settings.database_url
    dimensions = embedding_dimensions or settings.embedding_dimensions

    files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not files:
        raise RuntimeError(f"No SQL migrations found in {MIGRATIONS_DIR}")

    with psycopg.connect(
        url,
        autocommit=True,
        connect_timeout=settings.database_connect_timeout,
        prepare_threshold=None,
        sslmode=settings.database_sslmode,
    ) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS ai_schema_migrations (
                filename TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
        for path in files:
            already = conn.execute(
                "SELECT 1 FROM ai_schema_migrations WHERE filename = %s",
                (path.name,),
            ).fetchone()
            if already:
                logger.info("Skipping already applied migration %s", path.name)
                continue
            sql = path.read_text(encoding="utf-8").replace(
                "__EMBEDDING_DIMENSIONS__", str(dimensions)
            )
            logger.info("Applying migration %s (embedding dim=%s)", path.name, dimensions)
            for statement in split_sql(sql):
                conn.execute(statement)
            conn.execute(
                "INSERT INTO ai_schema_migrations (filename) VALUES (%s) ON CONFLICT DO NOTHING",
                (path.name,),
            )


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    apply_migrations()
    print("Migrations applied.")


if __name__ == "__main__":
    main()
