const DEFAULT_API_HOST = process.env.NEXT_PUBLIC_API_HOST || "127.0.0.1";
const DEFAULT_API_PORT = process.env.NEXT_PUBLIC_API_PORT || "35821";
const DEFAULT_API_SERVER = process.env.NEXT_PUBLIC_API_URL || `http://${DEFAULT_API_HOST}:${DEFAULT_API_PORT}`;
const DEFAULT_TIMEOUT_MS = 7000;

/**
 * API base URL for the web app with a standalone API server.
 * - NEXT_PUBLIC_API_URL: explicit override (e.g. http://127.0.0.1:35821)
 * - Otherwise: "" for same-origin (e.g. auth, journal, etc. if proxied)
 */
function getApiBaseUrl(): string {
  if (typeof window === "undefined") return process.env.NEXT_PUBLIC_API_URL || "";
  const env = process.env.NEXT_PUBLIC_API_URL;
  if (env) return env;
  return "";
}

/**
 * Paths that must hit the standalone API server in browser.
 */
const STANDALONE_API_PATHS = ["/api/cex/", "/api/screener/", "/api/social/", "/api/calendar/", "/api/wallet/", "/api/dashboard/", "/api/ai/", "/api/integrations/"];
const CLOUDFLARE_PUBLIC_PATHS = ["/api/screener/", "/api/calendar/"];

function normalizeBaseUrl(base: string | undefined): string {
  return (base || "").trim().replace(/\/+$/, "");
}

function isCloudflarePublicPath(path: string): boolean {
  return CLOUDFLARE_PUBLIC_PATHS.some((p) => path.startsWith(p));
}

function getApiBaseUrlForPath(path: string): string {
  if (typeof window === "undefined") return process.env.NEXT_PUBLIC_API_URL || "";
  const env = process.env.NEXT_PUBLIC_API_URL;
  if (env) return env;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (STANDALONE_API_PATHS.some((p) => normalized.startsWith(p))) return DEFAULT_API_SERVER;
  return "";
}

export const API_BASE_URL = typeof window !== "undefined" ? getApiBaseUrl() : (process.env.NEXT_PUBLIC_API_URL || "");

export function apiUrl(path: string): string {
  return getApiCandidates(path)[0] || path;
}

export function getApiCandidates(path: string): string[] {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (/^https?:\/\//i.test(path)) return [path];
  const out: string[] = [];
  const push = (candidate: string) => {
    if (!candidate) return;
    if (!out.includes(candidate)) out.push(candidate);
  };

  const cfBase = normalizeBaseUrl(process.env.NEXT_PUBLIC_CF_WORKER_URL);
  const envBase = normalizeBaseUrl(process.env.NEXT_PUBLIC_API_URL);
  const isBrowser = typeof window !== "undefined";

  if (!isBrowser) {
    if (envBase) push(`${envBase}${p}`);
    else push(p);
    return out;
  }

  const preferred = getApiBaseUrlForPath(p);
  if (preferred) push(`${preferred}${p}`);
  else push(p);

  if (isCloudflarePublicPath(p) && cfBase) {
    push(`${cfBase}${p}`);
  }

  if (!envBase && STANDALONE_API_PATHS.some((prefix) => p.startsWith(prefix))) {
    push(`${DEFAULT_API_SERVER}${p}`);
  }

  push(p);
  return out;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: init.signal ?? ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function apiFetch(path: string, init: RequestInit = {}, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const candidates = getApiCandidates(path);
  let lastResponse: Response | null = null;
  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      const res = await fetchWithTimeout(candidate, init, timeoutMs);
      if (res.ok) return res;
      lastResponse = res;
    } catch (e) {
      lastError = e;
    }
  }
  if (lastResponse) return lastResponse;
  if (lastError instanceof Error) throw lastError;
  throw new Error(`Failed to fetch ${path}`);
}
