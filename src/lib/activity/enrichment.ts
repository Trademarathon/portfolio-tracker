import type { PortfolioConnection } from "@/lib/api/types";
import type { UnifiedActivity } from "@/lib/api/transactions";
import { normalizeSymbol } from "@/lib/utils/normalization";
import type { ActivityEventEnriched, EntityKind, MovementRouteKey, ValuationConfidence } from "./types";

type EnrichOptions = {
  activities: UnifiedActivity[];
  prices: Record<string, number>;
  connections: PortfolioConnection[];
};

type PriceTick = { minute: number; price: number };

type PriceCache = {
  bySymbolMinute: Map<string, Map<number, number>>;
  bySymbolSorted: Map<string, PriceTick[]>;
};

type MarketPriceResolution = {
  price?: number;
  confidence: ValuationConfidence;
};

type AssetBasisState = {
  qty: number;
  costUsd: number;
};

const EXCHANGE_TYPES = new Set(["binance", "bybit", "hyperliquid", "okx"]);
const SOFTWARE_WALLET_TYPES = new Set(["wallet", "evm", "solana", "aptos", "ton", "zerion"]);

function minuteBucket(timestamp: number): number {
  return Math.floor(timestamp / 60_000) * 60_000;
}

function isFinitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function buildConnectionMaps(connections: PortfolioConnection[]) {
  const byId = new Map<string, PortfolioConnection>();
  const labelById = new Map<string, string>();
  connections.forEach((conn) => {
    byId.set(conn.id, conn);
    labelById.set(conn.id, conn.displayName || conn.name || conn.id);
  });
  return { byId, labelById };
}

function resolveEntityKind(
  label: string,
  connectionId: string | undefined,
  byId: Map<string, PortfolioConnection>
): EntityKind {
  if (connectionId && byId.has(connectionId)) {
    const conn = byId.get(connectionId)!;
    if (conn.hardwareType) return "hardware_wallet";
    const connType = String(conn.type || "").toLowerCase();
    if (EXCHANGE_TYPES.has(connType)) return "exchange";
    if (SOFTWARE_WALLET_TYPES.has(connType)) return "software_wallet";
  }
  const lower = label.toLowerCase();
  if (lower.includes("ledger") || lower.includes("trezor") || lower.includes("tangem")) return "hardware_wallet";
  if (
    lower.includes("binance") ||
    lower.includes("bybit") ||
    lower.includes("hyperliquid") ||
    lower.includes("okx") ||
    lower.includes("exchange")
  ) {
    return "exchange";
  }
  if (lower.includes("wallet")) return "software_wallet";
  return "unknown";
}

function sourceLabel(tx: UnifiedActivity, labelById: Map<string, string>): string {
  const direct = String((tx as any).exchange || "").trim();
  if (direct) return direct;
  const connId = String((tx as any).connectionId || "").trim();
  if (connId && labelById.has(connId)) return labelById.get(connId)!;
  return "Wallet";
}

function resolveRoute(
  tx: UnifiedActivity,
  srcLabel: string,
  labelById: Map<string, string>
): {
  fromLabel: string;
  toLabel: string;
  sourceConnectionId?: string;
  destinationConnectionId?: string;
} {
  const activityType = tx.activityType;
  const rawFrom = String((tx as any).from || "").trim();
  const rawTo = String((tx as any).to || "").trim();
  const connId = String((tx as any).connectionId || "").trim();
  const fromConnId = String((tx as any).fromConnectionId || "").trim();
  const toConnId = String((tx as any).toConnectionId || "").trim();
  const address = String((tx as any).address || "").trim();
  const txType = String((tx as any).type || "").toLowerCase();

  if (activityType === "internal") {
    const fromLabel =
      rawFrom ||
      (fromConnId && labelById.get(fromConnId)) ||
      (connId && labelById.get(connId)) ||
      srcLabel;
    const toLabel = rawTo || (toConnId && labelById.get(toConnId)) || (address ? "External wallet" : "Destination");
    return {
      fromLabel,
      toLabel,
      sourceConnectionId: fromConnId || connId || undefined,
      destinationConnectionId: toConnId || undefined,
    };
  }

  if (activityType === "transfer") {
    if (txType.includes("deposit")) {
      const toLabel = rawTo || (connId && labelById.get(connId)) || srcLabel;
      return {
        fromLabel: rawFrom || "External wallet",
        toLabel,
        sourceConnectionId: fromConnId || undefined,
        destinationConnectionId: toConnId || connId || undefined,
      };
    }
    if (txType.includes("withdraw")) {
      const fromLabel = rawFrom || (connId && labelById.get(connId)) || srcLabel;
      return {
        fromLabel,
        toLabel: rawTo || (address ? "External wallet" : "Destination"),
        sourceConnectionId: fromConnId || connId || undefined,
        destinationConnectionId: toConnId || undefined,
      };
    }
  }

  const fromLabel = rawFrom || srcLabel;
  const toLabel = rawTo || srcLabel;
  return {
    fromLabel,
    toLabel,
    sourceConnectionId: fromConnId || connId || undefined,
    destinationConnectionId: toConnId || connId || undefined,
  };
}

