import React from 'react';
import { Plus, ChevronRight, Clock, Trophy, Flame, CheckCircle, ShieldAlert } from 'lucide-react';
import { GameEvent, Participant } from '../types';

interface RoomDashboardViewProps {
  events: GameEvent[];
  selectedEventId: string | null;
  onSelectEvent: (eventId: string) => void;
  onOpenCreateEvent: () => void;
  isHost: boolean;
  currentParticipant: Participant;
}

export const RoomDashboardView: React.FC<RoomDashboardViewProps> = ({
  events,
  selectedEventId,
  onSelectEvent,
  onOpenCreateEvent,
  isHost,
  currentParticipant
}) => {
  const getStatusBadge = (status: GameEvent['status']) => {
    switch (status) {
      case 'PREPARING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <Clock className="w-3 h-3" />
            事前予想中
          </span>
        );
      case 'BETTING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse">
            <Flame className="w-3 h-3 text-emerald-400" />
            投票受付中
          </span>
        );
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
            <ShieldAlert className="w-3 h-3" />
            締切済 (レース中)
          </span>
        );
      case 'SETTLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
            <CheckCircle className="w-3 h-3 text-slate-400" />
            精算済
          </span>
        );
    }
  };

  return (
    <div className="space-y-5 pb-20">
      {/* 上部バナー */}
      <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-900 p-5 rounded-3xl border border-emerald-900/40 shadow-xl flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-emerald-400 tracking-wider uppercase mb-1">
            Current Participant
          </div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <span>{currentParticipant.name}</span>
            {isHost && (
              <span className="text-[10px] bg-amber-500/20 border border-amber-500/40 text-amber-300 px-2 py-0.5 rounded-md font-bold">
                HOST
              </span>
            )}
          </h2>
          <div className="text-xs text-slate-400 mt-1">
            初期配布: {currentParticipant.initialPoints.toLocaleString()} pt からスタート
          </div>
        </div>

        {isHost && (
          <button
            onClick={onOpenCreateEvent}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-950 active:scale-95 transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>開催を作成</span>
          </button>
        )}
      </div>

      {/* 開催一覧タイトル */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
          <span>開催レース一覧</span>
          <span className="text-xs text-slate-500 font-normal">({events.length}件)</span>
        </h3>
      </div>

      {/* レースカード一覧 */}
      {events.length === 0 ? (
        <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-3xl p-10 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-800/80 flex items-center justify-center text-2xl">
            🏇
          </div>
          <p className="text-sm font-bold text-slate-300 mb-1">まだ開催がありません</p>
          <p className="text-xs text-slate-500 mb-4">
            {isHost
              ? '「開催を作成」ボタンからレースや対決を作成しましょう！'
              : 'ホストが開催を作成するのをお待ちください。'}
          </p>
          {isHost && (
            <button
              onClick={onOpenCreateEvent}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-lg transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>最初の開催を作成する</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((ev, index) => {
            const isSelected = selectedEventId === ev.id;

            return (
              <div
                key={ev.id}
                onClick={() => onSelectEvent(ev.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer select-none ${
                  isSelected
                    ? 'bg-slate-900 border-emerald-500/80 shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-500/40'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-slate-800 text-xs font-bold text-slate-400 flex items-center justify-center shrink-0">
                      R{events.length - index}
                    </span>
                    <h4 className="font-bold text-white text-base truncate">
                      {ev.title}
                    </h4>
                  </div>
                  {getStatusBadge(ev.status)}
                </div>

                {ev.description && (
                  <p className="text-xs text-slate-400 mb-3 line-clamp-1">
                    {ev.description}
                  </p>
                )}

                {/* 選択肢チップ */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {ev.choices.map(c => (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-1.5 text-xs bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: c.color || '#94a3b8' }}
                      />
                      <span className="font-semibold text-slate-300">{c.number}.</span>
                      <span className="text-slate-200">{c.name}</span>
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                  <div className="flex items-center gap-3">
                    <span>控除率: {(ev.takeoutRate * 100).toFixed(0)}%</span>
                    <span>券種: {ev.allowedBetTypes.join(', ')}</span>
                  </div>
                  <div className="flex items-center gap-1 text-emerald-400 font-semibold">
                    <span>{isSelected ? '選択中' : '選択して進む'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
