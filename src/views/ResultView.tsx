import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, Award, Sparkles, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { BetTicket, GameEvent, Participant } from '../types';
import { formatOdds, makeBetKey } from '../utils/oddsCalculator';

interface ResultViewProps {
  event: GameEvent;
  tickets: BetTicket[];
  currentParticipant: Participant;
  isHost: boolean;
  onOpenHostSettle?: () => void;
}

export const ResultView: React.FC<ResultViewProps> = ({
  event,
  tickets,
  currentParticipant,
  isHost,
  onOpenHostSettle
}) => {
  const result = event.result;
  const isSettled = event.status === 'SETTLED' && !!result;

  // 自分の払い戻し
  const myTickets = tickets.filter(t => t.participantId === currentParticipant.id);
  const myPayout = myTickets.reduce((sum, t) => sum + (t.isHit || t.refunded ? t.payout : 0), 0);
  const myTotalBet = myTickets.reduce((sum, t) => sum + t.amount, 0);
  const hasMyHit = myTickets.some(t => t.isHit);

  // 紙吹雪演出
  useEffect(() => {
    if (isSettled && hasMyHit) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {
        // ignore
      }
    }
  }, [isSettled, hasMyHit]);

  const firstPlace = event.choices.find(c => c.id === result?.firstPlaceId);
  const secondPlace = event.choices.find(c => c.id === result?.secondPlaceId);

  return (
    <div className="space-y-6 pb-24 max-w-xl mx-auto">
      {/* 未精算時の案内 */}
      {!isSettled ? (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-3xl">
            🏇
          </div>
          <h3 className="text-xl font-bold text-white">結果発表・精算準備中</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {event.status === 'CLOSED'
              ? '投票が締め切られ、現在レース進行中です。ホストが結果を入力すると自動精算が行われます。'
              : 'まだ投票が締め切られていません。'}
          </p>

          {isHost && onOpenHostSettle && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onOpenHostSettle}
                className="px-6 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-extrabold text-sm rounded-xl shadow-lg shadow-amber-950 active:scale-95 transition-all"
              >
                着順・結果を入力する
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* 着順発表カード */}
          <div className="bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-amber-300 bg-amber-500/20 border border-amber-500/40 px-3 py-1 rounded-full flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5" />
                レース結果確定
              </span>
              <span className="text-xs text-slate-400">
                総投票プール: {result.totalPool.toLocaleString()} pt
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {/* 1着 */}
              <div className="p-4 bg-slate-950/80 rounded-2xl border border-amber-500/40 flex flex-col items-center text-center">
                <span className="text-[11px] font-bold text-amber-400 mb-1">🥇 1着（単勝）</span>
                <span
                  className="w-8 h-8 rounded-lg text-sm font-bold flex items-center justify-center mb-1"
                  style={{ backgroundColor: firstPlace?.color || '#94a3b8', color: '#000' }}
                >
                  {firstPlace?.number}
                </span>
                <span className="font-extrabold text-white text-sm truncate max-w-full">
                  {firstPlace?.name}
                </span>
              </div>

              {/* 2着 */}
              <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-700 flex flex-col items-center text-center">
                <span className="text-[11px] font-bold text-slate-400 mb-1">🥈 2着</span>
                {secondPlace ? (
                  <>
                    <span
                      className="w-8 h-8 rounded-lg text-sm font-bold flex items-center justify-center mb-1"
                      style={{ backgroundColor: secondPlace?.color || '#94a3b8', color: '#000' }}
                    >
                      {secondPlace?.number}
                    </span>
                    <span className="font-extrabold text-white text-sm truncate max-w-full">
                      {secondPlace?.name}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-slate-500 py-3">設定なし</span>
                )}
              </div>
            </div>

            {/* あなたの収支サマリー */}
            <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400 font-medium">あなたの払い戻し合計</div>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className={`text-xl font-extrabold tabular-nums ${myPayout > 0 ? 'text-amber-300' : 'text-slate-400'}`}>
                    {myPayout.toLocaleString()}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">pt</span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-[11px] text-slate-400">投票合計: {myTotalBet.toLocaleString()} pt</div>
                <div className={`text-xs font-bold ${myPayout >= myTotalBet ? 'text-emerald-400' : 'text-rose-400'}`}>
                  収支: {myPayout - myTotalBet >= 0 ? `+${(myPayout - myTotalBet).toLocaleString()}` : (myPayout - myTotalBet).toLocaleString()} pt
                </div>
              </div>
            </div>

            {/* 的中者ゼロ返金アナウンス */}
            {result.hitCount === 0 && result.refundedPool > 0 && (
              <div className="mt-4 p-3 bg-blue-950/40 border border-blue-800/60 rounded-xl text-xs text-blue-300 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 shrink-0" />
                <span>的中者なしのため、全員の投票ポイントが全額返金されました！</span>
              </div>
            )}
          </div>

          {/* 全チケットの判定結果 */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 space-y-3">
            <h4 className="text-sm font-bold text-slate-200 flex items-center justify-between">
              <span>全参加者の判定結果</span>
              <span className="text-xs text-slate-400 font-normal">的中: {result.hitCount}件</span>
            </h4>

            <div className="space-y-2">
              {tickets.map(t => (
                <div
                  key={t.id}
                  className={`p-3 rounded-2xl border flex items-center justify-between text-xs transition-all ${
                    t.isHit
                      ? 'bg-amber-950/30 border-amber-500/50 shadow-sm'
                      : t.refunded
                      ? 'bg-blue-950/20 border-blue-500/30'
                      : 'bg-slate-950/60 border-slate-800/80 opacity-60'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-white text-xs">{t.participantName}</span>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                        {t.betType === 'WIN' ? '単勝' : t.betType === 'QUINELLA' ? '馬連' : '馬単'}
                      </span>
                      <span className="font-bold text-slate-200">
                        {t.choiceNumbers.join(t.betType === 'EXACTA' ? ' → ' : ' - ')}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      賭金: {t.amount.toLocaleString()} pt / 確定オッズ: {formatOdds(t.lockedOdds)}倍
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {t.isHit ? (
                      <div>
                        <div className="text-xs font-bold text-amber-300 flex items-center justify-end gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                          <span>的中！</span>
                        </div>
                        <div className="text-sm font-extrabold text-amber-300">
                          +{t.payout.toLocaleString()} pt
                        </div>
                      </div>
                    ) : t.refunded ? (
                      <div>
                        <div className="text-xs font-bold text-blue-300">返金</div>
                        <div className="text-sm font-bold text-blue-300">
                          +{t.payout.toLocaleString()} pt
                        </div>
                      </div>
                    ) : (
                      <div className="text-slate-500 text-xs flex items-center justify-end gap-1">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>不的中</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
