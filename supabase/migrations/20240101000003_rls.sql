ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON profiles
    FOR SELECT USING (auth_uid = auth.uid());

CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE USING (auth_uid = auth.uid());

CREATE POLICY "profiles_insert_own" ON profiles
    FOR INSERT WITH CHECK (auth_uid = auth.uid());

CREATE POLICY "products_select_all" ON products
    FOR SELECT USING (is_active = true);

CREATE POLICY "orders_select_own" ON orders
    FOR SELECT USING (customer_id IN (SELECT id FROM profiles WHERE auth_uid = auth.uid()));

CREATE POLICY "orders_insert_own" ON orders
    FOR INSERT WITH CHECK (customer_id IN (SELECT id FROM profiles WHERE auth_uid = auth.uid()));

CREATE POLICY "orders_update_own" ON orders
    FOR UPDATE USING (
        customer_id IN (SELECT id FROM profiles WHERE auth_uid = auth.uid())
        AND status = 'draft'
    );

CREATE POLICY "order_items_select_own" ON order_items
    FOR SELECT USING (
        order_id IN (
            SELECT id FROM orders 
            WHERE customer_id IN (SELECT id FROM profiles WHERE auth_uid = auth.uid())
        )
    );

CREATE POLICY "order_items_insert_own" ON order_items
    FOR INSERT WITH CHECK (
        order_id IN (
            SELECT id FROM orders 
            WHERE customer_id IN (SELECT id FROM profiles WHERE auth_uid = auth.uid())
            AND status = 'draft'
        )
    );

CREATE POLICY "order_items_update_own" ON order_items
    FOR UPDATE USING (
        order_id IN (
            SELECT id FROM orders 
            WHERE customer_id IN (SELECT id FROM profiles WHERE auth_uid = auth.uid())
            AND status = 'draft'
        )
    );

CREATE POLICY "order_events_select_own" ON order_events
    FOR SELECT USING (
        order_id IN (
            SELECT id FROM orders 
            WHERE customer_id IN (SELECT id FROM profiles WHERE auth_uid = auth.uid())
        )
    );