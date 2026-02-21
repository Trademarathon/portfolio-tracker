/**
 * Single place for all WebSocket-related feature toggles and settings.
 * Read/write via getWebSocketSettings / setWebSocketSettings.
 * Keys are kept in sync with global_tv_settings for backward compatibility.
 */

const TV_SETTINGS_KEY = 'global_tv_settings';

/** Aggregator order book: use real-time WebSocket instead of polling. Key in global_tv_settings. */
export const TERMINAL_ORDER_BOOK_WS_KEY = 'aggregatorUseWebSocket';

export interface WebSocketSettings {
  /** Use WebSocket (real-time) for aggregated DOM. */
  terminalOrderBookUseWebSocket: boolean;
}

const DEFAULTS: WebSocketSettings = {
  terminalOrderBookUseWebSocket: true,
};

function getTvSettings(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(TV_SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setTvSettings(partial: Record<string, unknown>) {
  const current = getTvSettings();
  const next = { ...current, ...partial };
  localStorage.setItem(TV_SETTINGS_KEY, JSON.stringify(next));
  window.dispatchEvent(new StorageEvent('storage', { key: TV_SETTINGS_KEY, newValue: JSON.stringify(next) }));
}

/**
 * Build WebSocket settings from a parsed TV settings object (e.g. from StorageEvent.newValue).
 */
export function getWebSocketSettingsFromTv(tv: Record<string, unknown>): WebSocketSettings {
  return {
    terminalOrderBookUseWebSocket: (tv[TERMINAL_ORDER_BOOK_WS_KEY] as boolean) ?? DEFAULTS.terminalOrderBookUseWebSocket,
  };
}

/**
 * Read all WebSocket-related settings from the single source (global_tv_settings).
 */
export function getWebSocketSettings(): WebSocketSettings {
  return getWebSocketSettingsFromTv(getTvSettings());
}

/**
 * Update one or more WebSocket settings. Persists into global_tv_settings so existing Settings UI keeps working.
 */
export function setWebSocketSettings(partial: Partial<WebSocketSettings>) {
  const updates: Record<string, unknown> = {};
  if (partial.terminalOrderBookUseWebSocket !== undefined) {
    updates[TERMINAL_ORDER_BOOK_WS_KEY] = partial.terminalOrderBookUseWebSocket;
  }
  if (Object.keys(updates).length) setTvSettings(updates);
}
