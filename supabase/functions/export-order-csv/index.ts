import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const rateCheck = checkRateLimit(`csv-${ip}`);
  
  if (!rateCheck.allowed) {
    return rateLimitResponse();
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase configuration');
    }

    const url = new URL(req.url);
    const order_id = url.searchParams.get('order_id');
    const format = url.searchParams.get('format') || 'detailed';

    if (!order_id) {
      return new Response(
        JSON.stringify({ error: 'order_id parameter required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('*, customer:profiles(id, full_name, email, cpf, phone)')
      .eq('id', order_id)
      .single();

    if (orderError || !orderData) {
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: itemsData } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order_id);

    const csv = format === 'simple' 
      ? generateSimpleCSV(orderData, itemsData || [])
      : generateDetailedCSV(orderData, itemsData || []);

    await supabase.from('order_events').insert({
      order_id: order_id,
      event_type: 'export_csv',
      description: `CSV exported: ${format}`,
      metadata: { format, items_count: itemsData?.length || 0 }
    });

    return new Response(csv, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="order_${order_id.slice(0, 8)}.csv"`
      }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateSimpleCSV(order: any, items: any[]): string {
  let csv = 'SKU,Product,Quantity,Price,Total\n';
  
  items.forEach(item => {
    const snapshot = item.product_snapshot || {};
    csv += `${snapshot.sku || 'N/A'},${snapshot.name || 'Product'},${item.quantity},${item.unit_price.toFixed(2)},${item.line_total.toFixed(2)}\n`;
  });
  
  csv += `\nSubtotal,,,,${order.subtotal.toFixed(2)}\n`;
  csv += `Shipping,,,,${order.shipping_cost.toFixed(2)}\n`;
  csv += `TOTAL,,,,${order.total.toFixed(2)}\n`;
  
  return csv;
}

function generateDetailedCSV(order: any, items: any[]): string {
  const customer = order.customer || {};
  let csv = 'Order Information\n';
  csv += `ID,${order.id}\n`;
  csv += `Status,${order.status}\n\n`;
  
  csv += 'Customer Information\n';
  csv += `Name,${customer.full_name || 'N/A'}\n`;
  csv += `Email,${customer.email || 'N/A'}\n\n`;
  
  csv += 'Order Items\n';
  csv += 'Item,SKU,Product,Qty,Price,Total\n';
  
  items.forEach((item, i) => {
    const snapshot = item.product_snapshot || {};
    csv += `${i+1},${snapshot.sku},${snapshot.name},${item.quantity},${item.unit_price.toFixed(2)},${item.line_total.toFixed(2)}\n`;
  });
  
  csv += '\nOrder Summary\n';
  csv += `Subtotal,${order.subtotal.toFixed(2)}\n`;
  csv += `Shipping,${order.shipping_cost.toFixed(2)}\n`;
  csv += `Discount,${order.discount.toFixed(2)}\n`;
  csv += `TOTAL,${order.total.toFixed(2)}\n`;
  
  return csv;
}