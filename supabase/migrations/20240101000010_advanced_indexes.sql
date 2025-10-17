CREATE INDEX IF NOT EXISTS idx_orders_customer_status 
ON orders(customer_id, status, created_at DESC)
WHERE status NOT IN ('cancelled', 'refunded');

CREATE INDEX IF NOT EXISTS idx_orders_date_status 
ON orders(created_at DESC, status)
INCLUDE (total, subtotal);

CREATE INDEX IF NOT EXISTS idx_orders_total_desc 
ON orders(total DESC)
WHERE status = 'delivered';

CREATE INDEX IF NOT EXISTS idx_products_name_active 
ON products(name, is_active)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_products_price_active 
ON products(price ASC, stock DESC)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_order_items_product_stats 
ON order_items(product_id)
INCLUDE (quantity, unit_price, line_total);

CREATE INDEX IF NOT EXISTS idx_orders_active 
ON orders(customer_id, created_at DESC)
WHERE status IN ('draft', 'placed', 'paid', 'processing', 'shipped');

CREATE INDEX IF NOT EXISTS idx_products_available 
ON products(name, price)
WHERE is_active = true AND stock > 0;

CREATE INDEX IF NOT EXISTS idx_products_low_stock_alert 
ON products(stock, name)
WHERE is_active = true AND stock < 20;

CREATE INDEX IF NOT EXISTS idx_orders_recent 
ON orders(created_at DESC, status);

CREATE INDEX IF NOT EXISTS idx_products_fts 
ON products USING gin(
    to_tsvector('portuguese', 
        COALESCE(name, '') || ' ' || COALESCE(description, '')
    )
);

CREATE INDEX IF NOT EXISTS idx_profiles_fts 
ON profiles USING gin(
    to_tsvector('portuguese', 
        COALESCE(full_name, '') || ' ' || COALESCE(email, '')
    )
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_total 
ON orders(customer_id)
INCLUDE (total, status, created_at)
WHERE status NOT IN ('cancelled', 'refunded');

CREATE INDEX IF NOT EXISTS idx_order_items_aggregation 
ON order_items(order_id)
INCLUDE (quantity, line_total);

CREATE INDEX IF NOT EXISTS idx_order_items_product_analysis 
ON order_items(product_id, created_at DESC)
INCLUDE (quantity, unit_price, line_total);

CREATE INDEX IF NOT EXISTS idx_orders_customer_fk ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_fk ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_fk ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_events_order_fk ON order_events(order_id);

CREATE INDEX IF NOT EXISTS idx_products_sort_name 
ON products(LOWER(name) ASC)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_products_sort_price_asc 
ON products(price ASC, name ASC)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_products_sort_price_desc 
ON products(price DESC, name ASC)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_products_sort_newest 
ON products(created_at DESC)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_orders_sort_newest 
ON orders(created_at DESC)
WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_sort_total_desc 
ON orders(total DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_snapshot_sku 
ON order_items USING gin((product_snapshot -> 'sku'));

CREATE INDEX IF NOT EXISTS idx_order_events_metadata 
ON order_events USING gin(metadata);

ANALYZE customers;
ANALYZE products;
ANALYZE orders;
ANALYZE order_items;
ANALYZE order_events;

CREATE OR REPLACE FUNCTION optimize_database()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
    VACUUM ANALYZE customers;
    VACUUM ANALYZE products;
    VACUUM ANALYZE orders;
    VACUUM ANALYZE order_items;
    VACUUM ANALYZE order_events;
    
    REINDEX TABLE CONCURRENTLY orders;
    REINDEX TABLE CONCURRENTLY order_items;
    
    RETURN 'Database optimization completed successfully';
END;
$$;

ALTER TABLE products SET (
    fillfactor = 90,
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE orders SET (
    fillfactor = 90,
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE order_items SET (
    fillfactor = 90,
    autovacuum_vacuum_scale_factor = 0.1
);

CREATE OR REPLACE FUNCTION table_sizes()
RETURNS TABLE (
    table_name TEXT,
    total_size TEXT,
    table_size TEXT,
    indexes_size TEXT
)
LANGUAGE sql
AS $$
    SELECT 
        t.tablename::TEXT,
        pg_size_pretty(pg_total_relation_size(quote_ident(t.schemaname)||'.'||quote_ident(t.tablename))),
        pg_size_pretty(pg_relation_size(quote_ident(t.schemaname)||'.'||quote_ident(t.tablename))),
        pg_size_pretty(pg_total_relation_size(quote_ident(t.schemaname)||'.'||quote_ident(t.tablename)) - 
                      pg_relation_size(quote_ident(t.schemaname)||'.'||quote_ident(t.tablename)))
    FROM pg_catalog.pg_tables t
    WHERE t.schemaname = 'public'
    ORDER BY pg_total_relation_size(quote_ident(t.schemaname)||'.'||quote_ident(t.tablename)) DESC;
$$;

CREATE OR REPLACE FUNCTION unused_indexes()
RETURNS TABLE (
    schemaname TEXT,
    tablename TEXT,
    indexname TEXT,
    index_size TEXT,
    index_scans BIGINT
)
LANGUAGE sql
AS $$
    SELECT 
        schemaname::TEXT,
        relname::TEXT,
        indexrelname::TEXT,
        pg_size_pretty(pg_relation_size(indexrelid)),
        idx_scan
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public'
      AND idx_scan = 0
      AND indexrelname NOT LIKE 'pg_toast%'
    ORDER BY pg_relation_size(indexrelid) DESC;
$$;

CREATE OR REPLACE VIEW database_health AS
SELECT 'Tables' as category, COUNT(*)::TEXT as value FROM pg_tables WHERE schemaname = 'public'
UNION ALL
SELECT 'Indexes', COUNT(*)::TEXT FROM pg_indexes WHERE schemaname = 'public'
UNION ALL
SELECT 'Views', COUNT(*)::TEXT FROM pg_views WHERE schemaname = 'public'
UNION ALL
SELECT 'Total DB Size', pg_size_pretty(pg_database_size(current_database()))
UNION ALL
SELECT 'Customers', COUNT(*)::TEXT FROM customers
UNION ALL
SELECT 'Products', COUNT(*)::TEXT FROM products
UNION ALL
SELECT 'Orders', COUNT(*)::TEXT FROM orders;

GRANT SELECT ON database_health TO authenticated;
GRANT EXECUTE ON FUNCTION optimize_database TO authenticated;
GRANT EXECUTE ON FUNCTION table_sizes TO authenticated;
GRANT EXECUTE ON FUNCTION unused_indexes TO authenticated;