import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

let supabase;
let anonClient;

beforeAll(() => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase credentials');
  }

  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
});

describe('Database Tables', () => {
  it('should connect to profiles table', async () => {
    const { data, error } = await supabase.from('profiles').select('count');
    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  it('should connect to products table', async () => {
    const { data, error } = await supabase.from('products').select('count');
    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  it('should connect to orders table', async () => {
    const { data, error } = await supabase.from('orders').select('count');
    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  it('should connect to order_items table', async () => {
    const { data, error } = await supabase.from('order_items').select('count');
    expect(error).toBeNull();
    expect(data).toBeDefined();
  });
});

describe('Row Level Security', () => {
  it('should allow anonymous users to read products', async () => {
    const { data, error } = await anonClient.from('products').select('*').limit(5);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it('should block anonymous users from reading profiles', async () => {
    const { data } = await anonClient.from('profiles').select('*');
    expect(data).toEqual([]);
  });

  it('should block anonymous users from reading orders', async () => {
    const { data } = await anonClient.from('orders').select('*');
    expect(data).toEqual([]);
  });
});

describe('Database Views', () => {
  it('should query vw_product_stock', async () => {
    const { data, error } = await supabase.from('vw_product_stock').select('*').limit(5);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it('should query vw_customer_orders', async () => {
    const { data, error } = await supabase.from('vw_customer_orders').select('*').limit(5);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe('Database Functions', () => {
  it('should have calculate_order_total function', async () => {
    const { data: orders } = await supabase.from('orders').select('id').limit(1);
    
    if (orders && orders.length > 0) {
      const { error } = await supabase.rpc('calculate_order_total', {
        target_order: orders[0].id
      });
      expect(error).toBeNull();
    }
  });
});

describe('Edge Functions', () => {
  it('should have send-order-email endpoint', async () => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-order-email`, {
      method: 'OPTIONS'
    });
    expect(response.ok).toBe(true);
  });

  it('should have export-order-csv endpoint', async () => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/export-order-csv`, {
      method: 'OPTIONS'
    });
    expect(response.ok).toBe(true);
  });
});