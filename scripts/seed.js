import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const profiles = [
  {
    auth_uid: crypto.randomUUID(),
    full_name: 'Maria Silva',
    email: 'maria@email.com',
    cpf: '123.456.789-00',
    phone: '(11) 98765-4321',
    address: { 
      street: 'Rua A', 
      number: '123', 
      city: 'São Paulo', 
      state: 'SP', 
      zipcode: '01234-567' 
    }
  }
];

const products = [
  { 
    sku: 'NB-001', 
    name: 'Notebook Dell', 
    description: 'Intel i7, 16GB RAM, 512GB SSD', 
    price: 4299.90, 
    stock: 15, 
    category: 'Eletrônicos' 
  },
  { 
    sku: 'SM-001', 
    name: 'Samsung Galaxy S23', 
    description: '5G, 128GB', 
    price: 3599.00, 
    stock: 25, 
    category: 'Eletrônicos' 
  },
  { 
    sku: 'CAM-001', 
    name: 'Camiseta Premium', 
    description: '100% Algodão', 
    price: 89.90, 
    stock: 100, 
    category: 'Moda' 
  }
];

async function seed() {
  console.log('Starting database seed...\n');

  try {
    console.log('Creating profiles...');
    const { data: prof, error: profError } = await supabase
      .from('profiles')
      .insert(profiles)
      .select();

    if (profError) {
      console.error('Profile creation error:', profError.message);
      return;
    }
    console.log(`Created ${prof.length} profile(s)\n`);

    console.log('Creating products...');
    const { data: prod, error: prodError } = await supabase
      .from('products')
      .insert(products)
      .select();

    if (prodError) {
      console.error('Product creation error:', prodError.message);
      return;
    }
    console.log(`Created ${prod.length} product(s)\n`);

    console.log('Creating order...');
    const { data: ord, error: ordError } = await supabase
      .from('orders')
      .insert({
        customer_id: prof[0].id,
        status: 'placed',
        shipping_address: prof[0].address,
        billing_address: prof[0].address,
        shipping_cost: 25.00
      })
      .select();

    if (ordError) {
      console.error('Order creation error:', ordError.message);
      return;
    }
    console.log(`Created ${ord.length} order(s)\n`);

    console.log('Creating order items...');
    const { data: item, error: itemError } = await supabase
      .from('order_items')
      .insert({
        order_id: ord[0].id,
        product_id: prod[0].id,
        unit_price: prod[0].price,
        quantity: 1
      })
      .select();

    if (itemError) {
      console.error('Order item creation error:', itemError.message);
      return;
    }
    console.log(`Created ${item.length} item(s)\n`);

    console.log('Seed completed successfully!');
    console.log(`\nSummary:`);
    console.log(`  - ${prof.length} profiles`);
    console.log(`  - ${prod.length} products`);
    console.log(`  - ${ord.length} orders`);
    console.log(`  - ${item.length} items\n`);

  } catch (error) {
    console.error('Seed error:', error.message);
    process.exit(1);
  }
}

seed();