import { query, queryOne, withTransaction } from '../../db/pool.js';
import ApiError from '../../utils/ApiError.js';
import { toOffset } from '../../utils/schemas.js';
import { assertStoreExists } from '../stores/store.service.js';

function toInventoryRow(row) {
  return {
    storeId: row.store_id,
    product: {
      id: row.product_id,
      name: row.product_name,
      price: row.price,
      currency: row.currency,
      brandName: row.brand_name,
      categoryId: row.category_id,
      categoryName: row.category_name,
      image: (row.images ?? [])[0] ?? null,
    },
    quantityAvailable: row.quantity_available,
    quantityReserved: row.quantity_reserved,
    reorderLevel: row.reorder_level,
    availability:
      row.quantity_available <= 0
        ? 'OUT_OF_STOCK'
        : row.quantity_available <= row.reorder_level
          ? 'LOW_STOCK'
          : 'IN_STOCK',
    needsReplenishment: row.quantity_available <= row.reorder_level,
    lastSyncedAt: row.last_synced_at,
    updatedAt: row.updated_at,
  };
}

/** Paged inventory for one store, with product details joined in. */
export async function listStoreInventory(storeId, filters) {
  await assertStoreExists(storeId);

  const params = [storeId];
  const where = ['i.store_id = $1'];
  const bind = (v) => {
    params.push(v);
    return `$${params.length}`;
  };

  if (filters.q) {
    const q = bind(filters.q);
    where.push(`(p.name ILIKE '%' || ${q} || '%' OR p.id ILIKE '%' || ${q} || '%')`);
  }
  if (filters.categoryId?.length) where.push(`p.category_id = ANY(${bind(filters.categoryId)}::text[])`);
  if (filters.brandId?.length) where.push(`p.brand_id = ANY(${bind(filters.brandId)}::text[])`);
  if (filters.lowStockOnly) where.push('i.quantity_available <= i.reorder_level');
  if (filters.inStockOnly) where.push('i.quantity_available > 0');
  if (filters.status === 'OUT_OF_STOCK') where.push('i.quantity_available <= 0');
  if (filters.status === 'LOW_STOCK') {
    where.push('i.quantity_available > 0 AND i.quantity_available <= i.reorder_level');
  }
  if (filters.status === 'IN_STOCK') where.push('i.quantity_available > i.reorder_level');

  const orderBy = {
    quantity_asc: 'i.quantity_available ASC',
    quantity_desc: 'i.quantity_available DESC',
    name_asc: 'p.name ASC',
    shortfall_desc: '(i.reorder_level - i.quantity_available) DESC',
  }[filters.sort ?? 'name_asc'];

  const limit = bind(filters.size);
  const offset = bind(toOffset(filters));

  const { rows } = await query(
    `SELECT i.*, p.name AS product_name, p.price, p.currency, p.images,
            p.category_id, b.name AS brand_name, c.name AS category_name,
            COUNT(*) OVER() AS total_count
       FROM inventory i
       JOIN products p   ON p.id = i.product_id
       JOIN brands b     ON b.id = p.brand_id
       JOIN categories c ON c.id = p.category_id
      WHERE ${where.join(' AND ')}
      ORDER BY ${orderBy}, p.id ASC
      LIMIT ${limit} OFFSET ${offset}`,
    params
  );

  return {
    items: rows.map(toInventoryRow),
    totalItems: rows.length > 0 ? Number(rows[0].total_count) : 0,
  };
}

/** One product's stock at one store. */
export async function getStoreProductInventory(storeId, productId) {
  const row = await queryOne(
    `SELECT i.*, p.name AS product_name, p.price, p.currency, p.images,
            p.category_id, b.name AS brand_name, c.name AS category_name
       FROM inventory i
       JOIN products p   ON p.id = i.product_id
       JOIN brands b     ON b.id = p.brand_id
       JOIN categories c ON c.id = p.category_id
      WHERE i.store_id = $1 AND i.product_id = $2`,
    [storeId, productId]
  );
  if (!row) throw ApiError.notFound(`Inventory for product ${productId} at store ${storeId}`);
  return toInventoryRow(row);
}

