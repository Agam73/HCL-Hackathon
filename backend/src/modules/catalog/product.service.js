import { query, queryOne } from '../../db/pool.js';
import ApiError from '../../utils/ApiError.js';
import { toOffset } from '../../utils/schemas.js';

/** DB row -> API product object. */
function toProduct(row) {
  const product = {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    price: row.price,
    mrp: row.mrp,
    discountPercent:
      row.mrp && row.mrp > 0 ? Math.round(((row.mrp - row.price) / row.mrp) * 100) : 0,
    currency: row.currency,
    rating: row.rating,
    ratingCount: row.rating_count,
    warrantyMonths: row.warranty_months,
    specifications: row.specifications ?? {},
    images: row.images ?? [],
    isActive: row.is_active,
    brand: { id: row.brand_id, name: row.brand_name },
    category: {
      id: row.category_id,
      name: row.category_name,
      parentId: row.parent_category_id,
      parentName: row.parent_category_name,
    },
    stock: {
      totalAvailable: row.total_available ?? 0,
      storesWithStock: row.stores_with_stock ?? 0,
      availability: (row.total_available ?? 0) > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
    },
  };

  // Present only when the caller filtered/scoped by a store.
  if (row.store_quantity !== undefined && row.store_quantity !== null) {
    product.storeStock = {
      storeId: row.scoped_store_id,
      quantityAvailable: row.store_quantity,
      availability: row.store_quantity > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
    };
  }
  return product;
}

const SELECT_COLUMNS = `
  vc.id, vc.name, vc.slug, vc.description, vc.price, vc.mrp, vc.currency,
  vc.rating, vc.rating_count, vc.warranty_months, vc.specifications, vc.images,
  vc.is_active, vc.brand_id, vc.brand_name, vc.category_id, vc.category_name,
  vc.parent_category_id, vc.parent_category_name,
  vc.total_available, vc.stores_with_stock
`;

/**
 * Product search + filter + sort + pagination.
 * Returns { items, totalItems }.
 */
export async function listProducts(filters) {
  const params = [];
  const where = ['vc.is_active = TRUE'];
  const bind = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  // --- full text + fuzzy search ---
  let rankExpr = null;
  if (filters.q) {
    const q = bind(filters.q);
    where.push(`(
      vc.search_vector @@ websearch_to_tsquery('english', ${q})
      OR vc.name ILIKE '%' || ${q} || '%'
      OR vc.brand_name ILIKE '%' || ${q} || '%'
      OR similarity(vc.name, ${q}) > 0.25
    )`);
    rankExpr = `GREATEST(
      ts_rank(vc.search_vector, websearch_to_tsquery('english', ${q})),
      similarity(vc.name, ${q})
    )`;
  }

  // --- category (includes sub-categories) ---
  if (filters.categoryId?.length || filters.categorySlug?.length) {
    const ids = bind(filters.categoryId ?? []);
    const slugs = bind(filters.categorySlug ?? []);
    where.push(`vc.category_id IN (
      WITH RECURSIVE tree AS (
        SELECT id FROM categories
         WHERE id = ANY(${ids}::text[]) OR slug = ANY(${slugs}::text[])
        UNION ALL
        SELECT c.id FROM categories c JOIN tree t ON c.parent_id = t.id
      )
      SELECT id FROM tree
    )`);
  }

  if (filters.brandId?.length) where.push(`vc.brand_id = ANY(${bind(filters.brandId)}::text[])`);
  if (filters.minPrice !== undefined) where.push(`vc.price >= ${bind(filters.minPrice)}`);
  if (filters.maxPrice !== undefined) where.push(`vc.price <= ${bind(filters.maxPrice)}`);
  if (filters.minRating !== undefined) where.push(`vc.rating >= ${bind(filters.minRating)}`);

  // --- availability ---
  let storeSelect = '';
  if (filters.storeId) {
    const storeId = bind(filters.storeId);
    storeSelect = `,
      ${storeId} AS scoped_store_id,
      (SELECT i.quantity_available FROM inventory i
        WHERE i.product_id = vc.id AND i.store_id = ${storeId}) AS store_quantity`;
    if (filters.inStockOnly) {
      where.push(`EXISTS (
        SELECT 1 FROM inventory i
         WHERE i.product_id = vc.id AND i.store_id = ${storeId} AND i.quantity_available > 0
      )`);
    }
  } else if (filters.inStockOnly) {
    where.push('vc.total_available > 0');
  }

  // --- sorting ---
  const sort = filters.sort ?? (filters.q ? 'relevance' : 'rating_desc');
  const orderBy = {
    relevance: rankExpr ? `${rankExpr} DESC, vc.rating DESC` : 'vc.rating DESC',
    price_asc: 'vc.price ASC',
    price_desc: 'vc.price DESC',
    rating_desc: 'vc.rating DESC, vc.rating_count DESC',
    name_asc: 'vc.name ASC',
    newest: 'vc.created_at DESC',
  }[sort];

  const limit = bind(filters.size);
  const offset = bind(toOffset(filters));

  const sql = `
    SELECT ${SELECT_COLUMNS}${storeSelect},
           COUNT(*) OVER() AS total_count
      FROM v_product_catalog vc
     WHERE ${where.join('\n       AND ')}
     ORDER BY ${orderBy}, vc.id ASC
     LIMIT ${limit} OFFSET ${offset}
  `;

  const { rows } = await query(sql, params);
  return {
    items: rows.map(toProduct),
    totalItems: rows.length > 0 ? Number(rows[0].total_count) : 0,
  };
}

