// ============================================
// Testes de Integração - E-commerce Supabase
// ============================================

import { createClient } from '@supabase/supabase-js';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Configuração
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias');
}

// Cliente Supabase com service_role (bypassa RLS para testes)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Variáveis globais para os testes
let testProfile;
let testProduct;
let testOrder;

// ============================================
// Setup e Teardown
// ============================================

beforeAll(async () => {
  console.log('🔧 Configurando ambiente de teste...');
});

afterAll(async () => {
  console.log('🧹 Limpando dados de teste...');
  
  // Limpar dados criados nos testes
  if (testOrder) {
    await supabase.from('order_items').delete().eq('order_id', testOrder.id);
    await supabase.from('orders').delete().eq('id', testOrder.id);
  }
  
  if (testProduct) {
    await supabase.from('products').delete().eq('id', testProduct.id);
  }
  
  if (testProfile) {
    await supabase.from('profiles').delete().eq('id', testProfile.id);
  }
});

// ============================================
// Testes de Profiles
// ============================================

describe('Profiles - Gerenciamento de Usuários', () => {
  it('Deve criar um novo perfil', async () => {
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        auth_uid: crypto.randomUUID(),
        full_name: 'João Silva Teste',
        email: 'joao.teste@email.com',
        cpf: '123.456.789-00',
        phone: '(11) 98765-4321',
        address: {
          street: 'Rua Teste',
          number: '123',
          city: 'São Paulo',
          state: 'SP',
          zipcode: '01234-567'
        }
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.full_name).toBe('João Silva Teste');
    expect(data.email).toBe('joao.teste@email.com');
    
    testProfile = data;
    console.log('✅ Perfil criado:', data.id);
  });

  it('Deve atualizar um perfil existente', async () => {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        phone: '(11) 99999-9999'
      })
      .eq('id', testProfile.id)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.phone).toBe('(11) 99999-9999');
    console.log('✅ Perfil atualizado');
  });

  it('Deve buscar um perfil pelo ID', async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', testProfile.id)
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.id).toBe(testProfile.id);
  });
});

// ============================================
// Testes de Products
// ============================================

describe('Products - Gerenciamento de Produtos', () => {
  it('Deve criar um novo produto', async () => {
    const { data, error } = await supabase
      .from('products')
      .insert({
        sku: `TEST-${Date.now()}`,
        name: 'Notebook Teste',
        description: 'Notebook para testes de integração',
        price: 3500.00,
        stock: 10,
        category: 'Eletrônicos',
        image_url: 'https://example.com/notebook.jpg',
        specifications: {
          processor: 'Intel i7',
          ram: '16GB',
          storage: '512GB SSD'
        }
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.name).toBe('Notebook Teste');
    expect(data.stock).toBe(10);
    
    testProduct = data;
    console.log('✅ Produto criado:', data.id);
  });

  it('Deve listar produtos em estoque', async () => {
    const { data, error } = await supabase
      .from('vw_product_stock')
      .select('*')
      .limit(10);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    console.log(`✅ Encontrados ${data.length} produtos em estoque`);
  });

  it('Deve atualizar estoque do produto', async () => {
    const { data, error } = await supabase
      .from('products')
      .update({ stock: 15 })
      .eq('id', testProduct.id)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.stock).toBe(15);
    console.log('✅ Estoque atualizado');
  });
});

// ============================================
// Testes de Orders
// ============================================

