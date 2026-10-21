import { 
  Room, 
  Participant, 
  GameEvent, 
  ForecastSubmission, 
  BetTicket, 
  PointTransaction,
  EventTemplate,
  BetType
} from '../types';
import { getSupabaseClient } from './supabaseClient';

const ROOMS_KEY = 'odds_party_rooms';
const CURRENT_USER_KEY = 'odds_party_current_user';
const broadcast = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('odds_party_channel') : null;

// ヘルパー: ランダムID・コード生成
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 誤読しやすいI, O, 0, 1を除外
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ユーザーセッション保存
export interface UserSession {
  participantId: string;
  name: string;
  roomId?: string;
}

export function getStoredUserSession(): UserSession | null {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveUserSession(session: UserSession): void {
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(session));
}

// LocalStorage Store
interface LocalStoreState {
  rooms: Record<string, Room>;
  events: Record<string, GameEvent[]>; // key: roomId
  forecasts: Record<string, ForecastSubmission[]>; // key: eventId
  tickets: Record<string, BetTicket[]>; // key: eventId
  transactions: Record<string, PointTransaction[]>; // key: roomId
}

// ローカル同期サーバー (Node.js) との連携
let localWs: WebSocket | null = null;
let isSyncingFromServer = false;

// サーバーからステートを取得してローカルとマージ
export async function syncWithLocalServer(): Promise<void> {
  try {
    const res = await fetch('/api/state');
    if (res.ok) {
      const serverState = await res.json();
      if (serverState && serverState.rooms) {
        isSyncingFromServer = true;
        localStorage.setItem(ROOMS_KEY, JSON.stringify(serverState));
        isSyncingFromServer = false;
        if (broadcast) broadcast.postMessage({ type: 'STATE_UPDATED' });
      }
    }
  } catch (e) {
    // サーバーが動いていない場合は静かにスルー (オフラインローカル単独動作)
  }
}

// サーバーへステートを送信
function pushStateToServer(state: LocalStoreState): void {
  if (isSyncingFromServer) return;
  fetch('/api/state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state)
  }).catch(() => {});
}

function initLocalWs(onUpdate: () => void) {
  if (typeof window === 'undefined') return;
  try {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    localWs = new WebSocket(wsUrl);

    localWs.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'STATE_UPDATED') {
          await syncWithLocalServer();
          onUpdate();
        }
      } catch (e) {}
    };

    localWs.onclose = () => {
      // 5秒後に再接続トライ
      setTimeout(() => initLocalWs(onUpdate), 5000);
    };
  } catch (e) {}
}

function getLocalState(): LocalStoreState {
  try {
    const raw = localStorage.getItem(ROOMS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error(e);
  }
  return {
    rooms: {},
    events: {},
    forecasts: {},
    tickets: {},
    transactions: {}
  };
}

function saveLocalState(state: LocalStoreState): void {
  localStorage.setItem(ROOMS_KEY, JSON.stringify(state));
  pushStateToServer(state);
  if (broadcast) {
    broadcast.postMessage({ type: 'STATE_UPDATED' });
  }
}

export function subscribeToSync(callback: () => void): () => void {
  const handler = () => callback();
  if (broadcast) {
    broadcast.addEventListener('message', handler);
  }
  window.addEventListener('storage', handler);

  // 初回サーバー同期とWebSocket接続
  syncWithLocalServer().then(() => callback());
  initLocalWs(callback);

  // Supabaseリアルタイム購読（もしあれば）
  const supabase = getSupabaseClient();
  let channel: any = null;
  if (supabase) {
    channel = supabase
      .channel('odds_realtime')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        callback();
      })
      .subscribe();
  }

  return () => {
    if (broadcast) {
      broadcast.removeEventListener('message', handler);
    }
    window.removeEventListener('storage', handler);
    if (localWs) {
      localWs.close();
      localWs = null;
    }
    if (channel && supabase) {
      supabase.removeChannel(channel);
    }
  };
}

// ========================================================
// ルーム操作
// ========================================================

