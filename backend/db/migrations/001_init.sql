-- =====================================================================
-- RetailPulse AI - initial schema
-- Covers: catalog, stores, inventory, customers/tiers, cart, orders,
--         support tickets, RAG knowledge base (pgvector), agent audit log.
-- Run with: npm run db:migrate
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS vector;   -- Module 2: embeddings / similarity search
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- fuzzy product name search

-- ---------------------------------------------------------------------
-- Enums (values come straight from the use-case document)
-- ---------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE user_role        AS ENUM ('CUSTOMER', 'STORE_MANAGER', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE membership_tier  AS ENUM ('STANDARD', 'SILVER', 'GOLD', 'PLATINUM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE store_type       AS ENUM ('STORE', 'WAREHOUSE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fulfillment_type AS ENUM ('IN_STORE_PICKUP', 'HOME_DELIVERY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_status     AS ENUM ('PENDING', 'CONFIRMED', 'PACKED', 'SHIPPED',
                                        'READY_FOR_PICKUP', 'DELIVERED', 'CANCELLED', 'RETURNED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ticket_status    AS ENUM ('OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ticket_priority  AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS brands (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  slug        TEXT NOT NULL UNIQUE,
  logo_url    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  parent_id   TEXT REFERENCES categories(id) ON DELETE SET NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);

CREATE TABLE IF NOT EXISTS products (
  id              TEXT PRIMARY KEY,                       -- e.g. 'P101'
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  description     TEXT,
  keywords        TEXT,                                   -- extra search terms, comma separated
  category_id     TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  brand_id        TEXT NOT NULL REFERENCES brands(id)     ON DELETE RESTRICT,
  price           NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  mrp             NUMERIC(12,2) CHECK (mrp IS NULL OR mrp >= price),
  currency        CHAR(3) NOT NULL DEFAULT 'INR',
  specifications  JSONB NOT NULL DEFAULT '{}'::jsonb,
  images          TEXT[] NOT NULL DEFAULT '{}',
  rating          NUMERIC(2,1) NOT NULL DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  rating_count    INT NOT NULL DEFAULT 0 CHECK (rating_count >= 0),
  warranty_months INT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  search_vector   tsvector GENERATED ALWAYS AS (
                    to_tsvector('english',
                      coalesce(name, '') || ' ' ||
                      coalesce(description, '') || ' ' ||
                      coalesce(keywords, ''))
                  ) STORED
);
CREATE INDEX IF NOT EXISTS idx_products_search   ON products USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_brand    ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_price    ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_specs    ON products USING GIN (specifications);

-- ---------------------------------------------------------------------
-- Stores & inventory
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stores (
  id           TEXT PRIMARY KEY,                          -- e.g. 'ST-DEL-01'
  name         TEXT NOT NULL,
  type         store_type NOT NULL DEFAULT 'STORE',
  address_line TEXT,
  city         TEXT NOT NULL,
  state        TEXT,
  country      TEXT NOT NULL DEFAULT 'IN',
  postal_code  TEXT,
  latitude     NUMERIC(9,6),
  longitude    NUMERIC(9,6),
  phone        TEXT,
  opens_at     TIME,
  closes_at    TIME,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stores_city    ON stores(city);
CREATE INDEX IF NOT EXISTS idx_stores_country ON stores(country);

CREATE TABLE IF NOT EXISTS inventory (
  store_id           TEXT NOT NULL REFERENCES stores(id)   ON DELETE CASCADE,
  product_id         TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity_available INT  NOT NULL DEFAULT 0 CHECK (quantity_available >= 0),
  quantity_reserved  INT  NOT NULL DEFAULT 0 CHECK (quantity_reserved  >= 0),
  reorder_level      INT  NOT NULL DEFAULT 5 CHECK (reorder_level >= 0),
  last_synced_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_low     ON inventory(store_id)
  WHERE quantity_available <= reorder_level;

-- ---------------------------------------------------------------------
-- Users / customers
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             TEXT NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL,
  full_name         TEXT NOT NULL,
  phone             TEXT,
  role              user_role NOT NULL DEFAULT 'CUSTOMER',
  membership_tier   membership_tier NOT NULL DEFAULT 'STANDARD',
  city              TEXT,
  country           TEXT NOT NULL DEFAULT 'IN',
  preferred_store_id TEXT REFERENCES stores(id) ON DELETE SET NULL,
  -- STORE_MANAGER is scoped to the store they manage; NULL for other roles
  managed_store_id  TEXT REFERENCES stores(id) ON DELETE SET NULL,
  preferences       JSONB NOT NULL DEFAULT '{}'::jsonb,   -- { categories: [], brands: [], budgetMax: n }
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_tier ON users(membership_tier);

-- ---------------------------------------------------------------------
-- Cart
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS carts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_id   TEXT REFERENCES stores(id) ON DELETE SET NULL,  -- selected pickup store
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS cart_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id         UUID NOT NULL REFERENCES carts(id)    ON DELETE CASCADE,
  product_id      TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity        INT  NOT NULL CHECK (quantity > 0),
  unit_price      NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  added_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cart_id, product_id)
);

-- ---------------------------------------------------------------------
-- Orders (payment is simulated per the use case)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number     TEXT NOT NULL UNIQUE,
  user_id          UUID NOT NULL REFERENCES users(id)  ON DELETE RESTRICT,
  store_id         TEXT REFERENCES stores(id)          ON DELETE SET NULL,
  fulfillment      fulfillment_type NOT NULL,
  status           order_status NOT NULL DEFAULT 'PENDING',
  subtotal         NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_total   NUMERIC(12,2) NOT NULL DEFAULT 0,
  delivery_fee     NUMERIC(12,2) NOT NULL DEFAULT 0,
  total            NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency         CHAR(3) NOT NULL DEFAULT 'INR',
  shipping_address JSONB,
  payment_status   TEXT NOT NULL DEFAULT 'SIMULATED_PAID',
  placed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_user  ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_store ON orders(store_id);

CREATE TABLE IF NOT EXISTS order_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID NOT NULL REFERENCES orders(id)   ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity   INT  NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC(12,2) NOT NULL CHECK (line_total >= 0)
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- ---------------------------------------------------------------------
-- Support tickets (escalation is simulated)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS support_tickets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL UNIQUE,
  user_id     UUID REFERENCES users(id)  ON DELETE SET NULL,
  order_id    UUID REFERENCES orders(id) ON DELETE SET NULL,
  subject     TEXT NOT NULL,
  body        TEXT,
  category    TEXT,
  status      ticket_status   NOT NULL DEFAULT 'OPEN',
  priority    ticket_priority NOT NULL DEFAULT 'MEDIUM',
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tickets_user   ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);

-- ---------------------------------------------------------------------
-- Module 2: RAG knowledge base
-- Metadata columns mirror the required filters:
-- country, product category, effective date, document type, membership tier.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kb_documents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT NOT NULL,
  doc_type       TEXT NOT NULL,              -- RETURN_POLICY | WARRANTY | SHIPPING | MEMBERSHIP | MANUAL | STORE_SOP
  version        TEXT NOT NULL,              -- e.g. '2026.2'
  effective_date DATE NOT NULL,
  expires_on     DATE,
  country        TEXT,                       -- NULL = applies everywhere
  category_id    TEXT REFERENCES categories(id) ON DELETE SET NULL,
  product_id     TEXT REFERENCES products(id)   ON DELETE SET NULL,  -- for product manuals
  min_tier       membership_tier,            -- NULL = all tiers
  language       TEXT NOT NULL DEFAULT 'en',
  source_uri     TEXT,
  content_hash   TEXT,
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (title, version)
);
CREATE INDEX IF NOT EXISTS idx_kbdocs_type     ON kb_documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_kbdocs_country  ON kb_documents(country);
CREATE INDEX IF NOT EXISTS idx_kbdocs_category ON kb_documents(category_id);
CREATE INDEX IF NOT EXISTS idx_kbdocs_eff      ON kb_documents(effective_date);

-- Dimension 1536 matches OpenAI text-embedding-3-small.
-- Using a different model? Change EMBEDDING_DIM in .env AND the vector(1536) below.
CREATE TABLE IF NOT EXISTS kb_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
  chunk_index INT  NOT NULL,
  section     TEXT,                           -- e.g. 'Opened Electronics'
  content     TEXT NOT NULL,
  token_count INT,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding   vector(1536),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);
