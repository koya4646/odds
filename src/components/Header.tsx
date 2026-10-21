import React, { useState } from 'react';
import { Copy, Check, Coins, LogOut, Database, Users, Trash2, QrCode } from 'lucide-react';
import { Participant, Room } from '../types';

interface HeaderProps {
  room: Room | null;
  currentParticipant: Participant | null;
  onLeaveRoom: () => void;
  onDeleteRoom?: () => void;
  onOpenQrModal: () => void;
  onOpenSupabaseConfig: () => void;
  onShowParticipants: () => void;
  onToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const Header: React.FC<HeaderProps> = ({
  room,
  currentParticipant,
  onLeaveRoom,
  onDeleteRoom,
  onOpenQrModal,
  onOpenSupabaseConfig,
  onShowParticipants,
  onToast
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyInvite = () => {
    if (!room) return;
    const url = `${window.location.origin}${window.location.pathname}?code=${room.code}`;
    const text = `Odds Party に招待されました！\nルーム: ${room.name}\n参加コード: ${room.code}\n参加URL: ${url}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    onToast('招待メッセージをクリップボードにコピーしました！', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const participantCount = room ? Object.keys(room.participants).length : 0;

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 shadow-sm">
      <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
        {/* 左: ロゴ＆ルーム名 */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-lg shadow-md shadow-emerald-950 shrink-0">
            🏇
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5 truncate">
              {room ? room.name : 'Odds Party'}
            </h1>
            {room && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-emerald-400 font-semibold tracking-wider">
                  {room.code}
                </span>
                <button
                  onClick={handleCopyInvite}
                  className="inline-flex items-center gap-1 hover:text-emerald-300 transition-colors"
                  title="招待リンクをコピー"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'コピー済' : '招待'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 右: 所持ポイント・参加者・設定・ログアウト */}
        <div className="flex items-center gap-2">
          {room && currentParticipant && (
            <>
              {/* 所持ポイントバッジ */}
              <div className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border border-amber-500/30 px-3 py-1.5 rounded-full shadow-inner">
                <Coins className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="flex items-baseline gap-1">
                  <span className="font-bold text-amber-300 text-sm tracking-tight tabular-nums">
                    {currentParticipant.points.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-amber-400/80 font-medium">pt</span>
                </div>
              </div>

              {/* 参加者リストボタン */}
              <button
                onClick={onShowParticipants}
                className="relative p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                title="参加者一覧"
              >
                <Users className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 bg-emerald-500 text-slate-950 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {participantCount}
                </span>
              </button>

              {/* スマホ参加 QRコード */}
              <button
                onClick={onOpenQrModal}
                className="p-2 rounded-lg bg-slate-800 text-emerald-400 hover:text-emerald-300 hover:bg-slate-700 transition-colors"
                title="スマホで参加（QRコード）"
              >
                <QrCode className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Supabase設定 */}
          <button
            onClick={onOpenSupabaseConfig}
            className="p-2 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors"
            title="クラウド保存 (Supabase) 設定"
          >
            <Database className="w-4 h-4" />
          </button>

          {/* 退出 または ホストならルーム削除 */}
          {room && (
            currentParticipant?.role === 'host' && onDeleteRoom ? (
              <button
                onClick={onDeleteRoom}
                className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                title="ルームを削除（解散）"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={onLeaveRoom}
                className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                title="ルームを出る"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )
          )}
        </div>
      </div>
    </header>
  );
};
