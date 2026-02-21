/**
 * Builder-only admin routes: list users, storage stats, delete user, notify storage full, subscriptions.
 * All routes require Authorization: Bearer <jwt> and caller must be builder (BUILDER_EMAIL or BUILDER_USER_ID).
 */

import type { Request, Response } from "express";

const BUILDER_EMAIL = process.env.BUILDER_EMAIL ?? process.env.NEXT_PUBLIC_BUILDER_EMAIL ?? "ravi@trademarathon.trade";
const BUILDER_USER_ID = process.env.BUILDER_USER_ID ?? process.env.NEXT_PUBLIC_BUILDER_USER_ID;

function getAccessToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7).trim() || null;
}

async function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function requireBuilder(req: Request, res: Response): Promise<{ userId: string; email?: string } | null> {
  const token = getAccessToken(req);
  if (!token) {
    res.status(401).json({ error: "Missing Authorization" });
    return null;
  }
  const supabase = await getSupabaseAdmin();
  if (!supabase) {
    res.status(503).json({ error: "Supabase not configured" });
    return null;
  }
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return null;
  }
  const isBuilder =
    (BUILDER_USER_ID && user.id === BUILDER_USER_ID) ||
    (BUILDER_EMAIL && user.email?.toLowerCase() === BUILDER_EMAIL.toLowerCase());
  if (!isBuilder) {
    res.status(403).json({ error: "Builder only" });
    return null;
  }
  return { userId: user.id, email: user.email };
}

type AdminUser = {
  id: string;
  email?: string | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
};

function toAdminUser(value: unknown): AdminUser | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || !row.id) return null;
  return {
    id: row.id,
    email: typeof row.email === "string" ? row.email : row.email == null ? null : null,
    created_at: typeof row.created_at === "string" ? row.created_at : row.created_at == null ? null : null,
    last_sign_in_at: typeof row.last_sign_in_at === "string" ? row.last_sign_in_at : row.last_sign_in_at == null ? null : null,
  };
}

function getParamValue(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export async function usersHandler(req: Request, res: Response): Promise<void> {
  const caller = await requireBuilder(req, res);
  if (!caller) return;
  const supabase = await getSupabaseAdmin();
  if (!supabase) {
    res.status(503).json({ error: "Supabase not configured" });
    return;
  }
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const perPage = Math.min(100, Math.max(1, parseInt(String(req.query.per_page || "50"), 10)));
    const listResult = await supabase.auth.admin.listUsers({ page, perPage });
    if (listResult.error) {
      res.status(502).json({ error: listResult.error.message });
      return;
    }
    const data = listResult.data as { users?: { id: string; email?: string | null; created_at?: string | null; last_sign_in_at?: string | null }[] } | null;
    const users = data?.users ?? [];
    const userIds = users.map((u) => u.id).filter(Boolean);
    const subscriptions: Record<string, { plan: string | null; subscribed_at: string | null; start_date: string | null; end_date: string | null }> = {};
    if (userIds.length > 0) {
      try {
        const { data: subRows } = await supabase
          .from("user_subscriptions")
          .select("user_id, plan, subscribed_at, start_date, end_date")
          .in("user_id", userIds);
        for (const row of subRows ?? []) {
          subscriptions[row.user_id] = {
            plan: row.plan ?? null,
            subscribed_at: row.subscribed_at ?? null,
            start_date: row.start_date ?? null,
            end_date: row.end_date ?? null,
          };
        }
      } catch (_) {
        // table may not exist
      }
    }
    const list = users.map((u) => ({
      id: u.id,
      email: u.email ?? null,
      created_at: u.created_at ?? null,
      last_sign_in_at: u.last_sign_in_at ?? null,
      subscription: subscriptions[u.id] ?? null,
    }));
    res.json({ users: list, page, perPage });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[admin] users error:", e);
    res.status(502).json({ error: "Failed to list users", details: msg });
  }
}

