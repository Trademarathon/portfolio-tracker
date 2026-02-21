import type { Request, Response } from "express";
import type { Transaction } from "../../src/lib/api/types";
import { fetchBybitTradesWithFallback } from "../lib/bybit-trades";
import { getExchangeInstance } from "../lib/exchange-manager";
import { normalizeSymbol } from "../lib/normalization";

const HYPERLIQUID_INFO_API = "https://api.hyperliquid.xyz/info";

type SyncOptions = {
  mode?: "realtime" | "manual";
  bybitDaysBack?: number;
  bybitSymbolsLimit?: number;
  bybitPageLimitPerWindow?: number;
};

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

async function hlInfo<T>(payload: Record<string, unknown>): Promise<T | null> {
  try {
    const response = await fetch(HYPERLIQUID_INFO_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

let hlAssetCache: Record<string, string> = {};
let hlCacheTimestamp = 0;
const HL_CACHE_TTL = 5 * 60 * 1000;

async function getHyperliquidAssetMap(): Promise<Record<string, string>> {
  const now = Date.now();
  if (Object.keys(hlAssetCache).length > 0 && now - hlCacheTimestamp < HL_CACHE_TTL) {
    return hlAssetCache;
  }
  try {
    const meta = await hlInfo<{ universe?: Array<{ name?: string }> }>({ type: "meta" });
    if (!meta) return hlAssetCache;
    const assetMap: Record<string, string> = {};
    if (meta.universe) {
      meta.universe.forEach((asset: any, index: number) => {
        assetMap[String(index)] = asset.name;
        assetMap[`@${index}`] = asset.name;
      });
    }
    try {
      const spotMeta = await hlInfo<{ tokens?: Array<{ index?: number; name?: string }> }>({ type: "spotMeta" });
      if (spotMeta?.tokens) {
        spotMeta.tokens.forEach((token: any) => {
          if (token.index !== undefined) {
            // Keep universe mapping priority to avoid spot-index collisions
            // that can mislabel perp fills (e.g. BTC becoming a random token name).
            const indexKey = String(token.index);
            const atKey = `@${token.index}`;
            if (!assetMap[indexKey]) assetMap[indexKey] = token.name;
            if (!assetMap[atKey]) assetMap[atKey] = token.name;
          }
        });
      }
    } catch { }
    hlAssetCache = assetMap;
    hlCacheTimestamp = now;
    return assetMap;
  } catch (e) {
    console.error("Failed to fetch Hyperliquid asset metadata", e);
    return hlAssetCache;
  }
}

async function fetchHyperliquidHistory(user: string): Promise<Transaction[]> {
  try {
    const assetMap = await getHyperliquidAssetMap();
    const fills = await hlInfo<any[]>({ type: "userFills", user });
    if (!Array.isArray(fills)) return [];
    return fills.map((f: any) => {
      let symbol = f.coin;
      if (symbol?.startsWith("@")) {
        symbol = assetMap[symbol] || assetMap[symbol.substring(1)] || symbol;
      } else if (symbol && /^\d+$/.test(symbol)) {
        symbol = assetMap[symbol] || assetMap[`@${symbol}`] || symbol;
      }
      return {
        id: f.hash || `hl-${f.oid}`,
        symbol: normalizeSymbol(symbol),
        rawSymbol: f.coin,
        side: f.side === "B" ? "buy" : "sell",
        price: parseFloat(f.px),
        amount: parseFloat(f.sz),
        timestamp: f.time,
        exchange: "Hyperliquid",
        pnl: parseFloat(f.closedPnl || "0"),
        status: "closed",
        notes: f.dir,
      };
    });
  } catch (e) {
    console.error("Hyperliquid Sync Error", e);
    return [];
  }
}

export async function syncHandler(req: Request, res: Response) {
  try {
    let keys: any = {};
    let options: SyncOptions = {};
    try {
      keys = req.body?.keys || {};
      options = (req.body?.options && typeof req.body.options === "object" ? req.body.options : {}) as SyncOptions;
    } catch { }

    const isRealtime = options.mode === "realtime";
    const bybitDaysBack = clampInt(options.bybitDaysBack, 1, 60, isRealtime ? 7 : 30);
    const bybitSymbolsLimit = clampInt(options.bybitSymbolsLimit, 5, 80, isRealtime ? 20 : 60);
    const bybitPageLimitPerWindow = clampInt(options.bybitPageLimitPerWindow, 1, 10, isRealtime ? 3 : 10);

    const trades: Transaction[] = [];
    const connectedExchanges: string[] = [];
    const diagnostics: Record<string, { status: "ok" | "empty" | "error"; message?: string; trades?: number; errors?: string[] }> = {};

    if (keys.hyperliquidWallet) {
      const hlTrades = await fetchHyperliquidHistory(keys.hyperliquidWallet);
      trades.push(...hlTrades);
      if (hlTrades.length > 0) connectedExchanges.push("hyperliquid");
      diagnostics.hyperliquid = {
        status: hlTrades.length > 0 ? "ok" : "empty",
        trades: hlTrades.length,
      };
    }

    if (keys.binanceApiKey && keys.binanceSecret) {
      try {
        const binance = getExchangeInstance('binance', keys.binanceApiKey, keys.binanceSecret);
        let binanceTradesFound = false;

        // Prefer account-wide recent trades first.
        try {
          const recent = await binance.fetchMyTrades(undefined, undefined, 100);
          const parsedRecent = recent.map((t: any) => ({
            id: `binance-${t.id ?? `${t.symbol}-${t.timestamp}`}`,
            symbol: normalizeSymbol(t.symbol),
            rawSymbol: t.symbol,
            side: t.side as "buy" | "sell",
            price: t.price,
            amount: t.amount,
            timestamp: t.timestamp,
            exchange: "Binance",
            pnl: 0,
            status: "closed",
          }));
          if (parsedRecent.length > 0) {
            binanceTradesFound = true;
            trades.push(...(parsedRecent as Transaction[]));
          }
        } catch {
          // continue into symbol fallback below
        }

        if (!binanceTradesFound) {
          const symbols = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT", "SUI/USDT", "DOGE/USDT"];
          await Promise.allSettled(
            symbols.map(async (sym) => {
              const myTrades = await binance.fetchMyTrades(sym, undefined, 30);
              const parsed = myTrades.map((t: any) => ({
                id: `binance-${t.id ?? `${t.symbol}-${t.timestamp}`}`,
                symbol: normalizeSymbol(t.symbol),
                rawSymbol: t.symbol,
                side: t.side as "buy" | "sell",
                price: t.price,
                amount: t.amount,
                timestamp: t.timestamp,
                exchange: "Binance",
                pnl: 0,
                status: "closed",
              }));
              if (parsed.length > 0) binanceTradesFound = true;
              trades.push(...(parsed as Transaction[]));
            })
          );
        }
        if (binanceTradesFound) connectedExchanges.push("binance");
      } catch (e) {
        console.error("Binance Sync Error", e);
        diagnostics.binance = {
          status: "error",
          message: e instanceof Error ? e.message : String(e),
        };
      }
      if (!diagnostics.binance) {
        const binanceCount = trades.filter((t) => String(t.exchange || "").toLowerCase() === "binance").length;
        diagnostics.binance = {
          status: binanceCount > 0 ? "ok" : "empty",
          trades: binanceCount,
        };
      }
    }

    if (keys.bybitApiKey && keys.bybitSecret) {
      try {
        const bybit = getExchangeInstance('bybit', keys.bybitApiKey, keys.bybitSecret);
        const targetPairs = new Set<string>([
          "BTC/USDT",
          "ETH/USDT",
          "SOL/USDT",
          "XRP/USDT",
          "DOGE/USDT",
          "SUI/USDT",
          "BNB/USDT",
          "TON/USDT",
        ]);
        try {
          const balance = await bybit.fetchBalance();
          const activeAssets = Object.keys(balance?.total || {}).filter((asset) => (balance.total as any)[asset] > 0);
          activeAssets.forEach((asset) => {
            if (asset !== "USDT" && asset !== "USDC") {
              targetPairs.add(`${asset}/USDT`);
              targetPairs.add(`${asset}/USDT:USDT`);
            }
          });
        } catch {
          // non-fatal
        }
        try {
          const openOrders = await bybit.fetchOpenOrders();
          (openOrders || []).forEach((o: any) => {
            if (o?.symbol) targetPairs.add(String(o.symbol));
          });
        } catch {
          // non-fatal
        }

        const bybitResult = await fetchBybitTradesWithFallback({
          apiKey: keys.bybitApiKey,
          secret: keys.bybitSecret,
          symbols: Array.from(targetPairs).slice(0, bybitSymbolsLimit),
          daysBack: bybitDaysBack,
          pageLimitPerWindow: bybitPageLimitPerWindow,
        });
        trades.push(...(bybitResult.trades as Transaction[]));
        if (bybitResult.trades.length > 0) connectedExchanges.push("bybit");
        diagnostics.bybit = {
          status: bybitResult.trades.length > 0 ? "ok" : "empty",
          trades: bybitResult.trades.length,
          errors: bybitResult.diagnostics.errors.slice(0, 8),
          message:
            bybitResult.trades.length === 0 && bybitResult.diagnostics.errors.length > 0
              ? bybitResult.diagnostics.errors[0]
              : undefined,
        };
      } catch (e) {
        console.error("Bybit Sync Error", e);
        diagnostics.bybit = {
          status: "error",
          message: e instanceof Error ? e.message : String(e),
        };
      }
    }

    // Deduplicate by id/symbol/timestamp to avoid multi-mode duplicates.
    const deduped = Array.from(
      new Map(
        trades.map((t) => [
          String(t.id || `${t.exchange}-${t.symbol}-${t.timestamp}-${t.side}-${t.amount}`),
          t,
        ])
      ).values()
    );

    res.json({
      trades: deduped.sort((a, b) => b.timestamp - a.timestamp),
      exchanges: connectedExchanges,
      syncedAt: Date.now(),
      diagnostics,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
