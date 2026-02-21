"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Activity, Scale, Shield, Sigma } from "lucide-react";
import { useJournal, type JournalTrade } from "@/contexts/JournalContext";
import { ReportsFiltersBar, ReportsSubnav } from "@/components/Journal/Reports/shared";
import { formatDuration, formatMoney } from "@/components/Journal/Reports/charts";
import { cn } from "@/lib/utils";
import { buildCrossAnalysisMatrix } from "@/lib/journal/cross-analysis";
import type { TradeAnnotation } from "@/lib/api/journal-types";
import {
  buildBucketsFromGroups,
  buildReportSummary,
  getRealizedRMultiple,
  getTradePositionSize,
  type ReportBucket,
} from "@/lib/journal/report-metrics";

function formatRatio(value: number): string {
  if (!Number.isFinite(value)) return "∞";
  return value.toFixed(2);
}

function sideLabel(trade: JournalTrade): string {
  const isLong = trade.side === "buy" || (trade.side as string) === "long";
  return isLong ? "Long" : "Short";
}

function tradeVolumeUsd(trade: JournalTrade): number {
  const fallback = Number(trade.price) * Number(trade.amount);
  const raw = trade.cost ?? fallback;
  const normalized = Number(raw);
  if (!Number.isFinite(normalized)) return 0;
  return Math.abs(normalized);
}

function riskBand(trade: JournalTrade, annotation?: TradeAnnotation): string {
  const r = getRealizedRMultiple(trade, annotation);
  if (r === null) return "No stop";
  if (r < -1) return "< -1R";
  if (r < 0) return "-1R to 0R";
  if (r < 1) return "0R to 1R";
  if (r < 2) return "1R to 2R";
  return "2R+";
}

