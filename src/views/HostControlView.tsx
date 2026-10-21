import React, { useState } from 'react';
import { Trophy, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import { BetTicket, Choice, GameEvent } from '../types';
import { settleEventBets } from '../utils/oddsCalculator';
import { processSettlement, updateEvent } from '../utils/storage';

interface HostControlViewProps {
  event: GameEvent;
  tickets: BetTicket[];
  onSettled: (updatedEvent: GameEvent) => void;
  onToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const HostControlView: React.FC<HostControlViewProps> = ({
  event,
  tickets,
  onSettled,
  onToast
}) => {
  const [firstPlaceId, setFirstPlaceId] = useState<string>(event.choices[0]?.id || '');
  const [secondPlaceId, setSecondPlaceId] = useState<string>(event.choices[1]?.id || '');
  const [submitting, setSubmitting] = useState(false);

  const needsSecondPlace = event.allowedBetTypes.includes('QUINELLA') || event.allowedBetTypes.includes('EXACTA');

  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstPlaceId) {
      onToast('1着の出走者を選択してください。', 'error');
      return;
    }
    if (needsSecondPlace && (!secondPlaceId || firstPlaceId === secondPlaceId)) {
      onToast('2着の出走者を1着とは異なる対象から選択してください。', 'error');
      return;
    }

    if (event.status === 'SETTLED') {
      onToast('この開催は既に精算完了しています。', 'error');
      return;
    }

    setSubmitting(true);
    try {
      // 的中判定と払い戻し計算
      const { settledTickets, totalPayout, totalRefund, hitCount } = settleEventBets(
        tickets,
        firstPlaceId,
        needsSecondPlace ? secondPlaceId : undefined,
        event.lockedOdds,
        event.refundIfNoWinner
      );

      const totalPool = tickets.reduce((s, t) => s + t.amount, 0);

      const updatedEvent: GameEvent = {
        ...event,
        status: 'SETTLED',
        settledAt: Date.now(),
        result: {
          firstPlaceId,
          secondPlaceId: needsSecondPlace ? secondPlaceId : undefined,
          settledAt: Date.now(),
          totalPool,
          payoutPool: totalPayout,
          refundedPool: totalRefund,
          hitCount
        }
      };

      // データベース/ローカル更新 & ユーザーポイント反映
      await updateEvent(updatedEvent);
      await processSettlement(event.roomId, updatedEvent, settledTickets);

      onToast(`結果確定！ 的中者: ${hitCount}件、払戻: ${totalPayout.toLocaleString()} pt`, 'success');
      onSettled(updatedEvent);
    } catch (err: any) {
      onToast(err.message || '精算処理に失敗しました。', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4 max-w-xl mx-auto">
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-amber-400" />
        <h3 className="text-base font-bold text-white">
          レース結果の入力と自動精算
        </h3>
      </div>
      <p className="text-xs text-slate-400">
        ホストが正解（着順）を選択し確定すると、全参加者の投票が自動判定され、払い戻しポイントが即時付与されます。
      </p>

      <form onSubmit={handleSettle} className="space-y-4 pt-1">
        {/* 1着 */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-md bg-amber-400 text-slate-950 font-extrabold text-[11px] flex items-center justify-center">
              1着
            </span>
            <span>1着（優勝）</span>
          </label>
          <select
            value={firstPlaceId}
            onChange={e => setFirstPlaceId(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold text-sm focus:outline-none focus:border-emerald-500"
          >
            {event.choices.map(c => (
              <option key={c.id} value={c.id}>
                {c.number}. {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* 2着（連勝券種がある場合） */}
        {needsSecondPlace && (
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-md bg-slate-400 text-slate-950 font-extrabold text-[11px] flex items-center justify-center">
                2着
              </span>
              <span>2着（準優勝）</span>
            </label>
            <select
              value={secondPlaceId}
              onChange={e => setSecondPlaceId(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold text-sm focus:outline-none focus:border-emerald-500"
            >
              {event.choices
                .filter(c => c.id !== firstPlaceId)
                .map(c => (
                  <option key={c.id} value={c.id}>
                    {c.number}. {c.name}
                  </option>
                ))}
            </select>
          </div>
        )}

        {/* 注意事項 */}
        <div className="p-3 bg-amber-950/30 border border-amber-900/50 rounded-xl text-[11px] text-amber-200/80 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            確定ボタンを押すと払い戻しが即時計算され、参加者の残高へ付与されます。二重精算は防止されます。
          </span>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 active:scale-[0.98] text-slate-950 font-extrabold text-sm rounded-xl shadow-lg shadow-amber-950 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {submitting ? (
            <div className="w-5 h-5 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              <span>結果を確定して払い戻しを実行</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
