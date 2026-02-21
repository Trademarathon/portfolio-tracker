import type { JournalTrade } from "@/contexts/JournalContext";
import type { StrategyTagId, TradeAnnotation } from "@/lib/api/journal-types";

export type MetricMode = "count" | "pnl" | "winRate";

export type DataPoint = {
  x: number;
  y: number;
};

export type AggregatedStat = {
  id: string;
  label: string;
  count: number;
  wins: number;
  losses: number;
  longs: number;
  shorts: number;
  totalPnl: number;
  avgPnl: number;
  avgHoldTimeMs: number;
  avgMae: number;
  avgMfe: number;
  fundingPaid: number;
  fundingReceived: number;
  totalFees: number;
  trades: JournalTrade[];
};

export type CurveOption = {
  id: string;
  label: string;
  section: string;
  color: string;
  stats: AggregatedStat;
};

export type HoldBucket = {
  id: string;
  label: string;
  min: number;
  max: number;
};

export const HOLD_BUCKETS: HoldBucket[] = [
  { id: "under_5m", label: "under 5m", min: 0, max: 5 * 60 * 1000 },
  { id: "5m_15m", label: "5m-15m", min: 5 * 60 * 1000, max: 15 * 60 * 1000 },
  { id: "15m_30m", label: "15m-30m", min: 15 * 60 * 1000, max: 30 * 60 * 1000 },
  { id: "30m_1h", label: "30m-1h", min: 30 * 60 * 1000, max: 60 * 60 * 1000 },
  { id: "1h_2h", label: "1h-2h", min: 60 * 60 * 1000, max: 2 * 60 * 60 * 1000 },
  { id: "2h_4h", label: "2h-4h", min: 2 * 60 * 60 * 1000, max: 4 * 60 * 60 * 1000 },
  { id: "4h_8h", label: "4h-8h", min: 4 * 60 * 60 * 1000, max: 8 * 60 * 60 * 1000 },
  { id: "8h_12h", label: "8h-12h", min: 8 * 60 * 60 * 1000, max: 12 * 60 * 60 * 1000 },
  { id: "12h_1d", label: "12h-1d", min: 12 * 60 * 60 * 1000, max: 24 * 60 * 60 * 1000 },
  { id: "1d_7d", label: "1d-7d", min: 24 * 60 * 60 * 1000, max: 7 * 24 * 60 * 60 * 1000 },
  { id: "7d_30d", label: "7d-30d", min: 7 * 24 * 60 * 60 * 1000, max: 30 * 24 * 60 * 60 * 1000 },
  { id: "30d_plus", label: "30d+", min: 30 * 24 * 60 * 60 * 1000, max: Number.POSITIVE_INFINITY },
];

export const DAY_LABELS: Array<{ id: string; label: string; day: number }> = [
  { id: "monday", label: "Mon", day: 1 },
  { id: "tuesday", label: "Tue", day: 2 },
  { id: "wednesday", label: "Wed", day: 3 },
  { id: "thursday", label: "Thu", day: 4 },
  { id: "friday", label: "Fri", day: 5 },
  { id: "saturday", label: "Sat", day: 6 },
  { id: "sunday", label: "Sun", day: 0 },
];

export const SESSION_LABELS: Array<{
  id: string;
  label: string;
  test: (hour: number) => boolean;
}> = [
  { id: "new_york", label: "New York", test: (hour) => hour >= 13 && hour < 21 },
  { id: "london", label: "London", test: (hour) => hour >= 8 && hour < 13 },
  { id: "tokyo", label: "Tokyo", test: (hour) => hour >= 0 && hour < 8 },
  { id: "overlap", label: "London + NY", test: (hour) => hour >= 13 && hour < 16 },
  { id: "outside", label: "Outside", test: (hour) => hour >= 21 || hour < 0 },
];

export function getClosedTrades(trades: JournalTrade[]): JournalTrade[] {
  return (trades || [])
    .filter((trade) => !trade.isOpen)
    .sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
}

