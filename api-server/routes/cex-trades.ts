import type { Request, Response } from "express";

import { getExchangeInstance } from "../lib/exchange-manager";
import { normalizeSymbol } from "../lib/normalization";
import { fetchBybitTradesWithFallback } from "../lib/bybit-trades";

const expandedPairs = [
  "BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT", "ADA/USDT", "DOGE/USDT", "AVAX/USDT",
  "TRX/USDT", "DOT/USDT", "LINK/USDT", "MATIC/USDT", "LTC/USDT", "BCH/USDT", "NEAR/USDT", "UNI/USDT",
  "ICP/USDT", "LEO/USDT", "DAI/USDT", "ETC/USDT", "FIL/USDT", "APT/USDT", "ATOM/USDT", "IMX/USDT",
  "STX/USDT", "HBAR/USDT", "ARB/USDT", "VET/USDT", "OP/USDT", "RNDR/USDT", "INJ/USDT", "GRT/USDT",
  "PEPE/USDT", "WIF/USDT", "BONK/USDT", "FLOKI/USDT", "SHIB/USDT", "SUI/USDT", "SEI/USDT", "TIA/USDT",
  "BRETT/USDT", "MOG/USDT", "SPX/USDT", "POPCAT/USDT", "MEW/USDT", "JUP/USDT", "PYTH/USDT",
];

function classifyTrade(item: any, exchange: string): { instrumentType: 'future' | 'crypto'; marketType: 'perp' | 'future' | 'spot' } {
  const rawSymbol = String(item?.symbol || item?.info?.symbol || "").toUpperCase();
  const hint = [
    item?.marketType,
    item?.category,
    item?.contractType,
    item?.type,
    item?.info?.category,
    item?.info?.marketType,
    item?.info?.instType,
  ]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase())
    .join(" ");

  const isDerivative =
    exchange === "hyperliquid" ||
    /PERP|SWAP|FUTURES|CONTRACT|:USDT|:USD|USDTM|UMCBL|DMCBL/i.test(rawSymbol) ||
    /(perp|swap|future|futures|linear|inverse|contract|derivative)/i.test(hint) ||
    item?.leverage !== undefined ||
    item?.info?.positionIdx !== undefined;

  if (isDerivative) {
    const marketType = /(future|futures|contract)/i.test(hint) ? "future" : "perp";
    return { instrumentType: "future", marketType };
  }
  return { instrumentType: "crypto", marketType: "spot" };
}

