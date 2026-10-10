"""Requires a running PostgreSQL 16 instance with pgvector.

These tests are skipped automatically when DATABASE_URL is unreachable.
"""

from __future__ import annotations

from datetime import date

import pytest

from app.core.config import get_settings, reset_settings_cache

pytestmark = pytest.mark.integration


def _db_available() -> bool:
    try:
        import psycopg

        reset_settings_cache()
        url = get_settings().database_url
        with psycopg.connect(url, connect_timeout=2) as conn:
            conn.execute("SELECT 1")
        return True
    except Exception:
        return False


require_db = pytest.mark.skipif(not _db_available(), reason="PostgreSQL/pgvector is not running")


@require_db
def test_ingest_and_query_markdown(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("CHAT_MODEL_PROVIDER", "mock")
    monkeypatch.setenv("EMBEDDING_MODEL_PROVIDER", "mock")
    monkeypatch.setenv("AI_SERVICE_API_KEY", "test-ai-service-key")
    reset_settings_cache()

    from fastapi.testclient import TestClient

    from app.db.migrate import apply_migrations
    from app.main import create_app

    apply_migrations()
    app = create_app(connect_db=True)
    sample = (
        tmp_path / "policy.md"
    )
    sample.write_text(
        "# Online Return Policy\n\n## Opened Electronics\nOpened mobile phones purchased online may be returned within 7 days.\n",
        encoding="utf-8",
    )
    with TestClient(app) as client:
        headers = {"Authorization": "Bearer test-ai-service-key"}
        upload = client.post(
            "/api/v1/admin/documents",
            headers=headers,
            files={"file": ("policy.md", sample.read_bytes(), "text/markdown")},
            data={
                "title": "Online Return Policy",
                "version": "2026.2",
                "effective_date": "2026-01-01",
                "region": "IN",
                "category": "Electronics",
                "document_type": "return_policy",
                "membership_tier": "ALL",
            },
        )
        assert upload.status_code in (200, 201), upload.text
        body = upload.json()
        assert body["ingestion_status"] == "completed"
        assert body["chunk_count"] >= 1

        retrieved = client.post(
            "/api/v1/knowledge/retrieve",
            headers=headers,
            json={
                "question": "Can I return an opened mobile phone purchased online?",
                "region": "IN",
                "category": "Electronics",
                "membershipTier": "GOLD",
            },
        )
        assert retrieved.status_code == 200, retrieved.text
        chunks = retrieved.json()["chunks"]
        assert chunks, "expected the return policy chunk to be retrieved"
        assert chunks[0]["document"] == "Online Return Policy"

        other_region = client.post(
            "/api/v1/knowledge/retrieve",
            headers=headers,
            json={"question": "opened mobile phone return", "region": "US"},
        )
        assert other_region.status_code == 200
        assert other_region.json()["chunks"] == []

        expired = client.post(
            "/api/v1/knowledge/retrieve",
            headers=headers,
            json={
                "question": "opened mobile phone return",
                "region": "IN",
                "asOfDate": "2020-01-01",
            },
        )
        assert expired.json()["chunks"] == []

        queried = client.post(
            "/api/v1/knowledge/query",
            headers=headers,
            json={
                "question": "Can I return an opened mobile phone purchased online?",
                "region": "IN",
                "category": "Electronics",
                "membershipTier": "GOLD",
            },
        )
        assert queried.status_code == 200, queried.text
        payload = queried.json()
        assert "answer" in payload
        if payload["answer"] == "I don't have that information.":
            assert payload["followUpRequired"] is True
        else:
            assert payload["sources"]
            assert payload["sources"][0]["document"] == "Online Return Policy"
            assert payload["sources"][0]["version"] == "2026.2"
