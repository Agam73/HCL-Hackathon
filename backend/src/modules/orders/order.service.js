import { randomBytes } from 'node:crypto';
import { query, queryOne, withTransaction } from '../../db/pool.js';
import ApiError from '../../utils/ApiError.js';
import { toOffset } from '../../utils/schemas.js';
import { priceCart } from '../cart/cart.pricing.js';

/**
 * What staff may move an order to next. Pickup and delivery share the first
 * two steps and then diverge; DELIVERED doubles as "collected" for pickup.
 */
export const STATUS_FLOW = {
  IN_STORE_PICKUP: {
    CONFIRMED: ['PACKED', 'CANCELLED'],
    PACKED: ['READY_FOR_PICKUP', 'CANCELLED'],
    READY_FOR_PICKUP: ['DELIVERED', 'CANCELLED'],
  },
  HOME_DELIVERY: {
    CONFIRMED: ['PACKED', 'CANCELLED'],
    PACKED: ['SHIPPED', 'CANCELLED'],
    SHIPPED: ['DELIVERED'],
  },
};

/** A customer can still back out until the order has left the shelf. */
const CUSTOMER_CANCELLABLE = ['CONFIRMED', 'PACKED'];

export const nextStatuses = (order) => STATUS_FLOW[order.fulfillment]?.[order.status] ?? [];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function newOrderNumber() {
  const day = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `NM-${day}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

function toOrder(row, items) {
  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    fulfillment: row.fulfillment,
    deliverySpeed: row.delivery_speed,
    store: row.store_id ? { id: row.store_id, name: row.store_name, city: row.store_city } : null,
    customer: { id: row.user_id, name: row.customer_name, email: row.customer_email },
    items: items.map((i) => ({
      productId: i.product_id,
      name: i.name,
      image: (i.images ?? [])[0] ?? null,
      quantity: i.quantity,
      unitPrice: i.unit_price,
      lineTotal: i.line_total,
    })),
    subtotal: row.subtotal,
    discountTotal: row.discount_total,
    deliveryFee: row.delivery_fee,
    total: row.total,
    currency: row.currency,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    shippingAddress: row.shipping_address,
    rewardPointsEarned: row.reward_points,
    nextStatuses: nextStatuses(row),
    cancellableByCustomer: CUSTOMER_CANCELLABLE.includes(row.status),
    placedAt: row.placed_at,
    updatedAt: row.updated_at,
  };
}

const ORDER_SELECT = `
  SELECT o.*, s.name AS store_name, s.city AS store_city,
         u.full_name AS customer_name, u.email AS customer_email
    FROM orders o
    JOIN users u ON u.id = o.user_id
    LEFT JOIN stores s ON s.id = o.store_id
`;

async function loadItems(orderIds, db = { query }) {
  if (orderIds.length === 0) return new Map();
  const { rows } = await db.query(
    `SELECT oi.*, p.name, p.images
       FROM order_items oi JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ANY($1::uuid[])
      ORDER BY p.name ASC`,
    [orderIds]
  );
  const byOrder = new Map(orderIds.map((id) => [id, []]));
  for (const row of rows) byOrder.get(row.order_id).push(row);
  return byOrder;
}

/** Owner, ADMIN, or the manager of the order's store. Anyone else gets a 404. */
function canSee(row, user) {
  if (user.role === 'ADMIN') return true;
  if (user.role === 'STORE_MANAGER') return row.store_id === user.storeId;
  return row.user_id === user.id;
}

async function findOrderRow(orderRef, user, db = { query }) {
  const column = UUID.test(orderRef) ? 'o.id' : 'o.order_number';
  const { rows } = await db.query(`${ORDER_SELECT} WHERE ${column} = $1`, [orderRef]);
  const row = rows[0];
  if (!row || !canSee(row, user)) throw ApiError.notFound(`Order ${orderRef}`);
  return row;
}

export async function getOrder(orderRef, user) {
  const row = await findOrderRow(orderRef, user);
  const items = await loadItems([row.id]);
  return toOrder(row, items.get(row.id));
}

async function listWhere(whereSql, params, { page, size }) {
  const { rows } = await query(
    `${ORDER_SELECT} WHERE ${whereSql}
      ORDER BY o.placed_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, size, toOffset({ page, size })]
  );
  const total = await queryOne(`SELECT COUNT(*) AS n FROM orders o WHERE ${whereSql}`, params);
  const items = await loadItems(rows.map((r) => r.id));
  return {
    items: rows.map((r) => toOrder(r, items.get(r.id))),
    totalItems: Number(total.n),
  };
}

/** The caller's own order history, newest first. */
export function listMyOrders(userId, { status, page, size }) {
  const params = [userId];
  let where = 'o.user_id = $1';
  if (status) {
    params.push(status);
    where += ` AND o.status = $2::order_status`;
  }
  return listWhere(where, params, { page, size });
}

