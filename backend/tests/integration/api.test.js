/**
 * Integration tests: the real Express app against a migrated + seeded database
 * (the same one `npm run dev` uses locally, a Postgres service container in CI).
 *
 * Everything that writes does so as a throwaway customer registered here and
 * deleted in afterAll, so seeded users and their carts are never touched.
 */
import request from 'supertest';
import { createApp } from '../../src/app.js';
import env from '../../src/config/env.js';
import { pool, closePool } from '../../src/db/pool.js';

const api = request(createApp());
const url = (p) => `${env.apiPrefix}${p}`;
const PASSWORD = env.seedDefaultPassword;

const testEmail = `jest.${Date.now()}@example.test`;
let session; // { user, token, refreshToken } of the throwaway customer

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const login = async (email) =>
  (await api.post(url('/auth/login')).send({ email, password: PASSWORD })).body.data;

beforeAll(async () => {
  const res = await api.post(url('/auth/register')).send({
    email: testEmail,
    password: 'Sup3rSecret!',
    fullName: 'Jest Runner',
    preferredStoreId: 'ST-DEL-01',
    membershipTier: 'PLATINUM', // must be ignored - see the test below
  });
  expect(res.status).toBe(201);
  session = res.body.data;
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email = $1', [testEmail]);
  await closePool();
});

describe('auth and refresh tokens', () => {
  test('register returns an access token and a refresh token', () => {
    expect(session.token).toEqual(expect.any(String));
    expect(session.refreshToken).toEqual(expect.any(String));
    expect(session.user).toMatchObject({ email: testEmail, role: 'CUSTOMER' });
    expect(session.user.passwordHash).toBeUndefined();
  });

  test('self-signup cannot pick a membership tier', () => {
    expect(session.user.membershipTier).toBe('STANDARD');
  });

  test('refresh rotates the token: the new one works, the old one does not', async () => {
    const old = session.refreshToken;
    const res = await api.post(url('/auth/refresh')).send({ refreshToken: old });
    expect(res.status).toBe(200);
    expect(res.body.data.refreshToken).not.toBe(old);
    session = res.body.data;

    const me = await api.get(url('/auth/me')).set(auth(session.token));
    expect(me.body.data.email).toBe(testEmail);

    const replay = await api.post(url('/auth/refresh')).send({ refreshToken: old });
    expect(replay.status).toBe(401);
  });

  test('logout revokes the refresh token', async () => {
    const extra = await api
      .post(url('/auth/login'))
      .send({ email: testEmail, password: 'Sup3rSecret!' });
    const { refreshToken } = extra.body.data;

    expect((await api.post(url('/auth/logout')).send({ refreshToken })).status).toBe(204);
    expect((await api.post(url('/auth/refresh')).send({ refreshToken })).status).toBe(401);
  });

  test('a garbage refresh token is rejected', async () => {
    const res = await api.post(url('/auth/refresh')).send({ refreshToken: 'x'.repeat(40) });
    expect(res.status).toBe(401);
  });
});

describe('role-based access', () => {
  test('a customer cannot change inventory; the store manager can only change their own store', async () => {
    const manager = await login('manager.del01@novamart.com');
    const body = { delta: 0, reorderLevel: 10 };

    const asCustomer = await api
      .patch(url('/stores/ST-DEL-01/inventory/P101'))
      .set(auth(session.token))
      .send(body);
    expect(asCustomer.status).toBe(403);

    const otherStore = await api
      .patch(url('/stores/ST-MUM-01/inventory/P101'))
      .set(auth(manager.token))
      .send(body);
    expect(otherStore.status).toBe(403);
  });

  test('the cross-store low-stock feed is ADMIN only', async () => {
    const admin = await login('admin@novamart.com');
    expect((await api.get(url('/inventory/low-stock')).set(auth(admin.token))).status).toBe(200);
    expect((await api.get(url('/inventory/low-stock')).set(auth(session.token))).status).toBe(403);
    expect((await api.get(url('/inventory/low-stock'))).status).toBe(401);
  });
});