function BucketTable({
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
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800/70">
              <th className="px-3 py-2">Bucket</th>
              <th className="px-3 py-2">Trades</th>
              <th className="px-3 py-2">Win Rate</th>
              <th className="px-3 py-2">Avg R</th>
              <th className="px-3 py-2">R Coverage</th>
              <th className="px-3 py-2">Avg Hold</th>
              <th className="px-3 py-2">Net PnL</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((bucket) => (
              <tr key={bucket.id} className="border-b border-zinc-900/60">
                <td className="px-3 py-2.5 text-sm text-zinc-200">{bucket.label}</td>
                <td className="px-3 py-2.5 text-sm text-zinc-400">{bucket.count}</td>
                <td className="px-3 py-2.5 text-sm text-zinc-300">{bucket.winRate.toFixed(1)}%</td>
                <td className={cn("px-3 py-2.5 text-sm font-semibold", bucket.avgRMultiple >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  {bucket.avgRMultiple.toFixed(2)}R
                </td>
                <td className="px-3 py-2.5 text-sm text-zinc-300">{bucket.rCoverage.toFixed(0)}%</td>
                <td className="px-3 py-2.5 text-sm text-zinc-300">{formatDuration(bucket.avgHoldTimeMs)}</td>
                <td className={cn("px-3 py-2.5 text-sm font-semibold", bucket.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  {formatMoney(bucket.totalPnl, hideBalances, true)}
                </td>
              </tr>
            ))}
            {buckets.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-zinc-500">
                  No data in this view.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function RiskReportPage() {
  const { filteredTrades, annotations, preferences, isLoading } = useJournal();

  const closedTrades = useMemo(() => filteredTrades.filter((trade) => !trade.isOpen), [filteredTrades]);

  const summary = useMemo(() => buildReportSummary(closedTrades, annotations), [closedTrades, annotations]);

  const sizeBuckets = useMemo(
    () =>
      buildBucketsFromGroups(closedTrades, annotations, [
        { id: "size_micro", label: "< $1k", match: (trade) => getTradePositionSize(trade) < 1_000 },
        {
          id: "size_small",
          label: "$1k - $5k",
          match: (trade) => getTradePositionSize(trade) >= 1_000 && getTradePositionSize(trade) < 5_000,
        },
        {
          id: "size_mid",
          label: "$5k - $25k",
          match: (trade) => getTradePositionSize(trade) >= 5_000 && getTradePositionSize(trade) < 25_000,
        },
        { id: "size_large", label: "$25k+", match: (trade) => getTradePositionSize(trade) >= 25_000 },
      ]),
    [closedTrades, annotations]
  );

  const volumeBuckets = useMemo(
    () =>
      buildBucketsFromGroups(closedTrades, annotations, [
        { id: "vol_micro", label: "< $2.5k", match: (trade) => tradeVolumeUsd(trade) < 2_500 },
        {
          id: "vol_small",
          label: "$2.5k - $10k",
          match: (trade) => {
            const volume = tradeVolumeUsd(trade);
            return volume >= 2_500 && volume < 10_000;
          },
        },
        {
          id: "vol_mid",
          label: "$10k - $50k",
          match: (trade) => {
            const volume = tradeVolumeUsd(trade);
            return volume >= 10_000 && volume < 50_000;
          },
        },
        {
          id: "vol_large",
          label: "$50k+",
          match: (trade) => tradeVolumeUsd(trade) >= 50_000,
        },
      ]),
    [closedTrades, annotations]
  );

  const rBuckets = useMemo(
    () =>
      buildBucketsFromGroups(closedTrades, annotations, [
        {
          id: "r_no_stop",
          label: "No stop",
          match: (trade) => getRealizedRMultiple(trade, annotations[trade.id]) === null,
        },
        {
          id: "r_lt_neg1",
          label: "< -1R",
          match: (trade) => {
            const r = getRealizedRMultiple(trade, annotations[trade.id]);
            return r !== null && r < -1;
          },
        },
        {
          id: "r_neg1_0",
          label: "-1R to 0R",
          match: (trade) => {
            const r = getRealizedRMultiple(trade, annotations[trade.id]);
            return r !== null && r >= -1 && r < 0;
          },
        },
        {
          id: "r_0_1",
          label: "0R to 1R",
          match: (trade) => {
            const r = getRealizedRMultiple(trade, annotations[trade.id]);
            return r !== null && r >= 0 && r < 1;
          },
        },
        {
          id: "r_1_2",
          label: "1R to 2R",
          match: (trade) => {
            const r = getRealizedRMultiple(trade, annotations[trade.id]);
            return r !== null && r >= 1 && r < 2;
          },
        },
        {
          id: "r_2_plus",
          label: "2R+",
          match: (trade) => {
            const r = getRealizedRMultiple(trade, annotations[trade.id]);
            return r !== null && r >= 2;
          },
        },
      ]),
    [closedTrades, annotations]
  );

  const matrix = useMemo(
    () =>
      buildCrossAnalysisMatrix(
        closedTrades,
        annotations,
        (trade) => sideLabel(trade),
        (trade, annotation) => riskBand(trade, annotation),
        4,
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
        <h2 className="text-4xl font-black text-white">Risk Report</h2>

        <ReportsFiltersBar />

        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-3">
          <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 p-3.5">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500 inline-flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              Closed Trades
            </p>
            <p className="text-2xl font-bold text-zinc-100 mt-1">{summary.count}</p>
          </div>
          <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 p-3.5">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500 inline-flex items-center gap-1.5">
              <Sigma className="w-3.5 h-3.5 text-emerald-400" />
              Average R
            </p>
            <p className={cn("text-2xl font-bold mt-1", summary.avgRMultiple >= 0 ? "text-emerald-400" : "text-rose-400")}>
              {summary.avgRMultiple.toFixed(2)}R
            </p>
            <p className="text-xs text-zinc-500 mt-1">{summary.rCoverage.toFixed(0)}% coverage</p>
          </div>
          <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 p-3.5">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500 inline-flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              Profit Factor
            </p>
            <p className="text-2xl font-bold text-zinc-100 mt-1">{formatRatio(summary.profitFactor)}</p>
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

        <BucketTable title="R-Multiple Distribution" buckets={rBuckets} hideBalances={preferences.hideBalances} />

        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-3">
          <BucketTable title="Position Size Buckets" buckets={sizeBuckets} hideBalances={preferences.hideBalances} />
          <BucketTable title="Volume Buckets" buckets={volumeBuckets} hideBalances={preferences.hideBalances} />
        </div>

        <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-zinc-800/70">
            <h3 className="text-sm font-semibold text-zinc-100">Cross Analysis: Side x R Bucket</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800/70">
                  <th className="px-3 py-2">Side</th>
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