/** Product detail: product + per-store availability + related products. */
export async function getProductDetail(productId) {
  const row = await queryOne(
    `SELECT ${SELECT_COLUMNS} FROM v_product_catalog vc WHERE vc.id = $1`,
    [productId]
  );
  if (!row) throw ApiError.notFound(`Product ${productId}`);

  const [availability, related] = await Promise.all([
    query(
      `SELECT store_id, store_name, store_city, store_type,
              quantity_available, availability, last_synced_at
         FROM v_product_availability
        WHERE product_id = $1
        ORDER BY quantity_available DESC, store_name ASC`,
      [productId]
    ),
    query(
      `SELECT ${SELECT_COLUMNS}
         FROM v_product_catalog vc
        WHERE vc.category_id = $1 AND vc.id <> $2 AND vc.is_active = TRUE
        ORDER BY vc.rating DESC
        LIMIT 6`,
      [row.category_id, productId]
    ),
  ]);

  return {
    ...toProduct(row),
    availabilityByStore: availability.rows.map((a) => ({
      storeId: a.store_id,
      storeName: a.store_name,
      city: a.store_city,
      storeType: a.store_type,
      quantityAvailable: a.quantity_available,
      availability: a.availability,
      lastSyncedAt: a.last_synced_at,
    })),
    relatedProducts: related.rows.map(toProduct),
  };
}

/** Availability of one product across stores, optionally filtered by city/country. */
export async function getProductAvailability(productId, { city, country, inStockOnly }) {
  const exists = await queryOne('SELECT 1 FROM products WHERE id = $1', [productId]);
  if (!exists) throw ApiError.notFound(`Product ${productId}`);

  const params = [productId];
  const where = ['a.product_id = $1'];
  if (city) {
    params.push(city);
    where.push(`a.store_city ILIKE $${params.length}`);
  }
  if (country) {
    params.push(country);
    where.push(`s.country = $${params.length}`);
  }
  if (inStockOnly) where.push('a.quantity_available > 0');

  const { rows } = await query(
    `SELECT a.*, s.country
       FROM v_product_availability a
       JOIN stores s ON s.id = a.store_id
      WHERE ${where.join(' AND ')}
      ORDER BY a.quantity_available DESC, a.store_name ASC`,
    params
  );

  return rows.map((r) => ({
    storeId: r.store_id,
    storeName: r.store_name,
    city: r.store_city,
    country: r.country,
    storeType: r.store_type,
    quantityAvailable: r.quantity_available,
    reorderLevel: r.reorder_level,
    availability: r.availability,
    lastSyncedAt: r.last_synced_at,
  }));
}

export async function listBrands() {
  const { rows } = await query(
    `SELECT b.id, b.name, b.slug, b.logo_url,
            COUNT(p.id) FILTER (WHERE p.is_active) AS product_count
       FROM brands b
       LEFT JOIN products p ON p.brand_id = b.id
      GROUP BY b.id
      ORDER BY b.name ASC`
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    logoUrl: r.logo_url,
    productCount: Number(r.product_count),
  }));
}

export async function listCategories({ tree = false } = {}) {
  const { rows } = await query(
    `SELECT c.id, c.name, c.slug, c.parent_id, c.sort_order,
            COUNT(p.id) FILTER (WHERE p.is_active) AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY c.sort_order ASC, c.name ASC`
  );

  const flat = rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    parentId: r.parent_id,
    productCount: Number(r.product_count),
  }));

  if (!tree) return flat;

  const byId = new Map(flat.map((c) => [c.id, { ...c, children: [] }]));
  const roots = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId).children.push(node);
    else roots.push(node);
  }
  return roots;
}
