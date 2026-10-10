# Connecting the frontend to the RetailPulse API

For whoever owns `frontend/`. The frontend (as of commit `2eb48ba`, "frontend 3") renders
hardcoded data and makes no HTTP calls. This guide lists what the backend offers, which screen
needs which endpoint, and how the mock fields map to real ones. Nothing here has been applied
to `frontend/`.

Full endpoint reference: [backend/README.md](../backend/README.md). `GET /api/v1/` lists every
live route.

## 1. Run the backend

```bash
cd backend
cp .env.example .env
npm install
docker compose up -d db
npm run db:migrate && npm run db:seed
npm run dev                      # http://localhost:8080
```

- Base URL: `http://localhost:8080/api/v1`. Put it in `frontend/.env` as
  `VITE_API_URL=http://localhost:8080/api/v1` and read `import.meta.env.VITE_API_URL`.
- CORS allows `http://localhost:5173` and `http://localhost:3000`. Open the app on
  `localhost`, not `127.0.0.1`, or add the origin to `CORS_ORIGINS` in `backend/.env`.
- Every seeded account uses the password `Passw0rd!`:

| Email | Role | Notes |
|---|---|---|
| `admin@novamart.com` | ADMIN | all stores |
| `manager.del01@novamart.com` | STORE_MANAGER | manages `ST-DEL-01` only |
| `ishaan.gupta@example.com` | CUSTOMER | PLATINUM, preferred store `ST-DEL-01` |
| `sara.khan@example.com` | CUSTOMER | STANDARD, preferred store `ST-HYD-01` |

## 2. Response envelope

Every response has the same shape, so one wrapper can unwrap all of them.

```jsonc
{ "success": true, "data": { } }                       // single object
{ "success": true, "data": [ ], "meta": { "page": 1, "size": 20, "totalItems": 328,
                                          "totalPages": 17, "hasNext": true, "hasPrevious": false } }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...",
                               "details": [{ "field": "email", "message": "..." }] }, "traceId": "..." }
```

Status codes to handle: `401` (not logged in, or token expired), `403` (wrong role or wrong
store), `404`, `409` (email already registered), `422` (validation; show `details` per field),
`429` (too many login attempts).

## 3. Auth

| Call | Body | Returns |
|---|---|---|
| `POST /auth/login` | `{ email, password }` | `{ user, token, refreshToken }` |
| `POST /auth/register` | `{ fullName, email, password, city?, preferredStoreId? }` | same; always a STANDARD-tier CUSTOMER |
| `POST /auth/refresh` | `{ refreshToken }` | a new `{ user, token, refreshToken }` |
| `POST /auth/logout` | `{ refreshToken }` | `204` |
| `GET /auth/me` | | the user |
| `PATCH /auth/me` | profile and preferences (section 7) | the user |

- Send `Authorization: Bearer <token>` on every authenticated call.
- The access token lasts **15 minutes**. On a `401`, call `/auth/refresh` once and retry the
  request with the new token.
- Refresh tokens are **single-use**: each refresh returns a new one and the old one stops
  working. If several requests fail with 401 at the same moment they must share one refresh
  call, otherwise the second one is rejected and the user is logged out.
- Route by `user.role` after login: `CUSTOMER` → `/`, `STORE_MANAGER` → `/storemanager`,
  `ADMIN` → `/admin`. Today those three routes are open to anyone; the API will still refuse
  the calls, but the screens should redirect to a login page when there is no user or the
  role does not match.
- A manager's store is `user.managedStoreId`. Use it instead of the hardcoded
  "Store #104 (Austin Flagship)".

A client that does all of the above (drop in as `src/api/client.js`):

```js
const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1').replace(/\/$/, '');
const KEY = 'novamart.session';

export class ApiError extends Error {
  constructor({ status, code, message, details }) {
    super(message);
    Object.assign(this, { status, code, details });
  }
}

let session = JSON.parse(localStorage.getItem(KEY) ?? 'null'); // { token, refreshToken }

export const getSession = () => session;
export function setSession(next) {
  session = next ? { token: next.token, refreshToken: next.refreshToken } : null;
  if (session) localStorage.setItem(KEY, JSON.stringify(session));
  else localStorage.removeItem(KEY);
}

async function send(path, { method = 'GET', body, params, auth = true } = {}) {
  const qs = new URLSearchParams(
    Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== false)
  ).toString();
  const response = await fetch(`${API_URL}${path}${qs ? `?${qs}` : ''}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(auth && session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = response.status === 204 ? null : await response.json().catch(() => null);
  return { response, json };
}

