import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { WebSocketServer } from 'ws';
import localtunnel from 'localtunnel';

const PORT = 3001;
const VITE_PORT = 5173;
const DATA_DIR = path.resolve('data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 初期ステート
let state = {
  rooms: {},
  events: {},
  forecasts: {},
  tickets: {},
  transactions: {}
};

// 起動時に保存済みデータを復元
if (fs.existsSync(DATA_FILE)) {
  try {
    state = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    console.log('[Server] Loaded persisted data from disk');
  } catch (e) {
    console.error('[Server] Failed to read data file:', e);
  }
}

function saveStateToDisk() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Server] Failed to save data file:', e);
  }
}

// ローカルIPv4アドレス取得
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// インターネット公開用トンネルURL (Wi-Fi不要・モバイル回線用)
let publicTunnelUrl = '';
let tunnelPassword = '';

async function startTunnel() {
  try {
    console.log('[Tunnel] Opening internet tunnel for mobile 4G/5G access...');
    const tunnel = await localtunnel({ port: VITE_PORT });
    publicTunnelUrl = tunnel.url;
    console.log(`[Tunnel] 🎉 Public Internet URL (Wi-Fi不要): ${publicTunnelUrl}`);

    // localtunnelの接続用パスワード（サーバーのグローバルIP）
    try {
      const res = await fetch('https://loca.lt/mytunnelpassword');
      tunnelPassword = await res.text();
      tunnelPassword = tunnelPassword.trim();
    } catch (e) {}

    tunnel.on('close', () => {
      console.log('[Tunnel] Tunnel closed. Reconnecting in 5s...');
      publicTunnelUrl = '';
      setTimeout(startTunnel, 5000);
    });

    tunnel.on('error', (err) => {
      console.error('[Tunnel Error]:', err);
    });
  } catch (err) {
    console.warn('[Tunnel] Failed to open tunnel (falling back to LAN):', err);
    setTimeout(startTunnel, 10000);
  }
}

const server = http.createServer((req, res) => {
  // CORSヘッダー
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ネットワーク情報 & トンネルURL返却
  if (req.url === '/api/ip' && req.method === 'GET') {
    const ip = getLocalIp();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      ip, 
      tunnelUrl: publicTunnelUrl,
      tunnelPassword
    }));
    return;
  }

  // ステート取得
  if (req.url === '/api/state' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(state));
    return;
  }

  // ステート更新
  if (req.url === '/api/state' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        state = payload;
        saveStateToDisk();

        // 全WebSocketクライアントへブロードキャスト
        broadcast({ type: 'STATE_UPDATED' });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

// WebSocket Server
const wss = new WebSocketServer({ server });

function broadcast(msg) {
  const str = JSON.stringify(msg);
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(str);
    }
  });
}

wss.on('connection', ws => {
  ws.on('message', message => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'SYNC') {
        broadcast({ type: 'STATE_UPDATED' });
      }
    } catch (e) {}
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIp();
  console.log(`[Sync Server] Listening on http://0.0.0.0:${PORT}`);
  console.log(`[Sync Server] Local LAN access: http://${ip}:${VITE_PORT}/`);
  // インターネットトンネル開始
  startTunnel();
});
