"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Info,
  RefreshCw,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useJournal } from "@/contexts/JournalContext";
import { JOURNAL_WIDGET_DEFINITIONS } from "@/lib/journal-widgets";
import {
  buildWidgetBuckets,
  isLineWidget,
  type WidgetSideFilter,
  type WidgetTimeframe,
  unitForWidget,
  valueForWidget,
  widgetTone,
} from "@/lib/journal/dashboard";

export interface WidgetDisplayConfig {
  timeframe: WidgetTimeframe;
  sideFilter: WidgetSideFilter;
}

interface WidgetGridProps {
  selectedWidgets: string[];
  isEditing: boolean;
  globalTimeframe: WidgetTimeframe;
  widgetConfigs: Record<string, WidgetDisplayConfig>;
  onChangeWidgetConfig: (widgetId: string, patch: Partial<WidgetDisplayConfig>) => void;
  onRemoveWidget: (widgetId: string) => void;
  onMoveWidget: (widgetId: string, direction: "up" | "down") => void;
}

interface WidgetCardProps {
  widgetId: string;
  index: number;
  isEditing: boolean;
  globalTimeframe: WidgetTimeframe;
  config: WidgetDisplayConfig;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdateConfig: (patch: Partial<WidgetDisplayConfig>) => void;
  onOpenSettings: () => void;
}

