import { Transaction } from "@/lib/api/types";
import { normalizeSymbol } from "@/lib/utils/normalization";

export interface JournalTradeRecord extends Transaction {
  entryPrice?: number;
  exitPrice?: number;
  entryTime?: number;
  exitTime?: number;
  holdTime?: number;
  mae?: number;
  mfe?: number;
  realizedPnl?: number;
  fees?: number;
  funding?: number;
  isOpen?: boolean;
  rawSymbol?: string;
  cost?: number;
  info?: Record<string, unknown>;
}

interface PositionLot {
  qty: number;
  price: number;
  ts: number;
}

const EPS = 1e-9;

function toFiniteNumber(...values: unknown[]): number {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function normalizeExchange(value: unknown): string {
  return String(value || "").toLowerCase().trim();
}

function normalizeSide(value: unknown): "buy" | "sell" {
  const side = String(value || "").toLowerCase();
  if (side === "sell" || side === "short" || side === "s") return "sell";
  return "buy";
}

function tradeKey(trade: JournalTradeRecord): string {
  return `${trade.id}|${trade.timestamp}|${trade.symbol}|${trade.side}|${trade.price}|${trade.amount}|${trade.realizedPnl || 0}|${trade.entryPrice || 0}|${trade.exitPrice || 0}|${trade.holdTime || 0}|${trade.fees || 0}|${trade.funding || 0}|${trade.isOpen ? 1 : 0}`;
}

export function areJournalTradesEquivalent(a: JournalTradeRecord[], b: JournalTradeRecord[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (tradeKey(a[i]) !== tradeKey(b[i])) return false;
  }
  return true;
}

export function normalizeJournalTrade(raw: unknown, fallbackIndex = 0): JournalTradeRecord {
  const t = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const info = (t.info && typeof t.info === "object" ? t.info : {}) as Record<string, unknown>;

  const timestamp = toFiniteNumber(t.timestamp, info.execTime, info.tradeTime, Date.now());
  const rawSymbol = String(t.rawSymbol || t.symbol || t.asset || info.symbol || info.s || "").trim();
  const symbol = normalizeSymbol(rawSymbol);
  const side = normalizeSide(t.side || t.type);
  const price = toFiniteNumber(t.price, info.execPrice, info.avgPrice);
  const amount = toFiniteNumber(t.amount, t.qty, t.size, info.execQty, info.qty);
  const explicitPnL = toFiniteNumber(t.realizedPnl, t.pnl, info.closedPnl, info.execPnl, info.cumRealisedPnl);
  const feeUsd = Math.abs(
    toFiniteNumber(
      t.fees,
      t.feeUsd,
      t.fee,
      info.execFee,
      info.fee,
    )
  );
  const funding = toFiniteNumber(
    t.funding,
    (t.feeType === "funding" ? t.pnl : undefined),
    info.funding,
    info.fundingPnl
  );

  const id = String(
    t.id ||
      `${normalizeExchange(t.exchange || "ex")}-${symbol || "sym"}-${timestamp}-${side}-${fallbackIndex}`
  );

  const status = String(t.status || "closed").toLowerCase();
  const isOpen =
    typeof t.isOpen === "boolean"
      ? t.isOpen
      : status === "open";

  return {
    ...(t as Partial<JournalTradeRecord>),
    id,
    symbol,
    rawSymbol: rawSymbol || symbol,
    side,
    price,
    amount,
    timestamp,
    exchange: normalizeExchange(t.exchange),
    status: status as JournalTradeRecord["status"],
    realizedPnl: explicitPnL,
    pnl: explicitPnL,
    fees: feeUsd,
    funding,
    entryPrice: toFiniteNumber(t.entryPrice),
    exitPrice: toFiniteNumber(t.exitPrice),
    entryTime: toFiniteNumber(t.entryTime, timestamp),
    exitTime: toFiniteNumber(t.exitTime),
    holdTime: toFiniteNumber(t.holdTime),
    isOpen,
    info,
    cost: toFiniteNumber(t.cost, price * amount),
  };
}

function consumeLots(
  lots: PositionLot[],
  qty: number,
  exitPrice: number,
  exitTs: number,
  sideClosing: "long" | "short"
): { closedQty: number; closedCost: number; realized: number; holdMsQty: number } {
  let remaining = qty;
  let closedQty = 0;
  let closedCost = 0;
  let realized = 0;
  let holdMsQty = 0;

  while (remaining > EPS && lots.length > 0) {
    const lot = lots[0];
    const take = Math.min(remaining, lot.qty);
    const cost = take * lot.price;
    closedQty += take;
    closedCost += cost;
    holdMsQty += Math.max(0, exitTs - lot.ts) * take;

    if (sideClosing === "long") {
      realized += take * (exitPrice - lot.price);
    } else {
      realized += take * (lot.price - exitPrice);
    }

    lot.qty -= take;
    remaining -= take;
    if (lot.qty <= EPS) lots.shift();
  }

  return { closedQty, closedCost, realized, holdMsQty };
}

function lifecycleEnrich(group: JournalTradeRecord[]): JournalTradeRecord[] {
  const sorted = [...group].sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    return a.id.localeCompare(b.id);
  });

  const longLots: PositionLot[] = [];
  const shortLots: PositionLot[] = [];
  const out: JournalTradeRecord[] = [];

  sorted.forEach((trade) => {
    const qty = Math.max(0, toFiniteNumber(trade.amount));
    const price = Math.max(0, toFiniteNumber(trade.price));
    const feeUsd = Math.max(0, toFiniteNumber(trade.fees, trade.feeUsd, trade.fee));
    const explicitPnl = toFiniteNumber(trade.realizedPnl, trade.pnl);

    let closedQty = 0;
    let closedCost = 0;
    let realizedFromLifecycle = 0;
    let holdMsQty = 0;
    let remainder = qty;

    if (qty > 0 && price > 0) {
      if (trade.side === "buy") {
        const closed = consumeLots(shortLots, remainder, price, trade.timestamp, "short");
        closedQty += closed.closedQty;
        closedCost += closed.closedCost;
        realizedFromLifecycle += closed.realized;
        holdMsQty += closed.holdMsQty;
        remainder -= closed.closedQty;
        if (remainder > EPS) {
          longLots.push({ qty: remainder, price, ts: trade.timestamp });
        }
      } else {
        const closed = consumeLots(longLots, remainder, price, trade.timestamp, "long");
        closedQty += closed.closedQty;
        closedCost += closed.closedCost;
        realizedFromLifecycle += closed.realized;
        holdMsQty += closed.holdMsQty;
        remainder -= closed.closedQty;
        if (remainder > EPS) {
          shortLots.push({ qty: remainder, price, ts: trade.timestamp });
        }
      }
    }

    let realized = explicitPnl;
    const explicitIsMeaningful = Math.abs(explicitPnl) > EPS;
    if (!explicitIsMeaningful && closedQty > EPS) {
      realized = realizedFromLifecycle - feeUsd;
    }

    const computedEntry = closedQty > EPS ? closedCost / closedQty : price;
    const computedExit = closedQty > EPS ? price : 0;
    const computedHold = closedQty > EPS ? holdMsQty / closedQty : 0;

    const entryPrice = toFiniteNumber(trade.entryPrice, computedEntry);
    const exitPrice = toFiniteNumber(trade.exitPrice, computedExit);
    const holdTime = toFiniteNumber(trade.holdTime, computedHold);

    out.push({
      ...trade,
      entryPrice: entryPrice > EPS ? entryPrice : undefined,
      exitPrice: exitPrice > EPS ? exitPrice : undefined,
      entryTime: toFiniteNumber(trade.entryTime, trade.timestamp),
      exitTime: exitPrice > EPS ? toFiniteNumber(trade.exitTime, trade.timestamp) : undefined,
      holdTime: holdTime > EPS ? holdTime : undefined,
      realizedPnl: realized,
      pnl: realized,
      fees: feeUsd,
      funding: toFiniteNumber(trade.funding),
    });
  });

  return out;
}

export function enrichJournalTrades(rawTrades: unknown[]): JournalTradeRecord[] {
  const base = Array.isArray(rawTrades)
    ? rawTrades.map((t, index) => normalizeJournalTrade(t, index)).filter((t) => !!t.symbol && t.timestamp > 0)
    : [];

  if (base.length === 0) return [];

  const grouped = new Map<string, JournalTradeRecord[]>();
  base.forEach((trade) => {
    const key = `${trade.exchange || "unknown"}|${trade.connectionId || "global"}|${trade.symbol}`;
    const list = grouped.get(key) || [];
    list.push(trade);
    grouped.set(key, list);
  });

  const enriched = Array.from(grouped.values()).flatMap((group) => lifecycleEnrich(group));
  return enriched.sort((a, b) => {
    if (a.timestamp !== b.timestamp) return b.timestamp - a.timestamp;
    return a.id.localeCompare(b.id);
  });
}
