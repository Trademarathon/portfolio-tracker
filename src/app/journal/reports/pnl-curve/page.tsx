"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, CircleDot, Info, Settings2 } from "lucide-react";
import { useJournal } from "@/contexts/JournalContext";
import { STRATEGY_TAGS } from "@/lib/api/journal-types";
import {
  DAY_LABELS,
  HOLD_BUCKETS,
  SESSION_LABELS,
  buildEquityCurve,
  buildGroupedStats,
  buildSymbolStats,
  buildTagStats,
  getClosedTrades,
  getTradeMaeAbs,
  getTradeMfeAbs,
  pickColor,
  winRateFromCounts,
  type CurveOption,
} from "@/lib/journal/reports";
import { cn } from "@/lib/utils";
import { MultiCurveChart, formatMoney } from "@/components/Journal/Reports/charts";
import { ReportsSubnav } from "@/components/Journal/Reports/shared";

function buildMonthOptions(trades: ReturnType<typeof getClosedTrades>): CurveOption[] {
  const map = new Map<string, typeof trades>();

  trades.forEach((trade) => {
    const d = new Date(trade.timestamp);
    const id = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    if (!map.has(id)) map.set(id, []);
    map.get(id)?.push(trade);
  });

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, list], index) => {
      const [year, month] = id.split("-");
      const label = new Date(Number(year), Number(month) - 1, 1).toLocaleString("en-US", {
        month: "short",
        year: "numeric",
      });

      const totalPnl = list.reduce((sum, trade) => sum + Number(trade.realizedPnl ?? trade.pnl ?? 0), 0);
      const wins = list.filter((trade) => Number(trade.realizedPnl ?? trade.pnl ?? 0) > 0).length;
      const losses = list.filter((trade) => Number(trade.realizedPnl ?? trade.pnl ?? 0) < 0).length;
      const maeValues = list
        .map((trade) => getTradeMaeAbs(trade))
        .filter((value): value is number => value !== null);
      const mfeValues = list
        .map((trade) => getTradeMfeAbs(trade))
        .filter((value): value is number => value !== null);

      return {
        id: `month_${id}`,
        label,
        section: "Month",
        color: pickColor(index + 2),
        stats: {
          id: `month_${id}`,
          label,
          count: list.length,
          wins,
          losses,
          longs: list.filter((trade) => trade.side === "buy" || (trade.side as string) === "long").length,
          shorts: list.filter((trade) => trade.side === "sell" || (trade.side as string) === "short").length,
          totalPnl,
          avgPnl: list.length > 0 ? totalPnl / list.length : 0,
          avgHoldTimeMs: list.reduce((sum, trade) => sum + Number(trade.holdTime ?? 0), 0) / Math.max(1, list.length),
          avgMae: maeValues.length > 0 ? maeValues.reduce((sum, value) => sum + value, 0) / maeValues.length : 0,
          avgMfe: mfeValues.length > 0 ? mfeValues.reduce((sum, value) => sum + value, 0) / mfeValues.length : 0,
          fundingPaid: Math.abs(list.filter((trade) => Number(trade.funding ?? 0) < 0).reduce((sum, trade) => sum + Number(trade.funding ?? 0), 0)),
          fundingReceived: list.filter((trade) => Number(trade.funding ?? 0) > 0).reduce((sum, trade) => sum + Number(trade.funding ?? 0), 0),
          totalFees: list.reduce((sum, trade) => sum + Math.abs(Number(trade.fees ?? trade.feeUsd ?? trade.fee ?? 0)), 0),
          trades: list,
        },
      };
    });
}

