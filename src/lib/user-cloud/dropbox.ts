/**
 * Dropbox adapter: OAuth and read/write one sync file (Apps/TradeMarathon/sync.json).
 */

import {
  getStoredTokens,
  setStoredTokens,
  type StoredUserCloudTokens,
} from "./config";

const DROPBOX_SYNC_PATH = "/Apps/TradeMarathon/sync.json";

export function getDropboxAuthUrl(state: string): string {
  const clientId =
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_DROPBOX_APP_KEY : undefined;
  if (!clientId) return "";
  const redirectUri =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/dropbox/callback`
      : "";
  return `https://www.dropbox.com/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&token_access_type=offline&state=${encodeURIComponent(state)}`;
}

export async function exchangeDropboxCode(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
} | null> {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const res = await fetch(`${base}/api/auth/dropbox/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) return null;
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  };
}

async function getValidAccessToken(
  userId: string,
  provider: "dropbox"
): Promise<string | null> {
  const stored = getStoredTokens(userId, provider);
  if (!stored || !stored.accessToken) return null;
  const expiresAt = stored.expiresAt ?? 0;
  if (expiresAt > Date.now() + 60_000) return stored.accessToken;
  const refreshToken = stored.refreshToken;
  if (!refreshToken) return stored.accessToken;
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const res = await fetch(`${base}/api/auth/dropbox/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) return null;
  const newStored: StoredUserCloudTokens = {
    ...stored,
    accessToken: data.access_token,
    expiresAt: data.expires_in
      ? Date.now() + data.expires_in * 1000
      : Date.now() + 14400 * 1000,
  };
  setStoredTokens(userId, newStored);
  return data.access_token;
}

export async function loadDropboxSyncFile(
  userId: string
): Promise<Record<string, string>> {
  const accessToken = await getValidAccessToken(userId, "dropbox");
  if (!accessToken) return {};
  const res = await fetch("https://content.dropboxapi.com/2/files/download", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Dropbox-API-Arg": JSON.stringify({ path: DROPBOX_SYNC_PATH }),
    },
  });
  if (!res.ok) return {};
  try {
    const text = await res.text();
    const json = JSON.parse(text || "{}") as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(json)) {
      if (typeof v === "string") out[k] = v;
      else if (v !== null && v !== undefined) out[k] = JSON.stringify(v);
    }
    return out;
  } catch {
    return {};
  }
}

export async function saveDropboxSyncFile(
  userId: string,
  record: Record<string, string>
): Promise<{ error: { message: string } | null }> {
  const accessToken = await getValidAccessToken(userId, "dropbox");
  if (!accessToken)
    return { error: { message: "Dropbox not connected" } };
  const res = await fetch("https://content.dropboxapi.com/2/files/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({
        path: DROPBOX_SYNC_PATH,
        mode: "overwrite",
      }),
    },
    body: JSON.stringify(record),
  });
  if (!res.ok)
    return { error: { message: `Dropbox upload failed: ${res.status}` } };
  return { error: null };
}
