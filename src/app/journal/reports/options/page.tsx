"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { CalendarClock, CircleDotDashed, Scale, Target } from "lucide-react";
import { useJournal, type JournalTrade } from "@/contexts/JournalContext";
import { ReportsFiltersBar, ReportsSubnav } from "@/components/Journal/Reports/shared";
import { formatMoney } from "@/components/Journal/Reports/charts";
import { cn } from "@/lib/utils";
import { buildBucketsFromGroups, buildReportSummary } from "@/lib/journal/report-metrics";
import { buildOptionDteBuckets } from "@/lib/journal/options-metrics";

function getOptionType(trade: JournalTrade): string {
  const info = trade.info && typeof trade.info === "object" ? (trade.info as Record<string, unknown>) : {};
  const raw = String((trade as unknown as { optionType?: unknown }).optionType ?? info.optionType ?? "").toLowerCase();
  if (raw === "call" || raw === "c") return "call";
  if (raw === "put" || raw === "p") return "put";
  return "unknown";
}

function getTradeDte(trade: JournalTrade): number | null {
  const info = trade.info && typeof trade.info === "object" ? (trade.info as Record<string, unknown>) : {};
  const raw = Number((trade as unknown as { dte?: unknown }).dte ?? info.dte ?? info.daysToExpiry);
  return Number.isFinite(raw) && raw >= 0 ? raw : null;
}

function isOptionTrade(trade: JournalTrade): boolean {
  const info = trade.info && typeof trade.info === "object" ? (trade.info as Record<string, unknown>) : {};
  const instrument = String((trade as unknown as { instrumentType?: unknown }).instrumentType ?? info.instrumentType ?? "").toLowerCase();
  if (instrument === "option") return true;
  if (getOptionType(trade) !== "unknown") return true;
  if (Number.isFinite(Number((trade as unknown as { strike?: unknown }).strike))) return true;
  if (Number.isFinite(Number((trade as unknown as { expiration?: unknown }).expiration))) return true;
  if (getTradeDte(trade) !== null) return true;
  return false;
}

export default function OptionsReportPage() {
  const { filteredTrades, annotations, preferences, isLoading } = useJournal();

  const closedTrades = useMemo(() => filteredTrades.filter((trade) => !trade.isOpen), [filteredTrades]);
  const optionTrades = useMemo(() => closedTrades.filter((trade) => isOptionTrade(trade)), [closedTrades]);

  const summary = useMemo(() => buildReportSummary(optionTrades, annotations), [optionTrades, annotations]);

  const dteBuckets = useMemo(() => buildOptionDteBuckets(optionTrades), [optionTrades]);

  const callPutBuckets = useMemo(
    () =>
      buildBucketsFromGroups(optionTrades, annotations, [
        { id: "call", label: "Calls", match: (trade) => getOptionType(trade) === "call" },
        { id: "put", label: "Puts", match: (trade) => getOptionType(trade) === "put" },
        { id: "unknown", label: "Unknown Type", match: (trade) => getOptionType(trade) === "unknown" },
      ]),
    [optionTrades, annotations]
  );

  const dteCoverage = useMemo(() => {
    if (optionTrades.length === 0) return 0;
    const withDte = optionTrades.filter((trade) => getTradeDte(trade) !== null).length;
    return (withDte / optionTrades.length) * 100;
  }, [optionTrades]);

  const averageDte = useMemo(() => {
    const values = optionTrades.map((trade) => getTradeDte(trade)).filter((value): value is number => value !== null);
    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [optionTrades]);

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
        <h2 className="text-4xl font-black text-white">Options Report</h2>

        <ReportsFiltersBar />

        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-3">
          <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 p-3.5">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500 inline-flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-emerald-400" />
              Option Trades
            </p>
            <p className="text-2xl font-bold text-zinc-100 mt-1">{summary.count}</p>
            <p className="text-xs text-zinc-500 mt-1">
              {closedTrades.length > 0 ? `${((summary.count / closedTrades.length) * 100).toFixed(0)}% of closed trades` : "0% of closed trades"}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 p-3.5">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500 inline-flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5 text-emerald-400" />
              DTE Coverage
            </p>
            <p className="text-2xl font-bold text-zinc-100 mt-1">{dteCoverage.toFixed(0)}%</p>
            <p className="text-xs text-zinc-500 mt-1">Avg DTE: {averageDte === null ? "N/A" : `${averageDte.toFixed(1)} days`}</p>
          </div>
          <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 p-3.5">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500 inline-flex items-center gap-1.5">
              <CircleDotDashed className="w-3.5 h-3.5 text-emerald-400" />
              Win Rate
            </p>
            <p className="text-2xl font-bold text-zinc-100 mt-1">{summary.winRate.toFixed(1)}%</p>
          </div>
          <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 p-3.5">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500 inline-flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-emerald-400" />
              Net PnL
            </p>
            <p className={cn("text-2xl font-bold mt-1", summary.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
              {formatMoney(summary.totalPnl, preferences.hideBalances, true)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-3">
          <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 overflow-hidden">
            <div className="px-3 py-2.5 border-b border-zinc-800/70">
              <h3 className="text-sm font-semibold text-zinc-100">DTE Distribution</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800/70">
                    <th className="px-3 py-2">Bucket</th>
                    <th className="px-3 py-2">Trades</th>
                    <th className="px-3 py-2">Net PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {dteBuckets.map((bucket) => (
                    <tr key={bucket.id} className="border-b border-zinc-900/60">
                      <td className="px-3 py-2.5 text-sm text-zinc-200">{bucket.label}</td>
                      <td className="px-3 py-2.5 text-sm text-zinc-400">{bucket.count}</td>
                      <td className={cn("px-3 py-2.5 text-sm font-semibold", bucket.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                        {formatMoney(bucket.totalPnl, preferences.hideBalances, true)}
                      </td>
                    </tr>
                  ))}
                  {dteBuckets.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-8 text-center text-sm text-zinc-500">
                        No DTE values found in current option trades.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 overflow-hidden">
            <div className="px-3 py-2.5 border-b border-zinc-800/70">
              <h3 className="text-sm font-semibold text-zinc-100">Option Type Performance</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800/70">
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Trades</th>
                    <th className="px-3 py-2">Win Rate</th>
                    <th className="px-3 py-2">Net PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {callPutBuckets.map((bucket) => (
                    <tr key={bucket.id} className="border-b border-zinc-900/60">
                      <td className="px-3 py-2.5 text-sm text-zinc-200">{bucket.label}</td>
                      <td className="px-3 py-2.5 text-sm text-zinc-400">{bucket.count}</td>
                      <td className="px-3 py-2.5 text-sm text-zinc-300">{bucket.winRate.toFixed(1)}%</td>
                      <td className={cn("px-3 py-2.5 text-sm font-semibold", bucket.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                        {formatMoney(bucket.totalPnl, preferences.hideBalances, true)}
                      </td>
                    </tr>
                  ))}
                  {callPutBuckets.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-sm text-zinc-500">
                        No option trades in current filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
