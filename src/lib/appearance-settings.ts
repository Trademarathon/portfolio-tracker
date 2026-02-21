/**
 * Project-wide appearance: colors, theme, borders, fonts, sidebar, glow & highlights.
 * Persisted in localStorage and applied as CSS variables on document.documentElement.
 */

export const APPEARANCE_SETTINGS_KEY = "appearance_settings";

export type ThemeMode = "dark" | "light";
export type GlowIntensity = "off" | "low" | "medium" | "high";
export type GlowTheme = "custom" | "apple";
export type FontSizeScale = "small" | "medium" | "large";
export type RadiusSize = "smooth" | "medium" | "rounded" | "pill";
export type GlassEffect = "off" | "subtle" | "medium" | "heavy";
export type UiThemeMode = "default" | "neo-minimal" | "clone-exact";
export type NumericStyle = "default" | "digital";
export type PageSkinMode = "legacy" | "neo";

export interface AppearanceSettings {
  /** UI theme profile */
  uiTheme?: UiThemeMode;
  /** Page-level visual rollout by tab */
  pageSkin?: {
    journal: PageSkinMode;
    futures: PageSkinMode;
  };
  /** Numeric typography style for key balances */
  numericStyle?: NumericStyle;
  theme: ThemeMode;
  /** Page/chart background */
  background: string;
  /** Cards, panels, modals */
  cardBackground: string;
  /** Primary brand (buttons, links, accents) */
  primary: string;
  /** Border color (hex) or opacity 0-1 for white overlay in dark */
  borderOpacity: number;
  /** Base radius: smooth=0.5rem, medium=0.75rem, rounded=1rem, pill=1.5rem */
  radius: RadiusSize;
  /** Sidebar background */
  sidebarBackground: string;
  /** Sidebar text */
  sidebarForeground: string;
  /** Sidebar accent (hover/active) */
  sidebarAccent: string;
  /** Body font scale */
  fontSizeScale: FontSizeScale;
  /** Glass effect for panels/cards */
  glassEffect: GlassEffect;
  /** Page gradient background */
  gradientEnabled: boolean;
  gradientStart: string;
  gradientEnd: string;
  /** degrees */
  gradientAngle: number;
  /** Glow intensity for highlights, PnL, order-fill, etc. */
  glowIntensity: GlowIntensity;
  /** Preset: custom uses colors below; apple = Apple Intelligence style (soft neutral) */
  glowTheme: GlowTheme;
  /** Accent color for glows (hex) */
  glowAccent: string;
  /** Success glow (e.g. PnL up, order fill) */
  glowSuccess: string;
  /** Danger glow (PnL down) */
  glowDanger: string;
  /** Highlight / shimmer color */
  highlightColor: string;
}

const rem = (px: number) => `${px / 16}rem`;

/** Apple Intelligence–style: soft, neutral glows (no harsh neon) */
export const APPLE_GLOW_PRESET = {
  glowAccent: "#a1a1aa",
  glowSuccess: "#86efac",
  glowDanger: "#fda4af",
  highlightColor: "#b4e0e0",
} as const;

/** Theme template: full appearance preset for the whole project */
export interface ThemeTemplate {
  id: string;
  name: string;
  description?: string;
  /** Preview accent (e.g. primary color) for the template card */
  accentColor: string;
  settings: AppearanceSettings;
}

