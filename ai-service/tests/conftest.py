from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.config import reset_settings_cache
from app.main import create_app

TEST_KEY = "test-ai-service-key"


@pytest.fixture
def env_unit(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AI_SERVICE_API_KEY", TEST_KEY)
    monkeypatch.setenv("CHAT_MODEL_PROVIDER", "mock")
    monkeypatch.setenv("EMBEDDING_MODEL_PROVIDER", "mock")
    monkeypatch.setenv("EMBEDDING_DIMENSIONS", "32")
    monkeypatch.setenv("ENABLE_RETRIEVE_DEBUG", "true")
    reset_settings_cache()
    yield
    reset_settings_cache()


@pytest.fixture
def client(env_unit) -> TestClient:
    app = create_app(connect_db=False)
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def auth_header() -> dict[str, str]:
    return {"Authorization": f"Bearer {TEST_KEY}"}


def make_pdf_bytes(text: str) -> bytes:
    from fpdf import FPDF

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", size=12)
    pdf.multi_cell(0, 8, text)
    return bytes(pdf.output())
