-- =====================================================================
-- Order details needed by checkout: how the customer chose to receive and
-- pay for the order, and the reward points the order earned.
-- =====================================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_speed TEXT
  CHECK (delivery_speed IS NULL OR delivery_speed IN ('STANDARD', 'EXPRESS'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS reward_points INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_orders_store_status ON orders(store_id, status, placed_at DESC);
