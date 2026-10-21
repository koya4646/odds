import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseConfig } from '../types';

const STORAGE_KEY = 'odds_party_supabase_config';

export function getStoredSupabaseConfig(): SupabaseConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to parse Supabase config', e);
  }

  // 環境変数フォールバック
  const env = (import.meta as any).env || {};
  const envUrl = env.VITE_SUPABASE_URL || '';
  const envKey = env.VITE_SUPABASE_ANON_KEY || '';

  return {
    url: envUrl,
    anonKey: envKey,
    enabled: Boolean(envUrl && envKey)
  };
}

export function saveSupabaseConfig(config: SupabaseConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

let cachedClient: SupabaseClient | null = null;
let currentConfigSig = '';

export function getSupabaseClient(): SupabaseClient | null {
  const config = getStoredSupabaseConfig();
  if (!config.enabled || !config.url || !config.anonKey) {
    return null;
  }

  const sig = `${config.url}_${config.anonKey}`;
  if (cachedClient && currentConfigSig === sig) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(config.url, config.anonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    });
    currentConfigSig = sig;
    return cachedClient;
  } catch (err) {
    console.error('Supabase initialization failed', err);
    return null;
  }
}