let refreshing = null; // one refresh shared by every request that hit a 401
function refresh() {
  refreshing ??= send('/auth/refresh', { method: 'POST', body: { refreshToken: session.refreshToken }, auth: false })
    .then(({ response, json }) => {
      if (!response.ok) return false;
      setSession(json.data);
      return true;
    })
    .catch(() => false)
    .finally(() => { refreshing = null; });
  return refreshing;
}

/** Resolves to { data, meta }; throws ApiError. */
export async function request(path, options = {}) {
  let { response, json } = await send(path, options);
  if (response.status === 401 && options.auth !== false && session?.refreshToken) {
    if (await refresh()) ({ response, json } = await send(path, options));
    else setSession(null); // refresh token rejected: send the user to the login page
  }
  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      code: json?.error?.code,
      message: json?.error?.message ?? `Request failed (${response.status})`,
      details: json?.error?.details,
    });
  }
  return json ?? { data: null };
}
```

Usage: `const { data, meta } = await request('/products', { params: { q: 'laptop', page: 2 } })`.

## 4. Which screen needs which endpoint

| Screen (file) | Today | Replace with |
|---|---|---|
| Storefront product grid (`customer/CustomerStorefront.jsx`) | 4 inline products | `GET /products` (section 5) |
| Storefront cart badge and "Add" | `useState([])`, lost on reload | `GET /cart`, `POST /cart/items` (section 6) |
| Storefront store text "Austin Flagship Store #104" | hardcoded | `GET /stores`, the user's `preferredStoreId` |
| Storefront AI chat widget | canned replies | no endpoint yet (recommendations and RAG are later phases) |
| Manager header and task queue (`store-manager/StoreManagerDashboard.jsx`) | hardcoded store and tasks | `GET /stores/:storeId`, `GET /stores/:storeId/inventory/low-stock` as the restock queue |
| Admin store dropdown (`admin/AdminNavbar.jsx`) | 5 inline stores | `GET /stores?size=100` |
| Admin inventory table (`admin/InventorySection.jsx`) | 6 inline rows | `GET /stores/:storeId/inventory` (section 8) |
| Admin "Restock / Reorder / Rush PO" modal | edits local state | `PATCH /stores/:storeId/inventory/:productId` |
| Admin analytics, knowledge base (`AnalyticsSection`, `RagSection`) | mock | no endpoints yet |
| Login / register / profile | do not exist | section 3 and section 7 |

## 5. Catalogue, search and product detail

`GET /products` query parameters (all optional, all combinable):

| Param | Meaning |
|---|---|
| `q` | free-text search, e.g. `laptop for java development` |
| `categorySlug` or `categoryId` | a parent category includes its sub-categories |
| `brandId` | comma-separated, e.g. `B01,B06` |
| `minPrice`, `maxPrice`, `minRating` | numbers |
| `storeId` | adds `storeStock` for that store to every product |
| `inStockOnly=true` | in stock at `storeId` if given, otherwise anywhere |
| `sort` | `relevance`, `price_asc`, `price_desc`, `rating_desc`, `name_asc`, `newest` |
| `page`, `size` | 1-based; `size` up to 100 |

Facets for the filter panel: `GET /categories?tree=true` (parents with `children`, each with
`slug` and `productCount`) and `GET /brands` (`id`, `name`, `productCount`).

Keep the filters in the URL (`/?q=tv&brand=B01&sort=price_asc&page=2`) and build the API query
from it, so a filtered view can be shared and survives a reload.

One product in the list:

```jsonc
{
  "id": "P203", "name": "MacBook Air 13 M3 (8 GB, 256 GB)",
  "description": "...", "price": 99900, "mrp": 114900, "discountPercent": 13, "currency": "INR",
  "rating": 4.8, "ratingCount": 1620, "warrantyMonths": 12,
  "specifications": { "ram": "8 GB unified", "storage": "256 GB SSD" },
  "images": ["https://...", "https://...", "https://..."],
  "brand": { "id": "B02", "name": "Apple" },
  "category": { "id": "C0102", "name": "Laptops", "parentId": "C01", "parentName": "Electronics" },
  "stock": { "totalAvailable": 428, "storesWithStock": 9, "availability": "IN_STOCK" },
  // only when storeId was sent:
  "storeStock": { "storeId": "ST-DEL-01", "quantityAvailable": 4, "availability": "LOW_STOCK" }
}
```

Mapping from the storefront's mock product:

| Mock field | API field |
|---|---|
| `id: 1` (number) | `id: "P203"` (string) |
| `price: 79.99`, shown with `$` | `price: 99900` in INR; format with `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })` |
| `category: 'Electronics'` | `category.name` (and `category.parentName`) |
| `image` | `images[0]` |
| `badge: 'Bestseller'` | not provided; derive one, e.g. `discountPercent` → "13% off" |
| `rating` | `rating`, plus `ratingCount` |

**Product detail:** `GET /products/:id` returns the product plus `availabilityByStore[]` and
`relatedProducts[]`.

**Store picker and live availability:**

- `GET /stores?size=100` lists stores; show the ones with `type: "STORE"` (the two
  `WAREHOUSE` entries are not pickup locations). `GET /stores/cities` groups them by city.
- Save the choice with `PATCH /auth/me { "preferredStoreId": "ST-MUM-01" }` for a logged-in
  customer (use `localStorage` for guests), then re-request products with the new `storeId`.
- Availability is one of `IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`.
- **Nearby-store fallback:** when the chosen store is out of stock, call
  `GET /products/:id/availability?nearStoreId=<chosen store>`. The rows come back
  nearest-first, each with `distanceKm`; offer the first ones with `quantityAvailable > 0`.

```jsonc
[ { "storeId": "ST-DEL-01", "storeName": "NovaMart Connaught Place", "city": "New Delhi",
    "storeType": "STORE", "quantityAvailable": 0, "availability": "OUT_OF_STOCK", "distanceKm": 0 },
  { "storeId": "ST-DEL-02", "storeName": "NovaMart Rohini", "city": "New Delhi",
    "storeType": "STORE", "quantityAvailable": 37, "availability": "IN_STOCK", "distanceKm": 15.1 } ]