CREATE INDEX IF NOT EXISTS idx_kbchunks_doc ON kb_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_kbchunks_embedding
  ON kb_chunks USING hnsw (embedding vector_cosine_ops);

-- ---------------------------------------------------------------------
-- Agent traceability / guardrails (why a recommendation or action happened)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_actions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id       TEXT NOT NULL,
  agent_name     TEXT NOT NULL,              -- INVENTORY | PROMOTION | ORDER | SUPPORT | ORCHESTRATOR
  action         TEXT NOT NULL,              -- e.g. 'RECOMMEND_PRODUCTS', 'FLAG_REPLENISHMENT'
  actor_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  input          JSONB NOT NULL DEFAULT '{}'::jsonb,
  output         JSONB NOT NULL DEFAULT '{}'::jsonb,
  reasoning      TEXT,                       -- human-readable "why"
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  status         TEXT NOT NULL DEFAULT 'EXECUTED',  -- PROPOSED | APPROVED | REJECTED | EXECUTED | BLOCKED
  latency_ms     INT,
  model          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_actions_trace ON agent_actions(trace_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_agent ON agent_actions(agent_name, created_at DESC);

-- ---------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['brands','categories','products','stores','inventory','users',
                           'carts','orders','support_tickets','kb_documents']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I
                    FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END $$;
