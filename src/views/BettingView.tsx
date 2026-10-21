import React, { useState } from 'react';
import { 
  Flame, 
  ShoppingCart, 
  Plus, 
  Trash2, 
  Check, 
  Clock, 
  TrendingUp, 
  ShieldAlert, 
  Ticket, 
  HelpCircle,
  Coins
} from 'lucide-react';
import { BetTicket, BetType, Choice, GameEvent, Participant } from '../types';
import { formatOdds, makeBetKey } from '../utils/oddsCalculator';
import { submitBets } from '../utils/storage';

interface CartItem {
  id: string;
  betType: BetType;
  choices: string[]; // choiceIds
  choiceNumbers: number[];
  choiceNames: string[];
  amount: number;
  odds: number;
}

interface BettingViewProps {
  event: GameEvent;
  currentOdds: Record<string, number>;
  myTickets: BetTicket[];
  allTickets: BetTicket[];
  participant: Participant;
  isHost: boolean;
  onAdvanceToClose?: () => void;
  onRefreshData: () => void;
  onToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const BettingView: React.FC<BettingViewProps> = ({
  event,
  currentOdds,
  myTickets,
  allTickets,
  participant,
  isHost,
  onAdvanceToClose,
  onRefreshData,
  onToast
}) => {
  const [activeBetType, setActiveBetType] = useState<BetType>(event.allowedBetTypes[0] || 'WIN');
  
  // 選択中の出走者
  const [selectedFirst, setSelectedFirst] = useState<Choice | null>(null);
  const [selectedSecond, setSelectedSecond] = useState<Choice | null>(null);

  // カート（一括購入）
  const [cart, setCart] = useState<CartItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const isClosed = event.status === 'CLOSED' || event.status === 'SETTLED';

  // 買い目生成ヘルパー
  const handleSelectChoice = (choice: Choice, slot: 'first' | 'second') => {
    if (slot === 'first') {
      if (selectedFirst?.id === choice.id) {
        setSelectedFirst(null);
      } else {
        setSelectedFirst(choice);
        if (selectedSecond?.id === choice.id) setSelectedSecond(null);
      }
    } else {
      if (selectedSecond?.id === choice.id) {
        setSelectedSecond(null);
      } else {
        setSelectedSecond(choice);
        if (selectedFirst?.id === choice.id) setSelectedFirst(null);
      }
    }
  };

  // カートに追加
  const handleAddToCart = () => {
    if (!selectedFirst) {
      onToast('対象を選択してください。', 'error');
      return;
    }

    let choices: string[] = [];
    let choiceNumbers: number[] = [];
    let choiceNames: string[] = [];

    if (activeBetType === 'WIN') {
      choices = [selectedFirst.id];
      choiceNumbers = [selectedFirst.number];
      choiceNames = [selectedFirst.name];
    } else {
      if (!selectedSecond) {
        onToast('2頭目を選択してください。', 'error');
        return;
      }
      if (selectedFirst.id === selectedSecond.id) {
        onToast('同じ出走者は選択できません。', 'error');
        return;
      }
      choices = [selectedFirst.id, selectedSecond.id];
      choiceNumbers = [selectedFirst.number, selectedSecond.number];
      choiceNames = [selectedFirst.name, selectedSecond.name];
    }

    const betKey = makeBetKey(activeBetType, choices);
    const odds = currentOdds[betKey] || 1.0;

    // 重複チェック
    const exists = cart.find(item => item.betType === activeBetType && item.choices.join(',') === choices.join(','));
    if (exists) {
      onToast('この買い目は既にカートに入っています。', 'info');
      return;
    }

    const newItem: CartItem = {
      id: 'cart_' + Date.now() + Math.random(),
      betType: activeBetType,
      choices,
      choiceNumbers,
      choiceNames,
      amount: 500, // デフォルト投票額 500 pt
      odds
    };

    setCart([...cart, newItem]);
    // 選択リセット
    setSelectedFirst(null);
    setSelectedSecond(null);
    onToast('買い目をカートに追加しました！', 'success');
  };

  const handleUpdateCartAmount = (cartId: string, amount: number) => {
    setCart(cart.map(c => c.id === cartId ? { ...c, amount: Math.max(10, amount) } : c));
  };

  const handleRemoveFromCart = (cartId: string) => {
    setCart(cart.filter(c => c.id !== cartId));
  };

  // 一括投票
  const totalCartAmount = cart.reduce((sum, item) => sum + item.amount, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (participant.points < totalCartAmount) {
      onToast(`所持ポイントが不足しています。（所持: ${participant.points.toLocaleString()} pt / 必要: ${totalCartAmount.toLocaleString()} pt）`, 'error');
      return;
    }

    setSubmitting(true);
    try {
      const betsToSubmit = cart.map(item => {
        const betKey = makeBetKey(item.betType, item.choices);
        return {
          betType: item.betType,
          choices: item.choices,
          choiceNumbers: item.choiceNumbers,
          choiceNames: item.choiceNames,
          amount: item.amount,
          currentOdds: currentOdds[betKey] || 1.0
        };
      });

      await submitBets(event.roomId, event.id, participant.id, participant.name, betsToSubmit);
      setCart([]);
      onToast(`${betsToSubmit.length}件の投票が完了しました！`, 'success');
      onRefreshData();
    } catch (err: any) {
      onToast(err.message || '投票に失敗しました。', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // 全投票総額
  const totalPool = allTickets.reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-5 pb-24 max-w-xl mx-auto">
      {/* 開催情報＆ステータスヘッダー */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5">
        <div className="flex items-center justify-between gap-2 mb-2">
          {isClosed ? (
            <span className="text-xs font-bold text-rose-300 bg-rose-500/10 border border-rose-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" />
              締切済（オッズ確定）
            </span>
          ) : (
            <span className="text-xs font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
              <Flame className="w-3 h-3 text-emerald-400" />
              投票受付中
            </span>
          )}

          <div className="text-xs text-slate-400 flex items-center gap-1 font-mono">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>総投票額: {totalPool.toLocaleString()} pt</span>
          </div>
        </div>

        <h2 className="text-xl font-extrabold text-white mb-1">{event.title}</h2>
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>控除率: {(event.takeoutRate * 100).toFixed(0)}%</span>
          <span>あなたの所持残高: <strong className="text-amber-300 font-bold">{participant.points.toLocaleString()} pt</strong></span>
        </div>
      </div>

      {/* ホスト用: 締切ボタン */}
      {isHost && !isClosed && (
        <div className="p-4 bg-purple-950/40 border border-purple-800/60 rounded-2xl flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-purple-300">ホスト操作: 投票締切</div>
            <div className="text-[11px] text-slate-400">締め切るとオッズが確定し、新規投票はできなくなります</div>
          </div>
          <button
            type="button"
            onClick={onAdvanceToClose}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-md active:scale-95 transition-all shrink-0"
          >
            投票を締め切る
          </button>
        </div>
      )}

      {/* 券種セレクター */}
      {!isClosed && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200">券種を選択</h3>
            <span className="text-xs text-slate-400">
              {activeBetType === 'WIN' && '1着を当てる（単勝）'}
              {activeBetType === 'QUINELLA' && '1・2着を着順問わず当てる（馬連）'}
              {activeBetType === 'EXACTA' && '1着・2着を着順通り当てる（馬単）'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {event.allowedBetTypes.map(type => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setActiveBetType(type);
                  setSelectedFirst(null);
                  setSelectedSecond(null);
                }}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                  activeBetType === type
                    ? 'bg-emerald-600 border-emerald-500 text-white shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {type === 'WIN' && '単勝'}
                {type === 'QUINELLA' && '馬連'}
                {type === 'EXACTA' && '馬単'}
              </button>
            ))}
          </div>

          {/* 出走者選択テーブル (マークカード風) */}
          <div className="space-y-3 pt-2">
            {/* 1着 / 単勝 選択 */}
            <div>
              <div className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>{activeBetType === 'WIN' ? '対象を選択' : activeBetType === 'EXACTA' ? '【1着】を選択' : '【1頭目】を選択'}</span>
                {selectedFirst && (
                  <span className="text-emerald-400 font-bold text-xs">
                    選択中: {selectedFirst.number}. {selectedFirst.name}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {event.choices.map(c => {
                  const isSelected = selectedFirst?.id === c.id;
                  const winKey = makeBetKey('WIN', [c.id]);
                  const odds = currentOdds[winKey];

                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectChoice(c, 'first')}
                      className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'bg-emerald-950/80 border-emerald-500 shadow-md ring-1 ring-emerald-500'
                          : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span
                          className="w-5 h-5 rounded text-[11px] font-bold flex items-center justify-center shrink-0"
                          style={{ backgroundColor: c.color || '#94a3b8', color: '#000' }}
                        >
                          {c.number}
                        </span>
                        <span className="text-xs font-bold text-white truncate">{c.name}</span>
                      </div>
                      {activeBetType === 'WIN' && (
                        <div className="text-right text-xs font-extrabold text-amber-300">
                          {formatOdds(odds)}倍
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2頭目 選択（馬連・馬単の場合） */}
            {activeBetType !== 'WIN' && (
              <div className="pt-2 border-t border-slate-800">
                <div className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>{activeBetType === 'EXACTA' ? '【2着】を選択' : '【2頭目】を選択'}</span>
                  {selectedSecond && (
                    <span className="text-emerald-400 font-bold text-xs">
                      選択中: {selectedSecond.number}. {selectedSecond.name}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {event.choices.map(c => {
                    const isSelected = selectedSecond?.id === c.id;
                    const isFirst = selectedFirst?.id === c.id;

                    return (
                      <button
                        key={c.id}
                        type="button"
                        disabled={isFirst}
                        onClick={() => handleSelectChoice(c, 'second')}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          isFirst
                            ? 'opacity-20 cursor-not-allowed bg-slate-900 border-slate-800'
                            : isSelected
                            ? 'bg-emerald-950/80 border-emerald-500 shadow-md ring-1 ring-emerald-500'
                            : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-5 h-5 rounded text-[11px] font-bold flex items-center justify-center shrink-0"
                            style={{ backgroundColor: c.color || '#94a3b8', color: '#000' }}
                          >
                            {c.number}
                          </span>
                          <span className="text-xs font-bold text-white truncate">{c.name}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* カートへ追加ボタン */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!selectedFirst || (activeBetType !== 'WIN' && !selectedSecond)}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 active:scale-[0.99] text-white font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>買い目を投票カートに追加</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 投票カート（一括購入） */}
      {!isClosed && cart.length > 0 && (
        <div className="bg-slate-900/90 border border-emerald-500/50 rounded-3xl p-5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-emerald-400" />
              <span>購入カート ({cart.length}点)</span>
            </h3>
            <button
              type="button"
              onClick={() => setCart([])}
              className="text-xs text-rose-400 hover:text-rose-300"
            >
              カートを空にする
            </button>
          </div>

          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
            {cart.map(item => {
              const betKey = makeBetKey(item.betType, item.choices);
              const liveOdds = currentOdds[betKey] || item.odds;

              return (
                <div
                  key={item.id}
                  className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-bold bg-slate-800 text-emerald-400 px-1.5 py-0.5 rounded">
                        {item.betType === 'WIN' ? '単勝' : item.betType === 'QUINELLA' ? '馬連' : '馬単'}
                      </span>
                      <span className="text-xs font-bold text-white">
                        {item.choiceNumbers.join(item.betType === 'EXACTA' ? ' → ' : ' - ')}
                      </span>
                      <span className="text-[11px] text-amber-300 font-extrabold ml-1">
                        {formatOdds(liveOdds)}倍
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {item.choiceNames.join(item.betType === 'EXACTA' ? ' → ' : ' & ')}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="relative w-24">
                      <input
                        type="number"
                        min={10}
                        step={100}
                        value={item.amount}
                        onChange={e => handleUpdateCartAmount(item.id, Number(e.target.value))}
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-right text-xs font-bold text-amber-300 focus:outline-none focus:border-emerald-500"
                      />
                      <span className="absolute right-6 top-1 text-[10px] text-slate-500 pointer-events-none">pt</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveFromCart(item.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <div className="text-xs text-slate-400">
              合計投票ポイント
            </div>
            <div className="text-lg font-extrabold text-amber-300 tabular-nums">
              {totalCartAmount.toLocaleString()} <span className="text-xs text-slate-400">pt</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCheckout}
            disabled={submitting || totalCartAmount > participant.points}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-950 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {submitting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Coins className="w-4 h-4 text-amber-300" />
                <span>まとめて投票する ({totalCartAmount.toLocaleString()} pt)</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* 自分の投票チケット一覧 */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Ticket className="w-4 h-4 text-emerald-400" />
            <span>あなたの投票チケット</span>
          </h3>
          <span className="text-xs text-slate-400">
            {myTickets.length}枚
          </span>
        </div>

        {myTickets.length === 0 ? (
          <p className="text-xs text-slate-500 py-3 text-center">まだこの開催への投票はありません。</p>
        ) : (
          <div className="space-y-2">
            {myTickets.map(t => {
              const betKey = makeBetKey(t.betType, t.choices);
              const odds = isClosed ? t.lockedOdds : (currentOdds[betKey] || t.lockedOdds);
              const estPayout = Math.floor(t.amount * odds);

              return (
                <div
                  key={t.id}
                  className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2 font-bold mb-0.5">
                      <span className="bg-slate-800 text-emerald-400 px-1.5 py-0.5 rounded text-[10px]">
                        {t.betType === 'WIN' ? '単勝' : t.betType === 'QUINELLA' ? '馬連' : '馬単'}
                      </span>
                      <span className="text-white">
                        {t.choiceNumbers.join(t.betType === 'EXACTA' ? ' → ' : ' - ')}
                      </span>
                      <span className="text-slate-400 text-[11px] font-normal truncate max-w-[140px]">
                        ({t.choiceNames.join(', ')})
                      </span>
                    </div>
                    <div className="text-slate-400 text-[11px]">
                      賭金: <strong className="text-slate-200">{t.amount.toLocaleString()} pt</strong>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-amber-300 font-extrabold text-sm">
                      {formatOdds(odds)}倍
                    </div>
                    <div className="text-[10px] text-slate-500">
                      予想払戻: {estPayout.toLocaleString()} pt
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 全オッズ表 (単勝一覧) */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-200">
          現在の単勝オッズ表
        </h3>
        <div className="space-y-2">
          {event.choices.map(c => {
            const key = makeBetKey('WIN', [c.id]);
            const odds = currentOdds[key];

            return (
              <div
                key={c.id}
                className="p-2.5 bg-slate-950/60 border border-slate-800/60 rounded-xl flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-5 h-5 rounded text-[11px] font-bold flex items-center justify-center shrink-0"
                    style={{ backgroundColor: c.color || '#94a3b8', color: '#000' }}
                  >
                    {c.number}
                  </span>
                  <span className="text-white font-bold">{c.name}</span>
                </div>
                <div className="text-amber-300 font-extrabold text-sm">
                  {formatOdds(odds)}倍
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
