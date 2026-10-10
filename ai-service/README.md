# RetailPulse AI service (Person 3 — RAG pipeline)

Python FastAPI microservice that ingests approved retail documents, chunks
them, embeds them, stores vectors in PostgreSQL + pgvector, retrieves
evidence, and returns grounded JSON answers.

This service is **not** the Express API. Express authenticates users, then
calls these endpoints with a shared service key.

Sample policies in `samples/` are **synthetic demo text**, not real NovaMart policies.

## Architecture

```
Admin/customer → Express (JWT) → FastAPI (this repo) → PostgreSQL 16 + pgvector
                                              ↓
                                    model gateway (mock or OpenAI-compatible)
```

Service-to-service auth: `Authorization: Bearer $AI_SERVICE_API_KEY`.

The AI service ignores any client-supplied role. Optional `X-Internal-Actor`
is audit-only (`created_by`).

See [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) for the Express contract.

## Prerequisites (Windows)

1. Python **3.11** (`py -3.11 --version` should work).
2. **PostgreSQL 16 with pgvector** for the full pipeline.
   - Recommended: [Docker Desktop](https://www.docker.com/products/docker-desktop/) then `docker compose up postgres`.
   - Docker is **not** currently required to run unit tests (they mock the DB and models).
3. Optional: an OpenAI (or compatible) API key for neural embeddings and chat.

## Model providers (read this before choosing)

| `CHAT_MODEL_PROVIDER` / `EMBEDDING_MODEL_PROVIDER` | When to use |
| --- | --- |
| `mock` | Default. No API key. Embeddings are lexical-hash vectors so overlapping words retrieve. Chat returns contract-shaped JSON. Use for tests and first boot. **Not** neural semantic search. |
| `openai` | OpenAI or any OpenAI-compatible `/v1` server. Set `MODEL_API_KEY` and optionally `MODEL_BASE_URL` (Groq, Together, LM Studio, Ollama). Use `text-embedding-3-small` (1536 dims) unless you change `EMBEDDING_DIMENSIONS` **and** re-run migrations / re-ingest. |
| `gemini` | Google Gemini native REST API. Set `MODEL_API_KEY`, use `gemini-2.5-flash` for chat and `gemini-embedding-001` for embeddings. The service requests the configured `EMBEDDING_DIMENSIONS` (1536 by default). |

Chat and embedding providers can differ (`SplitGateway`), but mixing mock embeddings with a real chat model produces weak retrieval.
For Gemini, keep the API key only in `ai-service/.env`; it is never sent to the frontend or stored in PostgreSQL.

**Never** change `EMBEDDING_MODEL_NAME` or `EMBEDDING_DIMENSIONS` on an existing index without dropping/recreating `document_chunks` and re-ingesting. The service will refuse silently mismatched vector widths.

`RETRIEVAL_MIN_SCORE` is **not** a universal truth. Calibrate it with representative questions. Cosine **distance** uses pgvector `<=>` with an HNSW `vector_cosine_ops` index. We expose `relevance_score = 1 - distance`.

## Effective-date rules

- Customer queries use `asOfDate` or, if omitted, the **UTC calendar date**.
- A document is eligible only if `publication_status = approved`, `ingestion_status = completed`, `superseded_by IS NULL`, `region` matches, `effective_date <= asOfDate`, and `expiration_date` is null or `>= asOfDate`.
- Draft / superseded / expired rows are excluded from normal retrieval.
- Membership: `NULL` or `ALL` applies to everyone; otherwise the document tier must equal the query tier. Other-region documents never leak.

## Setup (PowerShell)

From the repo root:

```powershell
cd ai-service
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```

If execution policy blocks the venv script:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\.venv\Scripts\Activate.ps1
```

### Database

If Docker Desktop is installed, from the **repo root**:

```powershell
docker compose up -d postgres
cd ai-service
python -m app.db.migrate
```

If you install PostgreSQL yourself, enable pgvector, create database `retailpulse`, and set `DATABASE_URL` in `.env`.

## Run the API

```powershell
cd ai-service
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

OpenAPI: http://127.0.0.1:8000/docs  
Health: http://127.0.0.1:8000/health

## Load the NovaMart demo knowledge base

After PostgreSQL is running and migrations have been applied, load the fixed
Markdown documents from `./novamart_rag_knowledge_base`:

```powershell
cd ai-service
.\.venv\Scripts\Activate.ps1
python -m app.seed_knowledge_base
```

The command is safe to repeat. It uses the documents' fixed demo metadata,
creates chunks and embeddings, and skips duplicates. It intentionally does not
implement document upgrades or supersession.

## Ingest the sample policy and ask a question

```powershell
$headers = @{ Authorization = "Bearer dev-ai-service-key" }  # must match AI_SERVICE_API_KEY

# Upload
curl.exe -s -X POST http://127.0.0.1:8000/api/v1/admin/documents `
  -H "Authorization: Bearer dev-ai-service-key" `
  -F "file=@samples/online_return_policy.md" `
  -F "title=Online Return Policy" `
  -F "version=2026.2" `
  -F "effective_date=2026-01-01" `
  -F "region=IN" `
  -F "category=Electronics" `
  -F "document_type=return_policy" `
  -F "membership_tier=ALL"

# Inspect retrieved evidence (debug)
curl.exe -s -X POST http://127.0.0.1:8000/api/v1/knowledge/retrieve `
  -H "Authorization: Bearer dev-ai-service-key" `
  -H "Content-Type: application/json" `
  -d "{\"question\":\"Can I return an opened mobile phone purchased online?\",\"region\":\"IN\",\"category\":\"Electronics\",\"membershipTier\":\"GOLD\"}"

# Grounded answer
curl.exe -s -X POST http://127.0.0.1:8000/api/v1/knowledge/query `
  -H "Authorization: Bearer dev-ai-service-key" `
  -H "Content-Type: application/json" `
  -d "{\"question\":\"Can I return an opened mobile phone purchased online?\",\"region\":\"IN\",\"category\":\"Electronics\",\"membershipTier\":\"GOLD\"}"
```

Fallback when evidence is missing or below threshold:

```json
{
  "answer": "I don't have that information.",
  "confidence": "LOW",
  "sources": [],
  "followUpRequired": true
}
```

That fallback is enforced in **application code** when retrieval is empty, below `RETRIEVAL_MIN_SCORE`, or conflicting versions score too closely. The LLM is not the only gate.

## Tests

```powershell
cd ai-service
.\.venv\Scripts\Activate.ps1
pytest -q
```

Integration tests (`tests/integration`) skip unless PostgreSQL is reachable.

## Express integration

1. Keep `AI_SERVICE_API_KEY` in both services' env (never the frontend).
2. After JWT auth, Express calls FastAPI with the bearer service key.
3. Map Express admin routes → `/api/v1/admin/documents`.
4. Map customer ask → `/api/v1/knowledge/query`.
5. Set `ENABLE_RETRIEVE_DEBUG=false` in production.

## Known limitations

- Docker Desktop was not installed on the development machine at first implementation; unit tests do not need it. End-to-end pgvector tests need Postgres.
- Mock embeddings are lexical, not neural.
- Confidence is a retrieval-quality policy (`HIGH`/`MEDIUM`/`LOW`), not a calibrated probability.
- Membership matching is exact-tier or ALL, not “GOLD includes SILVER benefits”.
- CSV/JSON chunking preserves row/object context; it is not a spreadsheet analytics engine.
- Changing embedding dimensions requires a new database (or a new migration) and full re-ingest.
