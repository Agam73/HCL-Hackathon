import inspect

from fastapi.testclient import TestClient

from app.repositories.chunk_repository import ChunkRepository
from app.repositories.document_repository import DocumentRepository
from app.services.model_gateway import ModelGatewayError, OpenAICompatibleGateway
from app.core.config import Settings
from tests.conftest import TEST_KEY


def test_unauthorized_upload_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/v1/admin/documents",
        files={"file": ("policy.md", b"# Hi\n\ntext", "text/markdown")},
        data={
            "title": "Policy",
            "version": "1",
            "effective_date": "2026-01-01",
            "region": "IN",
            "category": "Electronics",
            "document_type": "return_policy",
        },
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_unauthorized_delete_rejected(client: TestClient) -> None:
    response = client.delete("/api/v1/admin/documents/00000000-0000-0000-0000-000000000001")
    assert response.status_code == 401


def test_oversized_upload_rejected(client: TestClient, auth_header, monkeypatch) -> None:
    client.app.state.settings.max_upload_bytes = 32
    response = client.post(
        "/api/v1/admin/documents",
        headers=auth_header,
        files={"file": ("policy.md", b"# Title\n\n" + b"x" * 200, "text/markdown")},
        data={
            "title": "Policy",
            "version": "1",
            "effective_date": "2026-01-01",
            "region": "IN",
            "category": "Electronics",
            "document_type": "return_policy",
        },
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "FILE_TOO_LARGE"


def test_database_failure_is_controlled(client: TestClient, auth_header) -> None:
    response = client.get("/api/v1/admin/documents", headers=auth_header)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "DB_UNAVAILABLE"


def test_query_without_db_is_controlled(client: TestClient, auth_header) -> None:
    response = client.post(
        "/api/v1/knowledge/query",
        headers=auth_header,
        json={"question": "Can I return a phone?", "region": "IN"},
    )
    assert response.status_code == 503


def test_sql_search_uses_parameters() -> None:
    source = inspect.getsource(ChunkRepository.search)
    assert "%s" in source
    assert "f\"" not in source
    assert ".format(" not in source


def test_list_filters_are_placeholders() -> None:
    source = inspect.getsource(DocumentRepository.list)
    assert "d.document_type = %s" in source
    assert "d.region = %s" in source


def test_model_timeout_does_not_crash() -> None:
    import httpx

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.TimeoutException("slow")

    settings = Settings(
        chat_model_provider="openai",
        embedding_model_provider="openai",
        model_api_key="sk-test",
        model_max_retries=0,
        model_timeout_seconds=0.1,
        embedding_dimensions=32,
    )
    gateway = OpenAICompatibleGateway(settings)
    gateway._client = httpx.Client(transport=httpx.MockTransport(handler), base_url="https://example.test/v1")
    try:
        gateway.complete_json("sys", "user")
        raised = False
    except ModelGatewayError as exc:
        raised = True
        assert "timed out" in str(exc).lower() or "unavailable" in str(exc).lower() or "failed" in str(exc).lower()
    assert raised is True


def test_health_without_database(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 503
    body = response.json()
    assert body["checks"]["service"] == "ok"
    assert body["checks"]["database"] == "unavailable"
