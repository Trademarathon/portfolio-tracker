import { format, startOfWeek } from "date-fns";
import type { JournalTrade } from "@/contexts/JournalContext";
import { getTradeHoldTimeMs, getTradePnl, getTradeVolume, winRateFromCounts } from "@/lib/journal/reports";

export type WidgetTimeframe = "year" | "month" | "week" | "day";
export type WidgetSideFilter = "all" | "long" | "short";

export interface WidgetBucket {
  key: string;
  label: string;
  timestamp: number;
  count: number;
  wins: number;
  losses: number;
  pnl: number;
  cumulativePnl: number;
  volume: number;
  cumulativeVolume: number;
  fees: number;
  cumulativeFees: number;
  winRate: number;
  holdHours: number;
  biggestWin: number;
  biggestLoss: number;
  profitFactor: number;
  lossFactor: number;
}

function sideMatches(trade: JournalTrade, sideFilter: WidgetSideFilter): boolean {
  if (sideFilter === "all") return true;

  const isLong = trade.side === "buy" || (trade.side as string) === "long";
  return sideFilter === "long" ? isLong : !isLong;
}

function bucketInfo(timestamp: number, timeframe: WidgetTimeframe): {
  key: string;
  label: string;
  ts: number;
} {
  const date = new Date(timestamp);

  switch (timeframe) {
    case "year": {
      const year = date.getUTCFullYear();
      return {
        key: `y_${year}`,
        label: `${year}`,
        ts: Date.UTC(year, 0, 1),
      };
    }
    case "month": {
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth();
      return {
        key: `m_${year}_${month}`,
        label: format(new Date(Date.UTC(year, month, 1)), "MMM"),
        ts: Date.UTC(year, month, 1),
      };
    }
    case "week": {
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      return {
        key: `w_${weekStart.getUTCFullYear()}_${weekStart.getUTCMonth()}_${weekStart.getUTCDate()}`,
        label: format(weekStart, "MMM d"),
        ts: weekStart.getTime(),
      };
    }
    case "day":
    default: {
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth();
      const day = date.getUTCDate();
      return {
        key: `d_${year}_${month}_${day}`,
        label: format(new Date(Date.UTC(year, month, day)), "MMM d"),
        ts: Date.UTC(year, month, day),
      };
    }
  }
}

export function buildWidgetBuckets(
  trades: JournalTrade[],
  timeframe: WidgetTimeframe,
  sideFilter: WidgetSideFilter = "all"
): WidgetBucket[] {
  const filtered = (trades || [])
    .filter((trade) => !trade.isOpen)
    .filter((trade) => sideMatches(trade, sideFilter))
    .sort((a, b) => Number(a.timestamp) - Number(b.timestamp));

  const grouped = new Map<
    string,
    {
      label: string;
      ts: number;
      trades: JournalTrade[];
    }
  >();

  filtered.forEach((trade) => {
    const info = bucketInfo(Number(trade.timestamp), timeframe);
    if (!grouped.has(info.key)) {
      grouped.set(info.key, { label: info.label, ts: info.ts, trades: [] });
    }
    grouped.get(info.key)?.trades.push(trade);
  });

  const rows = Array.from(grouped.entries())
    .map(([key, group]) => {
      const pnl = group.trades.reduce((sum, trade) => sum + getTradePnl(trade), 0);
      const volume = group.trades.reduce((sum, trade) => sum + getTradeVolume(trade), 0);
      const fees = group.trades.reduce(
        (sum, trade) => sum + Math.abs(Number(trade.fees ?? trade.feeUsd ?? trade.fee ?? 0)),
        0
      );

      const wins = group.trades.filter((trade) => getTradePnl(trade) > 0).length;
      const losses = group.trades.filter((trade) => getTradePnl(trade) < 0).length;

      const grossProfit = group.trades
        .map((trade) => getTradePnl(trade))
        .filter((value) => value > 0)
        .reduce((sum, value) => sum + value, 0);

      const grossLoss = Math.abs(
        group.trades
          .map((trade) => getTradePnl(trade))
          .filter((value) => value < 0)
          .reduce((sum, value) => sum + value, 0)
      );

      const holdMs = group.trades.reduce((sum, trade) => sum + getTradeHoldTimeMs(trade), 0);

      const biggestWin = Math.max(0, ...group.trades.map((trade) => getTradePnl(trade)));
      const biggestLoss = Math.min(0, ...group.trades.map((trade) => getTradePnl(trade)));

      return {
        key,
        label: group.label,
        timestamp: group.ts,
        count: group.trades.length,
        wins,
        losses,
        pnl,
        cumulativePnl: 0,
        volume,
        cumulativeVolume: 0,
        fees,
        cumulativeFees: 0,
        winRate: winRateFromCounts(wins, losses),
        holdHours: group.trades.length > 0 ? holdMs / group.trades.length / (1000 * 60 * 60) : 0,
        biggestWin,
        biggestLoss,
        profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
        lossFactor: losses > 0 ? grossLoss / losses : 0,
      } satisfies WidgetBucket;
    })
    .sort((a, b) => a.timestamp - b.timestamp);

  let cumulativePnl = 0;
  let cumulativeVolume = 0;
  let cumulativeFees = 0;

  return rows.map((row) => {
    cumulativePnl += row.pnl;
    cumulativeVolume += row.volume;
    cumulativeFees += row.fees;

    return {
      ...row,
      cumulativePnl,
      cumulativeVolume,
      cumulativeFees,
    };
  });
}

export function valueForWidget(widgetId: string, bucket: WidgetBucket): number {
  switch (widgetId) {
    case "pnl_cumulative":
      return bucket.cumulativePnl;
    case "win_rate":
      return bucket.winRate;
    case "pnl":
      return bucket.pnl;
    case "hold_time":
      return bucket.holdHours;
    case "volume_cumulative":
      return bucket.cumulativeVolume;
    case "total_trades":
      return bucket.count;
    case "biggest_loss":
      return bucket.biggestLoss;
    case "biggest_profit":
      return bucket.biggestWin;
    case "fees":
      return bucket.fees;
    case "fees_cumulative":
      return bucket.cumulativeFees;
    case "loss_factor":
      return bucket.lossFactor;
    case "profit_factor":
      return bucket.profitFactor;
    default:
      return 0;
  }
}

export function isLineWidget(widgetId: string): boolean {
  return widgetId === "pnl_cumulative" || widgetId === "volume_cumulative" || widgetId === "fees_cumulative" || widgetId === "hold_time";
}

export function unitForWidget(widgetId: string): "currency" | "percent" | "count" | "hours" | "ratio" {
  switch (widgetId) {
    case "win_rate":
      return "percent";
    case "total_trades":
      return "count";
    case "hold_time":
      return "hours";
    case "profit_factor":
    case "loss_factor":
      return "ratio";
    default:
      return "currency";
  }
}

export function widgetTone(widgetId: string, value: number): "positive" | "negative" | "neutral" {
  if (widgetId === "total_trades" || widgetId === "win_rate" || widgetId === "profit_factor") return "positive";
  if (widgetId === "biggest_loss" || widgetId === "loss_factor" || widgetId === "fees" || widgetId === "fees_cumulative") return "negative";
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}
