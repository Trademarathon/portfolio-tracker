"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { useJournal } from "@/contexts/JournalContext";
import { STRATEGY_TAGS } from "@/lib/api/journal-types";
import {
  DAY_LABELS,
  HOLD_BUCKETS,
  buildGroupedStats,
  buildTagStats,
  getClosedTrades,
  getTradeVolume,
  winRateFromCounts,
  type AggregatedStat,
  type MetricMode,
  valueForMode,
} from "@/lib/journal/reports";
import { cn } from "@/lib/utils";
import {
  LongShortBar,
  ModeToggle,
  PerformanceBars,
  formatDuration,
  formatMoney,
} from "@/components/Journal/Reports/charts";
import { ReportsFiltersBar, ReportsSubnav } from "@/components/Journal/Reports/shared";

type SortField = "tag" | "count" | "winRate" | "avgPnl" | "totalPnl" | "hold";

function statWinRate(stat: AggregatedStat): number {
  return winRateFromCounts(stat.wins, stat.losses);
}

export default function TagsReportPage() {
  const { filteredTrades, annotations, preferences, isLoading } = useJournal();

  const [mode, setMode] = useState<MetricMode>("pnl");
  const [sortField, setSortField] = useState<SortField>("totalPnl");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const closedTrades = useMemo(() => getClosedTrades(filteredTrades), [filteredTrades]);

  const tagStats = useMemo(() => {
    const raw = buildTagStats(closedTrades, annotations);
    return raw.map((item) => {
      const meta = STRATEGY_TAGS.find((tag) => tag.id === item.id);
      return {
        ...item,
        label: meta?.name ?? item.id,
        color: meta?.color ?? "#57d4aa",
      };
    });
  }, [annotations, closedTrades]);

  const sortedStats = useMemo(() => {
    const next = [...tagStats].sort((a, b) => {
      let left: number | string = 0;
      let right: number | string = 0;

      switch (sortField) {
        case "tag":
          left = a.label.toLowerCase();
          right = b.label.toLowerCase();
          break;
        case "count":
          left = a.count;
          right = b.count;
          break;
        case "winRate":
          left = statWinRate(a);
          right = statWinRate(b);
          break;
        case "avgPnl":
          left = a.avgPnl;
          right = b.avgPnl;
          break;
        case "totalPnl":
          left = a.totalPnl;
          right = b.totalPnl;
          break;
        case "hold":
          left = a.avgHoldTimeMs;
          right = b.avgHoldTimeMs;
          break;
      }

      if (typeof left === "string" && typeof right === "string") {
        return sortDirection === "asc" ? left.localeCompare(right) : right.localeCompare(left);
      }

      return sortDirection === "asc" ? Number(left) - Number(right) : Number(right) - Number(left);
    });

    return next;
  }, [sortDirection, sortField, tagStats]);

  const chartData = useMemo(
    () => [...sortedStats].sort((a, b) => Math.abs(valueForMode(b, mode)) - Math.abs(valueForMode(a, mode))).slice(0, 12),
    [mode, sortedStats]
  );

  const topInsight = sortedStats[0];

  const bestWinRate =
    sortedStats.length > 0
      ? [...sortedStats].sort((a, b) => statWinRate(b) - statWinRate(a))[0]
      : null;

  const averagePnl =
    topInsight && topInsight.count > 0
      ? topInsight.totalPnl / topInsight.count
      : 0;

  const averageSize =
    topInsight && topInsight.count > 0
      ? topInsight.trades.reduce((sum, trade) => sum + getTradeVolume(trade), 0) / topInsight.count
      : 0;

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortDirection("desc");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-12 gap-4">
      <div className="col-span-12 xl:col-span-2">
        <ReportsSubnav />
      </div>

      <div className="col-span-12 xl:col-span-10 space-y-4">
        <h2 className="text-4xl font-black text-white">Tags Report</h2>

        <ReportsFiltersBar />

        <div className="grid grid-cols-1 2xl:grid-cols-3 gap-3">
          <div className="2xl:col-span-2 rounded-xl border border-zinc-800/70 bg-zinc-900/35 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Performance report</h3>
              <ModeToggle value={mode} onChange={setMode} />
            </div>
            <PerformanceBars stats={chartData} mode={mode} hideBalances={preferences.hideBalances} />
          </div>

          <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 p-4">
            <div className="flex items-center gap-2 mb-3 text-zinc-200">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <h3 className="text-lg font-bold">Insights</h3>
            </div>

            {topInsight ? (
              <div className="space-y-3 text-sm text-zinc-400">
                <p>
                  The <span className="text-zinc-100 font-semibold">"{topInsight.label}"</span> tag had the best impact on your
                  PnL, with a total return of <span className="text-emerald-400 font-semibold">{formatMoney(topInsight.totalPnl, preferences.hideBalances, true)}</span>.
                </p>
                <p className="text-xs text-zinc-500">
                  Trades with this tag had a win rate of {statWinRate(topInsight).toFixed(1)}%, average hold time {formatDuration(topInsight.avgHoldTimeMs)}, and average size {formatMoney(averageSize, preferences.hideBalances)}.
                </p>

                <div className="pt-2 border-t border-zinc-800/70 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span>Average PnL</span>
                    <span className="text-emerald-400 font-semibold">{formatMoney(averagePnl, preferences.hideBalances, true)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Win rate</span>
                    <span className="text-zinc-300 font-semibold">{statWinRate(topInsight).toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Average size</span>
                    <span className="text-zinc-300 font-semibold">{formatMoney(averageSize, preferences.hideBalances)}</span>
                  </div>
                  {bestWinRate ? (
                    <div className="flex items-center justify-between">
                      <span>Best win rate</span>
                      <span className="text-zinc-300 font-semibold">
                        {bestWinRate.label} ({statWinRate(bestWinRate).toFixed(0)}%)
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No tagged trades found in current filters.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="text-left border-b border-zinc-800/70 text-[11px] uppercase tracking-wider text-zinc-500">
                  <th className="px-3 py-3 cursor-pointer" onClick={() => handleSort("tag")}>Tag</th>
                  <th className="px-3 py-3 cursor-pointer" onClick={() => handleSort("count")}>Trade Count</th>
                  <th className="px-3 py-3 cursor-pointer" onClick={() => handleSort("winRate")}>Win Rate (%)</th>
                  <th className="px-3 py-3">Longs vs Shorts</th>
                  <th className="px-3 py-3 cursor-pointer" onClick={() => handleSort("hold")}>Avg HoldTime</th>
                  <th className="px-3 py-3 cursor-pointer" onClick={() => handleSort("avgPnl")}>Avg PnL</th>
                  <th className="px-3 py-3 cursor-pointer" onClick={() => handleSort("totalPnl")}>Total PnL</th>
                  <th className="px-3 py-3 w-10" />
                </tr>
              </thead>

              <tbody>
                {sortedStats.map((stat) => {
                  const isExpanded = expandedId === stat.id;

                  const detailDayStats = buildGroupedStats(
                    stat.trades,
                    DAY_LABELS.map((day) => ({
                      id: day.id,
                      label: day.label,
                      match: (trade) => new Date(trade.timestamp).getUTCDay() === day.day,
                    }))
                  );

                  const detailTimeStats = buildGroupedStats(
                    stat.trades,
                    [0, 4, 8, 12, 16, 20].map((hour) => ({
                      id: `h_${hour}`,
                      label: `${String(hour).padStart(2, "0")}-${String((hour + 4) % 24).padStart(2, "0")}`,
                      match: (trade) => {
                        const h = new Date(trade.timestamp).getUTCHours();
                        return h >= hour && h < hour + 4;
                      },
                    }))
                  );

                  const detailHoldStats = buildGroupedStats(
                    stat.trades,
                    HOLD_BUCKETS.slice(0, 8).map((bucket) => ({
                      id: bucket.id,
                      label: bucket.label,
                      match: (trade) => {
                        const hold = Number(trade.holdTime ?? 0);
                        return hold >= bucket.min && hold < bucket.max;
                      },
                    }))
                  );

                  return (
                    <>
                      <tr key={stat.id} className="border-b border-zinc-900 hover:bg-zinc-900/50 transition-colors">
                        <td className="px-3 py-3">
                          <span
                            className="inline-flex items-center rounded px-2 py-1 text-xs font-medium"
                            style={{ backgroundColor: `${(stat as { color?: string }).color ?? "#57d4aa"}33`, color: (stat as { color?: string }).color ?? "#57d4aa" }}
                          >
                            {stat.label}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-sm text-zinc-300">{stat.count}</td>
                        <td className="px-3 py-3 text-sm text-zinc-200">{statWinRate(stat).toFixed(0)}%</td>
                        <td className="px-3 py-3"><LongShortBar longs={stat.longs} shorts={stat.shorts} /></td>
                        <td className="px-3 py-3">
                          <span className="text-xs font-medium text-blue-200 bg-blue-500/20 px-2 py-1 rounded">{formatDuration(stat.avgHoldTimeMs)}</span>
                        </td>
                        <td className={cn("px-3 py-3 text-sm font-semibold", stat.avgPnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                          {formatMoney(stat.avgPnl, preferences.hideBalances, true)}
                        </td>
                        <td className={cn("px-3 py-3 text-sm font-semibold", stat.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                          {formatMoney(stat.totalPnl, preferences.hideBalances, true)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : stat.id)}
                            className="inline-flex items-center justify-center w-7 h-7 rounded bg-zinc-800 text-zinc-300"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>

                      {isExpanded ? (
                        <tr>
                          <td colSpan={8} className="px-3 pb-3 bg-zinc-950/35">
                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 pt-3">
                              <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/40 p-3">
                                <h4 className="text-sm font-semibold text-zinc-200 mb-2">Day of Week</h4>
                                <PerformanceBars stats={detailDayStats} mode="pnl" hideBalances={preferences.hideBalances} />
                              </div>
                              <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/40 p-3">
                                <h4 className="text-sm font-semibold text-zinc-200 mb-2">Time of Day (UTC)</h4>
                                <PerformanceBars stats={detailTimeStats} mode="pnl" hideBalances={preferences.hideBalances} />
                              </div>
                              <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/40 p-3">
                                <h4 className="text-sm font-semibold text-zinc-200 mb-2">Holdtime vs PnL</h4>
                                <PerformanceBars stats={detailHoldStats} mode="pnl" hideBalances={preferences.hideBalances} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </>
                  );
                })}

                {sortedStats.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-sm text-zinc-500">
                      No tagged trades found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
