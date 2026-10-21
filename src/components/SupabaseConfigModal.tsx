import React, { useState } from 'react';
import { X, Database, Check, Copy, ExternalLink, ShieldAlert } from 'lucide-react';
import { getStoredSupabaseConfig, saveSupabaseConfig } from '../utils/supabaseClient';
import { SupabaseConfig } from '../types';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({
  isOpen,
  onClose,
  onToast
}) => {
  if (!isOpen) return null;

  const current = getStoredSupabaseConfig();
  const [url, setUrl] = useState(current.url);
  const [anonKey, setAnonKey] = useState(current.anonKey);
  const [enabled, setEnabled] = useState(current.enabled);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const config: SupabaseConfig = {
      url: url.trim(),
      anonKey: anonKey.trim(),
      enabled: enabled && Boolean(url.trim() && anonKey.trim())
    };
    saveSupabaseConfig(config);
    onToast('Supabase接続設定を保存しました。画面を再読込します。', 'success');
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const handleCopySchemaNotice = () => {
    navigator.clipboard.writeText(`プロジェクトルートの supabase/schema.sql を Supabase の SQL Editor に貼り付けて Run してください。`);
    onToast('SQLスキーマ案内をコピーしました', 'info');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 mb-2">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
            <Database className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">Supabase クラウド同期設定</h3>
        </div>

        <p className="text-xs text-slate-400 mb-4">
          SupabaseのProject URLとanon public keyを設定すると、複数端末・スマートフォン間でリアルタイムにデータが同期されます。未設定の場合でも、同一ブラウザの複数タブ間で動作確認が可能です。
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Project URL
            </label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://xyzcompany.supabase.co"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Anon Public Key
            </label>
            <input
              type="password"
              value={anonKey}
              onChange={e => setAnonKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
            <div className="text-xs font-semibold text-slate-300">
              Supabase 同期を有効化
            </div>
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
              className="w-4 h-4 accent-emerald-500 rounded"
            />
          </div>

          <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 text-[11px] text-slate-300 space-y-1.5">
            <div className="font-bold flex items-center justify-between">
              <span>テーブルスキーマ (schema.sql)</span>
              <button
                type="button"
                onClick={handleCopySchemaNotice}
                className="text-emerald-400 hover:underline flex items-center gap-1"
              >
                <Copy className="w-3 h-3" />
                <span>案内</span>
              </button>
            </div>
            <p className="text-slate-400">
              Supabaseダッシュボードの「SQL Editor」で、本プロジェクトの <code className="text-emerald-400">supabase/schema.sql</code> を実行することでテーブルが自動生成されます。
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-all"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-all"
            >
              設定を保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
