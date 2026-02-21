"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Clock3, Grid3X3, Timer } from "lucide-react";
import { useJournal, type JournalTrade } from "@/contexts/JournalContext";
import { ReportsFiltersBar, ReportsSubnav } from "@/components/Journal/Reports/shared";
import { formatDuration, formatMoney } from "@/components/Journal/Reports/charts";
import { cn } from "@/lib/utils";
import { buildCrossAnalysisMatrix } from "@/lib/journal/cross-analysis";
import { buildBucketsFromGroups, buildReportSummary, type ReportBucket } from "@/lib/journal/report-metrics";
import { DAY_LABELS, SESSION_LABELS } from "@/lib/journal/reports";

function getDayLabel(trade: JournalTrade): string {
  const utcDay = new Date(trade.timestamp).getUTCDay();
  return DAY_LABELS.find((day) => day.day === utcDay)?.label ?? "Unknown";
}

function getSessionLabel(trade: JournalTrade): string {
  const hour = new Date(trade.timestamp).getUTCHours();
  const session = SESSION_LABELS.find((item) => item.test(hour));
  return session?.label ?? "Outside";
}

function DayTimeTable({
  title,
  buckets,
  hideBalances,
}: {
  title: string;
  buckets: ReportBucket[];
  hideBalances: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-zinc-800/70">
        <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800/70">
              <th className="px-3 py-2">Bucket</th>
              <th className="px-3 py-2">Trades</th>
              <th className="px-3 py-2">Win Rate</th>
              <th className="px-3 py-2">Avg Hold</th>
              <th className="px-3 py-2">Avg PnL</th>
              <th className="px-3 py-2">Net PnL</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((bucket) => (
              <tr key={bucket.id} className="border-b border-zinc-900/60">
                <td className="px-3 py-2.5 text-sm text-zinc-200">{bucket.label}</td>
                <td className="px-3 py-2.5 text-sm text-zinc-400">{bucket.count}</td>
                <td className="px-3 py-2.5 text-sm text-zinc-300">{bucket.winRate.toFixed(1)}%</td>
                <td className="px-3 py-2.5 text-sm text-zinc-300">{formatDuration(bucket.avgHoldTimeMs)}</td>
                <td className={cn("px-3 py-2.5 text-sm font-semibold", bucket.avgPnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  {formatMoney(bucket.avgPnl, hideBalances, true)}
                </td>
                <td className={cn("px-3 py-2.5 text-sm font-semibold", bucket.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  {formatMoney(bucket.totalPnl, hideBalances, true)}
                </td>
              </tr>
            ))}
            {buckets.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-zinc-500">
                  No data for this split.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DayTimeReportPage() {
  const { filteredTrades, annotations, preferences, isLoading } = useJournal();

  const closedTrades = useMemo(() => filteredTrades.filter((trade) => !trade.isOpen), [filteredTrades]);
  const summary = useMemo(() => buildReportSummary(closedTrades, annotations), [closedTrades, annotations]);

  const dayBuckets = useMemo(
    () =>
      buildBucketsFromGroups(
        closedTrades,
        annotations,
        DAY_LABELS.map((day) => ({
          id: `day_${day.id}`,
          label: day.label,
          match: (trade) => new Date(trade.timestamp).getUTCDay() === day.day,
        }))
      ),
    [closedTrades, annotations]
  );

  const sessionBuckets = useMemo(
    () =>
      buildBucketsFromGroups(
        closedTrades,
        annotations,
        SESSION_LABELS.map((session) => ({
          id: `session_${session.id}`,
          label: session.label,
          match: (trade) => session.test(new Date(trade.timestamp).getUTCHours()),
        }))
      ),
    [closedTrades, annotations]
  );

  const hourBuckets = useMemo(
    () =>
      buildBucketsFromGroups(
        closedTrades,
        annotations,
        [0, 4, 8, 12, 16, 20].map((hour) => ({
          id: `hour_${hour}`,
          label: `${String(hour).padStart(2, "0")}-${String((hour + 4) % 24).padStart(2, "0")} UTC`,
          match: (trade) => {
            const utcHour = new Date(trade.timestamp).getUTCHours();
            return utcHour >= hour && utcHour < hour + 4;
          },
        }))
      ),
    [closedTrades, annotations]
  );

  const matrix = useMemo(
    () =>
      buildCrossAnalysisMatrix(
        closedTrades,
        annotations,
        (trade) => getDayLabel(trade),
        (trade) => getSessionLabel(trade),
        8,
        8
      ),
    [closedTrades, annotations]
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
        <h2 className="text-4xl font-black text-white">Day & Time Report</h2>

        <ReportsFiltersBar />

        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-3">
          <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 p-3.5">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500 inline-flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-emerald-400" />
              Closed Trades
            </p>
            <p className="text-2xl font-bold text-zinc-100 mt-1">{summary.count}</p>
          </div>
          <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 p-3.5">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500 inline-flex items-center gap-1.5">
              <Clock3 className="w-3.5 h-3.5 text-emerald-400" />
              Win Rate
            </p>
            <p className="text-2xl font-bold text-zinc-100 mt-1">{summary.winRate.toFixed(1)}%</p>
          </div>
          <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 p-3.5">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500 inline-flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5 text-emerald-400" />
              Avg Hold
            </p>
            <p className="text-2xl font-bold text-zinc-100 mt-1">{formatDuration(summary.avgHoldTimeMs)}</p>
          </div>
          <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 p-3.5">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500 inline-flex items-center gap-1.5">
              <Grid3X3 className="w-3.5 h-3.5 text-emerald-400" />
              Net PnL
            </p>
            <p className={cn("text-2xl font-bold mt-1", summary.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
              {formatMoney(summary.totalPnl, preferences.hideBalances, true)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-3">
          <DayTimeTable title="Day of Week Performance" buckets={dayBuckets} hideBalances={preferences.hideBalances} />
          <DayTimeTable title="Session Performance (UTC)" buckets={sessionBuckets} hideBalances={preferences.hideBalances} />
        </div>

        <DayTimeTable title="Time of Day Performance (4h Buckets, UTC)" buckets={hourBuckets} hideBalances={preferences.hideBalances} />

        <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-zinc-800/70">
            <h3 className="text-sm font-semibold text-zinc-100">Cross Analysis: Day x Session</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800/70">
                  <th className="px-3 py-2">Day</th>
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
