import crypto from "crypto";
import type { Request, Response } from "express";
import { getSocialTokens, setSocialTokens, clearSocialTokens } from "../lib/social-store";

const X_AUTH_BASE = "https://twitter.com/i/oauth2/authorize";
const X_TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
const X_SEARCH_URL = "https://api.twitter.com/2/tweets/search/recent";

const CLIENT_ID = process.env.X_CLIENT_ID || "";
const CLIENT_SECRET = process.env.X_CLIENT_SECRET || "";
const API_PORT = process.env.API_PORT || "35821";
const APP_ORIGIN = process.env.APP_ORIGIN || "http://localhost:3000";
const REDIRECT_URI = process.env.X_REDIRECT_URI || `http://127.0.0.1:${API_PORT}/api/social/x/callback`;
const SUCCESS_REDIRECT = process.env.X_SUCCESS_REDIRECT || `${APP_ORIGIN}/settings?tab=security`;

const SCOPE = [
  "tweet.read",
  "users.read",
  "offline.access",
].join(" ");

type PendingAuth = { codeVerifier: string; createdAt: number };
const pendingAuth = new Map<string, PendingAuth>();

type CacheEntry = { ts: number; data: any };
const searchCache = new Map<string, CacheEntry>();

function base64Url(input: Buffer) {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createCodeChallenge(codeVerifier: string) {
  const hash = crypto.createHash("sha256").update(codeVerifier).digest();
  return base64Url(hash);
}

function createState() {
  return base64Url(crypto.randomBytes(16));
}

function createVerifier() {
  return base64Url(crypto.randomBytes(32));
}

async function exchangeToken(params: URLSearchParams) {
  const auth = CLIENT_SECRET
    ? Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")
    : null;

  const res = await fetch(X_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(auth ? { Authorization: `Basic ${auth}` } : {}),
    },
    body: params.toString(),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error_description || json?.error || "X token exchange failed");
  }
  return json as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };
}

async function refreshToken(refreshToken: string) {
  const params = new URLSearchParams();
  params.set("grant_type", "refresh_token");
  params.set("refresh_token", refreshToken);
  params.set("client_id", CLIENT_ID);
  return exchangeToken(params);
}

async function ensureToken() {
  const stored = getSocialTokens("x");
  if (!stored?.accessToken) return null;
  const now = Date.now();
  if (stored.expiresAt && stored.expiresAt - 60_000 > now) {
    return stored.accessToken;
  }
  if (stored.refreshToken) {
    const refreshed = await refreshToken(stored.refreshToken);
    const expiresAt = refreshed.expires_in ? now + refreshed.expires_in * 1000 : undefined;
    setSocialTokens("x", {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token || stored.refreshToken,
      expiresAt,
      scope: refreshed.scope,
    });
    return refreshed.access_token;
  }
  return stored.accessToken;
}

export async function xAuthHandler(req: Request, res: Response) {
  if (!CLIENT_ID) {
    res.status(400).json({ error: "X_CLIENT_ID missing" });
    return;
  }
  const state = createState();
  const codeVerifier = createVerifier();
  const codeChallenge = createCodeChallenge(codeVerifier);
  pendingAuth.set(state, { codeVerifier, createdAt: Date.now() });

  const url = new URL(X_AUTH_BASE);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  if (req.query.json === "1") {
    res.json({ url: url.toString() });
    return;
  }
  res.redirect(url.toString());
}

