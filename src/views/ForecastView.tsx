import React, { useState, useEffect } from 'react';
import { Sparkles, Check, ArrowRight, Eye, RefreshCw, BarChart2 } from 'lucide-react';
import { Choice, ForecastSubmission, GameEvent, Participant } from '../types';
import { getForecasts, submitForecast } from '../utils/storage';
import { calculateInitialOdds, formatOdds, makeBetKey } from '../utils/oddsCalculator';

interface ForecastViewProps {
  event: GameEvent;
  participant: Participant;
  isHost: boolean;
  onOpenForecastList: () => void;
  onAdvanceToBetting?: () => void;
  onToast: (text: string, type?: 'success' | 'error' | 'info') => void;
  onRefreshEvent: () => void;
}

export const ForecastView: React.FC<ForecastViewProps> = ({
  event,
  participant,
  isHost,
  onOpenForecastList,
  onAdvanceToBetting,
  onToast,
  onRefreshEvent
}) => {
  // 仮想予想用ポイントプール（例: 1,000pt）
  const FORECAST_POOL = 1000;
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [mySubmission, setMySubmission] = useState<ForecastSubmission | null>(null);
  const [allSubmissions, setAllSubmissions] = useState<ForecastSubmission[]>([]);

  // 読み込み
  const loadForecasts = async () => {
    const list = await getForecasts(event.id);
    setAllSubmissions(list);
    const mine = list.find(s => s.participantId === participant.id);
    if (mine) {
      setMySubmission(mine);
      const alloc: Record<string, number> = {};
      mine.items.forEach(item => {
        alloc[item.choiceId] = item.points;
      });
      setAllocations(alloc);
    } else {
      // 初期値: 均等配分
      const defaultPerChoice = Math.floor(FORECAST_POOL / event.choices.length);
      const alloc: Record<string, number> = {};
      event.choices.forEach(c => {
        alloc[c.id] = defaultPerChoice;
      });
      setAllocations(alloc);
    }
  };

  useEffect(() => {
    loadForecasts();
  }, [event.id, participant.id]);

  const currentTotal = Object.values(allocations).reduce((sum, v) => sum + (v || 0), 0);
  const remaining = FORECAST_POOL - currentTotal;

  const handlePointChange = (choiceId: string, val: number) => {
    const num = Math.max(0, val);
    setAllocations(prev => ({
      ...prev,
      [choiceId]: num
    }));
  };

  const handleQuickAdd = (choiceId: string, amount: number) => {
    const current = allocations[choiceId] || 0;
    const add = Math.min(Math.max(0, remaining), amount);
    setAllocations(prev => ({
      ...prev,
      [choiceId]: current + add
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentTotal === 0) {
      onToast('最低1つの選択肢にポイントを配分してください。', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const items = Object.entries(allocations)
        .filter(([_, pts]) => pts > 0)
        .map(([choiceId, points]) => ({ choiceId, points }));

      const sub = await submitForecast(event.id, participant.id, participant.name, items);
      setMySubmission(sub);
      onToast('事前予想を提出しました！初期オッズに反映されます。', 'success');
      await loadForecasts();
      onRefreshEvent();
    } catch (err: any) {
      onToast(err.message || '提出に失敗しました。', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // 全員の事前予想から計算される現在のリアルタイム初期オッズ予測
  const previewInitialOdds = calculateInitialOdds(
    event.choices,
    allSubmissions,
    event.takeoutRate,
    event.allowedBetTypes
  );

  return (
    <div className="space-y-5 pb-24 max-w-xl mx-auto">
      {/* レース見出し */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-full">
            STEP 1: 事前予想
          </span>
          <button
            type="button"
            onClick={onOpenForecastList}
            className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-xl border border-slate-700 transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-emerald-400" />
            <span>みんなの予想 ({allSubmissions.length}人)</span>
          </button>
        </div>
        <h2 className="text-xl font-extrabold text-white mb-1">{event.title}</h2>
        <p className="text-xs text-slate-400">
          レース前の予想ポイント配分から「初期オッズ」が自動算出されます。自信のある本命に多く配分しましょう！
        </p>
      </div>

      {/* 予想入力フォーム */}
      <form onSubmit={handleSubmit} className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="text-xs font-semibold text-slate-300">
            予想用ポイント残高
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-base font-extrabold tabular-nums ${remaining < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {remaining.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">/ {FORECAST_POOL.toLocaleString()} pt</span>
          </div>
        </div>

        {/* 出走者ごとの配分 */}
        <div className="space-y-3">
          {event.choices.map(choice => {
            const pts = allocations[choice.id] || 0;
            const percent = currentTotal > 0 ? ((pts / currentTotal) * 100).toFixed(0) : '0';
            const winKey = makeBetKey('WIN', [choice.id]);
            const estOdds = previewInitialOdds[winKey];

            return (
              <div
                key={choice.id}
                className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-2xl flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-6 h-6 rounded-md text-xs font-bold flex items-center justify-center shrink-0 shadow-sm"
                      style={{ backgroundColor: choice.color || '#94a3b8', color: '#000' }}
                    >
                      {choice.number}
                    </span>
                    <span className="font-bold text-white text-sm truncate">
                      {choice.name}
                    </span>
                  </div>

                  {/* 予想初期オッズプレビュー */}
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-slate-500 font-medium">予想初期オッズ</div>
                    <div className="text-sm font-extrabold text-amber-300 tabular-nums">
                      {estOdds ? `${formatOdds(estOdds)}倍` : '-'}
                    </div>
                  </div>
                </div>

                {/* スライダー & ポイント入力 */}
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={FORECAST_POOL}
                    step={50}
                    value={pts}
                    onChange={e => handlePointChange(choice.id, Number(e.target.value))}
                    className="flex-1 accent-emerald-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
                  />
                  <div className="w-20 relative">
                    <input
                      type="number"
                      min={0}
                      step={50}
                      value={pts}
                      onChange={e => handlePointChange(choice.id, Number(e.target.value))}
                      className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-right text-xs font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* クイック加算ボタン */}
                <div className="flex items-center justify-between gap-1 pt-1">
                  <span className="text-[11px] text-slate-500 font-medium">
                    配分割合: {percent}%
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleQuickAdd(choice.id, 100)}
                      className="text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded text-slate-300 font-semibold"
                    >
                      +100
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAdd(choice.id, 300)}
                      className="text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded text-slate-300 font-semibold"
                    >
                      +300
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePointChange(choice.id, 0)}
                      className="text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded text-rose-400 font-semibold"
                    >
                      クリア
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 送信ボタン */}
        <button
          type="submit"
          disabled={submitting || remaining < 0}
          className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-950 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {submitting ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Check className="w-4 h-4" />
              <span>{mySubmission ? '事前予想を更新する' : '事前予想を確定・送信'}</span>
            </>
          )}
        </button>
      </form>

      {/* ホスト専用: 投票受付への進行ボタン */}
      {isHost && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-2xl flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-emerald-300">ホスト管理アクション</div>
            <div className="text-[11px] text-slate-400">全員の予想が集まったら、本番投票を開始できます</div>
          </div>
          <button
            type="button"
            onClick={onAdvanceToBetting}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md active:scale-95 transition-all shrink-0"
          >
            <span>本番投票を開始</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
