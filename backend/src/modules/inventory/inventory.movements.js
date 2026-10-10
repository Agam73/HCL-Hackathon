import { query } from '../../db/pool.js';
import { toOffset } from '../../utils/schemas.js';

export const MOVEMENT_TYPES = ['RESTOCK', 'SALE', 'RESERVE', 'RELEASE', 'ADJUSTMENT', 'RETURN'];

/**
 * Append one row to the stock ledger. Call it inside the same transaction
 * that changes inventory, passing that transaction's client, so the ledger
 * and the balance can never disagree.
 */
export function recordMovement(client, m) {
  return client.query(
    `INSERT INTO inventory_movements
       (store_id, product_id, movement_type, quantity_delta, quantity_after,
        reserved_after, reason, reference_type, reference_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      m.storeId,
      m.productId,
      m.type,
      m.quantityDelta,
      m.quantityAfter,
      m.reservedAfter ?? 0,
      m.reason ?? null,
      m.referenceType ?? null,
      m.referenceId ?? null,
      m.createdBy ?? null,
    ]
  );
}

/** A store's stock history, newest first; optionally for one product or movement type. */
export async function listMovements(storeId, { productId, type, page, size }) {
  const params = [storeId];
  const where = ['m.store_id = $1'];
  if (productId) {
    params.push(productId);
    where.push(`m.product_id = $${params.length}`);
  }
  if (type) {
    params.push(type);
    where.push(`m.movement_type = $${params.length}`);
  }
  params.push(size, toOffset({ page, size }));

  const { rows } = await query(
    `SELECT m.*, p.name AS product_name, u.full_name AS actor_name,
            COUNT(*) OVER() AS total_count
       FROM inventory_movements m
       JOIN products p ON p.id = m.product_id
       LEFT JOIN users u ON u.id = m.created_by
      WHERE ${where.join(' AND ')}
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    items: rows.map((r) => ({
      id: r.id,
      storeId: r.store_id,
      productId: r.product_id,
      productName: r.product_name,
      type: r.movement_type,
      quantityDelta: r.quantity_delta,
      quantityAfter: r.quantity_after,
      reason: r.reason,
      referenceType: r.reference_type,
      referenceId: r.reference_id,
      createdBy: r.created_by ? { id: r.created_by, name: r.actor_name } : null,
      createdAt: r.created_at,
    })),
    totalItems: rows.length > 0 ? Number(rows[0].total_count) : 0,
  };
}
