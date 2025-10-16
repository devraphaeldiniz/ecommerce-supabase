// ============================================
// Edge Function: export-order-csv
// Exporta dados do pedido em formato CSV
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

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

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Configurações do Supabase não encontradas');
    }

    // Extrair parâmetros da URL
    const url = new URL(req.url);
    const order_id = url.searchParams.get('order_id');
    const format = url.searchParams.get('format') || 'detailed'; // 'detailed' ou 'simple'

    if (!order_id) {
      return new Response(
        JSON.stringify({ error: 'Parâmetro order_id é obrigatório' }),
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
      .from('orders')
      .select(`
        *,
        customer:profiles(id, full_name, email, cpf, phone)
      `)
      .eq('id', order_id)
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
    const { data: itemsData, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order_id);

    if (itemsError) {
      console.error('Erro ao buscar itens:', itemsError);
      throw new Error('Erro ao buscar itens do pedido');
    }

    // Gerar CSV baseado no formato solicitado
    let csv: string;
    
    if (format === 'simple') {
      csv = generateSimpleCSV(orderData, itemsData || []);
    } else {
      csv = generateDetailedCSV(orderData, itemsData || []);
    }

    // Registrar evento de exportação
    await supabase
      .from('order_events')
      .insert({
        order_id: order_id,
        event_type: 'export_csv',
        description: `CSV exportado no formato ${format}`,
        metadata: {
          format: format,
          items_count: itemsData?.length || 0
        }
      });

    // Retornar CSV
    return new Response(csv, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="pedido_${order_id.slice(0, 8)}_${new Date().toISOString().split('T')[0]}.csv"`
      }
    });

  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    return new Response(
      JSON.stringify({
        error: 'Erro interno ao gerar CSV',
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
// Funções de geração de CSV
// ============================================

function generateSimpleCSV(order: any, items: any[]): string {
  // Cabeçalho
  let csv = 'SKU,Produto,Quantidade,Preço Unitário,Total\n';
  
  // Itens
  items.forEach(item => {
    const snapshot = item.product_snapshot || {};
    const sku = escapeCsvValue(snapshot.sku || 'N/A');
    const name = escapeCsvValue(snapshot.name || 'Produto');
    const quantity = item.quantity;
    const unitPrice = item.unit_price.toFixed(2);
    const lineTotal = item.line_total.toFixed(2);
    
    csv += `${sku},${name},${quantity},${unitPrice},${lineTotal}\n`;
  });
  
  // Totais
  csv += '\n';
  csv += `Subtotal,,,,${order.subtotal.toFixed(2)}\n`;
  csv += `Frete,,,,${order.shipping_cost.toFixed(2)}\n`;
  csv += `Desconto,,,,${order.discount.toFixed(2)}\n`;
  csv += `TOTAL,,,,${order.total.toFixed(2)}\n`;
  
  return csv;
}

function generateDetailedCSV(order: any, items: any[]): string {
  const customer = order.customer || {};
  const shippingAddress = order.shipping_address || {};
  
  let csv = '';
  
  // Seção: Informações do Pedido
  csv += '===== INFORMAÇÕES DO PEDIDO =====\n';
  csv += `ID do Pedido,${order.id}\n`;
  csv += `Status,${order.status}\n`;
  csv += `Data de Criação,${formatDateTime(order.created_at)}\n`;
  csv += `Última Atualização,${formatDateTime(order.updated_at)}\n`;
  csv += '\n';
  
  // Seção: Dados do Cliente
  csv += '===== DADOS DO CLIENTE =====\n';
  csv += `Nome,${escapeCsvValue(customer.full_name || 'N/A')}\n`;
  csv += `Email,${escapeCsvValue(customer.email || 'N/A')}\n`;
  csv += `CPF,${escapeCsvValue(customer.cpf || 'N/A')}\n`;
  csv += `Telefone,${escapeCsvValue(customer.phone || 'N/A')}\n`;
  csv += '\n';
  
  // Seção: Endereço de Entrega
  csv += '===== ENDEREÇO DE ENTREGA =====\n';
  csv += `Rua,${escapeCsvValue(shippingAddress.street || 'N/A')}\n`;
  csv += `Número,${escapeCsvValue(shippingAddress.number || 'N/A')}\n`;
  csv += `Complemento,${escapeCsvValue(shippingAddress.complement || '')}\n`;
  csv += `Bairro,${escapeCsvValue(shippingAddress.neighborhood || 'N/A')}\n`;
  csv += `Cidade,${escapeCsvValue(shippingAddress.city || 'N/A')}\n`;
  csv += `Estado,${escapeCsvValue(shippingAddress.state || 'N/A')}\n`;
  csv += `CEP,${escapeCsvValue(shippingAddress.zipcode || 'N/A')}\n`;
  csv += '\n';
  
  // Seção: Itens do Pedido
  csv += '===== ITENS DO PEDIDO =====\n';
  csv += 'Item,SKU,Produto,Categoria,Quantidade,Preço Unit.,Subtotal\n';
  
  items.forEach((item, index) => {
    const snapshot = item.product_snapshot || {};
    const itemNum = index + 1;
    const sku = escapeCsvValue(snapshot.sku || 'N/A');
    const name = escapeCsvValue(snapshot.name || 'Produto');
    const category = escapeCsvValue(snapshot.category || 'N/A');
    const quantity = item.quantity;
    const unitPrice = formatCurrency(item.unit_price);
    const lineTotal = formatCurrency(item.line_total);
    
    csv += `${itemNum},${sku},${name},${category},${quantity},${unitPrice},${lineTotal}\n`;
  });
  
  csv += '\n';
  
  // Seção: Resumo Financeiro
  csv += '===== RESUMO FINANCEIRO =====\n';
  csv += `Subtotal (itens),${formatCurrency(order.subtotal)}\n`;
  csv += `Frete,${formatCurrency(order.shipping_cost)}\n`;
  csv += `Desconto,${formatCurrency(order.discount)}\n`;
  csv += `TOTAL,${formatCurrency(order.total)}\n`;
  csv += '\n';
  
  // Seção: Pagamento
  csv += '===== INFORMAÇÕES DE PAGAMENTO =====\n';
  csv += `Método de Pagamento,${escapeCsvValue(order.payment_method || 'N/A')}\n`;
  
  if (order.payment_info) {
    const paymentInfo = order.payment_info;
    Object.keys(paymentInfo).forEach(key => {
      if (key !== 'card_number' && key !== 'cvv') { // Nunca exportar dados sensíveis
        csv += `${key},${escapeCsvValue(String(paymentInfo[key]))}\n`;
      }
    });
  }
  
  csv += '\n';
  
  // Notas
  if (order.notes) {
    csv += '===== OBSERVAÇÕES =====\n';
    csv += escapeCsvValue(order.notes) + '\n';
    csv += '\n';
  }
  
  // Footer
  csv += '===== FIM DO RELATÓRIO =====\n';
  csv += `Exportado em: ${formatDateTime(new Date().toISOString())}\n`;
  
  return csv;
}

// ============================================
// Funções auxiliares
// ============================================

function escapeCsvValue(value: string): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  const stringValue = String(value);
  
  // Se contém vírgula, quebra de linha ou aspas, envolve em aspas
  if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}

function formatCurrency(value: number): string {
  return `R$ ${value.toFixed(2)}`;
}

function formatDateTime(isoString: string): string {
  if (!isoString) return 'N/A';
  
  try {
    const date = new Date(isoString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo'
    });
  } catch (error) {
    return isoString;
  }
}