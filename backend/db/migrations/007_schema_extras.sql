-- =====================================================================
-- Additions taken from the team's canonical schema proposal (db/schema.sql),
-- fitted onto the existing tables. Nothing existing is dropped or renamed.
--
--   inventory_movements  append-only ledger of every stock change
--   ticket_messages      conversation thread on a support ticket
--   product_images       per-image rows with an is_primary flag (a view
--                        over products.images, so there is one source of truth)
--   orders               tax, idempotency_key
--   support_tickets      store_id, is_escalated
--   user_role            SUPPORT_AGENT
-- =====================================================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'SUPPORT_AGENT';

-- ---------------------------------------------------------------------
-- Stock ledger: one row per change, with the balance after it.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_movements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id       TEXT NOT NULL REFERENCES stores(id)   ON DELETE CASCADE,
  product_id     TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type  TEXT NOT NULL CHECK (
                   movement_type IN ('RESTOCK', 'SALE', 'RESERVE', 'RELEASE', 'ADJUSTMENT', 'RETURN')
                 ),
  quantity_delta INT  NOT NULL,
  reserved_delta INT  NOT NULL DEFAULT 0,
  quantity_after INT  NOT NULL CHECK (quantity_after >= 0),
  reserved_after INT  NOT NULL DEFAULT 0 CHECK (reserved_after >= 0),
  reason         TEXT,
  reference_type TEXT,                       -- e.g. 'ORDER'
  reference_id   UUID,                       -- e.g. orders.id
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inv_movements_store
  ON inventory_movements(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_movements_product
  ON inventory_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_movements_reference
  ON inventory_movements(reference_type, reference_id);

-- ---------------------------------------------------------------------
-- Orders: tax line and safe retries of checkout.
-- Catalogue prices are tax-inclusive, so tax stays 0 until that changes.
-- ---------------------------------------------------------------------
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tax >= 0);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
-- The same customer sending the same key twice gets the same order back.
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency
  ON orders(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ---------------------------------------------------------------------
-- Support: which store a ticket concerns, escalation flag, message thread.
-- ---------------------------------------------------------------------
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS store_id TEXT REFERENCES stores(id) ON DELETE SET NULL;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS is_escalated BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_tickets_store    ON support_tickets(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON support_tickets(assigned_to);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message    TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id, created_at);

-- ---------------------------------------------------------------------
-- product_images: one row per image, first image is the primary one.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW product_images WITH (security_invoker = true) AS
SELECT p.id                AS product_id,
       img.image_url,
       img.position::int   AS position,
       (img.position = 1)  AS is_primary
  FROM products p
 CROSS JOIN LATERAL unnest(p.images) WITH ORDINALITY AS img(image_url, position);

-- Same lock-down as every other table (see 005_row_level_security.sql).
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages     ENABLE ROW LEVEL SECURITY;
