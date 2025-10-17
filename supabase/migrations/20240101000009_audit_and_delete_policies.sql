CREATE TABLE IF NOT EXISTS access_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT,
    user_role user_role,
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID,
    was_successful BOOLEAN DEFAULT true,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_access_logs_created_at ON access_logs(created_at DESC);
CREATE INDEX idx_access_logs_user_id ON access_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_access_logs_action ON access_logs(action, table_name);
CREATE INDEX idx_access_logs_failed ON access_logs(was_successful) WHERE was_successful = false;

CREATE TABLE IF NOT EXISTS security_violations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT,
    violation_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    table_name TEXT,
    attempted_action TEXT,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_security_violations_user ON security_violations(user_id, created_at DESC);
CREATE INDEX idx_security_violations_severity ON security_violations(severity, created_at DESC);
CREATE INDEX idx_security_violations_type ON security_violations(violation_type);

CREATE OR REPLACE FUNCTION log_access(
    p_action TEXT,
    p_table_name TEXT,
    p_record_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_was_successful BOOLEAN DEFAULT true,
    p_error_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    log_id UUID;
    current_user_role user_role;
    current_user_email TEXT;
BEGIN
    SELECT email INTO current_user_email FROM auth.users WHERE id = auth.uid();
    current_user_role := get_user_role();
    
    INSERT INTO access_logs (
        user_id, user_email, user_role, action, table_name,
        record_id, was_successful, error_message, metadata
    ) VALUES (
        auth.uid(), current_user_email, current_user_role, p_action, p_table_name,
        p_record_id, p_was_successful, p_error_message, p_metadata
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$;

CREATE OR REPLACE FUNCTION log_security_violation(
    p_violation_type TEXT,
    p_severity TEXT,
    p_table_name TEXT DEFAULT NULL,
    p_attempted_action TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    violation_id UUID;
    current_user_email TEXT;
BEGIN
    SELECT email INTO current_user_email FROM auth.users WHERE id = auth.uid();
    
    INSERT INTO security_violations (
        user_id, user_email, violation_type, severity, table_name,
        attempted_action, description, metadata
    ) VALUES (
        auth.uid(), current_user_email, p_violation_type, p_severity, p_table_name,
        p_attempted_action, p_description, p_metadata
    ) RETURNING id INTO violation_id;
    
    RETURN violation_id;
END;
$$;

CREATE OR REPLACE FUNCTION audit_sensitive_operations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM log_access('DELETE', TG_TABLE_NAME, OLD.id, row_to_json(OLD)::jsonb);
        RETURN OLD;
    END IF;
    
    IF TG_OP = 'UPDATE' THEN
        IF TG_TABLE_NAME = 'orders' AND OLD.status != NEW.status THEN
            PERFORM log_access('UPDATE_STATUS', TG_TABLE_NAME, NEW.id,
                jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status));
        END IF;
        
        IF TG_TABLE_NAME = 'products' AND OLD.price != NEW.price THEN
            PERFORM log_access('UPDATE_PRICE', TG_TABLE_NAME, NEW.id,
                jsonb_build_object('old_price', OLD.price, 'new_price', NEW.price));
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_audit_orders_sensitive
    AFTER UPDATE OR DELETE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION audit_sensitive_operations();

CREATE TRIGGER trg_audit_products_sensitive
    AFTER UPDATE OR DELETE ON products
    FOR EACH ROW
    EXECUTE FUNCTION audit_sensitive_operations();

CREATE POLICY "profiles_no_direct_delete" ON profiles
    FOR DELETE TO authenticated
    USING (false);

CREATE OR REPLACE FUNCTION delete_my_account(
    confirmation_text TEXT,
    reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_email TEXT;
    user_profile_id UUID;
BEGIN
    SELECT email INTO current_user_email FROM auth.users WHERE id = auth.uid();
    SELECT id INTO user_profile_id FROM profiles WHERE auth_uid = auth.uid();
    
    IF confirmation_text != 'DELETE MY ACCOUNT' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid confirmation text');
    END IF;
    
    UPDATE orders SET status = 'cancelled', updated_at = NOW()
    WHERE customer_id = user_profile_id AND status IN ('draft', 'placed', 'paid', 'processing');
    
    UPDATE profiles
    SET full_name = 'Deleted User',
        email = 'deleted_' || user_profile_id::text || '@deleted.local',
        phone = NULL,
        updated_at = NOW()
    WHERE id = user_profile_id;
    
    PERFORM log_access('SELF_DELETE_ACCOUNT', 'profiles', user_profile_id,
        jsonb_build_object('reason', reason, 'email', current_user_email));
    
    RETURN jsonb_build_object('success', true, 'message', 'Account deleted successfully');
END;
$$;

CREATE POLICY "admin_profiles_hard_delete" ON profiles
    FOR DELETE TO authenticated
    USING (is_admin());

CREATE POLICY "staff_products_soft_delete" ON products
    FOR UPDATE TO authenticated
    USING (is_staff_or_admin())
    WITH CHECK (is_staff_or_admin() AND is_active = false);

CREATE POLICY "admin_products_hard_delete" ON products
    FOR DELETE TO authenticated
    USING (
        is_admin()
        AND NOT EXISTS (SELECT 1 FROM order_items WHERE product_id = products.id)
    );

CREATE POLICY "profiles_delete_draft_orders" ON orders
    FOR DELETE TO authenticated
    USING (
        customer_id IN (SELECT id FROM profiles WHERE auth_uid = auth.uid())
        AND status = 'draft'
    );

CREATE POLICY "admin_delete_old_orders" ON orders
    FOR DELETE TO authenticated
    USING (
        is_admin()
        AND status IN ('cancelled', 'refunded')
    );

CREATE POLICY "delete_order_items_cascade" ON order_items
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM orders o
            JOIN profiles p ON p.id = o.customer_id
            WHERE o.id = order_items.order_id
            AND ((p.auth_uid = auth.uid() AND o.status = 'draft') OR is_admin())
        )
    );

CREATE POLICY "admin_only_delete_events" ON order_events
    FOR DELETE TO authenticated
    USING (is_admin());

ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_see_own_access_logs" ON access_logs
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "admin_see_all_access_logs" ON access_logs
    FOR SELECT TO authenticated
    USING (is_admin());

CREATE POLICY "system_insert_logs" ON access_logs
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "users_see_own_violations" ON security_violations
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "admin_see_all_violations" ON security_violations
    FOR SELECT TO authenticated
    USING (is_admin());

CREATE POLICY "system_insert_violations" ON security_violations
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE OR REPLACE VIEW suspicious_activities AS
SELECT 
    sv.id,
    sv.user_email,
    sv.violation_type,
    sv.severity,
    sv.attempted_action,
    sv.created_at,
    COUNT(*) OVER (
        PARTITION BY sv.user_id 
        ORDER BY sv.created_at 
        ROWS BETWEEN 10 PRECEDING AND CURRENT ROW
    ) as recent_violations_count
FROM security_violations sv
WHERE sv.created_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
ORDER BY sv.created_at DESC;

CREATE OR REPLACE VIEW user_activity_summary AS
SELECT 
    user_id,
    user_email,
    user_role,
    DATE_TRUNC('day', created_at) as activity_date,
    COUNT(*) as total_actions,
    COUNT(*) FILTER (WHERE was_successful = false) as failed_actions,
    COUNT(DISTINCT table_name) as tables_accessed,
    json_agg(DISTINCT action) as actions_performed
FROM access_logs
WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
GROUP BY user_id, user_email, user_role, DATE_TRUNC('day', created_at)
ORDER BY activity_date DESC;

GRANT SELECT ON access_logs TO authenticated;
GRANT SELECT ON security_violations TO authenticated;
GRANT SELECT ON suspicious_activities TO authenticated;
GRANT SELECT ON user_activity_summary TO authenticated;
GRANT EXECUTE ON FUNCTION log_access TO authenticated;
GRANT EXECUTE ON FUNCTION log_security_violation TO authenticated;
GRANT EXECUTE ON FUNCTION delete_my_account TO authenticated;