export async function tradesHandler(req: Request, res: Response) {
  try {
    const exchange = req.body?.exchange ?? req.body?.exchangeId;
    const { apiKey, secret } = req.body;
    if (!exchange || !apiKey || !secret) {
      return res.status(400).json({ error: "Missing credentials" });
    }
    const makeClient = (opts: any = {}) => getExchangeInstance(exchange, apiKey, secret, opts);
    let client: any;
    try {
      client = makeClient();
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }

    // Shared Bybit trade fetch path used by both /api/cex/trades and /api/journal/sync.
    if (exchange === "bybit") {
      const targetPairs = new Set<string>(expandedPairs);
      try {
        const balance = await client.fetchBalance();
        const activeAssets = Object.keys(balance?.total || {}).filter((asset) => (balance.total as any)[asset] > 0);
        activeAssets.forEach((asset) => {
          if (asset !== "USDT" && asset !== "USDC") {
            targetPairs.add(`${asset}/USDT`);
            targetPairs.add(`${asset}/USDT:USDT`);
          }
        });
      } catch (_e) {
        // non-fatal
      }
      try {
        const openOrders = await client.fetchOpenOrders();
        (openOrders || []).forEach((o: any) => {
          if (o?.symbol) targetPairs.add(String(o.symbol));
        });
      } catch (_e) {
        // non-fatal
      }

      const { trades, diagnostics } = await fetchBybitTradesWithFallback({
        apiKey,
        secret,
        symbols: Array.from(targetPairs).slice(0, 60),
      });

      return res.json({ trades, diagnostics });
    }

    // Try account-wide trade fetch first (especially important for Bybit).
    const accountWideTrades: any[] = [];
    const diagnostics: {
      exchange: string;
      accountWideCount: number;
      symbolFallbackCount: number;
      errors: string[];
      dedupedCount: number;
    } = {
      exchange,
      accountWideCount: 0,
      symbolFallbackCount: 0,
      errors: [],
      dedupedCount: 0,
    };
    const accountWideModes = [undefined];
    for (const mode of accountWideModes) {
      try {
        const c = mode ? makeClient(mode) : client;
        const recent = await c.fetchMyTrades(undefined, undefined, 120);
        if (Array.isArray(recent) && recent.length > 0) {
          accountWideTrades.push(...recent);
          diagnostics.accountWideCount += recent.length;
        }
      } catch (e: any) {
        diagnostics.errors.push(`accountWide(default): ${e?.message || e}`);
      }
    }

    const targetPairs = new Set<string>();
    try {
      const balance = await client.fetchBalance();
      const activeAssets = Object.keys(balance.total).filter((asset) => (balance.total as any)[asset] > 0);
      activeAssets.forEach((asset) => {
        if (asset !== "USDT" && asset !== "USDC") {
          targetPairs.add(`${asset}/USDT`);
          targetPairs.add(`${asset}/USDT:USDT`);
        }
      });
    } catch (_e) {
      console.warn("[CEX] Failed to fetch balance for trade filtering.");
    }
    try {
      const openOrders = await client.fetchOpenOrders();
      openOrders.forEach((o: any) => targetPairs.add(o.symbol));
    } catch (_e) { }
    expandedPairs.forEach((p) => targetPairs.add(p));
    const pairsToQuery = Array.from(targetPairs).slice(0, 60);
    const trades: any[] = [...accountWideTrades];
    const batchSize = 10;
    for (let i = 0; i < pairsToQuery.length; i += batchSize) {
      const batch = pairsToQuery.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (pair) => {
          try {
            const res = await client.fetchMyTrades(pair, undefined, 50);
            if (res?.length > 0) {
              trades.push(...res);
              diagnostics.symbolFallbackCount += res.length;
            }
          } catch (e: any) {
            diagnostics.errors.push(`symbol(${pair}): ${e?.message || e}`);
          }
        })
      );
    }
    const normalize = (items: any[]) =>
      items.map((item) => ({
        ...classifyTrade(item, exchange),
        id: item.id || `mock-trade-${Math.random()}`,
        symbol: normalizeSymbol(item.symbol),
        rawSymbol: item.symbol,
        side: item.side,
        type: item.side === "buy" ? "Buy" : "Sell",
        price: item.price,
        amount: item.amount,
        timestamp: item.timestamp,
        exchange,
        status: "closed",
        pnl: item.info?.pnl || 0,
        fee: item.fee?.cost || item.price * item.amount * 0.001,
        feeCurrency: item.fee?.currency || (typeof item.symbol === "string" ? item.symbol.split("/")[1] || "USDT" : "USDT"),
        feeAsset: item.fee?.currency || (typeof item.symbol === "string" ? item.symbol.split("/")[1] || "USDT" : "USDT"),
        feeUsd: typeof item.fee?.cost === "number"
          ? item.fee.cost
          : ((item.price || 0) * (item.amount || 0) * 0.001),
        quoteAsset: typeof item.symbol === "string" ? item.symbol.split("/")[1] || "USDT" : "USDT",
        takerOrMaker: item.takerOrMaker || "taker",
        orderId: item.order,
        orderType: item.type,
        clientOrderId: item.clientOrderId || item.info?.orderLinkId || item.info?.orderId,
        cost: item.cost,
        datetime: item.datetime,
        txHash: item.info?.txId || item.info?.tradeId || item.id,
        info: item.info || {},
        sourceType: "cex",
      }));
    const deduped = Array.from(
      new Map(
        normalize(trades).map((t) => [
          String(t.id || `${t.exchange}-${t.symbol}-${t.timestamp}-${t.side}-${t.amount}-${t.price}`),
          t,
        ])
      ).values()
    );
    diagnostics.dedupedCount = deduped.length;
    res.json({ trades: deduped, diagnostics });
  } catch (error: any) {
    console.error("CEX Trades Error:", error);
    res.status(500).json({ error: error.message });
  }
}