/** Orders a store has to fulfil - the store manager's queue. */
export function listStoreOrders(storeId, { status, page, size }) {
  const params = [storeId];
  let where = 'o.store_id = $1';
  if (status) {
    params.push(status);
    where += ` AND o.status = $2::order_status`;
  }
  return listWhere(where, params, { page, size });
}

/**
 * Which location ships a delivery: the customer's own store if it can cover
 * the whole order, otherwise a warehouse, otherwise any other store.
 * Returns null when no single location has everything.
 */
async function pickDeliverySource(client, lines, preferredStoreId) {
  const { rows } = await client.query(
    `SELECT s.id, s.type, i.product_id, i.quantity_available
       FROM stores s JOIN inventory i ON i.store_id = s.id
      WHERE s.is_active AND i.product_id = ANY($1::text[])`,
    [lines.map((l) => l.product_id)]
  );
  const stock = new Map(); // storeId -> { type, byProduct }
  for (const row of rows) {
    if (!stock.has(row.id)) stock.set(row.id, { type: row.type, byProduct: new Map() });
    stock.get(row.id).byProduct.set(row.product_id, row.quantity_available);
  }
  const covers = ([, s]) => lines.every((l) => (s.byProduct.get(l.product_id) ?? 0) >= l.quantity);
  const rank = ([id, s]) => (id === preferredStoreId ? 0 : s.type === 'WAREHOUSE' ? 1 : 2);

  const candidates = [...stock.entries()].filter(covers).sort((a, b) => rank(a) - rank(b));
  return candidates[0]?.[0] ?? null;
}

/**
 * Check out the caller's cart. One transaction: stock is locked, re-checked
 * and decremented, the order and its lines are written, and the cart is
 * emptied - or none of it happens.
 */