```

## 6. Cart

All cart calls need a logged-in user; send guests to login first. The cart is stored on the
server, one per user, so it survives reloads and new sessions. **Every call returns the whole
cart** — replace local state with the response and never compute totals in the browser.

| Call | Body |
|---|---|
| `GET /cart` | |
| `POST /cart/items` | `{ productId, quantity? }` — adds, or increments an existing line |
| `PATCH /cart/items/:productId` | `{ quantity }` (1 to 10) |
| `DELETE /cart/items/:productId` | |
| `DELETE /cart` | empties it |

```jsonc
{
  "store": { "id": "ST-DEL-01", "name": "NovaMart Connaught Place", "city": "New Delhi" },
  "items": [ { "productId": "P201", "name": "XPS 14 Developer Edition (i7, 32 GB, 1 TB)",
               "brandName": "Dell", "image": "https://...", "quantity": 1,
               "unitPrice": 164990, "mrp": 179990, "lineTotal": 164990, "priceChanged": false,
               "availability": { "storeId": "ST-DEL-01", "quantityAvailable": 3,
                                 "status": "LOW_STOCK", "sufficient": true } } ],
  "summary": { "itemCount": 1, "subtotal": 164990, "mrpTotal": 179990, "productSavings": 15000,
               "delivery": { "standard": { "fee": 0, "baseFee": 49, "free": true, "tierPerk": "PLATINUM", "amountToFree": null },
                             "express":  { "fee": 0, "baseFee": 149, "free": true, "tierPerk": "PLATINUM", "amountToFree": null } },
               "total": 164990, "currency": "INR" },
  "membership": { "tier": "PLATINUM", "rewardPointsEarned": 8245, "rewardPointsValue": 2061.25,
                  "returnWindowDays": 15,
                  "perks": ["Free standard delivery on every order", "Free express delivery on every order",
                            "5 reward points per ₹100 spent", "15-day return window"] },
  "issues": [ { "productId": "P601", "code": "OUT_OF_STOCK", "message": "... is out of stock at ..." } ]
}
```

- Cart badge: `summary.itemCount`.
- Tier benefits to surface: `membership.perks`, and `delivery.*.tierPerk` (set when a fee was
  waived because of the tier). `amountToFree` is how much more to add for free delivery.
- `issues` lists lines that are out of stock or short at the customer's preferred store.
- `summary.total` assumes standard delivery. Checkout is `POST /orders` (section 11).
- Errors: unknown product `404`; quantity outside 1–10 `422`; more than 10 of one product
  in total `400`.

## 7. Profile and preferences

`PATCH /auth/me` accepts any of:

```jsonc
{ "fullName": "Ishaan Gupta", "phone": "+91-99100-10001", "city": "New Delhi",
  "preferredStoreId": "ST-DEL-01",
  "preferences": { "categories": ["C0102", "C0101"], "brands": ["B03", "B02"], "budgetMax": 180000 } }