/**
 * Create or update a stock row. STORE_MANAGER (own store) or ADMIN.
 * Every change is written to agent_actions so stock movements are traceable.
 */
export async function upsertStoreInventory(storeId, productId, patch, context = {}) {
  await assertStoreExists(storeId);
  const product = await queryOne('SELECT id FROM products WHERE id = $1', [productId]);
  if (!product) throw ApiError.notFound(`Product ${productId}`);

  return withTransaction(async (client) => {
    const { rows: existingRows } = await client.query(
      'SELECT * FROM inventory WHERE store_id = $1 AND product_id = $2 FOR UPDATE',
      [storeId, productId]
    );
    const existing = existingRows[0] ?? null;

    const currentQty = existing?.quantity_available ?? 0;
    let nextQty = currentQty;
    if (patch.quantityAvailable !== undefined) nextQty = patch.quantityAvailable;
    if (patch.delta !== undefined) nextQty = currentQty + patch.delta;
    if (nextQty < 0) {
      throw ApiError.badRequest(
        `Stock cannot go negative (current ${currentQty}, requested change ${patch.delta})`
      );
    }
    const nextReorder = patch.reorderLevel ?? existing?.reorder_level ?? 5;

    const { rows } = await client.query(
      `INSERT INTO inventory (store_id, product_id, quantity_available, reorder_level, last_synced_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (store_id, product_id) DO UPDATE
         SET quantity_available = EXCLUDED.quantity_available,
             reorder_level      = EXCLUDED.reorder_level,
             last_synced_at     = now()
       RETURNING *`,
      [storeId, productId, nextQty, nextReorder]
    );

    await client.query(
      `INSERT INTO agent_actions
         (trace_id, agent_name, action, actor_user_id, input, output, reasoning, status)
       VALUES ($1, 'INVENTORY', 'STOCK_ADJUSTMENT', $2, $3::jsonb, $4::jsonb, $5, 'EXECUTED')`,
      [
        context.traceId ?? 'manual',
        context.userId ?? null,
        JSON.stringify({ storeId, productId, ...patch }),
        JSON.stringify({ previousQuantity: currentQty, newQuantity: nextQty }),
        patch.reason ?? `Stock set to ${nextQty} (was ${currentQty})`,
      ]
    );

    const row = rows[0];
    return {
      storeId: row.store_id,
      productId: row.product_id,
      previousQuantity: currentQty,
      quantityAvailable: row.quantity_available,
      quantityReserved: row.quantity_reserved,
      reorderLevel: row.reorder_level,
      availability:
        row.quantity_available <= 0
          ? 'OUT_OF_STOCK'
          : row.quantity_available <= row.reorder_level
            ? 'LOW_STOCK'
            : 'IN_STOCK',
      lastSyncedAt: row.last_synced_at,
    };
  });
}

/** Replenishment feed for a store (or all stores when storeId is omitted). */
export async function listLowStock(storeId, { page, size }) {
  const params = [];
  let where = '';
  if (storeId) {
    await assertStoreExists(storeId);
    params.push(storeId);
    where = 'WHERE store_id = $1';
  }
  params.push(size, (page - 1) * size);

  const { rows } = await query(
    `SELECT *, COUNT(*) OVER() AS total_count
       FROM v_low_stock
      ${where}
      ORDER BY shortfall DESC, product_name ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    items: rows.map((r) => ({
      storeId: r.store_id,
      storeName: r.store_name,
      productId: r.product_id,
      productName: r.product_name,
      categoryName: r.category_name,
      quantityAvailable: r.quantity_available,
      reorderLevel: r.reorder_level,
      shortfall: r.shortfall,
    })),
    totalItems: rows.length > 0 ? Number(rows[0].total_count) : 0,
  };
}
