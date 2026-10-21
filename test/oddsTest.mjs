import assert from 'node:assert';

function makeBetKey(type, choices) {
  if (type === 'WIN') return `WIN:${choices[0]}`;
  if (type === 'QUINELLA') {
    const sorted = [...choices].sort();
    return `QUINELLA:${sorted[0]}+${sorted[1]}`;
  }
  if (type === 'EXACTA') return `EXACTA:${choices[0]}->${choices[1]}`;
  return `${type}:${choices.join('-')}`;
}

function calculateLiveOdds(tickets, takeoutRate, initialOdds = {}) {
  const betTotals = {};
  const poolByType = {};
  let totalPool = 0;

  tickets.forEach(ticket => {
    const key = makeBetKey(ticket.betType, ticket.choices);
    betTotals[key] = (betTotals[key] || 0) + ticket.amount;
    poolByType[ticket.betType] = (poolByType[ticket.betType] || 0) + ticket.amount;
    totalPool += ticket.amount;
  });

  const netMultiplier = Math.max(0, 1 - takeoutRate);
  const odds = { ...initialOdds };

  Object.keys(betTotals).forEach(key => {
    const targetBet = betTotals[key];
    const betType = key.split(':')[0];
    const typePool = poolByType[betType] || 0;

    if (targetBet > 0 && typePool > 0) {
      const calculated = (typePool * netMultiplier) / targetBet;
      odds[key] = Math.max(1.0, calculated);
    }
  });

  return { odds, betTotals, totalPool };
}

function settleEventBets(tickets, firstPlaceId, secondPlaceId, lockedOdds, refundIfNoWinner = true) {
  const winningKeys = new Set();
  winningKeys.add(makeBetKey('WIN', [firstPlaceId]));
  if (secondPlaceId) {
    winningKeys.add(makeBetKey('QUINELLA', [firstPlaceId, secondPlaceId]));
    winningKeys.add(makeBetKey('EXACTA', [firstPlaceId, secondPlaceId]));
  }

  let hitCount = 0;
  tickets.forEach(ticket => {
    const key = makeBetKey(ticket.betType, ticket.choices);
    if (winningKeys.has(key)) hitCount++;
  });

  let totalPayout = 0;
  let totalRefund = 0;
  const isAllRefund = hitCount === 0 && refundIfNoWinner && tickets.length > 0;

  const settledTickets = tickets.map(ticket => {
    const key = makeBetKey(ticket.betType, ticket.choices);
    const odds = (lockedOdds && lockedOdds[key] !== undefined)
      ? lockedOdds[key]
      : (ticket.lockedOdds || 1.0);

    if (isAllRefund) {
      totalRefund += ticket.amount;
      return { ...ticket, lockedOdds: odds, isHit: false, refunded: true, payout: ticket.amount };
    }

    if (winningKeys.has(key)) {
      const payout = Math.floor(ticket.amount * odds);
      totalPayout += payout;
      return { ...ticket, lockedOdds: odds, isHit: true, refunded: false, payout };
    }

    return { ...ticket, lockedOdds: odds, isHit: false, refunded: false, payout: 0 };
  });

  return { settledTickets, totalPayout, totalRefund, hitCount };
}

console.log('🧪 Verifying Payout & Settlement Calculations...');

// テスト 1: 締切時確定オッズが、投票時の古いオッズを正しく上書きすることの検証
console.log('Test 1: lockedOdds override verification');
const testTickets1 = [
  {
    id: 't1',
    betType: 'WIN',
    choices: ['c1'],
    amount: 1000,
    lockedOdds: 5.0, // 投票した瞬間の暫定オッズは5.0倍だった
    payout: 0,
    isHit: false,
    refunded: false
  }
];
// その後、他人がさらに賭けて締切時の最終オッズが 2.5倍 に下がった
const finalOddsMap = { 'WIN:c1': 2.5 };
const result1 = settleEventBets(testTickets1, 'c1', undefined, finalOddsMap, true);
assert.strictEqual(result1.settledTickets[0].isHit, true);
assert.strictEqual(result1.settledTickets[0].lockedOdds, 2.5); // 締切確定オッズが適用されている
assert.strictEqual(result1.settledTickets[0].payout, 2500); // 1000 * 2.5 = 2500 pt
console.log('✅ Test 1 Passed: 締切確定オッズが確実に適用されます');

