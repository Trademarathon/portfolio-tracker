import { normalizeSymbol } from "./normalization";
import { getExchangeInstance } from "./exchange-manager";

const DEFAULT_BYBIT_SYMBOLS = [
  "BTC/USDT",
  "ETH/USDT",
  "SOL/USDT",
  "BNB/USDT",
  "XRP/USDT",
  "DOGE/USDT",
  "SUI/USDT",
  "TON/USDT",
];

type BybitMode = "default" | "spot" | "linear" | "unified";
type ExecCategory = "spot" | "linear" | "inverse";

export interface BybitTradeDiagnostics {
  exchange: "bybit";
  accountWideModesTried: BybitMode[];
  executionCategoriesTried: ExecCategory[];
  symbolModesTried: BybitMode[];
  errors: string[];
  accountWideCount: number;
  executionCount: number;
  symbolFallbackCount: number;
  dedupedCount: number;
  executionFallbackUsed: boolean;
  symbolFallbackUsed: boolean;
}

export interface NormalizedCexTrade {
  id: string;
  symbol: string;
  rawSymbol?: string;
  side: "buy" | "sell";
  type: "Buy" | "Sell";
  price: number;
  amount: number;
  timestamp: number;
  exchange: string;
  status: "closed";
  pnl: number;
  fee: number;
  feeCurrency: string;
  feeAsset: string;
  feeUsd: number;
  quoteAsset: string;
  takerOrMaker: string;
  orderId?: string;
  orderType?: string;
  clientOrderId?: string;
  cost?: number;
  datetime?: string;
  txHash: string;
  info: Record<string, unknown>;
  sourceType: "cex";
}

function toBybitClient(apiKey: string, secret: string, mode: BybitMode = "default") {
  // All Bybit accounts are now UTA (Unified Trading Account).
  // CCXT v4 maps "swap" to the V5 unified/linear endpoints which work for UTA.
  const defaultType = mode === "default" || mode === "unified" ? "swap" : mode;
  return getExchangeInstance("bybit", apiKey, secret, {
    options: { defaultType }
  });
}

function normalizeTrade(item: any, exchange = "bybit"): NormalizedCexTrade | null {
  const rawSymbol = String(item?.symbol || item?.info?.symbol || "");
  const symbol = normalizeSymbol(rawSymbol);
  const side = String(item?.side || "").toLowerCase() === "sell" ? "sell" : "buy";
  const price = Number(item?.price || 0);
  const amount = Number(item?.amount || item?.info?.execQty || item?.info?.qty || 0);
  const timestamp = Number(item?.timestamp || Date.now());

  if (!symbol || !Number.isFinite(price) || !Number.isFinite(amount) || price <= 0 || amount <= 0) {
    return null;
  }

  const feeCost = typeof item?.fee?.cost === "number" ? item.fee.cost : (price * amount * 0.001);
  const feeCurrency = String(item?.fee?.currency || (rawSymbol.includes("/") ? rawSymbol.split("/")[1] : "USDT") || "USDT");

  return {
    id: String(item?.id || `${exchange}-${rawSymbol || symbol}-${timestamp}-${side}-${amount}-${price}`),
    symbol,
    rawSymbol,
    side,
    type: side === "buy" ? "Buy" : "Sell",
    price,
    amount,
    timestamp,
    exchange,
    status: "closed",
    pnl: Number(
      item?.info?.pnl ??
      item?.info?.closedPnl ??
      item?.info?.execPnl ??
      item?.info?.cumRealisedPnl ??
      0
    ),
    fee: Number(feeCost || 0),
    feeCurrency,
    feeAsset: feeCurrency,
    feeUsd: Number(feeCost || 0),
    quoteAsset: rawSymbol.includes("/") ? (rawSymbol.split("/")[1] || "USDT") : "USDT",
    takerOrMaker: String(item?.takerOrMaker || "taker"),
    orderId: item?.order,
    orderType: item?.type,
    clientOrderId: item?.clientOrderId || item?.info?.orderLinkId || item?.info?.orderId,
    cost: item?.cost,
    datetime: item?.datetime,
    txHash: String(item?.info?.txId || item?.info?.tradeId || item?.id || `${exchange}-${timestamp}`),
    info: (item?.info && typeof item.info === "object" ? item.info : {}) as Record<string, unknown>,
    sourceType: "cex",
  };
}