function buildTradePriceCache(activities: UnifiedActivity[]): PriceCache {
  const bySymbolMinute = new Map<string, Map<number, number>>();

  for (const tx of activities) {
    const rawAsset = String((tx as any).symbol || (tx as any).asset || "");
    const asset = normalizeSymbol(rawAsset);
    if (!asset) continue;
    const price = Number((tx as any).price || 0);
    if (!(price > 0)) continue;
    const bucket = minuteBucket(Number(tx.timestamp || 0));
    if (!bucket) continue;
    if (!bySymbolMinute.has(asset)) bySymbolMinute.set(asset, new Map<number, number>());
    bySymbolMinute.get(asset)!.set(bucket, price);
  }

  const bySymbolSorted = new Map<string, PriceTick[]>();
  bySymbolMinute.forEach((minuteMap, symbol) => {
    const sorted: PriceTick[] = Array.from(minuteMap.entries())
      .map(([minute, price]) => ({ minute, price }))
      .sort((a, b) => a.minute - b.minute);
    bySymbolSorted.set(symbol, sorted);
  });

  return { bySymbolMinute, bySymbolSorted };
}

function resolveNearestPrice(ticks: PriceTick[], targetMinute: number): number | undefined {
  if (!ticks.length) return undefined;
  let best: PriceTick | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const tick of ticks) {
    const distance = Math.abs(tick.minute - targetMinute);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = tick;
    }
  }
  if (!best) return undefined;
  if (bestDistance > 30 * 60_000) return undefined;
  return best.price;
}

function resolveMarketPrice(
  tx: UnifiedActivity,
  asset: string,
  cache: PriceCache,
  prices: Record<string, number>
): MarketPriceResolution {
  const tradePrice = Number((tx as any).price || 0);
  if (tradePrice > 0) {
    return { price: tradePrice, confidence: "high" };
  }

  const targetMinute = minuteBucket(tx.timestamp);
  const exact = cache.bySymbolMinute.get(asset)?.get(targetMinute);
  if (isFinitePositive(exact)) {
    return { price: exact, confidence: "high" };
  }

  const nearest = resolveNearestPrice(cache.bySymbolSorted.get(asset) || [], targetMinute);
  if (isFinitePositive(nearest)) {
    return { price: nearest, confidence: "medium" };
  }

  const latest = Number(prices[asset] || 0);
  if (isFinitePositive(latest)) {
    return { price: latest, confidence: "low" };
  }

  return { confidence: "low" };
}

function amountBucketId(amount: number): string {
  const safe = Math.max(1e-9, Math.abs(amount));
  const bucket = Math.round(Math.log(safe) / Math.log(1.1));
  return String(bucket);
}

function applyBasisTransition(
  tx: UnifiedActivity,
  marketPrice: number | undefined,
  state: AssetBasisState
): AssetBasisState {
  const next: AssetBasisState = { qty: state.qty, costUsd: state.costUsd };
  const qty = Math.max(0, Number(tx.amount || 0));
  if (!(qty > 0)) return next;

  const avg = next.qty > 0 ? next.costUsd / next.qty : 0;
  const txType = String((tx as any).type || "").toLowerCase();
  const side = String((tx as any).side || "").toLowerCase();
  const feeUsd = Number((tx as any).feeUsd || 0);
  const tradePrice = Number((tx as any).price || marketPrice || 0);

  if (tx.activityType === "trade") {
    if (side === "buy" || txType === "buy" || side === "long") {
      if (tradePrice > 0) {
        next.qty += qty;
        next.costUsd += qty * tradePrice + Math.max(0, feeUsd);
      }
      return next;
    }
    if (side === "sell" || txType === "sell" || side === "short") {
      if (next.qty > 0) {
        const consume = Math.min(next.qty, qty);
        next.qty -= consume;
        next.costUsd = Math.max(0, next.costUsd - consume * avg);
      }
      return next;
    }
    return next;
  }

  if (tx.activityType === "transfer" || tx.activityType === "internal") {
    if (txType.includes("withdraw") || txType.includes("transfer_out")) {
      const consume = Math.min(next.qty, qty);
      next.qty -= consume;
      next.costUsd = Math.max(0, next.costUsd - consume * avg);
      return next;
    }

    // Deposit / internal move in keeps basis continuity; fallback to market price when no prior lots exist.
    const basisPrice = avg > 0 ? avg : Math.max(0, marketPrice || 0);
    if (basisPrice > 0) {
      next.qty += qty;
      next.costUsd += qty * basisPrice;
    }
  }

  return next;
}

