"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { GitCompareArrows, Layers2, Scale } from "lucide-react";
import { useJournal, type JournalTrade } from "@/contexts/JournalContext";
import { ReportsFiltersBar, ReportsSubnav } from "@/components/Journal/Reports/shared";
import { MultiCurveChart, formatDuration, formatMoney } from "@/components/Journal/Reports/charts";
import { cn } from "@/lib/utils";
import { STRATEGY_TAGS, type TradeAnnotation } from "@/lib/api/journal-types";
import { buildReportBucket, type ReportBucket } from "@/lib/journal/report-metrics";
import { buildEquityCurve, SESSION_LABELS } from "@/lib/journal/reports";

type CompareDimension = "symbol" | "tag" | "side" | "day" | "session" | "playbook" | "review";
type MetricUnit = "count" | "percent" | "currency" | "duration" | "ratio";

const DIMENSIONS: Array<{ id: CompareDimension; label: string }> = [
  { id: "symbol", label: "Symbol" },
  { id: "tag", label: "Tag" },
  { id: "side", label: "Side" },
  { id: "day", label: "Day of Week" },
  { id: "session", label: "Session" },
  { id: "playbook", label: "Playbook" },
  { id: "review", label: "Review Status" },
];

function formatRatio(value: number): string {
  if (!Number.isFinite(value)) return "∞";
  return value.toFixed(2);
}

function formatMetric(value: number, unit: MetricUnit, hideBalances: boolean): string {
  if (unit === "count") return Math.round(value).toString();
  if (unit === "percent") return `${value.toFixed(1)}%`;
  if (unit === "duration") return formatDuration(value);
  if (unit === "ratio") return formatRatio(value);
  return formatMoney(value, hideBalances, true);
}

function getDimensionValue(
  trade: JournalTrade,
  dimension: CompareDimension,
  playbookNameById: Map<string, string>,
  annotations: Record<string, TradeAnnotation>
): string {
  if (dimension === "symbol") return String(trade.symbol || "Unknown");

  if (dimension === "tag") {
    const id = annotations[trade.id]?.strategyTag;
    const tag = STRATEGY_TAGS.find((item) => item.id === id);
    return tag?.name || "Untagged";
  }

  if (dimension === "side") {
    const isLong = trade.side === "buy" || (trade.side as string) === "long";
    return isLong ? "Long" : "Short";
  }

  if (dimension === "day") {
    return new Date(trade.timestamp).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  }

  if (dimension === "session") {
    const hour = new Date(trade.timestamp).getUTCHours();
    const session = SESSION_LABELS.find((item) => item.test(hour));
    return session?.label || "Outside";
  }

  if (dimension === "playbook") {
    const playbookId = annotations[trade.id]?.playbookId;
    if (!playbookId) return "Unassigned";
    return playbookNameById.get(playbookId) || "Unknown";
  }

  return annotations[trade.id]?.reviewed ? "Reviewed" : "Unreviewed";
}

type MetricRow = {
  label: string;
  unit: MetricUnit;
  cohortA: number;
  cohortB: number;
};

function buildMetricRows(cohortA: ReportBucket, cohortB: ReportBucket): MetricRow[] {
  return [
    { label: "Trades", unit: "count", cohortA: cohortA.count, cohortB: cohortB.count },
    { label: "Win Rate", unit: "percent", cohortA: cohortA.winRate, cohortB: cohortB.winRate },
    { label: "Net PnL", unit: "currency", cohortA: cohortA.totalPnl, cohortB: cohortB.totalPnl },
    { label: "Avg PnL", unit: "currency", cohortA: cohortA.avgPnl, cohortB: cohortB.avgPnl },
    { label: "Avg Hold", unit: "duration", cohortA: cohortA.avgHoldTimeMs, cohortB: cohortB.avgHoldTimeMs },
    { label: "Avg Volume", unit: "currency", cohortA: cohortA.avgVolume, cohortB: cohortB.avgVolume },
    { label: "Avg R", unit: "ratio", cohortA: cohortA.avgRMultiple, cohortB: cohortB.avgRMultiple },
    { label: "Profit Factor", unit: "ratio", cohortA: cohortA.profitFactor, cohortB: cohortB.profitFactor },
  ];
}

