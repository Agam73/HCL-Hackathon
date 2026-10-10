import { query } from '../../db/pool.js';

const MAX_CANDIDATES = 24;

/** "developer | programming | laptop" - any of the words, stemmed by Postgres. */
const toOrQuery = (keywords) =>
  keywords
    .map((k) => k.replace(/[^a-z0-9]/g, ''))
    .filter(Boolean)
    .join(' | ') || null;

function toCandidate(row) {
  const quantity = row.store_quantity;
  const atStore = row.scoped_store_id
    ? {
        scope: 'STORE',
        storeId: row.scoped_store_id,
        quantityAvailable: quantity ?? 0,
        status:
          (quantity ?? 0) <= 0
            ? 'OUT_OF_STOCK'
            : quantity <= (row.store_reorder_level ?? 0)
              ? 'LOW_STOCK'
              : 'IN_STOCK',
      }
    : null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    brand: row.brand_name,
    category: row.category_name,
    price: row.price,
    mrp: row.mrp,
    rating: row.rating,
    ratingCount: row.rating_count,
    specifications: row.specifications ?? {},
    image: (row.images ?? [])[0] ?? null,
    textRank: Number(row.text_rank ?? 0),
    availability: atStore ?? {
      scope: 'ALL_STORES',
      storeId: null,
      quantityAvailable: row.total_available,
      storesWithStock: row.stores_with_stock,
      status: row.total_available > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
    },
  };
}

async function search(intent, storeId, { useBudget }) {
  const params = [];
  const bind = (v) => {
    params.push(v);
    return `$${params.length}`;
  };
  const where = ['vc.is_active = TRUE'];

  const orQuery = toOrQuery(intent.keywords);
  const tsq = orQuery ? `to_tsquery('english', ${bind(orQuery)})` : null;
  const rank = tsq ? `ts_rank(vc.search_vector, ${tsq})` : '0';

  if (intent.categories.length) {
    // A known product type narrows the field; the words then only rank within it.
    where.push(`vc.category_id IN (
      WITH RECURSIVE tree AS (
        SELECT id FROM categories WHERE slug = ANY(${bind(intent.categories)}::text[])
        UNION ALL
        SELECT c.id FROM categories c JOIN tree t ON c.parent_id = t.id
      )
      SELECT id FROM tree
    )`);
  } else if (tsq && intent.brandIds.length === 0) {
    where.push(`vc.search_vector @@ ${tsq}`);
  }
  if (intent.brandIds.length) where.push(`vc.brand_id = ANY(${bind(intent.brandIds)}::text[])`);
  if (useBudget && intent.budget.min != null) where.push(`vc.price >= ${bind(intent.budget.min)}`);
  if (useBudget && intent.budget.max != null) where.push(`vc.price <= ${bind(intent.budget.max)}`);

  let storeSelect = `, NULL::text AS scoped_store_id, NULL::int AS store_quantity, NULL::int AS store_reorder_level`;
  if (storeId) {
    const s = bind(storeId);
    storeSelect = `, ${s}::text AS scoped_store_id,
      (SELECT i.quantity_available FROM inventory i WHERE i.product_id = vc.id AND i.store_id = ${s}) AS store_quantity,
      (SELECT i.reorder_level FROM inventory i WHERE i.product_id = vc.id AND i.store_id = ${s}) AS store_reorder_level`;
  }

  const { rows } = await query(
    `SELECT vc.id, vc.name, vc.description, vc.price, vc.mrp, vc.rating, vc.rating_count,
            vc.specifications, vc.images, vc.brand_name, vc.category_name,
            vc.total_available, vc.stores_with_stock, ${rank} AS text_rank ${storeSelect}
       FROM v_product_catalog vc
      WHERE ${where.join(' AND ')}
      ORDER BY ${rank} DESC, vc.rating DESC, vc.rating_count DESC, vc.id ASC
      LIMIT ${bind(MAX_CANDIDATES)}`,
    params
  );
  return rows.map(toCandidate);
}

/**
 * The catalogue products a recommendation may be drawn from. Everything the
 * model later says is checked against this list, so it cannot recommend a
 * product that does not exist, is retired, or is outside the stated budget.
 *
 * If the budget rules out everything, it is relaxed and `budgetRelaxed` says so.
 */
export async function findCandidates(intent, storeId) {
  const hasBudget = intent.budget.min != null || intent.budget.max != null;
  let candidates = await search(intent, storeId, { useBudget: true });
  let budgetRelaxed = false;
  if (candidates.length === 0 && hasBudget) {
    candidates = await search(intent, storeId, { useBudget: false });
    budgetRelaxed = candidates.length > 0;
  }
  return { candidates, budgetRelaxed };
}
