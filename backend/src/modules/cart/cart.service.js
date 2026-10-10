import { query, queryOne } from '../../db/pool.js';
import ApiError from '../../utils/ApiError.js';
import { priceCart, MAX_QUANTITY_PER_ITEM } from './cart.pricing.js';

/** One cart per user (UNIQUE user_id) - created lazily on first use. */
async function getOrCreateCartId(userId) {
  const row = await queryOne(
    `INSERT INTO carts (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
     RETURNING id`,
    [userId]
  );
  return row.id;
}

function availabilityAt(row, storeId) {
  if (!storeId) return null;
  const quantityAvailable = row.store_quantity ?? 0;
  return {
    storeId,
    quantityAvailable,
    status:
      quantityAvailable <= 0
        ? 'OUT_OF_STOCK'
        : quantityAvailable <= (row.store_reorder_level ?? 0)
          ? 'LOW_STOCK'
          : 'IN_STOCK',
    sufficient: quantityAvailable >= row.quantity,
  };
}

/**
 * The full cart view: lines priced at today's catalogue price, stock checked
 * against the customer's preferred store, totals and membership perks.
 * The tier comes from the users table, never from the request.
 */
export async function getCart(userId) {
  const owner = await queryOne(
    `SELECT u.membership_tier, s.id AS store_id, s.name AS store_name, s.city AS store_city
       FROM users u
       LEFT JOIN stores s ON s.id = u.preferred_store_id
      WHERE u.id = $1`,
    [userId]
  );
  if (!owner) throw ApiError.notFound('User');

  const cartId = await getOrCreateCartId(userId);

  const { rows } = await query(
    `SELECT ci.product_id, ci.quantity, ci.unit_price AS price_when_added, ci.added_at,
            p.name, p.price, p.mrp, p.images, p.is_active,
            b.name AS brand_name, c.name AS category_name,
            i.quantity_available AS store_quantity, i.reorder_level AS store_reorder_level
       FROM cart_items ci
       JOIN products p   ON p.id = ci.product_id
       JOIN brands b     ON b.id = p.brand_id
       JOIN categories c ON c.id = p.category_id
       LEFT JOIN inventory i ON i.product_id = p.id AND i.store_id = $2
      WHERE ci.cart_id = $1
      ORDER BY ci.added_at ASC, ci.product_id ASC`,
    [cartId, owner.store_id]
  );

  const issues = [];
  const items = rows.map((row) => {
    const availability = availabilityAt(row, owner.store_id);

    if (!row.is_active) {
      issues.push({
        productId: row.product_id,
        code: 'UNAVAILABLE',
        message: `${row.name} is no longer sold`,
      });
    } else if (availability?.status === 'OUT_OF_STOCK') {
      issues.push({
        productId: row.product_id,
        code: 'OUT_OF_STOCK',
        message: `${row.name} is out of stock at ${owner.store_name}`,
      });
    } else if (availability && !availability.sufficient) {
      issues.push({
        productId: row.product_id,
        code: 'INSUFFICIENT_STOCK',
        message: `Only ${availability.quantityAvailable} of ${row.name} left at ${owner.store_name}`,
      });
    }

    return {
      productId: row.product_id,
      name: row.name,
      brandName: row.brand_name,
      categoryName: row.category_name,
      image: (row.images ?? [])[0] ?? null,
      quantity: row.quantity,
      unitPrice: row.price,
      mrp: row.mrp,
      lineTotal: Math.round(row.price * row.quantity * 100) / 100,
      priceWhenAdded: row.price_when_added,
      priceChanged: row.price !== row.price_when_added,
      availability,
      addedAt: row.added_at,
    };
  });

  return {
    id: cartId,
    store: owner.store_id
      ? { id: owner.store_id, name: owner.store_name, city: owner.store_city }
      : null,
    items,
    ...priceCart(items, owner.membership_tier),
    issues,
  };
}

async function assertProductOnSale(productId) {
  const product = await queryOne('SELECT id, price, is_active FROM products WHERE id = $1', [
    productId,
  ]);
  if (!product || !product.is_active) throw ApiError.notFound(`Product ${productId}`);
  return product;
}

/** Add a product, or increase its quantity if it is already in the cart. */
export async function addItem(userId, { productId, quantity }) {
  const product = await assertProductOnSale(productId);
  const cartId = await getOrCreateCartId(userId);

  const existing = await queryOne(
    'SELECT quantity FROM cart_items WHERE cart_id = $1 AND product_id = $2',
    [cartId, productId]
  );
  if ((existing?.quantity ?? 0) + quantity > MAX_QUANTITY_PER_ITEM) {
    throw ApiError.badRequest(`At most ${MAX_QUANTITY_PER_ITEM} of one product per order`);
  }

  await query(
    `INSERT INTO cart_items (cart_id, product_id, quantity, unit_price)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (cart_id, product_id)
     DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity`,
    [cartId, productId, quantity, product.price]
  );
  return getCart(userId);
}

/** Set the quantity of a product that is already in the cart. */
export async function updateItem(userId, productId, { quantity }) {
  const cartId = await getOrCreateCartId(userId);
  const { rowCount } = await query(
    'UPDATE cart_items SET quantity = $3 WHERE cart_id = $1 AND product_id = $2',
    [cartId, productId, quantity]
  );
  if (rowCount === 0) throw ApiError.notFound(`Cart item ${productId}`);
  return getCart(userId);
}

export async function removeItem(userId, productId) {
  const cartId = await getOrCreateCartId(userId);
  const { rowCount } = await query(
    'DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2',
    [cartId, productId]
  );
  if (rowCount === 0) throw ApiError.notFound(`Cart item ${productId}`);
  return getCart(userId);
}

export async function clearCart(userId) {
  const cartId = await getOrCreateCartId(userId);
  await query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);
  return getCart(userId);
}
