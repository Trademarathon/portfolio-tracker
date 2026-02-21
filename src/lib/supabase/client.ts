import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSyncConfig } from "./sync-config";

const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const envAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function extractProjectRef(url: string): string | null {
  try {
    const host = new URL(url).hostname; // e.g. abcdef.supabase.co
    const [ref] = host.split(".");
    return ref || null;
  } catch {
    return null;
  }
}

function purgeMalformedAuthCache(url: string): void {
  if (typeof window === "undefined") return;
  const ref = extractProjectRef(url);
  if (!ref) return;
  const key = `sb-${ref}-auth-token`;
  const raw = localStorage.getItem(key);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as any;
    const refresh =
      parsed?.refresh_token ??
      parsed?.currentSession?.refresh_token ??
      parsed?.session?.refresh_token;
    if (!refresh || typeof refresh !== "string" || refresh.trim().length < 8) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
  } catch {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
}

function createSafeAuthStorage() {
  if (typeof window === "undefined") return undefined;
  return {
    getItem(key: string): string | null {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        if (!key.startsWith("sb-") || !key.includes("-auth-token")) return raw;
        try {
          const parsed = JSON.parse(raw) as any;
          const refresh =
            parsed?.refresh_token ??
            parsed?.currentSession?.refresh_token ??
            parsed?.session?.refresh_token;
          if (!refresh || typeof refresh !== "string" || refresh.trim().length < 8) {
            localStorage.removeItem(key);
            sessionStorage.removeItem(key);
            return null;
          }
          return raw;
        } catch {
          localStorage.removeItem(key);
          sessionStorage.removeItem(key);
          return null;
        }
      } catch {
        return null;
      }
    },
    setItem(key: string, value: string): void {
      try {
        localStorage.setItem(key, value);
      } catch {
        // ignore quota/storage failures
      }
    },
    removeItem(key: string): void {
      try {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      } catch {
        // ignore
      }
    },
  };
}

export function createClient(url?: string, anonKey?: string): SupabaseClient {
  const u = url ?? envUrl;
  const k = anonKey ?? envAnonKey;
  const storage = createSafeAuthStorage();
  return createSupabaseClient(u, k, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage,
    },
  });
}

let browserClient: SupabaseClient | null = null;
let browserClientKey: string | null = null;

/** Reset cached client (call when sync config changes so next getSupabase uses new config). */
export function resetSupabaseClient(): void {
  browserClient = null;
  browserClientKey = null;
}

/** Singleton for use in browser. Uses runtime sync config (Settings) when provider is Supabase and URL/key set; else uses build-time env. */
export function getSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  const config = getSyncConfig();
  let url: string;
  let anonKey: string;
  let cacheKey: string;
  if (config.provider === "supabase" && config.supabaseUrl.trim() && config.supabaseAnonKey.trim()) {
    url = config.supabaseUrl.trim();
    anonKey = config.supabaseAnonKey.trim();
    cacheKey = `runtime:${url}`;
  } else {
    url = envUrl;
    anonKey = envAnonKey;
    cacheKey = envUrl ? `env:${envUrl}` : "env:empty";
  }
  if (!url || !anonKey) return null;
  if (browserClient && browserClientKey === cacheKey) return browserClient;
  purgeMalformedAuthCache(url);
  browserClient = createClient(url, anonKey);
  browserClientKey = cacheKey;
  return browserClient;
}

if (typeof window !== "undefined") {
  window.addEventListener("sync-config-changed", resetSupabaseClient);
}
