/**
 * Google Drive adapter: OAuth and read/write one sync file (TradeMarathon-sync.json).
 * Uses scope drive.file so we only access files created by the app.
 */

import {
  getStoredTokens,
  setStoredTokens,
  type StoredUserCloudTokens,
} from "./config";

const DRIVE_SYNC_FILENAME = "TradeMarathon-sync.json";
const DRIVE_FILE_ID_KEY_PREFIX = "user_cloud_drive_file_id_";

function getDriveFileIdKey(userId: string): string {
  return `${DRIVE_FILE_ID_KEY_PREFIX}${userId}`;
}

export function getDriveAuthUrl(state: string): string {
  const clientId =
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID : undefined;
  if (!clientId) return "";
  const redirectUri =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/drive/callback`
      : "";
  const scope = encodeURIComponent("https://www.googleapis.com/auth/drive.file");
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;
}

export async function exchangeDriveCode(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
} | null> {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const res = await fetch(`${base}/api/auth/drive/exchange`, {
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
  provider: "google_drive"
): Promise<string | null> {
  const stored = getStoredTokens(userId, provider);
  if (!stored || !stored.accessToken) return null;
  const expiresAt = stored.expiresAt ?? 0;
  if (expiresAt > Date.now() + 60_000) return stored.accessToken;
  const refreshToken = stored.refreshToken;
  if (!refreshToken) return stored.accessToken;
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const res = await fetch(`${base}/api/auth/drive/refresh`, {
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
      : Date.now() + 3600 * 1000,
  };
  setStoredTokens(userId, newStored);
  return data.access_token;
}

async function getOrCreateFileId(userId: string, accessToken: string): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const key = getDriveFileIdKey(userId);
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: DRIVE_SYNC_FILENAME,
      mimeType: "application/json",
    }),
  });
  if (!createRes.ok) return null;
  const createData = (await createRes.json()) as { id?: string };
  if (!createData.id) return null;
  localStorage.setItem(key, createData.id);
  return createData.id;
}

export async function loadDriveSyncFile(
  userId: string
): Promise<Record<string, string>> {
  const accessToken = await getValidAccessToken(userId, "google_drive");
  if (!accessToken) return {};
  const fileId = await getOrCreateFileId(userId, accessToken);
  if (!fileId) return {};
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok) return {};
  try {
    const text = await res.text();
    const json = (JSON.parse(text || "{}")) as Record<string, unknown>;
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

export async function saveDriveSyncFile(
  userId: string,
  record: Record<string, string>
): Promise<{ error: { message: string } | null }> {
  const accessToken = await getValidAccessToken(userId, "google_drive");
  if (!accessToken)
    return { error: { message: "Google Drive not connected" } };
  const fileId = await getOrCreateFileId(userId, accessToken);
  if (!fileId)
    return { error: { message: "Could not create or find sync file" } };
  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(record),
    }
  );
  if (!res.ok)
    return { error: { message: `Drive upload failed: ${res.status}` } };
  return { error: null };
}

export function clearDriveFileId(userId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(getDriveFileIdKey(userId));
}