export async function placeOrder(user, input) {
  const orderId = await withTransaction(async (client) => {
    const { rows: owners } = await client.query(
      'SELECT membership_tier, preferred_store_id FROM users WHERE id = $1',
      [user.id]
    );
    const owner = owners[0];
    if (!owner) throw ApiError.notFound('User');

    // Locking the cart row serialises two checkouts of the same cart.
    const { rows: carts } = await client.query(
      'SELECT id FROM carts WHERE user_id = $1 FOR UPDATE',
      [user.id]
    );
    const { rows: lines } = carts[0]
      ? await client.query(
          `SELECT ci.product_id, ci.quantity, p.name, p.price, p.mrp, p.is_active
             FROM cart_items ci JOIN products p ON p.id = ci.product_id
            WHERE ci.cart_id = $1
            ORDER BY ci.product_id`,
          [carts[0].id]
        )
      : { rows: [] };
    if (lines.length === 0) throw ApiError.badRequest('Your cart is empty');

    const retired = lines.filter((l) => !l.is_active);
    if (retired.length) {
      throw ApiError.conflict(
        'Some items are no longer sold. Remove them to continue.',
        retired.map((l) => ({ productId: l.product_id, code: 'UNAVAILABLE', message: l.name }))
      );
    }

    // ---- where the stock comes from ----
    let storeId;
    if (input.fulfillment === 'IN_STORE_PICKUP') {
      storeId = input.storeId ?? owner.preferred_store_id;
      if (!storeId) throw ApiError.badRequest('Choose a store to pick the order up from');
      const { rows: stores } = await client.query(
        `SELECT id FROM stores WHERE id = $1 AND is_active AND type = 'STORE'`,
        [storeId]
      );
      if (!stores[0]) throw ApiError.badRequest(`Store ${storeId} is not available for pickup`);
    } else {
      storeId = await pickDeliverySource(client, lines, owner.preferred_store_id);
      if (!storeId) {
        throw ApiError.conflict('No single location can fulfil this order right now', [
          { code: 'INSUFFICIENT_STOCK', message: 'Try fewer items or split the order' },
        ]);
      }
    }

    // ---- lock, re-check and take the stock ----
    const { rows: stockRows } = await client.query(
      `SELECT product_id, quantity_available FROM inventory
        WHERE store_id = $1 AND product_id = ANY($2::text[])
        ORDER BY product_id
        FOR UPDATE`,
      [storeId, lines.map((l) => l.product_id)]
    );
    const available = new Map(stockRows.map((r) => [r.product_id, r.quantity_available]));
    const short = lines.filter((l) => (available.get(l.product_id) ?? 0) < l.quantity);
    if (short.length) {
      throw ApiError.conflict(
        'Some items are not available in the quantity you asked for',
        short.map((l) => ({
          productId: l.product_id,
          code: (available.get(l.product_id) ?? 0) === 0 ? 'OUT_OF_STOCK' : 'INSUFFICIENT_STOCK',
          message: `${l.name}: ${available.get(l.product_id) ?? 0} available, ${l.quantity} requested`,
          available: available.get(l.product_id) ?? 0,
        }))
      );
    }

    // ---- simulated payment: declined before anything is written ----
    if (input.simulatePaymentFailure) {
      throw new ApiError(402, 'PAYMENT_FAILED', 'The payment was declined. Nothing was charged.');
    }

    for (const line of lines) {
      await client.query(
        `UPDATE inventory SET quantity_available = quantity_available - $3, last_synced_at = now()
          WHERE store_id = $1 AND product_id = $2`,
        [storeId, line.product_id, line.quantity]
      );
    }

    // ---- totals: the same tier rules the cart showed ----
    const { summary, membership } = priceCart(
      lines.map((l) => ({ unitPrice: l.price, mrp: l.mrp, quantity: l.quantity })),
      owner.membership_tier
    );
    const isDelivery = input.fulfillment === 'HOME_DELIVERY';
    const deliverySpeed = isDelivery ? input.deliverySpeed : null;
    const deliveryFee = !isDelivery
      ? 0
      : deliverySpeed === 'EXPRESS'
        ? summary.delivery.express.fee
        : summary.delivery.standard.fee;
    const cashOnDelivery = input.paymentMethod === 'CASH_ON_DELIVERY';

    const { rows: created } = await client.query(
      `INSERT INTO orders
         (order_number, user_id, store_id, fulfillment, status, subtotal, discount_total,
          delivery_fee, total, shipping_address, payment_status, payment_method,
          delivery_speed, reward_points)
       VALUES ($1,$2,$3,$4::fulfillment_type,'CONFIRMED',$5,0,$6,$7,$8::jsonb,$9,$10,$11,$12)
       RETURNING id`,
      [
        newOrderNumber(),
        user.id,
        storeId,
        input.fulfillment,
        summary.subtotal,
        deliveryFee,
        summary.subtotal + deliveryFee,
        isDelivery ? JSON.stringify(input.shippingAddress) : null,
        cashOnDelivery ? 'PAY_ON_DELIVERY' : 'SIMULATED_PAID',
        input.paymentMethod,
        deliverySpeed,
        membership.rewardPointsEarned,
      ]
    );

    for (const line of lines) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total)
         VALUES ($1,$2,$3,$4,$5)`,
        [created[0].id, line.product_id, line.quantity, line.price, line.price * line.quantity]
      );
    }

    await client.query('DELETE FROM cart_items WHERE cart_id = $1', [carts[0].id]);
    return created[0].id;
  });

  return getOrder(orderId, user);
}

/** Put a cancelled order's units back on the shelf it was taken from. */
async function restock(client, order) {
  if (!order.store_id) return;
  await client.query(
    `UPDATE inventory i
        SET quantity_available = i.quantity_available + oi.quantity, last_synced_at = now()
       FROM order_items oi
      WHERE oi.order_id = $1 AND i.store_id = $2 AND i.product_id = oi.product_id`,
    [order.id, order.store_id]
  );
}

async function changeStatus(orderRef, user, decide) {
  await withTransaction(async (client) => {
    const visible = await findOrderRow(orderRef, user, client);
    // Re-read under a lock so two updates cannot both act on the old status.
    const { rows } = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [
      visible.id,
    ]);
    const order = rows[0];
    const next = decide(order);

    await client.query('UPDATE orders SET status = $2::order_status WHERE id = $1', [
      order.id,
      next,
    ]);
    if (next === 'CANCELLED') {
      await restock(client, order);
      if (order.payment_status === 'SIMULATED_PAID') {
        await client.query(
          `UPDATE orders SET payment_status = 'SIMULATED_REFUNDED' WHERE id = $1`,
          [order.id]
        );
      }
    }
  });
  return getOrder(orderRef, user);
}

/** Customer cancels their own order (staff use updateStatus). */
export function cancelOrder(orderRef, user) {
  return changeStatus(orderRef, user, (order) => {
    if (order.user_id !== user.id) throw ApiError.notFound(`Order ${orderRef}`);
    if (!CUSTOMER_CANCELLABLE.includes(order.status)) {
      throw ApiError.conflict(`An order that is ${order.status} can no longer be cancelled`);
    }
    return 'CANCELLED';
  });
}

/** Store manager (own store) or ADMIN moves the order along its flow. */
export function updateStatus(orderRef, user, status) {
  return changeStatus(orderRef, user, (order) => {
    const allowed = nextStatuses(order);
    if (!allowed.includes(status)) {
      throw ApiError.conflict(
        `A ${order.fulfillment} order that is ${order.status} cannot move to ${status}`,
        { allowed }
      );
    }
    return status;
  });
}
