/**
 * Phase 8 - orders: checkout (pickup / delivery), simulated payment, stock
 * decrement, history, cancellation and the store manager's fulfilment flow.
 *
 * Uses its own throwaway customers and products so seeded stock is untouched.
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
const WIDGET = `JW${run}`; // stocked at the pickup store and the warehouse
const GADGET = `JG${run}`; // only the warehouse has it
const ADDRESS = { line: '12 MG Road', city: 'New Delhi', postalCode: '110001' };

let customer; // STANDARD tier, preferred store ST-DEL-01
let stranger; // another customer, must never see the first one's orders
let delManager; // manages ST-DEL-01
let mumManager; // manages ST-MUM-01
let admin;

const as = (who) => auth(who.token);
const addToCart = (who, productId, quantity = 1) =>
  api.post(url('/cart/items')).set(as(who)).send({ productId, quantity });
const checkout = (who, body) => api.post(url('/orders')).set(as(who)).send(body);
const setStatus = (who, order, status) =>
  api
    .patch(url(`/orders/${order.id}/status`))
    .set(as(who))
    .send({ status });

beforeAll(async () => {
  await createTestProduct(WIDGET, {
    price: 1000,
    mrp: 1200,
    stock: { 'ST-DEL-01': 5, 'ST-DEL-02': 0, 'WH-DEL-01': 50 },
  });
  await createTestProduct(GADGET, { price: 300, stock: { 'ST-DEL-01': 0, 'WH-DEL-01': 20 } });

  customer = await registerCustomer('orders', { preferredStoreId: 'ST-DEL-01' });
  stranger = await registerCustomer('stranger');
  delManager = await login('manager.del01@novamart.com');
  mumManager = await login('manager.mum01@novamart.com');
  admin = await login('admin@novamart.com');
});

afterAll(async () => {
  await deleteCustomer(customer.email);
  await deleteCustomer(stranger.email);
  await deleteTestProduct(WIDGET);
  await deleteTestProduct(GADGET);
  await closePool();
});

describe('checkout validation', () => {
  test('needs a login', async () => {
    expect((await api.post(url('/orders')).send({ fulfillment: 'IN_STORE_PICKUP' })).status).toBe(
      401
    );
  });

  test('an empty cart cannot be checked out', async () => {
    const res = await checkout(customer, { fulfillment: 'IN_STORE_PICKUP' });
    expect(res.status).toBe(400);
  });

  test('home delivery needs an address; fulfillment must be a known option', async () => {
    expect((await checkout(customer, { fulfillment: 'HOME_DELIVERY' })).status).toBe(422);
    expect((await checkout(customer, { fulfillment: 'DRONE' })).status).toBe(422);
  });
});

describe('in-store pickup', () => {
  let order;

  test('checkout confirms the order, takes the stock and empties the cart', async () => {
    await addToCart(customer, WIDGET, 2);
    const res = await checkout(customer, { fulfillment: 'IN_STORE_PICKUP' });

    expect(res.status).toBe(201);
    order = res.body.data;
    expect(order).toMatchObject({
      status: 'CONFIRMED',
      fulfillment: 'IN_STORE_PICKUP',
      deliverySpeed: null,
      subtotal: 2000,
      deliveryFee: 0,
      total: 2000,
      paymentStatus: 'SIMULATED_PAID',
      rewardPointsEarned: 20,
    });
    expect(order.orderNumber).toMatch(/^NM-\d{8}-[0-9A-F]{6}$/);
    expect(order.store.id).toBe('ST-DEL-01'); // defaulted to the preferred store
    expect(order.items).toEqual([
      expect.objectContaining({ productId: WIDGET, quantity: 2, unitPrice: 1000, lineTotal: 2000 }),
    ]);

    expect(await stockOf('ST-DEL-01', WIDGET)).toBe(3);
    const cart = await api.get(url('/cart')).set(as(customer));
    expect(cart.body.data.items).toEqual([]);
  });

  test('the order shows up in history and can be fetched by id or order number', async () => {
    const history = await api.get(url('/orders')).set(as(customer));
    expect(history.body.data.map((o) => o.id)).toContain(order.id);
    expect(history.body.meta.totalItems).toBeGreaterThanOrEqual(1);

    for (const ref of [order.id, order.orderNumber]) {
      const res = await api.get(url(`/orders/${ref}`)).set(as(customer));
      expect(res.body.data.orderNumber).toBe(order.orderNumber);
    }
  });

  test("another customer and another store's manager cannot see it", async () => {
    expect((await api.get(url(`/orders/${order.id}`)).set(as(stranger))).status).toBe(404);
    expect((await api.get(url(`/orders/${order.id}`)).set(as(mumManager))).status).toBe(404);
    expect((await api.get(url(`/orders/${order.id}`))).status).toBe(401);
  });

  test('the store manager sees it in their queue; others are kept out of that queue', async () => {
    const queue = await api
      .get(url('/stores/ST-DEL-01/orders?status=CONFIRMED'))
      .set(as(delManager));
    expect(queue.status).toBe(200);
    const mine = queue.body.data.find((o) => o.id === order.id);
    expect(mine.customer.email).toBe(customer.email);
    expect(mine.nextStatuses).toEqual(['PACKED', 'CANCELLED']);

    expect((await api.get(url('/stores/ST-DEL-01/orders')).set(as(mumManager))).status).toBe(403);
    expect((await api.get(url('/stores/ST-DEL-01/orders')).set(as(customer))).status).toBe(403);
    expect((await api.get(url('/stores/ST-DEL-01/orders')).set(as(admin))).status).toBe(200);
  });

  test('only the right staff can move it, and only along the pickup flow', async () => {
    expect((await setStatus(customer, order, 'PACKED')).status).toBe(403);
    expect((await setStatus(mumManager, order, 'PACKED')).status).toBe(404);
    // Skipping a step, or using a delivery-only step, is refused.
    expect((await setStatus(delManager, order, 'DELIVERED')).status).toBe(409);
    expect((await setStatus(delManager, order, 'SHIPPED')).status).toBe(409);

    for (const status of ['PACKED', 'READY_FOR_PICKUP', 'DELIVERED']) {
      const res = await setStatus(delManager, order, status);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(status);
    }
    // Finished: nothing further is allowed, including cancelling.
    expect((await setStatus(admin, order, 'CANCELLED')).status).toBe(409);
    const cancel = await api.post(url(`/orders/${order.id}/cancel`)).set(as(customer));
    expect(cancel.status).toBe(409);
    expect(await stockOf('ST-DEL-01', WIDGET)).toBe(3);
  });
});

describe('stock and payment failures leave everything as it was', () => {
  test('asking for more than the store has is refused with the shortfall', async () => {
    await addToCart(customer, WIDGET, 4); // only 3 left at ST-DEL-01
    const res = await checkout(customer, { fulfillment: 'IN_STORE_PICKUP' });

    expect(res.status).toBe(409);
    expect(res.body.error.details[0]).toMatchObject({
      productId: WIDGET,
      code: 'INSUFFICIENT_STOCK',
      available: 3,
    });
    expect(await stockOf('ST-DEL-01', WIDGET)).toBe(3);
    const cart = await api.get(url('/cart')).set(as(customer));
    expect(cart.body.data.items[0].quantity).toBe(4); // cart kept for the customer to fix
  });

  test('a store with none of it reports OUT_OF_STOCK; a warehouse is not a pickup point', async () => {
    const empty = await checkout(customer, {
      fulfillment: 'IN_STORE_PICKUP',
      storeId: 'ST-DEL-02',
    });
    expect(empty.status).toBe(409);
    expect(empty.body.error.details[0].code).toBe('OUT_OF_STOCK');

    const warehouse = await checkout(customer, {
      fulfillment: 'IN_STORE_PICKUP',
      storeId: 'WH-DEL-01',
    });
    expect(warehouse.status).toBe(400);
  });

  test('a declined payment creates no order and takes no stock', async () => {
    await api
      .patch(url(`/cart/items/${WIDGET}`))
      .set(as(customer))
      .send({ quantity: 1 });
    const before = (await api.get(url('/orders')).set(as(customer))).body.meta.totalItems;

    const res = await checkout(customer, {
      fulfillment: 'IN_STORE_PICKUP',
      simulatePaymentFailure: true,
    });
    expect(res.status).toBe(402);
    expect(res.body.error.code).toBe('PAYMENT_FAILED');

    expect((await api.get(url('/orders')).set(as(customer))).body.meta.totalItems).toBe(before);
    expect(await stockOf('ST-DEL-01', WIDGET)).toBe(3);
    await api.delete(url('/cart')).set(as(customer));
  });
});

describe('home delivery', () => {
  let order;

  test('ships from a warehouse when the customer’s store cannot cover the whole order', async () => {
    await addToCart(customer, WIDGET, 1);
    await addToCart(customer, GADGET, 1); // ST-DEL-01 has none of this
    const res = await checkout(customer, {
      fulfillment: 'HOME_DELIVERY',
      deliverySpeed: 'EXPRESS',
      shippingAddress: ADDRESS,
      paymentMethod: 'CASH_ON_DELIVERY',
    });

    expect(res.status).toBe(201);
    order = res.body.data;
    expect(order.store.id).toBe('WH-DEL-01');
    expect(order).toMatchObject({
      fulfillment: 'HOME_DELIVERY',
      deliverySpeed: 'EXPRESS',
      subtotal: 1300,
      deliveryFee: 149, // STANDARD tier pays for express
      total: 1449,
      paymentStatus: 'PAY_ON_DELIVERY',
      shippingAddress: ADDRESS,
    });
    expect(await stockOf('WH-DEL-01', WIDGET)).toBe(49);
    expect(await stockOf('WH-DEL-01', GADGET)).toBe(19);
    expect(await stockOf('ST-DEL-01', WIDGET)).toBe(3); // untouched
  });

  test('the customer can cancel before it ships, and the stock comes back', async () => {
    const res = await api.post(url(`/orders/${order.id}/cancel`)).set(as(customer));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CANCELLED');
    expect(await stockOf('WH-DEL-01', WIDGET)).toBe(50);
    expect(await stockOf('WH-DEL-01', GADGET)).toBe(20);

    // Cancelling twice must not restock twice.
    expect((await api.post(url(`/orders/${order.id}/cancel`)).set(as(customer))).status).toBe(409);
    expect(await stockOf('WH-DEL-01', WIDGET)).toBe(50);
  });

  test("a stranger cannot cancel someone else's order", async () => {
    await addToCart(customer, WIDGET, 1);
    const placed = await checkout(customer, {
      fulfillment: 'HOME_DELIVERY',
      shippingAddress: ADDRESS,
    });
    const id = placed.body.data.id;

    expect((await api.post(url(`/orders/${id}/cancel`)).set(as(stranger))).status).toBe(404);
    expect((await api.post(url(`/orders/${id}/cancel`)).set(as(delManager))).status).toBe(404);
    expect((await api.get(url(`/orders/${id}`)).set(as(customer))).body.data.status).toBe(
      'CONFIRMED'
    );
  });

  test('delivery follows its own flow; a staff cancel refunds and restocks', async () => {
    // The previous test left one confirmed delivery order from the customer's own store.
    const history = await api.get(url('/orders?status=CONFIRMED')).set(as(customer));
    const open = history.body.data[0];
    expect(open.store.id).toBe('ST-DEL-01'); // preferred store covers a 1-widget order
    expect(open.deliveryFee).toBe(0); // standard delivery is free above Rs 499
    expect(await stockOf('ST-DEL-01', WIDGET)).toBe(2);

    expect((await setStatus(delManager, open, 'READY_FOR_PICKUP')).status).toBe(409);
    expect((await setStatus(delManager, open, 'PACKED')).body.data.status).toBe('PACKED');

    const cancelled = await setStatus(admin, open, 'CANCELLED');
    expect(cancelled.body.data).toMatchObject({
      status: 'CANCELLED',
      paymentStatus: 'SIMULATED_REFUNDED',
    });
    expect(await stockOf('ST-DEL-01', WIDGET)).toBe(3);
  });

  test('once shipped, the customer can no longer cancel', async () => {
    await addToCart(customer, WIDGET, 1);
    const placed = (
      await checkout(customer, { fulfillment: 'HOME_DELIVERY', shippingAddress: ADDRESS })
    ).body.data;
    await setStatus(delManager, placed, 'PACKED');
    await setStatus(delManager, placed, 'SHIPPED');

    expect((await api.post(url(`/orders/${placed.id}/cancel`)).set(as(customer))).status).toBe(409);
    expect((await setStatus(delManager, placed, 'DELIVERED')).body.data.status).toBe('DELIVERED');
  });
});

describe('tier perks and concurrency', () => {
  test('a GOLD member gets express delivery free and triple points', async () => {
    await pool.query(`UPDATE users SET membership_tier = 'GOLD' WHERE email = $1`, [
      customer.email,
    ]);
    await addToCart(customer, GADGET, 1);
    const res = await checkout(customer, {
      fulfillment: 'HOME_DELIVERY',
      deliverySpeed: 'EXPRESS',
      shippingAddress: ADDRESS,
    });
    expect(res.body.data).toMatchObject({
      subtotal: 300,
      deliveryFee: 0,
      total: 300,
      rewardPointsEarned: 9,
    });
  });

  test('two shoppers racing for the last unit: exactly one order succeeds', async () => {
    const LAST = `JL${run}`;
    await createTestProduct(LAST, { stock: { 'ST-DEL-01': 1 } });
    try {
      await addToCart(customer, LAST, 1);
      await addToCart(stranger, LAST, 1);
      const body = { fulfillment: 'IN_STORE_PICKUP', storeId: 'ST-DEL-01' };

      const results = await Promise.all([checkout(customer, body), checkout(stranger, body)]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(await stockOf('ST-DEL-01', LAST)).toBe(0);
    } finally {
      await pool.query(
        'DELETE FROM orders WHERE id IN (SELECT order_id FROM order_items WHERE product_id = $1)',
        [LAST]
      );
      await deleteTestProduct(LAST);
    }
  });
});
