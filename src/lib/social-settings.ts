"use client";

export type SocialSection = "overview" | "markets" | "spot" | "balances";

export interface SocialSettings {
  enabled: boolean;
  accounts: string[];
  keywords: string[];
  sections: Record<SocialSection, boolean>;
}

const KEY = "social_x_settings";

const DEFAULT_ACCOUNTS = [
  "whale_alert",
  "lookonchain",
  "glassnode",
  "cointelegraph",
  "coindesk",
];

const DEFAULT_SETTINGS: SocialSettings = {
  enabled: false,
  accounts: DEFAULT_ACCOUNTS,
  keywords: ["BTC", "ETH", "funding", "liquidation", "ETF"],
  sections: { overview: true, markets: true, spot: true, balances: true },
};

export function loadSocialSettings(): SocialSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      sections: { ...DEFAULT_SETTINGS.sections, ...(parsed.sections || {}) },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSocialSettings(next: SocialSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(next));
}
