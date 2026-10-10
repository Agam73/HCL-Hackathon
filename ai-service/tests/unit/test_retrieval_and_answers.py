from datetime import date
from uuid import uuid4

from app.core.config import Settings
from app.repositories.chunk_repository import RetrievedChunkRow
from app.schemas.knowledge import FALLBACK_ANSWER, SourceCitation
from app.services.answer_service import AnswerService, fallback_response
from app.services.embedding_service import EmbeddingService
from app.services.model_gateway import MockModelGateway
from app.services.retrieval_service import RetrievalResult, RetrievalService, _has_version_conflict


def _chunk(**overrides) -> RetrievedChunkRow:
    base = dict(
        chunk_id=uuid4(),
        document_id=uuid4(),
        chunk_index=0,
        content="Opened mobile phones may be returned within 7 days.",
        section="Opened Electronics",
        page_number=1,
        source_locator="page 1",
        title="Online Return Policy",
        version="2026.2",
        region="IN",
        category="Electronics",
        document_type="return_policy",
        membership_tier=None,
        relevance_score=0.7,
    )
    base.update(overrides)
    return RetrievedChunkRow(**base)


class FakeChunkRepo:
    def __init__(self, rows: list[RetrievedChunkRow]) -> None:
        self.rows = rows
        self.last_kwargs = None

    def search(self, query_embedding, **kwargs):
        self.last_kwargs = {"embedding_len": len(query_embedding), **kwargs}
        return self.rows


def test_relevant_kept_irrelevant_rejected() -> None:
    settings = Settings(embedding_dimensions=32, retrieval_min_score=0.4)
    gateway = MockModelGateway(settings)
    weak = _chunk(title="Shipping", content="Parcels ship in 2 days.", relevance_score=0.1)
    strong = _chunk(relevance_score=0.8)
    repo = FakeChunkRepo([strong, weak])
    service = RetrievalService(repo, EmbeddingService(gateway, 32), settings)
    result = service.retrieve("opened phone return", region="IN", category="Electronics", membership_tier="GOLD", as_of=date(2026, 10, 10))
    assert [c.title for c in result.chunks] == ["Online Return Policy"]
    assert result.below_threshold_count == 1
    assert repo.last_kwargs["region"] == "IN"
    assert repo.last_kwargs["category"] == "Electronics"
    assert repo.last_kwargs["membership_tier"] == "GOLD"
    assert repo.last_kwargs["as_of"] == date(2026, 10, 10)


def test_effective_date_passed_through() -> None:
    settings = Settings(embedding_dimensions=32)
    repo = FakeChunkRepo([])
    RetrievalService(repo, EmbeddingService(MockModelGateway(settings), 32), settings).retrieve(
        "current policy",
        region="IN",
        category=None,
        membership_tier=None,
        as_of=date(2025, 1, 1),
    )
    assert repo.last_kwargs["as_of"] == date(2025, 1, 1)


def test_conflict_on_close_scores_different_versions() -> None:
    a = _chunk(version="2026.1", relevance_score=0.71)
    b = _chunk(version="2026.2", relevance_score=0.70, chunk_id=uuid4())
    assert _has_version_conflict([a, b]) is True


def test_no_evidence_fallback() -> None:
    settings = Settings(embedding_dimensions=32)
    service = AnswerService(MockModelGateway(settings), settings)
    response = service.generate("anything", RetrievalResult([], date.today(), 0, False))
    assert response.answer == FALLBACK_ANSWER
    assert response.confidence == "LOW"
    assert response.sources == []
    assert response.followUpRequired is True


def test_conflicting_evidence_fallback() -> None:
    settings = Settings(embedding_dimensions=32)
    service = AnswerService(MockModelGateway(settings), settings)
    retrieval = RetrievalResult([_chunk(), _chunk(version="2025.1")], date.today(), 0, True)
    response = service.generate("return window", retrieval)
    assert response.answer == FALLBACK_ANSWER


def test_grounded_response_uses_retrieved_sources() -> None:
    settings = Settings(embedding_dimensions=32, confidence_high_score=0.4)

    def chat(_system: str, user: str) -> str:
        assert "Opened Electronics" in user
        return """{
          "answer": "According to the applicable return policy, opened phones may be returned within 7 days.",
          "confidence": "HIGH",
          "sources": [{"document": "Online Return Policy", "section": "Opened Electronics", "version": "2026.2"}],
          "followUpRequired": false
        }"""

    service = AnswerService(MockModelGateway(settings, chat_handler=chat), settings)
    response = service.generate("opened phone?", RetrievalResult([_chunk()], date.today(), 0, False))
    assert "7 days" in response.answer
    assert response.sources == [
        SourceCitation(document="Online Return Policy", section="Opened Electronics", version="2026.2")
    ]


def test_fabricated_sources_are_dropped() -> None:
    settings = Settings(embedding_dimensions=32)

    def chat(_s, _u) -> str:
        return """{
          "answer": "Made up warranty of 99 years.",
          "confidence": "HIGH",
          "sources": [{"document": "Secret Internal Memo", "section": "Hidden", "version": "999"}],
          "followUpRequired": false
        }"""

    service = AnswerService(MockModelGateway(settings, chat_handler=chat), settings)
    response = service.generate("warranty", RetrievalResult([_chunk()], date.today(), 0, False))
    assert response.answer == FALLBACK_ANSWER
    assert response.sources == []
    assert response.followUpRequired is True


def test_invalid_model_json_falls_back() -> None:
    settings = Settings(embedding_dimensions=32)

    def chat(_s, _u) -> str:
        return "NOT_JSON{{{{"

    service = AnswerService(MockModelGateway(settings, chat_handler=chat), settings)
    response = service.generate("q", RetrievalResult([_chunk()], date.today(), 0, False))
    assert response == fallback_response()
