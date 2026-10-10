"""Central model gateway.

Ingestion, retrieval and answer generation never call a vendor SDK directly.
Providers are selected with CHAT_MODEL_PROVIDER and EMBEDDING_MODEL_PROVIDER.

Choices:
- mock: deterministic lexical-hash embeddings + JSON answers. For tests and
  first boot without an API key. Not a substitute for a neural embedding model.
- openai: OpenAI Chat Completions + Embeddings, or any OpenAI-compatible
  server via MODEL_BASE_URL.
- gemini: Google Gemini generateContent and embedContent APIs.
"""

from __future__ import annotations

import hashlib
import json
import logging
import math
import re
import time
from abc import ABC, abstractmethod
from typing import Any

import httpx

from app.core.config import Settings

logger = logging.getLogger(__name__)


class ModelGatewayError(Exception):
    def __init__(self, message: str, *, retryable: bool = False) -> None:
        super().__init__(message)
        self.retryable = retryable


class ModelGateway(ABC):
    @abstractmethod
    def embed(self, texts: list[str]) -> list[list[float]]:
        raise NotImplementedError

    @abstractmethod
    def complete_json(self, system_prompt: str, user_prompt: str) -> str:
        raise NotImplementedError

    @property
    @abstractmethod
    def embedding_dimensions(self) -> int:
        raise NotImplementedError

    @property
    @abstractmethod
    def embedding_model_name(self) -> str:
        raise NotImplementedError


def _tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def lexical_hash_embedding(text: str, dimensions: int) -> list[float]:
    """Cheap, deterministic vector so mock retrieval still prefers overlapping terms."""
    vector = [0.0] * dimensions
    tokens = _tokenize(text)
    if not tokens:
        vector[0] = 1.0
        return vector
    for token in tokens:
        digest = hashlib.md5(token.encode("utf-8")).hexdigest()
        index = int(digest, 16) % dimensions
        vector[index] += 1.0
    norm = math.sqrt(sum(v * v for v in vector)) or 1.0
    return [v / norm for v in vector]


class MockModelGateway(ModelGateway):
    def __init__(self, settings: Settings, chat_handler=None) -> None:
        self._settings = settings
        self._chat_handler = chat_handler

    @property
    def embedding_dimensions(self) -> int:
        return self._settings.embedding_dimensions

    @property
    def embedding_model_name(self) -> str:
        return self._settings.embedding_model_name

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [lexical_hash_embedding(text, self.embedding_dimensions) for text in texts]

    def complete_json(self, system_prompt: str, user_prompt: str) -> str:
        if self._chat_handler is not None:
            return self._chat_handler(system_prompt, user_prompt)
        # Default mock: judges can still see the JSON contract without a paid API.
        if "NO_EVIDENCE" in user_prompt or "EVIDENCE BLOCKS:\n\n" == user_prompt[-18:]:
            return json.dumps(
                {
                    "answer": "I don't have that information.",
                    "confidence": "LOW",
                    "sources": [],
                    "followUpRequired": True,
                }
            )
        return json.dumps(
            {
                "answer": "According to the retrieved synthetic policy excerpt, see the cited section.",
                "confidence": "MEDIUM",
                "sources": [],
                "followUpRequired": False,
            }
        )


