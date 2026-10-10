# RetailPulse AI — backend skeleton

Node + Express + PostgreSQL/PgVector base for the NovaMart hackathon use case.
Module 1's catalog/store/inventory layer and the auth layer are **done and tested**;
the schema and folder structure for Modules 2 and 3 are in place so the rest of the
team can build in parallel without touching each other's files.

```
Status: 42/42 smoke tests passing against a seeded database.
```

---

## 1. Run it (3 commands)

```bash
cp .env.example .env            # defaults already match docker-compose
npm install
docker compose up -d db         # Postgres 16 + pgvector on :5432
npm run db:migrate              # creates the full schema
npm run db:seed                 # loads the CSVs in db/seed/
npm run dev                     # http://localhost:8080
```

Verify everything in one shot (server must be running):

```bash
npm run smoke
```

Other scripts: `npm run db:reset` (drop + migrate + seed),
`docker compose --profile app up -d` (API in Docker too),
`docker compose --profile tools up -d adminer` (DB UI on :8081).

**Seeded logins** — password for every account is `Passw0rd!`

| Email | Role | Notes |
|---|---|---|
| `admin@novamart.com` | ADMIN | sees everything |
| `manager.del01@novamart.com` | STORE_MANAGER | scoped to `ST-DEL-01` |
| `manager.mum01@novamart.com` | STORE_MANAGER | scoped to `ST-MUM-01` |
| `ishaan.gupta@example.com` | CUSTOMER | PLATINUM tier, laptop preferences |
| `meera.iyer@example.com` | CUSTOMER | GOLD tier |
| `sara.khan@example.com` | CUSTOMER | STANDARD tier |

Full list in `db/seed/customers.csv`.

---

## 2. What's live

Base path: `/api/v1`. `GET /api/v1/` lists every route at runtime.

### Auth
| Method | Path | Access |
|---|---|---|
| POST | `/auth/register` | public — always creates a CUSTOMER |
| POST | `/auth/login` | public — returns `{ user, token }` |
| GET | `/auth/me` | any logged-in user |
| PATCH | `/auth/me` | any logged-in user — preferences are **merged**, not replaced |
| POST | `/auth/staff` | ADMIN — creates STORE_MANAGER / ADMIN |

### Catalog
| Method | Path |
|---|---|
| GET | `/products` — `q`, `categoryId`, `categorySlug`, `brandId`, `minPrice`, `maxPrice`, `minRating`, `storeId`, `inStockOnly`, `sort`, `page`, `size` |
| GET | `/products/:productId` — detail + availability by store + related products |
| GET | `/products/:productId/availability` — `city`, `country`, `inStockOnly` |
| GET | `/categories` — `?tree=true` for a nested tree |
| GET | `/brands` |

`sort` is one of `relevance`, `price_asc`, `price_desc`, `rating_desc`, `name_asc`, `newest`.
Search combines Postgres full-text (`tsvector`, GIN) with trigram fuzzy matching, so
`?q=laptop for java development` returns the dev laptops. Filtering by a parent category
(`electronics`) includes all sub-categories via a recursive CTE.

### Stores & inventory
| Method | Path | Access |
|---|---|---|
| GET | `/stores` — `city`, `country`, `type`, `q`, `hasProductId` | public |
| GET | `/stores/cities` | public — drives the store picker |
| GET | `/stores/:storeId` | public |
| GET | `/stores/:storeId/inventory` — `q`, `categoryId`, `brandId`, `lowStockOnly`, `inStockOnly`, `sort` | public |
| GET | `/stores/:storeId/inventory/:productId` | public |
| PATCH | `/stores/:storeId/inventory/:productId` | STORE_MANAGER (own store only) or ADMIN |
| GET | `/stores/:storeId/inventory/low-stock` | STORE_MANAGER (own store) or ADMIN |
| GET | `/inventory/low-stock` | ADMIN — across all stores |

`PATCH` takes `{ quantityAvailable }` **or** `{ delta }` (e.g. `-3` for a sale), plus
optional `reorderLevel` and `reason`. It runs in a transaction with `SELECT … FOR UPDATE`,
refuses to go negative, and writes a row to `agent_actions` so every stock movement is
traceable.

### Response shapes

Everything uses one envelope, so the frontend never has to special-case:

```jsonc
// success
{ "success": true, "data": { ... } }

// paged list
{ "success": true, "data": [ ... ],
  "meta": { "page": 1, "size": 20, "totalItems": 37, "totalPages": 2,
            "hasNext": true, "hasPrevious": false } }

// error
{ "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "Request validation failed",
             "details": [{ "field": "minPrice", "message": "...", "code": "custom" }] },
  "traceId": "9b1c…", "path": "/api/v1/products", "timestamp": "2026-10-10T…" }
```

Error codes: `BAD_REQUEST` 400, `UNAUTHORIZED` 401, `FORBIDDEN` 403, `NOT_FOUND` /
`ROUTE_NOT_FOUND` 404, `CONFLICT` 409, `VALIDATION_ERROR` 422, `RATE_LIMITED` 429,
`INTERNAL_ERROR` 500, `DB_UNAVAILABLE` / `SCHEMA_NOT_READY` 503.

Every request gets an `x-request-id` (echoed in the header and in error bodies). Postgres
driver errors are translated — a unique violation becomes a 409, a missing table becomes a
503 that literally tells you to run `npm run db:migrate`.

---

## 3. Layout

