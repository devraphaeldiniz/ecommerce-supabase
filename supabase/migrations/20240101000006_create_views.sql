CREATE OR REPLACE VIEW customer_orders_summary AS
SELECT 
    c.id,
    c.full_name,
    c.email,
    c.phone,
    c.created_at as customer_since,
    COUNT(DISTINCT o.id) as total_orders,
    COALESCE(SUM(o.total), 0)::NUMERIC(10,2) as lifetime_value,
    COALESCE(AVG(o.total), 0)::NUMERIC(10,2) as avg_order_value,
    MAX(o.created_at) as last_order_date,
    MIN(o.created_at) as first_order_date,
    COUNT(DISTINCT CASE WHEN o.status = 'delivered' THEN o.id END) as completed_orders,
    COUNT(DISTINCT CASE WHEN o.status = 'cancelled' THEN o.id END) as cancelled_orders
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.full_name, c.email, c.phone, c.created_at;

COMMENT ON VIEW customer_orders_summary IS 'Customer summary with order metrics and lifetime value';

CREATE OR REPLACE VIEW products_low_stock AS
SELECT 
    p.id,
    p.name,
    p.sku,
    p.stock,
    p.price,
    p.updated_at as last_stock_update,
    COUNT(oi.id) as pending_orders_count,
    COALESCE(SUM(oi.quantity), 0) as pending_quantity
FROM products p
LEFT JOIN order_items oi ON oi.product_id = p.id
LEFT JOIN orders o ON o.id = oi.order_id AND o.status IN ('draft', 'placed', 'paid', 'processing', 'shipped')
WHERE p.stock < 10 AND p.is_active = true
GROUP BY p.id, p.name, p.sku, p.stock, p.price, p.updated_at
ORDER BY p.stock ASC;

COMMENT ON VIEW products_low_stock IS 'Products with stock below 10 units including pending orders';

CREATE OR REPLACE VIEW recent_orders_details AS
SELECT 
    o.id,
    o.status,
    o.total,
    o.subtotal,
    o.shipping_cost,
    o.created_at,
    o.updated_at,
    c.id as customer_id,
    c.full_name as customer_name,
    c.email as customer_email,
    c.phone as customer_phone,
    COUNT(DISTINCT oi.id) as items_count,
    SUM(oi.quantity) as total_items_quantity,
    ARRAY_AGG(DISTINCT p.name) as product_names
FROM orders o
JOIN customers c ON c.id = o.customer_id
LEFT JOIN order_items oi ON oi.order_id = o.id
LEFT JOIN products p ON p.id = oi.product_id
WHERE o.created_at > NOW() - INTERVAL '30 days'
GROUP BY o.id, o.status, o.total, o.subtotal, o.shipping_cost, o.created_at, o.updated_at,
         c.id, c.full_name, c.email, c.phone
ORDER BY o.created_at DESC;

COMMENT ON VIEW recent_orders_details IS 'Orders from last 30 days with customer and product details';

CREATE OR REPLACE VIEW top_selling_products AS
SELECT 
    p.id,
    p.name,
    p.sku,
    p.price,
    p.stock as current_stock,
    COUNT(DISTINCT oi.id) as times_ordered,
    SUM(oi.quantity) as total_quantity_sold,
    SUM(oi.line_total)::NUMERIC(10,2) as total_revenue,
    AVG(oi.unit_price)::NUMERIC(10,2) as avg_selling_price,
    COUNT(DISTINCT o.customer_id) as unique_customers,
    MAX(o.created_at) as last_sold_date
FROM products p
JOIN order_items oi ON oi.product_id = p.id
JOIN orders o ON o.id = oi.order_id
WHERE o.status NOT IN ('cancelled', 'refunded')
  AND o.created_at > NOW() - INTERVAL '90 days'
GROUP BY p.id, p.name, p.sku, p.price, p.stock
ORDER BY total_quantity_sold DESC;

COMMENT ON VIEW top_selling_products IS 'Top selling products from last 90 days with metrics';

CREATE OR REPLACE VIEW orders_status_overview AS
SELECT 
    status,
    COUNT(*) as total_orders,
    SUM(total)::NUMERIC(10,2) as total_value,
    AVG(total)::NUMERIC(10,2) as avg_order_value,
    MIN(created_at) as oldest_order,
    MAX(created_at) as newest_order,
    COUNT(DISTINCT customer_id) as unique_customers
FROM orders
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY status
ORDER BY 
    CASE status
        WHEN 'draft' THEN 1
        WHEN 'placed' THEN 2
        WHEN 'paid' THEN 3
        WHEN 'processing' THEN 4
        WHEN 'shipped' THEN 5
        WHEN 'delivered' THEN 6
        WHEN 'completed' THEN 7
        WHEN 'cancelled' THEN 8
        WHEN 'refunded' THEN 9
    END;

COMMENT ON VIEW orders_status_overview IS 'Orders grouped by status from last 30 days';

CREATE OR REPLACE VIEW inactive_customers AS
SELECT 
    c.id,
    c.full_name,
    c.email,
    c.phone,
    MAX(o.created_at) as last_order_date,
    COUNT(o.id) as total_orders,
    SUM(o.total)::NUMERIC(10,2) as lifetime_value,
    EXTRACT(DAY FROM NOW() - MAX(o.created_at)) as days_since_last_order
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.full_name, c.email, c.phone
HAVING MAX(o.created_at) < NOW() - INTERVAL '60 days' OR MAX(o.created_at) IS NULL
ORDER BY last_order_date DESC NULLS LAST;

COMMENT ON VIEW inactive_customers IS 'Customers with no orders in last 60 days';

CREATE INDEX IF NOT EXISTS idx_orders_created_at_recent 
ON orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_product_aggregation 
ON order_items(product_id, quantity, line_total);

CREATE INDEX IF NOT EXISTS idx_products_low_stock_check 
ON products(is_active, stock) 
WHERE is_active = true AND stock < 10;

GRANT SELECT ON customer_orders_summary TO authenticated;
GRANT SELECT ON products_low_stock TO authenticated;
GRANT SELECT ON recent_orders_details TO authenticated;
GRANT SELECT ON top_selling_products TO authenticated;
GRANT SELECT ON orders_status_overview TO authenticated;
GRANT SELECT ON inactive_customers TO authenticated;