export async function createRoom(
  name: string,
  hostName: string,
  initialPoints: number = 10000,
  defaultTakeoutRate: number = 0.20
): Promise<{ room: Room; host: Participant }> {
  const roomId = generateId();
  const hostId = generateId();
  const code = generateRoomCode();
  const now = Date.now();

  const host: Participant = {
    id: hostId,
    name: hostName,
    role: 'host',
    points: initialPoints,
    initialPoints,
    joinedAt: now
  };

  // デフォルトのテンプレート（例: 4頭立て・8頭立て）
  const defaultTemplates: EventTemplate[] = [
    {
      id: generateId(),
      name: '競馬風 4頭立て（基本）',
      description: '初心者におすすめの4頭レース。単勝＋馬連',
      takeoutRate: 0.20,
      allowedBetTypes: ['WIN', 'QUINELLA'],
      choices: [
        { number: 1, name: 'サンダーボルト' },
        { number: 2, name: 'ゴールドシップ風' },
        { number: 3, name: 'ディープインパクト' },
        { number: 4, name: 'ミッドナイトラン' },
      ],
      createdAt: now
    },
    {
      id: generateId(),
      name: '友達対決（6人トーナメント）',
      description: 'ゲームやスポーツ対決の順位予想',
      takeoutRate: 0.15,
      allowedBetTypes: ['WIN', 'EXACTA'],
      choices: [
        { number: 1, name: 'プレイヤー A' },
        { number: 2, name: 'プレイヤー B' },
        { number: 3, name: 'プレイヤー C' },
        { number: 4, name: 'プレイヤー D' },
        { number: 5, name: 'プレイヤー E' },
        { number: 6, name: 'プレイヤー F' },
      ],
      createdAt: now
    }
  ];

  const room: Room = {
    id: roomId,
    code,
    name,
    hostId,
    hostName,
    initialPoints,
    defaultTakeoutRate,
    participants: { [hostId]: host },
    templates: defaultTemplates,
    createdAt: now,
    updatedAt: now
  };

  // 初期ポイントトランザクション
  const initialTx: PointTransaction = {
    id: generateId(),
    roomId,
    participantId: hostId,
    participantName: hostName,
    type: 'INITIAL',
    amount: initialPoints,
    balanceAfter: initialPoints,
    description: '初期ポイント付与',
    createdAt: now
  };

  // Supabase保存
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('rooms').insert({
        id: room.id,
        code: room.code,
        name: room.name,
        host_id: room.hostId,
        host_name: room.hostName,
        initial_points: room.initialPoints,
        default_takeout_rate: room.defaultTakeoutRate,
        templates: room.templates,
        created_at: room.createdAt,
        updated_at: room.updatedAt
      });
      await supabase.from('participants').insert({
        id: host.id,
        room_id: room.id,
        name: host.name,
        role: host.role,
        points: host.points,
        initial_points: host.initialPoints,
        joined_at: host.joinedAt
      });
      await supabase.from('transactions').insert({
        id: initialTx.id,
        room_id: initialTx.roomId,
        participant_id: initialTx.participantId,
        participant_name: initialTx.participantName,
        type: initialTx.type,
        amount: initialTx.amount,
        balance_after: initialTx.balanceAfter,
        description: initialTx.description,
        created_at: initialTx.createdAt
      });
    } catch (e) {
      console.warn('Supabase save error (falling back to local):', e);
    }
  }

  // LocalState保存
  const state = getLocalState();
  state.rooms[roomId] = room;
  state.events[roomId] = [];
  state.transactions[roomId] = [initialTx];
  saveLocalState(state);

  saveUserSession({ participantId: hostId, name: hostName, roomId });
  return { room, host };
}

