/**
 * Schema extras (migration 007): the stock ledger, idempotent checkout,
 * the product_images view, the SUPPORT_AGENT role and the ticket thread.
 */
import {
  api,
  url,
  auth,
  login,
  pool,
  registerCustomer,
  deleteCustomer,
  createTestProduct,
  deleteTestProduct,
  stockOf,
} from '../helpers.js';
import { closePool } from '../../src/db/pool.js';

const run = Date.now().toString(36).toUpperCase();
const ITEM = `JX${run}`;
const AGENT_EMAIL = `jest.agent.${Date.now()}@example.test`;

let customer;
let delManager;
let mumManager;
let admin;

const as = (who) => auth(who.token);
const ledger = async (who, query = '') =>
  api.get(url(`/stores/ST-DEL-01/inventory/movements?productId=${ITEM}${query}`)).set(as(who));

beforeAll(async () => {
  await createTestProduct(ITEM, { price: 500, stock: { 'ST-DEL-01': 10 } });
  await pool.query(
    `UPDATE products SET images = ARRAY['https://img.test/a.png', 'https://img.test/b.png'] WHERE id = $1`,
    [ITEM]
  );
  customer = await registerCustomer('extras', { preferredStoreId: 'ST-DEL-01' });
  delManager = await login('manager.del01@novamart.com');
  mumManager = await login('manager.mum01@novamart.com');
  admin = await login('admin@novamart.com');
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email = $1', [AGENT_EMAIL]);
  await deleteCustomer(customer.email);
  await deleteTestProduct(ITEM);
  await pool.query(`DELETE FROM agent_actions WHERE input->>'productId' = $1`, [ITEM]);
  await closePool();
});

describe('stock ledger', () => {
  test('a manual restock and a downward correction are both recorded with the balance after', async () => {
    const patch = (body) =>
      api
        .patch(url(`/stores/ST-DEL-01/inventory/${ITEM}`))
        .set(as(delManager))
        .send(body);

    await patch({ delta: 5, reason: 'Supplier delivery' }); // 10 -> 15
    await patch({ quantityAvailable: 12, reason: 'Cycle count' }); // 15 -> 12
    await patch({ reorderLevel: 4 }); // quantity unchanged: no ledger row

    const res = await ledger(delManager);
    expect(res.status).toBe(200);
    expect(res.body.meta.totalItems).toBe(2);
    const [latest, first] = res.body.data;
    expect(first).toMatchObject({
      type: 'RESTOCK',
      quantityDelta: 5,
      quantityAfter: 15,
      reason: 'Supplier delivery',
    });
    expect(latest).toMatchObject({
      type: 'ADJUSTMENT',
      quantityDelta: -3,
      quantityAfter: 12,
      reason: 'Cycle count',
    });
    expect(latest.createdBy.name).toBe(delManager.user.fullName);
  });

  test('a sale and its cancellation appear as SALE and RETURN linked to the order', async () => {
    await api.post(url('/cart/items')).set(as(customer)).send({ productId: ITEM, quantity: 2 });
    const order = (
      await api.post(url('/orders')).set(as(customer)).send({ fulfillment: 'IN_STORE_PICKUP' })
    ).body.data;
    expect(await stockOf('ST-DEL-01', ITEM)).toBe(10);

    let rows = (await ledger(delManager, '&type=SALE')).body.data;
    expect(rows).toEqual([
      expect.objectContaining({
        type: 'SALE',
        quantityDelta: -2,
        quantityAfter: 10,
        referenceType: 'ORDER',
        referenceId: order.id,
      }),
    ]);

    await api.post(url(`/orders/${order.id}/cancel`)).set(as(customer));
    rows = (await ledger(delManager, '&type=RETURN')).body.data;
    expect(rows).toEqual([
      expect.objectContaining({
        type: 'RETURN',
        quantityDelta: 2,
        quantityAfter: 12,
        referenceId: order.id,
      }),
    ]);
  });

  test('the ledger always adds up to the current stock', async () => {
    const { rows } = await pool.query(
      'SELECT COALESCE(SUM(quantity_delta), 0)::int AS net FROM inventory_movements WHERE store_id = $1 AND product_id = $2',
      ['ST-DEL-01', ITEM]
    );
    // Started at 10 (seeded directly, before any ledger row).
    expect(10 + rows[0].net).toBe(await stockOf('ST-DEL-01', ITEM));
  });

  test('only that store’s manager or an admin can read it', async () => {
    expect((await ledger(admin)).status).toBe(200);
    expect((await ledger(mumManager)).status).toBe(403);
    expect((await ledger(customer)).status).toBe(403);
    expect((await api.get(url('/stores/ST-DEL-01/inventory/movements'))).status).toBe(401);
    expect((await ledger(delManager, '&type=THEFT')).status).toBe(422);
  });
});

