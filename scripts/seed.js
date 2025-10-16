import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function seed() {
  console.log('🌱 Seed iniciado...');

  const profiles = [
    {
      auth_uid: crypto.randomUUID(),
      full_name: 'Maria Silva',
      email: 'maria@email.com',
      cpf: '123.456.789-00',
      phone: '(11) 98765-4321',
      address: { street: 'Rua A', number: '123', city: 'São Paulo', state: 'SP', zipcode: '01234-567' }
    }
  ];

  const products = [
    { sku: 'NB-001', name: 'Notebook Dell', description: 'i7 16GB', price: 4299.90, stock: 15, category: 'Eletrônicos' },
    { sku: 'SM-001', name: 'Samsung S23', description: '5G 128GB', price: 3599.00, stock: 25, category: 'Eletrônicos' },
    { sku: 'CAM-001', name: 'Camiseta', description: 'Algodão', price: 89.90, stock: 100, category: 'Moda' }
  ];

  console.log('📝 Criando perfis...');
  const { data: prof } = await supabase.from('profiles').insert(profiles).select();
  console.log('✅', prof.length, 'perfis');

  console.log('📦 Criando produtos...');
  const { data: prod } = await supabase.from('products').insert(products).select();
  console.log('✅', prod.length, 'produtos');

  console.log('🛒 Criando pedido...');
  const { data: ord } = await supabase.from('orders').insert({
    customer_id: prof[0].id,
    status: 'placed',
    shipping_address: prof[0].address,
    billing_address: prof[0].address,
    shipping_cost: 25.00
  }).select();
  console.log('✅', ord.length, 'pedido');

  console.log('📋 Criando item...');
  const { data: item } = await supabase.from('order_items').insert({
    order_id: ord[0].id,
    product_id: prod[0].id,
    unit_price: prod[0].price,
    quantity: 1
  }).select();
  console.log('✅', item.length, 'item');

  console.log('\n🎉 CONCLUÍDO!');
}

seed().catch(console.error);