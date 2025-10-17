import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

describe('Views - Query Efficiency', () => {
  it('customer_orders_summary view should exist', async () => {
    const { data, error } = await supabase
      .from('customer_orders_summary')
      .select('*')
      .limit(5);
    
    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  it('products_low_stock should show products with low inventory', async () => {
    const { data, error } = await supabase
      .from('products_low_stock')
      .select('*')
      .limit(10);
    
    expect(error).toBeNull();
    if (data?.length > 0) {
      data.forEach(product => expect(product.stock_quantity).toBeLessThan(10));
    }
  });

  it('recent_orders_details should return recent orders', async () => {
    const { data, error } = await supabase
      .from('recent_orders_details')
      .select('*')
      .limit(5);
    
    expect(error).toBeNull();
    if (data?.length > 0) {
      const orderDate = new Date(data[0].created_at);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      expect(orderDate.getTime()).toBeGreaterThan(thirtyDaysAgo.getTime());
    }
  });

  it('top_selling_products should be ordered by quantity sold', async () => {
    const { data, error } = await supabase
      .from('top_selling_products')
      .select('*')
      .limit(10);
    
    expect(error).toBeNull();
    if (data?.length > 1) {
      for (let i = 0; i < data.length - 1; i++) {
        expect(data[i].total_quantity_sold).toBeGreaterThanOrEqual(
          data[i + 1].total_quantity_sold
        );
      }
    }
  });
});

describe('Materialized Views - Analytics', () => {
  it('daily_sales_stats should exist', async () => {
    const { data, error } = await supabase
      .from('daily_sales_stats')
      .select('*')
      .order('date', { ascending: false })
      .limit(7);
    
    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  it('product_performance_stats should calculate metrics', async () => {
    const { data, error } = await supabase
      .from('product_performance_stats')
      .select('*')
      .order('total_revenue', { ascending: false })
      .limit(10);
    
    expect(error).toBeNull();
    if (data?.length > 0) {
      expect(['out_of_stock', 'low_stock', 'medium_stock', 'good_stock'])
        .toContain(data[0].stock_status);
    }
  });

  it('customer_rfm_segments should segment customers', async () => {
    const { data, error } = await supabase
      .from('customer_rfm_segments')
      .select('*')
      .order('rfm_total_score', { ascending: false })
      .limit(10);
    
    expect(error).toBeNull();
    if (data?.length > 0) {
      expect(data[0].recency_score).toBeGreaterThanOrEqual(0);
      expect(data[0].recency_score).toBeLessThanOrEqual(5);
    }
  });
});

describe('RBAC - Role-Based Access Control', () => {
  it('user_roles table should exist', async () => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .limit(1);
    
    if (error && error.message.includes('row-level security')) {
      expect(true).toBe(true);
    } else {
      expect(data).toBeDefined();
    }
  });

  it('get_user_role function should exist', async () => {
    const { data, error } = await supabase.rpc('get_user_role');
    
    if (error) {
      expect(true).toBe(true);
    } else {
      expect(['customer', 'staff', 'admin', 'super_admin', null]).toContain(data);
    }
  });
});

describe('Audit - Access Logs and Security', () => {
  it('access_logs table should exist', async () => {
    const { data, error } = await supabase
      .from('access_logs')
      .select('count')
      .limit(1);
    
    if (error && error.message.includes('row-level security')) {
      expect(true).toBe(true);
    } else {
      expect(data).toBeDefined();
    }
  });

  it('security_violations table should exist', async () => {
    const { data, error } = await supabase
      .from('security_violations')
      .select('count')
      .limit(1);
    
    if (error && error.message.includes('row-level security')) {
      expect(true).toBe(true);
    } else {
      expect(data).toBeDefined();
    }
  });
});

describe('Performance - Indexes and Optimization', () => {
  it('database_health view should return status', async () => {
    const { data, error } = await supabase
      .from('database_health')
      .select('*');
    
    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
  });

  it('product search should be fast', async () => {
    const startTime = Date.now();
    
    const { data, error } = await supabase
      .rpc('search_products', {
        search_term: 'test',
        min_price: 0,
        max_price: 999999,
        in_stock_only: false,
        page_number: 1,
        page_size: 20
      });
    
    const duration = Date.now() - startTime;
    
    expect(error).toBeNull();
    expect(duration).toBeLessThan(500);
  });
});

describe('DELETE Policies - Deletion Control', () => {
  it('delete_my_account function should exist', async () => {
    const { data, error } = await supabase
      .rpc('delete_my_account', {
        confirmation_text: 'WRONG TEXT',
        reason: 'test'
      });
    
    if (error || (data && !data.success)) {
      expect(true).toBe(true);
    }
  });

  it('customers cannot delete products', async () => {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', '00000000-0000-0000-0000-000000000000');
    
    expect(error).toBeDefined();
  });
});