export async function joinRoom(
  code: string,
  participantName: string
): Promise<{ room: Room; participant: Participant }> {
  const normCode = code.trim().toUpperCase();
  const supabase = getSupabaseClient();

  // Supabaseから検索
  let room: Room | null = null;
  if (supabase) {
    try {
      const { data } = await supabase.from('rooms').select('*').eq('code', normCode).maybeSingle();
      if (data) {
        // パティシパントも取得
        const { data: parts } = await supabase.from('participants').select('*').eq('room_id', data.id);
        const partMap: Record<string, Participant> = {};
        parts?.forEach((p: any) => {
          partMap[p.id] = {
            id: p.id,
            name: p.name,
            role: p.role,
            points: p.points,
            initialPoints: p.initial_points,
            joinedAt: p.joined_at
          };
        });

        room = {
          id: data.id,
          code: data.code,
          name: data.name,
          hostId: data.host_id,
          hostName: data.host_name,
          initialPoints: data.initial_points,
          defaultTakeoutRate: data.default_takeout_rate,
          templates: data.templates || [],
          participants: partMap,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        };
      }
    } catch (e) {
      console.warn('Supabase fetch room error:', e);
    }
  }

  // ローカルからフォールバック検索
  const state = getLocalState();
  if (!room) {
    const found = Object.values(state.rooms).find(r => r.code.toUpperCase() === normCode);
    if (!found) {
      throw new Error(`招待コード「${normCode}」のルームが見つかりませんでした。`);
    }
    room = found;
  }

  // 同名参加者が既にいれば引き継ぎ、いなければ新規作成
  let participant = Object.values(room.participants).find(p => p.name === participantName.trim());
  const now = Date.now();

  if (!participant) {
    participant = {
      id: generateId(),
      name: participantName.trim(),
      role: 'member',
      points: room.initialPoints,
      initialPoints: room.initialPoints,
      joinedAt: now
    };

    room.participants[participant.id] = participant;
    room.updatedAt = now;

    const initialTx: PointTransaction = {
      id: generateId(),
      roomId: room.id,
      participantId: participant.id,
      participantName: participant.name,
      type: 'INITIAL',
      amount: room.initialPoints,
      balanceAfter: room.initialPoints,
      description: '初期ポイント付与',
      createdAt: now
    };

    if (supabase) {
      try {
        await supabase.from('participants').insert({
          id: participant.id,
          room_id: room.id,
          name: participant.name,
          role: participant.role,
          points: participant.points,
          initial_points: participant.initialPoints,
          joined_at: participant.joinedAt
        });
        await supabase.from('transactions').insert({
          id: initialTx.id,
          room_id: initialTx.roomId,
          participant_id: initialTx.participantId,
          participant_name: initialTx.participantName,
          type: initialTx.type,
          amount: initialTx.amount,
          balance_after: initialTx.balanceAfter,
          description: initialTx.description,
          created_at: initialTx.createdAt
        });
      } catch (e) {
        console.warn(e);
      }
    }

    if (!state.transactions[room.id]) state.transactions[room.id] = [];
    state.transactions[room.id].push(initialTx);
  }

  state.rooms[room.id] = room;
  saveLocalState(state);
  saveUserSession({ participantId: participant.id, name: participant.name, roomId: room.id });

  return { room, participant };
}

export async function deleteRoom(roomId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      // ON DELETE CASCADE により関連データ（participants, events, tickets, transactions, forecasts）も自動削除
      await supabase.from('rooms').delete().eq('id', roomId);
    } catch (e) {
      console.warn('Supabase delete room error:', e);
    }
  }

  const state = getLocalState();
  delete state.rooms[roomId];

  // 関連するイベント、チケット、予想、トランザクションのクリーンアップ
  const eventIds = (state.events[roomId] || []).map(e => e.id);
  delete state.events[roomId];
  delete state.transactions[roomId];

  eventIds.forEach(eId => {
    delete state.forecasts[eId];
    delete state.tickets[eId];
  });

  saveLocalState(state);
}

