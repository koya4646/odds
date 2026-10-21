import { createClient } from '@supabase/supabase-js';

const url = 'https://yayziqemlwcjpiegurfs.supabase.co';
const key = 'sb_publishable_wH_zQkd_1A1TR6FgK49Ybw_aEDLn6tL';

const client = createClient(url, key);

async function check() {
  console.log('--- Checking Supabase tables and permissions ---');
  
  // 1. participants 取得
  const { data: parts, error: partErr } = await client.from('participants').select('*');
  console.log('Participants:', parts, 'Error:', partErr);

  // 2. rooms 取得
  const { data: rooms, error: roomErr } = await client.from('rooms').select('*');
  console.log('Rooms:', rooms, 'Error:', roomErr);

  // 3. events 取得
  const { data: events, error: evErr } = await client.from('events').select('*');
  console.log('Events:', events, 'Error:', evErr);

  // 4. tickets 取得
  const { data: tickets, error: ticketErr } = await client.from('tickets').select('*');
  console.log('Tickets:', tickets, 'Error:', ticketErr);

  // 5. transactions 取得
  const { data: txs, error: txErr } = await client.from('transactions').select('*');
  console.log('Transactions:', txs, 'Error:', txErr);
}

check();
