from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator

FALLBACK_ANSWER = "I don't have that information."

Confidence = Literal["HIGH", "MEDIUM", "LOW"]


class KnowledgeQueryRequest(BaseModel):
    question: str = Field(min_length=3, max_length=2000)
    region: str = Field(min_length=1, max_length=32)
    category: str | None = Field(default=None, max_length=64)
    membershipTier: str | None = Field(default=None, max_length=32)
    asOfDate: date | None = None

    @field_validator("question")
    @classmethod
    def question_not_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 3:
            raise ValueError("question must contain at least 3 characters")
        return cleaned


class SourceCitation(BaseModel):
    document: str
    section: str
    version: str


class KnowledgeQueryResponse(BaseModel):
    answer: str
    confidence: Confidence
    sources: list[SourceCitation]
    followUpRequired: bool


class RetrievedChunk(BaseModel):
    document_id: str
    document: str
    section: str
    version: str
    page_number: int | None = None
    source_locator: str | None = None
    relevance_score: float
    content: str


class RetrieveResponse(BaseModel):
    chunks: list[RetrievedChunk]
    as_of_date: date
    below_threshold_count: int
