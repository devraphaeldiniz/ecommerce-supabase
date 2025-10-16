import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

console.log('🔍 Testando conexão...');
console.log('URL:', process.env.SUPABASE_URL);
console.log('Key existe?', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Sim' : 'Não');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('✅ Cliente criado!');

// Testar query simples
const { data, error } = await supabase.from('products').select('count');

if (error) {
  console.error('❌ Erro:', error.message);
} else {
  console.log('✅ Conexão OK!');
}