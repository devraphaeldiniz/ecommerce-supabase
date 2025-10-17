CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_uid UUID NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  cpf TEXT UNIQUE,
  phone TEXT,
  address JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  category TEXT NOT NULL,
  image_url TEXT,
  images JSONB DEFAULT '[]'::jsonb,
  specifications JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE order_status AS ENUM (
  'draft', 'placed', 'paid', 'processing', 
  'shipped', 'delivered', 'completed', 'cancelled', 'refunded'
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status order_status DEFAULT 'draft',
  total NUMERIC(12,2) DEFAULT 0 CHECK (total >= 0),
  subtotal NUMERIC(12,2) DEFAULT 0 CHECK (subtotal >= 0),
  shipping_cost NUMERIC(12,2) DEFAULT 0 CHECK (shipping_cost >= 0),
  discount NUMERIC(12,2) DEFAULT 0 CHECK (discount >= 0),
  shipping_address JSONB NOT NULL,
  billing_address JSONB,
  payment_method TEXT,
  payment_info JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  product_snapshot JSONB NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total NUMERIC(12,2) NOT NULL CHECK (line_total >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_auth_uid ON profiles(auth_uid);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_active ON products(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_products_name_search ON products USING gin(name gin_trgm_ops);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
CREATE INDEX idx_order_events_order ON order_events(order_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION order_item_compute()
RETURNS TRIGGER AS $$
BEGIN
  NEW.line_total = NEW.unit_price * NEW.quantity;
  
  IF NEW.product_snapshot IS NULL OR NEW.product_snapshot = '{}'::jsonb THEN
    SELECT jsonb_build_object(
      'id', id, 'sku', sku, 'name', name, 
      'description', description, 'price', price, 
      'category', category, 'image_url', image_url
    ) INTO NEW.product_snapshot
    FROM products WHERE id = NEW.product_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_item_line_total
  BEFORE INSERT OR UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION order_item_compute();

CREATE OR REPLACE FUNCTION calculate_order_total(target_order UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_subtotal NUMERIC := 0;
  v_total NUMERIC := 0;
  v_shipping NUMERIC := 0;
  v_discount NUMERIC := 0;
BEGIN
  SELECT COALESCE(SUM(line_total), 0) INTO v_subtotal
  FROM order_items WHERE order_id = target_order;
  
  SELECT shipping_cost, discount INTO v_shipping, v_discount
  FROM orders WHERE id = target_order;
  
  v_total = v_subtotal + COALESCE(v_shipping, 0) - COALESCE(v_discount, 0);
  
  UPDATE orders SET subtotal = v_subtotal, total = v_total, updated_at = NOW()
  WHERE id = target_order;
  
  RETURN v_total;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION order_item_after_change()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id UUID;
BEGIN
  v_order_id = COALESCE(NEW.order_id, OLD.order_id);
  PERFORM calculate_order_total(v_order_id);
  
  INSERT INTO order_events(order_id, event_type, description, metadata)
  VALUES (v_order_id, 'item_changed', 'Item modified', 
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END);
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_items_after
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW EXECUTE FUNCTION order_item_after_change();

CREATE OR REPLACE FUNCTION set_order_status(
  p_order_id UUID, p_status order_status, p_notes TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_old_status order_status;
BEGIN
  SELECT status INTO v_old_status FROM orders WHERE id = p_order_id;
  UPDATE orders SET status = p_status, updated_at = NOW() WHERE id = p_order_id;
  
  INSERT INTO order_events(order_id, event_type, description, metadata)
  VALUES (p_order_id, 'status_changed', 
    COALESCE(p_notes, 'Status changed to ' || p_status),
    jsonb_build_object('old_status', v_old_status, 'new_status', p_status));
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE VIEW vw_customer_orders AS
SELECT o.id AS order_id, o.customer_id, p.full_name, p.email, p.phone,
  o.status, o.subtotal, o.shipping_cost, o.discount, o.total, 
  o.payment_method, o.created_at, o.updated_at, COUNT(oi.id) AS item_count
FROM orders o
JOIN profiles p ON p.id = o.customer_id
LEFT JOIN order_items oi ON oi.order_id = o.id
GROUP BY o.id, p.id;

CREATE OR REPLACE VIEW vw_product_stock AS
SELECT id, sku, name, category, price, stock, image_url, is_active
FROM products WHERE stock > 0 AND is_active = TRUE
ORDER BY category, name;

CREATE OR REPLACE VIEW vw_order_details AS
SELECT o.id AS order_id, o.customer_id, p.full_name AS customer_name,
  p.email AS customer_email, o.status, o.total, o.created_at AS order_date,
  oi.id AS item_id, oi.product_id,
  (oi.product_snapshot->>'name') AS product_name,
  (oi.product_snapshot->>'sku') AS product_sku,
  oi.unit_price, oi.quantity, oi.line_total
FROM orders o
JOIN profiles p ON p.id = o.customer_id
LEFT JOIN order_items oi ON oi.order_id = o.id
ORDER BY o.created_at DESC, oi.id;