"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { BookOpenCheck, Layers3, Scale, Sparkles } from "lucide-react";
import { useJournal, type JournalTrade } from "@/contexts/JournalContext";
import { ReportsFiltersBar, ReportsSubnav } from "@/components/Journal/Reports/shared";
import { formatDuration, formatMoney } from "@/components/Journal/Reports/charts";
import { cn } from "@/lib/utils";
import { buildCrossAnalysisMatrix } from "@/lib/journal/cross-analysis";
import { buildBucketsFromGroups, buildReportSummary } from "@/lib/journal/report-metrics";

function sideLabel(trade: JournalTrade): string {
  const isLong = trade.side === "buy" || (trade.side as string) === "long";
  return isLong ? "Long" : "Short";
}

function formatRatio(value: number): string {
  if (!Number.isFinite(value)) return "∞";
  return value.toFixed(2);
}

export default function PlaybookReportPage() {
  const { filteredTrades, annotations, playbooks, preferences, isLoading } = useJournal();

  const closedTrades = useMemo(() => filteredTrades.filter((trade) => !trade.isOpen), [filteredTrades]);
  const summary = useMemo(() => buildReportSummary(closedTrades, annotations), [closedTrades, annotations]);

  const playbookBuckets = useMemo(() => {
    const groups = [
      ...playbooks.map((playbook) => ({
        id: playbook.id,
        label: playbook.name,
        match: (trade: JournalTrade) => annotations[trade.id]?.playbookId === playbook.id,
      })),
      {
        id: "unassigned",
        label: "Unassigned",
        match: (trade: JournalTrade) => !annotations[trade.id]?.playbookId,
      },
    ];

    return buildBucketsFromGroups(closedTrades, annotations, groups).sort((a, b) => b.totalPnl - a.totalPnl);
  }, [annotations, closedTrades, playbooks]);

  const topPlaybook = playbookBuckets[0];
  const assignedCount = useMemo(
    () => closedTrades.filter((trade) => Boolean(annotations[trade.id]?.playbookId)).length,
    [closedTrades, annotations]
  );

  const matrix = useMemo(
    () =>
      buildCrossAnalysisMatrix(
        closedTrades,
        annotations,
        (_trade, annotation) => {
          const id = annotation?.playbookId;
          if (!id) return "Unassigned";
          const match = playbooks.find((item) => item.id === id);
          return match?.name || "Unknown";
        },
        (trade) => sideLabel(trade),
        8,
        4
      ),
    [closedTrades, annotations, playbooks]
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
        <h2 className="text-4xl font-black text-white">Playbook Report</h2>

        <ReportsFiltersBar />

        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-3">
          <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 p-3.5">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500 inline-flex items-center gap-1.5">
              <BookOpenCheck className="w-3.5 h-3.5 text-emerald-400" />
              Assigned Trades
            </p>
            <p className="text-2xl font-bold text-zinc-100 mt-1">{assignedCount}</p>
            <p className="text-xs text-zinc-500 mt-1">
              {summary.count > 0 ? `${((assignedCount / summary.count) * 100).toFixed(0)}%` : "0%"} coverage
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 p-3.5">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500 inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Top Playbook
            </p>
            <p className="text-lg font-bold text-zinc-100 mt-1">{topPlaybook?.label || "N/A"}</p>
            <p className={cn("text-xs mt-1", (topPlaybook?.totalPnl || 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>
              {topPlaybook ? formatMoney(topPlaybook.totalPnl, preferences.hideBalances, true) : "No data"}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 p-3.5">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500 inline-flex items-center gap-1.5">
              <Layers3 className="w-3.5 h-3.5 text-emerald-400" />
              Avg R
            </p>
            <p className={cn("text-2xl font-bold mt-1", summary.avgRMultiple >= 0 ? "text-emerald-400" : "text-rose-400")}>
              {summary.avgRMultiple.toFixed(2)}R
            </p>
            <p className="text-xs text-zinc-500 mt-1">{summary.rCoverage.toFixed(0)}% coverage</p>
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

        <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-zinc-800/70">
            <h3 className="text-sm font-semibold text-zinc-100">Playbook Performance Table</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800/70">
                  <th className="px-3 py-2">Playbook</th>
                  <th className="px-3 py-2">Trades</th>
                  <th className="px-3 py-2">Win Rate</th>
                  <th className="px-3 py-2">Avg Hold</th>
                  <th className="px-3 py-2">Avg R</th>
                  <th className="px-3 py-2">Profit Factor</th>
                  <th className="px-3 py-2">Net PnL</th>
                </tr>
              </thead>
              <tbody>
                {playbookBuckets.map((bucket) => (
                  <tr key={bucket.id} className="border-b border-zinc-900/60">
                    <td className="px-3 py-2.5 text-sm text-zinc-200">{bucket.label}</td>
                    <td className="px-3 py-2.5 text-sm text-zinc-400">{bucket.count}</td>
                    <td className="px-3 py-2.5 text-sm text-zinc-300">{bucket.winRate.toFixed(1)}%</td>
                    <td className="px-3 py-2.5 text-sm text-zinc-300">{formatDuration(bucket.avgHoldTimeMs)}</td>
                    <td className={cn("px-3 py-2.5 text-sm font-semibold", bucket.avgRMultiple >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {bucket.avgRMultiple.toFixed(2)}R
                    </td>
                    <td className="px-3 py-2.5 text-sm text-zinc-300">{formatRatio(bucket.profitFactor)}</td>
                    <td className={cn("px-3 py-2.5 text-sm font-semibold", bucket.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {formatMoney(bucket.totalPnl, preferences.hideBalances, true)}
                    </td>
                  </tr>
                ))}
                {playbookBuckets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-sm text-zinc-500">
                      No playbook-linked trades in current filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-zinc-800/70">
            <h3 className="text-sm font-semibold text-zinc-100">Cross Analysis: Playbook x Side</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800/70">
                  <th className="px-3 py-2">Playbook</th>
                  {matrix.columnLabels.map((columnLabel) => (
                    <th key={columnLabel} className="px-3 py-2">
                      {columnLabel}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.rowLabels.map((rowLabel, rowIndex) => (
                  <tr key={rowLabel} className="border-b border-zinc-900/60">
                    <td className="px-3 py-2.5 text-sm text-zinc-200">{rowLabel}</td>
                    {matrix.cells[rowIndex].map((cell) => (
                      <td key={cell.id} className="px-3 py-2.5 text-xs">
                        <div className="text-zinc-300">{cell.count} trades</div>
                        <div className={cn("font-semibold", cell.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                          {formatMoney(cell.totalPnl, preferences.hideBalances, true)}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
                {matrix.rowLabels.length === 0 ? (
                  <tr>
                    <td colSpan={Math.max(2, matrix.columnLabels.length + 1)} className="px-3 py-8 text-center text-sm text-zinc-500">
                      No cross-analysis data in current filters.
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