describe('catalogue', () => {
  test('the seed holds roughly 300 products', async () => {
    const res = await api.get(url('/products?size=1'));
    expect(res.body.meta.totalItems).toBeGreaterThanOrEqual(300);
  });

  test('search + brand + price + rating filters and sorting combine', async () => {
    const res = await api.get(
      url(
        '/products?q=laptop&brandId=B03,B04&minPrice=40000&maxPrice=120000&minRating=3.5&sort=price_asc&size=50'
      )
    );
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);

    const prices = res.body.data.map((p) => p.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    for (const p of res.body.data) {
      expect(['B03', 'B04']).toContain(p.brand.id);
      expect(p.price).toBeGreaterThanOrEqual(40000);
      expect(p.price).toBeLessThanOrEqual(120000);
      expect(p.rating).toBeGreaterThanOrEqual(3.5);
    }
  });

  test("scoping to a store adds that store's three-state availability", async () => {
    const res = await api.get(url('/products?storeId=ST-DEL-01&size=100'));
    const states = new Set(res.body.data.map((p) => p.storeStock?.availability));
    expect([...states].every((s) => ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'].includes(s))).toBe(
      true
    );
    expect(states.has('LOW_STOCK')).toBe(true);
  });

  test('inStockOnly at a store hides what that store has run out of', async () => {
    const res = await api.get(url('/products?storeId=ST-DEL-01&inStockOnly=true&size=100'));
    expect(res.body.data.every((p) => p.storeStock.quantityAvailable > 0)).toBe(true);
  });

  test('a filtered, sorted, paginated search answers within 300 ms', async () => {
    const path = url(
      '/products?q=smart%20tv&categorySlug=electronics&minRating=4&sort=price_desc&page=2&size=10&storeId=ST-MUM-01'
    );
    await api.get(path); // warm the pool

    const started = performance.now();
    const res = await api.get(path);
    const elapsed = performance.now() - started;

    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(300);
  });
});

describe('nearby-store fallback', () => {
  test('availability near a store is ordered by distance, starting with the store itself', async () => {
    const res = await api.get(url('/products/P101/availability?nearStoreId=ST-DEL-01'));
    expect(res.status).toBe(200);

    const rows = res.body.data;
    expect(rows[0]).toMatchObject({ storeId: 'ST-DEL-01', distanceKm: 0 });
    const distances = rows.map((r) => r.distanceKm);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
    // Same-city stores come before stores in other cities.
    expect(rows[1].city).toBe('New Delhi');
  });

  test('an unknown nearStoreId is a 404, not an unordered list', async () => {
    const res = await api.get(url('/products/P101/availability?nearStoreId=NOPE'));
    expect(res.status).toBe(404);
  });
});

describe('cart', () => {
  const cart = (method, path = '') => api[method](url(`/cart${path}`)).set(auth(session.token));

  test('requires a login', async () => {
    expect((await api.get(url('/cart'))).status).toBe(401);
  });

  test('starts empty', async () => {
    const res = await cart('get');
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.summary.total).toBe(0);
    expect(res.body.data.store).toMatchObject({ id: 'ST-DEL-01' });
  });

  test('add, add again (increments), update, remove', async () => {
    let res = await cart('post', '/items').send({ productId: 'P101', quantity: 1 });
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);

    res = await cart('post', '/items').send({ productId: 'P101', quantity: 2 });
    expect(res.body.data.items[0].quantity).toBe(3);

    res = await cart('post', '/items').send({ productId: 'PA01' });
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.summary.itemCount).toBe(4);

    res = await cart('patch', '/items/P101').send({ quantity: 1 });
    const p101 = res.body.data.items.find((i) => i.productId === 'P101');
    expect(p101.quantity).toBe(1);
    expect(p101.lineTotal).toBe(p101.unitPrice);
    expect(p101.availability.storeId).toBe('ST-DEL-01');

    res = await cart('delete', '/items/PA01');
    expect(res.body.data.items.map((i) => i.productId)).toEqual(['P101']);
  });

  test('persists across sessions: a fresh login sees the same cart', async () => {
    const again = await api
      .post(url('/auth/login'))
      .send({ email: testEmail, password: 'Sup3rSecret!' });
    const res = await api.get(url('/cart')).set(auth(again.body.data.token));
    expect(res.body.data.items.map((i) => i.productId)).toEqual(['P101']);
  });

  test('rejects unknown products, bad quantities and items that are not in the cart', async () => {
    expect((await cart('post', '/items').send({ productId: 'NOPE' })).status).toBe(404);
    expect((await cart('post', '/items').send({ productId: 'P102', quantity: 0 })).status).toBe(
      422
    );
    expect((await cart('post', '/items').send({ productId: 'P102', quantity: 11 })).status).toBe(
      422
    );
    expect((await cart('post', '/items').send({ productId: 'P101', quantity: 10 })).status).toBe(
      400
    );
    expect((await cart('patch', '/items/P999').send({ quantity: 1 })).status).toBe(404);
    expect((await cart('delete', '/items/P999')).status).toBe(404);
  });

  test('delivery perks follow the membership tier stored on the user, not the request', async () => {
    const standard = (await cart('get')).body.data;
    expect(standard.membership.tier).toBe('STANDARD');
    expect(standard.summary.delivery.express.fee).toBeGreaterThan(0);

    await pool.query(`UPDATE users SET membership_tier = 'GOLD' WHERE email = $1`, [testEmail]);
    const gold = (await cart('get')).body.data;
    expect(gold.membership.tier).toBe('GOLD');
    expect(gold.summary.delivery.express).toMatchObject({ fee: 0, tierPerk: 'GOLD' });
    expect(gold.membership.rewardPointsEarned).toBe(standard.membership.rewardPointsEarned * 3);
  });

  test('clearing empties the cart', async () => {
    const res = await cart('delete');
    expect(res.body.data.items).toEqual([]);
  });
});

