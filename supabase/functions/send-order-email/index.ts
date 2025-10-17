import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts';

interface OrderEmailRequest {
  order_id: string;
  email_type?: 'confirmation' | 'status_update' | 'shipped' | 'delivered';
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const rateCheck = checkRateLimit(`email-${ip}`);
  
  if (!rateCheck.allowed) {
    return rateLimitResponse();
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
    const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'noreply@example.com';

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase configuration');
    }

    const { order_id, email_type = 'confirmation' }: OrderEmailRequest = await req.json();

    if (!order_id) {
      return new Response(
        JSON.stringify({ error: 'order_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: orderData, error: orderError } = await supabase
      .from('vw_customer_orders')
      .select('*')
      .eq('order_id', order_id)
      .single();

    if (orderError || !orderData) {
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailContent = generateEmailContent(orderData, email_type);

    if (SENDGRID_API_KEY) {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: orderData.email, name: orderData.full_name }],
            subject: emailContent.subject
          }],
          from: { email: FROM_EMAIL, name: 'E-commerce' },
          content: [
            { type: 'text/plain', value: emailContent.text },
            { type: 'text/html', value: emailContent.html }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Email send failed: ${response.status}`);
      }

      await supabase.from('order_events').insert({
        order_id: order_id,
        event_type: 'email_sent',
        description: `Email sent: ${email_type}`,
        metadata: { email_type, recipient: orderData.email }
      });

      return new Response(
        JSON.stringify({ success: true, message: 'Email sent', order_id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Email simulation (SendGrid not configured)', 
          order_id 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateEmailContent(order: any, type: string) {
  const orderId = order.order_id.slice(0, 8);
  
  switch (type) {
    case 'confirmation':
      return {
        subject: `Order #${orderId} confirmed`,
        text: `Hello ${order.full_name},\n\nYour order has been confirmed.\nTotal: $${order.total.toFixed(2)}`,
        html: `<h1>Order Confirmed</h1><p>Hello <strong>${order.full_name}</strong>,</p><p>Total: $${order.total.toFixed(2)}</p>`
      };
    case 'shipped':
      return {
        subject: `Order #${orderId} shipped`,
        text: `Hello ${order.full_name},\n\nYour order has been shipped.`,
        html: `<h1>Order Shipped</h1><p>Your order is on the way!</p>`
      };
    default:
      return {
        subject: `Order #${orderId} update`,
        text: `Hello ${order.full_name},\n\nStatus: ${order.status}`,
        html: `<p>Order status: <strong>${order.status}</strong></p>`
      };
  }
}