export function enrichActivities(options: EnrichOptions): ActivityEventEnriched[] {
  const { activities, prices, connections } = options;
  if (!activities.length) return [];

  const { byId, labelById } = buildConnectionMaps(connections);
  const marketCache = buildTradePriceCache(activities);
  const basisStateByAsset = new Map<string, AssetBasisState>();

  const ascending = [...activities].sort((a, b) => a.timestamp - b.timestamp);
  const enrichedAscending: ActivityEventEnriched[] = [];

  for (const tx of ascending) {
    const asset = normalizeSymbol(String((tx as any).symbol || (tx as any).asset || ""));
    if (!asset) continue;
    const amount = Math.abs(Number(tx.amount || 0));
    if (!(amount > 0)) continue;

    const srcLabel = sourceLabel(tx, labelById);
    const route = resolveRoute(tx, srcLabel, labelById);
    const fromKind = resolveEntityKind(route.fromLabel, route.sourceConnectionId, byId);
    const toKind = resolveEntityKind(route.toLabel, route.destinationConnectionId, byId);
    const routeKey = `${route.fromLabel}->${route.toLabel}:${asset}` as MovementRouteKey;

    const marketResolution = resolveMarketPrice(tx, asset, marketCache, prices);
    const marketPriceUsdAtEvent = marketResolution.price;
    const feeAmount = Number((tx as any).fee || 0);
    const feeUsdRaw = Number((tx as any).feeUsd || 0);
    const feeUsd =
      feeUsdRaw > 0
        ? feeUsdRaw
        : feeAmount > 0 && marketPriceUsdAtEvent && String((tx as any).feeAsset || "").toUpperCase() === asset
          ? feeAmount * marketPriceUsdAtEvent
          : 0;

    const basisState = basisStateByAsset.get(asset) || { qty: 0, costUsd: 0 };
    const costBasisUsdAtEvent =
      basisState.qty > 0 && basisState.costUsd > 0 ? basisState.costUsd / basisState.qty : undefined;

    const marketValueUsdAtEvent = marketPriceUsdAtEvent ? amount * marketPriceUsdAtEvent : undefined;
    const basisValueUsdAtEvent = costBasisUsdAtEvent ? amount * costBasisUsdAtEvent : undefined;
    const bucketId = `${routeKey}|${amountBucketId(amount)}`;

    enrichedAscending.push({
      id: String(tx.id),
      timestamp: Number(tx.timestamp || 0),
      asset,
      amount,
      activityType: tx.activityType,
      rawType: String((tx as any).type || tx.activityType || "").toUpperCase(),
      side: String((tx as any).side || "").toLowerCase() || undefined,
      sourceLabel: srcLabel,
      fromLabel: route.fromLabel,
      toLabel: route.toLabel,
      fromKind,
      toKind,
      routeKey,
      txHash: (tx as any).txHash || undefined,
      address: (tx as any).address || undefined,
      status: (tx as any).status || undefined,
      network: (tx as any).network || (tx as any).chain || undefined,
      sourceConnectionId: route.sourceConnectionId,
      destinationConnectionId: route.destinationConnectionId,
      feeAsset: (tx as any).feeAsset || (tx as any).feeCurrency || undefined,
      feeAmount: feeAmount > 0 ? feeAmount : undefined,
      feeUsd: feeUsd > 0 ? feeUsd : undefined,
      marketPriceUsdAtEvent,
      costBasisUsdAtEvent,
      marketValueUsdAtEvent,
      basisValueUsdAtEvent,
      valuationConfidence: marketResolution.confidence,
      bucketId,
      raw: tx,
    });

    basisStateByAsset.set(asset, applyBasisTransition(tx, marketPriceUsdAtEvent, basisState));
  }

  const lastByBucket = new Map<string, number>();
  for (const event of enrichedAscending) {
    const prevTs = lastByBucket.get(event.bucketId);
    if (prevTs) {
      event.lastSimilarAt = prevTs;
      event.lastSimilarDeltaMinutes = Math.max(0, Math.round((event.timestamp - prevTs) / 60_000));
    }
    lastByBucket.set(event.bucketId, event.timestamp);
  }

  return enrichedAscending.sort((a, b) => b.timestamp - a.timestamp);
}
