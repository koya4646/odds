import React, { useState } from 'react';
import { ArrowLeft, Plus, Trash2, Bookmark, CheckCircle, Sparkles, HelpCircle } from 'lucide-react';
import { BetType, EventTemplate, GameEvent } from '../types';
import { createEvent, saveRoomTemplate } from '../utils/storage';

interface CreateEventViewProps {
  roomId: string;
  templates: EventTemplate[];
  onBack: () => void;
  onCreated: (event: GameEvent) => void;
  onToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const CreateEventView: React.FC<CreateEventViewProps> = ({
  roomId,
  templates,
  onBack,
  onCreated,
  onToast
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [takeoutRatePercent, setTakeoutRatePercent] = useState<number>(20);
  const [refundIfNoWinner, setRefundIfNoWinner] = useState<boolean>(true);
  const [allowedBetTypes, setAllowedBetTypes] = useState<BetType[]>(['WIN', 'QUINELLA']);
  const [deadlineTime, setDeadlineTime] = useState<string>('');

  const [choices, setChoices] = useState<Array<{ number: number; name: string }>>([
    { number: 1, name: '出走者 1' },
    { number: 2, name: '出走者 2' },
    { number: 3, name: '出走者 3' },
    { number: 4, name: '出走者 4' },
  ]);

  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // テンプレートから適用
  const applyTemplate = (t: EventTemplate) => {
    setTitle(t.name);
    setDescription(t.description || '');
    setTakeoutRatePercent(Math.round(t.takeoutRate * 100));
    setAllowedBetTypes(t.allowedBetTypes);
    setChoices(t.choices.map((c, i) => ({ number: c.number || (i + 1), name: c.name })));
    onToast(`テンプレート「${t.name}」を適用しました`, 'info');
  };

  const handleAddChoice = () => {
    if (choices.length >= 18) {
      onToast('選択肢は最大18個までです。', 'error');
      return;
    }
    const nextNum = choices.length + 1;
    setChoices([...choices, { number: nextNum, name: `出走者 ${nextNum}` }]);
  };

  const handleRemoveChoice = (index: number) => {
    if (choices.length <= 2) {
      onToast('最低2つの選択肢が必要です。', 'error');
      return;
    }
    const filtered = choices.filter((_, i) => i !== index);
    // 番号を再整列
    setChoices(filtered.map((c, i) => ({ ...c, number: i + 1 })));
  };

  const handleChoiceNameChange = (index: number, name: string) => {
    const updated = [...choices];
    updated[index].name = name;
    setChoices(updated);
  };

  const toggleBetType = (type: BetType) => {
    if (allowedBetTypes.includes(type)) {
      if (allowedBetTypes.length === 1) {
        onToast('最低1つの券種を選択してください。', 'error');
        return;
      }
      setAllowedBetTypes(allowedBetTypes.filter(t => t !== type));
    } else {
      setAllowedBetTypes([...allowedBetTypes, type]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      onToast('開催タイトルを入力してください。', 'error');
      return;
    }

    if (choices.some(c => !c.name.trim())) {
      onToast('すべての選択肢の名前を入力してください。', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const takeoutRate = takeoutRatePercent / 100;
      const created = await createEvent(
        roomId,
        title.trim(),
        choices,
        takeoutRate,
        allowedBetTypes,
        description.trim() || undefined,
        refundIfNoWinner,
        deadlineTime || undefined
      );

      // テンプレートとして保存がONの場合
      if (saveAsTemplate && templateName.trim()) {
        const newTemplate: EventTemplate = {
          id: 'tpl_' + Date.now(),
          name: templateName.trim(),
          description: description.trim() || undefined,
          takeoutRate,
          choices: choices.map(c => ({ number: c.number, name: c.name })),
          allowedBetTypes,
          createdAt: Date.now()
        };
        await saveRoomTemplate(roomId, newTemplate);
      }

      onToast(`「${created.title}」を作成しました！`, 'success');
      onCreated(created);
    } catch (err: any) {
      onToast(err.message || '作成に失敗しました。', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto pb-24">
      {/* 戻るボタン */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white mb-4 px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>開催一覧に戻る</span>
      </button>

      {/* テンプレートクイック適用 */}
      {templates.length > 0 && (
        <div className="mb-6 p-4 bg-slate-900/80 border border-slate-800 rounded-2xl">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300 mb-2">
            <Bookmark className="w-3.5 h-3.5 text-emerald-400" />
            <span>保存済みの雛形から読み込む</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {templates.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTemplate(t)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-xs font-semibold text-slate-200 rounded-xl border border-slate-700/80 transition-all flex items-center gap-1.5"
              >
                <span>{t.name}</span>
                <span className="text-[10px] text-slate-400">({t.choices.length}頭)</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 作成フォーム */}
      <form onSubmit={handleSubmit} className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span>新規開催の設定</span>
        </h2>

        {/* タイトル */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            開催タイトル・レース名 <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="例: 第1回 週末スマブラ最強決定戦"
            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
            required
          />
        </div>

        {/* 説明メモ */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            説明・ルールメモ（任意）
          </label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="例: 3本先取、アイテムありのガチトーナメント"
            className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* 選択肢・出走者 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
              <span>出走者 / 選択肢リスト</span>
              <span className="text-[11px] text-slate-500">({choices.length}頭)</span>
            </label>
            <button
              type="button"
              onClick={handleAddChoice}
              className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-semibold py-1 px-2.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>選択肢を追加</span>
            </button>
          </div>

          <div className="space-y-2">
            {choices.map((choice, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-slate-800 text-xs font-bold text-slate-300 flex items-center justify-center shrink-0">
                  {choice.number}
                </span>
                <input
                  type="text"
                  value={choice.name}
                  onChange={e => handleChoiceNameChange(index, e.target.value)}
                  placeholder={`出走者 ${choice.number}`}
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => handleRemoveChoice(index)}
                  disabled={choices.length <= 2}
                  className="p-2 text-slate-500 hover:text-rose-400 disabled:opacity-20 transition-colors"
                  title="削除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 設定グリッド（控除率・券種・返金） */}
        <div className="pt-2 border-t border-slate-800/80 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                控除率 (%)
              </label>
              <input
                type="number"
                value={takeoutRatePercent}
                onChange={e => setTakeoutRatePercent(Math.min(50, Math.max(0, Number(e.target.value))))}
                step={5}
                min={0}
                max={50}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-emerald-400 font-bold text-sm focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-500">標準: 20% (JRA競馬風)</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                締切時刻（目安・任意）
              </label>
              <input
                type="time"
                value={deadlineTime}
                onChange={e => setDeadlineTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* 券種選択 */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              投票可能な券種
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => toggleBetType('WIN')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                  allowedBetTypes.includes('WIN')
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-500'
                }`}
              >
                <span>単勝</span>
                <span className="text-[10px] font-normal opacity-80">1着を予想</span>
              </button>

              <button
                type="button"
                onClick={() => toggleBetType('QUINELLA')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                  allowedBetTypes.includes('QUINELLA')
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-500'
                }`}
              >
                <span>馬連</span>
                <span className="text-[10px] font-normal opacity-80">1-2着 順不同</span>
              </button>

              <button
                type="button"
                onClick={() => toggleBetType('EXACTA')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                  allowedBetTypes.includes('EXACTA')
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-500'
                }`}
              >
                <span>馬単</span>
                <span className="text-[10px] font-normal opacity-80">1着→2着 指定</span>
              </button>
            </div>
          </div>

          {/* 的中者ゼロ返金設定 */}
          <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
            <div>
              <div className="text-xs font-semibold text-slate-200">的中者なしの場合に返金</div>
              <div className="text-[11px] text-slate-500">的中者が0人の場合、全員の投票ポイントを全額返還します</div>
            </div>
            <input
              type="checkbox"
              checked={refundIfNoWinner}
              onChange={e => setRefundIfNoWinner(e.target.checked)}
              className="w-4 h-4 accent-emerald-500 rounded"
            />
          </div>

          {/* テンプレート保存トグル */}
          <div className="pt-2 border-t border-slate-800">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={saveAsTemplate}
                onChange={e => setSaveAsTemplate(e.target.checked)}
                className="w-4 h-4 accent-emerald-500 rounded"
              />
              <span>この設定を次回用のテンプレートとしても保存する</span>
            </label>
            {saveAsTemplate && (
              <div className="mt-2 pl-6">
                <input
                  type="text"
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  placeholder="テンプレート名（例: 定例スマブラ4頭）"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* 送信ボタン */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-950 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {submitting ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              <span>開催を作成して事前予想を開始</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