function formatValue(
  value: number,
  unit: ReturnType<typeof unitForWidget>,
  hideBalances: boolean,
  signed = false
): string {
  if (unit === "count") return `${Math.round(value)}`;
  if (unit === "percent") return `${value.toFixed(1)}%`;
  if (unit === "hours") return `${value.toFixed(1)}h`;
  if (unit === "ratio") {
    if (value === Infinity) return "∞";
    return value.toFixed(2);
  }

  if (hideBalances) return "••••";
  const sign = signed ? (value > 0 ? "+" : value < 0 ? "-" : "") : "";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function AreaChart({ values, tone }: { values: number[]; tone: "positive" | "negative" | "neutral" }) {
  if (values.length < 2) {
    return <div className="h-[160px] flex items-center justify-center text-xs text-zinc-600">No enough data</div>;
  }

  const width = 100;
  const height = 36;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);

  const points = values
    .map((value, idx) => {
      const x = (idx / Math.max(1, values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const fill = `0,${height} ${points} ${width},${height}`;
  const strokeClass =
    tone === "positive" ? "stroke-emerald-400" : tone === "negative" ? "stroke-rose-400" : "stroke-zinc-400";
  const fillClass =
    tone === "positive" ? "fill-emerald-500/15" : tone === "negative" ? "fill-rose-500/15" : "fill-zinc-500/10";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[160px] w-full">
      <polygon className={fillClass} points={fill} />
      <polyline className={cn("fill-none stroke-[1.4]", strokeClass)} points={points} />
    </svg>
  );
}

function BarChart({ values }: { values: number[] }) {
  if (values.length === 0) {
    return <div className="h-[160px] flex items-center justify-center text-xs text-zinc-600">No enough data</div>;
  }

  const hasNegative = values.some((value) => value < 0);
  const maxPositive = Math.max(1, ...values.filter((value) => value > 0));
  const maxNegative = Math.max(1, ...values.filter((value) => value < 0).map((value) => Math.abs(value)));

  return (
    <div className="h-[160px] relative overflow-hidden">
      <div
        className={cn(
          "absolute left-0 right-0 h-px bg-zinc-700/70",
          hasNegative ? "top-1/2" : "bottom-0"
        )}
      />

      <div className="h-full flex items-stretch gap-1.5">
        {values.map((value, idx) => {
          const posHeight = hasNegative
            ? `${(Math.max(0, value) / maxPositive) * 44}%`
            : `${(Math.max(0, value) / maxPositive) * 90}%`;
          const negHeight = hasNegative
            ? `${(Math.abs(Math.min(0, value)) / maxNegative) * 44}%`
            : "0%";

          return (
            <div key={`${idx}_${value}`} className="flex-1 relative">
              {value > 0 ? (
                <div
                  className="absolute left-0 right-0 bg-emerald-400/80 rounded-t-sm"
                  style={{
                    height: posHeight,
                    bottom: hasNegative ? "50%" : "0%",
                  }}
                />
              ) : null}

              {value < 0 && hasNegative ? (
                <div
                  className="absolute left-0 right-0 bg-rose-400/80 rounded-b-sm"
                  style={{
                    height: negHeight,
                    top: "50%",
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function widgetSpan(widgetId: string): string {
  if (["pnl_cumulative", "volume_cumulative", "biggest_loss", "biggest_profit"].includes(widgetId)) {
    return "col-span-12 xl:col-span-6";
  }

  return "col-span-12 md:col-span-6 xl:col-span-4";
}

function WidgetCard({
  widgetId,
  index,
  isEditing,
  globalTimeframe,
  config,
  onRemove,
  onMoveUp,
  onMoveDown,
  onUpdateConfig,
  onOpenSettings,
}: WidgetCardProps) {
  const { filteredTrades, preferences } = useJournal();

  const widget = JOURNAL_WIDGET_DEFINITIONS.find((item) => item.id === widgetId);

  const timeframe = config.timeframe || globalTimeframe;
  const sideFilter = config.sideFilter || "all";

  const buckets = useMemo(
    () => buildWidgetBuckets(filteredTrades, timeframe, sideFilter),
    [filteredTrades, timeframe, sideFilter]
  );

  const values = useMemo(() => buckets.map((bucket) => valueForWidget(widgetId, bucket)), [buckets, widgetId]);

  const current = values.length > 0 ? values[values.length - 1] : 0;
  const previous = values.length > 1 ? values[values.length - 2] : 0;
  const delta = current - previous;

  const unit = unitForWidget(widgetId);
  const tone = widgetTone(widgetId, current);
  const lineMode = isLineWidget(widgetId);

  const insight =
    values.length > 1
      ? `${widget?.name ?? "Metric"} was ${delta >= 0 ? "higher" : "lower"} than last ${timeframe} by ${formatValue(
          delta,
          unit,
          preferences.hideBalances,
          true
        )}`
      : `Not enough data to compare ${widget?.name?.toLowerCase() ?? "metric"}.`;

  if (!widget) return null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={cn(
        "rounded-xl border border-zinc-800/70 bg-zinc-900/35 p-3",
        widgetSpan(widgetId),
        isEditing && "ring-1 ring-emerald-500/30"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-zinc-200">{widget.name}</h3>

        <div className="flex items-center gap-1 text-zinc-500">
          <button type="button" className="p-1 rounded hover:bg-zinc-800/70 hover:text-zinc-300">
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button type="button" className="p-1 rounded hover:bg-zinc-800/70 hover:text-zinc-300">
            <Info className="w-3.5 h-3.5" />
          </button>
          <button type="button" className="p-1 rounded hover:bg-zinc-800/70 hover:text-zinc-300">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="p-1 rounded hover:bg-zinc-800/70 hover:text-zinc-300"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          {isEditing ? (
            <button
              type="button"
              onClick={onRemove}
              className="p-1 rounded hover:bg-zinc-800/70 hover:text-rose-400"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="mb-2">
        <p
          className={cn(
            "text-xl font-black",
            tone === "positive" && "text-emerald-400",
            tone === "negative" && "text-rose-400",
            tone === "neutral" && "text-zinc-300"
          )}
        >
          {formatValue(current, unit, preferences.hideBalances, unit === "currency")}
        </p>
      </div>

      <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/35 p-2.5 mb-2">
        {lineMode ? <AreaChart values={values} tone={tone} /> : <BarChart values={values} />}
      </div>

      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="inline-flex rounded-md border border-zinc-800 overflow-hidden">
          {(["year", "month", "week", "day"] as WidgetTimeframe[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onUpdateConfig({ timeframe: value })}
              className={cn(
                "px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
                timeframe === value
                  ? "bg-zinc-700 text-white"
                  : "bg-zinc-900/40 text-zinc-500 hover:text-zinc-300"
              )}
            >
              {value}
            </button>
          ))}
        </div>

        {isEditing ? (
          <div className="inline-flex rounded-md border border-zinc-800 overflow-hidden">
            <button
              type="button"
              onClick={onMoveUp}
              className="px-2 py-1 text-zinc-500 hover:text-zinc-300 bg-zinc-900/40"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              className="px-2 py-1 text-zinc-500 hover:text-zinc-300 bg-zinc-900/40 border-l border-zinc-800"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : null}
      </div>

      <p className="text-[11px] text-zinc-500">{insight}</p>
    </motion.div>
  );
}

function WidgetSettingsModal({
  open,
  widget,
  config,
  onClose,
  onApply,
}: {
  open: boolean;
  widget: (typeof JOURNAL_WIDGET_DEFINITIONS)[number] | null;
  config: WidgetDisplayConfig;
  onClose: () => void;
  onApply: (patch: Partial<WidgetDisplayConfig>) => void;
}) {
  const [nextTimeframe, setNextTimeframe] = useState<WidgetTimeframe>(config.timeframe);
  const [nextSide, setNextSide] = useState<WidgetSideFilter>(config.sideFilter);

  useEffect(() => {
    setNextTimeframe(config.timeframe);
    setNextSide(config.sideFilter);
  }, [config.sideFilter, config.timeframe, open, widget?.id]);

  if (!open || !widget) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          className="w-full max-w-xl rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-zinc-800 flex items-start justify-between">
            <div>
              <h3 className="text-xl font-bold text-zinc-100">{widget.name}</h3>
              <p className="text-sm text-zinc-500">{widget.description}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500 font-semibold mb-2">Side filter</p>
              <div className="inline-flex rounded-md border border-zinc-800 overflow-hidden">
                {([
                  ["long", "L"],
                  ["all", "M"],
                  ["short", "S"],
                ] as Array<[WidgetSideFilter, string]>).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setNextSide(value)}
                    className={cn(
                      "px-4 py-1.5 text-xs font-semibold",
                      nextSide === value
                        ? "bg-zinc-700 text-white"
                        : "bg-zinc-900/40 text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500 font-semibold mb-2">Time period</p>
              <div className="inline-flex rounded-md border border-zinc-800 overflow-hidden">
                {(["year", "month", "week", "day"] as WidgetTimeframe[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setNextTimeframe(value)}
                    className={cn(
                      "px-4 py-1.5 text-xs font-semibold uppercase",
                      nextTimeframe === value
                        ? "bg-zinc-700 text-white"
                        : "bg-zinc-900/40 text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="px-4 py-3 border-t border-zinc-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-zinc-800 text-zinc-300 text-sm font-medium"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                onApply({ timeframe: nextTimeframe, sideFilter: nextSide });
                onClose();
              }}
              className="px-3 py-1.5 rounded bg-emerald-500 text-black text-sm font-semibold"
            >
              Apply widget
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export function WidgetGrid({
  selectedWidgets,
  isEditing,
  globalTimeframe,
  widgetConfigs,
  onChangeWidgetConfig,
  onRemoveWidget,
  onMoveWidget,
}: WidgetGridProps) {
  const [settingsFor, setSettingsFor] = useState<string | null>(null);

  const widgets = selectedWidgets
    .map((id) => JOURNAL_WIDGET_DEFINITIONS.find((item) => item.id === id))
    .filter(Boolean) as (typeof JOURNAL_WIDGET_DEFINITIONS)[number][];

  const activeWidget = widgets.find((widget) => widget.id === settingsFor) ?? null;

  const activeConfig: WidgetDisplayConfig = settingsFor
    ? widgetConfigs[settingsFor] || { timeframe: globalTimeframe, sideFilter: "all" }
    : { timeframe: globalTimeframe, sideFilter: "all" };

  if (!widgets.length) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 h-[300px] flex flex-col items-center justify-center">
        <p className="text-sm text-zinc-500">No widgets active</p>
        <p className="text-xs text-zinc-600 mt-1">Use Add New Widget to build your dashboard.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-12 gap-3">
        {widgets.map((widget, index) => {
          const config = widgetConfigs[widget.id] || {
            timeframe: globalTimeframe,
            sideFilter: "all" as WidgetSideFilter,
          };

          return (
            <WidgetCard
              key={widget.id}
              widgetId={widget.id}
              index={index}
              isEditing={isEditing}
              globalTimeframe={globalTimeframe}
              config={config}
              onUpdateConfig={(patch) => onChangeWidgetConfig(widget.id, patch)}
              onRemove={() => onRemoveWidget(widget.id)}
              onMoveUp={() => onMoveWidget(widget.id, "up")}
              onMoveDown={() => onMoveWidget(widget.id, "down")}
              onOpenSettings={() => setSettingsFor(widget.id)}
            />
          );
        })}
      </div>

      <WidgetSettingsModal
        open={!!settingsFor}
        widget={activeWidget}
        config={activeConfig}
        onClose={() => setSettingsFor(null)}
        onApply={(patch) => {
          if (!settingsFor) return;
          onChangeWidgetConfig(settingsFor, patch);
        }}
      />
    </>
  );
}