export default function PnLCurvePage() {
  const { filteredTrades, annotations, preferences, setPreferences, isLoading } = useJournal();

  const [normalizeX, setNormalizeX] = useState(true);
  const [selectedCurveIds, setSelectedCurveIds] = useState<string[]>([]);
  const [searchBySection, setSearchBySection] = useState<Record<string, string>>({});

  const closedTrades = useMemo(() => getClosedTrades(filteredTrades), [filteredTrades]);

  const curveOptions = useMemo(() => {
    const bySide = buildGroupedStats(closedTrades, [
      {
        id: "side_long",
        label: "Long",
        match: (trade) => trade.side === "buy" || (trade.side as string) === "long",
      },
      {
        id: "side_short",
        label: "Short",
        match: (trade) => trade.side === "sell" || (trade.side as string) === "short",
      },
    ]).map((stat, index) => ({ id: stat.id, label: stat.label, section: "Trade Side", color: pickColor(index), stats: stat }));

    const byMonth = buildMonthOptions(closedTrades);

    const bySymbol = buildSymbolStats(closedTrades)
      .slice(0, 60)
      .map((stat, index) => ({
        id: `symbol_${stat.id}`,
        label: stat.label,
        section: "Symbol",
        color: pickColor(index + 4),
        stats: { ...stat, id: `symbol_${stat.id}` },
      }));

    const byTime = buildGroupedStats(
      closedTrades,
      [0, 4, 8, 12, 16, 20].map((hour) => ({
        id: `tod_${hour}`,
        label: `${String(hour).padStart(2, "0")}-${String((hour + 4) % 24).padStart(2, "0")}`,
        match: (trade) => {
          const h = new Date(trade.timestamp).getUTCHours();
          return h >= hour && h < hour + 4;
        },
      }))
    ).map((stat, index) => ({ id: stat.id, label: stat.label, section: "Time of Day", color: pickColor(index + 8), stats: stat }));

    const byHold = buildGroupedStats(
      closedTrades,
      HOLD_BUCKETS.map((bucket) => ({
        id: `hold_${bucket.id}`,
        label: bucket.label,
        match: (trade) => {
          const hold = Number(trade.holdTime ?? 0);
          return hold >= bucket.min && hold < bucket.max;
        },
      }))
    ).map((stat, index) => ({ id: stat.id, label: stat.label, section: "Holdtime", color: pickColor(index + 3), stats: stat }));

    const byDay = buildGroupedStats(
      closedTrades,
      DAY_LABELS.map((day) => ({
        id: `day_${day.id}`,
        label: day.label,
        match: (trade) => new Date(trade.timestamp).getUTCDay() === day.day,
      }))
    ).map((stat, index) => ({ id: stat.id, label: stat.label, section: "Day of Week", color: pickColor(index + 1), stats: stat }));

    const bySession = buildGroupedStats(
      closedTrades,
      SESSION_LABELS.map((session) => ({
        id: `session_${session.id}`,
        label: session.label,
        match: (trade) => {
          const hour = new Date(trade.timestamp).getUTCHours();
          return session.test(hour);
        },
      }))
    ).map((stat, index) => ({ id: stat.id, label: stat.label, section: "Session", color: pickColor(index + 6), stats: stat }));

    const byTag = buildTagStats(closedTrades, annotations)
      .map((stat, index) => {
        const meta = STRATEGY_TAGS.find((tag) => tag.id === stat.id);
        return {
          id: `tag_${stat.id}`,
          label: meta?.name ?? stat.id,
          section: "Tags",
          color: meta?.color ?? pickColor(index + 5),
          stats: { ...stat, id: `tag_${stat.id}` },
        };
      });

    return [...bySide, ...byMonth, ...bySymbol, ...byTime, ...byHold, ...byDay, ...bySession, ...byTag]
      .filter((option) => option.stats.count > 0);
  }, [annotations, closedTrades]);

  useEffect(() => {
    if (selectedCurveIds.length > 0 || curveOptions.length === 0) return;
    const defaults = curveOptions
      .filter((option) => option.section === "Trade Side")
      .slice(0, 2)
      .map((option) => option.id);
    setSelectedCurveIds(defaults);
  }, [curveOptions, selectedCurveIds.length]);

  const optionsBySection = useMemo(() => {
    const map = new Map<string, CurveOption[]>();

    curveOptions.forEach((option) => {
      if (!map.has(option.section)) map.set(option.section, []);
      map.get(option.section)?.push(option);
    });

    return Array.from(map.entries());
  }, [curveOptions]);

  const selectedCurves = useMemo(
    () => curveOptions.filter((option) => selectedCurveIds.includes(option.id)),
    [curveOptions, selectedCurveIds]
  );

  const chartCurves = useMemo(
    () =>
      selectedCurves.map((option) => ({
        id: option.id,
        label: `${option.label} (${option.section})`,
        color: option.color,
        points: buildEquityCurve(option.stats.trades, normalizeX),
      })),
    [normalizeX, selectedCurves]
  );

  const toggleCurve = (id: string) => {
    setSelectedCurveIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  };

  const clearSelection = () => setSelectedCurveIds([]);

  const handleSearch = (section: string, value: string) => {
    setSearchBySection((prev) => ({ ...prev, [section]: value }));
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
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-4xl font-black text-white">PnL Curve Report</h2>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPreferences({ hideBalances: !preferences.hideBalances })}
              className="px-3 py-1.5 rounded-md border border-zinc-700 text-xs font-semibold text-zinc-400 hover:text-white"
            >
              Hide Balances
            </button>
            <button
              type="button"
              onClick={() => setPreferences({ permanentFiltersEnabled: !preferences.permanentFiltersEnabled })}
              className={cn(
                "px-3 py-1.5 rounded-md border text-xs font-semibold",
                preferences.permanentFiltersEnabled
                  ? "border-amber-500/40 text-amber-300 bg-amber-500/15"
                  : "border-zinc-700 text-zinc-400 hover:text-white"
              )}
            >
              Permanent Filters
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 2xl:grid-cols-12 gap-3">
          <div className="2xl:col-span-9 rounded-xl border border-zinc-800/70 bg-zinc-900/35 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-bold text-zinc-100 inline-flex items-center gap-2">
                <CircleDot className="w-4 h-4 text-emerald-400" />
                Curve Comparison
              </h3>

              <label className="inline-flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={normalizeX}
                  onChange={(event) => setNormalizeX(event.target.checked)}
                  className="w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-800 text-emerald-500"
                />
                Normalize X-axis
                <Info className="w-3.5 h-3.5 text-zinc-600" />
              </label>
            </div>

            <MultiCurveChart curves={chartCurves} />

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {selectedCurves.map((curve) => (
                <div key={curve.id} className="inline-flex items-center gap-1.5 text-zinc-300">
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: curve.color }} />
                  <span>{curve.label}</span>
                  <span className={cn("font-semibold", curve.stats.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                    {formatMoney(curve.stats.totalPnl, preferences.hideBalances, true)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="2xl:col-span-3 rounded-xl border border-zinc-800/70 bg-zinc-900/35 p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-bold text-zinc-100 inline-flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-emerald-400" />
                Curve Selector
              </h3>
              <button
                type="button"
                onClick={clearSelection}
                className="px-2 py-1 rounded text-[11px] text-zinc-400 border border-zinc-700 hover:text-white"
              >
                Deselect All
              </button>
            </div>

            <p className="text-xs text-zinc-500 mb-3">
              Select attributes to plot and compare how each group performs on the same equity timeline.
            </p>

            <div className="space-y-3 max-h-[760px] overflow-y-auto pr-1">
              {optionsBySection.map(([section, options]) => {
                const search = (searchBySection[section] ?? "").trim().toLowerCase();
                const visible = options.filter((option) => option.label.toLowerCase().includes(search));

                return (
                  <div key={section} className="rounded-md border border-zinc-800/70 bg-zinc-950/35 p-2.5">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-zinc-200">{section}</h4>
                      <input
                        value={searchBySection[section] ?? ""}
                        onChange={(event) => handleSearch(section, event.target.value)}
                        placeholder="Search"
                        className="w-24 h-6 rounded bg-zinc-900 border border-zinc-800 px-1.5 text-[11px] text-zinc-300"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {visible.map((option) => {
                        const checked = selectedCurveIds.includes(option.id);
                        return (
                          <label
                            key={option.id}
                            className={cn(
                              "flex items-start gap-2 px-2 py-1.5 rounded cursor-pointer border",
                              checked
                                ? "bg-emerald-500/10 border-emerald-500/25"
                                : "bg-zinc-900/35 border-zinc-800/60 hover:border-zinc-700"
                            )}
                          >
                            <span
                              className={cn(
                                "mt-0.5 w-3.5 h-3.5 rounded-sm border inline-flex items-center justify-center",
                                checked ? "bg-emerald-500 border-emerald-500" : "border-zinc-600"
                              )}
                            >
                              {checked ? <Check className="w-3 h-3 text-black" /> : null}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs text-zinc-200 truncate">{option.label}</span>
                              <span className="block text-[10px] mt-0.5">
                                <span className={cn(option.stats.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                  {formatMoney(option.stats.totalPnl, preferences.hideBalances, true)}
                                </span>
                                <span className="text-zinc-500"> | {winRateFromCounts(option.stats.wins, option.stats.losses).toFixed(0)}% | {option.stats.count}</span>
                              </span>
                            </span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCurve(option.id)}
                              className="hidden"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