describe('Orders - Gerenciamento de Pedidos', () => {
  it('Deve criar um novo pedido', async () => {
    const { data, error } = await supabase
      .from('orders')
      .insert({
        customer_id: testProfile.id,
        status: 'draft',
        shipping_address: {
          street: 'Rua Teste',
          number: '123',
          city: 'São Paulo',
          state: 'SP',
          zipcode: '01234-567'
        },
        billing_address: {
          street: 'Rua Teste',
          number: '123',
          city: 'São Paulo',
          state: 'SP',
          zipcode: '01234-567'
        }
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.status).toBe('draft');
    expect(data.total).toBe(0); // Total inicial é 0
    
    testOrder = data;
    console.log('✅ Pedido criado:', data.id);
  });

  it('Deve adicionar item ao pedido', async () => {
    const { data, error } = await supabase
      .from('order_items')
      .insert({
        order_id: testOrder.id,
        product_id: testProduct.id,
        unit_price: testProduct.price,
        quantity: 2
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.quantity).toBe(2);
    expect(data.line_total).toBe(testProduct.price * 2);
    console.log('✅ Item adicionado ao pedido');
  });

  it('Deve calcular total do pedido automaticamente', async () => {
    // Aguardar trigger processar
    await new Promise(resolve => setTimeout(resolve, 1000));

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', testOrder.id)
      .single();

    expect(error).toBeNull();
    expect(data.total).toBeGreaterThan(0);
    expect(data.subtotal).toBe(testProduct.price * 2);
    console.log(`✅ Total calculado: R$ ${data.total}`);
  });

  it('Deve listar pedidos do cliente', async () => {
    const { data, error } = await supabase
      .from('vw_customer_orders')
      .select('*')
      .eq('customer_id', testProfile.id);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    console.log(`✅ Cliente possui ${data.length} pedido(s)`);
  });

  it('Deve atualizar status do pedido', async () => {
    // Usar função set_order_status
    const { error } = await supabase.rpc('set_order_status', {
      p_order_id: testOrder.id,
      p_status: 'placed',
      p_notes: 'Pedido confirmado via teste'
    });

    expect(error).toBeNull();

    // Verificar se status foi atualizado
    const { data } = await supabase
      .from('orders')
      .select('status')
      .eq('id', testOrder.id)
      .single();

    expect(data.status).toBe('placed');
    console.log('✅ Status atualizado para: placed');
  });

  it('Deve registrar evento no log', async () => {
    const { data, error } = await supabase
      .from('order_events')
      .select('*')
      .eq('order_id', testOrder.id)
      .order('created_at', { ascending: false });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    console.log(`✅ ${data.length} evento(s) registrado(s)`);
  });
});

// ============================================
// Testes de Views
// ============================================

describe('Views - Consultas Otimizadas', () => {
  it('Deve consultar view de pedidos com dados do cliente', async () => {
    const { data, error } = await supabase
      .from('vw_customer_orders')
      .select('*')
      .limit(5);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    console.log(`✅ View vw_customer_orders retornou ${data.length} registro(s)`);
  });

  it('Deve consultar view de detalhes do pedido', async () => {
    const { data, error } = await supabase
      .from('vw_order_details')
      .select('*')
      .eq('order_id', testOrder.id);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    console.log(`✅ Detalhes do pedido: ${data.length} item(s)`);
  });
});

// ============================================
// Testes de Edge Functions
// ============================================

describe('Edge Functions', () => {
  it('Deve enviar email de confirmação (simulado)', async () => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-order-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        order_id: testOrder.id,
        email_type: 'confirmation'
      })
    });

    expect(response.ok).toBe(true);
    const result = await response.json();
    expect(result.success).toBe(true);
    console.log('✅ Email enviado:', result.message);
  });

  it('Deve exportar CSV do pedido', async () => {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/export-order-csv?order_id=${testOrder.id}&format=detailed`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      }
    );

    expect(response.ok).toBe(true);
    const csv = await response.text();
    expect(csv).toContain('INFORMAÇÕES DO PEDIDO');
    expect(csv).toContain(testOrder.id);
    console.log('✅ CSV exportado com sucesso');
  });
});

// ============================================
// Testes de Performance
// ============================================

describe('Performance - Índices e Queries', () => {
  it('Deve buscar produtos rapidamente por categoria', async () => {
    const start = Date.now();
    
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('category', 'Eletrônicos')
      .limit(100);

    const duration = Date.now() - start;
    
    expect(error).toBeNull();
    expect(duration).toBeLessThan(1000); // Deve ser rápido
    console.log(`✅ Query executada em ${duration}ms`);
  });

  it('Deve buscar pedidos de um cliente rapidamente', async () => {
    const start = Date.now();
    
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('customer_id', testProfile.id);

    const duration = Date.now() - start;
    
    expect(error).toBeNull();
    expect(duration).toBeLessThan(1000);
    console.log(`✅ Query executada em ${duration}ms`);
  });
});

// ============================================
// Testes de Segurança (RLS)
// ============================================

describe('Segurança - Row Level Security', () => {
  it('Deve respeitar políticas RLS para usuários não autenticados', async () => {
    // Criar cliente sem autenticação (apenas anon key)
    const anonClient = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY || '');
    
    // Tentar acessar perfis (deve falhar)
    const { data, error } = await anonClient
      .from('profiles')
      .select('*');

    // Usuários anônimos não devem ver perfis
    expect(data).toEqual([]);
    console.log('✅ RLS bloqueou acesso não autorizado a profiles');
  });

  it('Usuários anônimos podem ver produtos', async () => {
    const anonClient = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY || '');
    
    const { data, error } = await anonClient
      .from('products')
      .select('*')
      .eq('is_active', true)
      .limit(5);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    console.log('✅ Produtos públicos acessíveis');
  });
});