/**
 * Alerts Feed Widget Settings
 * Syncs 100% with Settings UI. Combines AI insights + movement alerts.
 */

export const ALERTS_FEED_SETTINGS_KEY = "alerts_feed_settings";

export interface AlertsFeedSettings {
  enabled: boolean;
  // Sources
  showAIInsights: boolean;
  enableAISummary: boolean;
  showMovementAlerts: boolean;
  showOrderRecommendations: boolean;
  showPortfolioAlerts: boolean;
  showPlaybookAlerts: boolean;
  /** When true, show screener (watchlist) alert signals for all symbols, not only portfolio symbols */
  includeScreenerAlertsAllSymbols: boolean;
  // Limits
  maxItems: number;
  aiInsightsLimit: number;
  movementAlertsLimit: number;
  // UI
  compactMode: boolean;
  showTimestamps: boolean;
  glowNewItems: boolean;
  animateNewItems: boolean;
  // Priority filter (high/medium/low)
  minPriority: "low" | "medium" | "high";
}

export const DEFAULT_ALERTS_FEED_SETTINGS: AlertsFeedSettings = {
  enabled: true,
  showAIInsights: true,
  enableAISummary: false,
  showMovementAlerts: true,
  showOrderRecommendations: true,
  showPortfolioAlerts: true,
  showPlaybookAlerts: true,
  includeScreenerAlertsAllSymbols: false,
  maxItems: 10,
  aiInsightsLimit: 5,
  movementAlertsLimit: 5,
  compactMode: true,
  showTimestamps: true,
  glowNewItems: true,
  animateNewItems: true,
  minPriority: "high", // critical alerts only by default
};

/** Recommended settings for most users */
export const RECOMMENDED_ALERTS_FEED_SETTINGS: AlertsFeedSettings = {
  ...DEFAULT_ALERTS_FEED_SETTINGS,
  maxItems: 8,
  aiInsightsLimit: 4,
  movementAlertsLimit: 4,
  compactMode: true,
  showTimestamps: true,
  glowNewItems: true,
  animateNewItems: true,
  minPriority: "high",
};

export function getAlertsFeedSettings(): AlertsFeedSettings {
  if (typeof window === "undefined") return DEFAULT_ALERTS_FEED_SETTINGS;
  try {
    const saved = localStorage.getItem(ALERTS_FEED_SETTINGS_KEY);
    if (saved) {
      return { ...DEFAULT_ALERTS_FEED_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn("[AlertsFeed] Failed to parse settings", e);
  }
  return DEFAULT_ALERTS_FEED_SETTINGS;
}

export function saveAlertsFeedSettings(settings: Partial<AlertsFeedSettings>) {
  const current = getAlertsFeedSettings();
  const next = { ...current, ...settings };
  localStorage.setItem(ALERTS_FEED_SETTINGS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("alerts-feed-settings-changed", { detail: next }));
}

export function applyRecommendedSettings() {
  saveAlertsFeedSettings(RECOMMENDED_ALERTS_FEED_SETTINGS);
}
