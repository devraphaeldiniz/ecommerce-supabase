CREATE TYPE user_role AS ENUM ('customer', 'staff', 'admin', 'super_admin');

CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'customer',
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, is_active),
    CONSTRAINT valid_expiration CHECK (expires_at IS NULL OR expires_at > NOW())
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id) WHERE is_active = true;
CREATE INDEX idx_user_roles_role ON user_roles(role) WHERE is_active = true;

CREATE OR REPLACE FUNCTION create_default_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO user_roles (user_id, role, is_active)
    VALUES (NEW.id, 'customer', true)
    ON CONFLICT (user_id, is_active) WHERE is_active = true DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_default_user_role
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_user_role();

CREATE OR REPLACE FUNCTION get_user_role(check_user_id UUID DEFAULT auth.uid())
RETURNS user_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    user_role_result user_role;
BEGIN
    SELECT role INTO user_role_result
    FROM user_roles
    WHERE user_id = check_user_id
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > NOW())
    LIMIT 1;
    
    RETURN COALESCE(user_role_result, 'customer'::user_role);
END;
$$;

CREATE OR REPLACE FUNCTION is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
    RETURN get_user_role(check_user_id) IN ('admin', 'super_admin');
END;
$$;

CREATE OR REPLACE FUNCTION is_staff_or_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
    RETURN get_user_role(check_user_id) IN ('staff', 'admin', 'super_admin');
END;
$$;

CREATE POLICY "admin_profiles_select_all" ON profiles
    FOR SELECT TO authenticated
    USING (is_admin());

CREATE POLICY "admin_profiles_update_all" ON profiles
    FOR UPDATE TO authenticated
    USING (is_admin());

CREATE POLICY "staff_products_insert" ON products
    FOR INSERT TO authenticated
    WITH CHECK (is_staff_or_admin());

CREATE POLICY "staff_products_update" ON products
    FOR UPDATE TO authenticated
    USING (is_staff_or_admin());

CREATE POLICY "staff_products_delete" ON products
    FOR DELETE TO authenticated
    USING (is_admin());

CREATE POLICY "admin_orders_select_all" ON orders
    FOR SELECT TO authenticated
    USING (is_staff_or_admin());

CREATE POLICY "admin_orders_update_all" ON orders
    FOR UPDATE TO authenticated
    USING (is_staff_or_admin());

CREATE POLICY "admin_order_items_select_all" ON order_items
    FOR SELECT TO authenticated
    USING (
        is_staff_or_admin()
        OR EXISTS (
            SELECT 1 FROM orders o
            WHERE o.id = order_items.order_id
            AND o.customer_id = auth.uid()
        )
    );

CREATE OR REPLACE FUNCTION promote_user_to_role(
    target_user_id UUID,
    new_role user_role,
    reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_role user_role;
    result JSONB;
BEGIN
    IF get_user_role() != 'super_admin' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Only super_admin can promote users'
        );
    END IF;
    
    SELECT role INTO current_role
    FROM user_roles
    WHERE user_id = target_user_id AND is_active = true;
    
    UPDATE user_roles
    SET is_active = false, updated_at = NOW()
    WHERE user_id = target_user_id AND is_active = true;
    
    INSERT INTO user_roles (user_id, role, granted_by, metadata, is_active)
    VALUES (
        target_user_id,
        new_role,
        auth.uid(),
        jsonb_build_object('reason', reason, 'previous_role', current_role),
        true
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'user_id', target_user_id,
        'previous_role', current_role,
        'new_role', new_role
    );
END;
$$;

CREATE OR REPLACE VIEW users_with_roles AS
SELECT 
    u.id,
    u.email,
    u.created_at as registered_at,
    u.last_sign_in_at,
    c.full_name,
    c.phone,
    ur.role,
    ur.granted_at as role_granted_at,
    ur.expires_at as role_expires_at,
    ur.is_active as role_is_active,
    COUNT(DISTINCT o.id) as total_orders,
    COALESCE(SUM(o.total), 0)::NUMERIC(10,2) as lifetime_value
FROM auth.users u
LEFT JOIN customers c ON c.id = u.id
LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.is_active = true
LEFT JOIN orders o ON o.customer_id = u.id
GROUP BY u.id, u.email, u.created_at, u.last_sign_in_at, c.full_name, c.phone,
         ur.role, ur.granted_at, ur.expires_at, ur.is_active;

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_see_own_role" ON user_roles
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "admin_see_all_roles" ON user_roles
    FOR SELECT TO authenticated
    USING (is_admin());

CREATE POLICY "super_admin_manage_roles" ON user_roles
    FOR ALL TO authenticated
    USING (get_user_role() = 'super_admin')
    WITH CHECK (get_user_role() = 'super_admin');

GRANT SELECT ON user_roles TO authenticated;
GRANT SELECT ON users_with_roles TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_role TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION is_staff_or_admin TO authenticated;
GRANT EXECUTE ON FUNCTION promote_user_to_role TO authenticated;