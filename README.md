# RetailPulse AI (NovaMart)

Hackathon project for a fictional omnichannel retailer. The customer-facing
app will use React and a Node.js/Express API. Retrieval-Augmented Generation
lives in a separate Python FastAPI service.

## Current repository status

| Path | Status |
|------|--------|
| `ai-service/` | Python RAG microservice (Person 3) |
| `backend/` | Reserved for Node.js/Express (empty scaffold) |
| `frontend/` | Reserved for React (empty scaffold) |

## Request flow (target)

Customer or admin → React → Express (JWT/auth) → FastAPI AI service → PostgreSQL 16 + pgvector → configured chat/embedding models.

The AI service never trusts a browser-supplied user id or role. Express authenticates users, then calls FastAPI with a **service API key**.

## Start here

See [`ai-service/README.md`](ai-service/README.md) for environment setup, migrations, ingestion, querying, and tests.