/** Built-in theme templates – one click applies to whole app */
export const THEME_TEMPLATES: ThemeTemplate[] = [
  {
    id: "clone-exact",
    name: "Clone Exact",
    description: "Near-exact glass clone style with digital balances",
    accentColor: "#9be74f",
    settings: {
      uiTheme: "clone-exact",
      numericStyle: "digital",
      theme: "dark",
      background: "#0a0b0d",
      cardBackground: "#14161b",
      primary: "#9b6bff",
      borderOpacity: 0.1,
      radius: "rounded",
      sidebarBackground: "#101216",
      sidebarForeground: "#b6bcc6",
      sidebarAccent: "rgba(255,255,255,0.08)",
      fontSizeScale: "medium",
      glassEffect: "medium",
      gradientEnabled: true,
      gradientStart: "#171a1f",
      gradientEnd: "#07080a",
      gradientAngle: 170,
      glowIntensity: "low",
      glowTheme: "custom",
      glowAccent: "#9b6bff",
      glowSuccess: "#9be74f",
      glowDanger: "#ff5f74",
      highlightColor: "#d6dbe3",
    },
  },
  {
    id: "default",
    name: "Default",
    description: "Exocharts-style dark with purple accent",
    accentColor: "#818cf8",
    settings: {
      theme: "dark",
      background: "#141310",
      cardBackground: "#141310",
      primary: "#818cf8",
      borderOpacity: 0.1,
      radius: "medium",
      sidebarBackground: "#1a1a1e",
      sidebarForeground: "#a1a1aa",
      sidebarAccent: "rgba(255,255,255,0.06)",
      fontSizeScale: "medium",
      glassEffect: "off",
      gradientEnabled: false,
      gradientStart: "#141310",
      gradientEnd: "#1c1917",
      gradientAngle: 165,
      glowIntensity: "medium",
      glowTheme: "custom",
      glowAccent: "#818cf8",
      glowSuccess: "#10b981",
      glowDanger: "#f43f5e",
      highlightColor: "#06b6d4",
    },
  },
  {
    id: "tradingview",
    name: "TradingView Dark",
    description: "Classic TV dark theme",
    accentColor: "#2962ff",
    settings: {
      theme: "dark",
      background: "#131722",
      cardBackground: "#131722",
      primary: "#2962ff",
      borderOpacity: 0.08,
      radius: "medium",
      sidebarBackground: "#1e222d",
      sidebarForeground: "#787b86",
      sidebarAccent: "rgba(255,255,255,0.06)",
      fontSizeScale: "medium",
      glassEffect: "off",
      gradientEnabled: false,
      gradientStart: "#131722",
      gradientEnd: "#1e222d",
      gradientAngle: 165,
      glowIntensity: "low",
      glowTheme: "custom",
      glowAccent: "#2962ff",
      glowSuccess: "#26a69a",
      glowDanger: "#ef5350",
      highlightColor: "#2196f3",
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Deep blue with cyan accents",
    accentColor: "#06b6d4",
    settings: {
      theme: "dark",
      background: "#0c1222",
      cardBackground: "#0f172a",
      primary: "#06b6d4",
      borderOpacity: 0.12,
      radius: "rounded",
      sidebarBackground: "#0e1628",
      sidebarForeground: "#94a3b8",
      sidebarAccent: "rgba(6,182,212,0.15)",
      fontSizeScale: "medium",
      glassEffect: "subtle",
      gradientEnabled: true,
      gradientStart: "#0c1222",
      gradientEnd: "#0f172a",
      gradientAngle: 180,
      glowIntensity: "medium",
      glowTheme: "custom",
      glowAccent: "#06b6d4",
      glowSuccess: "#22d3ee",
      glowDanger: "#f472b6",
      highlightColor: "#67e8f9",
    },
  },
  {
    id: "forest",
    name: "Forest",
    description: "Dark green with emerald accents",
    accentColor: "#10b981",
    settings: {
      theme: "dark",
      background: "#0d1117",
      cardBackground: "#161b22",
      primary: "#10b981",
      borderOpacity: 0.1,
      radius: "medium",
      sidebarBackground: "#161b22",
      sidebarForeground: "#8b949e",
      sidebarAccent: "rgba(16,185,129,0.12)",
      fontSizeScale: "medium",
      glassEffect: "off",
      gradientEnabled: false,
      gradientStart: "#0d1117",
      gradientEnd: "#161b22",
      gradientAngle: 165,
      glowIntensity: "medium",
      glowTheme: "custom",
      glowAccent: "#10b981",
      glowSuccess: "#34d399",
      glowDanger: "#f87171",
      highlightColor: "#6ee7b7",
    },
  },
  {
    id: "monochrome",
    name: "Monochrome",
    description: "Neutral gray, minimal",
    accentColor: "#a1a1aa",
    settings: {
      theme: "dark",
      background: "#0a0a0a",
      cardBackground: "#141414",
      primary: "#a1a1aa",
      borderOpacity: 0.08,
      radius: "smooth",
      sidebarBackground: "#0f0f0f",
      sidebarForeground: "#a1a1aa",
      sidebarAccent: "rgba(255,255,255,0.05)",
      fontSizeScale: "medium",
      glassEffect: "off",
      gradientEnabled: false,
      gradientStart: "#0a0a0a",
      gradientEnd: "#141414",
      gradientAngle: 165,
      glowIntensity: "low",
      glowTheme: "apple",
      glowAccent: "#a1a1aa",
      glowSuccess: "#86efac",
      glowDanger: "#fda4af",
      highlightColor: "#b4e0e0",
    },
  },
  {
    id: "apple",
    name: "Apple Intelligence",
    description: "Soft neutrals, subtle glow",
    accentColor: "#b4e0e0",
    settings: {
      theme: "dark",
      background: "#1c1c1e",
      cardBackground: "#2c2c2e",
      primary: "#8e8e93",
      borderOpacity: 0.06,
      radius: "rounded",
      sidebarBackground: "#1c1c1e",
      sidebarForeground: "#8e8e93",
      sidebarAccent: "rgba(255,255,255,0.04)",
      fontSizeScale: "medium",
      glassEffect: "subtle",
      gradientEnabled: false,
      gradientStart: "#1c1c1e",
      gradientEnd: "#2c2c2e",
      gradientAngle: 165,
      glowIntensity: "low",
      glowTheme: "apple",
      glowAccent: APPLE_GLOW_PRESET.glowAccent,
      glowSuccess: APPLE_GLOW_PRESET.glowSuccess,
      glowDanger: APPLE_GLOW_PRESET.glowDanger,
      highlightColor: APPLE_GLOW_PRESET.highlightColor,
    },
  },
  {
    id: "high-contrast",
    name: "High Contrast",
    description: "Strong borders, clear focus",
    accentColor: "#f59e0b",
    settings: {
      theme: "dark",
      background: "#000000",
      cardBackground: "#0f0f0f",
      primary: "#f59e0b",
      borderOpacity: 0.2,
      radius: "smooth",
      sidebarBackground: "#0a0a0a",
      sidebarForeground: "#fafafa",
      sidebarAccent: "rgba(245,158,11,0.2)",
      fontSizeScale: "medium",
      glassEffect: "off",
      gradientEnabled: false,
      gradientStart: "#000000",
      gradientEnd: "#0f0f0f",
      gradientAngle: 165,
      glowIntensity: "high",
      glowTheme: "custom",
      glowAccent: "#f59e0b",
      glowSuccess: "#22c55e",
      glowDanger: "#ef4444",
      highlightColor: "#38bdf8",
    },
  },
];

export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  uiTheme: "clone-exact",
  pageSkin: {
    journal: "legacy",
    futures: "legacy",
  },
  numericStyle: "default",
  theme: "dark",
  background: "#141310",
  cardBackground: "#141310",
  primary: "#818cf8",
  borderOpacity: 0.1,
  radius: "medium",
  sidebarBackground: "#1a1a1e",
  sidebarForeground: "#a1a1aa",
  sidebarAccent: "rgba(255,255,255,0.06)",
  fontSizeScale: "medium",
  glassEffect: "off",
  gradientEnabled: false,
  gradientStart: "#141310",
  gradientEnd: "#1c1917",
  gradientAngle: 165,
  glowIntensity: "medium",
  glowTheme: "custom",
  glowAccent: "#818cf8",
  glowSuccess: "#10b981",
  glowDanger: "#f43f5e",
  highlightColor: "#06b6d4",
};