export function getTradePnl(trade: JournalTrade): number {
  return Number(trade.realizedPnl ?? trade.pnl ?? 0);
}

export function getTradeHoldTimeMs(trade: JournalTrade): number {
  const hold = Number(trade.holdTime ?? 0);
  if (Number.isFinite(hold) && hold > 0) return hold;

  const entry = Number(trade.entryTime ?? trade.timestamp ?? 0);
  const exit = Number(trade.exitTime ?? 0);
  if (entry > 0 && exit > entry) return exit - entry;

  return 0;
}

export function getTradeVolume(trade: JournalTrade): number {
  const cost = Number(trade.cost ?? 0);
  if (Number.isFinite(cost) && cost > 0) return cost;

  const amount = Number(trade.amount ?? 0);
  const price = Number(trade.price ?? 0);
  return Number.isFinite(amount * price) ? Math.abs(amount * price) : 0;
}

export function getTradeMaeAbs(trade: JournalTrade): number | null {
  const value = Number(trade.mae);
  if (!Number.isFinite(value) || value === 0) return null;
  return Math.abs(value);
}

export function getTradeMfeAbs(trade: JournalTrade): number | null {
  const value = Number(trade.mfe);
  if (!Number.isFinite(value) || value === 0) return null;
  return Math.abs(value);
}

export function getOrderType(trade: JournalTrade): "maker" | "market" | "unknown" {
  const info = trade.info && typeof trade.info === "object" ? trade.info : {};
  const raw = String(
    trade.takerOrMaker ??
      (info as Record<string, unknown>).takerOrMaker ??
      (info as Record<string, unknown>).maker ??
      (info as Record<string, unknown>).isMaker ??
      (info as Record<string, unknown>).liquidity ??
      (info as Record<string, unknown>).orderType ??
      ""
  ).toLowerCase();

  if (raw.includes("maker") || raw.includes("limit") || raw.includes("post")) return "maker";
  if (raw.includes("taker") || raw.includes("market")) return "market";
  return "unknown";
}

function makeStat(id: string, label: string, trades: JournalTrade[]): AggregatedStat {
  const totalPnl = trades.reduce((sum, trade) => sum + getTradePnl(trade), 0);
  const count = trades.length;
  const wins = trades.filter((trade) => getTradePnl(trade) > 0).length;
  const losses = trades.filter((trade) => getTradePnl(trade) < 0).length;
  const longs = trades.filter((trade) => trade.side === "buy" || (trade.side as string) === "long").length;
  const shorts = trades.filter((trade) => trade.side === "sell" || (trade.side as string) === "short").length;

  const holdTimeSum = trades.reduce((sum, trade) => sum + getTradeHoldTimeMs(trade), 0);
  const avgHoldTimeMs = count > 0 ? holdTimeSum / count : 0;

  const maeValues = trades
    .map((trade) => getTradeMaeAbs(trade))
    .filter((value): value is number => value !== null);
  const mfeValues = trades
    .map((trade) => getTradeMfeAbs(trade))
    .filter((value): value is number => value !== null);
  const maeSum = maeValues.reduce((sum, value) => sum + value, 0);
  const mfeSum = mfeValues.reduce((sum, value) => sum + value, 0);

  const fundingPaid = Math.abs(
    trades
      .map((trade) => Number(trade.funding ?? 0))
      .filter((value) => value < 0)
      .reduce((sum, value) => sum + value, 0)
  );

  const fundingReceived = trades
    .map((trade) => Number(trade.funding ?? 0))
    .filter((value) => value > 0)
    .reduce((sum, value) => sum + value, 0);

  const totalFees = trades.reduce(
    (sum, trade) => sum + Math.abs(Number(trade.fees ?? trade.feeUsd ?? trade.fee ?? 0)),
    0
  );

  return {
    id,
    label,
    count,
    wins,
    losses,
    longs,
    shorts,
    totalPnl,
    avgPnl: count > 0 ? totalPnl / count : 0,
    avgHoldTimeMs,
    avgMae: maeValues.length > 0 ? maeSum / maeValues.length : 0,
    avgMfe: mfeValues.length > 0 ? mfeSum / mfeValues.length : 0,
    fundingPaid,
    fundingReceived,
    totalFees,
    trades,
  };
}

