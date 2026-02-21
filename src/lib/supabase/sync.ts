import { getSupabase } from "./client";
import { STORAGE_KEYS } from "@/lib/export-import";
import { getUserCloudProvider, isUserCloudSyncKey } from "@/lib/user-cloud/config";
import { loadDriveSyncFile, saveDriveSyncFile } from "@/lib/user-cloud/drive";
import { loadDropboxSyncFile, saveDropboxSyncFile } from "@/lib/user-cloud/dropbox";

export type SyncBackend = "supabase" | "google_drive" | "dropbox" | "none";
export type SupabaseSyncScope = "alerts" | "alerts_ui" | "full";

/** Keys we never sync to cloud (internal or device-only). */
const INTERNAL_ONLY_KEYS = new Set([
  "cloud_sync_queue",
  "cloud_sync_last_success_at",
  "firebase_backup_last_success_at",
  "firebase_backup_ok",
  "firebase_backup_count",
  "firebase_backup_last_attempt_at",
]);

const SUPABASE_SYNC_SCOPE_KEY = "supabase_sync_scope";
const SUPABASE_SYNC_ALLOW_SENSITIVE_KEY = "supabase_sync_allow_sensitive";
const SUPABASE_SYNC_ENCRYPT_KEY = "supabase_sync_encrypt";
const SUPABASE_SYNC_PASSPHRASE_KEY = "supabase_sync_passphrase";

const ALERTS_ONLY_KEYS = new Set<string>([
  STORAGE_KEYS.portfolio_alert_settings,
  STORAGE_KEYS.portfolio_alerts,
  STORAGE_KEYS.alerts_feed_settings,
  STORAGE_KEYS.movement_alerts_settings,
  STORAGE_KEYS.global_alert_settings,
  STORAGE_KEYS.ai_feed_memory,
  STORAGE_KEYS.alerts_memory,
]);

const ALERTS_UI_KEYS = new Set<string>([
  ...ALERTS_ONLY_KEYS,
  STORAGE_KEYS.settings_auto_refresh,
  STORAGE_KEYS.settings_dust_threshold,
  STORAGE_KEYS.settings_hide_spam,
  STORAGE_KEYS.ui_sidebar_hidden,
  STORAGE_KEYS.ui_sidebar_collapsed,
  STORAGE_KEYS.ui_sidebar_autohide,
  STORAGE_KEYS.user_watchlist,
  STORAGE_KEYS.hide_dust,
  STORAGE_KEYS.portfolio_hwm,
  STORAGE_KEYS.portfolio_hwm_spot,
  STORAGE_KEYS.global_tv_settings,
  STORAGE_KEYS.ai_provider,
  STORAGE_KEYS.ollama_base_url,
  STORAGE_KEYS.ollama_model,
  "appearance_settings",
]);

const FULL_SYNC_EXTRA_KEYS = [
  "openai_api_key",
  "gemini_api_key",
  "indian_mf_api_base",
  "indian_stocks_api_base",
  "cas_parser_api_key",
  "social_x_settings",
  "screener_alert_settings",
  "sync_supabase_url",
  "sync_supabase_anon_key",
];

const SENSITIVE_SYNC_KEYS = new Set<string>([
  "portfolio_connections",
  "openai_api_key",
  "gemini_api_key",
  "portfolio_alert_settings",
  "social_x_settings",
  "indian_mf_api_base",
  "indian_stocks_api_base",
  "cas_parser_api_key",
]);

const FULL_SYNC_KEYS = new Set<string>([
  ...Object.values(STORAGE_KEYS),
  ...FULL_SYNC_EXTRA_KEYS,
  "appearance_settings",
]);

function getSupabaseSyncScope(): SupabaseSyncScope {
  if (!canUseWindow()) return "alerts_ui";
  const raw = (localStorage.getItem(SUPABASE_SYNC_SCOPE_KEY) || "alerts_ui").trim().toLowerCase();
  if (raw === "alerts") return "alerts";
  if (raw === "full") return "full";
  return "alerts_ui";
}