describe('preferences', () => {
  test('profile updates merge preferences and persist the chosen store', async () => {
    let res = await api
      .patch(url('/auth/me'))
      .set(auth(session.token))
      .send({ preferences: { brands: ['B03'], budgetMax: 90000 }, city: 'Mumbai' });
    expect(res.status).toBe(200);

    res = await api
      .patch(url('/auth/me'))
      .set(auth(session.token))
      .send({ preferences: { categories: ['C0102'] }, preferredStoreId: 'ST-MUM-01' });
    expect(res.body.data).toMatchObject({
      city: 'Mumbai',
      preferredStoreId: 'ST-MUM-01',
      preferences: { brands: ['B03'], budgetMax: 90000, categories: ['C0102'] },
    });

    // The cart now checks stock at the newly chosen store.
    const cart = await api.get(url('/cart')).set(auth(session.token));
    expect(cart.body.data.store.id).toBe('ST-MUM-01');
  });

  test('an unknown preferred store is rejected', async () => {
    const res = await api
      .patch(url('/auth/me'))
      .set(auth(session.token))
      .send({ preferredStoreId: 'ST-NOPE-99' });
    expect(res.status).toBe(400);
  });
});

describe('CORS', () => {
  test('an origin that is not on the allow-list gets no CORS headers, not a 500', async () => {
    const res = await api.get('/health').set('Origin', 'http://evil.example');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('the frontend origin is allowed', async () => {
    const res = await api.get('/health').set('Origin', env.corsOrigins[0]);
    expect(res.headers['access-control-allow-origin']).toBe(env.corsOrigins[0]);
  });
});

describe('admin PC session (no login)', () => {
  test('a trusted address gets an ADMIN session without credentials', async () => {
    const res = await api.post(url('/auth/admin-device'));
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('ADMIN');
    expect(res.body.data.token).toEqual(expect.any(String));
  });

  test('an untrusted address is refused', async () => {
    const trusted = env.adminTrustedIps;
    env.adminTrustedIps = ['10.9.8.7'];
    try {
      expect((await api.post(url('/auth/admin-device'))).status).toBe(403);
    } finally {
      env.adminTrustedIps = trusted;
    }
  });

  test('a signed-in customer or manager cannot become an admin, even on a trusted address', async () => {
    const manager = await login('manager.del01@novamart.com');
    for (const token of [session.token, manager.token]) {
      const res = await api.post(url('/auth/admin-device')).set(auth(token));
      expect(res.status).toBe(403);
    }
  });

  test('a forged X-Forwarded-For header does not make an address trusted', async () => {
    const trusted = env.adminTrustedIps;
    env.adminTrustedIps = ['10.9.8.7'];
    try {
      const res = await api.post(url('/auth/admin-device')).set('X-Forwarded-For', '10.9.8.7');
      expect(res.status).toBe(403);
    } finally {
      env.adminTrustedIps = trusted;
    }
  });
});

describe('admin manages products and stores', () => {
  const productId = `T${Date.now().toString(36)}`.toUpperCase();
  const storeId = `ST-TEST-${Date.now().toString(36)}`.toUpperCase();
  let admin;

  beforeAll(async () => {
    admin = (await api.post(url('/auth/admin-device'))).body.data;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM products WHERE id = $1', [productId]);
    await pool.query('DELETE FROM stores WHERE id = $1', [storeId]);
  });

  test('customers and managers cannot create, edit or retire products and stores', async () => {
    const manager = await login('manager.del01@novamart.com');
    for (const token of [session.token, manager.token]) {
      expect((await api.post(url('/products')).set(auth(token)).send({})).status).toBe(403);
      expect(
        (await api.patch(url('/products/P101')).set(auth(token)).send({ price: 1 })).status
      ).toBe(403);
      expect((await api.delete(url('/products/P101')).set(auth(token))).status).toBe(403);
      expect((await api.post(url('/stores')).set(auth(token)).send({})).status).toBe(403);
      expect(
        (await api.patch(url('/stores/ST-DEL-01')).set(auth(token)).send({ name: 'x' })).status
      ).toBe(403);
      expect((await api.delete(url('/stores/ST-DEL-01')).set(auth(token))).status).toBe(403);
    }
    expect((await api.patch(url('/products/P101')).send({ price: 1 })).status).toBe(401);
  });

  test('create, edit and retire a product', async () => {
    let res = await api
      .post(url('/products'))
      .set(auth(admin.token))
      .send({
        id: productId,
        name: 'Jest Test Blender',
        categoryId: 'C0204',
        brandId: 'B12',
        price: 1999,
        mrp: 2499,
        keywords: 'blender,test',
        specifications: { power: '500 W' },
      });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      id: productId,
      price: 1999,
      isActive: true,
      keywords: 'blender,test',
    });

    // It is on the storefront and searchable straight away.
    res = await api.get(url('/products?q=Jest%20Test%20Blender'));
    expect(res.body.data.map((p) => p.id)).toContain(productId);

    res = await api
      .patch(url(`/products/${productId}`))
      .set(auth(admin.token))
      .send({ price: 1799, name: 'Jest Test Blender Pro' });
    expect(res.body.data).toMatchObject({ price: 1799, mrp: 2499, name: 'Jest Test Blender Pro' });

    // Raising the price above the existing MRP is rejected.
    res = await api
      .patch(url(`/products/${productId}`))
      .set(auth(admin.token))
      .send({ price: 3000 });
    expect(res.status).toBe(422);

    res = await api.delete(url(`/products/${productId}`)).set(auth(admin.token));
    expect(res.body.data.isActive).toBe(false);

    // Retired: gone for shoppers, still listed for the admin, and cannot be added to a cart.
    const q = '/products?q=Jest%20Test%20Blender';
    expect((await api.get(url(q))).body.data.map((p) => p.id)).not.toContain(productId);
    expect(
      (await api.get(url(`${q}&includeInactive=true`))).body.data.map((p) => p.id)
    ).not.toContain(productId);
    const asAdmin = await api.get(url(`${q}&includeInactive=true`)).set(auth(admin.token));
    expect(asAdmin.body.data.map((p) => p.id)).toContain(productId);
    const add = await api.post(url('/cart/items')).set(auth(session.token)).send({ productId });
    expect(add.status).toBe(404);
  });

  test('product validation: duplicate id, unknown category, mrp below price', async () => {
    const base = { name: 'Bad Product', categoryId: 'C0204', brandId: 'B12', price: 100 };
    const post = (body) => api.post(url('/products')).set(auth(admin.token)).send(body);
    expect((await post({ ...base, id: 'P101' })).status).toBe(409);
    expect((await post({ ...base, categoryId: 'NOPE' })).status).toBe(400);
    expect((await post({ ...base, mrp: 50 })).status).toBe(422);
    expect((await post({ name: 'x' })).status).toBe(422);
  });

  test('create, edit and close a store', async () => {
    let res = await api.post(url('/stores')).set(auth(admin.token)).send({
      id: storeId,
      name: 'NovaMart Test Store',
      city: 'Pune',
      state: 'Maharashtra',
      latitude: 18.52,
      longitude: 73.85,
      opensAt: '10:00',
      closesAt: '22:00',
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ id: storeId, type: 'STORE', isActive: true });
    expect(res.body.data.address.city).toBe('Pune');

    res = await api
      .patch(url(`/stores/${storeId}`))
      .set(auth(admin.token))
      .send({ name: 'NovaMart Pune', phone: '+91-20-0000-0000' });
    expect(res.body.data).toMatchObject({ name: 'NovaMart Pune', phone: '+91-20-0000-0000' });

    expect(
      (
        await api
          .post(url('/stores'))
          .set(auth(admin.token))
          .send({ id: storeId, name: 'Dup', city: 'Pune' })
      ).status
    ).toBe(409);
    expect(
      (
        await api
          .patch(url(`/stores/${storeId}`))
          .set(auth(admin.token))
          .send({ opensAt: '25:00' })
      ).status
    ).toBe(422);
    expect(
      (await api.patch(url('/stores/NOPE')).set(auth(admin.token)).send({ name: 'Nobody' })).status
    ).toBe(404);

    res = await api.delete(url(`/stores/${storeId}`)).set(auth(admin.token));
    expect(res.body.data.isActive).toBe(false);

    // Closed stores leave the default list (the store picker) but stay visible on request.
    const ids = async (qs) =>
      (await api.get(url(`/stores?size=100${qs}`))).body.data.map((s) => s.id);
    expect(await ids('')).not.toContain(storeId);
    expect(await ids('&activeOnly=false')).toContain(storeId);
  });
});
