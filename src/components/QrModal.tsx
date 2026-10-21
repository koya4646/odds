import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Smartphone, Copy, Check, Globe, Wifi, Key, ExternalLink } from 'lucide-react';
import { Room } from '../types';

interface QrModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room | null;
  onToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const QrModal: React.FC<QrModalProps> = ({
  isOpen,
  onClose,
  room,
  onToast
}) => {
  const [connectMode, setConnectMode] = useState<'internet' | 'wifi'>('internet');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [copiedPwd, setCopiedPwd] = useState(false);

  const [lanIp, setLanIp] = useState<string>('');
  const [tunnelUrl, setTunnelUrl] = useState<string>('');
  const [tunnelPassword, setTunnelPassword] = useState<string>('');
  const [loadingTunnel, setLoadingTunnel] = useState<boolean>(true);

  // サーバーからネットワーク情報を取得
  const fetchNetworkInfo = () => {
    fetch('/api/ip')
      .then(res => res.json())
      .then(data => {
        if (data) {
          if (data.ip) setLanIp(data.ip);
          if (data.tunnelUrl) {
            setTunnelUrl(data.tunnelUrl);
            setLoadingTunnel(false);
          }
          if (data.tunnelPassword) setTunnelPassword(data.tunnelPassword);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (isOpen) {
      fetchNetworkInfo();
      const interval = setInterval(fetchNetworkInfo, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  // Wi-Fi接続時のURL
  const host = lanIp && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? `${lanIp}:${window.location.port || '5173'}`
    : window.location.host;

  const wifiJoinUrl = room
    ? `${window.location.protocol}//${host}/?code=${room.code}`
    : `${window.location.protocol}//${host}/`;

  // インターネットトンネル経由（Wi-Fiなし・4G/5G用）のURL
  const internetJoinUrl = tunnelUrl
    ? (room ? `${tunnelUrl}/?code=${room.code}` : tunnelUrl)
    : '';

  // 現在選択中のターゲットURL
  const activeUrl = connectMode === 'internet' && internetJoinUrl ? internetJoinUrl : wifiJoinUrl;

  useEffect(() => {
    if (!isOpen || !activeUrl) return;

    QRCode.toDataURL(activeUrl, {
      width: 240,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    })
      .then(url => setQrDataUrl(url))
      .catch(err => console.error(err));
  }, [isOpen, activeUrl]);

  if (!isOpen) return null;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(activeUrl);
    setCopied(true);
    onToast('参加URLをコピーしました！', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPassword = () => {
    if (!tunnelPassword) return;
    navigator.clipboard.writeText(tunnelPassword);
    setCopiedPwd(true);
    onToast('認証パスワードをコピーしました！', 'success');
    setTimeout(() => setCopiedPwd(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative text-center">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 mb-2">
          <Smartphone className="w-6 h-6" />
        </div>

        <h3 className="text-lg font-bold text-white mb-1">
          スマホから参加する
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          カメラでQRコードを読み取るだけで、すぐにこのルームに参加できます
        </p>

        {/* 接続方式タブ切替 */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950 rounded-2xl border border-slate-800 mb-4">
          <button
            type="button"
            onClick={() => setConnectMode('internet')}
            className={`py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              connectMode === 'internet'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Wi-Fiなし (4G/5G)</span>
          </button>

          <button
            type="button"
            onClick={() => setConnectMode('wifi')}
            className={`py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              connectMode === 'wifi'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>同じWi-Fi内</span>
          </button>
        </div>

        {/* QRコード画像 */}
        <div className="p-3 bg-white rounded-2xl inline-block shadow-lg mb-3">
          {connectMode === 'internet' && !internetJoinUrl ? (
            <div className="w-48 h-48 flex flex-col items-center justify-center text-slate-700 text-xs gap-2 p-2">
              <div className="w-6 h-6 border-2 border-slate-300 border-t-emerald-600 rounded-full animate-spin" />
              <span>インターネット公開URLを準備中...</span>
            </div>
          ) : qrDataUrl ? (
            <img src={qrDataUrl} alt="Join QR Code" className="w-48 h-48 block mx-auto" />
          ) : (
            <div className="w-48 h-48 flex items-center justify-center text-slate-400 text-xs">
              生成中...
            </div>
          )}
        </div>

        {/* Wi-Fiなしモード時の追加案内 */}
        {connectMode === 'internet' && (
          <div className="mb-3 space-y-2">
            <div className="p-2.5 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-[11px] text-emerald-300 text-left space-y-1">
              <div className="font-bold flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span>Wi-Fi不要！スマホの4G/5Gで直接接続可能</span>
              </div>
              <p className="text-[10px] text-slate-300">
                外出先や異なる通信環境でもカメラで直接読み取って参加できます。
              </p>
            </div>

            {tunnelPassword && (
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs text-left">
                <div>
                  <div className="text-[10px] text-slate-400 font-medium">※初回確認画面が出た場合のパスワード</div>
                  <div className="font-mono font-bold text-amber-300 text-xs">
                    {tunnelPassword}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[11px] rounded-lg text-slate-300 font-semibold flex items-center gap-1"
                >
                  {copiedPwd ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedPwd ? '済' : 'コピー'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* 参加コード & URLコピー */}
        {room && (
          <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="text-left">
              <div className="text-[10px] text-slate-500 font-semibold">参加コード</div>
              <div className="text-sm font-mono font-bold text-emerald-400 tracking-widest">
                {room.code}
              </div>
            </div>
            <button
              onClick={handleCopyUrl}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'コピー済' : 'URLコピー'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
