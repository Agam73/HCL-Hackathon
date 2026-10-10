# RetailPulse AI — backend skeleton

Node + Express + PostgreSQL/PgVector base for the NovaMart hackathon use case.
Module 1's catalog/store/inventory layer, auth (with refresh tokens), the cart and orders are
**done and tested**; the schema and folder structure for Modules 2 and 3 are in place so
the rest of the team can build in parallel without touching each other's files.

```
Status: lint clean, 75 Jest tests and 42 smoke checks passing against a seeded database.
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

Verify:

```bash
npm run lint        # ESLint
npm test            # Jest: unit + integration (needs the migrated, seeded DB; no server needed)
npm run smoke       # 42 HTTP checks against a running server
```

**Shared database (Supabase).** To use the team's hosted Postgres instead of local Docker,
set `DATABASE_URL` to the project's **Session pooler** connection string and `PGSSL=true` in
`.env` (see `.env.example`; the "direct" `db.<ref>.supabase.co` host is IPv6-only and does not
resolve on most networks). The schema and seed are already loaded there, so do **not** re-run
`db:seed` against it (it resets the seeded accounts for everyone), and `db:reset` refuses to
run against a remote database unless `ALLOW_REMOTE_RESET=true`. Every table has row level
security enabled with no policies, so Supabase's public REST API cannot read them; the backend
connects as the owner and is unaffected.

**Tests never touch `DATABASE_URL`.** `npm test` always uses `TEST_DATABASE_URL`, defaulting to
the local Docker Postgres, because the tests create and delete rows. Keep
`docker compose up -d db` running (migrated and seeded) to run them.

CI (`.github/workflows/ci.yml`) runs lint, migrate, seed and `npm test` on every pull request.

Other scripts: `npm run db:reset` (drop + migrate + seed),
`npm run db:generate` (rebuild the generated part of the seed catalogue),
`npm run format` (Prettier),
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
| POST | `/auth/register` | public — always creates a CUSTOMER on the STANDARD tier |
| POST | `/auth/login` | public — returns `{ user, token, refreshToken }` |
| POST | `/auth/refresh` | public — body `{ refreshToken }`, returns a new pair; the old refresh token stops working |
| POST | `/auth/logout` | public — body `{ refreshToken }`, revokes it |
| GET | `/auth/me` | any logged-in user |
| PATCH | `/auth/me` | any logged-in user — preferences are **merged**, not replaced |
| POST | `/auth/staff` | ADMIN — creates STORE_MANAGER / ADMIN |
| POST | `/auth/admin-device` | no credentials — returns an ADMIN session, but only to addresses in `ADMIN_TRUSTED_IPS` (admin PCs are locked, so the admin portal has no login); `403` for anyone else and for a signed-in customer or manager |

The access token lives 15 minutes (`JWT_EXPIRES_IN`), the refresh token 7 days
(`JWT_REFRESH_EXPIRES_DAYS`). Refresh tokens are single-use and stored only as a SHA-256 hash.

### Catalog
| Method | Path |
|---|---|
| GET | `/products` — `q`, `categoryId`, `categorySlug`, `brandId`, `minPrice`, `maxPrice`, `minRating`, `storeId`, `inStockOnly`, `sort`, `page`, `size` |
| GET | `/products/:productId` — detail + availability by store + related products |
| GET | `/products/:productId/availability` — `city`, `country`, `inStockOnly`, `nearStoreId` |
| GET | `/categories` — `?tree=true` for a nested tree |
| GET | `/brands` |
| POST | `/products` — ADMIN creates a product |
| PATCH | `/products/:productId` — ADMIN edits it |
| DELETE | `/products/:productId` — ADMIN retires it (`isActive: false`, not erased) |

`sort` is one of `relevance`, `price_asc`, `price_desc`, `rating_desc`, `name_asc`, `newest`.
Search combines Postgres full-text (`tsvector`, GIN) with trigram fuzzy matching, so
`?q=laptop for java development` returns the dev laptops. Filtering by a parent category
(`electronics`) includes all sub-categories via a recursive CTE.

With `storeId`, each product carries `storeStock` for that store
(`IN_STOCK` / `LOW_STOCK` / `OUT_OF_STOCK`). With `nearStoreId`, the availability list adds
`distanceKm` from that store and is ordered nearest-first — the fallback to offer when the
customer's own store is out of stock.

### Stores & inventory
| Method | Path | Access |
|---|---|---|
| GET | `/stores` — `city`, `country`, `type`, `q`, `hasProductId` | public |
| GET | `/stores/cities` | public — drives the store picker |
| GET | `/stores/:storeId` | public |
| POST | `/stores` | ADMIN — open a store or warehouse |
| PATCH | `/stores/:storeId` | ADMIN — edit it |
| DELETE | `/stores/:storeId` | ADMIN — close it (`isActive: false`, not erased) |
| GET | `/stores/:storeId/inventory` — `q`, `categoryId`, `brandId`, `status`, `lowStockOnly`, `inStockOnly`, `sort` | public |
| GET | `/stores/:storeId/inventory/:productId` | public |
| PATCH | `/stores/:storeId/inventory/:productId` | STORE_MANAGER (own store only) or ADMIN |
| GET | `/stores/:storeId/inventory/low-stock` | STORE_MANAGER (own store) or ADMIN |
| GET | `/stores/:storeId/inventory/movements` — `productId`, `type` | STORE_MANAGER (own store) or ADMIN — the stock ledger |
| GET | `/inventory/low-stock` | ADMIN — across all stores |

Every stock change is appended to `inventory_movements` in the same transaction that
changes the balance: `RESTOCK` / `ADJUSTMENT` for manual changes, `SALE` at checkout and
`RETURN` on cancellation (both linked to the order). Each row stores the balance after it.

`PATCH` takes `{ quantityAvailable }` **or** `{ delta }` (e.g. `-3` for a sale), plus
optional `reorderLevel` and `reason`. It runs in a transaction with `SELECT … FOR UPDATE`,
refuses to go negative, and writes a row to `agent_actions` so every stock movement is
traceable.

### Cart
All cart routes need a login; the cart is always the token owner's (one per user, stored in
the database, so it survives sessions and devices).

| Method | Path | |
|---|---|---|
| GET | `/cart` | items, totals, membership perks, stock issues |
| POST | `/cart/items` | `{ productId, quantity? }` — adds, or increments if already there |
| PATCH | `/cart/items/:productId` | `{ quantity }` (1–10) |
| DELETE | `/cart/items/:productId` | remove one line |
| DELETE | `/cart` | empty the cart |

Every call returns the whole cart. Lines are priced at today's catalogue price
(`priceChanged` flags a change since the item was added) and stock is checked at the
customer's preferred store. `summary.delivery` and `membership` apply the tier rules from
`db/seed/knowledge-base` (free standard delivery above ₹499, always free for Gold/Platinum;
express ₹149, free for Gold/Platinum and for Silver above ₹2,499; 1/2/3/5 reward points per
₹100). The tier is read from the `users` table, never from the request. The rules live in
`src/modules/cart/cart.pricing.js`.

Customer preferences (categories, brands, budget, city, preferred store) are saved through
`PATCH /auth/me`.

### Orders
All order routes need a login.

| Method | Path | Access |
|---|---|---|
| POST | `/orders` | any logged-in user — checks out their cart |
| GET | `/orders` — `status`, `page`, `size` | own order history |
| GET | `/orders/:orderRef` | owner, the manager of the order's store, or ADMIN (`404` for anyone else) |
| POST | `/orders/:orderRef/cancel` | owner, while the order is `CONFIRMED` or `PACKED` |
| PATCH | `/orders/:orderRef/status` | STORE_MANAGER (own store) or ADMIN |
| GET | `/stores/:storeId/orders` — `status`, `page`, `size` | STORE_MANAGER (own store) or ADMIN |

`:orderRef` is the order id or its order number (`NM-20261010-A1B2C3`).

`POST /orders` takes `{ fulfillment, storeId?, deliverySpeed?, shippingAddress?,
paymentMethod?, simulatePaymentFailure? }`:

- `IN_STORE_PICKUP` collects from `storeId` (default: the customer's preferred store); free.
- `HOME_DELIVERY` needs `shippingAddress` and ships from the customer's store if it can cover
  the whole order, otherwise a warehouse, otherwise another store. `deliverySpeed` is
  `STANDARD` or `EXPRESS`; the fee follows the same tier rules as the cart.
- Send an `Idempotency-Key` header (or `idempotencyKey` in the body, 8–128 characters) to
  make retries safe: the same customer repeating the same key gets the original order back
  with `200` instead of a second order.
- Payment is simulated: `SIMULATED_PAID`, or `PAY_ON_DELIVERY` for `CASH_ON_DELIVERY`.
  `simulatePaymentFailure: true` returns `402 PAYMENT_FAILED` and changes nothing.

Checkout is one transaction: inventory rows are locked, re-checked and decremented, the order
is written and the cart emptied. Short stock is a `409` listing each line's shortfall, and the
cart is kept. Cancelling puts the stock back and marks a paid order `SIMULATED_REFUNDED`.

Status flow (anything else is a `409`):

```
pickup:    CONFIRMED -> PACKED -> READY_FOR_PICKUP -> DELIVERED
delivery:  CONFIRMED -> PACKED -> SHIPPED -> DELIVERED
CANCELLED is allowed from any step before SHIPPED / DELIVERED
```

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
│   │   ├── 002_views.sql       v_product_catalog, v_product_availability, v_low_stock
│   │   ├── 003_refresh_tokens.sql
│   │   ├── 004_order_details.sql
│   │   ├── 005_row_level_security.sql
│   │   ├── 006_views_respect_rls.sql
│   │   └── 007_schema_extras.sql   stock ledger, ticket thread, product_images view, order tax + idempotency
│   └── seed/                   brands, categories, products, stores, inventory, customers
│                               (+ products_generated.csv / inventory_generated.csv)
├── scripts/
│   ├── migrate.js              runs pending migrations, tracked in schema_migrations
│   ├── seed.js                 idempotent CSV loader (UPSERTs)
│   ├── generate-seed.js        builds the generated catalogue (deterministic)
│   └── smoke.js                42 end-to-end checks
├── tests/                      Jest: unit/ (pure logic) and integration/ (supertest + DB)
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
        ├── inventory/
        ├── cart/               + cart.pricing.js (pure tier/delivery rules)
        └── orders/
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
**Added from the team's schema proposal (`db/schema.sql`, migration 007)**
`inventory_movements` (stock ledger), `ticket_messages`, `product_images` (a view over
`products.images`; first image is primary), `orders.tax` / `orders.idempotency_key`,
`support_tickets.store_id` / `is_escalated`, and the `SUPPORT_AGENT` role. `db/schema.sql`
itself is a reference design and is not applied; the migrations are the source of truth.
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
- Seed data: 328 products (37 hand-written + 291 generated variants), 34 brands, 16
  categories, 8 stores + 2 warehouses, 12 users across all 4 tiers. Stock is deliberately
  uneven — ~8% of store/product rows are out of stock and ~14% are at or below reorder
  level, so the low-stock feed, the nearby-store fallback and the "out of stock after
  ordering" demo all have real data.
