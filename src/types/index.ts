export type RoomRole = 'host' | 'member';

export interface Participant {
  id: string;
  name: string;
  avatarSeed?: string;
  role: RoomRole;
  points: number;
  initialPoints: number;
  joinedAt: number;
}

export interface Choice {
  id: string;
  number: number;
  name: string;
  details?: string;
  color?: string; // 枠番カラー風
}

export type BetType = 'WIN' | 'QUINELLA' | 'EXACTA'; // 単勝 (1着), 馬連 (1-2着 順不同), 馬単 (1-2着 着順指定)

export type EventStatus = 
  | 'PREPARING' // 事前予想中（初期オッズ算出前・算出中）
  | 'BETTING'   // 投票受付中（オッズ変動中）
  | 'CLOSED'    // 締切済（オッズ確定・レース中）
  | 'SETTLED';  // 結果入力・精算完了

export interface EventTemplate {
  id: string;
  name: string;
  description?: string;
  takeoutRate: number; // 控除率（0〜1, 例: 0.20 = 20%）
  choices: Array<{ number: number; name: string }>;
  allowedBetTypes: BetType[];
  createdAt: number;
}

export interface ForecastItem {
  choiceId: string;
  points: number; // 配分ポイント
}

export interface ForecastSubmission {
  id: string;
  eventId: string;
  participantId: string;
  participantName: string;
  items: ForecastItem[];
  totalPoints: number;
  submittedAt: number;
}

export interface BetTicket {
  id: string;
  eventId: string;
  participantId: string;
  participantName: string;
  betType: BetType;
  // 単勝なら choices: [choiceId]
  // 馬連・馬単なら choices: [firstChoiceId, secondChoiceId]
  choices: string[];
  choiceNumbers: number[];
  choiceNames: string[];
  amount: number; // 投票ポイント
  lockedOdds: number; // 締切時確定オッズ（締切時に記録）
  payout: number; // 払い戻し額（精算時に記録）
  isHit: boolean; // 的中したか
  refunded: boolean; // 的中者ゼロ返金等
  createdAt: number;
}

export interface EventResult {
  firstPlaceId: string;
  secondPlaceId?: string; // 2着
  thirdPlaceId?: string;  // 3着（参考用）
  settledAt: number;
  totalPool: number;
  payoutPool: number;
  refundedPool: number;
  hitCount: number;
}

export interface GameEvent {
  id: string;
  roomId: string;
  title: string;
  description?: string;
  takeoutRate: number; // 控除率 (例: 0.2)
  status: EventStatus;
  choices: Choice[];
  allowedBetTypes: BetType[];
  refundIfNoWinner: boolean; // 的中者なしの場合返金するか（デフォルトtrue）
  deadlineTime?: string; // 締切時刻（ISOまたはテキスト）
  
  // 計算用キャッシュ
  initialOdds: Record<string, number>; // key: betKey (WIN: "choiceId", EXACTA: "c1-c2", QUINELLA: "c1+c2")
  currentOdds: Record<string, number>;
  lockedOdds: Record<string, number>;
  
  result?: EventResult;
  createdAt: number;
  settledAt?: number;
}

export interface PointTransaction {
  id: string;
  roomId: string;
  participantId: string;
  participantName: string;
  type: 'INITIAL' | 'BET' | 'PAYOUT' | 'REFUND' | 'ADJUST';
  amount: number; // 正または負
  balanceAfter: number;
  description: string;
  relatedEventId?: string;
  createdAt: number;
}

export interface Room {
  id: string;
  code: string; // 招待コード (6文字英数)
  name: string;
  hostId: string;
  hostName: string;
  initialPoints: number; // 初期所持ポイント (例: 10000)
  defaultTakeoutRate: number; // デフォルト控除率 (例: 0.2)
  participants: Record<string, Participant>;
  templates: EventTemplate[];
  createdAt: number;
  updatedAt: number;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  enabled: boolean;
}
