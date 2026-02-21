"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowDownCircle, ArrowUpCircle, MinusCircle, Scale, TrendingUp } from "lucide-react";
import { useJournal } from "@/contexts/JournalContext";
import { ReportsFiltersBar, ReportsSubnav } from "@/components/Journal/Reports/shared";
import { MultiCurveChart, formatDuration, formatMoney } from "@/components/Journal/Reports/charts";
import { cn } from "@/lib/utils";
import { buildReportBucket } from "@/lib/journal/report-metrics";
import { buildEquityCurve, getTradePnl } from "@/lib/journal/reports";

type MetricRow = {
  label: string;
  winnerValue: number;
  loserValue: number;
  unit: "count" | "percent" | "currency" | "duration" | "ratio";
};

function formatRatio(value: number): string {
  if (!Number.isFinite(value)) return "∞";
  return value.toFixed(2);
}

function formatMetric(value: number, unit: MetricRow["unit"], hideBalances: boolean): string {
  if (unit === "count") return Math.round(value).toString();
  if (unit === "percent") return `${value.toFixed(1)}%`;
  if (unit === "duration") return formatDuration(value);
  if (unit === "ratio") return formatRatio(value);
  return formatMoney(value, hideBalances, true);
}

export default function WinLossReportPage() {
  const { filteredTrades, annotations, preferences, isLoading } = useJournal();

  const closedTrades = useMemo(() => filteredTrades.filter((trade) => !trade.isOpen), [filteredTrades]);
  const winnerTrades = useMemo(() => closedTrades.filter((trade) => getTradePnl(trade) > 0), [closedTrades]);
  const loserTrades = useMemo(() => closedTrades.filter((trade) => getTradePnl(trade) < 0), [closedTrades]);
  const breakevenTrades = useMemo(() => closedTrades.filter((trade) => getTradePnl(trade) === 0), [closedTrades]);

  const winnersBucket = useMemo(
    () => buildReportBucket("winners", "Winners", winnerTrades, annotations),
    [winnerTrades, annotations]
  );
  const losersBucket = useMemo(
    () => buildReportBucket("losers", "Losers", loserTrades, annotations),
    [loserTrades, annotations]
  );

  const curves = useMemo(
    () => [
      {
        id: "winners_curve",
        label: "Winners",
        color: "#34d399",
        points: buildEquityCurve(winnerTrades),
      },
      {
        id: "losers_curve",
        label: "Losers",
        color: "#fb7185",
        points: buildEquityCurve(loserTrades),
      },
    ],
    [winnerTrades, loserTrades]
  );

  const comparisonRows: MetricRow[] = useMemo(
    () => [
      { label: "Trade Count", winnerValue: winnersBucket.count, loserValue: losersBucket.count, unit: "count" },
      { label: "Avg PnL", winnerValue: winnersBucket.avgPnl, loserValue: losersBucket.avgPnl, unit: "currency" },
      { label: "Net PnL", winnerValue: winnersBucket.totalPnl, loserValue: losersBucket.totalPnl, unit: "currency" },
      { label: "Avg Hold", winnerValue: winnersBucket.avgHoldTimeMs, loserValue: losersBucket.avgHoldTimeMs, unit: "duration" },
      { label: "Avg Volume", winnerValue: winnersBucket.avgVolume, loserValue: losersBucket.avgVolume, unit: "currency" },
      { label: "Avg R", winnerValue: winnersBucket.avgRMultiple, loserValue: losersBucket.avgRMultiple, unit: "ratio" },
      { label: "Profit Factor", winnerValue: winnersBucket.profitFactor, loserValue: losersBucket.profitFactor, unit: "ratio" },
      { label: "Largest PnL", winnerValue: winnersBucket.largestWin, loserValue: losersBucket.largestLoss, unit: "currency" },
    ],
    [losersBucket, winnersBucket]
  );

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
        <h2 className="text-4xl font-black text-white">Win vs Loss Report</h2>

        <ReportsFiltersBar />

        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-3">
          <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 p-3.5">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500 inline-flex items-center gap-1.5">
              <ArrowUpCircle className="w-3.5 h-3.5 text-emerald-400" />
              Winners
            </p>
            <p className="text-2xl font-bold text-zinc-100 mt-1">{winnersBucket.count}</p>
            <p className="text-xs text-emerald-400 mt-1">{formatMoney(winnersBucket.totalPnl, preferences.hideBalances, true)}</p>
          </div>
          <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 p-3.5">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500 inline-flex items-center gap-1.5">
              <ArrowDownCircle className="w-3.5 h-3.5 text-rose-400" />
              Losers
            </p>
            <p className="text-2xl font-bold text-zinc-100 mt-1">{losersBucket.count}</p>
            <p className="text-xs text-rose-400 mt-1">{formatMoney(losersBucket.totalPnl, preferences.hideBalances, true)}</p>
          </div>
          <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 p-3.5">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500 inline-flex items-center gap-1.5">
              <MinusCircle className="w-3.5 h-3.5 text-zinc-400" />
              Breakeven
            </p>
            <p className="text-2xl font-bold text-zinc-100 mt-1">{breakevenTrades.length}</p>
          </div>
          <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 p-3.5">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500 inline-flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-emerald-400" />
              Win/Loss Ratio
            </p>
            <p className="text-2xl font-bold text-zinc-100 mt-1">
              {losersBucket.count > 0 ? (winnersBucket.count / losersBucket.count).toFixed(2) : "∞"}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 p-4">
          <h3 className="text-lg font-bold text-zinc-100 inline-flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            Cumulative Curves
          </h3>
          <MultiCurveChart curves={curves} />
        </div>

        <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-zinc-800/70">
            <h3 className="text-sm font-semibold text-zinc-100">Side-by-Side Metric Comparison</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800/70">
                  <th className="px-3 py-2">Metric</th>
                  <th className="px-3 py-2">Winners</th>
                  <th className="px-3 py-2">Losers</th>
                  <th className="px-3 py-2">Delta</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => {
                  const delta = row.winnerValue - row.loserValue;
                  return (
                    <tr key={row.label} className="border-b border-zinc-900/60">
                      <td className="px-3 py-2.5 text-sm text-zinc-200">{row.label}</td>
                      <td className={cn("px-3 py-2.5 text-sm", row.winnerValue >= 0 ? "text-emerald-400" : "text-rose-400")}>
                        {formatMetric(row.winnerValue, row.unit, preferences.hideBalances)}
                      </td>
                      <td className={cn("px-3 py-2.5 text-sm", row.loserValue >= 0 ? "text-emerald-400" : "text-rose-400")}>
                        {formatMetric(row.loserValue, row.unit, preferences.hideBalances)}
                      </td>
                      <td className={cn("px-3 py-2.5 text-sm font-semibold", delta >= 0 ? "text-emerald-400" : "text-rose-400")}>
                        {formatMetric(delta, row.unit, preferences.hideBalances)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
