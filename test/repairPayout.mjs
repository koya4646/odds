import { createClient } from '@supabase/supabase-js';

const url = 'https://yayziqemlwcjpiegurfs.supabase.co';
const key = 'sb_publishable_wH_zQkd_1A1TR6FgK49Ybw_aEDLn6tL';

const client = createClient(url, key);

async function repair() {
  console.log('--- Repairing payout for participant hh ---');
  const pId = 'i3n69tomvi62py6';
  const roomId = 'hj096thmvi5zk7b';
  const payout = 510;
  const newPoints = 9600 + payout; // 10110

  // 1. points を 10110 に更新
  const { data: updPart, error: partErr } = await client
    .from('participants')
    .update({ points: newPoints })
    .eq('id', pId)
    .eq('room_id', roomId)
    .select();

  console.log('Updated participant:', updPart, 'Error:', partErr);

  // 2. transactions に PAYOUT トランザクションを挿入
  const { data: tx, error: txErr } = await client
    .from('transactions')
    .insert({
      id: 'tx_payout_' + Date.now(),
      room_id: roomId,
      participant_id: pId,
      participant_name: 'hh',
      type: 'PAYOUT',
      amount: payout,
      balance_after: newPoints,
      description: '的中払い戻し「test」',
      related_event_id: '5qkz5g5mvi602cr',
      created_at: Date.now()
    })
    .select();

  console.log('Inserted PAYOUT transaction:', tx, 'Error:', txErr);
  console.log('✅ Repair completed! hh points is now:', newPoints);
}

repair();
