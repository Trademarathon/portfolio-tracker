import type { JournalTrade } from "@/contexts/JournalContext";
import type { TradeAnnotation } from "@/lib/api/journal-types";
import { getTradeHoldTimeMs, getTradePnl, getTradeVolume, winRateFromCounts } from "@/lib/journal/reports";

export type ReportMetricId =
  | "tradeCount"
  | "winRate"
  | "netPnl"
  | "avgPnl"
  | "avgHoldTime"
  | "avgVolume"
  | "avgRMultiple"
  | "profitFactor"
  | "largestWin"
  | "largestLoss";

export type MetricUnit = "count" | "percent" | "currency" | "duration" | "ratio";

export interface ReportMetricSpec {
  id: ReportMetricId;
  label: string;
  unit: MetricUnit;
  description: string;
}

export interface ReportBucket {
  id: string;
  label: string;
  trades: JournalTrade[];
  count: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  avgHoldTimeMs: number;
  totalVolume: number;
  avgVolume: number;
  avgRMultiple: number;
  rCoverage: number;
  profitFactor: number;
  largestWin: number;
  largestLoss: number;
}

export interface ReportSummary {
  count: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  avgHoldTimeMs: number;
  totalVolume: number;
  avgVolume: number;
  avgRMultiple: number;
  rCoverage: number;
  profitFactor: number;
  largestWin: number;
  largestLoss: number;
}

export const REPORT_METRICS: ReportMetricSpec[] = [
  { id: "tradeCount", label: "Trade Count", unit: "count", description: "Number of trades in the selected group." },
  { id: "winRate", label: "Win Rate", unit: "percent", description: "Winning trades divided by winning + losing trades." },
  { id: "netPnl", label: "Net PnL", unit: "currency", description: "Total net profit and loss." },
  { id: "avgPnl", label: "Average PnL", unit: "currency", description: "Average net PnL per trade." },
  { id: "avgHoldTime", label: "Avg Hold Time", unit: "duration", description: "Average hold duration in milliseconds." },
  { id: "avgVolume", label: "Avg Volume", unit: "currency", description: "Average notional size per trade." },
  { id: "avgRMultiple", label: "Avg R-Multiple", unit: "ratio", description: "Average realized R from trades with valid stop-based risk." },
  { id: "profitFactor", label: "Profit Factor", unit: "ratio", description: "Gross profit divided by gross loss." },
  { id: "largestWin", label: "Largest Win", unit: "currency", description: "Largest winning trade PnL." },
  { id: "largestLoss", label: "Largest Loss", unit: "currency", description: "Largest losing trade PnL." },
];

export type GroupDefinition = {
  id: string;
  label: string;
  match: (trade: JournalTrade) => boolean;
};

function toFiniteNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function getTradeEntryPrice(trade: JournalTrade): number {
  return toFiniteNumber(trade.entryPrice ?? trade.price);
}

export function getTradeExitPrice(trade: JournalTrade): number {
  return toFiniteNumber(trade.exitPrice ?? trade.price);
}

export function getTradePositionSize(trade: JournalTrade): number {
  const explicit = toFiniteNumber(trade.cost);
  if (explicit > 0) return explicit;
  const amount = Math.abs(toFiniteNumber(trade.amount));
  const entry = getTradeEntryPrice(trade);
  return amount * entry;
}

