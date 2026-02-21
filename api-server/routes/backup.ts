/**
 * Cloud backup bridge: verify Supabase JWT, then use Firebase Storage for upload/list/download.
 * Path in Firebase: {user_id}/backups/{filename}
 */

import type { Request, Response } from "express";
import { createHash } from "crypto";

const PREFIX = "backups";
const MAX_BACKUPS_PER_USER = 20;
const BACKUP_FILENAME_RE = /^trade-marathon-backup-v\d+-\d{8}T\d{6}Z\.json$/;

let firebaseInitialized = false;

async function ensureFirebase(): Promise<void> {
  if (firebaseInitialized) return;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) return;
  const { initializeApp, getApps, cert } = await import("firebase-admin/app");
  if (getApps().length > 0) {
    firebaseInitialized = true;
    return;
  }
  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    }),
  });
  firebaseInitialized = true;
}

async function getSupabaseUserId(accessToken: string): Promise<string | null> {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, serviceKey);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);
  if (error || !user?.id) return null;
  return user.id;
}

function getAccessToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7).trim() || null;
}

function storagePath(userId: string, filename: string): string {
  return `${userId}/${PREFIX}/${filename}`;
}

function getFilename(req: Request, options?: { strictPattern?: boolean }): string | null {
  const filename = typeof req.body?.filename === "string"
    ? req.body.filename.trim()
    : typeof req.query?.file === "string"
      ? req.query.file.trim()
      : null;
  if (!filename || filename.includes("..") || filename.includes("/")) return null;
  if (options?.strictPattern && !BACKUP_FILENAME_RE.test(filename)) return null;
  return filename;
}

async function getFirebaseBucket() {
  const { getStorage } = await import("firebase-admin/storage");
  return getStorage().bucket(process.env.FIREBASE_STORAGE_BUCKET || undefined);
}

function normalizeVersion(payload: unknown): string {
  if (payload && typeof payload === "object" && "version" in payload) {
    const maybeVersion = Number((payload as { version?: unknown }).version);
    if (Number.isFinite(maybeVersion) && maybeVersion > 0) return String(maybeVersion);
  }
  return "1";
}

function computeChecksum(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

async function trimRetention(bucket: Awaited<ReturnType<typeof getFirebaseBucket>>, userId: string): Promise<void> {
  const prefix = `${userId}/${PREFIX}/`;
  const [files] = await bucket.getFiles({ prefix, maxResults: 200 });
  const realFiles = files.filter((f) => f.name !== prefix && !f.name.endsWith("/"));
  if (realFiles.length <= MAX_BACKUPS_PER_USER) return;
  const sorted = [...realFiles].sort((a, b) => {
    const at = Date.parse(a.metadata?.timeCreated || "0");
    const bt = Date.parse(b.metadata?.timeCreated || "0");
    return bt - at;
  });
  const stale = sorted.slice(MAX_BACKUPS_PER_USER);
  await Promise.allSettled(stale.map((file) => file.delete()));
}

export async function listHandler(req: Request, res: Response): Promise<void> {
  const token = getAccessToken(req);
  if (!token) {
    res.status(401).json({ error: "Missing or invalid Authorization" });
    return;
  }
  const userId = await getSupabaseUserId(token);
  if (!userId) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    res.status(503).json({ error: "Firebase backup not configured" });
    return;
  }
  try {
    await ensureFirebase();
    const bucket = await getFirebaseBucket();
    const prefix = `${userId}/${PREFIX}/`;
    const [files] = await bucket.getFiles({ prefix, maxResults: 100 });
    const list = files
      .filter((f) => f.name !== prefix && !f.name.endsWith("/"))
      .map((f) => {
        const name = f.name.slice(prefix.length);
        const sizeBytes = Number(f.metadata?.size || 0);
        const custom = f.metadata?.metadata || {};
        return {
          name,
          createdAt: f.metadata?.timeCreated ?? undefined,
          sizeBytes,
          checksum: custom.checksum || "",
          version: custom.version || "1",
        };
      })
      .sort((a, b) => Date.parse(b.createdAt || "0") - Date.parse(a.createdAt || "0"));
    res.json({ files: list });
  } catch (e) {
    console.error("[backup] list error:", e);
    res.status(500).json({ error: "Failed to list backups" });
  }
}

