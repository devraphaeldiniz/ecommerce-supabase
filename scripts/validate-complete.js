import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

let totalChecks = 0;
let passedChecks = 0;
const errors = [];

function logCheck(name, passed, details = '') {
  totalChecks++;
  if (passed) {
    passedChecks++;
    console.log(`✓ ${name}`);
    if (details) console.log(`  ${details}`);
  } else {
    console.log(`✗ ${name}`);
    if (details) {
      console.log(`  ${details}`);
      errors.push({ check: name, error: details });
    }
  }
}

function logSection(title) {
  console.log(`\n${title}`);
  console.log('-'.repeat(60));
}

async function validateSetup() {
  try {
    console.log('\nValidating E-commerce Supabase Setup');
    console.log('='.repeat(60));

    logSection('Core Tables');
    const tables = ['customers', 'products', 'orders', 'order_items', 'order_events'];
    for (const table of tables) {
      const { error } = await supabase.from(table).select('count').limit(1);
      logCheck(`${table}`, !error, error ? error.message : 'Accessible');
    }

    logSection('Advanced Tables (RBAC & Audit)');
    const advancedTables = ['user_roles', 'access_logs', 'security_violations'];
    for (const table of advancedTables) {
      const { error } = await supabase.from(table).select('count').limit(1);
      logCheck(`${table}`, 
        !error || error.message.includes('row-level security'),
        error && !error.message.includes('row-level security') ? error.message : 'Created with RLS');
    }

    logSection('Views');
    const views = [
      'customer_orders_summary',
      'products_low_stock',
      'recent_orders_details',
      'top_selling_products',
      'orders_status_overview',
      'inactive_customers'
    ];
    for (const view of views) {
      const { error } = await supabase.from(view).select('count').limit(1);
      logCheck(`${view}`, !error, error ? error.message : 'Working');
    }

    logSection('Materialized Views');
    const matViews = ['daily_sales_stats', 'product_performance_stats', 'customer_rfm_segments'];
    for (const view of matViews) {
      const { error } = await supabase.from(view).select('count').limit(1);
      logCheck(`${view}`, !error, error ? error.message : 'Working');
    }

    logSection('RPC Functions');
    const functions = [
      { name: 'get_user_role', params: {} },
      { name: 'is_admin', params: {} },
      { name: 'is_staff_or_admin', params: {} }
    ];
    for (const func of functions) {
      const { error } = await supabase.rpc(func.name, func.params);
      logCheck(`${func.name}()`,
        !error || error.message.includes('permission'),
        error && !error.message.includes('permission') ? error.message : 'Created');
    }

    logSection('Edge Functions');
    const edgeFunctions = ['send-order-email', 'export-order-csv'];
    for (const func of edgeFunctions) {
      try {
        const response = await fetch(
          `${process.env.SUPABASE_URL}/functions/v1/${func}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ test: true })
          }
        );
        const exists = response.status === 200 || response.status === 400;
        logCheck(`${func}`, exists, exists ? 'Deployed' : `HTTP ${response.status}`);
      } catch (error) {
        logCheck(`${func}`, false, 'Not deployed');
      }
    }

    logSection('Database Health');
    const { data: health, error: healthError } = await supabase
      .from('database_health')
      .select('*');
    
    if (!healthError && health) {
      logCheck('Health Check', true, `${health.length} metrics available`);
      console.log('\nMetrics:');
      health.forEach(m => console.log(`  ${m.category}: ${m.value}`));
    } else {
      logCheck('Health Check', false, healthError?.message);
    }

    logSection('Performance Test');
    const start = Date.now();
    const { error: perfError } = await supabase.rpc('search_products', {
      search_term: 'test',
      min_price: 0,
      max_price: 999999,
      in_stock_only: false,
      page_number: 1,
      page_size: 20
    });
    const duration = Date.now() - start;
    logCheck('Product Search',
      !perfError && duration < 500,
      `${duration}ms ${duration < 200 ? '(Excellent)' : duration < 500 ? '(Good)' : '(Slow)'}`);

  } catch (error) {
    console.error('\nFatal Error:', error.message);
    errors.push({ check: 'FATAL', error: error.message });
  }
}

(async () => {
  await validateSetup();

  console.log('\n' + '='.repeat(60));
  console.log('Final Report');
  console.log('='.repeat(60));
  console.log(`Total checks: ${totalChecks}`);
  console.log(`Passed: ${passedChecks}`);
  console.log(`Failed: ${totalChecks - passedChecks}`);
  console.log(`Success rate: ${((passedChecks / totalChecks) * 100).toFixed(1)}%`);

  if (errors.length > 0) {
    console.log('\nErrors Found:');
    errors.forEach((err, i) => {
      console.log(`\n${i + 1}. ${err.check}`);
      console.log(`   ${err.error}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  
  if (passedChecks === totalChecks) {
    console.log('Setup Complete - All checks passed!');
    console.log('\nNext steps:');
    console.log('  1. git add .');
    console.log('  2. git commit -m "feat: add advanced features"');
    console.log('  3. git push origin main');
    console.log('  4. npm test');
  } else if (passedChecks / totalChecks > 0.8) {
    console.log('Setup Almost Complete - Minor issues found');
  } else {
    console.log('Setup Incomplete - Review errors above');
  }

  console.log('');
  process.exit(errors.length > 0 ? 1 : 0);
})();