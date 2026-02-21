"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { AggregatedStat, DataPoint, MetricMode } from "@/lib/journal/reports";
import { valueForMode } from "@/lib/journal/reports";

export function formatMoney(value: number, hideBalances: boolean, signed = false): string {
  if (hideBalances) return "••••";
  const sign = signed ? (value > 0 ? "+" : value < 0 ? "-" : "") : "";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0m";
  const minutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

export function ModeToggle({
  value,
  onChange,
}: {
  value: MetricMode;
  onChange: (mode: MetricMode) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-zinc-800 overflow-hidden">
      {(["count", "pnl", "winRate"] as MetricMode[]).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={cn(
            "px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors",
            value === mode
              ? "bg-zinc-700 text-white"
              : "bg-zinc-950/40 text-zinc-500 hover:text-zinc-300"
          )}
        >
          {mode === "winRate" ? "Win rate" : mode}
        </button>
      ))}
    </div>
  );
}

export function PerformanceBars({
  stats,
  mode,
  hideBalances,
}: {
  stats: AggregatedStat[];
  mode: MetricMode;
  hideBalances: boolean;
}) {
  const values = stats.map((item) => valueForMode(item, mode));
  const maxPositive = Math.max(1, ...values.filter((value) => value > 0));
  const maxNegative = Math.max(1, ...values.filter((value) => value < 0).map((value) => Math.abs(value)));
  const hasNegative = values.some((value) => value < 0);

  if (!stats.length) {
    return <div className="h-[220px] flex items-center justify-center text-sm text-zinc-600">No data available</div>;
  }

  return (
    <div className="overflow-x-auto pb-1">
      <div className={cn("flex gap-2", stats.length > 9 ? "min-w-[940px]" : "")}>
        {stats.map((item, index) => {
          const value = valueForMode(item, mode);
          const positiveHeight = hasNegative
            ? `${(Math.max(0, value) / maxPositive) * 44}%`
            : `${(Math.max(0, value) / maxPositive) * 90}%`;
          const negativeHeight = hasNegative
            ? `${(Math.abs(Math.min(0, value)) / maxNegative) * 44}%`
            : "0%";

          return (
            <div key={item.id} className="flex-1 min-w-[68px]">
              <div className="relative h-[180px]">
                <div
                  className={cn(
                    "absolute left-0 right-0 h-px bg-zinc-700/70",
                    hasNegative ? "top-1/2" : "bottom-0"
                  )}
                />

                {value > 0 ? (
                  <motion.div
                    title={formatMoney(value, hideBalances, true)}
                    initial={{ height: 0, opacity: 0.65 }}
                    animate={{ height: positiveHeight, opacity: 1 }}
                    transition={{ duration: 0.35, delay: Math.min(index * 0.02, 0.22) }}
                    className="absolute left-2 right-2 rounded-t-md bg-emerald-400/85 shadow-[0_0_22px_rgba(16,185,129,0.2)]"
                    style={{ bottom: hasNegative ? "50%" : "0%" }}
                  />
                ) : null}

                {value < 0 && hasNegative ? (
                  <motion.div
                    title={formatMoney(value, hideBalances, true)}
                    initial={{ height: 0, opacity: 0.65 }}
                    animate={{ height: negativeHeight, opacity: 1 }}
                    transition={{ duration: 0.35, delay: Math.min(index * 0.02, 0.22) }}
                    className="absolute left-2 right-2 rounded-b-md bg-rose-400/85 shadow-[0_0_22px_rgba(244,63,94,0.18)]"
                    style={{ top: "50%" }}
                  />
                ) : null}
              </div>

              <p className="mt-2 text-[10px] text-zinc-500 text-center leading-tight">{item.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function pathFromPoints(points: Array<{ x: number; y: number }>): string {
  if (!points.length) return "";
  const [first, ...rest] = points;
  return `M ${first.x.toFixed(2)} ${first.y.toFixed(2)} ${rest
    .map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ")}`;
}

export function MultiCurveChart({
  curves,
}: {
  curves: Array<{ id: string; label: string; color: string; points: DataPoint[] }>;
}) {
  const width = 950;
  const height = 340;
  const padding = { left: 28, right: 20, top: 20, bottom: 24 };

  const allPoints = curves.flatMap((curve) => curve.points);
  if (!allPoints.length) {
    return (
      <div className="h-[300px] rounded-xl border border-zinc-800/70 bg-zinc-950/30 flex items-center justify-center text-sm text-zinc-600">
        Select curves from Curve Selector
      </div>
    );
  }

  const minX = Math.min(...allPoints.map((point) => point.x));
  const maxX = Math.max(...allPoints.map((point) => point.x));
  const minY0 = Math.min(...allPoints.map((point) => point.y), 0);
  const maxY0 = Math.max(...allPoints.map((point) => point.y), 0);
  const minY = minY0 === maxY0 ? minY0 - 1 : minY0;
  const maxY = minY0 === maxY0 ? maxY0 + 1 : maxY0;

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const scaleX = (x: number) => padding.left + ((x - minX) / Math.max(1, maxX - minX)) * plotWidth;
  const scaleY = (y: number) => padding.top + (1 - (y - minY) / Math.max(1, maxY - minY)) * plotHeight;

  const zeroY = minY < 0 && maxY > 0 ? scaleY(0) : null;

  return (
    <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/30 p-2.5">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[300px]">
        {[0.2, 0.4, 0.6, 0.8].map((ratio) => {
          const y = padding.top + ratio * plotHeight;
          return (
            <line
              key={ratio}
              x1={padding.left}
              x2={width - padding.right}
              y1={y}
              y2={y}
              stroke="rgba(113,113,122,0.25)"
              strokeWidth={1}
            />
          );
        })}

        {zeroY !== null ? (
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={zeroY}
            y2={zeroY}
            stroke="rgba(113,113,122,0.45)"
            strokeDasharray="4 4"
            strokeWidth={1}
          />
        ) : null}

        {curves.map((curve, index) => {
          const scaled = curve.points.map((point) => ({ x: scaleX(point.x), y: scaleY(point.y) }));
          return (
            <motion.path
              key={curve.id}
              d={pathFromPoints(scaled)}
              fill="none"
              stroke={curve.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0.2 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.55, delay: Math.min(index * 0.06, 0.3) }}
            />
          );
        })}
      </svg>
    </div>
  );
}

export function LongShortBar({ longs, shorts }: { longs: number; shorts: number }) {
  const total = Math.max(1, longs + shorts);
  const longPct = (longs / total) * 100;
  const shortPct = (shorts / total) * 100;

  return (
    <div className="w-[180px]">
      <div className="flex items-center justify-between text-[10px] mb-1">
        <span className="text-emerald-400 font-semibold">{longPct.toFixed(0)}%</span>
        <span className="text-rose-400 font-semibold">{shortPct.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden bg-zinc-800">
        <motion.div
          className="h-full bg-emerald-400"
          initial={{ width: 0 }}
          animate={{ width: `${longPct}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>
    </div>
  );
}
