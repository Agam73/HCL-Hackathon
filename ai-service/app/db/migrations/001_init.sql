CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'md', 'txt', 'csv', 'json')),
    version TEXT NOT NULL,
    effective_date DATE NOT NULL,
    expiration_date DATE,
    region TEXT NOT NULL,
    category TEXT NOT NULL,
    document_type TEXT NOT NULL,
    membership_tier TEXT,
    publication_status TEXT NOT NULL DEFAULT 'approved'
        CHECK (publication_status IN ('draft', 'approved', 'superseded', 'expired')),
    ingestion_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (ingestion_status IN ('pending', 'processing', 'completed', 'failed')),
    content_checksum TEXT NOT NULL,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    superseded_by UUID REFERENCES documents(id),
    CONSTRAINT expiration_after_effective CHECK (
        expiration_date IS NULL OR expiration_date >= effective_date
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_duplicate
    ON documents (content_checksum, region, category, document_type, version);

CREATE INDEX IF NOT EXISTS idx_documents_retrieval
    ON documents (
        region,
        category,
        document_type,
        publication_status,
        ingestion_status,
        effective_date,
        expiration_date
    );

CREATE INDEX IF NOT EXISTS idx_documents_status
    ON documents (ingestion_status, publication_status);

CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(__EMBEDDING_DIMENSIONS__) NOT NULL,
    section TEXT,
    page_number INTEGER,
    source_locator TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_chunks_document_id
    ON document_chunks (document_id);

-- Cosine distance operator is <=> . The index ops class must match.
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw
    ON document_chunks USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS documents_set_updated_at ON documents;
CREATE TRIGGER documents_set_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
