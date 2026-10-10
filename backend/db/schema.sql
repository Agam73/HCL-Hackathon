-- RetailPulse AI canonical schema
-- PostgreSQL 16 + pgvector
-- Applied by scripts/migrate.ts via db/migrations/001_init.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_code TEXT NOT NULL UNIQUE,
  store_name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'India',
  postal_code TEXT NOT NULL,
  latitude NUMERIC(9, 6) NOT NULL,
  longitude NUMERIC(9, 6) NOT NULL,
  contact_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT stores_latitude_check CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT stores_longitude_check CHECK (longitude BETWEEN -180 AND 180)
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  store_id UUID REFERENCES stores(id) ON DELETE RESTRICT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_role_check CHECK (
    role IN ('CUSTOMER', 'STORE_MANAGER', 'SUPPORT_AGENT', 'ADMIN')
  ),
  CONSTRAINT users_store_role_check CHECK (
    (role = 'STORE_MANAGER' AND store_id IS NOT NULL)
    OR (role <> 'STORE_MANAGER' AND store_id IS NULL)
  ),
  CONSTRAINT users_password_hash_check CHECK (length(password_hash) >= 50)
);

CREATE TABLE customer_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  membership_tier TEXT NOT NULL DEFAULT 'BRONZE',
  preferred_store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  country TEXT NOT NULL DEFAULT 'India',
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT customer_profiles_tier_check CHECK (
    membership_tier IN ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM')
  )
);

CREATE OR REPLACE FUNCTION ensure_customer_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM users WHERE id = NEW.user_id;
  IF user_role IS DISTINCT FROM 'CUSTOMER' THEN
    RAISE EXCEPTION 'customer profile requires CUSTOMER role';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER customer_profiles_role_check
BEFORE INSERT OR UPDATE ON customer_profiles
FOR EACH ROW EXECUTE FUNCTION ensure_customer_profile_role();

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  CONSTRAINT categories_parent_not_self CHECK (parent_category_id IS DISTINCT FROM id)
);

CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  price NUMERIC(12, 2) NOT NULL,
  specifications JSONB NOT NULL DEFAULT '{}'::jsonb,
  rating NUMERIC(3, 2) NOT NULL DEFAULT 0,
  embedding vector(1536),
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector(
      'simple',
      coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(sku, '')
    )
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT products_price_check CHECK (price >= 0),
  CONSTRAINT products_rating_check CHECK (rating >= 0 AND rating <= 5)
);

CREATE TABLE product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX product_images_one_primary
ON product_images (product_id)
WHERE is_primary;

CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 5,
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT inventory_store_product_unique UNIQUE (store_id, product_id),
  CONSTRAINT inventory_quantity_check CHECK (quantity >= 0),
  CONSTRAINT inventory_reserved_nonnegative_check CHECK (reserved_quantity >= 0),
  CONSTRAINT inventory_reserved_lte_quantity_check CHECK (reserved_quantity <= quantity),
  CONSTRAINT inventory_reorder_check CHECK (reorder_level >= 0),
  CONSTRAINT inventory_version_check CHECK (version >= 1)
);

CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL,
  quantity_delta INTEGER NOT NULL,
  reserved_delta INTEGER NOT NULL DEFAULT 0,
  quantity_after INTEGER NOT NULL,
  reserved_after INTEGER NOT NULL,
  reason TEXT,
  reference_type TEXT,
  reference_id UUID,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_movements_type_check CHECK (
    movement_type IN ('RESTOCK', 'SALE', 'RESERVE', 'RELEASE', 'ADJUSTMENT', 'RETURN')
  ),
  CONSTRAINT inventory_movements_after_check CHECK (
    quantity_after >= 0
    AND reserved_after >= 0
    AND reserved_after <= quantity_after
  )
);

CREATE TABLE carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cart_items_unique UNIQUE (cart_id, product_id),
  CONSTRAINT cart_items_quantity_check CHECK (quantity > 0 AND quantity <= 99)
);

CREATE SEQUENCE order_number_seq START 1001;

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  status TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  subtotal NUMERIC(12, 2) NOT NULL,
  tax NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT orders_customer_idempotency_unique UNIQUE (customer_id, idempotency_key),
  CONSTRAINT orders_status_check CHECK (
    status IN ('PENDING', 'CONFIRMED', 'PAID', 'CANCELLED', 'FULFILLED')
  ),
  CONSTRAINT orders_payment_status_check CHECK (
    payment_status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')
  ),
  CONSTRAINT orders_payment_method_check CHECK (
    payment_method IN ('CARD', 'UPI', 'COD')
  ),
  CONSTRAINT orders_money_check CHECK (subtotal >= 0 AND tax >= 0 AND total >= 0)
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(12, 2) NOT NULL,
  line_total NUMERIC(12, 2) NOT NULL,
  CONSTRAINT order_items_quantity_check CHECK (quantity > 0),
  CONSTRAINT order_items_price_check CHECK (unit_price >= 0 AND line_total >= 0)
);

CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  is_escalated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT support_tickets_category_check CHECK (
    category IN ('ORDER', 'PRODUCT', 'DELIVERY', 'PAYMENT', 'STORE', 'OTHER')
  ),
  CONSTRAINT support_tickets_priority_check CHECK (
    priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')
  ),
  CONSTRAINT support_tickets_status_check CHECK (
    status IN ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED')
  ),
  CONSTRAINT support_tickets_subject_check CHECK (char_length(subject) BETWEEN 5 AND 160)
);

CREATE TABLE ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ticket_messages_length_check CHECK (char_length(message) BETWEEN 1 AND 4000)
);

CREATE INDEX users_role_idx ON users (role);
CREATE INDEX users_store_id_idx ON users (store_id);
CREATE INDEX customer_profiles_preferred_store_idx ON customer_profiles (preferred_store_id);
CREATE INDEX categories_parent_idx ON categories (parent_category_id);
CREATE INDEX products_category_idx ON products (category_id);
CREATE INDEX products_brand_idx ON products (brand_id);
CREATE INDEX products_price_idx ON products (price);
CREATE INDEX products_rating_idx ON products (rating);
CREATE INDEX products_search_idx ON products USING GIN (search_vector);
CREATE INDEX products_embedding_hnsw ON products USING hnsw (embedding vector_cosine_ops);
CREATE INDEX product_images_product_idx ON product_images (product_id);
CREATE INDEX inventory_store_idx ON inventory (store_id);
CREATE INDEX inventory_product_idx ON inventory (product_id);
CREATE INDEX inventory_movements_store_idx ON inventory_movements (store_id, created_at DESC);
CREATE INDEX inventory_movements_product_idx ON inventory_movements (product_id, created_at DESC);
CREATE INDEX inventory_movements_reference_idx ON inventory_movements (reference_type, reference_id);
CREATE INDEX carts_store_idx ON carts (store_id);
CREATE INDEX orders_customer_idx ON orders (customer_id, created_at DESC);
CREATE INDEX orders_store_idx ON orders (store_id, created_at DESC);
CREATE INDEX order_items_order_idx ON order_items (order_id);
CREATE INDEX order_items_product_idx ON order_items (product_id);
CREATE INDEX support_tickets_customer_idx ON support_tickets (customer_id, created_at DESC);
CREATE INDEX support_tickets_store_idx ON support_tickets (store_id, created_at DESC);
CREATE INDEX support_tickets_status_idx ON support_tickets (status);
CREATE INDEX support_tickets_assigned_idx ON support_tickets (assigned_to);
CREATE INDEX ticket_messages_ticket_idx ON ticket_messages (ticket_id, created_at);