export async function uploadHandler(req: Request, res: Response): Promise<void> {
  const token = getAccessToken(req);
  if (!token) {
    res.status(401).json({ error: "Missing or invalid Authorization" });
    return;
  }
  const userId = await getSupabaseUserId(token);
  if (!userId) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    res.status(503).json({ error: "Firebase backup not configured" });
    return;
  }
  const filename = getFilename(req, { strictPattern: true });
  const data = req.body?.data;
  if (!filename) {
    res.status(400).json({ error: "Invalid filename. Use trade-marathon-backup-v<version>-YYYYMMDDTHHmmssZ.json" });
    return;
  }
  const body = typeof data === "string" ? data : JSON.stringify(data ?? {});
  const checksum = computeChecksum(body);
  const sizeBytes = Buffer.byteLength(body, "utf8");
  let version = "1";
  try {
    version = normalizeVersion(JSON.parse(body));
  } catch {
    // Keep default.
  }
  try {
    await ensureFirebase();
    const bucket = await getFirebaseBucket();
    const file = bucket.file(storagePath(userId, filename));
    await file.save(body, {
      contentType: "application/json",
      metadata: {
        contentType: "application/json",
        metadata: {
          checksum,
          version,
        },
      },
    });
    await trimRetention(bucket, userId);
    res.json({ ok: true, filename, checksum, sizeBytes, version });
  } catch (e) {
    console.error("[backup] upload error:", e);
    res.status(500).json({ error: "Failed to upload backup" });
  }
}

export async function downloadHandler(req: Request, res: Response): Promise<void> {
  const token = getAccessToken(req);
  if (!token) {
    res.status(401).json({ error: "Missing or invalid Authorization" });
    return;
  }
  const userId = await getSupabaseUserId(token);
  if (!userId) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    res.status(503).json({ error: "Firebase backup not configured" });
    return;
  }
  const filename = getFilename(req);
  if (!filename) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }
  try {
    await ensureFirebase();
    const bucket = await getFirebaseBucket();
    const file = bucket.file(storagePath(userId, filename));
    const [exists] = await file.exists();
    if (!exists) {
      res.status(404).json({ error: "Backup not found" });
      return;
    }
    const [metadata] = await file.getMetadata();
    const [contents] = await file.download();
    res.setHeader("Content-Type", "application/json");
    const checksumHeader = metadata.metadata?.checksum;
    res.setHeader(
      "X-Backup-Checksum",
      typeof checksumHeader === "string" || typeof checksumHeader === "number"
        ? String(checksumHeader)
        : ""
    );
    res.send(contents);
  } catch (e) {
    console.error("[backup] download error:", e);
    res.status(500).json({ error: "Failed to download backup" });
  }
}

export async function deleteHandler(req: Request, res: Response): Promise<void> {
  const token = getAccessToken(req);
  if (!token) {
    res.status(401).json({ error: "Missing or invalid Authorization" });
    return;
  }
  const userId = await getSupabaseUserId(token);
  if (!userId) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    res.status(503).json({ error: "Firebase backup not configured" });
    return;
  }
  const filename = getFilename(req);
  if (!filename) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }
  try {
    await ensureFirebase();
    const bucket = await getFirebaseBucket();
    const file = bucket.file(storagePath(userId, filename));
    const [exists] = await file.exists();
    if (!exists) {
      res.status(404).json({ error: "Backup not found" });
      return;
    }
    await file.delete();
    res.json({ ok: true });
  } catch (e) {
    console.error("[backup] delete error:", e);
    res.status(500).json({ error: "Failed to delete backup" });
  }
}
