import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { existsSync } from 'fs';

dotenv.config();

let errors = 0;
let warnings = 0;

const success = (msg) => console.log(`✓ ${msg}`);
const error = (msg) => { console.log(`✗ ${msg}`); errors++; };
const warning = (msg) => { console.log(`! ${msg}`); warnings++; };
const section = (msg) => console.log(`\n${msg}\n${'─'.repeat(msg.length)}`);

async function validateEnv() {
  section('Environment Variables');

  const required = ['SUPABASE_URL', 'SUPABASE_PROJECT_REF', 'SUPABASE_SERVICE_ROLE_KEY'];
  const optional = ['SUPABASE_ANON_KEY', 'SUPABASE_ACCESS_TOKEN', 'SENDGRID_API_KEY'];

  required.forEach(envVar => {
    process.env[envVar] ? success(`${envVar}`) : error(`${envVar} (required)`);
  });

  optional.forEach(envVar => {
    process.env[envVar] ? success(`${envVar}`) : warning(`${envVar} (optional)`);
  });
}

async function validateFiles() {
  section('Project Structure');

  const files = [
    'supabase/migrations/001_init.sql',
    'supabase/migrations/002_rls.sql',
    'supabase/functions/send-order-email/index.ts',
    'supabase/functions/export-order-csv/index.ts',
    '.github/workflows/deploy.yml',
    'package.json',
    'README.md'
  ];

  files.forEach(file => {
    existsSync(file) ? success(file) : warning(`${file} not found`);
  });
}

async function validateConnection() {
  section('Database Connection');

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    warning('Skipping connection test (missing credentials)');
    return;
  }

  try {
    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const tables = ['profiles', 'products', 'orders', 'order_items'];

    for (const table of tables) {
      const { error: tableError } = await supabase.from(table).select('count').limit(1);

      if (tableError && tableError.code === 'PGRST116') {
        warning(`Table ${table} not found (run migrations)`);
      } else if (tableError) {
        error(`Error accessing ${table}: ${tableError.message}`);
      } else {
        success(`Table ${table}`);
      }
    }
  } catch (err) {
    error(`Connection failed: ${err.message}`);
  }
}

async function run() {
  console.log('\n╔════════════════════════════════════╗');
  console.log('║   Setup Validation - E-commerce   ║');
  console.log('╚════════════════════════════════════╝');

  await validateEnv();
  await validateFiles();
  await validateConnection();

  section('Summary');

  if (errors === 0 && warnings === 0) {
    console.log('\n✓ Setup validated successfully!\n');
  } else {
    console.log(`\nErrors: ${errors}`);
    console.log(`Warnings: ${warnings}\n`);

    if (errors > 0) {
      console.log('Please fix errors before proceeding.\n');
      process.exit(1);
    }
  }
}

run();