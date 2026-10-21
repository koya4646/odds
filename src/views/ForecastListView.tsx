import React from 'react';
import { ArrowLeft, Users, Trophy, Award } from 'lucide-react';
import { Choice, ForecastSubmission, GameEvent } from '../types';
import { formatOdds, makeBetKey } from '../utils/oddsCalculator';

interface ForecastListViewProps {
  event: GameEvent;
  forecasts: ForecastSubmission[];
  initialOdds: Record<string, number>;
  onBack: () => void;
}

export const ForecastListView: React.FC<ForecastListViewProps> = ({
  event,
  forecasts,
  initialOdds,
  onBack
}) => {
  // 各選択肢への予想ポイント合計
  const choiceTotals: Record<string, number> = {};
  event.choices.forEach(c => { choiceTotals[c.id] = 0; });
  let grandTotal = 0;

  forecasts.forEach(f => {
    f.items.forEach(item => {
      if (choiceTotals[item.choiceId] !== undefined) {
        choiceTotals[item.choiceId] += item.points;
        grandTotal += item.points;
      }
    });
  });

  return (
    <div className="space-y-6 pb-24 max-w-xl mx-auto">
      {/* 戻るボタン */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>事前予想入力に戻る</span>
      </button>

      {/* サマリーカード */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
            予想集計
          </span>
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            提出者: {forecasts.length}人
          </span>
        </div>
        <h3 className="text-lg font-bold text-white mb-1">
          {event.title} - 事前予想集計
        </h3>
        <p className="text-xs text-slate-400">
          みんなの予想ポイント総額: <strong className="text-emerald-400">{grandTotal.toLocaleString()} pt</strong>
        </p>
      </div>

      {/* 出走者別 支持率 & 初期オッズランキング */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 space-y-4">
        <h4 className="text-sm font-bold text-slate-200">
          出走者ごとの支持率＆算出オッズ
        </h4>

        <div className="space-y-3">
          {event.choices
            .map(c => ({
              ...c,
              totalPoints: choiceTotals[c.id] || 0,
              odds: initialOdds[makeBetKey('WIN', [c.id])]
            }))
            .sort((a, b) => b.totalPoints - a.totalPoints)
            .map((choice, rank) => {
              const percent = grandTotal > 0 ? (choice.totalPoints / grandTotal) * 100 : 0;

              return (
                <div key={choice.id} className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 w-4">
                        {rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `${rank + 1}.`}
                      </span>
                      <span
                        className="w-5 h-5 rounded text-[11px] font-bold flex items-center justify-center"
                        style={{ backgroundColor: choice.color || '#94a3b8', color: '#000' }}
                      >
                        {choice.number}
                      </span>
                      <span className="text-sm font-bold text-white">{choice.name}</span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-slate-400 mr-2">
                        {choice.totalPoints.toLocaleString()} pt ({percent.toFixed(1)}%)
                      </span>
                      <span className="text-sm font-extrabold text-amber-300">
                        {formatOdds(choice.odds)}倍
                      </span>
                    </div>
                  </div>

                  {/* プログレスバー */}
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* 参加者別の予想詳細テーブル */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5">
        <h4 className="text-sm font-bold text-slate-200 mb-3">
          参加者別の予想配分
        </h4>

        {forecasts.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">まだ誰も提出していません。</p>
        ) : (
          <div className="space-y-2.5">
            {forecasts.map(f => (
              <div key={f.id} className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    {f.participantName}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    計 {f.totalPoints.toLocaleString()} pt
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {f.items.map(item => {
                    const c = event.choices.find(ch => ch.id === item.choiceId);
                    if (!c) return null;
                    return (
                      <span
                        key={item.choiceId}
                        className="text-[11px] bg-slate-800/80 px-2 py-0.5 rounded-lg border border-slate-700/60 flex items-center gap-1"
                      >
                        <span className="text-slate-400">{c.number}.{c.name}:</span>
                        <strong className="text-emerald-400">{item.points.toLocaleString()} pt</strong>
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