describe('idempotent checkout', () => {
  const key = `jest-key-${run}`;
  const checkout = (headers = {}, body = {}) =>
    api
      .post(url('/orders'))
      .set(as(customer))
      .set(headers)
      .send({ fulfillment: 'IN_STORE_PICKUP', ...body });

  test('the same Idempotency-Key returns the first order and takes stock only once', async () => {
    await api.post(url('/cart/items')).set(as(customer)).send({ productId: ITEM, quantity: 1 });
    const before = await stockOf('ST-DEL-01', ITEM);

    const first = await checkout({ 'Idempotency-Key': key });
    expect(first.status).toBe(201);

    // Retry of the same request (the cart is already empty by now).
    const retry = await checkout({ 'Idempotency-Key': key });
    expect(retry.status).toBe(200);
    expect(retry.body.data.id).toBe(first.body.data.id);

    // The key works in the body too.
    const viaBody = await checkout({}, { idempotencyKey: key });
    expect(viaBody.body.data.id).toBe(first.body.data.id);

    expect(await stockOf('ST-DEL-01', ITEM)).toBe(before - 1);
    expect(first.body.data.tax).toBe(0);
  });

  test('two identical requests sent at once produce one order', async () => {
    await api.post(url('/cart/items')).set(as(customer)).send({ productId: ITEM, quantity: 1 });
    const before = await stockOf('ST-DEL-01', ITEM);
    const headers = { 'Idempotency-Key': `${key}-race` };

    const results = await Promise.all([checkout(headers), checkout(headers), checkout(headers)]);
    const ids = new Set(results.map((r) => r.body.data?.id));

    expect(results.every((r) => [200, 201].includes(r.status))).toBe(true);
    expect(ids.size).toBe(1);
    expect(await stockOf('ST-DEL-01', ITEM)).toBe(before - 1);
  });

  test('a different customer can reuse the same key without seeing that order', async () => {
    const other = await registerCustomer('extras-other', { preferredStoreId: 'ST-DEL-01' });
    try {
      const res = await api
        .post(url('/orders'))
        .set(as(other))
        .set({ 'Idempotency-Key': key })
        .send({ fulfillment: 'IN_STORE_PICKUP' });
      expect(res.status).toBe(400); // their own cart is empty; no replay of someone else's order
    } finally {
      await deleteCustomer(other.email);
    }
  });

  test('a key that is too short is rejected', async () => {
    expect((await checkout({ 'Idempotency-Key': 'abc' })).status).toBe(422);
  });
});

describe('product_images view', () => {
  test('one row per image, the first marked primary', async () => {
    const { rows } = await pool.query(
      'SELECT image_url, position, is_primary FROM product_images WHERE product_id = $1 ORDER BY position',
      [ITEM]
    );
    expect(rows).toEqual([
      { image_url: 'https://img.test/a.png', position: 1, is_primary: true },
      { image_url: 'https://img.test/b.png', position: 2, is_primary: false },
    ]);
  });
});

describe('SUPPORT_AGENT role and ticket thread', () => {
  let agent;

  test('an admin can create a support agent, who can log in but has no staff powers over stock or catalogue', async () => {
    const res = await api.post(url('/auth/staff')).set(as(admin)).send({
      email: AGENT_EMAIL,
      password: 'Sup3rSecret!',
      fullName: 'Jest Agent',
      role: 'SUPPORT_AGENT',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('SUPPORT_AGENT');

    agent = await login(AGENT_EMAIL, 'Sup3rSecret!');
    expect(agent.user.role).toBe('SUPPORT_AGENT');
    expect((await ledger(agent)).status).toBe(403);
    expect((await api.post(url('/products')).set(as(agent)).send({})).status).toBe(403);
    expect((await api.post(url('/auth/admin-device')).set(as(agent))).status).toBe(403);
  });

  test('a ticket can carry a store, an escalation flag and a message thread', async () => {
    const { rows } = await pool.query(
      `INSERT INTO support_tickets (ticket_number, user_id, subject, store_id, is_escalated, assigned_to)
       VALUES ($1, $2, 'Jest: delivery arrived damaged', 'ST-DEL-01', TRUE, $3)
       RETURNING id`,
      [`TKT-${run}`, customer.user.id, agent.user.id]
    );
    const ticketId = rows[0].id;
    try {
      await pool.query(
        `INSERT INTO ticket_messages (ticket_id, sender_id, message) VALUES ($1, $2, 'The box was crushed.'), ($1, $3, 'Sorry about that - arranging a replacement.')`,
        [ticketId, customer.user.id, agent.user.id]
      );
      const thread = await pool.query(
        'SELECT message FROM ticket_messages WHERE ticket_id = $1 ORDER BY created_at, id',
        [ticketId]
      );
      expect(thread.rows).toHaveLength(2);
      await expect(
        pool.query(
          `INSERT INTO ticket_messages (ticket_id, sender_id, message) VALUES ($1, $2, '')`,
          [ticketId, agent.user.id]
        )
      ).rejects.toThrow(/check/i);
    } finally {
      await pool.query('DELETE FROM support_tickets WHERE id = $1', [ticketId]);
    }
  });
});