export async function getRoom(roomId: string): Promise<Room | null> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data } = await supabase.from('rooms').select('*').eq('id', roomId).maybeSingle();
      if (data) {
        const { data: parts } = await supabase.from('participants').select('*').eq('room_id', roomId);
        const partMap: Record<string, Participant> = {};
        parts?.forEach((p: any) => {
          partMap[p.id] = {
            id: p.id,
            name: p.name,
            role: p.role,
            points: p.points,
            initialPoints: p.initial_points,
            joinedAt: p.joined_at
          };
        });
        return {
          id: data.id,
          code: data.code,
          name: data.name,
          hostId: data.host_id,
          hostName: data.host_name,
          initialPoints: data.initial_points,
          defaultTakeoutRate: data.default_takeout_rate,
          templates: data.templates || [],
          participants: partMap,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        };
      }
    } catch (e) {
      console.warn(e);
    }
  }

  const state = getLocalState();
  return state.rooms[roomId] || null;
}

// テンプレート保存
export async function saveRoomTemplate(roomId: string, template: EventTemplate): Promise<void> {
  const state = getLocalState();
  const room = state.rooms[roomId];
  if (!room) return;

  const idx = room.templates.findIndex(t => t.id === template.id);
  if (idx >= 0) {
    room.templates[idx] = template;
  } else {
    room.templates.push(template);
  }
  room.updatedAt = Date.now();
  saveLocalState(state);

  const supabase = getSupabaseClient();
  if (supabase) {
    await supabase.from('rooms').update({ templates: room.templates, updated_at: room.updatedAt }).eq('id', roomId);
  }
}

// テンプレート削除
export async function deleteRoomTemplate(roomId: string, templateId: string): Promise<void> {
  const state = getLocalState();
  const room = state.rooms[roomId];
  if (!room) return;

  room.templates = room.templates.filter(t => t.id !== templateId);
  room.updatedAt = Date.now();
  saveLocalState(state);

  const supabase = getSupabaseClient();
  if (supabase) {
    await supabase.from('rooms').update({ templates: room.templates, updated_at: room.updatedAt }).eq('id', roomId);
  }
}

// ========================================================
// 開催 (Event) 操作
// ========================================================

export async function getEvents(roomId: string): Promise<GameEvent[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data } = await supabase.from('events').select('*').eq('room_id', roomId).order('created_at', { ascending: false });
      if (data) {
        return data.map((e: any) => ({
          id: e.id,
          roomId: e.room_id,
          title: e.title,
          description: e.description,
          takeoutRate: Number(e.takeout_rate),
          status: e.status,
          choices: e.choices || [],
          allowedBetTypes: e.allowed_bet_types || ['WIN'],
          refundIfNoWinner: e.refund_if_no_winner,
          deadlineTime: e.deadline_time,
          initialOdds: e.initial_odds || {},
          currentOdds: e.current_odds || {},
          lockedOdds: e.locked_odds || {},
          result: e.result,
          createdAt: e.created_at,
          settledAt: e.settled_at
        }));
      }
    } catch (e) {
      console.warn(e);
    }
  }

  const state = getLocalState();
  return state.events[roomId] || [];
}

export async function createEvent(
  roomId: string,
  title: string,
  choices: Array<{ number: number; name: string }>,
  takeoutRate: number = 0.20,
  allowedBetTypes: BetType[] = ['WIN'],
  description?: string,
  refundIfNoWinner: boolean = true,
  deadlineTime?: string
): Promise<GameEvent> {
  const eventId = generateId();
  const now = Date.now();

  const choiceObjects = choices.map((c, index) => ({
    id: generateId(),
    number: c.number || (index + 1),
    name: c.name,
    color: getHorseColor(index + 1)
  }));

  const newEvent: GameEvent = {
    id: eventId,
    roomId,
    title,
    description,
    takeoutRate,
    status: 'PREPARING',
    choices: choiceObjects,
    allowedBetTypes,
    refundIfNoWinner,
    deadlineTime,
    initialOdds: {},
    currentOdds: {},
    lockedOdds: {},
    createdAt: now
  };

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('events').insert({
        id: newEvent.id,
        room_id: newEvent.roomId,
        title: newEvent.title,
        description: newEvent.description,
        takeout_rate: newEvent.takeoutRate,
        status: newEvent.status,
        choices: newEvent.choices,
        allowed_bet_types: newEvent.allowedBetTypes,
        refund_if_no_winner: newEvent.refundIfNoWinner,
        deadline_time: newEvent.deadlineTime,
        initial_odds: {},
        current_odds: {},
        locked_odds: {},
        created_at: newEvent.createdAt
      });
    } catch (e) {
      console.warn(e);
    }
  }

  const state = getLocalState();
  if (!state.events[roomId]) state.events[roomId] = [];
  state.events[roomId].unshift(newEvent);
  saveLocalState(state);

  return newEvent;
}