export function buildTagStats(
  trades: JournalTrade[],
  annotations: Record<string, TradeAnnotation>
): AggregatedStat[] {
  const grouped = new Map<StrategyTagId, JournalTrade[]>();

  trades.forEach((trade) => {
    const tagId = annotations[trade.id]?.strategyTag;
    if (!tagId) return;

    if (!grouped.has(tagId)) grouped.set(tagId, []);
    grouped.get(tagId)?.push(trade);
  });

  return Array.from(grouped.entries())
    .map(([id, list]) => makeStat(String(id), String(id), list))
    .sort((a, b) => b.totalPnl - a.totalPnl);
}

export function buildSymbolStats(trades: JournalTrade[]): AggregatedStat[] {
  const grouped = new Map<string, JournalTrade[]>();

  trades.forEach((trade) => {
    const symbol = String(trade.symbol || "UNKNOWN");
    if (!grouped.has(symbol)) grouped.set(symbol, []);
    grouped.get(symbol)?.push(trade);
  });

  return Array.from(grouped.entries())
    .map(([symbol, list]) => makeStat(symbol, symbol, list))
    .sort((a, b) => b.totalPnl - a.totalPnl);
}

export function buildGroupedStats(
  trades: JournalTrade[],
  groups: Array<{ id: string; label: string; match: (trade: JournalTrade) => boolean }>
): AggregatedStat[] {
  return groups.map((group) => {
    const subset = trades.filter(group.match);
    return makeStat(group.id, group.label, subset);
  });
}

export function buildEquityCurve(trades: JournalTrade[], normalizeX = false): DataPoint[] {
  if (!trades.length) return [];

  const sorted = [...trades].sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
  let cumulative = 0;

  return sorted.map((trade, index) => {
    cumulative += getTradePnl(trade);
    return {
      x: normalizeX ? (index / Math.max(1, sorted.length - 1)) * 100 : Number(trade.timestamp),
      y: cumulative,
    };
  });
}

export function buildDrawdownCurve(trades: JournalTrade[]): DataPoint[] {
  const sorted = [...trades].sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
  let cumulative = 0;
  let peak = 0;

  return sorted.map((trade) => {
    cumulative += getTradePnl(trade);
    peak = Math.max(peak, cumulative);
    return {
      x: Number(trade.timestamp),
      y: cumulative - peak,
    };
  });
}

export function winRateFromCounts(wins: number, losses: number): number {
  const decisiveTrades = Math.max(0, wins) + Math.max(0, losses);
  return decisiveTrades > 0 ? (Math.max(0, wins) / decisiveTrades) * 100 : 0;
}

export function valueForMode(stat: AggregatedStat, mode: MetricMode): number {
  if (mode === "count") return stat.count;
  if (mode === "winRate") return winRateFromCounts(stat.wins, stat.losses);
  return stat.totalPnl;
}

export function shortSidePercent(stat: AggregatedStat): number {
  const total = Math.max(1, stat.longs + stat.shorts);
  return (stat.shorts / total) * 100;
}

export function longSidePercent(stat: AggregatedStat): number {
  const total = Math.max(1, stat.longs + stat.shorts);
  return (stat.longs / total) * 100;
}

export function pickColor(index: number): string {
  const palette = [
    "#57d4aa",
    "#5ec8ff",
    "#a78bfa",
    "#fbbf24",
    "#f472b6",
    "#34d399",
    "#22d3ee",
    "#fb7185",
    "#818cf8",
    "#f97316",
    "#84cc16",
  ];

  return palette[index % palette.length];
}