export async function xCallbackHandler(req: Request, res: Response) {
  try {
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    if (!code || !state) {
      res.status(400).send("Missing code/state");
      return;
    }
    const pending = pendingAuth.get(state);
    if (!pending) {
      res.status(400).send("Invalid state");
      return;
    }
    pendingAuth.delete(state);

    const params = new URLSearchParams();
    params.set("grant_type", "authorization_code");
    params.set("client_id", CLIENT_ID);
    params.set("redirect_uri", REDIRECT_URI);
    params.set("code_verifier", pending.codeVerifier);
    params.set("code", code);

    const token = await exchangeToken(params);
    const expiresAt = token.expires_in ? Date.now() + token.expires_in * 1000 : undefined;
    setSocialTokens("x", {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt,
      scope: token.scope,
    });

    res.send(
      `<html><body style="font-family:system-ui;background:#0a0a0b;color:#e5e7eb;padding:24px">
        <h3>Connected to X</h3>
        <p>You can close this window.</p>
        <script>setTimeout(() => { window.location.href='${SUCCESS_REDIRECT}'; }, 1200);</script>
      </body></html>`
    );
  } catch (e: any) {
    res.status(500).send(`X auth failed: ${e?.message || "unknown error"}`);
  }
}

export async function xDisconnectHandler(_req: Request, res: Response) {
  clearSocialTokens("x");
  res.json({ ok: true });
}

export async function xStatusHandler(_req: Request, res: Response) {
  const tokens = getSocialTokens("x");
  res.json({ connected: !!tokens?.accessToken, expiresAt: tokens?.expiresAt || 0 });
}

export async function xSearchHandler(req: Request, res: Response) {
  try {
    const token = await ensureToken();
    if (!token) {
      res.status(401).json({ error: "Not connected to X" });
      return;
    }

    const tickers = String(req.query.tickers || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const keywords = String(req.query.keywords || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const accounts = String(req.query.accounts || "")
      .split(",")
      .map((s) => s.trim().replace(/^@/, ""))
      .filter(Boolean);
    const sinceMinutes = Math.min(240, Math.max(1, parseInt(String(req.query.sinceMinutes || "90"), 10)));

    const queryParts: string[] = [];
    if (tickers.length) {
      const tickerTerms = tickers.map((t) => `$${t}`).join(" OR ");
      queryParts.push(`(${tickerTerms})`);
    }
    if (keywords.length) {
      queryParts.push(`(${keywords.join(" OR ")})`);
    }
    if (accounts.length) {
      queryParts.push(`(${accounts.map((a) => `from:${a}`).join(" OR ")})`);
    }
    const query = queryParts.length ? queryParts.join(" OR ") : "crypto";
    const cacheKey = `${query}|${sinceMinutes}`;
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < 90_000) {
      res.json(cached.data);
      return;
    }

    const startTime = new Date(Date.now() - sinceMinutes * 60_000).toISOString();
    const url = new URL(X_SEARCH_URL);
    url.searchParams.set("query", query);
    url.searchParams.set("start_time", startTime);
    url.searchParams.set("max_results", "25");
    url.searchParams.set("tweet.fields", "created_at,author_id");
    url.searchParams.set("expansions", "author_id");
    url.searchParams.set("user.fields", "username,name,profile_image_url");

    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await resp.json();
    if (!resp.ok) {
      res.status(502).json({ error: "X search failed", details: json });
      return;
    }

    const users = new Map<string, any>();
    (json.includes?.users || []).forEach((u: any) => users.set(u.id, u));
    const posts = (json.data || []).map((t: any) => {
      const author = users.get(t.author_id);
      const text = String(t.text || "");
      const symbols = tickers.filter((sym) => text.toUpperCase().includes(`$${sym.toUpperCase()}`));
      const score =
        (accounts.includes(author?.username) ? 10 : 0) +
        (symbols.length ? 5 : 0) +
        Math.min(5, keywords.filter((k) => text.toLowerCase().includes(k.toLowerCase())).length);
      return {
        id: t.id,
        author: author?.username ? `@${author.username}` : "unknown",
        text,
        url: `https://x.com/${author?.username || "i"}/status/${t.id}`,
        timestamp: new Date(t.created_at).getTime(),
        symbols,
        score,
      };
    });

    const payload = { posts };
    searchCache.set(cacheKey, { ts: Date.now(), data: payload });
    res.json(payload);
  } catch (e: any) {
    res.status(500).json({ error: "X search error", details: e?.message || String(e) });
  }
}