```
├── docker-compose.yml          db (pgvector) + optional api + optional adminer
├── Dockerfile
├── .env.example
├── db/
│   ├── migrations/
│   │   ├── 001_init.sql        all tables, enums, indexes, triggers
│   │   └── 002_views.sql       v_product_catalog, v_product_availability, v_low_stock
│   └── seed/                   brands, categories, products, stores, inventory, customers
├── scripts/
│   ├── migrate.js              runs pending migrations, tracked in schema_migrations
│   ├── seed.js                 idempotent CSV loader (UPSERTs)
│   └── smoke.js                42 end-to-end checks
└── src/
    ├── server.js               listen + graceful shutdown
    ├── app.js                  middleware stack, /health
    ├── config/env.js           all env reading happens here, nowhere else
    ├── db/pool.js              pool, query, queryOne, withTransaction
    ├── middleware/
    │   ├── auth.js             requireAuth, optionalAuth, requireRole, requireStoreScope
    │   ├── validate.js         zod validation for body / query / params
    │   ├── errorHandler.js     global exception handler + 404
    │   └── requestContext.js   trace ids
    ├── utils/                  ApiError, asyncHandler, response, jwt, password, schemas
    ├── routes/index.js         mounts every module — add yours here
    └── modules/
        ├── auth/               .routes .controller-free .service .schema
        ├── catalog/
        ├── stores/
        └── inventory/
```

### Adding a module (the pattern)

1. `src/modules/<name>/<name>.schema.js` — zod schemas for the request.
2. `src/modules/<name>/<name>.service.js` — SQL + business rules, throws `ApiError`.
3. `src/modules/<name>/<name>.routes.js` — thin: `validate(...)`, auth guards, `asyncHandler`.
4. One line in `src/routes/index.js`.

Always wrap handlers in `asyncHandler` and throw `ApiError.*` — never `res.status(...).json(...)`
an error by hand, or it'll skip the global handler and the trace id.

---

## 4. Database schema

Already created, so nobody needs to write DDL for their module:

**Catalog** `brands`, `categories` (self-referencing parent), `products`
(`specifications` jsonb, `images` text[], generated `search_vector` tsvector)
**Retail ops** `stores` (STORE / WAREHOUSE), `inventory` (PK `store_id,product_id`,
`reorder_level`), `carts`, `cart_items`, `orders` (`IN_STORE_PICKUP` / `HOME_DELIVERY`,
8 statuses), `order_items`, `support_tickets`
**Users** `users` — `user_role` (CUSTOMER / STORE_MANAGER / ADMIN), `membership_tier`
(STANDARD / SILVER / GOLD / PLATINUM), `preferences` jsonb, `preferred_store_id`,
`managed_store_id`
**Module 2 (RAG)** `kb_documents` — `doc_type`, `version`, `effective_date`, `country`,
`category_id`, `min_tier` (exactly the filters the use case asks for);
`kb_chunks` — `section`, `content`, `metadata` jsonb, `embedding vector(1536)` with an
**HNSW cosine index**. Verified working:
`embedding <=> $1` similarity search returns rows.
**Module 3 (agents)** `agent_actions` — `trace_id`, `agent_name`, `action`, `input`,
`output`, `reasoning`, `requires_approval`, `approved_by`, `status`, `latency_ms`, `model`.
This is the table that answers "why did the agent do that?" and the one that makes
"no uncontrolled agent actions" demonstrable rather than claimed.

> Using a non-1536-dim embedding model (Gemini is 768)? Change **both**
> `EMBEDDING_DIM` in `.env` and `vector(1536)` in `001_init.sql`, then `npm run db:reset`.

---

## 5. Still to build — pick one, no file conflicts

| Owner | Scope | Where |
|---|---|---|
| | Cart + checkout + orders | new `src/modules/cart`, `src/modules/orders` (tables exist) |
| | AI recommendations returning `{ interpretedRequirement, recommendations[], clarifyingQuestion }` | new `src/modules/assistant` |
| | Module 2: ingest PDF/MD/TXT/CSV/JSON → chunk → embed → `kb_chunks`; retrieval + grounded answer with `{ answer, confidence, sources[], followUpRequired }` | new `src/modules/kb` |
| | Module 3: inventory / promotion / order / support agents, writing to `agent_actions` | new `src/modules/agents` |
| | React 19 + Vite frontend against these endpoints | separate `web/` folder |
| | Support tickets + escalation | new `src/modules/support` (table exists) |

Conventions to keep: `/api/v1` prefix, the response envelope above, `ApiError` for every
failure, zod for every input, and a row in `agent_actions` for anything an agent decides
or changes.

---

## 6. Notes / decisions

- **Node instead of Spring Boot.** The use case recommends Spring AI; we're faster in
  Node and nothing in the deliverables requires the JVM. The RAG building blocks Spring AI
  would have given us (vector store + retrieval advisor) are covered by pgvector plus the
  `kb_documents`/`kb_chunks` schema.
- **No ORM.** Raw parameterised SQL via `pg`, plain `.sql` migrations. Faster to reason
  about during a hackathon, and all queries are parameterised — no string-interpolated
  user input anywhere.
- **Views do the heavy joins** (`v_product_catalog`, `v_product_availability`,
  `v_low_stock`) so services stay short and the agents can query the same shapes.
- **`COUNT(*) OVER()`** gives page totals in a single query instead of two round trips.
- **Security basics in place:** helmet, CORS allow-list, 2 MB body cap, bcrypt (10
  rounds), rate limit on auth routes, identical message for unknown-email and wrong-password,
  stack traces never returned in production, and `password_hash` never selected into a
  response DTO.
- Seed data is deliberately uneven — ~8% of store/product rows are out of stock and ~14%
  are below reorder level, so the low-stock feed and the "out of stock after ordering"
  demo both have real data (73 low-stock rows across 10 stores).
