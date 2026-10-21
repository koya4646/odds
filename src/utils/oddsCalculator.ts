import type { BetTicket, BetType, Choice, ForecastSubmission } from '../types';

export function makeBetKey(type: BetType, choices: string[]): string {
  if (type === 'WIN') {
    return `WIN:${choices[0]}`;
  }
  if (type === 'QUINELLA') {
    // 順不同なのでソート
    const sorted = [...choices].sort();
    return `QUINELLA:${sorted[0]}+${sorted[1]}`;
  }
  if (type === 'EXACTA') {
    // 着順あり
    return `EXACTA:${choices[0]}->${choices[1]}`;
  }
  return `${type}:${choices.join('-')}`;
}

/**
 * 事前予想の集計と初期オッズの計算
 * 計算ルール：初期オッズ ＝ 予想ポイント総額 × (1 − 控除率) ÷ 対象への予想ポイント
 */
export function calculateInitialOdds(
  choices: Choice[],
  submissions: ForecastSubmission[],
  takeoutRate: number,
  allowedBetTypes: BetType[] = ['WIN']
): Record<string, number> {
  const result: Record<string, number> = {};
  
  if (choices.length === 0) return result;
  
  // 1. 各選択肢への予想ポイント集計
  const winPointsMap: Record<string, number> = {};
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

  // 予想がゼロの場合のデフォルトオッズ（均等オッズ）
  if (totalForecastPoints <= 0) {
    const defaultWinOdds = choices.length * netMultiplier;
    choices.forEach(c => {
      result[makeBetKey('WIN', [c.id])] = Math.max(1.0, defaultWinOdds);
    });

    if (allowedBetTypes.includes('QUINELLA')) {
      const pairCount = (choices.length * (choices.length - 1)) / 2;
      const defaultQuinellaOdds = pairCount * netMultiplier;
      for (let i = 0; i < choices.length; i++) {
        for (let j = i + 1; j < choices.length; j++) {
          result[makeBetKey('QUINELLA', [choices[i].id, choices[j].id])] = Math.max(1.0, defaultQuinellaOdds);
        }
      }
    }

    if (allowedBetTypes.includes('EXACTA')) {
      const exactaCount = choices.length * (choices.length - 1);
      const defaultExactaOdds = exactaCount * netMultiplier;
      for (let i = 0; i < choices.length; i++) {
        for (let j = 0; j < choices.length; j++) {
          if (i !== j) {
            result[makeBetKey('EXACTA', [choices[i].id, choices[j].id])] = Math.max(1.0, defaultExactaOdds);
          }
        }
      }
    }

    return result;
  }

  // 単勝初期オッズ
  choices.forEach(c => {
    const pts = winPointsMap[c.id];
    const key = makeBetKey('WIN', [c.id]);
    if (pts > 0) {
      const odds = (totalForecastPoints * netMultiplier) / pts;
      result[key] = Math.max(1.0, odds);
    } else {
      // 予想投票なしの場合は大穴オッズ（例: 99.0倍）
      result[key] = 99.9;
    }
  });

  // 馬単・馬連の初期オッズ推定（確率論モデル: Harville formula）
  // 1着iの確率 Pi = winPoints[i]/totalPoints
  // 2着jの確率 P(j|i) = Pj / (1 - Pi)
  // P(i->j) = Pi * Pj / (1 - Pi)
  if (allowedBetTypes.includes('EXACTA') || allowedBetTypes.includes('QUINELLA')) {
    const probMap: Record<string, number> = {};
    choices.forEach(c => {
      // 0ポイントの場合は微小確率を付与して計算不能を防ぐ
      probMap[c.id] = (winPointsMap[c.id] + 0.1) / (totalForecastPoints + 0.1 * choices.length);
    });

    // 馬単
    if (allowedBetTypes.includes('EXACTA')) {
      choices.forEach(c1 => {
        choices.forEach(c2 => {
          if (c1.id !== c2.id) {
            const p1 = probMap[c1.id];
            const p2 = probMap[c2.id];
            const denominator = 1 - p1;
            const pExacta = denominator > 0 ? (p1 * p2) / denominator : 0.001;
            const odds = pExacta > 0 ? netMultiplier / pExacta : 99.9;
            result[makeBetKey('EXACTA', [c1.id, c2.id])] = Math.max(1.0, Math.min(999.9, odds));
          }
        });
      });
    }

    // 馬連
    if (allowedBetTypes.includes('QUINELLA')) {
      for (let i = 0; i < choices.length; i++) {
        for (let j = i + 1; j < choices.length; j++) {
          const c1 = choices[i];
          const c2 = choices[j];
          const p1 = probMap[c1.id];
          const p2 = probMap[c2.id];
          const pQuinella = ((p1 * p2) / (1 - p1)) + ((p2 * p1) / (1 - p2));
          const odds = pQuinella > 0 ? netMultiplier / pQuinella : 99.9;
          result[makeBetKey('QUINELLA', [c1.id, c2.id])] = Math.max(1.0, Math.min(999.9, odds));
        }
      }
    }
  }

  return result;
}