export function setSupabaseSyncScope(scope: SupabaseSyncScope): void {
  if (!canUseWindow()) return;
  localStorage.setItem(SUPABASE_SYNC_SCOPE_KEY, scope);
  window.dispatchEvent(new CustomEvent("supabase-sync-scope-changed", { detail: scope }));
}

export function readSupabaseSyncScope(): SupabaseSyncScope {
  return getSupabaseSyncScope();
}

export function isSensitiveSyncAllowed(): boolean {
  if (!canUseWindow()) return false;
  return localStorage.getItem(SUPABASE_SYNC_ALLOW_SENSITIVE_KEY) === "1";
}

export function isEncryptionEnabled(): boolean {
  if (!canUseWindow()) return false;
  return localStorage.getItem(SUPABASE_SYNC_ENCRYPT_KEY) === "1";
}

export function getEncryptionPassphrase(): string {
  if (!canUseWindow()) return "";
  return sessionStorage.getItem(SUPABASE_SYNC_PASSPHRASE_KEY) || "";
}

const encoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
const decoder = typeof TextDecoder !== "undefined" ? new TextDecoder() : null;

function toBase64(buffer: ArrayBuffer | ArrayBufferView): string {
  const bytes = buffer instanceof ArrayBuffer
    ? new Uint8Array(buffer)
    : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function fromBase64(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

const ENC_PREFIX = "enc:v1";

function isEncryptedPayload(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(`${ENC_PREFIX}:`);
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const cryptoObj = typeof window !== "undefined" ? window.crypto : undefined;
  if (!cryptoObj || !encoder) throw new Error("WebCrypto unavailable");
  const saltBytes = new Uint8Array(salt);
  const baseKey = await cryptoObj.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return cryptoObj.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: 100_000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptString(plain: string, passphrase: string): Promise<string> {
  const cryptoObj = typeof window !== "undefined" ? window.crypto : undefined;
  if (!cryptoObj || !encoder) throw new Error("WebCrypto unavailable");
  const salt = cryptoObj.getRandomValues(new Uint8Array(16));
  const iv = cryptoObj.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const cipher = await cryptoObj.subtle.encrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv) },
    key,
    encoder.encode(plain)
  );
  return `${ENC_PREFIX}:${toBase64(salt)}:${toBase64(iv)}:${toBase64(cipher)}`;
}

async function decryptString(payload: string, passphrase: string): Promise<string | null> {
  const cryptoObj = typeof window !== "undefined" ? window.crypto : undefined;
  if (!cryptoObj || !decoder) return null;
  const parts = payload.split(":");
  if (parts.length !== 4) return null;
  const salt = new Uint8Array(fromBase64(parts[1]));
  const iv = new Uint8Array(fromBase64(parts[2]));
  const data = fromBase64(parts[3]);
  try {
    const key = await deriveKey(passphrase, salt);
    const plain = await cryptoObj.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
    return decoder.decode(plain);
  } catch {
    return null;
  }
}

const MAX_SUPABASE_PAYLOAD_BYTES = 64 * 1024;
const SUPABASE_WRITE_DEBOUNCE_MS = 5000;
const CLOUD_SYNC_QUEUE_KEY = "cloud_sync_queue";
const CLOUD_SYNC_LAST_SUCCESS_KEY = "cloud_sync_last_success_at";

/** Set by SupabaseAuthContext so non-React code (e.g. session.ts) can use sync. */
let currentSyncUserId: string | null = null;
let currentCloudSyncEnabled = false;
let currentSyncBackend: SyncBackend = "supabase";

const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingPayloads = new Map<string, unknown>();
let queueRetryTimer: ReturnType<typeof setInterval> | null = null;

function canUseWindow(): boolean {
  return typeof window !== "undefined";
}

function toJsonPayload(value: unknown): unknown {
  let payload: unknown = value === undefined ? {} : value;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      payload = { _raw: payload };
    }
  }
  return JSON.parse(JSON.stringify(payload));
}