const RADIUS_MAP: Record<RadiusSize, string> = {
  smooth: rem(8),
  medium: rem(12),
  rounded: rem(16),
  pill: rem(24),
};

const FONT_SCALE_MAP: Record<FontSizeScale, number> = {
  small: 0.9375,
  medium: 1,
  large: 1.0625,
};

const GLOW_OPACITY_MAP: Record<GlowIntensity, { low: number; high: number }> = {
  off: { low: 0, high: 0 },
  low: { low: 0.06, high: 0.12 },
  medium: { low: 0.12, high: 0.22 },
  high: { low: 0.18, high: 0.32 },
};

const GLASS_MAP: Record<GlassEffect, { blur: string; opacity: string; border: string }> = {
  off: { blur: "0px", opacity: "0", border: "0" },
  subtle: { blur: "12px", opacity: "0.5", border: "0.06" },
  medium: { blur: "24px", opacity: "0.6", border: "0.08" },
  heavy: { blur: "40px", opacity: "0.7", border: "0.1" },
};

function hexToRgb(hex: string, fallback = "129, 140, 248"): string {
  const m = String(hex).replace(/^#/, "").match(/^(..)(..)(..)$/);
  if (!m) return fallback;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)].join(", ");
}

/** Normalize sidebar values: oklch → hex/rgba so inputs don’t trigger spell-check or validation issues */
function normalizeSidebarColors(settings: AppearanceSettings): AppearanceSettings {
  const out = { ...settings };
  if (out.sidebarBackground.includes("oklch")) out.sidebarBackground = "#1a1a1e";
  if (out.sidebarForeground.includes("oklch")) out.sidebarForeground = "#a1a1aa";
  if (out.sidebarAccent.includes("oklch") || out.sidebarAccent === "oklch(1 0 0 / 5%)") out.sidebarAccent = "rgba(255,255,255,0.06)";
  return out;
}

function sidebarNeedsNormalization(s: AppearanceSettings): boolean {
  return s.sidebarBackground.includes("oklch") || s.sidebarForeground.includes("oklch") || s.sidebarAccent.includes("oklch") || s.sidebarAccent === "oklch(1 0 0 / 5%)";
}