export async function storageHandler(req: Request, res: Response): Promise<void> {
  const caller = await requireBuilder(req, res);
  if (!caller) return;
  const supabase = await getSupabaseAdmin();
  if (!supabase) {
    res.status(503).json({ error: "Supabase not configured" });
    return;
  }

  const bytesByUser: Record<string, number> = {};
  const rowsByUser: Record<string, number> = {};
  const subByUser: Record<string, { plan: string | null; subscribed_at: string | null; start_date: string | null; end_date: string | null }> = {};
  let userList: { id: string; email?: string | null; created_at?: string | null; last_sign_in_at?: string | null }[] = [];

  try {
    const listResult = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const authError = listResult.error;
    if (authError) {
      res.status(502).json({ error: authError.message });
      return;
    }
    const data = listResult.data as { users?: unknown[] } | null;
    const raw = data?.users ?? data;
    userList = (Array.isArray(raw) ? raw : []).map(toAdminUser).filter((u): u is AdminUser => !!u);
  } catch (authErr) {
    console.error("[admin] listUsers error:", authErr);
    res.status(502).json({
      error: "Could not list users",
      details: authErr instanceof Error ? authErr.message : String(authErr),
    });
    return;
  }

  const userIds = userList.map((u) => u.id);

  if (userIds.length > 0) {
    try {
      const { data: userDataRows, error: userDataErr } = await supabase.from("user_data").select("user_id, key, payload").in("user_id", userIds);
      if (!userDataErr && userDataRows) {
        for (const row of userDataRows) {
          const uid = row.user_id;
          rowsByUser[uid] = (rowsByUser[uid] ?? 0) + 1;
          try {
            const size = typeof row.payload === "string" ? row.payload.length : JSON.stringify(row.payload).length;
            bytesByUser[uid] = (bytesByUser[uid] ?? 0) + size;
          } catch {
            bytesByUser[uid] = (bytesByUser[uid] ?? 0) + 0;
          }
        }
      }
    } catch (_) {
      // ignore; tables may not exist yet
    }

    try {
      const { data: subRows, error: subErr } = await supabase
        .from("user_subscriptions")
        .select("user_id, plan, subscribed_at, start_date, end_date")
        .in("user_id", userIds);
      if (!subErr && subRows) {
        for (const row of subRows) {
          subByUser[row.user_id] = {
            plan: row.plan ?? null,
            subscribed_at: row.subscribed_at ?? null,
            start_date: row.start_date ?? null,
            end_date: row.end_date ?? null,
          };
        }
      }
    } catch (_) {
      // ignore; table may not exist yet
    }
  }

  const firebaseByUser: Record<string, number> = {};
  if (userIds.length > 0 && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    try {
      const { getStorage } = await import("firebase-admin/storage");
      const { initializeApp, getApps, cert } = await import("firebase-admin/app");
      if (getApps().length === 0) {
        initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
          }),
        });
      }
      const bucket = getStorage().bucket(process.env.FIREBASE_STORAGE_BUCKET || undefined);
      for (const uid of userIds) {
        try {
          const [files] = await bucket.getFiles({ prefix: `${uid}/`, maxResults: 500 });
          let total = 0;
          for (const f of files) {
            const [meta] = await f.getMetadata().catch(() => [{}]);
            total += Number((meta as { size?: string }).size ?? 0);
          }
          firebaseByUser[uid] = total;
        } catch {
          firebaseByUser[uid] = 0;
        }
      }
    } catch (e) {
      console.error("[admin] Firebase storage error:", e);
    }
  }

  try {
    let totalSupabaseBytes = 0;
    let totalFirebaseBytes = 0;
    const usersWithStats = userList.map((u) => {
      const supabaseBytes = bytesByUser[u.id] ?? 0;
      const firebaseBytes = firebaseByUser[u.id] ?? 0;
      totalSupabaseBytes += supabaseBytes;
      totalFirebaseBytes += firebaseBytes;
      return {
        userId: u.id,
        email: u.email ?? null,
        created_at: u.created_at ?? null,
        last_sign_in_at: u.last_sign_in_at ?? null,
        supabaseRows: rowsByUser[u.id] ?? 0,
        supabaseBytes,
        firebaseBytes,
        subscription: subByUser[u.id] ?? null,
      };
    });

    res.json({
      users: usersWithStats,
      totalSupabaseBytes,
      totalFirebaseBytes,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[admin] storage response error:", e);
    res.status(502).json({ error: "Failed to build storage response", details: msg });
  }
}

export async function deleteUserHandler(req: Request, res: Response): Promise<void> {
  const caller = await requireBuilder(req, res);
  if (!caller) return;
  const userId = getParamValue(req.params.userId as string | string[] | undefined);
  if (!userId) {
    res.status(400).json({ error: "Missing userId" });
    return;
  }
  const supabase = await getSupabaseAdmin();
  if (!supabase) {
    res.status(503).json({ error: "Supabase not configured" });
    return;
  }
  try {
    await supabase.auth.admin.deleteUser(userId);
  } catch (e) {
    console.error("[admin] deleteUser error:", e);
    res.status(502).json({ error: (e as Error).message });
    return;
  }
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    try {
      const { getStorage } = await import("firebase-admin/storage");
      const { initializeApp, getApps, cert } = await import("firebase-admin/app");
      if (getApps().length === 0) {
        initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
          }),
        });
      }
      const bucket = getStorage().bucket(process.env.FIREBASE_STORAGE_BUCKET || undefined);
      const prefix = `${userId}/`;
      const [files] = await bucket.getFiles({ prefix });
      for (const f of files) {
        await f.delete().catch(() => {});
      }
    } catch (e) {
      console.error("[admin] Firebase delete error:", e);
    }
  }
  res.status(204).send();
}