function payloadSizeBytes(value: unknown): number {
  try {
    const normalized = JSON.stringify(toJsonPayload(value));
    return new TextEncoder().encode(normalized).length;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

type CloudSyncQueueItem = {
  userId: string;
  key: string;
  payload: unknown;
  updatedAt: number;
};

function readQueue(): CloudSyncQueueItem[] {
  if (!canUseWindow()) return [];
  try {
    const raw = localStorage.getItem(CLOUD_SYNC_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.userId === "string" && typeof item.key === "string");
  } catch {
    return [];
  }
}

function writeQueue(items: CloudSyncQueueItem[]): void {
  if (!canUseWindow()) return;
  try {
    localStorage.setItem(CLOUD_SYNC_QUEUE_KEY, JSON.stringify(items.slice(-200)));
  } catch {
    // no-op
  }
}

function queuePendingCount(): number {
  return readQueue().length + pendingPayloads.size;
}

function dispatchCloudSyncHealth(extra?: Record<string, unknown>): void {
  if (!canUseWindow()) return;
  window.dispatchEvent(
    new CustomEvent("cloud-sync-health-changed", {
      detail: {
        pendingCloudWrites: queuePendingCount(),
        supabaseLastSyncAt: localStorage.getItem(CLOUD_SYNC_LAST_SUCCESS_KEY),
        ...extra,
      },
    })
  );
}

function enqueueFailedWrite(userId: string, key: string, payload: unknown): void {
  if (!canUseWindow()) return;
  const queue = readQueue();
  const dedupeKey = `${userId}:${key}`;
  const next = queue.filter((item) => `${item.userId}:${item.key}` !== dedupeKey);
  next.push({ userId, key, payload, updatedAt: Date.now() });
  writeQueue(next);
  dispatchCloudSyncHealth({ supabaseSyncOk: false });
}

async function flushCloudSyncQueue(): Promise<void> {
  const queue = readQueue();
  if (!queue.length) {
    dispatchCloudSyncHealth({ supabaseSyncOk: true });
    return;
  }
  const remaining: CloudSyncQueueItem[] = [];
  for (const item of queue) {
    const result = await setCloudValue(item.key, item.userId, item.payload);
    if (result.error) remaining.push(item);
  }
  writeQueue(remaining);
  dispatchCloudSyncHealth({
    supabaseSyncOk: remaining.length === 0,
    pendingCloudWrites: remaining.length + pendingPayloads.size,
  });
}

async function writeSupabaseNow(key: string, userId: string, payload: unknown): Promise<void> {
  const size = payloadSizeBytes(payload);
  if (size > MAX_SUPABASE_PAYLOAD_BYTES) {
    enqueueFailedWrite(userId, key, payload);
    return;
  }
  const result = await setCloudValue(key, userId, payload);
  if (result.error) {
    enqueueFailedWrite(userId, key, payload);
    return;
  }
  if (canUseWindow()) {
    localStorage.setItem(CLOUD_SYNC_LAST_SUCCESS_KEY, String(Date.now()));
  }
  dispatchCloudSyncHealth({ supabaseSyncOk: true });
}

function scheduleSupabaseWrite(key: string, userId: string, payload: unknown): void {
  const compositeKey = `${userId}:${key}`;
  const oldTimer = pendingTimers.get(compositeKey);
  if (oldTimer) clearTimeout(oldTimer);
  pendingPayloads.set(compositeKey, payload);
  dispatchCloudSyncHealth();
  const timer = setTimeout(async () => {
    pendingTimers.delete(compositeKey);
    const finalPayload = pendingPayloads.get(compositeKey);
    pendingPayloads.delete(compositeKey);
    dispatchCloudSyncHealth();
    if (finalPayload === undefined) return;
    await writeSupabaseNow(key, userId, finalPayload);
    await flushCloudSyncQueue();
  }, SUPABASE_WRITE_DEBOUNCE_MS);
  pendingTimers.set(compositeKey, timer);
}

export function getCloudSyncQueueSize(): number {
  return queuePendingCount();
}

export function getCloudSyncLastSuccessAt(): number {
  if (!canUseWindow()) return 0;
  return Number(localStorage.getItem(CLOUD_SYNC_LAST_SUCCESS_KEY) || 0);
}

export type ResyncItemStatus = "synced" | "failed" | "skipped";

export type ResyncItemResult = {
  key: string;
  status: ResyncItemStatus;
  reason?: string;
  bytes: number;
  startedAt: number;
  endedAt: number;
};

export type ResyncSummary = {
  total: number;
  done: number;
  synced: number;
  failed: number;
  skipped: number;
  startedAt: number;
  endedAt?: number;
};

export type ResyncReport = ResyncSummary & {
  items: ResyncItemResult[];
};

type ResyncProgressCallback = (item: ResyncItemResult, summary: ResyncSummary) => void;

async function forceResyncSupabaseDetailed(
  userId: string,
  keys: string[],
  onProgress?: ResyncProgressCallback
): Promise<ResyncReport> {
  const summary: ResyncSummary = {
    total: keys.length,
    done: 0,
    synced: 0,
    failed: 0,
    skipped: 0,
    startedAt: Date.now(),
  };
  const items: ResyncItemResult[] = [];
  const encryptionOn = isEncryptionEnabled();
  const passphrase = getEncryptionPassphrase();

  for (const key of keys) {
    const startedAt = Date.now();
    const value = localStorage.getItem(key);
    if (value == null) {
      const row: ResyncItemResult = {
        key,
        status: "skipped",
        reason: "missing_local_value",
        bytes: 0,
        startedAt,
        endedAt: Date.now(),
      };
      items.push(row);
      summary.done += 1;
      summary.skipped += 1;
      onProgress?.(row, { ...summary });
      continue;
    }

    if (encryptionOn && SENSITIVE_SYNC_KEYS.has(key) && !passphrase) {
      const row: ResyncItemResult = {
        key,
        status: "skipped",
        reason: "missing_encryption_passphrase",
        bytes: value.length,
        startedAt,
        endedAt: Date.now(),
      };
      items.push(row);
      summary.done += 1;
      summary.skipped += 1;
      onProgress?.(row, { ...summary });
      continue;
    }

    let payload: unknown;
    if (encryptionOn && passphrase && SENSITIVE_SYNC_KEYS.has(key)) {
      try {
        payload = await encryptString(value, passphrase);
      } catch (error: any) {
        const row: ResyncItemResult = {
          key,
          status: "failed",
          reason: error?.message || "encrypt_failed",
          bytes: value.length,
          startedAt,
          endedAt: Date.now(),
        };
        items.push(row);
        summary.done += 1;
        summary.failed += 1;
        onProgress?.(row, { ...summary });
        continue;
      }
    } else {
      payload = (() => {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      })();
    }

    const result = await setCloudValue(key, userId, payload);
    const endedAt = Date.now();
    if (result.error) {
      const row: ResyncItemResult = {
        key,
        status: "failed",
        reason: result.error.message,
        bytes: value.length,
        startedAt,
        endedAt,
      };
      items.push(row);
      summary.done += 1;
      summary.failed += 1;
      onProgress?.(row, { ...summary });
      continue;
    }
    const row: ResyncItemResult = {
      key,
      status: "synced",
      bytes: value.length,
      startedAt,
      endedAt,
    };
    items.push(row);
    summary.done += 1;
    summary.synced += 1;
    onProgress?.(row, { ...summary });
  }

  if (summary.synced > 0) {
    localStorage.setItem(CLOUD_SYNC_LAST_SUCCESS_KEY, String(Date.now()));
  }
  const report: ResyncReport = {
    ...summary,
    endedAt: Date.now(),
    items,
  };
  dispatchCloudSyncHealth({
    supabaseSyncOk: report.failed === 0,
    supabaseLastSyncAt: localStorage.getItem(CLOUD_SYNC_LAST_SUCCESS_KEY),
  });
  return report;
}

export async function forceResyncAllLocalDetailed(onProgress?: ResyncProgressCallback): Promise<ResyncReport> {
  if (!canUseWindow()) {
    return {
      total: 0,
      done: 0,
      synced: 0,
      failed: 0,
      skipped: 0,
      startedAt: Date.now(),
      endedAt: Date.now(),
      items: [],
    };
  }

  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !isSyncableKey(key)) continue;
      keys.push(key);
    }
  } catch {
    // ignore
  }

  if (!keys.length) {
    return {
      total: 0,
      done: 0,
      synced: 0,
      failed: 0,
      skipped: 0,
      startedAt: Date.now(),
      endedAt: Date.now(),
      items: [],
    };
  }

  const backend = currentSyncBackend;
  const userId = currentSyncUserId;
  const enabled = currentCloudSyncEnabled;
  if (!userId || !enabled || backend === "none") {
    const now = Date.now();
    const items = keys.map((key) => ({
      key,
      status: "skipped" as const,
      reason: "sync_disabled_or_no_user",
      bytes: (localStorage.getItem(key) || "").length,
      startedAt: now,
      endedAt: now,
    }));
    return {
      total: keys.length,
      done: keys.length,
      synced: 0,
      failed: 0,
      skipped: keys.length,
      startedAt: now,
      endedAt: now,
      items,
    };
  }

  if (backend === "supabase") {
    return forceResyncSupabaseDetailed(userId, keys, onProgress);
  }

  // User-cloud providers: write all keys in one save operation.
  const startedAt = Date.now();
  const items: ResyncItemResult[] = [];
  try {
    const load = backend === "google_drive" ? loadDriveSyncFile : loadDropboxSyncFile;
    const save = backend === "google_drive" ? saveDriveSyncFile : saveDropboxSyncFile;
    const record = await load(userId);
    for (const key of keys) {
      const value = localStorage.getItem(key);
      if (value == null) {
        const row: ResyncItemResult = {
          key,
          status: "skipped",
          reason: "missing_local_value",
          bytes: 0,
          startedAt: Date.now(),
          endedAt: Date.now(),
        };
        items.push(row);
        onProgress?.(row, {
          total: keys.length,
          done: items.length,
          synced: items.filter((i) => i.status === "synced").length,
          failed: items.filter((i) => i.status === "failed").length,
          skipped: items.filter((i) => i.status === "skipped").length,
          startedAt,
        });
        continue;
      }
      record[key] = value;
      const row: ResyncItemResult = {
        key,
        status: "synced",
        bytes: value.length,
        startedAt: Date.now(),
        endedAt: Date.now(),
      };
      items.push(row);
      onProgress?.(row, {
        total: keys.length,
        done: items.length,
        synced: items.filter((i) => i.status === "synced").length,
        failed: items.filter((i) => i.status === "failed").length,
        skipped: items.filter((i) => i.status === "skipped").length,
        startedAt,
      });
    }
    await save(userId, record);
    return {
      total: keys.length,
      done: keys.length,
      synced: items.filter((i) => i.status === "synced").length,
      failed: items.filter((i) => i.status === "failed").length,
      skipped: items.filter((i) => i.status === "skipped").length,
      startedAt,
      endedAt: Date.now(),
      items,
    };
  } catch (error: any) {
    const failedItems = keys.map((key) => ({
      key,
      status: "failed" as const,
      reason: error?.message || "provider_sync_failed",
      bytes: (localStorage.getItem(key) || "").length,
      startedAt: Date.now(),
      endedAt: Date.now(),
    }));
    return {
      total: keys.length,
      done: keys.length,
      synced: 0,
      failed: keys.length,
      skipped: 0,
      startedAt,
      endedAt: Date.now(),
      items: failedItems,
    };
  }
}

