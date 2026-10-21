import React from 'react';
import { Trophy, Medal, TrendingUp, Award, Users } from 'lucide-react';
import { BetTicket, Participant, Room } from '../types';

interface RankingViewProps {
  room: Room;
  currentParticipantId: string;
  allTickets: BetTicket[];
}

export const RankingView: React.FC<RankingViewProps> = ({
  room,
  currentParticipantId,
  allTickets
}) => {
  const participants = Object.values(room.participants);

  // 各参加者の集計データ作成
  const statsList = participants.map(part => {
    const partTickets = allTickets.filter(t => t.participantId === part.id);
    const totalBet = partTickets.reduce((s, t) => s + t.amount, 0);
    const totalPayout = partTickets.reduce((s, t) => s + (t.isHit ? t.payout : 0), 0);
    const hitCount = partTickets.filter(t => t.isHit).length;
    const ticketCount = partTickets.length;
    const returnRate = totalBet > 0 ? (totalPayout / totalBet) * 100 : 0;
    const hitRate = ticketCount > 0 ? (hitCount / ticketCount) * 100 : 0;
    const diffFromInitial = part.points - part.initialPoints;

    return {
      participant: part,
      points: part.points,
      diffFromInitial,
      totalBet,
      totalPayout,
      hitCount,
      ticketCount,
      returnRate,
      hitRate
    };
  });

  // ポイント降順でソート
  statsList.sort((a, b) => b.points - a.points);

  return (
    <div className="space-y-5 pb-24 max-w-xl mx-auto">
      {/* 見出し */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5 mb-1">
            <Trophy className="w-4 h-4" />
            <span>Leaderboard</span>
          </div>
          <h2 className="text-xl font-extrabold text-white">
            ルーム内ランキング
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            開催をまたいだ累計ポイント＆回収率
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-400 flex items-center gap-1 justify-end">
            <Users className="w-3.5 h-3.5" />
            <span>{participants.length}名参加</span>
          </span>
        </div>
      </div>

      {/* トップ3 表彰台カード */}
      {statsList.length >= 1 && (
        <div className="grid grid-cols-3 gap-2 pt-2 items-end">
          {/* 2位 */}
          <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-3 text-center flex flex-col items-center">
            <span className="text-lg mb-1">🥈</span>
            <span className="text-xs font-bold text-slate-300 truncate w-full">
              {statsList[1]?.participant.name || '-'}
            </span>
            <span className="text-xs font-extrabold text-slate-200 mt-1 tabular-nums">
              {statsList[1] ? `${statsList[1].points.toLocaleString()} pt` : '-'}
            </span>
          </div>

          {/* 1位 */}
          <div className="bg-gradient-to-b from-amber-950/60 to-slate-900 border-2 border-amber-500/60 rounded-2xl p-4 text-center flex flex-col items-center shadow-xl shadow-amber-950/40 relative -top-2">
            <span className="text-2xl mb-1">👑</span>
            <span className="text-sm font-extrabold text-amber-300 truncate w-full">
              {statsList[0]?.participant.name}
            </span>
            <span className="text-sm font-black text-amber-300 mt-1 tabular-nums">
              {statsList[0]?.points.toLocaleString()} <span className="text-[10px]">pt</span>
            </span>
            <span className="text-[10px] text-emerald-400 font-bold mt-0.5">
              {statsList[0]?.diffFromInitial >= 0 ? `+${statsList[0]?.diffFromInitial.toLocaleString()}` : statsList[0]?.diffFromInitial.toLocaleString()}
            </span>
          </div>

          {/* 3位 */}
          <div className="bg-slate-900/90 border border-amber-900/40 rounded-2xl p-3 text-center flex flex-col items-center">
            <span className="text-lg mb-1">🥉</span>
            <span className="text-xs font-bold text-amber-600 truncate w-full">
              {statsList[2]?.participant.name || '-'}
            </span>
            <span className="text-xs font-extrabold text-slate-300 mt-1 tabular-nums">
              {statsList[2] ? `${statsList[2].points.toLocaleString()} pt` : '-'}
            </span>
          </div>
        </div>
      )}

      {/* 詳細ランキングリスト */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-200">全参加者成績</h3>

        <div className="space-y-2.5">
          {statsList.map((item, index) => {
            const isMe = item.participant.id === currentParticipantId;

            return (
              <div
                key={item.participant.id}
                className={`p-3.5 rounded-2xl border transition-all ${
                  isMe
                    ? 'bg-emerald-950/40 border-emerald-500/60 shadow-md ring-1 ring-emerald-500/30'
                    : 'bg-slate-950/70 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-slate-800 text-xs font-bold text-slate-300 flex items-center justify-center shrink-0">
                      {index + 1}
                    </span>
                    <span className="text-sm font-bold text-white flex items-center gap-1.5">
                      <span>{item.participant.name}</span>
                      {isMe && (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-bold">
                          YOU
                        </span>
                      )}
                      {item.participant.role === 'host' && (
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-1 py-0.2 rounded font-semibold">
                          ホスト
                        </span>
                      )}
                    </span>
                  </div>

                  {/* 現在ポイント */}
                  <div className="text-right">
                    <div className="text-base font-black text-amber-300 tabular-nums">
                      {item.points.toLocaleString()} <span className="text-xs font-normal text-slate-400">pt</span>
                    </div>
                    <div className={`text-[11px] font-bold ${item.diffFromInitial >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {item.diffFromInitial >= 0 ? `+${item.diffFromInitial.toLocaleString()}` : item.diffFromInitial.toLocaleString()} pt
                    </div>
                  </div>
                </div>

                {/* サブ指標（回収率・的中率・投票数） */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 text-center">
                  <div className="bg-slate-900/60 p-1.5 rounded-lg">
                    <div className="text-[10px] text-slate-500">回収率</div>
                    <div className="font-bold text-slate-200">
                      {item.totalBet > 0 ? `${item.returnRate.toFixed(1)}%` : '-'}
                    </div>
                  </div>
                  <div className="bg-slate-900/60 p-1.5 rounded-lg">
                    <div className="text-[10px] text-slate-500">的中率</div>
                    <div className="font-bold text-slate-200">
                      {item.ticketCount > 0 ? `${item.hitRate.toFixed(1)}%` : '-'}
                    </div>
                  </div>
                  <div className="bg-slate-900/60 p-1.5 rounded-lg">
                    <div className="text-[10px] text-slate-500">的中数 / 投票数</div>
                    <div className="font-bold text-slate-200">
                      {item.hitCount} / {item.ticketCount}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