export function getAnnotationStopPrice(annotation?: TradeAnnotation): number | null {
  if (!annotation || !Array.isArray(annotation.stops)) return null;
  for (const stop of annotation.stops) {
    const value = Number(stop?.price);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

export function getInitialRiskUsd(trade: JournalTrade, annotation?: TradeAnnotation): number | null {
  const entry = getTradeEntryPrice(trade);
  const stop = getAnnotationStopPrice(annotation);
  const amount = Math.abs(toFiniteNumber(trade.amount));
  if (entry <= 0 || !stop || amount <= 0) return null;
  const risk = Math.abs(entry - stop) * amount;
  return risk > 0 ? risk : null;
}

export function getRealizedRMultiple(trade: JournalTrade, annotation?: TradeAnnotation): number | null {
  const risk = getInitialRiskUsd(trade, annotation);
  if (!risk || risk <= 0) return null;
  return getTradePnl(trade) / risk;
}

export function getPlannedRMultiple(trade: JournalTrade, annotation?: TradeAnnotation): number | null {
  if (!annotation) return null;
  const entry = getTradeEntryPrice(trade);
  const stop = getAnnotationStopPrice(annotation);
  const target = Array.isArray(annotation.targets)
    ? annotation.targets.map((level) => Number(level?.price)).find((value) => Number.isFinite(value) && value > 0)
    : null;

  if (!stop || !target || entry <= 0) return null;

  const isLong = trade.side === "buy" || String(trade.side).toLowerCase() === "long";
  const reward = isLong ? target - entry : entry - target;
  const risk = isLong ? entry - stop : stop - entry;

  if (!Number.isFinite(reward) || !Number.isFinite(risk) || reward <= 0 || risk <= 0) return null;
  return reward / risk;
}

export function buildReportBucket(
  id: string,
  label: string,
  trades: JournalTrade[],
  annotations: Record<string, TradeAnnotation>
): ReportBucket {
  const count = trades.length;
  const totalPnl = trades.reduce((sum, trade) => sum + getTradePnl(trade), 0);
  const wins = trades.filter((trade) => getTradePnl(trade) > 0).length;
  const losses = trades.filter((trade) => getTradePnl(trade) < 0).length;

  const holdSum = trades.reduce((sum, trade) => sum + getTradeHoldTimeMs(trade), 0);
  const totalVolume = trades.reduce((sum, trade) => sum + getTradeVolume(trade), 0);

  const realizedRs = trades
    .map((trade) => getRealizedRMultiple(trade, annotations[trade.id]))
    .filter((value): value is number => value !== null && Number.isFinite(value));

  const grossProfit = trades
    .map((trade) => getTradePnl(trade))
    .filter((value) => value > 0)
    .reduce((sum, value) => sum + value, 0);

  const grossLoss = Math.abs(
    trades
      .map((trade) => getTradePnl(trade))
      .filter((value) => value < 0)
      .reduce((sum, value) => sum + value, 0)
  );

  return {
    id,
    label,
    trades,
    count,
    wins,
    losses,
    winRate: winRateFromCounts(wins, losses),
    totalPnl,
    avgPnl: count > 0 ? totalPnl / count : 0,
    avgHoldTimeMs: count > 0 ? holdSum / count : 0,
    totalVolume,
    avgVolume: count > 0 ? totalVolume / count : 0,
    avgRMultiple: realizedRs.length > 0 ? realizedRs.reduce((sum, value) => sum + value, 0) / realizedRs.length : 0,
    rCoverage: count > 0 ? (realizedRs.length / count) * 100 : 0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
    largestWin: count > 0 ? Math.max(0, ...trades.map((trade) => getTradePnl(trade))) : 0,
    largestLoss: count > 0 ? Math.min(0, ...trades.map((trade) => getTradePnl(trade))) : 0,
  };
}

export function buildReportSummary(
  trades: JournalTrade[],
  annotations: Record<string, TradeAnnotation>
): ReportSummary {
  const bucket = buildReportBucket("all", "All trades", trades, annotations);
  return {
    count: bucket.count,
    wins: bucket.wins,
    losses: bucket.losses,
    winRate: bucket.winRate,
    totalPnl: bucket.totalPnl,
    avgPnl: bucket.avgPnl,
    avgHoldTimeMs: bucket.avgHoldTimeMs,
    totalVolume: bucket.totalVolume,
    avgVolume: bucket.avgVolume,
    avgRMultiple: bucket.avgRMultiple,
    rCoverage: bucket.rCoverage,
    profitFactor: bucket.profitFactor,
    largestWin: bucket.largestWin,
    largestLoss: bucket.largestLoss,
  };
}

export function buildBucketsFromGroups(
  trades: JournalTrade[],
  annotations: Record<string, TradeAnnotation>,
  groups: GroupDefinition[]
): ReportBucket[] {
  return groups
    .map((group) => buildReportBucket(group.id, group.label, trades.filter(group.match), annotations))
    .filter((bucket) => bucket.count > 0);
}

export function metricValueFromBucket(bucket: ReportBucket, metricId: ReportMetricId): number {
  switch (metricId) {
    case "tradeCount":
      return bucket.count;
    case "winRate":
      return bucket.winRate;
    case "netPnl":
      return bucket.totalPnl;
    case "avgPnl":
      return bucket.avgPnl;
    case "avgHoldTime":
      return bucket.avgHoldTimeMs;
    case "avgVolume":
      return bucket.avgVolume;
    case "avgRMultiple":
      return bucket.avgRMultiple;
    case "profitFactor":
      return bucket.profitFactor;
    case "largestWin":
      return bucket.largestWin;
    case "largestLoss":
      return bucket.largestLoss;
    default:
      return 0;
  }
}
