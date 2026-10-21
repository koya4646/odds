import React, { useState } from 'react';
import { History, ArrowDownRight, ArrowUpRight, RotateCcw, Sparkles, Ticket } from 'lucide-react';
import { BetTicket, PointTransaction } from '../types';
import { formatOdds } from '../utils/oddsCalculator';

interface HistoryViewProps {
  transactions: PointTransaction[];
  tickets: BetTicket[];
  currentParticipantId: string;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  transactions,
  tickets,
  currentParticipantId
}) => {
  const [tab, setTab] = useState<'transactions' | 'tickets'>('transactions');

  // 自分に関連するトランザクション
  const myTxList = transactions.filter(t => t.participantId === currentParticipantId);
  // 自分のチケット
  const myTickets = tickets.filter(t => t.participantId === currentParticipantId);

  return (
    <div className="space-y-5 pb-24 max-w-xl mx-auto">
      {/* 見出し */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5">
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 mb-1">
          <History className="w-4 h-4" />
          <span>Point Activity</span>
        </div>
        <h2 className="text-xl font-extrabold text-white">履歴・通帳</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          投票、払い戻し、ポイント残高の変動履歴
        </p>
      </div>

      {/* サブタブ切替 */}
      <div className="bg-slate-900/80 p-1 rounded-2xl border border-slate-800 flex gap-1">
        <button
          type="button"
          onClick={() => setTab('transactions')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            tab === 'transactions'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          ポイント増減通帳 ({myTxList.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('tickets')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            tab === 'tickets'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          全投票チケット ({myTickets.length})
        </button>
      </div>

      {/* コンテンツ */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5">
        {tab === 'transactions' ? (
          myTxList.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">履歴がまだありません。</p>
          ) : (
            <div className="space-y-3">
              {myTxList.map(tx => {
                const isPositive = tx.amount > 0;
                const formattedTime = new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                return (
                  <div
                    key={tx.id}
                    className="p-3 bg-slate-950/70 rounded-2xl border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          tx.type === 'PAYOUT'
                            ? 'bg-amber-500/20 text-amber-400'
                            : tx.type === 'BET'
                            ? 'bg-rose-500/20 text-rose-400'
                            : tx.type === 'REFUND'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-emerald-500/20 text-emerald-400'
                        }`}
                      >
                        {tx.type === 'PAYOUT' && <Sparkles className="w-4 h-4" />}
                        {tx.type === 'BET' && <ArrowDownRight className="w-4 h-4" />}
                        {tx.type === 'REFUND' && <RotateCcw className="w-4 h-4" />}
                        {tx.type === 'INITIAL' && <ArrowUpRight className="w-4 h-4" />}
                      </div>

                      <div className="min-w-0">
                        <div className="font-bold text-white truncate">{tx.description}</div>
                        <div className="text-[10px] text-slate-500">{formattedTime}</div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`font-black text-sm tabular-nums ${
                          isPositive ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isPositive ? `+${tx.amount.toLocaleString()}` : tx.amount.toLocaleString()} pt
                      </div>
                      <div className="text-[10px] text-slate-400">
                        残高: {tx.balanceAfter.toLocaleString()} pt
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          myTickets.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">投票チケットがありません。</p>
          ) : (
            <div className="space-y-2.5">
              {myTickets.map(t => (
                <div
                  key={t.id}
                  className="p-3 bg-slate-950/70 rounded-2xl border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-slate-800 text-emerald-400 px-1.5 py-0.5 rounded text-[10px] font-bold">
                        {t.betType === 'WIN' ? '単勝' : t.betType === 'QUINELLA' ? '馬連' : '馬単'}
                      </span>
                      <span className="font-bold text-white">
                        {t.choiceNumbers.join(t.betType === 'EXACTA' ? ' → ' : ' - ')}
                      </span>
                      <span className="text-slate-400 text-[11px]">
                        ({t.choiceNames.join(', ')})
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      賭金: {t.amount.toLocaleString()} pt / 確定オッズ: {formatOdds(t.lockedOdds)}倍
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {t.isHit ? (
                      <span className="text-amber-300 font-extrabold text-sm">
                        +{t.payout.toLocaleString()} pt
                      </span>
                    ) : t.refunded ? (
                      <span className="text-blue-300 font-bold text-xs">
                        返金 +{t.payout.toLocaleString()} pt
                      </span>
                    ) : (
                      <span className="text-slate-500 text-xs">
                        {t.payout === 0 ? 'ハズレ' : `${t.payout} pt`}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};