const STORAGE_FULL_KEY = "_admin_storage_full_notice";

export async function notifyStorageFullHandler(req: Request, res: Response): Promise<void> {
  const caller = await requireBuilder(req, res);
  if (!caller) return;
  const userId = getParamValue(req.params.userId as string | string[] | undefined);
  if (!userId) {
    res.status(400).json({ error: "Missing userId" });
    return;
  }
  const supabase = await getSupabaseAdmin();
  if (!supabase) {
    res.status(503).json({ error: "Supabase not configured" });
    return;
  }
  const { error } = await supabase.from("user_data").upsert(
    {
      user_id: userId,
      key: STORAGE_FULL_KEY,
      payload: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,key" }
  );
  if (error) {
    res.status(502).json({ error: error.message });
    return;
  }
  res.json({ ok: true });
}

export async function clearStorageFullHandler(req: Request, res: Response): Promise<void> {
  const caller = await requireBuilder(req, res);
  if (!caller) return;
  const userId = getParamValue(req.params.userId as string | string[] | undefined);
  if (!userId) {
    res.status(400).json({ error: "Missing userId" });
    return;
  }
  const supabase = await getSupabaseAdmin();
  if (!supabase) {
    res.status(503).json({ error: "Supabase not configured" });
    return;
  }
  await supabase.from("user_data").delete().eq("user_id", userId).eq("key", STORAGE_FULL_KEY);
  res.status(204).send();
}

export async function getSubscriptionHandler(req: Request, res: Response): Promise<void> {
  const caller = await requireBuilder(req, res);
  if (!caller) return;
  const userId = req.params.userId;
  if (!userId) {
    res.status(400).json({ error: "Missing userId" });
    return;
  }
  const supabase = await getSupabaseAdmin();
  if (!supabase) {
    res.status(503).json({ error: "Supabase not configured" });
    return;
  }
  const { data, error } = await supabase.from("user_subscriptions").select("*").eq("user_id", userId).maybeSingle();
  if (error) {
    res.status(502).json({ error: error.message });
    return;
  }
  res.json(data ?? null);
}

export async function putSubscriptionHandler(req: Request, res: Response): Promise<void> {
  const caller = await requireBuilder(req, res);
  if (!caller) return;
  const userId = req.params.userId;
  if (!userId) {
    res.status(400).json({ error: "Missing userId" });
    return;
  }
  const body = req.body ?? {};
  const plan = typeof body.plan === "string" ? body.plan : null;
  const subscribed_at = typeof body.subscribed_at === "string" ? body.subscribed_at : null;
  const start_date = typeof body.start_date === "string" ? body.start_date : null;
  const end_date = typeof body.end_date === "string" ? body.end_date : null;
  const supabase = await getSupabaseAdmin();
  if (!supabase) {
    res.status(503).json({ error: "Supabase not configured" });
    return;
  }
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("user_subscriptions")
    .upsert(
      {
        user_id: userId,
        plan: plan ?? undefined,
        subscribed_at: subscribed_at ?? undefined,
        start_date: start_date ?? undefined,
        end_date: end_date ?? undefined,
        updated_at: now,
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();
  if (error) {
    res.status(502).json({ error: error.message });
    return;
  }
  res.json(data);
}
