CREATE OR REPLACE FUNCTION calculate_order_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE orders
    SET 
        subtotal = (SELECT COALESCE(SUM(line_total), 0) FROM order_items WHERE order_id = NEW.order_id),
        total = subtotal + shipping_cost - discount
    WHERE id = NEW.order_id;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_calculate_order_totals
    AFTER INSERT OR UPDATE ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION calculate_order_totals();

CREATE OR REPLACE FUNCTION update_product_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE products
        SET stock = stock - NEW.quantity
        WHERE id = NEW.product_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_product_stock
    AFTER INSERT ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION update_product_stock();

CREATE OR REPLACE FUNCTION create_customer_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO customers (id, email, full_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', 'Customer'))
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_customer_on_signup
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_customer_on_signup();

CREATE OR REPLACE FUNCTION search_products(
    search_term TEXT DEFAULT '',
    min_price NUMERIC DEFAULT 0,
    max_price NUMERIC DEFAULT 999999,
    in_stock_only BOOLEAN DEFAULT false,
    page_number INTEGER DEFAULT 1,
    page_size INTEGER DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'products', COALESCE(jsonb_agg(row_to_json(p.*)), '[]'::jsonb),
        'total_count', COUNT(*) OVER()
    ) INTO result
    FROM (
        SELECT id, name, description, price, stock, sku
        FROM products
        WHERE is_active = true
          AND (search_term = '' OR name ILIKE '%' || search_term || '%')
          AND price BETWEEN min_price AND max_price
          AND (NOT in_stock_only OR stock > 0)
        ORDER BY name
        LIMIT page_size
        OFFSET (page_number - 1) * page_size
    ) p;
    
    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION search_products TO authenticated;