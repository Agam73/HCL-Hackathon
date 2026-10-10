import { query, queryOne } from '../../db/pool.js';
import ApiError from '../../utils/ApiError.js';
import { toOffset } from '../../utils/schemas.js';

function toStore(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    address: {
      line: row.address_line,
      city: row.city,
      state: row.state,
      country: row.country,
      postalCode: row.postal_code,
    },
    location:
      row.latitude !== null && row.longitude !== null
        ? { latitude: row.latitude, longitude: row.longitude }
        : null,
    phone: row.phone,
    hours: row.opens_at && row.closes_at ? { opensAt: row.opens_at, closesAt: row.closes_at } : null,
    isActive: row.is_active,
    ...(row.sku_count !== undefined ? { skuCount: Number(row.sku_count) } : {}),
    ...(row.units_in_stock !== undefined ? { unitsInStock: Number(row.units_in_stock) } : {}),
  };
}

export async function listStores(filters) {
  const params = [];
  const where = [];
  const bind = (v) => {
    params.push(v);
    return `$${params.length}`;
  };

  if (filters.activeOnly) where.push('s.is_active = TRUE');
  if (filters.city) where.push(`s.city ILIKE ${bind(filters.city)}`);
  if (filters.country) where.push(`s.country = ${bind(filters.country)}`);
  if (filters.type) where.push(`s.type = ${bind(filters.type)}::store_type`);
  if (filters.q) {
    const q = bind(filters.q);
    where.push(`(s.name ILIKE '%' || ${q} || '%'
                 OR s.city ILIKE '%' || ${q} || '%'
                 OR s.postal_code ILIKE '%' || ${q} || '%')`);
  }
  if (filters.hasProductId) {
    where.push(`EXISTS (
      SELECT 1 FROM inventory i
       WHERE i.store_id = s.id
         AND i.product_id = ${bind(filters.hasProductId)}
         AND i.quantity_available > 0
    )`);
  }

  const limit = bind(filters.size);
  const offset = bind(toOffset(filters));

  const { rows } = await query(
    `SELECT s.*,
            COUNT(i.product_id)                AS sku_count,
            COALESCE(SUM(i.quantity_available), 0) AS units_in_stock,
            COUNT(*) OVER()                    AS total_count
       FROM stores s
       LEFT JOIN inventory i ON i.store_id = s.id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      GROUP BY s.id
      ORDER BY s.city ASC, s.name ASC
      LIMIT ${limit} OFFSET ${offset}`,
    params
  );

  return {
    items: rows.map(toStore),
    totalItems: rows.length > 0 ? Number(rows[0].total_count) : 0,
  };
}

export async function getStore(storeId) {
  const row = await queryOne(
    `SELECT s.*,
            COUNT(i.product_id) AS sku_count,
            COALESCE(SUM(i.quantity_available), 0) AS units_in_stock
       FROM stores s
       LEFT JOIN inventory i ON i.store_id = s.id
      WHERE s.id = $1
      GROUP BY s.id`,
    [storeId]
  );
  if (!row) throw ApiError.notFound(`Store ${storeId}`);
  return toStore(row);
}

/** Cities that have at least one active store - drives the store picker UI. */
export async function listStoreCities() {
  const { rows } = await query(
    `SELECT city, country, COUNT(*) AS store_count
       FROM stores WHERE is_active = TRUE
      GROUP BY city, country
      ORDER BY city ASC`
  );
  return rows.map((r) => ({ city: r.city, country: r.country, storeCount: Number(r.store_count) }));
}

export async function assertStoreExists(storeId) {
  const row = await queryOne('SELECT id FROM stores WHERE id = $1', [storeId]);
  if (!row) throw ApiError.notFound(`Store ${storeId}`);
  return row.id;
}
