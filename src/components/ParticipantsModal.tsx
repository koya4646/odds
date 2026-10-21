import React from 'react';
import { X, Users, Shield, Copy, Check } from 'lucide-react';
import { Room } from '../types';

interface ParticipantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room | null;
  currentParticipantId: string;
  onToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const ParticipantsModal: React.FC<ParticipantsModalProps> = ({
  isOpen,
  onClose,
  room,
  currentParticipantId,
  onToast
}) => {
  if (!isOpen || !room) return null;

  const participants = Object.values(room.participants);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room.code);
    onToast(`参加コード「${room.code}」をコピーしました！`, 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Users className="w-5 h-5 text-emerald-400" />
          <h3 className="text-base font-bold text-white">ルーム参加者一覧</h3>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          現在 {participants.length} 人が参加しています
        </p>

        {/* 参加コードコピー */}
        <div className="mb-4 p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-500 font-semibold">参加コード</div>
            <div className="text-sm font-mono font-bold text-emerald-400 tracking-wider">
              {room.code}
            </div>
          </div>
          <button
            onClick={handleCopyCode}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            title="コードをコピー"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>

        {/* 参加者リスト */}
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {participants.map(p => {
            const isMe = p.id === currentParticipantId;
            const isHost = p.role === 'host';

            return (
              <div
                key={p.id}
                className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">
                    {p.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-white truncate flex items-center gap-1.5">
                      <span>{p.name}</span>
                      {isMe && (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1 py-0.2 rounded font-bold">
                          あなた
                        </span>
                      )}
                      {isHost && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1 py-0.2 rounded font-bold">
                          ホスト
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      参加: {new Date(p.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-bold text-amber-300 tabular-nums">
                    {p.points.toLocaleString()} pt
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