export function loadAppearanceSettings(): AppearanceSettings {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE_SETTINGS;
  try {
    const raw = localStorage.getItem(APPEARANCE_SETTINGS_KEY);
    if (!raw) return DEFAULT_APPEARANCE_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppearanceSettings>;
    let merged = { ...DEFAULT_APPEARANCE_SETTINGS, ...parsed };
    merged = {
      ...merged,
      pageSkin: {
        journal: parsed.pageSkin?.journal ?? merged.pageSkin?.journal ?? "legacy",
        futures: parsed.pageSkin?.futures ?? merged.pageSkin?.futures ?? "legacy",
      },
    };
    // Migrate older profiles to the unified clone-exact skin unless user explicitly switched away later.
    if (!merged.uiTheme || merged.uiTheme === "default") {
      merged = { ...merged, uiTheme: "clone-exact" };
      saveAppearanceSettings(merged);
    }
    if (sidebarNeedsNormalization(merged)) {
      const normalized = normalizeSidebarColors(merged);
      saveAppearanceSettings(normalized);
      return normalized;
    }
    return merged;
  } catch {
    return DEFAULT_APPEARANCE_SETTINGS;
  }
}

export function saveAppearanceSettings(settings: AppearanceSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(APPEARANCE_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

/** Apply appearance settings to the document (CSS variables + optional .dark/.light). */
export function applyAppearanceSettings(settings: AppearanceSettings): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  root.classList.remove("light", "dark");
  root.classList.add(settings.theme);

  root.style.setProperty("--background", settings.background);
  root.style.setProperty("--background-rgb", hexToRgb(settings.background, "20, 19, 16"));
  root.style.setProperty("--card", settings.cardBackground);
  root.style.setProperty("--popover", settings.cardBackground);
  root.style.setProperty("--primary", settings.primary);
  root.style.setProperty("--radius", RADIUS_MAP[settings.radius]);
  root.style.setProperty("--sidebar-background", settings.sidebarBackground);
  root.style.setProperty("--sidebar-foreground", settings.sidebarForeground);
  root.style.setProperty("--sidebar-accent", settings.sidebarAccent);
  root.style.setProperty("--app-font-scale", String(FONT_SCALE_MAP[settings.fontSizeScale]));

  const borderVal =
    settings.borderOpacity >= 0 && settings.borderOpacity <= 1
      ? `rgba(255,255,255,${settings.borderOpacity})`
      : `rgba(255,255,255,0.1)`;
  root.style.setProperty("--border", borderVal);
  root.style.setProperty("--input", borderVal);

  const glow = GLOW_OPACITY_MAP[settings.glowIntensity];
  const useApple = settings.glowTheme === "apple";
  const glowAccentRgb = hexToRgb(useApple ? APPLE_GLOW_PRESET.glowAccent : settings.glowAccent);
  const glowSuccessRgb = hexToRgb(useApple ? APPLE_GLOW_PRESET.glowSuccess : settings.glowSuccess);
  const glowDangerRgb = hexToRgb(useApple ? APPLE_GLOW_PRESET.glowDanger : settings.glowDanger);
  const highlightColor = useApple ? APPLE_GLOW_PRESET.highlightColor : settings.highlightColor;
  root.style.setProperty("--glow-opacity-low", String(glow.low));
  root.style.setProperty("--glow-opacity-high", String(glow.high));
  root.style.setProperty("--glow-accent-rgb", glowAccentRgb);
  root.style.setProperty("--glow-success-rgb", glowSuccessRgb);
  root.style.setProperty("--glow-danger-rgb", glowDangerRgb);
  root.style.setProperty("--highlight-color", highlightColor);

  const glass = GLASS_MAP[settings.glassEffect];
  root.setAttribute("data-glass", settings.glassEffect);
  root.style.setProperty("--glass-blur", glass.blur);
  root.style.setProperty("--glass-opacity", glass.opacity);
  root.style.setProperty("--glass-border", glass.border);

  root.setAttribute("data-gradient", settings.gradientEnabled ? "true" : "false");
  root.style.setProperty("--gradient-start", settings.gradientStart);
  root.style.setProperty("--gradient-end", settings.gradientEnd);
  root.style.setProperty("--gradient-angle", `${settings.gradientAngle}deg`);

  root.setAttribute("data-ui-theme", settings.uiTheme || "default");
  root.setAttribute("data-page-skin-journal", settings.pageSkin?.journal || "legacy");
  root.setAttribute("data-page-skin-futures", settings.pageSkin?.futures || "legacy");
  root.setAttribute("data-numeric-style", settings.numericStyle || "default");
}
