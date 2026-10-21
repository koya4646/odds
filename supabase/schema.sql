-- ==========================================
-- Odds Party Supabase Database Schema
-- ==========================================

-- 1. rooms テーブル
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  host_id TEXT NOT NULL,
  host_name TEXT NOT NULL,
  initial_points INTEGER NOT NULL DEFAULT 10000,
  default_takeout_rate NUMERIC NOT NULL DEFAULT 0.20,
  templates JSONB DEFAULT '[]'::jsonb,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- 2. participants テーブル
CREATE TABLE IF NOT EXISTS participants (
  id TEXT NOT NULL,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar_seed TEXT,
  role TEXT NOT NULL DEFAULT 'member', -- 'host' or 'member'
  points INTEGER NOT NULL DEFAULT 10000,
  initial_points INTEGER NOT NULL DEFAULT 10000,
  joined_at BIGINT NOT NULL,
  PRIMARY KEY (id, room_id)
);

-- 3. events テーブル
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  takeout_rate NUMERIC NOT NULL DEFAULT 0.20,
  status TEXT NOT NULL DEFAULT 'PREPARING', -- 'PREPARING', 'BETTING', 'CLOSED', 'SETTLED'
  choices JSONB NOT NULL DEFAULT '[]'::jsonb,
  allowed_bet_types JSONB NOT NULL DEFAULT '["WIN"]'::jsonb,
  refund_if_no_winner BOOLEAN NOT NULL DEFAULT true,
  deadline_time TEXT,
  initial_odds JSONB DEFAULT '{}'::jsonb,
  current_odds JSONB DEFAULT '{}'::jsonb,
  locked_odds JSONB DEFAULT '{}'::jsonb,
  result JSONB,
  created_at BIGINT NOT NULL,
  settled_at BIGINT
);

-- 4. forecasts テーブル (事前予想)
CREATE TABLE IF NOT EXISTS forecasts (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL,
  participant_name TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_points INTEGER NOT NULL,
  submitted_at BIGINT NOT NULL
);

-- 5. tickets テーブル (投票チケット)
CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL,
  participant_name TEXT NOT NULL,
  bet_type TEXT NOT NULL,
  choices JSONB NOT NULL,
  choice_numbers JSONB NOT NULL,
  choice_names JSONB NOT NULL,
  amount INTEGER NOT NULL,
  locked_odds NUMERIC NOT NULL DEFAULT 1.0,
  payout INTEGER NOT NULL DEFAULT 0,
  is_hit BOOLEAN NOT NULL DEFAULT false,
  refunded BOOLEAN NOT NULL DEFAULT false,
  created_at BIGINT NOT NULL
);

-- 6. transactions テーブル (ポイント増減履歴)
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL,
  participant_name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'INITIAL', 'BET', 'PAYOUT', 'REFUND', 'ADJUST'
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT NOT NULL,
  related_event_id TEXT,
  created_at BIGINT NOT NULL
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
CREATE INDEX IF NOT EXISTS idx_participants_room ON participants(room_id);
CREATE INDEX IF NOT EXISTS idx_events_room ON events(room_id);
CREATE INDEX IF NOT EXISTS idx_forecasts_event ON forecasts(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_event ON tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_transactions_room ON transactions(room_id);

-- リアルタイム配信の安全な有効化（既に登録されている場合のエラーを自動回避）
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE participants;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE events;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE forecasts;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
