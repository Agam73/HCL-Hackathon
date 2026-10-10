#!/usr/bin/env node
/**
 * End-to-end smoke test against a running API. No test framework needed.
 *
 *   npm start          (in one terminal)
 *   npm run smoke      (in another)
 *
 * Checks health, auth, roles, product search/filter/sort/pagination,
 * product detail, stores, inventory-by-store, validation errors and 404s.
 */
const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:8080';
const PREFIX = process.env.API_PREFIX ?? '/api/v1';
const PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? 'Passw0rd!';

let passed = 0;
let failed = 0;

function check(name, condition, extra = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok    ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${name}${extra ? ` -> ${extra}` : ''}`);
  }
}

async function api(method, pathname, { token, body } = {}) {
  const res = await fetch(`${BASE}${pathname.startsWith('/api') ? '' : PREFIX}${pathname}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON response */
  }
  return { status: res.status, body: json };
}

async function main() {
  console.log(`\nRetailPulse AI smoke test -> ${BASE}${PREFIX}\n`);

  // ---- health ----
  const health = await fetch(`${BASE}/health`).then((r) => r.json());
  check('GET /health reports UP', health?.data?.status === 'UP', JSON.stringify(health?.data));

  // ---- auth ----
  const badLogin = await api('POST', '/auth/login', {
    body: { email: 'ishaan.gupta@example.com', password: 'wrong-password' },
  });
  check('login with wrong password -> 401', badLogin.status === 401);

  const badEmail = await api('POST', '/auth/login', { body: { email: 'nope', password: 'x' } });
  check('login with invalid email -> 422 validation error', badEmail.status === 422
    && badEmail.body?.error?.code === 'VALIDATION_ERROR');

  const customer = await api('POST', '/auth/login', {
    body: { email: 'ishaan.gupta@example.com', password: PASSWORD },
  });
  check('customer login -> token', customer.status === 200 && !!customer.body?.data?.token);
  check('customer role is CUSTOMER', customer.body?.data?.user?.role === 'CUSTOMER');
  const customerToken = customer.body?.data?.token;

  const manager = await api('POST', '/auth/login', {
    body: { email: 'manager.del01@novamart.com', password: PASSWORD },
  });
  check('store manager login -> token', manager.status === 200 && !!manager.body?.data?.token);
  const managerToken = manager.body?.data?.token;

  const admin = await api('POST', '/auth/login', {
    body: { email: 'admin@novamart.com', password: PASSWORD },
  });
  const adminToken = admin.body?.data?.token;
  check('admin login -> token', admin.status === 200 && !!adminToken);

  const me = await api('GET', '/auth/me', { token: customerToken });
  check('GET /auth/me returns the logged-in user', me.body?.data?.email === 'ishaan.gupta@example.com');

  const noToken = await api('GET', '/auth/me');
  check('GET /auth/me without token -> 401', noToken.status === 401);

  const forbidden = await api('POST', '/auth/staff', {
    token: customerToken,
    body: { email: 'x@y.com', password: 'Passw0rd!', fullName: 'Test User', role: 'ADMIN' },
  });
  check('customer cannot create staff -> 403', forbidden.status === 403);

  // ---- catalog ----
  const list = await api('GET', '/products?page=1&size=5');
  check('GET /products paginates', list.status === 200
    && list.body?.data?.length === 5
    && list.body?.meta?.totalItems > 5, JSON.stringify(list.body?.meta));

  const page2 = await api('GET', '/products?page=2&size=5');
  check('page 2 returns different products',
    page2.body?.data?.[0]?.id !== list.body?.data?.[0]?.id);

  const search = await api('GET', '/products?q=laptop%20for%20java%20development');
  check('search finds laptops', search.body?.data?.length > 0
    && search.body.data.some((p) => p.category.name === 'Laptops'),
    JSON.stringify(search.body?.data?.map((p) => p.name)));

  const sorted = await api('GET', '/products?sort=price_asc&size=10');
  const prices = (sorted.body?.data ?? []).map((p) => p.price);
  check('sort=price_asc is ascending',
    prices.every((p, i) => i === 0 || prices[i - 1] <= p), prices.join(','));

  const filtered = await api('GET', '/products?categorySlug=electronics&minPrice=20000&maxPrice=80000');
  check('category + price filter works', filtered.body?.data?.length > 0
    && filtered.body.data.every((p) => p.price >= 20000 && p.price <= 80000));

  const subcat = await api('GET', '/products?categorySlug=electronics');
  check('parent category includes sub-category products',
    subcat.body?.data?.some((p) => p.category.name === 'Mobiles'));

  const badSort = await api('GET', '/products?sort=cheapest');
  check('unknown sort value -> 422', badSort.status === 422);

  const badRange = await api('GET', '/products?minPrice=500&maxPrice=100');
  check('minPrice > maxPrice -> 422', badRange.status === 422);

  const detail = await api('GET', '/products/P101');
  check('GET /products/P101 has availability + related',
    detail.status === 200
    && detail.body?.data?.id === 'P101'
    && Array.isArray(detail.body?.data?.availabilityByStore)
    && detail.body.data.availabilityByStore.length > 0
    && Array.isArray(detail.body?.data?.relatedProducts));

  const missing = await api('GET', '/products/DOES-NOT-EXIST');
  check('unknown product -> 404 NOT_FOUND',
    missing.status === 404 && missing.body?.error?.code === 'NOT_FOUND');

  const categories = await api('GET', '/categories?tree=true');
  check('GET /categories?tree=true nests children',
    categories.body?.data?.some((c) => (c.children ?? []).length > 0));

  const brands = await api('GET', '/brands');
  check('GET /brands returns brands with counts', brands.body?.data?.length > 0
    && typeof brands.body.data[0].productCount === 'number');

  // ---- stores ----
  const stores = await api('GET', '/stores?size=50');
  check('GET /stores returns stores', stores.body?.data?.length > 0);

  const byCity = await api('GET', '/stores?city=Mumbai');
  check('store city filter works', byCity.body?.data?.length > 0
    && byCity.body.data.every((s) => s.address.city === 'Mumbai'));

  const cities = await api('GET', '/stores/cities');
  check('GET /stores/cities returns the picker list', cities.body?.data?.length > 0);

  const store = await api('GET', '/stores/ST-DEL-01');
  check('GET /stores/ST-DEL-01 returns one store', store.body?.data?.id === 'ST-DEL-01');

  const badStore = await api('GET', '/stores/NOPE');
  check('unknown store -> 404', badStore.status === 404);

  // ---- inventory ----
  const inv = await api('GET', '/stores/ST-DEL-01/inventory?size=5');
  check('GET /stores/:id/inventory paginates', inv.body?.data?.length === 5
    && inv.body?.meta?.totalItems > 5);
  check('inventory rows carry an availability status',
    ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'].includes(inv.body?.data?.[0]?.availability));

  const oneRow = await api('GET', '/stores/ST-DEL-01/inventory/P101');
  check('GET inventory for one product', oneRow.body?.data?.product?.id === 'P101');

  const unauthPatch = await api('PATCH', '/stores/ST-DEL-01/inventory/P101', {
    body: { quantityAvailable: 5 },
  });
  check('PATCH inventory without token -> 401', unauthPatch.status === 401);

  const customerPatch = await api('PATCH', '/stores/ST-DEL-01/inventory/P101', {
    token: customerToken,
    body: { quantityAvailable: 5 },
  });
  check('customer cannot PATCH inventory -> 403', customerPatch.status === 403);

  const wrongStore = await api('PATCH', '/stores/ST-MUM-01/inventory/P101', {
    token: managerToken,
    body: { quantityAvailable: 5 },
  });
  check('manager cannot PATCH another store -> 403', wrongStore.status === 403);

  const before = oneRow.body?.data?.quantityAvailable ?? 0;
  const patched = await api('PATCH', '/stores/ST-DEL-01/inventory/P101', {
    token: managerToken,
    body: { quantityAvailable: before + 7, reason: 'smoke test' },
  });
  check('manager can PATCH own store inventory',
    patched.status === 200 && patched.body?.data?.quantityAvailable === before + 7,
    JSON.stringify(patched.body));

  const delta = await api('PATCH', '/stores/ST-DEL-01/inventory/P101', {
    token: managerToken,
    body: { delta: -7, reason: 'smoke test revert' },
  });
  check('delta adjustment works and restores the original quantity',
    delta.body?.data?.quantityAvailable === before);

  const negative = await api('PATCH', '/stores/ST-DEL-01/inventory/P101', {
    token: managerToken,
    body: { delta: -999999 },
  });
  check('stock cannot go negative -> 400', negative.status === 400);

  const emptyPatch = await api('PATCH', '/stores/ST-DEL-01/inventory/P101', {
    token: managerToken,
    body: {},
  });
  check('empty PATCH body -> 422', emptyPatch.status === 422);

  const lowStock = await api('GET', '/inventory/low-stock?size=5', { token: adminToken });
  check('admin sees cross-store low stock feed', lowStock.status === 200
    && Array.isArray(lowStock.body?.data));

  const managerLowStock = await api('GET', '/stores/ST-DEL-01/inventory/low-stock', {
    token: managerToken,
  });
  check('manager sees own store low stock feed', managerLowStock.status === 200);

  // ---- availability ----
  const availability = await api('GET', '/products/P101/availability?inStockOnly=true');
  check('GET /products/:id/availability filters to in-stock stores',
    availability.status === 200
    && availability.body.data.every((a) => a.quantityAvailable > 0));

  // ---- error envelope ----
  const unknownRoute = await api('GET', '/nope/nope');
  check('unknown route -> 404 ROUTE_NOT_FOUND with traceId',
    unknownRoute.status === 404
    && unknownRoute.body?.error?.code === 'ROUTE_NOT_FOUND'
    && !!unknownRoute.body?.traceId);

  const badJson = await fetch(`${BASE}${PREFIX}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{not json',
  });
  check('malformed JSON body -> 400', badJson.status === 400);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\nsmoke test could not run:', err.message);
  console.error('Is the API running?  npm start');
  process.exit(1);
});
