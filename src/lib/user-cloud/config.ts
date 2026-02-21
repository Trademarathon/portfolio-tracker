/**
 * User cloud config: provider choice and token storage for Google Drive / Dropbox.
 * Legacy: user cloud config for Google Drive / Dropbox.
 * Supabase is now the default sync backend for all users.
 */

import { STORAGE_KEYS } from "@/lib/export-import";

export type UserCloudProvider = "none" | "google_drive" | "dropbox";

const USER_CLOUD_PROVIDER_KEY = "user_cloud_provider";
const USER_CLOUD_TOKENS_PREFIX = "user_cloud_tokens_";

/**
 * Whitelist of keys that sync to user's Google Drive or Dropbox.
 * App settings, alerts settings, lightweight UI/screener only.
 * No playbooks, no journal, no API keys or secrets.
 */
export const USER_CLOUD_SYNC_KEYS: ReadonlySet<string> = new Set([
  // App / terminal / screener
  STORAGE_KEYS.global_tv_settings,
  STORAGE_KEYS.terminal_widgets,
  STORAGE_KEYS.terminal_layout_locked,
  STORAGE_KEYS.insilico_orderbook,
  STORAGE_KEYS.advanced_dom_columns,
  STORAGE_KEYS.trades_flow_columns,
  STORAGE_KEYS.liquidations_columns,
  STORAGE_KEYS.watchlist_favorites,
  STORAGE_KEYS.watchlist_filters,
  STORAGE_KEYS.watchlist_columns,
  STORAGE_KEYS.chart_alerts,
  STORAGE_KEYS.transaction_filters,
  STORAGE_KEYS.settings_auto_refresh,
  STORAGE_KEYS.settings_dust_threshold,
  STORAGE_KEYS.settings_hide_spam,
  STORAGE_KEYS.demo_mode,
  // Alerts
  STORAGE_KEYS.portfolio_alert_settings,
  STORAGE_KEYS.global_alert_settings,
  STORAGE_KEYS.portfolio_alerts,
  STORAGE_KEYS.portfolio_alert_history,
  STORAGE_KEYS.portfolio_alerts_legacy,
  STORAGE_KEYS.portfolio_signals,
  STORAGE_KEYS.alerts_feed_settings,
  STORAGE_KEYS.movement_alerts_settings,
  STORAGE_KEYS.movement_alerts_cache,
  STORAGE_KEYS.ai_feed_memory,
  STORAGE_KEYS.alerts_memory,
  STORAGE_KEYS.activity_intel_settings,
  STORAGE_KEYS.activity_memory_summary,
  // UI
  STORAGE_KEYS.ui_sidebar_hidden,
  STORAGE_KEYS.ui_sidebar_collapsed,
  STORAGE_KEYS.ui_sidebar_autohide,
  // Lightweight portfolio prefs
  STORAGE_KEYS.user_watchlist,
  STORAGE_KEYS.hide_dust,
  STORAGE_KEYS.portfolio_hwm,
  STORAGE_KEYS.portfolio_hwm_spot,
]);

export function isUserCloudSyncKey(key: string): boolean {
  return USER_CLOUD_SYNC_KEYS.has(key);
}

export function getUserCloudProvider(): UserCloudProvider {
  if (typeof window === "undefined") return "none";
  const v = localStorage.getItem(USER_CLOUD_PROVIDER_KEY);
  if (v === "google_drive" || v === "dropbox") return v;
  return "none";
}

export function setUserCloudProvider(provider: UserCloudProvider): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_CLOUD_PROVIDER_KEY, provider);
  window.dispatchEvent(new Event("user-cloud-config-changed"));
}

export function getTokenStorageKey(userId: string, provider: UserCloudProvider): string {
  return `${USER_CLOUD_TOKENS_PREFIX}${provider}_${userId}`;
}

export interface StoredUserCloudTokens {
  provider: UserCloudProvider;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  [key: string]: unknown;
}

export function getStoredTokens(userId: string, provider: UserCloudProvider): StoredUserCloudTokens | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getTokenStorageKey(userId, provider));
    if (!raw) return null;
    return JSON.parse(raw) as StoredUserCloudTokens;
  } catch {
    return null;
  }
}

export function setStoredTokens(userId: string, data: StoredUserCloudTokens): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getTokenStorageKey(userId, data.provider), JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function clearStoredTokens(userId: string, provider: UserCloudProvider): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(getTokenStorageKey(userId, provider));
}

/** Clear all user cloud tokens for a user (e.g. on sign out). */
export function clearAllStoredTokensForUser(userId: string): void {
  clearStoredTokens(userId, "google_drive");
  clearStoredTokens(userId, "dropbox");
}

/** Default builder email when env is not set (so Admin tab shows for this user without .env). */
const DEFAULT_BUILDER_EMAIL = "ravi@trademarathon.trade";

/** localStorage key: user id of the account that signed in "as builder" (so we know builder vs user from login). */
const BUILDER_LOGIN_USER_ID_KEY = "builder_login_user_id";
const LOGIN_AS_BUILDER_FLAG_KEY = "login_as_builder";

/** User id stored when they signed in via "Sign in as app builder" (cleared on sign out). */
export function getBuilderLoginUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(BUILDER_LOGIN_USER_ID_KEY);
}

export function setBuilderLoginUserId(userId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(BUILDER_LOGIN_USER_ID_KEY, userId);
}

export function clearBuilderLoginUserId(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(BUILDER_LOGIN_USER_ID_KEY);
}

/** Set when user is on /login?as=builder so we mark this session as builder after sign-in. */
export function setLoginAsBuilderFlag(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(LOGIN_AS_BUILDER_FLAG_KEY, "1");
}

export function consumeLoginAsBuilderFlag(): boolean {
  if (typeof window === "undefined") return false;
  const v = sessionStorage.getItem(LOGIN_AS_BUILDER_FLAG_KEY);
  if (v !== "1") return false;
  sessionStorage.removeItem(LOGIN_AS_BUILDER_FLAG_KEY);
  return true;
}

/**
 * True if the current user is the app builder.
 * Determined by: (1) signed in "as builder" at login, or (2) env NEXT_PUBLIC_BUILDER_USER_ID / NEXT_PUBLIC_BUILDER_EMAIL.
 * Builder always syncs to Supabase; others also use Supabase by default.
 */
export function isBuilder(user: { id: string; email?: string | null } | null): boolean {
  if (!user) return false;
  const loginAsBuilderId = typeof window !== "undefined" ? getBuilderLoginUserId() : null;
  if (loginAsBuilderId && user.id === loginAsBuilderId) return true;
  const builderId =
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_BUILDER_USER_ID : undefined;
  const builderEmail =
    (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_BUILDER_EMAIL : undefined) ?? DEFAULT_BUILDER_EMAIL;
  if (builderId && user.id === builderId) return true;
  if (builderEmail && user.email && user.email.toLowerCase() === builderEmail.toLowerCase()) return true;
  return false;
}
