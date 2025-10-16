-- ============================================
-- 002_rls.sql - Row Level Security Policies
-- E-commerce Supabase Backend
-- ============================================

-- 1. HABILITAR RLS EM TODAS AS TABELAS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;

-- 2. HELPER FUNCTIONS PARA RLS
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    COALESCE(
      current_setting('request.jwt.claims', true)::json->>'role',
      ''
    ) = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    COALESCE(
      current_setting('request.jwt.claims', true)::json->>'sub',
      NULL
    )::uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. POLICIES PARA PROFILES
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING (auth_uid = current_user_id());

CREATE POLICY "profiles_select_admin"
  ON profiles FOR SELECT
  USING (is_admin());

CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  WITH CHECK (auth_uid = current_user_id());

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (auth_uid = current_user_id())
  WITH CHECK (auth_uid = current_user_id());

CREATE POLICY "profiles_update_admin"
  ON profiles FOR UPDATE
  USING (is_admin());

-- 4. POLICIES PARA PRODUCTS
CREATE POLICY "products_select_public"
  ON products FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "products_select_admin"
  ON products FOR SELECT
  USING (is_admin());

CREATE POLICY "products_insert_admin"
  ON products FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "products_update_admin"
  ON products FOR UPDATE
  USING (is_admin());

CREATE POLICY "products_delete_admin"
  ON products FOR DELETE
  USING (is_admin());

-- 5. POLICIES PARA ORDERS
CREATE POLICY "orders_select_own"
  ON orders FOR SELECT
  USING (
    customer_id = (
      SELECT id FROM profiles WHERE auth_uid = current_user_id()
    )
  );

CREATE POLICY "orders_select_admin"
  ON orders FOR SELECT
  USING (is_admin());

CREATE POLICY "orders_insert_own"
  ON orders FOR INSERT
  WITH CHECK (
    customer_id = (
      SELECT id FROM profiles WHERE auth_uid = current_user_id()
    )
  );

CREATE POLICY "orders_insert_admin"
  ON orders FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "orders_update_own_draft"
  ON orders FOR UPDATE
  USING (
    customer_id = (
      SELECT id FROM profiles WHERE auth_uid = current_user_id()
    )
    AND status = 'draft'
  )
  WITH CHECK (
    customer_id = (
      SELECT id FROM profiles WHERE auth_uid = current_user_id()
    )
    AND status = 'draft'
  );

CREATE POLICY "orders_update_admin"
  ON orders FOR UPDATE
  USING (is_admin());

CREATE POLICY "orders_delete_admin"
  ON orders FOR DELETE
  USING (is_admin());

-- 6. POLICIES PARA ORDER_ITEMS
CREATE POLICY "order_items_select_own"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
      AND o.customer_id = (
        SELECT id FROM profiles WHERE auth_uid = current_user_id()
      )
    )
  );

CREATE POLICY "order_items_select_admin"
  ON order_items FOR SELECT
  USING (is_admin());

CREATE POLICY "order_items_insert_own"
  ON order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
      AND o.customer_id = (
        SELECT id FROM profiles WHERE auth_uid = current_user_id()
      )
      AND o.status = 'draft'
    )
  );

CREATE POLICY "order_items_insert_admin"
  ON order_items FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "order_items_update_own"
  ON order_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
      AND o.customer_id = (
        SELECT id FROM profiles WHERE auth_uid = current_user_id()
      )
      AND o.status = 'draft'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
      AND o.customer_id = (
        SELECT id FROM profiles WHERE auth_uid = current_user_id()
      )
      AND o.status = 'draft'
    )
  );

CREATE POLICY "order_items_update_admin"
  ON order_items FOR UPDATE
  USING (is_admin());

CREATE POLICY "order_items_delete_own"
  ON order_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
      AND o.customer_id = (
        SELECT id FROM profiles WHERE auth_uid = current_user_id()
      )
      AND o.status = 'draft'
    )
  );

CREATE POLICY "order_items_delete_admin"
  ON order_items FOR DELETE
  USING (is_admin());

-- 7. POLICIES PARA ORDER_EVENTS
CREATE POLICY "order_events_select_own"
  ON order_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_events.order_id
      AND o.customer_id = (
        SELECT id FROM profiles WHERE auth_uid = current_user_id()
      )
    )
  );

CREATE POLICY "order_events_select_admin"
  ON order_events FOR SELECT
  USING (is_admin());

CREATE POLICY "order_events_insert_admin"
  ON order_events FOR INSERT
  WITH CHECK (is_admin());

-- 8. GRANT PERMISSIONS
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT ON profiles TO authenticated;
GRANT SELECT ON products TO authenticated, anon;
GRANT SELECT ON orders TO authenticated;
GRANT SELECT ON order_items TO authenticated;
GRANT SELECT ON order_events TO authenticated;

GRANT INSERT, UPDATE ON profiles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON orders TO authenticated;
GRANT INSERT, UPDATE, DELETE ON order_items TO authenticated;

GRANT SELECT ON vw_customer_orders TO authenticated;
GRANT SELECT ON vw_product_stock TO authenticated, anon;
GRANT SELECT ON vw_order_details TO authenticated;

-- Mensagem de sucesso
DO $$
BEGIN
  RAISE NOTICE '✅ Políticas RLS configuradas com sucesso!';
END $$;