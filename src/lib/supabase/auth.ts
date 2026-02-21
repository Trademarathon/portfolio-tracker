import { getSupabase } from "./client";
import type { User, Session } from "@supabase/supabase-js";

export async function signInWithMagicLink(email: string): Promise<{ error: { message: string } | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: { message: "Supabase not configured" } };
  const { error } = await supabase.auth.signInWithOtp({ email });
  return { error: error ? { message: error.message } : null };
}

export async function signInWithPassword(
  email: string,
  password: string
): Promise<{ error: { message: string } | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: { message: "Supabase not configured" } };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error ? { message: error.message } : null };
}

export async function signUp(
  email: string,
  password: string
): Promise<{ error: { message: string } | null; needsEmailConfirm?: boolean }> {
  const supabase = getSupabase();
  if (!supabase) return { error: { message: "Supabase not configured" } };
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: { message: error.message } };
  const needsEmailConfirm = !!data?.user && !data?.session;
  return { error: null, needsEmailConfirm };
}

export type OAuthProvider = "google" | "apple";

export async function signInWithOAuth(provider: OAuthProvider): Promise<{ error: { message: string } | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: { message: "Supabase not configured" } };
  if (typeof window === "undefined") return { error: { message: "OAuth must run in browser" } };
  const redirectTo = `${window.location.origin}/auth/callback`;
  const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
  return { error: error ? { message: error.message } : null };
}

export async function signOut(): Promise<{ error: { message: string } | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: { message: "Supabase not configured" } };
  await supabase.auth.signOut({ scope: "local" });
  const { error } = await supabase.auth.signOut();
  return { error: error ? { message: error.message } : null };
}

function clearSupabaseStoredAuthTokens(): void {
  if (typeof window === "undefined") return;
  try {
    const matchAuthKey = (key: string) =>
      key.startsWith("sb-") && key.includes("-auth-token");
    const lsKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) lsKeys.push(k);
    }
    lsKeys.filter(matchAuthKey).forEach((k) => localStorage.removeItem(k));
    const ssKeys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k) ssKeys.push(k);
    }
    ssKeys.filter(matchAuthKey).forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // ignore storage cleanup failures
  }
}

/** True for "refresh token not found" / "invalid refresh token" – handle gracefully without throwing. */
function isRefreshTokenInvalidError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("refresh token") && (m.includes("not found") || m.includes("invalid"));
}

export type GetSessionResult = {
  data: { session: Session | null };
  error: { message: string } | null;
  /** True when session was cleared due to invalid/not-found refresh token; caller should clear any session cache. */
  sessionInvalidated?: boolean;
};

export async function getSession(): Promise<GetSessionResult> {
  const supabase = getSupabase();
  if (!supabase) return { data: { session: null }, error: { message: "Supabase not configured" } };
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error && isRefreshTokenInvalidError(error.message)) {
      await supabase.auth.signOut({ scope: "local" });
      clearSupabaseStoredAuthTokens();
      return { data: { session: null }, error: null, sessionInvalidated: true };
    }
    return { data: { session: data?.session ?? null }, error: error ? { message: error.message } : null };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    if (isRefreshTokenInvalidError(message)) {
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // ignore signOut errors when cleaning up invalid refresh token
      }
      clearSupabaseStoredAuthTokens();
      return { data: { session: null }, error: null, sessionInvalidated: true };
    }
    return { data: { session: null }, error: { message } };
  }
}

export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => callback(event, session));
  return () => subscription.unsubscribe();
}

export type { User, Session };
