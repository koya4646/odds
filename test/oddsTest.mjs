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

function calculateInitialOdds(choices, submissions, takeoutRate, allowedBetTypes = ['WIN']) {
  const result = {};
  if (choices.length === 0) return result;

  const winPointsMap = {};
  choices.forEach(c => { winPointsMap[c.id] = 0; });
  let totalForecastPoints = 0;

  submissions.forEach(sub => {
    sub.items.forEach(item => {
      if (winPointsMap[item.choiceId] !== undefined) {
        winPointsMap[item.choiceId] += item.points;
        totalForecastPoints += item.points;
      }
    });
  });

  const netMultiplier = Math.max(0, 1 - takeoutRate);

  if (totalForecastPoints <= 0) {
    const defaultWinOdds = choices.length * netMultiplier;
    choices.forEach(c => {
      result[makeBetKey('WIN', [c.id])] = Math.max(1.0, defaultWinOdds);
    });
    return result;
  }

  choices.forEach(c => {
    const pts = winPointsMap[c.id];
    const key = makeBetKey('WIN', [c.id]);
    if (pts > 0) {
      const odds = (totalForecastPoints * netMultiplier) / pts;
      result[key] = Math.max(1.0, odds);
    } else {
      result[key] = 99.9;
    }
  });

  return result;
}

function calculateLiveOdds(tickets, takeoutRate, initialOdds = {}) {
  const betTotals = {};
  let totalPool = 0;

  tickets.forEach(ticket => {
    const key = makeBetKey(ticket.betType, ticket.choices);
    betTotals[key] = (betTotals[key] || 0) + ticket.amount;
    totalPool += ticket.amount;
  });

  const netMultiplier = Math.max(0, 1 - takeoutRate);
  const netPool = totalPool * netMultiplier;
  const odds = { ...initialOdds };

  Object.keys(betTotals).forEach(key => {
    const targetBet = betTotals[key];
    if (targetBet > 0 && totalPool > 0) {
      const calculated = netPool / targetBet;
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
    const odds = ticket.lockedOdds || lockedOdds[key] || 1.0;

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

console.log('🧪 Starting Odds Party Logic Tests...');

// 1. キー生成テスト
assert.strictEqual(makeBetKey('WIN', ['c1']), 'WIN:c1');
assert.strictEqual(makeBetKey('QUINELLA', ['c2', 'c1']), 'QUINELLA:c1+c2');
assert.strictEqual(makeBetKey('EXACTA', ['c1', 'c2']), 'EXACTA:c1->c2');
console.log('✅ 1. makeBetKey OK');

// 2. 初期オッズ計算テスト
const choices = [
  { id: 'c1', number: 1, name: 'A' },
  { id: 'c2', number: 2, name: 'B' },
  { id: 'c3', number: 3, name: 'C' },
];
const forecasts = [
  {
    items: [
      { choiceId: 'c1', points: 600 },
      { choiceId: 'c2', points: 200 },
      { choiceId: 'c3', points: 200 },
    ]
  }
];
const initOdds = calculateInitialOdds(choices, forecasts, 0.20);
assert(Math.abs(initOdds['WIN:c1'] - (800 / 600)) < 0.0001);
assert.strictEqual(initOdds['WIN:c2'], 4.0);
console.log('✅ 2. calculateInitialOdds OK');

// 3. 投票オッズ計算テスト
const tickets = [
  { betType: 'WIN', choices: ['c1'], amount: 1000 },
  { betType: 'WIN', choices: ['c2'], amount: 3000 }
];
const liveResult = calculateLiveOdds(tickets, 0.20, initOdds);
assert.strictEqual(liveResult.totalPool, 4000);
assert.strictEqual(liveResult.odds['WIN:c1'], 3.2); // (4000 * 0.8) / 1000 = 3.2
assert(Math.abs(liveResult.odds['WIN:c2'] - (3200 / 3000)) < 0.0001);
console.log('✅ 3. calculateLiveOdds OK');

// 4. 精算・的中テスト (c1 1着)
const settle1 = settleEventBets(tickets, 'c1', 'c2', { 'WIN:c1': 3.2, 'WIN:c2': 1.066 }, true);
assert.strictEqual(settle1.hitCount, 1);
assert.strictEqual(settle1.settledTickets[0].payout, 3200);
assert.strictEqual(settle1.settledTickets[1].payout, 0);
console.log('✅ 4. settleEventBets (c1 win) OK');

// 5. 的中者ゼロ返金テスト (c3 1着)
const settleZero = settleEventBets(tickets, 'c3', 'c1', { 'WIN:c1': 3.2, 'WIN:c2': 1.066 }, true);
assert.strictEqual(settleZero.hitCount, 0);
assert.strictEqual(settleZero.totalRefund, 4000);
assert.strictEqual(settleZero.settledTickets[0].payout, 1000);
assert.strictEqual(settleZero.settledTickets[1].payout, 3000);
console.log('✅ 5. settleEventBets (No winner refund) OK');

// 6. 馬連・馬単テスト
const comboTickets = [
  { betType: 'EXACTA', choices: ['c1', 'c2'], amount: 500 },
  { betType: 'EXACTA', choices: ['c2', 'c1'], amount: 500 },
  { betType: 'QUINELLA', choices: ['c2', 'c1'], amount: 1000 },
];
const comboSettle = settleEventBets(comboTickets, 'c1', 'c2', {
  'EXACTA:c1->c2': 8.5,
  'EXACTA:c2->c1': 12.0,
  'QUINELLA:c1+c2': 4.2
}, true);
assert.strictEqual(comboSettle.hitCount, 2);
assert.strictEqual(comboSettle.settledTickets[0].payout, 4250);
assert.strictEqual(comboSettle.settledTickets[1].payout, 0);
assert.strictEqual(comboSettle.settledTickets[2].payout, 4200);
console.log('✅ 6. Exacta & Quinella settle OK');

console.log('🎉 ALL SUITES PASSED VERIFICATION!');