export async function forceResyncAllLocal(): Promise<number> {
  const report = await forceResyncAllLocalDetailed();
  return report.synced;
}

export function setSyncAuth(
  userId: string | null,
  enabled: boolean,
  backend?: SyncBackend
): void {
  currentSyncUserId = userId;
  currentCloudSyncEnabled = enabled;
  if (backend !== undefined) currentSyncBackend = backend;
  else if (!userId) currentSyncBackend = "supabase";
  else {
    const provider = getUserCloudProvider();
    currentSyncBackend =
      provider === "google_drive" ? "google_drive" : provider === "dropbox" ? "dropbox" : "none";
  }
  if (userId && enabled && currentSyncBackend === "supabase") {
    void flushCloudSyncQueue();
    if (!queueRetryTimer) {
      queueRetryTimer = setInterval(() => {
        void flushCloudSyncQueue();
      }, 30000);
    }
  } else if (queueRetryTimer) {
    clearInterval(queueRetryTimer);
    queueRetryTimer = null;
  }
}

/** Get value (cloud or local) using current auth. Use from non-React code. */
export async function getValue(key: string): Promise<string | null> {
  return getValueWithCloud(
    key,
    currentSyncUserId,
    currentCloudSyncEnabled,
    currentSyncBackend
  );
}

