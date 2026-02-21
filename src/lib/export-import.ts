/**
 * Export/Import entire project database from localStorage.
 * Includes: journal, wallet addresses, terminal/screener presets, settings, alerts, playbooks, etc.
 */

import {
  INDIAN_MF_API_BASE_KEY,
  INDIAN_STOCKS_API_BASE_KEY,
  CAS_PARSER_API_KEY_STORAGE,
} from "@/lib/api/indian-markets-config";

export const EXPORT_VERSION = 1;

/** All localStorage keys used by the app (non-sensitive keys first) */
export const STORAGE_KEYS = {
  // Journal
  journal_trades: "journal_trades",
  journal_annotations: "journal_annotations",
  journal_preferences: "journal_preferences",
  journal_permanent_filters: "journal_permanent_filters",
  trade_journal_annotations: "trade_journal_annotations",

  // Connections & Wallets
  portfolio_connections: "portfolio_connections",
  crypto_tracker_groups: "crypto-tracker-groups",

  // Terminal & Screener
  global_tv_settings: "global_tv_settings",
  terminal_widgets: "terminal_widgets_v3",
  terminal_layout_locked: "terminal_layout_locked",
  insilico_orderbook: "insilico_orderbook_v1",
  advanced_dom_columns: "advanced_dom_columns_v3",
  trades_flow_columns: "trades_flow_columns",
  liquidations_columns: "liquidations_columns",
  watchlist_favorites: "watchlist_favorites",
  watchlist_filters: "watchlist_filters",
  watchlist_columns: "watchlist_columns",

  // Chart
  chart_alerts: "chart_alerts",

  // Settings
  transaction_filters: "transaction_filters",
  settings_auto_refresh: "settings_auto_refresh",
  settings_dust_threshold: "settings_dust_threshold",
  settings_hide_spam: "settings_hide_spam",
  demo_mode: "demo_mode",
  ai_provider: "ai_provider",
  ollama_base_url: "ollama_base_url",
  ollama_model: "ollama_model",

  // Alerts
  portfolio_alert_settings: "portfolio_alert_settings",
  global_alert_settings: "global_alert_settings",
  portfolio_alerts: "portfolio_alerts_v2",
  portfolio_alert_history: "portfolio_alert_history",
  portfolio_alerts_legacy: "portfolio_alerts",
  portfolio_signals: "portfolio_signals",
  alerts_feed_settings: "alerts_feed_settings",
  movement_alerts_settings: "movement_alerts_settings",
  movement_alerts_cache: "movement_alerts_cache",
  ai_feed_memory: "ai_feed_memory_v1",
  alerts_memory: "alerts_memory_v1",

  // Playbooks & Sessions
  trading_sessions: "trading_sessions",
  active_session: "active_session",
  trading_playbooks: "trading_playbooks",
  session_stats: "session_stats",
  spot_plans: "spot_plans",
  perp_plans: "perp_plans",
  playbook_level_alerts: "playbook_level_alerts",
  playbook_completion_notified: "playbook_completion_notified",
  playbook_executed_orders: "playbook_executed_orders",
  playbook_settings: "playbook_settings",

  // Portfolio
  user_watchlist: "user_watchlist",
  manual_transactions: "manual_transactions",
  hide_dust: "hide_dust",
  portfolio_hwm: "portfolio_hwm",
  portfolio_hwm_spot: "portfolio_hwm_spot",

  // Indian Markets
  indian_mf_transactions: "indianMfTransactions",
  indian_stock_transactions: "indianStockTransactions",

  // UI
  ui_sidebar_hidden: "ui_sidebar_hidden",
  ui_sidebar_collapsed: "ui_sidebar_collapsed",
  ui_sidebar_autohide: "ui_sidebar_autohide",
} as const;

/** Keys that may contain sensitive data (API keys, secrets) - export only if user opts in */
export const SENSITIVE_KEYS = [
  "portfolio_connections", // contains apiKey, secret
  "openai_api_key",
  "gemini_api_key",
  "indian_mf_api_base",
  "indian_stocks_api_base",
  "cas_parser_api_key",
] as const;

const ALL_KEYS = Object.values(STORAGE_KEYS);
const SENSITIVE_KEY_STRINGS = new Set([
  ...SENSITIVE_KEYS,
  "openai_api_key",
  "gemini_api_key",
  "indian_mf_api_base",
  "indian_stocks_api_base",
  "cas_parser_api_key",
]);

export interface ExportData {
  version: number;
  exportedAt: string;
  keys: Record<string, string>;
  meta?: { includeSensitive?: boolean };
}

export function exportProjectDatabase(options?: { includeSensitive?: boolean }): ExportData {
  if (typeof window === "undefined") throw new Error("Export only available in browser");

  const includeSensitive = options?.includeSensitive ?? false;
  const keys: Record<string, string> = {};

  for (const key of ALL_KEYS) {
    const val = localStorage.getItem(key);
    if (val !== null) keys[key] = val;
  }

  // Additional keys not in STORAGE_KEYS
  const extraKeys = [
    "openai_api_key",
    "gemini_api_key",
    "ai_provider",
    "ollama_base_url",
    "ollama_model",
    INDIAN_MF_API_BASE_KEY,
    INDIAN_STOCKS_API_BASE_KEY,
    CAS_PARSER_API_KEY_STORAGE,
  ];

  for (const key of extraKeys) {
    if (SENSITIVE_KEY_STRINGS.has(key) && !includeSensitive) continue;
    const val = localStorage.getItem(key);
    if (val !== null) keys[key] = val;
  }

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    keys,
    meta: { includeSensitive },
  };
}

export function importProjectDatabase(
  data: ExportData,
  options?: { merge?: boolean; overwriteSensitive?: boolean }
): { imported: number; skipped: number } {
  if (typeof window === "undefined") throw new Error("Import only available in browser");

  const merge = options?.merge ?? false;
  const overwriteSensitive = options?.overwriteSensitive ?? false;
  let imported = 0;
  let skipped = 0;

  for (const [key, value] of Object.entries(data.keys)) {
    const isSensitive = SENSITIVE_KEY_STRINGS.has(key);
    if (isSensitive && !overwriteSensitive && localStorage.getItem(key)) {
      skipped++;
      continue;
    }
    if (merge && !isSensitive && localStorage.getItem(key)) {
      skipped++;
      continue;
    }
    try {
      localStorage.setItem(key, value);
      imported++;
    } catch (e) {
      console.warn(`Failed to import ${key}:`, e);
      skipped++;
    }
  }

  return { imported, skipped };
}

export function triggerPostImportRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("settings-changed"));
  window.dispatchEvent(new Event("openai-api-key-changed"));
  window.dispatchEvent(new Event("gemini-api-key-changed"));
  window.dispatchEvent(new Event("ollama-settings-changed"));
  window.dispatchEvent(new Event("ai-provider-changed"));
  window.dispatchEvent(new Event("indian-markets-settings-changed"));
  window.dispatchEvent(new CustomEvent("alerts-feed-settings-changed"));
  window.dispatchEvent(new CustomEvent("sync-playbook-alerts", { detail: { type: "spot" } }));
  window.dispatchEvent(new CustomEvent("sync-playbook-alerts", { detail: { type: "perp" } }));
}
