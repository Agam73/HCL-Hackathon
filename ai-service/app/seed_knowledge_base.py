"""Ingest the fixed NovaMart demo knowledge base.

This intentionally does not implement document upgrades or supersession.
Repeated runs are safe because ingestion deduplicates by checksum and metadata.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from app.core.config import get_settings
from app.db.connection import create_pool
from app.services.embedding_service import EmbeddingService
from app.services.ingestion_service import IngestionMetadata, IngestionService
from app.services.model_gateway import build_gateway
from app.utils.file_validation import validate_upload

logger = logging.getLogger(__name__)

KNOWLEDGE_BASE_DIR = Path(__file__).resolve().parents[2] / "novamart_rag_knowledge_base"


@dataclass(frozen=True)
class SeedDocument:
    filename: str
    title: str
    category: str
    document_type: str


SEED_DOCUMENTS = (
    SeedDocument("online_return_policy.md", "NovaMart Online Return Policy", "ALL", "RETURN_POLICY"),
    SeedDocument("in_store_return_policy.md", "NovaMart In-Store Returns and Refunds Policy", "ALL", "RETURN_POLICY"),
    SeedDocument("warranty_policy.md", "NovaMart Limited Product Warranty Policy", "ALL", "WARRANTY"),
    SeedDocument("shipping_delivery_policy.md", "NovaMart Shipping and Delivery Policy", "ALL", "SHIPPING"),
    SeedDocument("smartphone_manual.md", "NovaMart Demo Smartphone User Manual", "Smartphones", "PRODUCT_MANUAL"),
    SeedDocument("refrigerator_manual.md", "NovaMart Demo Refrigerator User Manual", "Refrigerators", "PRODUCT_MANUAL"),
    SeedDocument("inventory_replenishment.md", "NovaMart Inventory Replenishment SOP", "Store Operations", "INVENTORY_SOP"),
    SeedDocument("customer_support_sop.md", "NovaMart Customer Support and Escalation SOP", "Customer Support", "CUSTOMER_SUPPORT_SOP"),
)


def seed_knowledge_base() -> int:
    settings = get_settings()
    gateway = build_gateway(settings)
    pool = create_pool(settings)
    ingested = 0
    try:
        pool.wait(timeout=10)
        with pool.connection() as conn:
            service = IngestionService(conn, EmbeddingService(gateway, settings.embedding_dimensions), settings)
            for seed in SEED_DOCUMENTS:
                path = KNOWLEDGE_BASE_DIR / seed.filename
                if not path.is_file():
                    raise FileNotFoundError(f"Knowledge-base document is missing: {path}")
                content = path.read_bytes()
                validated = validate_upload(seed.filename, content, settings.max_upload_bytes)
                result = service.ingest(
                    validated,
                    IngestionMetadata(
                        title=seed.title,
                        version="2026.1",
                        effective_date=date(2026, 10, 1),
                        expiration_date=None,
                        region="IN",
                        category=seed.category,
                        document_type=seed.document_type,
                        membership_tier="ALL",
                        publication_status="approved",
                        created_by="demo-seed",
                    ),
                )
                if not result.duplicate:
                    ingested += 1
                logger.info("%s: %s chunks (duplicate=%s)", seed.filename, result.chunk_count, result.duplicate)
    finally:
        pool.close()
    return ingested


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    count = seed_knowledge_base()
    print(f"Knowledge base ready; newly ingested {count} document(s).")


if __name__ == "__main__":
    main()