/** Set value (local + cloud when enabled). Use from non-React code. */
export async function setValue(key: string, value: string): Promise<void> {
  await setValueWithCloud(
    key,
    value,
    currentSyncUserId,
    currentCloudSyncEnabled,
    currentSyncBackend
  );
}

/** Fetch all keys for the current user from cloud. For hydration on sign-in. */
export async function getAllCloudValues(
  userId: string,
  backend?: SyncBackend
): Promise<Record<string, string>> {
  const back = backend ?? currentSyncBackend;
  if (back === "none") return {};
  if (back === "google_drive") return loadDriveSyncFile(userId);
  if (back === "dropbox") return loadDropboxSyncFile(userId);
  const supabase = getSupabase();
  if (!supabase) return {};
  const { data, error } = await supabase
    .from("user_data")
    .select("key, payload")
    .eq("user_id", userId);
  if (error || !data) return {};
  const out: Record<string, string> = {};
  for (const row of data) {
    const payload = row.payload;
    const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
    if (isEncryptedPayload(raw)) {
      const passphrase = getEncryptionPassphrase();
      const decrypted = passphrase ? await decryptString(raw, passphrase) : null;
      if (decrypted != null) out[row.key] = decrypted;
      else continue;
    } else {
      out[row.key] = raw;
    }
  }
  return out;
}

