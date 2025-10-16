// ============================================
// Edge Function: send-order-email
// Envia e-mail de confirmação de pedido
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// Tipos
interface OrderEmailRequest {
  order_id: string;
  email_type?: 'confirmation' | 'status_update' | 'shipped' | 'delivered';
}

interface OrderData {
  order_id: string;
  customer_name: string;
  customer_email: string;
  status: string;
  total: number;
  created_at: string;
  items?: OrderItem[];
}

interface OrderItem {
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

// Configuração CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validar variáveis de ambiente
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
    const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'noreply@seusite.com.br';

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Configurações do Supabase não encontradas');
    }

    if (!SENDGRID_API_KEY) {
      console.warn('SendGrid API key não configurada - modo simulação');
    }

    // Parse request
    const { order_id, email_type = 'confirmation' }: OrderEmailRequest = await req.json();

    if (!order_id) {
      return new Response(
        JSON.stringify({ error: 'order_id é obrigatório' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Criar cliente Supabase com service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Buscar dados do pedido
    const { data: orderData, error: orderError } = await supabase
      .from('vw_customer_orders')
      .select('*')
      .eq('order_id', order_id)
      .single();

    if (orderError || !orderData) {
      console.error('Erro ao buscar pedido:', orderError);
      return new Response(
        JSON.stringify({ error: 'Pedido não encontrado' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Buscar itens do pedido
    const { data: itemsData } = await supabase
      .from('vw_order_details')
      .select('product_name, product_sku, quantity, unit_price, line_total')
      .eq('order_id', order_id);

    // Montar objeto do pedido
    const order: OrderData = {
      order_id: orderData.order_id,
      customer_name: orderData.full_name,
      customer_email: orderData.email,
      status: orderData.status,
      total: orderData.total,
      created_at: orderData.created_at,
      items: itemsData || []
    };

    // Gerar conteúdo do e-mail baseado no tipo
    const emailContent = generateEmailContent(order, email_type);

    // Enviar e-mail via SendGrid
    if (SENDGRID_API_KEY) {
      const sendGridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: order.customer_email, name: order.customer_name }],
            subject: emailContent.subject
          }],
          from: {
            email: FROM_EMAIL,
            name: 'E-commerce'
          },
          content: [
            {
              type: 'text/plain',
              value: emailContent.text
            },
            {
              type: 'text/html',
              value: emailContent.html
            }
          ]
        })
      });

      if (!sendGridResponse.ok) {
        const errorText = await sendGridResponse.text();
        console.error('Erro SendGrid:', errorText);
        throw new Error(`Falha ao enviar e-mail: ${sendGridResponse.status}`);
      }

      // Registrar evento de e-mail enviado
      await supabase
        .from('order_events')
        .insert({
          order_id: order_id,
          event_type: 'email_sent',
          description: `E-mail de ${email_type} enviado para ${order.customer_email}`,
          metadata: {
            email_type: email_type,
            recipient: order.customer_email
          }
        });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'E-mail enviado com sucesso',
          order_id: order_id
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    } else {
      // Modo simulação (sem SendGrid configurado)
      console.log('=== SIMULAÇÃO DE E-MAIL ===');
      console.log('Para:', order.customer_email);
      console.log('Assunto:', emailContent.subject);
      console.log('Conteúdo:', emailContent.text);
      console.log('=========================');

      return new Response(
        JSON.stringify({
          success: true,
          message: 'E-mail simulado (SendGrid não configurado)',
          order_id: order_id,
          preview: emailContent
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    return new Response(
      JSON.stringify({
        error: 'Erro interno ao processar e-mail',
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

// ============================================
// Funções auxiliares
// ============================================

function generateEmailContent(order: OrderData, type: string) {
  const baseUrl = Deno.env.get('SITE_URL') || 'https://seusite.com.br';
  
  switch (type) {
    case 'confirmation':
      return {
        subject: `Pedido #${order.order_id.slice(0, 8)} confirmado! 🎉`,
        text: generateConfirmationText(order, baseUrl),
        html: generateConfirmationHtml(order, baseUrl)
      };
    
    case 'shipped':
      return {
        subject: `Seu pedido #${order.order_id.slice(0, 8)} foi enviado! 📦`,
        text: `Olá ${order.customer_name},\n\nSeu pedido foi enviado e está a caminho!\n\nAcompanhe: ${baseUrl}/pedidos/${order.order_id}`,
        html: `<p>Olá <strong>${order.customer_name}</strong>,</p><p>Seu pedido foi enviado e está a caminho!</p><p><a href="${baseUrl}/pedidos/${order.order_id}">Acompanhar pedido</a></p>`
      };
    
    case 'delivered':
      return {
        subject: `Pedido #${order.order_id.slice(0, 8)} entregue! ✅`,
        text: `Olá ${order.customer_name},\n\nSeu pedido foi entregue com sucesso!\n\nEsperamos que goste dos produtos.`,
        html: `<p>Olá <strong>${order.customer_name}</strong>,</p><p>Seu pedido foi entregue com sucesso!</p><p>Esperamos que goste dos produtos.</p>`
      };
    
    default:
      return {
        subject: `Atualização do pedido #${order.order_id.slice(0, 8)}`,
        text: `Olá ${order.customer_name},\n\nStatus do pedido: ${order.status}\n\nDetalhes: ${baseUrl}/pedidos/${order.order_id}`,
        html: `<p>Olá <strong>${order.customer_name}</strong>,</p><p>Status do pedido: <strong>${order.status}</strong></p><p><a href="${baseUrl}/pedidos/${order.order_id}">Ver detalhes</a></p>`
      };
  }
}

function generateConfirmationText(order: OrderData, baseUrl: string): string {
  let text = `Olá ${order.customer_name},\n\n`;
  text += `Recebemos seu pedido #${order.order_id.slice(0, 8)} com sucesso!\n\n`;
  text += `RESUMO DO PEDIDO:\n`;
  text += `===============\n`;
  
  if (order.items && order.items.length > 0) {
    order.items.forEach(item => {
      text += `\n${item.product_name} (${item.product_sku})\n`;
      text += `  Quantidade: ${item.quantity}\n`;
      text += `  Preço: R$ ${item.unit_price.toFixed(2)}\n`;
      text += `  Subtotal: R$ ${item.line_total.toFixed(2)}\n`;
    });
  }
  
  text += `\n===============\n`;
  text += `TOTAL: R$ ${order.total.toFixed(2)}\n\n`;
  text += `Acompanhe seu pedido em: ${baseUrl}/pedidos/${order.order_id}\n\n`;
  text += `Obrigado pela preferência!\n`;
  text += `Equipe E-commerce`;
  
  return text;
}

function generateConfirmationHtml(order: OrderData, baseUrl: string): string {
  let itemsHtml = '';
  
  if (order.items && order.items.length > 0) {
    itemsHtml = order.items.map(item => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.product_name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">R$ ${item.unit_price.toFixed(2)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">R$ ${item.line_total.toFixed(2)}</td>
      </tr>
    `).join('');
  }
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">Pedido Confirmado! 🎉</h1>
      </div>
      
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px;">Olá <strong>${order.customer_name}</strong>,</p>
        <p>Recebemos seu pedido <strong>#${order.order_id.slice(0, 8)}</strong> com sucesso!</p>
        
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #667eea; margin-top: 0;">Resumo do Pedido</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f0f0f0;">
                <th style="padding: 10px; text-align: left;">Produto</th>
                <th style="padding: 10px; text-align: center;">Qtd</th>
                <th style="padding: 10px; text-align: right;">Preço</th>
                <th style="padding: 10px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" style="padding: 15px 10px; text-align: right; font-weight: bold; font-size: 18px;">TOTAL:</td>
                <td style="padding: 15px 10px; text-align: right; font-weight: bold; font-size: 18px; color: #667eea;">R$ ${order.total.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${baseUrl}/pedidos/${order.order_id}" 
             style="display: inline-block; background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Acompanhar Pedido
          </a>
        </div>
        
        <p style="text-align: center; color: #666; font-size: 14px;">
          Obrigado pela preferência!<br>
          <strong>Equipe E-commerce</strong>
        </p>
      </div>
    </body>
    </html>
  `;
}