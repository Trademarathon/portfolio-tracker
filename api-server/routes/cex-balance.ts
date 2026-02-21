import type { Request, Response } from "express";
import crypto from "crypto";
import ccxt from "ccxt";
import { getExchangeInstance } from "../lib/exchange-manager";

type BybitJson = {
  retCode?: number | string;
  retMsg?: string;
  result?: any;
  time?: number;
  [key: string]: any;
};

class BybitRequestError extends Error {
  retCode?: number;
  httpStatus?: number;
  base?: string;
  retMsg?: string;
  constructor(message: string, details: Partial<BybitRequestError> = {}) {
    super(message);
    this.name = "BybitRequestError";
    Object.assign(this, details);
  }
}

const BYBIT_RECV_WINDOW = String(process.env.BYBIT_RECV_WINDOW || "20000");
const BYBIT_TIME_SYNC_TTL_MS = 5 * 60 * 1000;
const bybitTimeOffsetByBase = new Map<string, number>();
const bybitTimeOffsetUpdatedAt = new Map<string, number>();

const BYBIT_UNIFIED_COIN_BATCHES = [
  ["USDT", "USDC", "BTC", "ETH", "SOL", "XRP", "DOGE", "BNB", "TRX", "ADA"],
  ["AVAX", "DOT", "MATIC", "TON", "LINK", "NEAR", "APT", "ARB", "OP", "LTC"],
  ["BUSD", "DAI", "FDUSD", "TUSD", "WETH"],
];

function getBybitBaseUrls(): string[] {
  const fromEnv = String(process.env.BYBIT_API_BASE_URL || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const defaults = [
    "https://api.bybit.com",
    "https://api.bytick.com",
    "https://api-testnet.bybit.com",
  ];
  return [...new Set([...fromEnv, ...defaults])];
}

function parseRetCode(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = parseInt(value, 10);
    if (Number.isFinite(n)) return n;
  }
  return -1;
}

function buildBybitQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const entries = Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== null && String(v).length > 0)
    .sort(([a], [b]) => a.localeCompare(b));
  const search = new URLSearchParams();
  for (const [k, v] of entries) search.set(k, String(v));
  return search.toString();
}

function bybitSign(secret: string, timestamp: string, apiKey: string, recvWindow: string, queryString: string): string {
  const toSign = `${timestamp}${apiKey}${recvWindow}${queryString}`;
  return crypto.createHmac("sha256", secret).update(toSign).digest("hex");
}