/** All syncable storage keys (from STORAGE_KEYS, excluding sensitive). */
export const SYNCABLE_KEYS = Object.values(STORAGE_KEYS).filter((k) => ALERTS_UI_KEYS.has(k));

/** True if this key is safe to sync (lean allowlist; includes some keys not in STORAGE_KEYS). */
export function isSyncableKey(key: string): boolean {
  if (INTERNAL_ONLY_KEYS.has(key)) return false;
  const scope = getSupabaseSyncScope();
  if (scope === "alerts") return ALERTS_ONLY_KEYS.has(key);
  if (scope === "full") {
    if (!FULL_SYNC_KEYS.has(key)) return false;
    if (SENSITIVE_SYNC_KEYS.has(key) && !isSensitiveSyncAllowed()) return false;
    return true;
  }
  return ALERTS_UI_KEYS.has(key);
}

/**
 * Read a value from Supabase user_data for the given user.
 * Returns the parsed payload or null if not found / error.
 */
export async function getCloudValue(
  key: string,
  userId: string
): Promise<unknown> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("user_data")
    .select("payload")
    .eq("user_id", userId)
    .eq("key", key)
    .maybeSingle();
  if (error || !data) return null;
  return data.payload as unknown;
}

/**
 * Write a value to Supabase user_data for the given user.
 * Payload is stored as JSON (object/array/string/number).
 */
export async function setCloudValue(
  key: string,
  userId: string,
  value: unknown
): Promise<{ error: { message: string } | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: { message: "Supabase not configured" } };
  const payload = toJsonPayload(value);
  if (payloadSizeBytes(payload) > MAX_SUPABASE_PAYLOAD_BYTES) {
    return { error: { message: "Payload too large for free-tier sync" } };
  }
  const { error } = await supabase
    .from("user_data")
    .upsert(
      {
        user_id: userId,
        key,
        payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,key" }
    );
  return { error: error ? { message: error.message } : null };
}

/**
 * Get value from cloud or fallback to localStorage.
 * Use when sync is enabled and user is signed in.
 * backend: when provided, use that; otherwise use currentSyncBackend (set by setSyncAuth).
 */
