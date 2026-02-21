/**
 * Runtime sync backend config (localStorage).
 * Lets each install use its own Supabase project so the app builder's free tier is not consumed.
 */

export type SyncProvider = "none" | "supabase";

const SYNC_PROVIDER_KEY = "sync_provider";
const SYNC_SUPABASE_URL_KEY = "sync_supabase_url";
const SYNC_SUPABASE_ANON_KEY_KEY = "sync_supabase_anon_key";

export interface SyncConfig {
  provider: SyncProvider;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export function getSyncConfig(): SyncConfig {
  if (typeof window === "undefined") {
    return { provider: "none", supabaseUrl: "", supabaseAnonKey: "" };
  }
  const provider = (localStorage.getItem(SYNC_PROVIDER_KEY) || "none") as SyncProvider;
  const supabaseUrl = localStorage.getItem(SYNC_SUPABASE_URL_KEY) || "";
  const supabaseAnonKey = localStorage.getItem(SYNC_SUPABASE_ANON_KEY_KEY) || "";
  return { provider, supabaseUrl, supabaseAnonKey };
}

export function setSyncConfig(config: Partial<SyncConfig>): void {
  if (typeof window === "undefined") return;
  if (config.provider !== undefined) {
    localStorage.setItem(SYNC_PROVIDER_KEY, config.provider);
  }
  if (config.supabaseUrl !== undefined) {
    localStorage.setItem(SYNC_SUPABASE_URL_KEY, config.supabaseUrl);
  }
  if (config.supabaseAnonKey !== undefined) {
    localStorage.setItem(SYNC_SUPABASE_ANON_KEY_KEY, config.supabaseAnonKey);
  }
  window.dispatchEvent(new Event("sync-config-changed"));
}
