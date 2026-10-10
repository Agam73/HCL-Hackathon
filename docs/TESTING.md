# Testing

How RetailPulse AI is tested, how to run each set of tests, and the results recorded on
10 October 2026.

| What | Where | How to run | Result on 10 Oct 2026 |
| --- | --- | --- | --- |
| Backend unit + integration tests | `backend/tests` | `npm test` in `backend/` | 157 of 157 pass |
| Backend lint | `backend/` | `npm run lint` | clean |
| AI service unit tests | `ai-service/tests/unit` | `pytest tests/unit -q` in `ai-service/` | 31 of 31 pass |
| API smoke test (running backend) | `backend/scripts/smoke.js` | `npm run smoke` | not re-run on this date |
| Policy assistant live check | `backend/scripts/rag-check.js` | `npm run rag:check` | depends on Gemini quota, see section 4 |
| Frontend in a real browser | manual script, not in the repo | see section 5 | 27 of 27 checks pass |
| Frontend build + lint | `frontend/` | `npm run build`, `npm run lint` | builds, 0 lint errors |

CI (`.github/workflows/ci.yml`) runs the backend lint, migrations, seed and `npm test` on every
push. It does not run the AI service tests, the live checks or anything in the frontend.

## 1. Backend tests (automated)

```bash
cd backend
docker compose up -d        # local Postgres with pgvector
npm run db:migrate
npm run db:seed
npm test                    # everything
npm run test:unit           # unit tests only, no database needed
```

The integration tests use `TEST_DATABASE_URL` (the local Docker database). They never use
`DATABASE_URL`, so they cannot touch the shared Supabase database. Do not point
`TEST_DATABASE_URL` at Supabase: the tests create and delete users, carts and orders.

No test calls Gemini or the AI service. The model and the AI service are replaced by stubs, so
the suite gives the same result without keys or network.

| File | Tests | What it covers |
| --- | --- | --- |
| `tests/unit/cart.pricing.test.js` | 9 | Membership-tier discounts, delivery fees, free-delivery thresholds, totals |
| `tests/unit/geo.test.js` | 4 | Distance between two points, nearest-store ordering |
| `tests/unit/llm.test.js` | 7 | Gemini client: JSON parsing, fallback to the second model on 404/429/5xx/timeout, a rejected key suspends the model |
| `tests/unit/chat.test.js` | 18 | Chat routing: policy question or product request, the reply shape for each, AI service failure handling |
| `tests/unit/assistant.test.js` | 38 | Recommendation intent parsing (budget, category, use case), candidate ranking, validation of the model's answer, rule-based fallback |
| `tests/integration/api.test.js` | 33 | Health, register/login/refresh/logout, roles, admin-device session, product search/filter/sort/paging, stores, inventory, cart, validation errors, 404s |
| `tests/integration/orders.test.js` | 18 | Checkout for pickup and delivery, stock decrement inside a transaction, insufficient stock, cancel restores stock, manager status changes, who can see which order |
| `tests/integration/extras.test.js` | 11 | Stock ledger entries, idempotent checkout with `Idempotency-Key`, the extra schema tables and views |
| `tests/integration/assistant.test.js` | 19 | `POST /assistant/recommendations` end to end with a stubbed model: grounding to real products, stock per store, audit rows, auth |

## 2. AI service tests (automated)

```bash
cd ai-service
pip install -r requirements.txt
pytest tests/unit -q        # 31 tests, no database or key needed
pytest -q                   # also runs tests/integration when Postgres is reachable
```

The unit tests cover document parsing, chunking, retrieval ranking and filters, answer
grounding and refusal, and the API-key check. `tests/integration/test_pgvector_rag.py` needs a
Postgres with pgvector at `DATABASE_URL` and skips itself otherwise. It was not run on this
date.

## 3. API smoke test (live)

```bash
cd backend
npm start                   # one terminal
npm run smoke               # another
```

Runs against whatever database the backend is using and only reads data, apart from logging
in. Checks health, auth, roles, product search and paging, product detail, stores, inventory
by store, validation errors and 404s.

## 4. Policy assistant live check (RAG)

```bash
cd ai-service && uvicorn app.main:app --port 8000     # terminal 1
cd backend && npm start                               # terminal 2
cd backend && npm run rag:check                       # terminal 3
```

The backend needs `AI_SERVICE_URL` and `AI_SERVICE_API_KEY` in `backend/.env`, with the key
equal to `AI_SERVICE_API_KEY` in `ai-service/.env`. The script exits with code 1 if any case
fails.