/**
 * 投票オッズの計算
 * 計算ルール：投票オッズ ＝ 投票総額 × (1 − 控除率) ÷ 対象への投票額
 * ※ 投票がない組み合わせには、初期オッズ（あれば）または基準大穴オッズを適用
 */
/**
 * 投票オッズの計算
 * 計算ルール：投票オッズ ＝ 投票総額 × (1 − 控除率) ÷ 対象への投票額
 * ※ パリミュチュエル方式に準拠し、券種（単勝/馬連/馬単）ごとのプールで独立計算
 * ※ 投票がない組み合わせには、初期オッズ（あれば）または基準大穴オッズを適用
 */
export function calculateLiveOdds(
  tickets: BetTicket[],
  takeoutRate: number,
  initialOdds: Record<string, number> = {}
): { odds: Record<string, number>; betTotals: Record<string, number>; totalPool: number } {
  const betTotals: Record<string, number> = {};
  const poolByType: Record<string, number> = {};
  let totalPool = 0;

  tickets.forEach(ticket => {
    const key = makeBetKey(ticket.betType, ticket.choices);
    betTotals[key] = (betTotals[key] || 0) + ticket.amount;
    poolByType[ticket.betType] = (poolByType[ticket.betType] || 0) + ticket.amount;
    totalPool += ticket.amount;
  });

  const netMultiplier = Math.max(0, 1 - takeoutRate);
  const odds: Record<string, number> = { ...initialOdds };

  // 券種ごとに正味プールからオッズを算出
  Object.keys(betTotals).forEach(key => {
    const targetBet = betTotals[key];
    const betType = key.split(':')[0]; // 'WIN', 'QUINELLA', 'EXACTA'
    const typePool = poolByType[betType] || 0;

    if (targetBet > 0 && typePool > 0) {
      // 投票オッズ ＝ 券種別投票総額 × (1 − 控除率) ÷ 対象への投票額
      const calculated = (typePool * netMultiplier) / targetBet;
      odds[key] = Math.max(1.0, calculated);
    }
  });

  return { odds, betTotals, totalPool };
}

/**
 * オッズ表示用の丸め処理
 * 内部では高精度を維持し、表示時に小数点第1位（または2位）に丸める
 */
export function formatOdds(odds: number | undefined): string {
  if (odds === undefined || isNaN(odds) || odds <= 0) {
    return '-';
  }
  // 小数点第1位表示（例: 2.5倍、12.0倍）
  return odds.toFixed(1);
}

/**
 * 的中判定と払い戻し計算
 * 払い戻し ＝ 投票額 × 締切時確定オッズ
 * 的中者がいない場合は、初期設定で投票ポイントを返金する
 */
export function settleEventBets(
  tickets: BetTicket[],
  firstPlaceId: string,
  secondPlaceId: string | undefined,
  lockedOdds: Record<string, number>,
  refundIfNoWinner: boolean = true
): {
  settledTickets: BetTicket[];
  totalPayout: number;
  totalRefund: number;
  hitCount: number;
} {
  // 当たりキーのセット
  const winningKeys = new Set<string>();
  
  // 単勝
  winningKeys.add(makeBetKey('WIN', [firstPlaceId]));

  // 馬連・馬単（2着がある場合）
  if (secondPlaceId) {
    winningKeys.add(makeBetKey('QUINELLA', [firstPlaceId, secondPlaceId]));
    winningKeys.add(makeBetKey('EXACTA', [firstPlaceId, secondPlaceId]));
  }

  // 的中判定
  let hitCount = 0;
  const hitsByKey: Record<string, number> = {};

  tickets.forEach(ticket => {
    const key = makeBetKey(ticket.betType, ticket.choices);
    if (winningKeys.has(key)) {
      hitCount++;
      hitsByKey[key] = (hitsByKey[key] || 0) + 1;
    }
  });

  let totalPayout = 0;
  let totalRefund = 0;

  // 的中者が全くいなくて返金設定の場合、全投票を返金
  const isAllRefund = hitCount === 0 && refundIfNoWinner && tickets.length > 0;

  const settledTickets = tickets.map(ticket => {
    const key = makeBetKey(ticket.betType, ticket.choices);
    // 締切時確定オッズ (lockedOdds) を最優先で適用（なければ暫定オッズ）
    const odds = (lockedOdds && lockedOdds[key] !== undefined)
      ? lockedOdds[key]
      : (ticket.lockedOdds || 1.0);

    if (isAllRefund) {
      totalRefund += ticket.amount;
      return {
        ...ticket,
        lockedOdds: odds,
        isHit: false,
        refunded: true,
        payout: ticket.amount // 投票額全額返金
      };
    }

    if (winningKeys.has(key)) {
      // 払い戻し ＝ 投票額 × 締切時オッズ
      // ポイントは整数に丸め（1pt未満切り捨て）
      const payout = Math.floor(ticket.amount * odds);
      totalPayout += payout;
      return {
        ...ticket,
        lockedOdds: odds,
        isHit: true,
        refunded: false,
        payout
      };
    }

    // 不的中
    return {
      ...ticket,
      lockedOdds: odds,
      isHit: false,
      refunded: false,
      payout: 0
    };
  });

  return {
    settledTickets,
    totalPayout,
    totalRefund,
    hitCount
  };
}
