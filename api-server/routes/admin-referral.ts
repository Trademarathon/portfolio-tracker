/**
 * Builder-only admin referral routes: Bybit affiliate user list, verify referral and grant subscription.
 * Requires Authorization: Bearer <jwt> and caller must be builder.
 */

import type { Request, Response } from "express";
import crypto from "crypto";

const BUILDER_EMAIL = process.env.BUILDER_EMAIL ?? process.env.NEXT_PUBLIC_BUILDER_EMAIL;
const BUILDER_USER_ID = process.env.BUILDER_USER_ID ?? process.env.NEXT_PUBLIC_BUILDER_USER_ID;
const BYBIT_AFFILIATE_BASE = process.env.BYBIT_API_BASE_URL ?? "https://api.bybit.com";
const REFERRAL_MIN_VOLUME_30D_USDT = parseInt(String(process.env.REFERRAL_MIN_VOLUME_30D_USDT || "500"), 10) || 500;

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

function bybitSign(apiKey: string, secret: string, timestamp: string, recvWindow: string, queryString: string): string {
  const toSign = timestamp + apiKey + recvWindow + queryString;
  return crypto.createHmac("sha256", secret).update(toSign).digest("hex");
}

async function fetchBybitAffiliateUserList(): Promise<
  { userId: string; registerTime?: string; tradeVol30Day?: string; tradeVol365Day?: string; depositAmount30Day?: string }[]
> {
  const apiKey = process.env.BYBIT_AFFILIATE_API_KEY;
  const secret = process.env.BYBIT_AFFILIATE_API_SECRET;
  if (!apiKey || !secret) return [];
  const recvWindow = "5000";
  const timestamp = String(Date.now());
  const params = new URLSearchParams({ need30: "true", need365: "true", needDeposit: "true", size: "1000" });
  const queryString = params.toString();
  const sign = bybitSign(apiKey, secret, timestamp, recvWindow, queryString);
  const url = `${BYBIT_AFFILIATE_BASE}/v5/affiliate/aff-user-list?${queryString}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-BAPI-API-KEY": apiKey,
      "X-BAPI-TIMESTAMP": timestamp,
      "X-BAPI-SIGN": sign,
      "X-BAPI-RECV-WINDOW": recvWindow,
    },
  });
  if (!res.ok) throw new Error(`Bybit API ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { retCode?: number; retMsg?: string; result?: { list?: unknown[] } };
  if (json.retCode !== 0) throw new Error(json.retMsg ?? "Bybit API error");
  const list = json.result?.list ?? [];
  return list.map((item) => {
    const row = (item ?? {}) as Record<string, unknown>;
    return {
    userId: String(row.userId ?? ""),
    registerTime: typeof row.registerTime === "string" ? row.registerTime : undefined,
    tradeVol30Day: typeof row.tradeVol30Day === "string" ? row.tradeVol30Day : undefined,
    tradeVol365Day: typeof row.tradeVol365Day === "string" ? row.tradeVol365Day : undefined,
    depositAmount30Day: typeof row.depositAmount30Day === "string" ? row.depositAmount30Day : undefined,
    };
  });
}

/** GET /api/admin/referral/bybit-users — list referred users from Bybit Affiliate API with volumes */
export async function bybitUsersHandler(req: Request, res: Response): Promise<void> {
  const caller = await requireBuilder(req, res);
  if (!caller) return;
  try {
    const list = await fetchBybitAffiliateUserList();
    res.json({ users: list, minVolume30dUsdt: REFERRAL_MIN_VOLUME_30D_USDT });
  } catch (e) {
    console.error("[admin-referral] bybit-users error:", e);
    res.status(502).json({ error: (e as Error).message });
  }
}

/** POST /api/admin/referral/verify — verify bybitUid is in affiliate list, check volume, grant subscription and optionally link */
export async function verifyHandler(req: Request, res: Response): Promise<void> {
  const caller = await requireBuilder(req, res);
  if (!caller) return;
  const body = req.body ?? {};
  const appUserId = typeof body.appUserId === "string" ? body.appUserId.trim() : null;
  const bybitUid = typeof body.bybitUid === "string" ? body.bybitUid.trim() : null;
  const minVolume = typeof body.minVolume30dUsdt === "number" ? body.minVolume30dUsdt : REFERRAL_MIN_VOLUME_30D_USDT;
  if (!appUserId || !bybitUid) {
    res.status(400).json({ error: "Missing appUserId or bybitUid" });
    return;
  }
  const supabase = await getSupabaseAdmin();
  if (!supabase) {
    res.status(503).json({ error: "Supabase not configured" });
    return;
  }
  try {
    const list = await fetchBybitAffiliateUserList();
    const ref = list.find((u) => u.userId === bybitUid);
    if (!ref) {
      res.status(404).json({ error: "Bybit UID not found in your affiliate list" });
      return;
    }
    const vol30 = parseFloat(ref.tradeVol30Day ?? "0") || 0;
    if (vol30 < minVolume) {
      res.status(400).json({
        error: `Volume too low: ${vol30} USDT (30d). Minimum required: ${minVolume} USDT`,
        tradeVol30Day: vol30,
        minRequired: minVolume,
      });
      return;
    }
    const now = new Date();
    const endDate = new Date(now);
    endDate.setFullYear(endDate.getFullYear() + 1);
    const startDateStr = now.toISOString().slice(0, 10);
    const endDateStr = endDate.toISOString().slice(0, 10);
    const subscribedAt = now.toISOString();

    await supabase.from("user_subscriptions").upsert(
      {
        user_id: appUserId,
        plan: "referral_free",
        subscribed_at: subscribedAt,
        start_date: startDateStr,
        end_date: endDateStr,
        updated_at: subscribedAt,
      },
      { onConflict: "user_id" }
    );

    const vol365 = parseFloat(ref.tradeVol365Day ?? "0") || 0;
    await supabase.from("user_referral_verification").upsert(
      {
        user_id: appUserId,
        exchange: "bybit",
        exchange_uid: bybitUid,
        referral_volume_30d_usdt: vol30,
        referral_volume_365d_usdt: vol365,
        last_verified_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      { onConflict: "user_id,exchange" }
    );

    res.json({
      ok: true,
      appUserId,
      bybitUid,
      tradeVol30Day: vol30,
      tradeVol365Day: vol365,
      plan: "referral_free",
      end_date: endDateStr,
    });
  } catch (e) {
    console.error("[admin-referral] verify error:", e);
    res.status(500).json({ error: (e as Error).message });
  }
}

/** GET /api/admin/referral/links — return referral links from env (builder only) */
export async function linksHandler(req: Request, res: Response): Promise<void> {
  const caller = await requireBuilder(req, res);
  if (!caller) return;
  const bybit = process.env.REFERRAL_LINK_BYBIT ?? "";
  const binance = process.env.REFERRAL_LINK_BINANCE ?? "";
  const hyperliquid = process.env.REFERRAL_LINK_HYPERLIQUID ?? "";
  res.json({
    bybit: bybit || null,
    binance: binance || null,
    hyperliquid: hyperliquid || null,
    minVolume30dUsdt: REFERRAL_MIN_VOLUME_30D_USDT,
  });
}
