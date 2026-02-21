import { apiUrl } from "@/lib/api/client";

export interface SocialPost {
  id: string;
  author: string;
  text: string;
  url: string;
  timestamp: number;
  symbols: string[];
  score: number;
}

const DEFAULT_TIMEOUT_MS = 8000;

async function fetchJsonWithTimeout<T>(url: string, init?: RequestInit, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: init?.signal ?? controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchXPosts(params: {
  tickers: string[];
  accounts: string[];
  keywords: string[];
  sinceMinutes?: number;
  signal?: AbortSignal;
}): Promise<SocialPost[]> {
  try {
    const { tickers, accounts, keywords, sinceMinutes = 90, signal } = params;
    const url = new URL(apiUrl("/api/social/x/search"));
    if (tickers?.length) url.searchParams.set("tickers", tickers.join(","));
    if (accounts?.length) url.searchParams.set("accounts", accounts.join(","));
    if (keywords?.length) url.searchParams.set("keywords", keywords.join(","));
    url.searchParams.set("sinceMinutes", String(sinceMinutes));
    const json = await fetchJsonWithTimeout<{ posts?: SocialPost[] }>(
      url.toString(),
      { signal },
      DEFAULT_TIMEOUT_MS
    );
    if (!json) return [];
    return Array.isArray(json.posts) ? json.posts : [];
  } catch {
    return [];
  }
}

export async function getXStatus(): Promise<{ connected: boolean; expiresAt: number }> {
  const json = await fetchJsonWithTimeout<{ connected?: boolean; expiresAt?: number }>(
    apiUrl("/api/social/x/status")
  );
  if (!json) return { connected: false, expiresAt: 0 };
  return {
    connected: Boolean(json.connected),
    expiresAt: Number(json.expiresAt || 0),
  };
}

export async function disconnectX(): Promise<void> {
  await fetchJsonWithTimeout(apiUrl("/api/social/x/disconnect"), { method: "POST" });
}

export async function getXAuthUrl(): Promise<string | null> {
  const json = await fetchJsonWithTimeout<{ url?: string }>(apiUrl("/api/social/x/auth?json=1"));
  if (!json) return null;
  return json.url || null;
}
