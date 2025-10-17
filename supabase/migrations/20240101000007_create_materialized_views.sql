CREATE MATERIALIZED VIEW daily_sales_stats AS
SELECT 
    DATE_TRUNC('day', created_at)::DATE as date,
    COUNT(*) as total_orders,
    COUNT(DISTINCT customer_id) as unique_customers,
    SUM(total)::NUMERIC(10,2) as total_revenue,
    SUM(subtotal)::NUMERIC(10,2) as subtotal,
    SUM(shipping_cost)::NUMERIC(10,2) as shipping_revenue,
    AVG(total)::NUMERIC(10,2) as avg_order_value,
    MIN(total)::NUMERIC(10,2) as min_order_value,
    MAX(total)::NUMERIC(10,2) as max_order_value,
    COUNT(*) FILTER (WHERE status = 'delivered') as delivered_orders,
    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_orders,
    COUNT(*) FILTER (WHERE status = 'refunded') as refunded_orders,
    SUM(total) FILTER (WHERE status = 'delivered')::NUMERIC(10,2) as delivered_revenue
FROM orders
WHERE created_at >= DATE_TRUNC('day', NOW() - INTERVAL '1 year')
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

CREATE UNIQUE INDEX idx_daily_sales_stats_date ON daily_sales_stats(date);
CREATE INDEX idx_daily_sales_stats_date_range ON daily_sales_stats(date DESC);

COMMENT ON MATERIALIZED VIEW daily_sales_stats IS 'Daily sales statistics for last year';

CREATE MATERIALIZED VIEW product_performance_stats AS
SELECT 
    p.id,
    p.name,
    p.sku,
    p.price,
    p.stock,
    p.is_active,
    COUNT(DISTINCT oi.order_id) as orders_count,
    COALESCE(SUM(oi.quantity), 0) as total_sold,
    COALESCE(SUM(oi.line_total), 0)::NUMERIC(10,2) as total_revenue,
    COALESCE(AVG(oi.unit_price), p.price)::NUMERIC(10,2) as avg_selling_price,
    CASE 
        WHEN p.stock = 0 THEN 'out_of_stock'
        WHEN p.stock < 10 THEN 'low_stock'
        WHEN p.stock < 50 THEN 'medium_stock'
        ELSE 'good_stock'
    END as stock_status,
    CASE 
        WHEN COUNT(DISTINCT oi.order_id) >= 20 THEN 'hot'
        WHEN COUNT(DISTINCT oi.order_id) >= 10 THEN 'warm'
        WHEN COUNT(DISTINCT oi.order_id) > 0 THEN 'cold'
        ELSE 'no_sales'
    END as sales_performance,
    MAX(o.created_at) as last_sold_at,
    p.updated_at as last_updated_at
FROM products p
LEFT JOIN order_items oi ON oi.product_id = p.id
LEFT JOIN orders o ON o.id = oi.order_id 
    AND o.created_at > NOW() - INTERVAL '90 days'
    AND o.status NOT IN ('cancelled', 'refunded')
GROUP BY p.id, p.name, p.sku, p.price, p.stock, p.is_active, p.updated_at;

CREATE UNIQUE INDEX idx_product_performance_id ON product_performance_stats(id);
CREATE INDEX idx_product_performance_status ON product_performance_stats(stock_status, sales_performance);
CREATE INDEX idx_product_performance_revenue ON product_performance_stats(total_revenue DESC);

COMMENT ON MATERIALIZED VIEW product_performance_stats IS 'Product performance with stock and sales metrics';

CREATE MATERIALIZED VIEW customer_rfm_segments AS
WITH customer_metrics AS (
    SELECT 
        c.id,
        c.full_name,
        c.email,
        MAX(o.created_at) as last_order_date,
        COUNT(o.id) as order_count,
        COALESCE(SUM(o.total), 0)::NUMERIC(10,2) as total_spent,
        EXTRACT(DAY FROM NOW() - MAX(o.created_at)) as days_since_last_order
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id AND o.status NOT IN ('cancelled', 'refunded')
    GROUP BY c.id, c.full_name, c.email
),
rfm_scores AS (
    SELECT 
        *,
        CASE 
            WHEN days_since_last_order IS NULL THEN 0
            WHEN days_since_last_order <= 30 THEN 5
            WHEN days_since_last_order <= 60 THEN 4
            WHEN days_since_last_order <= 90 THEN 3
            WHEN days_since_last_order <= 180 THEN 2
            ELSE 1
        END as recency_score,
        CASE 
            WHEN order_count >= 10 THEN 5
            WHEN order_count >= 7 THEN 4
            WHEN order_count >= 5 THEN 3
            WHEN order_count >= 3 THEN 2
            WHEN order_count >= 1 THEN 1
            ELSE 0
        END as frequency_score,
        CASE 
            WHEN total_spent >= 5000 THEN 5
            WHEN total_spent >= 2000 THEN 4
            WHEN total_spent >= 1000 THEN 3
            WHEN total_spent >= 500 THEN 2
            WHEN total_spent > 0 THEN 1
            ELSE 0
        END as monetary_score
    FROM customer_metrics
)
SELECT 
    id,
    full_name,
    email,
    last_order_date,
    days_since_last_order,
    order_count,
    total_spent,
    recency_score,
    frequency_score,
    monetary_score,
    (recency_score + frequency_score + monetary_score) as rfm_total_score,
    CASE 
        WHEN (recency_score + frequency_score + monetary_score) >= 13 THEN 'champions'
        WHEN (recency_score + frequency_score + monetary_score) >= 10 THEN 'loyal_customers'
        WHEN recency_score >= 4 AND (frequency_score + monetary_score) >= 4 THEN 'potential_loyalist'
        WHEN recency_score >= 3 AND frequency_score <= 2 THEN 'new_customers'
        WHEN (recency_score + frequency_score + monetary_score) >= 6 THEN 'at_risk'
        WHEN days_since_last_order > 180 THEN 'lost'
        ELSE 'promising'
    END as customer_segment
FROM rfm_scores;

CREATE UNIQUE INDEX idx_customer_rfm_id ON customer_rfm_segments(id);
CREATE INDEX idx_customer_rfm_segment ON customer_rfm_segments(customer_segment);
CREATE INDEX idx_customer_rfm_score ON customer_rfm_segments(rfm_total_score DESC);

COMMENT ON MATERIALIZED VIEW customer_rfm_segments IS 'RFM customer segmentation for targeted marketing';

CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
BEGIN
    start_time := clock_timestamp();
    
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_sales_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY product_performance_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY customer_rfm_segments;
    
    end_time := clock_timestamp();
    
    RETURN format('Materialized views refreshed in %s seconds',
        EXTRACT(EPOCH FROM (end_time - start_time))::INTEGER);
END;
$$;

COMMENT ON FUNCTION refresh_all_materialized_views IS 'Refresh all materialized views concurrently';

GRANT SELECT ON daily_sales_stats TO authenticated;
GRANT SELECT ON product_performance_stats TO authenticated;
GRANT SELECT ON customer_rfm_segments TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_all_materialized_views TO authenticated;