export async function updateEvent(event: GameEvent): Promise<void> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('events').update({
        title: event.title,
        description: event.description,
        takeout_rate: event.takeoutRate,
        status: event.status,
        choices: event.choices,
        allowed_bet_types: event.allowedBetTypes,
        refund_if_no_winner: event.refundIfNoWinner,
        deadline_time: event.deadlineTime,
        initial_odds: event.initialOdds,
        current_odds: event.currentOdds,
        locked_odds: event.lockedOdds,
        result: event.result,
        settled_at: event.settledAt
      }).eq('id', event.id);
    } catch (e) {
      console.warn(e);
    }
  }

  const state = getLocalState();
  const list = state.events[event.roomId] || [];
  const idx = list.findIndex(e => e.id === event.id);
  if (idx >= 0) {
    list[idx] = event;
    saveLocalState(state);
  }
}

// 枠番カラーヘルパー（競馬風1〜8枠のカラー）
export function getHorseColor(number: number): string {
  const colors = [
    '#ffffff', // 1枠: 白
    '#1e293b', // 2枠: 黒
    '#ef4444', // 3枠: 赤
    '#3b82f6', // 4枠: 青
    '#eab308', // 5枠: 黄
    '#22c55e', // 6枠: 緑
    '#f97316', // 7枠: 橙
    '#ec4899', // 8枠: 桃
  ];
  return colors[(number - 1) % colors.length] || '#94a3b8';
}

// ========================================================
// 事前予想 (Forecasts)
// ========================================================

export async function getForecasts(eventId: string): Promise<ForecastSubmission[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data } = await supabase.from('forecasts').select('*').eq('event_id', eventId);
      if (data) {
        return data.map((d: any) => ({
          id: d.id,
          eventId: d.event_id,
          participantId: d.participant_id,
          participantName: d.participant_name,
          items: d.items,
          totalPoints: d.total_points,
          submittedAt: d.submitted_at
        }));
      }
    } catch (e) {
      console.warn(e);
    }
  }

  const state = getLocalState();
  return state.forecasts[eventId] || [];
}

export async function submitForecast(
  eventId: string,
  participantId: string,
  participantName: string,
  items: Array<{ choiceId: string; points: number }>
): Promise<ForecastSubmission> {
  const totalPoints = items.reduce((sum, item) => sum + item.points, 0);
  const now = Date.now();

  const submission: ForecastSubmission = {
    id: generateId(),
    eventId,
    participantId,
    participantName,
    items,
    totalPoints,
    submittedAt: now
  };

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      // 既存の予想があれば削除して再提出
      await supabase.from('forecasts').delete().eq('event_id', eventId).eq('participant_id', participantId);
      await supabase.from('forecasts').insert({
        id: submission.id,
        event_id: submission.eventId,
        participant_id: submission.participantId,
        participant_name: submission.participantName,
        items: submission.items,
        total_points: submission.totalPoints,
        submitted_at: submission.submittedAt
      });
    } catch (e) {
      console.warn(e);
    }
  }

  const state = getLocalState();
  if (!state.forecasts[eventId]) state.forecasts[eventId] = [];
  // 既存を上書き
  state.forecasts[eventId] = state.forecasts[eventId].filter(f => f.participantId !== participantId);
  state.forecasts[eventId].push(submission);
  saveLocalState(state);

  return submission;
}

// ========================================================
// 投票 (Tickets & Points)
// ========================================================

