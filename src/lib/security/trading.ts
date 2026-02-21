/**
 * Trading security layer - gates order placement with PIN, session lock, and explicit enable.
 * API keys connected for trading are protected by these layers.
 */

const STORAGE_KEYS = {
  TRADING_ENABLED: "trading_security_enabled",
  TRADING_PIN_HASH: "trading_security_pin_hash",
  TRADING_PIN_SALT: "trading_security_pin_salt",
  TRADING_UNLOCK_UNTIL: "trading_security_unlock_until",
  TRADING_LOCK_TIMEOUT: "trading_security_lock_timeout_minutes",
  LOCK_ON_TAB_BLUR: "trading_security_lock_on_tab_blur",
} as const;

export function getLockOnTabBlur(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(STORAGE_KEYS.LOCK_ON_TAB_BLUR) !== "false";
}

export function setLockOnTabBlur(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.LOCK_ON_TAB_BLUR, String(enabled));
}

const DEFAULT_LOCK_TIMEOUT = 15; // minutes

async function hashPin(pin: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getSalt(): string {
  if (typeof window === "undefined") return "";
  let salt = localStorage.getItem(STORAGE_KEYS.TRADING_PIN_SALT);
  if (!salt) {
    salt = crypto.randomUUID() + crypto.randomUUID();
    localStorage.setItem(STORAGE_KEYS.TRADING_PIN_SALT, salt);
  }
  return salt;
}

export function isTradingEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEYS.TRADING_ENABLED) === "true";
}

export function setTradingEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.TRADING_ENABLED, String(enabled));
  window.dispatchEvent(new Event("trading-security-changed"));
}

export function hasTradingPin(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(STORAGE_KEYS.TRADING_PIN_HASH);
}

export async function setTradingPin(pin: string): Promise<void> {
  if (typeof window === "undefined") return;
  const salt = getSalt();
  const hash = await hashPin(pin, salt);
  localStorage.setItem(STORAGE_KEYS.TRADING_PIN_HASH, hash);
  window.dispatchEvent(new Event("trading-security-changed"));
}

export async function removeTradingPin(): Promise<void> {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEYS.TRADING_PIN_HASH);
  localStorage.removeItem(STORAGE_KEYS.TRADING_PIN_SALT);
  window.dispatchEvent(new Event("trading-security-changed"));
}

export async function verifyTradingPin(pin: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const storedHash = localStorage.getItem(STORAGE_KEYS.TRADING_PIN_HASH);
  if (!storedHash) return true; // No PIN set = no verification needed
  const salt = getSalt();
  const hash = await hashPin(pin, salt);
  return hash === storedHash;
}

export function isTradingUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  if (!hasTradingPin()) return true; // No PIN = always unlocked when trading enabled
  const until = parseInt(localStorage.getItem(STORAGE_KEYS.TRADING_UNLOCK_UNTIL) || "0", 10);
  return until > Date.now();
}

export function unlockTrading(untilMs?: number): void {
  if (typeof window === "undefined") return;
  const timeout = getLockTimeoutMinutes();
  const expiry = untilMs ?? Date.now() + timeout * 60 * 1000;
  localStorage.setItem(STORAGE_KEYS.TRADING_UNLOCK_UNTIL, String(expiry));
  window.dispatchEvent(new Event("trading-security-changed"));
}

export function lockTrading(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.TRADING_UNLOCK_UNTIL, "0");
  window.dispatchEvent(new Event("trading-security-changed"));
}

export function getLockTimeoutMinutes(): number {
  if (typeof window === "undefined") return DEFAULT_LOCK_TIMEOUT;
  const v = parseInt(localStorage.getItem(STORAGE_KEYS.TRADING_LOCK_TIMEOUT) || String(DEFAULT_LOCK_TIMEOUT), 10);
  return Math.max(1, Math.min(120, v));
}

export function setLockTimeoutMinutes(minutes: number): void {
  if (typeof window === "undefined") return;
  const v = Math.max(1, Math.min(120, minutes));
  localStorage.setItem(STORAGE_KEYS.TRADING_LOCK_TIMEOUT, String(v));
  window.dispatchEvent(new Event("trading-security-changed"));
}

/**
 * Check if user can place orders. Returns null if allowed, or error message if blocked.
 */
export async function canPlaceOrder(): Promise<string | null> {
  if (!isTradingEnabled()) {
    return "Enable Trading in Settings → Security to place orders.";
  }
  if (!isTradingUnlocked()) {
    return "Trading session locked. Enter PIN to unlock.";
  }
  return null;
}

/**
 * Require PIN verification before placing order. Returns true if verified/unlocked.
 */
export async function requireTradingUnlock(pin?: string): Promise<{ ok: boolean; error?: string }> {
  if (!isTradingEnabled()) {
    return { ok: false, error: "Enable Trading in Settings → Security first." };
  }
  if (!hasTradingPin()) {
    unlockTrading();
    return { ok: true };
  }
  if (isTradingUnlocked()) {
    return { ok: true };
  }
  if (pin !== undefined) {
    const valid = await verifyTradingPin(pin);
    if (valid) {
      unlockTrading();
      return { ok: true };
    }
    return { ok: false, error: "Invalid PIN." };
  }
  return { ok: false, error: "Enter PIN to unlock trading." };
}