export default function CompareReportPage() {
  const { filteredTrades, annotations, playbooks, preferences, isLoading } = useJournal();

  const [dimension, setDimension] = useState<CompareDimension>("symbol");
  const [cohortA, setCohortA] = useState<string>("");
  const [cohortB, setCohortB] = useState<string>("");

  const closedTrades = useMemo(() => filteredTrades.filter((trade) => !trade.isOpen), [filteredTrades]);
  const playbookNameById = useMemo(() => new Map(playbooks.map((item) => [item.id, item.name])), [playbooks]);

  const valueOptions = useMemo(() => {
    const values = new Set<string>();
    closedTrades.forEach((trade) => {
      values.add(getDimensionValue(trade, dimension, playbookNameById, annotations));
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [annotations, closedTrades, dimension, playbookNameById]);

  useEffect(() => {
    if (valueOptions.length === 0) {
      setCohortA("");
      setCohortB("");
      return;
    }

    const defaultA = valueOptions[0];
    const nextA = valueOptions.includes(cohortA) ? cohortA : defaultA;
    if (nextA !== cohortA) setCohortA(nextA);

    const defaultB = valueOptions.find((item) => item !== nextA) || defaultA;
    const nextB = valueOptions.includes(cohortB) && cohortB !== nextA ? cohortB : defaultB;
    if (nextB !== cohortB) setCohortB(nextB);
  }, [cohortA, cohortB, valueOptions]);

  const cohortATrades = useMemo(
    () =>
      closedTrades.filter(
        (trade) =>
          getDimensionValue(
            trade,
            dimension,
            playbookNameById,
            annotations
          ) === cohortA
      ),
    [annotations, closedTrades, cohortA, dimension, playbookNameById]
  );

  const cohortBTrades = useMemo(
    () =>
      closedTrades.filter(
        (trade) =>
          getDimensionValue(
            trade,
            dimension,
            playbookNameById,
            annotations
          ) === cohortB
      ),
    [annotations, closedTrades, cohortB, dimension, playbookNameById]
  );

  const cohortABucket = useMemo(
    () => buildReportBucket("cohort_a", cohortA || "A", cohortATrades, annotations),
    [annotations, cohortA, cohortATrades]
  );
  const cohortBBucket = useMemo(
    () => buildReportBucket("cohort_b", cohortB || "B", cohortBTrades, annotations),
    [annotations, cohortB, cohortBTrades]
  );

  const curves = useMemo(
    () => [
      {
        id: "cohort_a_curve",
        label: cohortA || "Cohort A",
        color: "#57d4aa",
        points: buildEquityCurve(cohortATrades),
      },
      {
        id: "cohort_b_curve",
        label: cohortB || "Cohort B",
        color: "#5ec8ff",
        points: buildEquityCurve(cohortBTrades),
      },
    ],
    [cohortA, cohortATrades, cohortB, cohortBTrades]
  );

  const metricRows = useMemo(() => buildMetricRows(cohortABucket, cohortBBucket), [cohortABucket, cohortBBucket]);

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
        <h2 className="text-4xl font-black text-white">Compare Report</h2>

        <ReportsFiltersBar />

        <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 p-3.5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Dimension</span>
              <select
                value={dimension}
                onChange={(event) => setDimension(event.target.value as CompareDimension)}
                className="w-full h-8 rounded-md bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 px-2"
              >
                {DIMENSIONS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Cohort A</span>
              <select
                value={cohortA}
                onChange={(event) => setCohortA(event.target.value)}
                className="w-full h-8 rounded-md bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 px-2"
              >
                {valueOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Cohort B</span>
              <select
                value={cohortB}
                onChange={(event) => setCohortB(event.target.value)}
                className="w-full h-8 rounded-md bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 px-2"
              >
                {valueOptions.map((item) => (
                  <option key={item} value={item} disabled={item === cohortA}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {valueOptions.length < 2 ? (
          <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 p-8 text-center text-zinc-500">
            Need at least two unique cohorts in the selected dimension to compare.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-3">
              <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 p-3.5">
                <p className="text-[11px] uppercase tracking-wider text-zinc-500 inline-flex items-center gap-1.5">
                  <Layers2 className="w-3.5 h-3.5 text-emerald-400" />
                  {cohortA || "Cohort A"}
                </p>
                <p className="text-xl font-bold text-zinc-100 mt-1">{cohortABucket.count} trades</p>
                <p className={cn("text-xs mt-1", cohortABucket.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  {formatMoney(cohortABucket.totalPnl, preferences.hideBalances, true)}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 p-3.5">
                <p className="text-[11px] uppercase tracking-wider text-zinc-500 inline-flex items-center gap-1.5">
                  <Layers2 className="w-3.5 h-3.5 text-sky-400" />
                  {cohortB || "Cohort B"}
                </p>
                <p className="text-xl font-bold text-zinc-100 mt-1">{cohortBBucket.count} trades</p>
                <p className={cn("text-xs mt-1", cohortBBucket.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  {formatMoney(cohortBBucket.totalPnl, preferences.hideBalances, true)}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 p-3.5">
                <p className="text-[11px] uppercase tracking-wider text-zinc-500 inline-flex items-center gap-1.5">
                  <GitCompareArrows className="w-3.5 h-3.5 text-emerald-400" />
                  Delta (A - B)
                </p>
                <p className={cn("text-xl font-bold mt-1", cohortABucket.totalPnl - cohortBBucket.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  {formatMoney(cohortABucket.totalPnl - cohortBBucket.totalPnl, preferences.hideBalances, true)}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 p-3.5">
                <p className="text-[11px] uppercase tracking-wider text-zinc-500 inline-flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-emerald-400" />
                  Win Rate Delta
                </p>
                <p className={cn("text-xl font-bold mt-1", cohortABucket.winRate - cohortBBucket.winRate >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  {(cohortABucket.winRate - cohortBBucket.winRate).toFixed(1)}%
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 p-4">
              <h3 className="text-lg font-bold text-zinc-100 mb-3">Equity Comparison</h3>
              <MultiCurveChart curves={curves} />
            </div>

            <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 overflow-hidden">
              <div className="px-3 py-2.5 border-b border-zinc-800/70">
                <h3 className="text-sm font-semibold text-zinc-100">A/B Delta Metrics</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800/70">
                      <th className="px-3 py-2">Metric</th>
                      <th className="px-3 py-2">{cohortA || "A"}</th>
                      <th className="px-3 py-2">{cohortB || "B"}</th>
                      <th className="px-3 py-2">Delta (A - B)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metricRows.map((row) => {
                      const delta = row.cohortA - row.cohortB;
                      return (
                        <tr key={row.label} className="border-b border-zinc-900/60">
                          <td className="px-3 py-2.5 text-sm text-zinc-200">{row.label}</td>
                          <td className={cn("px-3 py-2.5 text-sm", row.cohortA >= 0 ? "text-emerald-400" : "text-rose-400")}>
                            {formatMetric(row.cohortA, row.unit, preferences.hideBalances)}
                          </td>
                          <td className={cn("px-3 py-2.5 text-sm", row.cohortB >= 0 ? "text-emerald-400" : "text-rose-400")}>
                            {formatMetric(row.cohortB, row.unit, preferences.hideBalances)}
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
          </>
        )}
      </div>
    </motion.div>
  );
}
