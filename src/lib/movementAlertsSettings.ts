/**
 * Movement Alerts Settings
 * Syncs 100% with Settings UI. Extensible for custom alerts future.
 */

export const MOVEMENT_ALERTS_SETTINGS_KEY = "movement_alerts_settings";
export const MOVEMENT_ALERTS_CACHE_KEY = "movement_alerts_cache";

export interface MovementAlertsSettings {
  enabled: boolean;
  // Thresholds
  imminentMomentum: number;
  breakUp1h: number;
  breakDown1h: number;
  goingUp1h: number;
  goingDown1h: number;
  extreme24hUp: number;
  extreme24hDown: number;
  // Timing
  dedupeWindowMinutes: number;
  maxAgeMinutes: number;
  maxAlertsShown: number;
  // Alert type toggles (for future custom alerts)
  types: {
    imminentMovement: boolean;
    breakUp: boolean;
    breakDown: boolean;
    goingUp: boolean;
    goingDown: boolean;
    extremeUp: boolean;
    extremeDown: boolean;
  };
  // UI
  glowNewAlerts: boolean;
  animateNewAlerts: boolean;
}

export const DEFAULT_MOVEMENT_ALERTS_SETTINGS: MovementAlertsSettings = {
  enabled: true,
  imminentMomentum: 85,
  breakUp1h: 1.5,
  breakDown1h: -1.5,
  goingUp1h: 0.8,
  goingDown1h: -0.8,
  extreme24hUp: 10,
  extreme24hDown: -10,
  dedupeWindowMinutes: 7,
  maxAgeMinutes: 45,
  maxAlertsShown: 8,
  types: {
    imminentMovement: true,
    breakUp: true,
    breakDown: true,
    goingUp: true,
    goingDown: true,
    extremeUp: true,
    extremeDown: true,
  },
  glowNewAlerts: true,
  animateNewAlerts: true,
};

export function getMovementAlertsSettings(): MovementAlertsSettings {
  if (typeof window === "undefined") return DEFAULT_MOVEMENT_ALERTS_SETTINGS;
  try {
    const saved = localStorage.getItem(MOVEMENT_ALERTS_SETTINGS_KEY);
    if (saved) {
      return { ...DEFAULT_MOVEMENT_ALERTS_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn("[MovementAlerts] Failed to parse settings", e);
  }
  return DEFAULT_MOVEMENT_ALERTS_SETTINGS;
}

export function saveMovementAlertsSettings(settings: Partial<MovementAlertsSettings>) {
  const current = getMovementAlertsSettings();
  const next = { ...current, ...settings };
  localStorage.setItem(MOVEMENT_ALERTS_SETTINGS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("movement-alerts-settings-changed", { detail: next }));
}