function parseBybitServerTimeMs(payload: any): number | null {
  const nano = payload?.result?.timeNano;
  if (nano !== undefined && nano !== null) {
    try {
      const ns = String(nano).trim();
      if (/^\d+$/.test(ns)) {
        if (ns.length <= 6) return 0;
        return parseInt(ns.slice(0, -6), 10);
      }
      const asNumber = Number(ns);
      if (Number.isFinite(asNumber) && asNumber > 0) return Math.floor(asNumber / 1_000_000);
    } catch {
      // ignore
    }
  }
  const sec = payload?.result?.timeSecond;
  if (sec !== undefined && sec !== null) {
    const n = Number(sec);
    if (Number.isFinite(n) && n > 0) return Math.floor(n * 1000);
  }
  const direct = payload?.time;
  if (direct !== undefined && direct !== null) {
    const n = Number(direct);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return null;
}

async function syncBybitServerTime(base: string, force = false): Promise<void> {
  const last = bybitTimeOffsetUpdatedAt.get(base) || 0;
  if (!force && bybitTimeOffsetByBase.has(base) && (Date.now() - last) < BYBIT_TIME_SYNC_TTL_MS) return;
  try {
    const res = await fetch(`${base}/v5/market/time`, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return;
    const payload = await res.json().catch(() => null);
    const serverMs = parseBybitServerTimeMs(payload);
    if (!serverMs) return;
    bybitTimeOffsetByBase.set(base, serverMs - Date.now());
    bybitTimeOffsetUpdatedAt.set(base, Date.now());
  } catch {
    // keep local time as fallback
  }
}

async function bybitSignedGet(
  path: string,
  query: Record<string, string | number | boolean | undefined | null>,
  apiKey: string,
  secret: string
): Promise<BybitJson> {
  const bases = getBybitBaseUrls();
  let lastError: BybitRequestError | null = null;
  let sawForbidden = false;

  for (const base of bases) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await syncBybitServerTime(base, attempt > 0);
        const offset = bybitTimeOffsetByBase.get(base) || 0;
        const timestamp = String(Date.now() + offset);
        const queryString = buildBybitQuery(query);
        const sign = bybitSign(secret, timestamp, apiKey, BYBIT_RECV_WINDOW, queryString);
        const url = `${base}${path}${queryString ? `?${queryString}` : ""}`;
        const response = await fetch(url, {
          method: "GET",
          cache: "no-store",
          headers: {
            "X-BAPI-API-KEY": apiKey,
            "X-BAPI-TIMESTAMP": timestamp,
            "X-BAPI-SIGN": sign,
            "X-BAPI-SIGN-TYPE": "2",
            "X-BAPI-RECV-WINDOW": BYBIT_RECV_WINDOW,
            Accept: "application/json",
          },
        });

        const text = await response.text();
        let payload: BybitJson = {};
        try {
          payload = text ? JSON.parse(text) : {};
        } catch {
          payload = {};
        }
        const retCode = parseRetCode(payload?.retCode);

        if (!response.ok) {
          let msg = `Bybit HTTP ${response.status}`;
          if (payload?.retMsg) msg += `: ${payload.retMsg}`;
          else if (text && text.length < 220) msg += `: ${text}`;
          if (response.status === 403) {
            sawForbidden = true;
            msg += " (possible regional/IP restriction)";
          }
          lastError = new BybitRequestError(msg, {
            base,
            httpStatus: response.status,
            retCode: retCode >= 0 ? retCode : undefined,
            retMsg: payload?.retMsg ? String(payload.retMsg) : undefined,
          });
          break;
        }

        if (retCode === 0) return payload;
        if (retCode === 10002 && attempt === 0) {
          await syncBybitServerTime(base, true);
          continue;
        }

        lastError = new BybitRequestError(`Bybit ${retCode}: ${payload?.retMsg || "Unknown error"}`, {
          base,
          retCode: retCode >= 0 ? retCode : undefined,
          retMsg: payload?.retMsg ? String(payload.retMsg) : undefined,
          httpStatus: response.status,
        });
        break;
      } catch (e: any) {
        lastError = new BybitRequestError(`Bybit request failed: ${e?.message || e}`, { base });
        break;
      }
    }
  }

  if (sawForbidden) {
    throw new BybitRequestError(
      "Bybit returned HTTP 403 (restricted IP region). Bybit docs state US IPs are blocked for API access.",
      { httpStatus: 403 }
    );
  }
  throw lastError || new BybitRequestError("Bybit request failed");
}

function hasAnyBalance(bal: any): boolean {
  if (!bal || typeof bal !== "object") return false;
  const total = bal.total || {};
  if (Object.keys(total).length === 0 && bal.free && bal.used) {
    const free = bal.free || {};
    const used = bal.used || {};
    const all = new Set([...Object.keys(free), ...Object.keys(used)]);
    for (const k of all) {
      const f = typeof free[k] === "string" ? parseFloat(free[k]) : (free[k] || 0);
      const u = typeof used[k] === "string" ? parseFloat(used[k]) : (used[k] || 0);
      if (f + u > 0) return true;
    }
    return false;
  }
  return Object.values(total).some((v: any) => (typeof v === "string" ? parseFloat(v) : v) > 0);
}

function pickBybitError(errors: string[]): string | null {
  if (errors.length === 0) return null;
  const forbidden = errors.find((e) => /HTTP 403|restricted IP|forbidden/i.test(e));
  if (forbidden) return forbidden;
  const auth = errors.find((e) => /10003|10004|10005|invalid api|permission denied|api key|signature/i.test(e));
  return auth || errors[0];
}

function mapBybitAccountType(accountType: string | undefined): "spot" | "swap" | "fund" | null {
  const raw = String(accountType || "").trim().toLowerCase();
  if (!raw) return null;
  if (raw === "spot") return "spot";
  if (raw === "swap" || raw === "contract" || raw === "unified") return "swap";
  if (raw === "fund" || raw === "funding") return "fund";
  return null;
}

