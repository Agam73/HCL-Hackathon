from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All runtime configuration comes from the environment (or .env)."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql://retailpulse:retailpulse@127.0.0.1:5432/retailpulse"
    ai_service_api_key: str = "dev-ai-service-key"
    database_sslmode: str = "prefer"
    database_connect_timeout: int = 10
    database_pool_min_size: int = 1
    database_pool_max_size: int = 10

    chat_model_provider: str = "mock"
    chat_model_name: str = "mock-chat"
    embedding_model_provider: str = "mock"
    embedding_model_name: str = "mock-embed"
    embedding_dimensions: int = 1536
    model_api_key: str = ""
    model_base_url: str = "https://api.openai.com/v1"
    model_timeout_seconds: float = 30.0
    model_max_retries: int = 2

    chunk_size_chars: int = 2400
    chunk_overlap_chars: int = 400

    retrieval_top_k: int = 5
    retrieval_min_score: float = 0.15
    confidence_high_score: float = 0.45
    confidence_medium_score: float = 0.25

    max_upload_bytes: int = 10 * 1024 * 1024
    enable_retrieve_debug: bool = True
    log_level: str = "INFO"

    @field_validator("chunk_overlap_chars")
    @classmethod
    def overlap_smaller_than_chunk(cls, value: int, info) -> int:
        size = info.data.get("chunk_size_chars", 2400)
        if value >= size:
            raise ValueError("CHUNK_OVERLAP_CHARS must be smaller than CHUNK_SIZE_CHARS")
        return value

    @field_validator("embedding_dimensions")
    @classmethod
    def positive_dimensions(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("EMBEDDING_DIMENSIONS must be positive")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()


def reset_settings_cache() -> None:
    get_settings.cache_clear()
