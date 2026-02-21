/**
 * License token validation for subscription gating.
 * Token format: TM-{base64(exp)}-{base64(tier)}-{hmac}
 * - exp: unix timestamp (expiry)
 * - tier: "monthly" | "yearly"
 * - hmac: HMAC-SHA256(exp:tier, secret)
 */

import CryptoJS from "crypto-js";

const STORAGE_KEY = "trademarathon_license_token";
const PREFIX = "TM-";

// Secret for HMAC - must match scripts/generate-license.ts
// In production, consider obfuscation or env-based rotation
const LICENSE_SECRET = "TM_LICENSE_SIGN_2025";

function b64Decode(s: string): string {
  try {
    const base64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4;
    const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
    return CryptoJS.enc.Utf8.stringify(CryptoJS.enc.Base64.parse(padded));
  } catch {
    return "";
  }
}

function computeHmac(exp: string, tier: string): string {
  const payload = `${exp}:${tier}`;
  return CryptoJS.HmacSHA256(payload, LICENSE_SECRET).toString(CryptoJS.enc.Hex);
}

export interface TokenResult {
  valid: boolean;
  expiresAt?: number;
  tier?: "monthly" | "yearly";
  error?: string;
}

export function validateToken(token: string): TokenResult {
  if (!token || typeof token !== "string") {
    return { valid: false, error: "Invalid token" };
  }

  const trimmed = token.trim();
  if (!trimmed.startsWith(PREFIX)) {
    return { valid: false, error: "Invalid token format" };
  }

  const parts = trimmed.slice(PREFIX.length).split("-");
  if (parts.length !== 3) {
    return { valid: false, error: "Invalid token format" };
  }

  const [expB64, tierB64, hmac] = parts;
  const expStr = b64Decode(expB64);
  const tier = b64Decode(tierB64) as string;

  if (!expStr || !tier) {
    return { valid: false, error: "Invalid token encoding" };
  }

  const exp = parseInt(expStr, 10);
  if (isNaN(exp) || exp <= 0) {
    return { valid: false, error: "Invalid expiry" };
  }

  if (tier !== "monthly" && tier !== "yearly") {
    return { valid: false, error: "Invalid tier" };
  }

  const expectedHmac = computeHmac(expStr, tier);
  if (hmac !== expectedHmac) {
    return { valid: false, error: "Invalid token signature" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (exp <= now) {
    return { valid: false, expiresAt: exp, error: "License expired" };
  }

  return { valid: true, expiresAt: exp, tier: tier as "monthly" | "yearly" };
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, token.trim());
  } catch {
    // ignore
  }
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
