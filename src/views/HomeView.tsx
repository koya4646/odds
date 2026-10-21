import React, { useState, useEffect } from 'react';
import { PlusCircle, LogIn, Sparkles, ShieldCheck, HelpCircle } from 'lucide-react';
import { createRoom, joinRoom } from '../utils/storage';
import { Room, Participant } from '../types';

interface HomeViewProps {
  onRoomJoined: (room: Room, participant: Participant) => void;
  onToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onRoomJoined, onToast }) => {
  const [mode, setMode] = useState<'join' | 'create'>('join');

  // 参加フォーム
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');

  // 作成フォーム
  const [createRoomName, setCreateRoomName] = useState('');
  const [createHostName, setCreateHostName] = useState('');
  const [initialPoints, setInitialPoints] = useState<number>(10000);
  const [takeoutRatePercent, setTakeoutRatePercent] = useState<number>(20);

  const [loading, setLoading] = useState(false);

  // URLパラメータから参加コードを自動取得
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code') || params.get('join') || params.get('room');
    if (code) {
      setJoinCode(code.toUpperCase());
      setMode('join');
    }
  }, []);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim() || !joinName.trim()) {
      onToast('参加コードとお名前を入力してください。', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await joinRoom(joinCode.trim(), joinName.trim());
      onToast(`「${result.room.name}」に参加しました！`, 'success');
      onRoomJoined(result.room, result.participant);
    } catch (err: any) {
      onToast(err.message || 'ルームに参加できませんでした。', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createRoomName.trim() || !createHostName.trim()) {
      onToast('ルーム名とお名前を入力してください。', 'error');
      return;
    }

    setLoading(true);
    try {
      const takeoutRate = takeoutRatePercent / 100;
      const result = await createRoom(
        createRoomName.trim(),
        createHostName.trim(),
        initialPoints,
        takeoutRate
      );
      onToast(`ルーム「${result.room.name}」を作成しました！`, 'success');
      onRoomJoined(result.room, result.host);
    } catch (err: any) {
      onToast(err.message || 'ルーム作成に失敗しました。', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center px-4 py-8 max-w-md mx-auto">
      {/* ヒーローヘッダー */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 text-4xl shadow-xl shadow-emerald-950/60 mb-4 animate-bounce-subtle">
          🏇
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
          Odds Party
        </h1>
        <p className="text-sm text-slate-400">
          友達同士で楽しむ、競馬風オッズ予想＆ベッティング
        </p>
      </div>

      {/* モード切替タブ */}
      <div className="w-full bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 flex gap-1 mb-6 shadow-lg">
        <button
          type="button"
          onClick={() => setMode('join')}
          className={`flex-1 py-2.5 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
            mode === 'join'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LogIn className="w-4 h-4" />
          <span>ルームに参加</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('create')}
          className={`flex-1 py-2.5 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
            mode === 'create'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          <span>新しく作る</span>
        </button>
      </div>

      {/* フォームカード */}
      <div className="w-full bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-xl">
        {mode === 'join' ? (
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                参加コード (6文字)
              </label>
              <input
                type="text"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="例: PARTY7"
                maxLength={8}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-center font-mono text-lg font-bold tracking-widest text-emerald-400 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                あなたのお名前（ニックネーム）
              </label>
              <input
                type="text"
                value={joinName}
                onChange={e => setJoinName(e.target.value)}
                placeholder="例: たなか"
                maxLength={20}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white font-bold rounded-xl shadow-lg shadow-emerald-950 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>パーティーに参加する</span>
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                ルーム名
              </label>
              <input
                type="text"
                value={createRoomName}
                onChange={e => setCreateRoomName(e.target.value)}
                placeholder="例: 金曜スマブラ予想会"
                maxLength={30}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                ホスト名（あなたの名前）
              </label>
              <input
                type="text"
                value={createHostName}
                onChange={e => setCreateHostName(e.target.value)}
                placeholder="例: 主催者やまぐち"
                maxLength={20}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  初期所持ポイント
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={initialPoints}
                    onChange={e => setInitialPoints(Math.max(100, Number(e.target.value)))}
                    step={1000}
                    min={100}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-amber-300 font-bold focus:outline-none focus:border-emerald-500"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-semibold pointer-events-none">pt</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  控除率 (テイクアウト)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={takeoutRatePercent}
                    onChange={e => setTakeoutRatePercent(Math.min(50, Math.max(0, Number(e.target.value))))}
                    step={5}
                    min={0}
                    max={50}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-emerald-400 font-bold focus:outline-none focus:border-emerald-500"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-semibold pointer-events-none">%</span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>控除率は20%（JRA単勝相当）が標準です。0%で全額山分けも可能！</span>
            </p>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white font-bold rounded-xl shadow-lg shadow-emerald-950 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <PlusCircle className="w-5 h-5" />
                  <span>ルームを開設する</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {/* フッター補足 */}
      <div className="mt-8 text-center text-xs text-slate-500 space-y-1">
        <p className="flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>現金・換金なし。友達同士で楽しむアミューズメント仕様です</span>
        </p>
      </div>
    </div>
  );
};