// テスト 2: 控除率20%における正味プール分配の完全検証
console.log('Test 2: Net pool payout conservation');
// 単勝: プレイヤーAが 2000pt、プレイヤーBが 8000pt 投票（計 10,000pt）
// 控除率 20% -> 正味払戻原資 = 8,000pt
// プレイヤーAの馬が勝った場合:
// オッズ = 8000 / 2000 = 4.0倍
// Aへの払戻 = 2000 * 4.0 = 8000pt
const tickets2 = [
  { id: 'a', betType: 'WIN', choices: ['hA'], amount: 2000 },
  { id: 'b', betType: 'WIN', choices: ['hB'], amount: 8000 },
];
const odds2 = calculateLiveOdds(tickets2, 0.20).odds;
assert.strictEqual(odds2['WIN:hA'], 4.0);
assert.strictEqual(odds2['WIN:hB'], 1.0); // 8000 / 8000 = 1.0 (元返し保証)

const settle2 = settleEventBets(tickets2, 'hA', undefined, odds2, true);
assert.strictEqual(settle2.totalPayout, 8000); // 正味プール8000ptと1ptの狂いもなく完全一致！
console.log('✅ Test 2 Passed: 控除率20%と払戻プールが1ptの狂いもなく完全一致します');

// テスト 3: 単勝と馬連のプール独立性検証（複数券種購入時の配当破綻防止）
console.log('Test 3: Independent bet pools (WIN + QUINELLA)');
const comboTickets = [
  // 単勝プール: 計 10,000pt (正味 8,000pt)
  { id: 'w1', betType: 'WIN', choices: ['hA'], amount: 2000 },
  { id: 'w2', betType: 'WIN', choices: ['hB'], amount: 8000 },
  // 馬連プール: 計 5,000pt (正味 4,000pt)
  { id: 'q1', betType: 'QUINELLA', choices: ['hA', 'hB'], amount: 1000 },
  { id: 'q2', betType: 'QUINELLA', choices: ['hA', 'hC'], amount: 4000 },
];
const comboOdds = calculateLiveOdds(comboTickets, 0.20).odds;
// 単勝hAオッズ = 8000 / 2000 = 4.0倍
assert.strictEqual(comboOdds['WIN:hA'], 4.0);
// 馬連hA+hBオッズ = 4000 / 1000 = 4.0倍
assert.strictEqual(comboOdds['QUINELLA:hA+hB'], 4.0);

// 1着 hA, 2着 hB の結果
const comboSettle = settleEventBets(comboTickets, 'hA', 'hB', comboOdds, true);
// 単勝的中者への払戻: 2000 * 4.0 = 8000 pt (単勝プールと一致)
// 馬連的中者への払戻: 1000 * 4.0 = 4000 pt (馬連プールと一致)
// 全払戻総額: 12000 pt = (単勝正味8000 + 馬連正味4000)
assert.strictEqual(comboSettle.totalPayout, 12000);
console.log('✅ Test 3 Passed: 券種プール独立により複数券種でも数学的に100%整合します');

// テスト 4: 的中者ゼロ返金の検証
console.log('Test 4: No winner full refund verification');
// 誰も買っていない大穴 hC が勝った場合
const refundSettle = settleEventBets(tickets2, 'hC', undefined, odds2, true);
assert.strictEqual(refundSettle.hitCount, 0);
assert.strictEqual(refundSettle.totalPayout, 0);
assert.strictEqual(refundSettle.totalRefund, 10000); // 2000 + 8000 全額返金
assert.strictEqual(refundSettle.settledTickets[0].refunded, true);
assert.strictEqual(refundSettle.settledTickets[0].payout, 2000); // 賭け金全額戻る
assert.strictEqual(refundSettle.settledTickets[1].refunded, true);
assert.strictEqual(refundSettle.settledTickets[1].payout, 8000); // 賭け金全額戻る
console.log('✅ Test 4 Passed: 的中者ゼロ返金が確実に全額返還されます');

console.log('🎉 ALL PAYOUT & SETTLEMENT TESTS PASSED PERFECTLY!');
