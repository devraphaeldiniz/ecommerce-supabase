import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Erro: Configure as variáveis no .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const profiles = [
  {
    auth_uid: crypto.randomUUID(),
    full_name: 'Maria Silva',
    email: 'maria.silva@email.com',
    cpf: '123.456.789-00',
    phone: '(11) 98765-4321',
    address: { street: 'Rua das Flores', number: '123', city: 'São Paulo', state: 'SP', zipcode: '01234-567' }
  },
  {
    auth_uid: crypto.randomUUID(),
    full_name: 'João Santos',
    email: 'joao.santos@email.com',
    cpf: '987.654.321-00',
    phone: '(21) 91234-5678',
    address: { street: 'Av Atlântica', number: '456', city: 'Rio de Janeiro', state: 'RJ', zipcode: '22070-000' }
  }
];

const products = [
  { sku: 'NB-001', name: 'Notebook Dell i7', description: 'Notebook Dell com i7, 16GB, 512GB SSD', price: 4299.90, stock: 15, category: 'Eletrônicos' },
  { sku: 'SM-001', name: 'Samsung Galaxy S23', description: 'Smartphone 5G 128GB', price: 3599.00, stock: 25, category: 'Eletrônicos' },
  { sku: 'CAM-001', name: 'Camiseta Premium', description: 'Camiseta 100% algodão', price: 89.90, stock: 100, category: 'Moda' },
  { sku: 'CAD-001', name: 'Cadeira Gamer', description: 'Cadeira ergonômica', price: 1299.00, stock: 8, category: 'Casa' },
  { sku: 'FON-001', name: 'Fone Sony Bluetooth', description: 'Fone premium ANC', price: 1899.00, stock: 20, category: 'Eletrônicos' }
];

async function runSeed() {
  console.log('🌱 Iniciando seed...\n');

  try {
    // Criar perfis
    console.log('📝 Criando perfis...');
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .insert(profiles)
      .select();

    if (profilesError) {
      console.error('❌ Erro perfis:', profilesError.message);
      return;
    }
    console.log(`✅ ${profilesData.length} perfis criados!\n`);

    // Criar produtos
    console.log('📦 Criando produtos...');
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .insert(products)
      .select();

    if (productsError) {
      console.error('❌ Erro produtos:', productsError.message);
      return;
    }
    console.log(`✅ ${productsData.length} produtos criados!\n`);

    // Criar pedidos
    console.log('🛒 Criando pedidos...');
    const orders = [
      {
        customer_id: profilesData[0].id,
        status: 'placed',
        shipping_address: profilesData[0].address,
        billing_address: profilesData[0].address,
        shipping_cost: 25.00
      }
    ];

    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .insert(orders)
      .select();

    if (ordersError) {
      console.error('❌ Erro pedidos:', ordersError.message);
      return;
    }
    console.log(`✅ ${ordersData.length} pedidos criados!\n`);

    // Criar itens
    console.log('📋 Criando itens...');
    const items = [
      {
        order_id: ordersData[0].id,
        product_id: productsData[0].id,
        unit_price: productsData[0].price,
        quantity: 1
      }
    ];

    const { data: itemsData, error: itemsError } = await supabase
      .from('order_items')
      .insert(items)
      .select();

    if (itemsError) {
      console.error('❌ Erro itens:', itemsError.message);
      return;
    }
    console.log(`✅ ${itemsData.length} itens criados!\n`);

    console.log('🎉 SEED CONCLUÍDO COM SUCESSO!\n');
    console.log('📊 Resumo:');
    console.log(`   • ${profilesData.length} perfis`);
    console.log(`   • ${productsData.length} produtos`);
    console.log(`   • ${ordersData.length} pedidos`);
    console.log(`   • ${itemsData.length} itens\n`);

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

runSeed();