class OpenAICompatibleGateway(ModelGateway):
    def __init__(self, settings: Settings) -> None:
        if not settings.model_api_key:
            raise ModelGatewayError("MODEL_API_KEY is required when using the openai provider.")
        self._settings = settings
        self._client = httpx.Client(
            base_url=settings.model_base_url.rstrip("/"),
            timeout=settings.model_timeout_seconds,
            headers={
                "Authorization": f"Bearer {settings.model_api_key}",
                "Content-Type": "application/json",
            },
        )

    @property
    def embedding_dimensions(self) -> int:
        return self._settings.embedding_dimensions

    @property
    def embedding_model_name(self) -> str:
        return self._settings.embedding_model_name

    def _request(self, method: str, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        retries = max(0, self._settings.model_max_retries)
        last_error: Exception | None = None
        for attempt in range(retries + 1):
            try:
                response = self._client.request(method, path, json=payload)
                if response.status_code == 429 or response.status_code >= 500:
                    last_error = ModelGatewayError(
                        f"Provider returned HTTP {response.status_code}",
                        retryable=True,
                    )
                    time.sleep(min(2 ** attempt, 8))
                    continue
                if response.status_code >= 400:
                    raise ModelGatewayError(
                        f"Provider request failed with HTTP {response.status_code}."
                    )
                return response.json()
            except httpx.TimeoutException as exc:
                last_error = ModelGatewayError("Model provider timed out.", retryable=True)
                logger.warning("Model timeout on attempt %s", attempt + 1)
                time.sleep(min(2 ** attempt, 8))
                continue
            except httpx.HTTPError as exc:
                last_error = ModelGatewayError("Model provider is unavailable.", retryable=True)
                logger.warning("Model HTTP error on attempt %s: %s", attempt + 1, type(exc).__name__)
                time.sleep(min(2 ** attempt, 8))
                continue
        raise last_error or ModelGatewayError("Model provider request failed.")

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        data = self._request(
            "POST",
            "/embeddings",
            {"model": self._settings.embedding_model_name, "input": texts},
        )
        items = sorted(data.get("data", []), key=lambda row: row.get("index", 0))
        vectors = [row["embedding"] for row in items]
        expected = self.embedding_dimensions
        for vector in vectors:
            if len(vector) != expected:
                raise ModelGatewayError(
                    f"Embedding dimension mismatch: provider returned {len(vector)}, "
                    f"service is configured for {expected}. Re-embed after aligning "
                    "EMBEDDING_DIMENSIONS and the database VECTOR column."
                )
        return vectors

    def complete_json(self, system_prompt: str, user_prompt: str) -> str:
        payload: dict[str, Any] = {
            "model": self._settings.chat_model_name,
            "temperature": 0,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        try:
            data = self._request(
                "POST",
                "/chat/completions",
                {**payload, "response_format": {"type": "json_object"}},
            )
        except ModelGatewayError:
            data = self._request("POST", "/chat/completions", payload)
        choices = data.get("choices") or []
        if not choices:
            raise ModelGatewayError("Chat provider returned no choices.")
        content = choices[0].get("message", {}).get("content")
        if not content:
            raise ModelGatewayError("Chat provider returned empty content.")
        return content


class GeminiGateway(ModelGateway):
    """Google Gemini gateway using the native REST API."""

    def __init__(self, settings: Settings) -> None:
        if not settings.model_api_key:
            raise ModelGatewayError("MODEL_API_KEY is required when using the gemini provider.")
        self._settings = settings
        self._client = httpx.Client(
            base_url="https://generativelanguage.googleapis.com/v1beta",
            timeout=settings.model_timeout_seconds,
            headers={"Content-Type": "application/json"},
        )

    @property
    def embedding_dimensions(self) -> int:
        return self._settings.embedding_dimensions

    @property
    def embedding_model_name(self) -> str:
        return self._settings.embedding_model_name

    def _request(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        retries = max(0, self._settings.model_max_retries)
        last_error: Exception | None = None
        for attempt in range(retries + 1):
            try:
                response = self._client.post(
                    path,
                    params={"key": self._settings.model_api_key},
                    json=payload,
                )
                if response.status_code == 429 or response.status_code >= 500:
                    last_error = ModelGatewayError(
                        f"Gemini returned HTTP {response.status_code}.",
                        retryable=True,
                    )
                    time.sleep(min(2**attempt, 8))
                    continue
                if response.status_code >= 400:
                    raise ModelGatewayError(
                        f"Gemini request failed with HTTP {response.status_code}."
                    )
                return response.json()
            except httpx.TimeoutException as exc:
                last_error = ModelGatewayError("Gemini request timed out.", retryable=True)
                logger.warning("Gemini timeout on attempt %s", attempt + 1)
                time.sleep(min(2**attempt, 8))
            except httpx.HTTPError as exc:
                last_error = ModelGatewayError("Gemini is unavailable.", retryable=True)
                logger.warning("Gemini HTTP error on attempt %s: %s", attempt + 1, type(exc).__name__)
                time.sleep(min(2**attempt, 8))
        raise last_error or ModelGatewayError("Gemini request failed.")

    def embed(self, texts: list[str]) -> list[list[float]]:
        vectors = []
        for text in texts:
            data = self._request(
                f"/models/{self.embedding_model_name}:embedContent",
                {
                    "model": f"models/{self.embedding_model_name}",
                    "content": {"parts": [{"text": text}]},
                    "outputDimensionality": self.embedding_dimensions,
                },
            )
            vector = (data.get("embedding") or {}).get("values")
            if not isinstance(vector, list):
                raise ModelGatewayError("Gemini embedding response did not contain values.")
            if len(vector) != self.embedding_dimensions:
                raise ModelGatewayError(
                    f"Embedding dimension mismatch: Gemini returned {len(vector)}, "
                    f"service is configured for {self.embedding_dimensions}."
                )
            vectors.append(vector)
        return vectors

    def complete_json(self, system_prompt: str, user_prompt: str) -> str:
        data = self._request(
            f"/models/{self._settings.chat_model_name}:generateContent",
            {
                "systemInstruction": {"parts": [{"text": system_prompt}]},
                "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
                "generationConfig": {
                    "temperature": 0,
                    "responseMimeType": "application/json",
                },
            },
        )
        candidates = data.get("candidates") or []
        if not candidates:
            raise ModelGatewayError("Gemini returned no candidates.")
        parts = candidates[0].get("content", {}).get("parts") or []
        content = "".join(part.get("text", "") for part in parts)
        if not content:
            raise ModelGatewayError("Gemini returned empty content.")
        return content


def build_gateway(settings: Settings) -> ModelGateway:
    """Chat and embedding currently share a provider class; names stay independent.

    Mixing mock embeddings with a real chat model (or the reverse) is allowed
    but will produce poor retrieval or toy answers. Prefer the same quality
    tier for both, and never change EMBEDDING_MODEL_NAME on an existing index
    without re-ingesting documents.
    """
    embed_provider = settings.embedding_model_provider.lower()
    chat_provider = settings.chat_model_provider.lower()
    allowed = {"mock", "openai", "gemini"}
    if embed_provider not in allowed or chat_provider not in allowed:
        raise ModelGatewayError(
            f"Unsupported provider. Use one of: {sorted(allowed)}."
        )
    if embed_provider == "mock" and chat_provider == "mock":
        return MockModelGateway(settings)
    if embed_provider == "openai" and chat_provider == "openai":
        return OpenAICompatibleGateway(settings)
    if embed_provider == "gemini" and chat_provider == "gemini":
        return GeminiGateway(settings)
    # Independent providers: wrap two gateways.
    return SplitGateway(settings)


class SplitGateway(ModelGateway):
    def __init__(self, settings: Settings) -> None:
        embed_settings = settings.model_copy(
            update={
                "chat_model_provider": settings.embedding_model_provider,
            }
        )
        chat_settings = settings.model_copy(
            update={
                "embedding_model_provider": settings.chat_model_provider,
            }
        )
        self._embed = (
            MockModelGateway(embed_settings)
            if settings.embedding_model_provider.lower() == "mock"
            else (
                GeminiGateway(embed_settings)
                if settings.embedding_model_provider.lower() == "gemini"
                else OpenAICompatibleGateway(embed_settings)
            )
        )
        self._chat = (
            MockModelGateway(chat_settings)
            if settings.chat_model_provider.lower() == "mock"
            else (
                GeminiGateway(chat_settings)
                if settings.chat_model_provider.lower() == "gemini"
                else OpenAICompatibleGateway(chat_settings)
            )
        )

    @property
    def embedding_dimensions(self) -> int:
        return self._embed.embedding_dimensions

    @property
    def embedding_model_name(self) -> str:
        return self._embed.embedding_model_name

    def embed(self, texts: list[str]) -> list[list[float]]:
        return self._embed.embed(texts)

    def complete_json(self, system_prompt: str, user_prompt: str) -> str:
        return self._chat.complete_json(system_prompt, user_prompt)