```

`preferences` is merged key by key, so send only the keys that changed; a list you send
replaces the stored list. An unknown `preferredStoreId` returns `400`. `membershipTier` is
read-only for customers.

## 8. Inventory (manager and admin screens)

`GET /stores/:storeId/inventory` — params `q`, `categoryId`, `brandId`,
`status` (`IN_STOCK` / `LOW_STOCK` / `OUT_OF_STOCK`),
`sort` (`name_asc`, `quantity_asc`, `quantity_desc`, `shortfall_desc`), `page`, `size`.

```jsonc
{ "storeId": "ST-DEL-01",
  "product": { "id": "P701", "name": "1.5 Ton 5 Star Inverter Split AC", "price": 38990,
               "brandName": "Voltas", "categoryId": "C0203", "categoryName": "Air Conditioners", "image": "https://..." },
  "quantityAvailable": 4, "quantityReserved": 1, "reorderLevel": 5,
  "availability": "LOW_STOCK", "needsReplenishment": true, "updatedAt": "2026-10-10T06:51:42.008Z" }
```

Mapping from the mock rows in `InventorySection.jsx`:

| Mock field | API field |
|---|---|
| `id`, `sku: 'SKU-88421'` | `product.id` (there is no separate SKU) |
| `name`, `category`, `price` | `product.name`, `product.categoryName`, `product.price` (INR) |
| `storeId: 'STR-104'`, `location` | `storeId` (e.g. `ST-DEL-01`); name and city from `GET /stores` |
| `units` | `quantityAvailable` |
| `status: 'in-stock' / 'low-stock' / 'out-of-stock'` | `availability: IN_STOCK / LOW_STOCK / OUT_OF_STOCK` |
| `fillPct`, `maxLimit`, `limitText` | not provided; derive from `quantityAvailable` and `reorderLevel` |
| "1,428 products", pages 1…238 | `meta.totalItems`, `meta.totalPages` |

The table is per store. For the admin's "All Stores" view, either pick a store or use the
cross-store feed below.

**Changing stock** — `PATCH /stores/:storeId/inventory/:productId` with
`{ "delta": 50, "reason": "Restock" }` (relative) or `{ "quantityAvailable": 120 }` (absolute),
optionally `reorderLevel`. Stock cannot go negative (`400`). A STORE_MANAGER may only change
their own store (`403` otherwise); ADMIN may change any.

**Stock history** — `GET /stores/:storeId/inventory/movements?productId=&type=` (that store's
manager or ADMIN). Rows: `type` (`RESTOCK`, `SALE`, `RETURN`, `ADJUSTMENT`), `quantityDelta`,
`quantityAfter`, `reason`, `referenceType` / `referenceId` (the order, for sales and returns),
`createdBy`, `createdAt`.

**Low-stock feeds** (rows: `storeId`, `storeName`, `productId`, `productName`, `categoryName`,
`quantityAvailable`, `reorderLevel`, `shortfall`):

- `GET /stores/:storeId/inventory/low-stock` — STORE_MANAGER (own store) or ADMIN
- `GET /inventory/low-stock` — ADMIN, all stores

## 9. Access rules: login first, admin PCs without a login

- **Customers and store managers** must sign in. With no session, send the visitor to the
  login page; after login route by `user.role` (section 3).
- **The admin portal has no login.** Admin PCs are locked down physically, so `/admin` calls
  `POST /auth/admin-device` (no body, no credentials) when it loads and uses the returned
  `{ user, token, refreshToken }` for every admin call.
  - The backend only answers `200` for client addresses in `ADMIN_TRUSTED_IPS`
    (`backend/.env`, default `127.0.0.1,::1`). Any other machine gets `403`.
  - It also answers `403` if the request carries a customer's or store manager's token, so
    send the signed-in user's `Authorization` header with this call when there is one.
  - On `403`, do not render the admin portal: redirect to the user's own page or to login.
  - Keep the admin session separate from the shopper session (for example in memory rather
    than the same `localStorage` key) so opening `/admin` never signs a customer out.
- Every admin endpoint below also checks the ADMIN role on the server, so a normal user who
  reaches the admin screens some other way still cannot read or change anything through them.

## 10. Admin: managing products and stores

All ADMIN only (`401` without a token, `403` for other roles).

| Call | Body |
|---|---|
| `GET /products?includeInactive=true` | lists retired products too (ignored unless ADMIN) |
| `POST /products` | `{ name, categoryId, brandId, price, id?, mrp?, description?, keywords?, specifications?, images?, warrantyMonths?, isActive? }` |
| `PATCH /products/:productId` | any subset of the fields above except `id` |
| `DELETE /products/:productId` | retires it (`isActive: false`); it leaves the storefront but is not erased |
| `GET /stores?activeOnly=false&size=100` | includes closed stores |
| `POST /stores` | `{ id, name, city, type?, addressLine?, state?, country?, postalCode?, latitude?, longitude?, phone?, opensAt?, closesAt?, isActive? }` |
| `PATCH /stores/:storeId` | any subset of the fields above except `id` |
| `DELETE /stores/:storeId` | closes it (`isActive: false`); it leaves the store picker |

- `id` for a store looks like `ST-PUN-01`; for a product it is generated when omitted.
- `specifications` is a flat object (`{ "ram": "8 GB" }`); `images` is a list of URLs;
  `opensAt` / `closesAt` are `HH:MM`.
- `mrp` must not be below `price` (`422`). A duplicate `id` is `409`; an unknown
  `categoryId` or `brandId` is `400`.
- To bring a retired product or closed store back: `PATCH` with `{ "isActive": true }`.
- `GET /products/:productId` includes `keywords` for the edit form.

## 11. Checkout and orders

| Call | Who | Notes |
|---|---|---|
| `POST /orders` | logged-in customer | checks out the cart; returns the order (`201`) |
| `GET /orders?status=&page=&size=` | logged-in customer | own history, newest first |
| `GET /orders/:orderRef` | owner, that store's manager, ADMIN | `orderRef` = `id` or `orderNumber` |
| `POST /orders/:orderRef/cancel` | owner | only while `cancellableByCustomer` is true |
| `GET /stores/:storeId/orders?status=` | that store's manager, ADMIN | the fulfilment queue |
| `PATCH /orders/:orderRef/status` | that store's manager, ADMIN | body `{ status }`, one of the order's `nextStatuses` |

Checkout body:

```jsonc
// pickup (storeId defaults to the customer's preferred store)
{ "fulfillment": "IN_STORE_PICKUP", "storeId": "ST-DEL-01", "paymentMethod": "UPI" }

