/**
 * Cloud backup via api-server (Firebase Storage). Uses Supabase JWT for auth.
 * When api-server has Firebase configured, backups go to Firebase (5GiB free tier).
 */

import { getSession } from "@/lib/supabase/auth";
import { apiUrl } from "@/lib/api/client";

export const FIREBASE_BACKUP_LAST_SUCCESS_KEY = "firebase_backup_last_success_at";
export const FIREBASE_BACKUP_OK_KEY = "firebase_backup_ok";
export const FIREBASE_BACKUP_COUNT_KEY = "firebase_backup_count";
const FIREBASE_BACKUP_LAST_ATTEMPT_KEY = "firebase_backup_last_attempt_at";
const BACKUP_UPLOAD_COOLDOWN_MS = 45000;

export interface BackupFile {
  name: string;
  path?: string;
  createdAt?: string;
  sizeBytes?: number;
  checksum?: string;
  version?: string;
}

export interface BackupUploadResult {
  filename: string;
  sizeBytes: number;
  checksum: string;
  version: string;
}

function setBackupHealth(ok: boolean, updates?: { lastSuccessAt?: number; count?: number }) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FIREBASE_BACKUP_OK_KEY, ok ? "1" : "0");
    if (updates?.lastSuccessAt) localStorage.setItem(FIREBASE_BACKUP_LAST_SUCCESS_KEY, String(updates.lastSuccessAt));
    if (typeof updates?.count === "number") localStorage.setItem(FIREBASE_BACKUP_COUNT_KEY, String(updates.count));
    window.dispatchEvent(
      new CustomEvent("cloud-sync-health-changed", {
        detail: {
          firebaseBackupOk: ok,
          firebaseLastBackupAt: Number(localStorage.getItem(FIREBASE_BACKUP_LAST_SUCCESS_KEY) || 0),
          firebaseBackupCount: Number(localStorage.getItem(FIREBASE_BACKUP_COUNT_KEY) || 0),
        },
      })
    );
  } catch {
    // no-op
  }
}

async function authFetch(
  path: string,
  options: RequestInit & { body?: string | object } = {}
): Promise<Response> {
  const { data } = await getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("Not signed in");
  const { body, ...rest } = options;
  const headers: HeadersInit = {
    ...(options.headers as Record<string, string>),
    Authorization: `Bearer ${token}`,
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  return fetch(apiUrl(path), {
    ...rest,
    headers,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

export function createVersionedBackupFilename(version: number = 1): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mm = String(now.getUTCMinutes()).padStart(2, "0");
  const ss = String(now.getUTCSeconds()).padStart(2, "0");
  return `trade-marathon-backup-v${version}-${y}${m}${d}T${hh}${mm}${ss}Z.json`;
}

export async function uploadBackup(
  _userId: string,
  filename: string,
  body: string | Blob
): Promise<{ error: Error | null; result?: BackupUploadResult }> {
  if (typeof window !== "undefined") {
    const lastAttempt = Number(localStorage.getItem(FIREBASE_BACKUP_LAST_ATTEMPT_KEY) || 0);
    if (Date.now() - lastAttempt < BACKUP_UPLOAD_COOLDOWN_MS) {
      return { error: new Error("Please wait before creating another cloud backup.") };
    }
    localStorage.setItem(FIREBASE_BACKUP_LAST_ATTEMPT_KEY, String(Date.now()));
  }
  try {
    const text = typeof body === "string" ? body : await (body as Blob).text();
    const res = await authFetch("/api/backup/upload", {
      method: "POST",
      body: JSON.stringify({ filename, data: text }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setBackupHealth(false);
      return { error: new Error((err as { error?: string }).error || res.statusText) };
    }
    const json = (await res.json()) as BackupUploadResult;
    setBackupHealth(true, { lastSuccessAt: Date.now() });
    return { error: null, result: json };
  } catch (e) {
    setBackupHealth(false);
    return { error: e instanceof Error ? e : new Error("Upload failed") };
  }
}

export async function listBackups(_userId: string): Promise<{ files: BackupFile[]; error: Error | null }> {
  try {
    const res = await authFetch("/api/backup/list");
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setBackupHealth(false);
      return { files: [], error: new Error((err as { error?: string }).error || res.statusText) };
    }
    const data = (await res.json()) as {
      files?: {
        name: string;
        createdAt?: string;
        sizeBytes?: number;
        checksum?: string;
        version?: string;
      }[];
    };
    const files: BackupFile[] = (data.files ?? []).map((f) => ({
      name: f.name,
      path: f.name,
      createdAt: f.createdAt,
      sizeBytes: f.sizeBytes,
      checksum: f.checksum,
      version: f.version,
    }));
    const latest = files
      .map((file) => Date.parse(file.createdAt || "0"))
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => b - a)[0] || 0;
    setBackupHealth(true, { count: files.length, lastSuccessAt: latest || undefined });
    return { files, error: null };
  } catch (e) {
    setBackupHealth(false);
    return { files: [], error: e instanceof Error ? e : new Error("List failed") };
  }
}

export async function downloadBackup(
  _userId: string,
  filename: string
): Promise<{ data: string | null; error: Error | null }> {
  try {
    const res = await authFetch(`/api/backup/download?file=${encodeURIComponent(filename)}`);
    if (!res.ok) {
      if (res.status === 404) return { data: null, error: new Error("Backup not found") };
      const err = await res.json().catch(() => ({}));
      setBackupHealth(false);
      return { data: null, error: new Error((err as { error?: string }).error || res.statusText) };
    }
    const text = await res.text();
    setBackupHealth(true);
    return { data: text, error: null };
  } catch (e) {
    setBackupHealth(false);
    return { data: null, error: e instanceof Error ? e : new Error("Download failed") };
  }
}

export async function deleteBackup(
  _userId: string,
  filename: string
): Promise<{ error: Error | null }> {
  try {
    const res = await authFetch(`/api/backup/delete?file=${encodeURIComponent(filename)}`, { method: "DELETE" });
    if (!res.ok) {
      if (res.status === 404) return { error: new Error("Backup not found") };
      const err = await res.json().catch(() => ({}));
      setBackupHealth(false);
      return { error: new Error((err as { error?: string }).error || res.statusText) };
    }
    setBackupHealth(true);
    return { error: null };
  } catch (e) {
    setBackupHealth(false);
    return { error: e instanceof Error ? e : new Error("Delete failed") };
  }
}
