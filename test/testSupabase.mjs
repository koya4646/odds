import { createClient } from '@supabase/supabase-js';

const url = 'https://yayziqemlwcjpiegurfs.supabase.co';
const key = 'sb_publishable_wH_zQkd_1A1TR6FgK49Ybw_aEDLn6tL';

console.log('Testing Supabase connection...');
const client = createClient(url, key);

async function test() {
  try {
    const { data, error } = await client.from('rooms').select('*').limit(1);
    if (error) {
      console.error('Supabase query error:', error);
    } else {
      console.log('✅ Supabase connected successfully! Rooms table is ready. Current rows:', data.length);
    }
  } catch (e) {
    console.error('Exception during test:', e);
  }
}

test();