export async function getTickets(eventId: string): Promise<BetTicket[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data } = await supabase.from('tickets').select('*').eq('event_id', eventId).order('created_at', { ascending: false });
      if (data) {
        return data.map((t: any) => ({
          id: t.id,
          eventId: t.event_id,
          participantId: t.participant_id,
          participantName: t.participant_name,
          betType: t.bet_type,
          choices: t.choices,
          choiceNumbers: t.choice_numbers,
          choiceNames: t.choice_names,
          amount: t.amount,
          lockedOdds: Number(t.locked_odds),
          payout: t.payout,
          isHit: t.is_hit,
          refunded: t.refunded,
          createdAt: t.created_at
        }));
      }
    } catch (e) {
      console.warn(e);
    }
  }

  const state = getLocalState();
  return state.tickets[eventId] || [];
}

export async function submitBets(
  roomId: string,
  eventId: string,
  participantId: string,
  participantName: string,
  bets: Array<{
    betType: BetType;
    choices: string[];
    choiceNumbers: number[];
    choiceNames: string[];
    amount: number;
    currentOdds: number;
  }>
): Promise<{ tickets: BetTicket[]; newBalance: number }> {
  const totalBetAmount = bets.reduce((sum, b) => sum + b.amount, 0);
  if (totalBetAmount <= 0) {
    throw new Error('投票ポイントが0です。');
  }

  const state = getLocalState();
  const room = state.rooms[roomId];
  if (!room) throw new Error('ルームが存在しません。');

  const participant = room.participants[participantId];
  if (!participant) throw new Error('参加者情報が見つかりません。');

  if (participant.points < totalBetAmount) {
    throw new Error(`ポイントが不足しています。（所持: ${participant.points.toLocaleString()} pt / 必要: ${totalBetAmount.toLocaleString()} pt）`);
  }

  // 残高減算
  participant.points -= totalBetAmount;
  room.updatedAt = Date.now();

  const now = Date.now();
  const newTickets: BetTicket[] = bets.map(b => ({
    id: generateId(),
    eventId,
    participantId,
    participantName,
    betType: b.betType,
    choices: b.choices,
    choiceNumbers: b.choiceNumbers,
    choiceNames: b.choiceNames,
    amount: b.amount,
    lockedOdds: b.currentOdds,
    payout: 0,
    isHit: false,
    refunded: false,
    createdAt: now
  }));

  const tx: PointTransaction = {
    id: generateId(),
    roomId,
    participantId,
    participantName,
    type: 'BET',
    amount: -totalBetAmount,
    balanceAfter: participant.points,
    description: `投票: ${newTickets.length}件 (${totalBetAmount.toLocaleString()} pt)`,
    relatedEventId: eventId,
    createdAt: now
  };

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      // ユーザーのポイント更新
      await supabase.from('participants').update({ points: participant.points }).eq('id', participantId).eq('room_id', roomId);
      // チケット登録
      const ticketRows = newTickets.map(t => ({
        id: t.id,
        event_id: t.eventId,
        participant_id: t.participantId,
        participant_name: t.participantName,
        bet_type: t.betType,
        choices: t.choices,
        choice_numbers: t.choiceNumbers,
        choice_names: t.choiceNames,
        amount: t.amount,
        locked_odds: t.lockedOdds,
        payout: 0,
        is_hit: false,
        refunded: false,
        created_at: t.createdAt
      }));
      await supabase.from('tickets').insert(ticketRows);
      // トランザクション
      await supabase.from('transactions').insert({
        id: tx.id,
        room_id: tx.roomId,
        participant_id: tx.participantId,
        participant_name: tx.participantName,
        type: tx.type,
        amount: tx.amount,
        balance_after: tx.balanceAfter,
        description: tx.description,
        related_event_id: tx.relatedEventId,
        created_at: tx.createdAt
      });
    } catch (e) {
      console.warn(e);
    }
  }

  if (!state.tickets[eventId]) state.tickets[eventId] = [];
  state.tickets[eventId].push(...newTickets);

  if (!state.transactions[roomId]) state.transactions[roomId] = [];
  state.transactions[roomId].push(tx);

  saveLocalState(state);

  return { tickets: newTickets, newBalance: participant.points };
}

// ========================================================
// 精算 (Settlement)
// ========================================================

