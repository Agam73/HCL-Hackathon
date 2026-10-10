-- =====================================================================
-- Convenience views. Add new migrations as 003_*.sql, 004_*.sql ...
-- The migrate script runs files in filename order and records them in
-- schema_migrations, so re-running is safe.
-- =====================================================================

-- Per-store availability with a derived status string the API/agents can use.
CREATE OR REPLACE VIEW v_product_availability AS
SELECT
  i.product_id,
  i.store_id,
  s.name  AS store_name,
  s.city  AS store_city,
  s.type  AS store_type,
  i.quantity_available,
  i.quantity_reserved,
  i.reorder_level,
  CASE
    WHEN i.quantity_available <= 0                  THEN 'OUT_OF_STOCK'
    WHEN i.quantity_available <= i.reorder_level    THEN 'LOW_STOCK'
    ELSE 'IN_STOCK'
  END AS availability,
  i.last_synced_at
FROM inventory i
JOIN stores s ON s.id = i.store_id;

-- Catalog row shaped the way the product list/detail endpoints return it.
CREATE OR REPLACE VIEW v_product_catalog AS
SELECT
  p.id,
  p.name,
  p.slug,
  p.description,
  p.price,
  p.mrp,
  p.currency,
  p.rating,
  p.rating_count,
  p.warranty_months,
  p.specifications,
  p.images,
  p.is_active,
  p.created_at,
  p.search_vector,
  b.id   AS brand_id,
  b.name AS brand_name,
  c.id   AS category_id,
  c.name AS category_name,
  pc.id  AS parent_category_id,
  pc.name AS parent_category_name,
  COALESCE(stock.total_available, 0) AS total_available,
  COALESCE(stock.store_count, 0)     AS stores_with_stock
FROM products p
JOIN brands b      ON b.id = p.brand_id
JOIN categories c  ON c.id = p.category_id
LEFT JOIN categories pc ON pc.id = c.parent_id
LEFT JOIN (
  SELECT product_id,
         SUM(quantity_available)                              AS total_available,
         COUNT(*) FILTER (WHERE quantity_available > 0)        AS store_count
  FROM inventory
  GROUP BY product_id
) stock ON stock.product_id = p.id;

-- Replenishment feed for the inventory agent / store manager dashboard.
CREATE OR REPLACE VIEW v_low_stock AS
SELECT
  i.store_id,
  s.name AS store_name,
  i.product_id,
  p.name AS product_name,
  c.name AS category_name,
  i.quantity_available,
  i.reorder_level,
  (i.reorder_level - i.quantity_available) AS shortfall
FROM inventory i
JOIN stores s     ON s.id = i.store_id
JOIN products p   ON p.id = i.product_id
JOIN categories c ON c.id = p.category_id
WHERE i.quantity_available <= i.reorder_level
ORDER BY shortfall DESC;