export async function getValueWithCloud(
  key: string,
  userId: string | null,
  cloudSyncEnabled: boolean,
  backend?: SyncBackend
): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const fromLocal = () => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  if (!userId || !cloudSyncEnabled) return fromLocal();
  const back = backend ?? currentSyncBackend;
  if (back === "none") return fromLocal();
  if (back === "google_drive" || back === "dropbox") {
    if (!isUserCloudSyncKey(key)) return fromLocal();
    const record =
      back === "google_drive" ? await loadDriveSyncFile(userId) : await loadDropboxSyncFile(userId);
    const v = record[key];
    return v ?? fromLocal();
  }
  const cloud = await getCloudValue(key, userId);
  if (cloud === null) return fromLocal();
  if (typeof cloud === "string") {
    if (isEncryptedPayload(cloud)) {
      const passphrase = getEncryptionPassphrase();
      const decrypted = passphrase ? await decryptString(cloud, passphrase) : null;
      return decrypted ?? fromLocal();
    }
    return cloud;
  }
  return JSON.stringify(cloud);
}

async function syncCloudValueOnly(
  key: string,
  value: string,
  userId: string | null,
  cloudSyncEnabled: boolean,
  backend?: SyncBackend
): Promise<void> {
  if (!userId || !cloudSyncEnabled) return;
  const back = backend ?? currentSyncBackend;
  if (back === "none") return;
  if (back === "google_drive" || back === "dropbox") {
    if (!isUserCloudSyncKey(key)) return;
    const load = back === "google_drive" ? loadDriveSyncFile : loadDropboxSyncFile;
    const save = back === "google_drive" ? saveDriveSyncFile : saveDropboxSyncFile;
    const record = await load(userId);
    const payload = (() => {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    })();
    record[key] = typeof payload === "string" ? payload : JSON.stringify(payload);
    await save(userId, record);
    return;
  }
  if (!isSyncableKey(key)) return;
  const encryptionOn = isEncryptionEnabled();
  const passphrase = getEncryptionPassphrase();
  if (encryptionOn && SENSITIVE_SYNC_KEYS.has(key) && !passphrase) {
    return;
  }
  if (encryptionOn && passphrase && SENSITIVE_SYNC_KEYS.has(key)) {
    try {
      const encrypted = await encryptString(value, passphrase);
      scheduleSupabaseWrite(key, userId, encrypted);
      return;
    } catch {
      // fall through to plaintext
    }
  }
  const payload = (() => {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  })();
  scheduleSupabaseWrite(key, userId, payload);
}

/**
 * Sync cloud copy without rewriting localStorage.
 * Useful when localStorage.setItem has already been performed.
 */
export async function setCloudValueOnly(
  key: string,
  value: string,
  userId: string | null,
  cloudSyncEnabled: boolean,
  backend?: SyncBackend
): Promise<void> {
  await syncCloudValueOnly(key, value, userId, cloudSyncEnabled, backend);
}

/**
 * Write value to both localStorage and cloud when sync is on.
 * For user cloud (Drive/Dropbox) only keys in USER_CLOUD_SYNC_KEYS are synced.
 */
export async function setValueWithCloud(
  key: string,
  value: string,
  userId: string | null,
  cloudSyncEnabled: boolean,
  backend?: SyncBackend
): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const nativeSetItem = Storage.prototype.setItem;
    const win = window as unknown as {
      __cloudSyncLocalWriteDepth?: number;
    };
    const current = localStorage.getItem(key);
    if (current !== value) {
      win.__cloudSyncLocalWriteDepth = (win.__cloudSyncLocalWriteDepth || 0) + 1;
      try {
        // Always use native setItem so wrapped localStorage.setItem cannot recurse.
        nativeSetItem.call(localStorage, key, value);
      } finally {
        win.__cloudSyncLocalWriteDepth = Math.max(0, (win.__cloudSyncLocalWriteDepth || 1) - 1);
      }
    }
  } catch {}
  await syncCloudValueOnly(key, value, userId, cloudSyncEnabled, backend);
}