export async function processSettlement(
  roomId: string,
  event: GameEvent,
  settledTickets: BetTicket[]
): Promise<void> {
  const state = getLocalState();
  const room = state.rooms[roomId];
  if (!room) return;

  const now = Date.now();
  const payoutByParticipant: Record<string, number> = {};
  const refundByParticipant: Record<string, number> = {};

  settledTickets.forEach(ticket => {
    if (ticket.isHit && ticket.payout > 0) {
      payoutByParticipant[ticket.participantId] = (payoutByParticipant[ticket.participantId] || 0) + ticket.payout;
    } else if (ticket.refunded && ticket.payout > 0) {
      refundByParticipant[ticket.participantId] = (refundByParticipant[ticket.participantId] || 0) + ticket.payout;
    }
  });

  const supabase = getSupabaseClient();
  const newTxList: PointTransaction[] = [];

  // 的中払い戻しの加算
  for (const [pId, amount] of Object.entries(payoutByParticipant)) {
    const part = room.participants[pId];
    if (part) {
      part.points += amount;
      const tx: PointTransaction = {
        id: generateId(),
        roomId,
        participantId: pId,
        participantName: part.name,
        type: 'PAYOUT',
        amount: amount,
        balanceAfter: part.points,
        description: `的中払い戻し「${event.title}」`,
        relatedEventId: event.id,
        createdAt: now
      };
      newTxList.push(tx);
      if (supabase) {
        await supabase.from('participants').update({ points: part.points }).eq('id', pId).eq('room_id', roomId);
      }
    }
  }

  // 的中者ゼロ等の返金加算
  for (const [pId, amount] of Object.entries(refundByParticipant)) {
    const part = room.participants[pId];
    if (part) {
      part.points += amount;
      const tx: PointTransaction = {
        id: generateId(),
        roomId,
        participantId: pId,
        participantName: part.name,
        type: 'REFUND',
        amount: amount,
        balanceAfter: part.points,
        description: `的中者なし返金「${event.title}」`,
        relatedEventId: event.id,
        createdAt: now
      };
      newTxList.push(tx);
      if (supabase) {
        await supabase.from('participants').update({ points: part.points }).eq('id', pId).eq('room_id', roomId);
      }
    }
  }

  // チケット状態更新
  state.tickets[event.id] = settledTickets;

  if (supabase) {
    try {
      for (const t of settledTickets) {
        await supabase.from('tickets').update({
          locked_odds: t.lockedOdds,
          payout: t.payout,
          is_hit: t.isHit,
          refunded: t.refunded
        }).eq('id', t.id);
      }
      if (newTxList.length > 0) {
        await supabase.from('transactions').insert(newTxList.map(t => ({
          id: t.id,
          room_id: t.roomId,
          participant_id: t.participantId,
          participant_name: t.participantName,
          type: t.type,
          amount: t.amount,
          balance_after: t.balanceAfter,
          description: t.description,
          related_event_id: t.relatedEventId,
          created_at: t.createdAt
        })));
      }
    } catch (e) {
      console.warn(e);
    }
  }

  if (!state.transactions[roomId]) state.transactions[roomId] = [];
  state.transactions[roomId].push(...newTxList);
  saveLocalState(state);
}

// ========================================================
// 履歴とトランザクション
// ========================================================

export async function getTransactions(roomId: string): Promise<PointTransaction[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data } = await supabase.from('transactions').select('*').eq('room_id', roomId).order('created_at', { ascending: false });
      if (data) {
        return data.map((d: any) => ({
          id: d.id,
          roomId: d.room_id,
          participantId: d.participant_id,
          participantName: d.participant_name,
          type: d.type,
          amount: d.amount,
          balanceAfter: d.balance_after,
          description: d.description,
          relatedEventId: d.related_event_id,
          createdAt: d.created_at
        }));
      }
    } catch (e) {
      console.warn(e);
    }
  }

  const state = getLocalState();
  const list = state.transactions[roomId] || [];
  return [...list].sort((a, b) => b.createdAt - a.createdAt);
}