// delivery
{ "fulfillment": "HOME_DELIVERY", "deliverySpeed": "EXPRESS",
  "shippingAddress": { "line": "12 MG Road", "city": "New Delhi", "postalCode": "110001" },
  "paymentMethod": "CASH_ON_DELIVERY" }
```

`paymentMethod` is `CARD`, `UPI`, `NET_BANKING` or `CASH_ON_DELIVERY`; payment is simulated.
Add `"simulatePaymentFailure": true` to demo a declined payment (`402 PAYMENT_FAILED`).

The order:

```jsonc
{ "id": "…", "orderNumber": "NM-20261010-A1B2C3", "status": "CONFIRMED",
  "fulfillment": "HOME_DELIVERY", "deliverySpeed": "EXPRESS",
  "store": { "id": "WH-DEL-01", "name": "NovaMart North Warehouse", "city": "New Delhi" },
  "customer": { "id": "…", "name": "Sara Khan", "email": "sara.khan@example.com" },
  "items": [ { "productId": "PA01", "name": "Basmati Rice 5 kg", "image": "https://…",
               "quantity": 1, "unitPrice": 749, "lineTotal": 749 } ],
  "subtotal": 749, "deliveryFee": 149, "total": 898, "currency": "INR",
  "paymentMethod": "CASH_ON_DELIVERY", "paymentStatus": "PAY_ON_DELIVERY",
  "shippingAddress": { "line": "12 MG Road", "city": "New Delhi", "postalCode": "110001" },
  "rewardPointsEarned": 7,
  "nextStatuses": ["PACKED", "CANCELLED"], "cancellableByCustomer": true,
  "placedAt": "2026-10-10T09:00:00.000Z" }
```

- Send an `Idempotency-Key` header with a fresh random value per checkout attempt (reuse
  it when retrying the same attempt). A repeat returns the original order with `200`, so a
  double click or a network retry can never place two orders.
- After a successful checkout the cart is empty; re-fetch `GET /cart` for the badge.
- `409` on checkout means stock is short: `error.details[]` has `productId`, `code`
  (`OUT_OF_STOCK` / `INSUFFICIENT_STOCK`), `available`. The cart is unchanged.
- For the manager screen, render one button per entry in `nextStatuses`.
  Pickup: `CONFIRMED → PACKED → READY_FOR_PICKUP → DELIVERED`.
  Delivery: `CONFIRMED → PACKED → SHIPPED → DELIVERED`.
- Cancelling returns the stock to the store it came from.

## 12. Not available yet

No endpoints exist for AI recommendations, the shopping chat, document
upload or knowledge-base search, analytics, or support tickets. Keep those parts of the UI on
mock data, or hide them, until the modules land.
