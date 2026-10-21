import React, { useState } from 'react';
import { Bookmark, Plus, Trash2, Copy, Check } from 'lucide-react';
import { BetType, EventTemplate } from '../types';
import { deleteRoomTemplate, saveRoomTemplate } from '../utils/storage';

interface TemplatesViewProps {
  roomId: string;
  templates: EventTemplate[];
  onUseTemplate: (template: EventTemplate) => void;
  onRefreshRoom: () => void;
  onToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const TemplatesView: React.FC<TemplatesViewProps> = ({
  roomId,
  templates,
  onUseTemplate,
  onRefreshRoom,
  onToast
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [takeoutRatePercent, setTakeoutRatePercent] = useState<number>(20);
  const [allowedBetTypes, setAllowedBetTypes] = useState<BetType[]>(['WIN', 'QUINELLA']);
  const [choices, setChoices] = useState<Array<{ number: number; name: string }>>([
    { number: 1, name: '選択肢 1' },
    { number: 2, name: '選択肢 2' },
    { number: 3, name: '選択肢 3' },
    { number: 4, name: '選択肢 4' },
  ]);

  const handleDuplicate = async (t: EventTemplate) => {
    const duplicated: EventTemplate = {
      ...t,
      id: 'tpl_' + Date.now(),
      name: `${t.name} (コピー)`,
      createdAt: Date.now()
    };
    await saveRoomTemplate(roomId, duplicated);
    onToast(`「${t.name}」を複製しました！`, 'success');
    onRefreshRoom();
  };

  const handleDelete = async (id: string, tName: string) => {
    if (confirm(`テンプレート「${tName}」を削除しますか？`)) {
      await deleteRoomTemplate(roomId, id);
      onToast('テンプレートを削除しました。', 'info');
      onRefreshRoom();
    }
  };

  const handleSaveNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onToast('テンプレート名を入力してください。', 'error');
      return;
    }

    const newTemplate: EventTemplate = {
      id: 'tpl_' + Date.now(),
      name: name.trim(),
      description: description.trim() || undefined,
      takeoutRate: takeoutRatePercent / 100,
      allowedBetTypes,
      choices,
      createdAt: Date.now()
    };

    await saveRoomTemplate(roomId, newTemplate);
    onToast('新規テンプレートを保存しました！', 'success');
    setIsCreating(false);
    setName('');
    setDescription('');
    onRefreshRoom();
  };

  return (
    <div className="space-y-5 pb-24 max-w-xl mx-auto">
      {/* 見出し */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 mb-1">
            <Bookmark className="w-4 h-4" />
            <span>Race Templates</span>
          </div>
          <h2 className="text-xl font-extrabold text-white">開催設定テンプレート</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            定例ゲームやトーナメント設定を保存・複製
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreating(!isCreating)}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{isCreating ? '閉じる' : '新規作成'}</span>
        </button>
      </div>

      {/* 新規テンプレート作成フォーム */}
      {isCreating && (
        <form onSubmit={handleSaveNew} className="bg-slate-900/90 border border-emerald-500/50 rounded-3xl p-5 shadow-2xl space-y-4">
          <h3 className="text-sm font-bold text-white">テンプレートの新規作成</h3>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              テンプレート名
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例: マリオカート8頭立て"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              説明
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="例: グランプリ150cc"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                控除率 (%)
              </label>
              <input
                type="number"
                value={takeoutRatePercent}
                onChange={e => setTakeoutRatePercent(Math.min(50, Math.max(0, Number(e.target.value))))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-emerald-400 font-bold text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                出走頭数
              </label>
              <div className="text-xs font-bold text-slate-300 py-2">
                {choices.length}頭
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-all"
          >
            このテンプレートを保存
          </button>
        </form>
      )}

      {/* テンプレートカード一覧 */}
      <div className="space-y-3">
        {templates.map(t => (
          <div
            key={t.id}
            className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-white mb-0.5">{t.name}</h4>
                {t.description && (
                  <p className="text-xs text-slate-400">{t.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleDuplicate(t)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                  title="複製"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(t.id, t.name)}
                  className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                  title="削除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 出走者プレビュー */}
            <div className="flex flex-wrap gap-1">
              {t.choices.map(c => (
                <span
                  key={c.number}
                  className="text-[11px] bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-300"
                >
                  {c.number}. {c.name}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
              <span className="text-slate-400">
                控除率: {(t.takeoutRate * 100).toFixed(0)}% / {t.allowedBetTypes.join(', ')}
              </span>

              <button
                type="button"
                onClick={() => onUseTemplate(t)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow active:scale-95 transition-all flex items-center gap-1"
              >
                <span>この雛形でレース作成</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