function mapExecutionRow(row: any): any | null {
  const rawSymbol = String(row?.symbol || "").toUpperCase();
  const amount = parseFloat(row?.execQty || row?.qty || "0") || 0;
  const price = parseFloat(row?.execPrice || row?.price || "0") || 0;
  if (!rawSymbol || amount <= 0 || price <= 0) return null;

  const pair = rawSymbol.endsWith("USDT")
    ? `${rawSymbol.replace("USDT", "")}/USDT`
    : rawSymbol.endsWith("USDC")
      ? `${rawSymbol.replace("USDC", "")}/USDC`
      : rawSymbol;

  return {
    id: String(row?.execId || row?.orderId || `${rawSymbol}-${row?.execTime || Date.now()}`),
    symbol: pair,
    side: String(row?.side || "").toLowerCase() === "sell" ? "sell" : "buy",
    price,
    amount,
    timestamp: Number(row?.execTime || row?.tradeTime || Date.now()),
    cost: amount * price,
    fee: {
      cost: parseFloat(row?.execFee || "0") || undefined,
      currency: String(row?.feeCurrency || "USDT"),
    },
    takerOrMaker: String(row?.isMaker || "").toLowerCase() === "true" ? "maker" : "taker",
    order: row?.orderId,
    type: row?.orderType || "limit",
    info: row,
  };
}

function dedupeTrades(trades: NormalizedCexTrade[]): NormalizedCexTrade[] {
  return Array.from(
    new Map(trades.map((t) => [String(t.id || `${t.exchange}-${t.symbol}-${t.timestamp}-${t.side}`), t])).values()
  ).sort((a, b) => b.timestamp - a.timestamp);
}

export async function fetchBybitTradesWithFallback(params: {
  apiKey: string;
  secret: string;
  symbols?: string[];
  accountWideLimit?: number;
  symbolLimit?: number;
}): Promise<{ trades: NormalizedCexTrade[]; diagnostics: BybitTradeDiagnostics }> {
  const {
    apiKey,
    secret,
    symbols = DEFAULT_BYBIT_SYMBOLS,
    accountWideLimit = 120,
    symbolLimit = 40,
  } = params;

  const diagnostics: BybitTradeDiagnostics = {
    exchange: "bybit",
    accountWideModesTried: [],
    executionCategoriesTried: [],
    symbolModesTried: [],
    errors: [],
    accountWideCount: 0,
    executionCount: 0,
    symbolFallbackCount: 0,
    dedupedCount: 0,
    executionFallbackUsed: true,
    symbolFallbackUsed: false,
  };

  const rawTrades: any[] = [];
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysBack = 30; // Fetch up to 30 days of history

  // Use the native V5 endpoint directly for each category
  // This avoids CCXT's default 7-day limitation and reliably gets all categories
  const categories: ExecCategory[] = ["spot", "linear", "inverse"];

  for (const category of categories) {
    diagnostics.executionCategoriesTried.push(category);
    try {
      const client = toBybitClient(apiKey, secret, category === "spot" ? "spot" : "unified");
      const fn = (client as any).privateGetV5ExecutionList;

      if (typeof fn !== "function") {
        diagnostics.errors.push(`execution(${category}): endpoint unavailable`);
        continue;
      }

      let endTime = Date.now();
      let startTime = endTime - 7 * msPerDay; // 7-day chunk is Bybit's max allowed

      for (let i = 0; i < Math.ceil(daysBack / 7); i++) {
        let cursor = undefined;
        let pageCount = 0;

        while (pageCount < 10) { // Safety limit: up to 1000 trades per 7-day window
          const req: any = {
            category,
            limit: 100,
            endTime: String(endTime),
            startTime: String(startTime)
          };
          if (cursor) req.cursor = cursor;

          const raw = await fn.call(client, req);
          const list = raw?.result?.list;

          if (Array.isArray(list) && list.length > 0) {
            for (const row of list) {
              const mapped = mapExecutionRow(row);
              if (mapped) {
                rawTrades.push(mapped);
                diagnostics.executionCount++;
              }
            }
          }

          cursor = raw?.result?.nextPageCursor;
          if (!cursor || !list || list.length < 100) {
            break; // No more pages in this 7-day window
          }
          pageCount++;
          await new Promise(r => setTimeout(r, 50)); // Rate limit safety
        }

        // Shift the 7-day window back
        endTime = startTime - 1;
        startTime = endTime - 7 * msPerDay;
      }
    } catch (e: any) {
      diagnostics.errors.push(`execution(${category}): ${e?.message || e}`);
    }
  }

  const normalized = rawTrades
    .map((trade) => normalizeTrade(trade, "bybit"))
    .filter((trade): trade is NormalizedCexTrade => !!trade);

  const deduped = dedupeTrades(normalized);
  diagnostics.dedupedCount = deduped.length;

  return { trades: deduped, diagnostics };
}