export async function balanceHandler(req: Request, res: Response) {
  try {
    const { exchangeId, apiKey, secret, accountType } = req.body;
    if (!exchangeId || !apiKey || !secret) {
      return res.status(400).json({ error: "Missing parameters" });
    }
    if (!(ccxt as any)[exchangeId]) {
      return res.status(400).json({ error: "Invalid exchange" });
    }

    if (exchangeId === "bybit") {
      const requestedType = mapBybitAccountType(accountType);

      const mergedBalance: any = { total: {}, free: {}, used: {}, info: {} };
      const errors: string[] = [];
      const attemptedAccountTypes: string[] = [];

      const mergeBybitRaw = (payload: any, type: string) => {
        const list = payload?.result?.list || [];
        for (const acc of list) {
          const coins = acc?.coin || [];
          for (const c of coins) {
            const sym = c.coin;
            if (!sym) continue;
            // Handle various shapes of balances across Spot/Unified/Fund
            const wallet = parseFloat(c.walletBalance || c.equity || c.free || c.availableToWithdraw || '0');
            const locked = parseFloat(c.locked || c.frozenBalance || '0');

            const totalCoin = wallet + locked;
            if (totalCoin > 0) {
              mergedBalance.total[sym] = (mergedBalance.total[sym] || 0) + totalCoin;
              mergedBalance.free[sym] = (mergedBalance.free[sym] || 0) + wallet;
              mergedBalance.used[sym] = (mergedBalance.used[sym] || 0) + locked;
            }
          }
          // Some accounts just return total wallet balance equity without coin splits.
          const accountTotal = parseFloat(acc?.totalEquity || acc?.totalWalletBalance || '0');
          if (accountTotal > 0 && coins.length === 0) {
            const sym = String(type).toLowerCase() === 'unified' ? 'USDT' : 'USDC';
            mergedBalance.total[sym] = (mergedBalance.total[sym] || 0) + accountTotal;
            mergedBalance.free[sym] = (mergedBalance.free[sym] || 0) + accountTotal;
          }
        }
        mergedBalance.info[type] = payload;
      };

      // Handle specific account type if requested (e.g. from fetchBybitBalanceByType)
      if (requestedType) {
        try {
          const bybitQueryType = requestedType === 'swap' ? 'UNIFIED' : requestedType.toUpperCase();
          attemptedAccountTypes.push(requestedType);
          const res = await bybitSignedGet('/v5/account/wallet-balance', { accountType: bybitQueryType }, apiKey, secret);
          mergeBybitRaw(res, requestedType);

          return res.json({
            ...mergedBalance,
            diagnostics: {
              exchange: "bybit",
              accountTypeRequested: String(accountType),
              accountTypeResolved: requestedType,
              attemptedAccountTypes: [requestedType],
              errors: [],
            },
          });
        } catch (e: any) {
          const message = e?.message || String(e);
          return res.status(502).json({
            error: message,
            diagnostics: {
              exchange: "bybit",
              accountTypeRequested: String(accountType),
              accountTypeResolved: requestedType,
              attemptedAccountTypes: [requestedType],
              errors: [message],
            },
          });
        }
      }

      // 1. Primary Attempt: UNIFIED Trading Account
      try {
        attemptedAccountTypes.push("UNIFIED");
        // Custom implementation `bybitSignedGet` has IP fallback logic & time sync integrated
        const res = await bybitSignedGet('/v5/account/wallet-balance', { accountType: 'UNIFIED' }, apiKey, secret);
        mergeBybitRaw(res, "unified");
      } catch (e: any) {
        errors.push(`UNIFIED: ${e?.message || e}`);
      }

      // 2. Fallback: SPOT (if user hasn't upgraded to Unified Trading Account, this works)
      try {
        attemptedAccountTypes.push("SPOT");
        const res = await bybitSignedGet('/v5/account/wallet-balance', { accountType: 'SPOT' }, apiKey, secret);
        mergeBybitRaw(res, "spot");
      } catch (e: any) {
        errors.push(`SPOT: ${e?.message || e}`);
      }

      // 3. Separate Attempt: FUND (Funding account usually always exists separately)
      try {
        attemptedAccountTypes.push("FUND");
        const res = await bybitSignedGet('/v5/account/wallet-balance', { accountType: 'FUND' }, apiKey, secret);
        mergeBybitRaw(res, "fund");
      } catch (e: any) {
        errors.push(`FUND: ${e?.message || e}`);
      }

      // If completely failed to get anything and have errors (like HTTP 403 or Invalid API keys)
      if (!hasAnyBalance(mergedBalance) && errors.length > 0) {
        const error = pickBybitError(errors);
        if (error) {
          return res.status(502).json({
            error,
            diagnostics: {
              exchange: "bybit",
              attemptedAccountTypes,
              errors
            }
          });
        }
      }

      return res.json({
        ...mergedBalance,
        diagnostics: {
          exchange: "bybit",
          attemptedAccountTypes,
          errors
        }
      });
    }

    const exchange = getExchangeInstance(exchangeId, apiKey, secret);
    const balance = await exchange.fetchBalance();
    res.json({
      ...balance,
      diagnostics: {
        exchange: exchangeId,
      },
    });
  } catch (error: any) {
    console.error("CCXT Error:", error);
    res.status(500).json({ error: error.message });
  }
}
