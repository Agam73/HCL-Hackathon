# AI service API contract (for Express)

Base URL (local): `http://127.0.0.1:8000`

All endpoints except `GET /health` require:

```
Authorization: Bearer <AI_SERVICE_API_KEY>
```

Do **not** forward the browser JWT to this service. Authenticate the user in
Express, then call FastAPI with the shared service key. Optional audit header:

```
X-Internal-Actor: <express-user-id>
```

`X-Internal-Actor` is stored as `created_by` on upload. It is not authorization.

## Error shape

```json
{ "error": { "code": "UNAUTHORIZED", "message": "Invalid service bearer token." } }
```

## Health

`GET /health`

- 200: service and database ready
- 503: degraded (`checks.database` or `checks.models`)

## Upload document (admin only in Express)

`POST /api/v1/admin/documents`  
`Content-Type: multipart/form-data`

Fields: `file`, `title`, `version`, `effective_date` (YYYY-MM-DD), `region`,
`category`, `document_type`, optional `expiration_date`, `membership_tier`,
`publication_status` (default `approved`).

201 response:

```json
{
  "document_id": "uuid",
  "ingestion_status": "completed",
  "chunk_count": 4,
  "duplicate": false
}
```

200 when the same file checksum + region + category + document_type + version
was already ingested (`duplicate: true`).

Supported types: `.pdf`, `.md`, `.txt`, `.csv`, `.json`.

## List / get / delete

- `GET /api/v1/admin/documents?limit=20&offset=0&document_type=&ingestion_status=&region=`
- `GET /api/v1/admin/documents/{document_id}`
- `DELETE /api/v1/admin/documents/{document_id}` (204; chunks deleted via CASCADE)

## Knowledge query (customer)

`POST /api/v1/knowledge/query`

```json
{
  "question": "Can I return an opened mobile phone purchased online?",
  "region": "IN",
  "category": "Electronics",
  "membershipTier": "GOLD",
  "asOfDate": "2026-10-10"
}
```

`asOfDate` is optional. When omitted, the UTC calendar date is used.

Success:

```json
{
  "answer": "According to the applicable return policy, ...",
  "confidence": "HIGH",
  "sources": [
    {
      "document": "Online Return Policy",
      "section": "Opened Electronics",
      "version": "2026.2"
    }
  ],
  "followUpRequired": false
}
```

Insufficient evidence (application-enforced, not LLM-only):

```json
{
  "answer": "I don't have that information.",
  "confidence": "LOW",
  "sources": [],
  "followUpRequired": true
}
```

Region / membership / effective-date filters are applied **before** generation.
Documents from other regions are never returned.

## Debug retrieve (disable in production)

`POST /api/v1/knowledge/retrieve`  
Set `ENABLE_RETRIEVE_DEBUG=false` to hide (404).
