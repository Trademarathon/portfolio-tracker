import { LedgerEvent } from "@/lib/accounting/ledger";

interface Lot {
  qty: number;
  costUsd: number;
  estimated: boolean;
  ts: number;
}

export interface AssetAccountingSnapshot {
  avgBuyPriceCurrent: number;
  avgBuyPriceLifetime: number;
  avgSellPrice: number;
  costBasis: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalFeesUsd: number;
  basisConfidence: "exact" | "estimated";
  totalBought: number;
  totalSold: number;
  totalCost: number;
  totalProceeds: number;
  buyCount: number;
  sellCount: number;
  netPosition: number;
  firstBuyDate: number;
  lastBuyDate: number;
  lastSellDate: number;
}

export interface ComputeCostBasisOptions {
  events: LedgerEvent[];
  currentPrice: number;
  currentBalance: number;
}

export function computeCostBasisSnapshot(options: ComputeCostBasisOptions): AssetAccountingSnapshot {
  const { events, currentPrice, currentBalance } = options;

  const lots: Lot[] = [];
  let totalBought = 0;
  let totalSold = 0;
  let totalCost = 0;
  let totalProceeds = 0;
  let realizedPnl = 0;
  let totalFeesUsd = 0;
  let buyCount = 0;
  let sellCount = 0;
  let firstBuyDate = 0;
  let lastBuyDate = 0;
  let lastSellDate = 0;

  const consumeLots = (qty: number): number => {
    let remaining = qty;
    let consumedCost = 0;
    while (remaining > 0 && lots.length > 0) {
      const lot = lots[0];
      const take = Math.min(remaining, lot.qty);
      const unitCost = lot.qty > 0 ? lot.costUsd / lot.qty : 0;
      consumedCost += take * unitCost;
      lot.qty -= take;
      lot.costUsd -= take * unitCost;
      remaining -= take;
      if (lot.qty <= 1e-12) lots.shift();
    }
    return consumedCost;
  };

  for (const e of events) {
    const qty = Number(e.qty || 0);
    if (!(qty > 0)) continue;
    const fee = Number(e.feeUsd || 0);
    if (fee > 0) totalFeesUsd += fee;

    switch (e.kind) {
      case "TRADE_BUY": {
        const price = Number(e.price || 0);
        if (!(price > 0)) break;
        const cost = qty * price + fee;
        lots.push({ qty, costUsd: cost, estimated: Boolean(e.estimatedBasis), ts: e.timestamp });
        totalBought += qty;
        totalCost += cost;
        buyCount += 1;
        if (!firstBuyDate) firstBuyDate = e.timestamp;
        lastBuyDate = e.timestamp;
        break;
      }
      case "TRADE_SELL": {
        const price = Number(e.price || 0);
        if (!(price > 0)) break;
        const proceeds = qty * price - fee;
        const consumedCost = consumeLots(qty);
        realizedPnl += proceeds - consumedCost;
        totalSold += qty;
        totalProceeds += proceeds;
        sellCount += 1;
        lastSellDate = e.timestamp;
        break;
      }
      case "TRANSFER_IN":
      case "INTERNAL_MOVE_IN": {
        const basisPrice = Number(e.price || 0);
        if (!(basisPrice > 0)) break;
        const cost = qty * basisPrice;
        lots.push({ qty, costUsd: cost, estimated: true, ts: e.timestamp });
        totalBought += qty;
        totalCost += cost;
        buyCount += 1;
        if (!firstBuyDate) firstBuyDate = e.timestamp;
        lastBuyDate = e.timestamp;
        break;
      }
      case "TRANSFER_OUT":
      case "INTERNAL_MOVE_OUT": {
        consumeLots(qty);
        totalSold += qty;
        sellCount += 1;
        lastSellDate = e.timestamp;
        break;
      }
      case "FEE":
      case "FUNDING":
      default:
        break;
    }
  }

  const lotsQty = lots.reduce((s, l) => s + l.qty, 0);
  const lotsCost = lots.reduce((s, l) => s + l.costUsd, 0);
  const avgBuyPriceCurrent = lotsQty > 0 ? lotsCost / lotsQty : 0;
  const avgBuyPriceLifetime = totalBought > 0 ? totalCost / totalBought : 0;
  const avgSellPrice = totalSold > 0 ? totalProceeds / totalSold : 0;

  const coveredQty = Math.max(0, Math.min(currentBalance, lotsQty));
  const costBasis = coveredQty > 0 && avgBuyPriceCurrent > 0 ? coveredQty * avgBuyPriceCurrent : 0;
  const unrealizedPnl = coveredQty > 0 && currentPrice > 0
    ? coveredQty * currentPrice - costBasis
    : 0;

  const hasEstimatedLots = lots.some((l) => l.estimated);
  const basisConfidence: "exact" | "estimated" = hasEstimatedLots ? "estimated" : "exact";

  return {
    avgBuyPriceCurrent,
    avgBuyPriceLifetime,
    avgSellPrice,
    costBasis,
    realizedPnl,
    unrealizedPnl,
    totalFeesUsd,
    basisConfidence,
    totalBought,
    totalSold,
    totalCost,
    totalProceeds,
    buyCount,
    sellCount,
    netPosition: totalBought - totalSold,
    firstBuyDate,
    lastBuyDate,
    lastSellDate,
  };
}