This check calls Gemini for real, so its result depends on the quota of the key in
`ai-service/.env`. It writes nothing to the database except audit rows for the product
question.

**Part A, straight to the AI service.** Seven questions. For five, the top retrieved document
must be the right one, the answer must cite it and, where a fact is given, contain it. Two are
off-topic and must be refused with no sources.

| Question | Expected |
| --- | --- |
| Can I return an opened mobile phone purchased online? | Return policy, mentions 14 days |
| Do Gold members get free express delivery? | Shipping policy |
| What is the warranty period for a refrigerator compressor? | Warranty policy, 10 years |
| How do I factory reset my smartphone? | Smartphone manual |
| At what stock level should a store raise a replenishment request? | Replenishment SOP |
| What is the capital of France? | Refused |
| What is NovaMart's policy on returning a pet tiger? | Refused |

**Part B, through the backend.** `POST /assistant/chat` as the seeded Gold customer: three of
the policy questions above must come back as `type: "policy"` with sources, and "laptop for
Java development under 1 lakh" must come back as `type: "products"` with recommendations.

### Results

| Run on 10 Oct 2026 | Part A | Part B | Answer time |
| --- | --- | --- | --- |
| First run, quota available | 7 of 7 | 3 of 4 | 4 to 10 s |
| Same policy question asked 4 times | n/a | 2 of 4 answered | 16 to 24 s when refused |
| Later run, quota used up | 2 of 7 | 1 of 4 | about 17 s each |

Retrieval was correct in every run: the right document and section came first for all five
real questions, in about 1 s. Every failure was in the answer step.

The cause is the Gemini quota. The AI service's key returned HTTP 429 `RESOURCE_EXHAUSTED` for
its chat model (`gemini-3.8-flash`). In the later run the quota was fully used, so every policy
question was refused. The two "passes" in part A of that run are the off-topic questions, which
are refused either way. The product question in part B passed because the backend uses its own
key and model.

The same key answered normally on `gemini-3.5-flash` and `gemini-flash-lite-latest` at that
moment, so setting `CHAT_MODEL_NAME` to one of those in `ai-service/.env` should restore
answers. That change has not been made or tested.

### Known problems found by this check

1. **A model failure looks like "no answer".** When the Gemini call fails, the AI service
   replies "I don't have that information." with low confidence and no sources, after retrying
   for about 17 s. A customer cannot tell this from a question the knowledge base really does
   not cover. The service log shows `Model JSON repair failed; using application fallback`.
2. **Gold express delivery is contradictory.** The knowledge base in the AI service says only
   Platinum members get free express delivery. The backend's cart pricing gives it to Gold as
   well. The assistant and the checkout total can disagree.
3. **A stray test document is in the shared database.** "Online Return Policy" version 2026.2
   says 7-day returns, while the real policy says 14 days. It ranks first for return questions.
4. **The AI service's tables on Supabase have row-level security off**, unlike the backend's
   tables.

## 5. Frontend in a browser (manual)

There are no automated frontend tests. On 10 October 2026 the wired frontend was driven in
headless Edge against the running backend and the Supabase database, with 27 checks:

- Opening the site signed out lands on the login page
- A wrong password is rejected, a seeded customer can log in
- The storefront shows real products, categories and stores, and search works
- Add to cart, cart survives a reload, place an order, cancel it
- A customer is redirected away from the manager and admin pages, and a manager away from the
  customer page
- The manager portal shows the manager's own store inventory and orders, and the status filter
  works
- The admin portal opens without a login on a trusted PC, including the Products and Stores
  pages

All 27 passed and the browser reported no page errors. One check was first reported as failed
because the test compared against "Out of Stock" while the page wraps that text over two
lines. The filter itself returned the right rows.

Not clicked through in the browser: delivery checkout, switching store, the chat box, the
manager's adjust-stock and order-status buttons, and the admin add/edit forms. The endpoints
behind them are covered by the backend tests in section 1.

Still showing mock data in the frontend: the admin analytics dashboard and knowledge-base
page, notifications, the manager's Payments tab and the landing-page marketing content.

Test orders, carts and audit rows created on Supabase during these runs were deleted
afterwards.

## 6. Seeded accounts for manual testing

All seeded users share the password `Passw0rd!`.

| Role | Email |
| --- | --- |
| Customer (Gold) | `meera.iyer@example.com` |
| Store manager | `manager.blr01@novamart.com` |
| Admin | no login: `POST /auth/admin-device` from an address in `ADMIN_TRUSTED_IPS` |
