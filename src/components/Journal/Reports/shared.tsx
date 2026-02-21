"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { endOfDay, endOfMonth, endOfWeek, startOfDay, startOfMonth, startOfWeek, subMonths, subWeeks } from "date-fns";
import { Eye, EyeOff, Filter, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { STRATEGY_TAGS, type StrategyTagId } from "@/lib/api/journal-types";
import { type DateRange, type JournalFilters, useJournal } from "@/contexts/JournalContext";

type DateGroupBy = "open" | "close";

type HoldFilterOption = {
  id: string;
  label: string;
  min: number | null;
  max: number | null;
};

const DEFAULT_FILTERS: JournalFilters = {
  status: "all",
  side: "all",
  symbols: [],
  tags: [],
  exchange: "",
  minPnl: null,
  maxPnl: null,
  minHoldTime: null,
  maxHoldTime: null,
  reviewStatus: "all",
  playbookIds: [],
  connectionIds: [],
  minEntryPrice: null,
  maxEntryPrice: null,
  minExitPrice: null,
  maxExitPrice: null,
  minRMultiple: null,
  maxRMultiple: null,
  minPositionSize: null,
  maxPositionSize: null,
  minVolume: null,
  maxVolume: null,
  includeSymbols: [],
  excludeSymbols: [],
  includeTags: [],
  excludeTags: [],
};

const HOLD_FILTER_OPTIONS: HoldFilterOption[] = [
  { id: "all", label: "Any hold time", min: null, max: null },
  { id: "under_5m", label: "Under 5m", min: 0, max: 5 * 60 * 1000 },
  { id: "5m_30m", label: "5m - 30m", min: 5 * 60 * 1000, max: 30 * 60 * 1000 },
  { id: "30m_2h", label: "30m - 2h", min: 30 * 60 * 1000, max: 2 * 60 * 60 * 1000 },
  { id: "2h_1d", label: "2h - 1d", min: 2 * 60 * 60 * 1000, max: 24 * 60 * 60 * 1000 },
  { id: "1d_plus", label: "1d+", min: 24 * 60 * 60 * 1000, max: null },
];

const DATE_PRESETS = [
  { id: "all", label: "All trades" },
  { id: "last25", label: "Last 25 trades" },
  { id: "last100", label: "Last 100 trades" },
  { id: "today", label: "Today" },
  { id: "thisWeek", label: "This week" },
  { id: "lastWeek", label: "Last week" },
  { id: "thisMonth", label: "This month" },
  { id: "lastMonth", label: "Last month" },
  { id: "thisYear", label: "This year" },
];

function createDateRangeFromPreset(preset: string, groupBy: DateGroupBy): DateRange {
  const now = new Date();

  switch (preset) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now), preset, mode: "range", groupBy };
    case "thisWeek":
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 }),
        preset,
        mode: "range",
        groupBy,
      };
    case "lastWeek": {
      const week = subWeeks(now, 1);
      return {
        start: startOfWeek(week, { weekStartsOn: 1 }),
        end: endOfWeek(week, { weekStartsOn: 1 }),
        preset,
        mode: "range",
        groupBy,
      };
    }
    case "thisMonth":
      return { start: startOfMonth(now), end: endOfMonth(now), preset, mode: "range", groupBy };
    case "lastMonth": {
      const month = subMonths(now, 1);
      return { start: startOfMonth(month), end: endOfMonth(month), preset, mode: "range", groupBy };
    }
    case "thisYear":
      return {
        start: new Date(now.getFullYear(), 0, 1),
        end: now,
        preset,
        mode: "range",
        groupBy,
      };
    case "all":
    case "last25":
    case "last100":
    default:
      return { start: null, end: null, preset, mode: "range", groupBy };
  }
}

const REPORT_ITEMS = [
  { id: "tags", label: "Tags report", href: "/journal/reports/tags" },
  { id: "symbols", label: "Symbols report", href: "/journal/reports/symbols" },
  { id: "pnl", label: "PnL curve report", href: "/journal/reports/pnl-curve" },
  { id: "risk", label: "Risk report", href: "/journal/reports/risk" },
  { id: "day_time", label: "Day & Time report", href: "/journal/reports/day-time" },
  { id: "playbook", label: "Playbook report", href: "/journal/reports/playbook" },
  { id: "win_loss", label: "Win vs Loss report", href: "/journal/reports/win-loss" },
  { id: "compare", label: "Compare report", href: "/journal/reports/compare" },
  { id: "options", label: "Options report", href: "/journal/reports/options" },
];

export function ReportsSubnav() {
  const pathname = usePathname();

  return (
    <aside className="rounded-xl border border-zinc-800/70 bg-zinc-950/60 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-zinc-800/70">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500">Reports</p>
      </div>
      <div className="p-1.5 space-y-1">
        {REPORT_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "block rounded-md px-2.5 py-2 text-[12px] font-medium transition-colors",
                active
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-900/70"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}

export function ReportsFiltersBar() {
  const {
    trades,
    playbooks,
    filters,
    setFilters,
    dateRange,
    setDateRange,
    preferences,
    setPreferences,
  } = useJournal();

  const symbols = Array.from(new Set((trades || []).map((trade) => String(trade.symbol || "")).filter(Boolean))).sort();
  const exchanges = Array.from(new Set((trades || []).map((trade) => String(trade.exchange || "")).filter(Boolean))).sort();
  const connections = Array.from(
    new Set((trades || []).map((trade) => String((trade as unknown as { connectionId?: unknown }).connectionId || "")).filter(Boolean))
  ).sort();

  const activeHoldFilter =
    HOLD_FILTER_OPTIONS.find((item) => item.min === filters.minHoldTime && item.max === filters.maxHoldTime)?.id ?? "all";

  const updateFilters = (patch: Partial<JournalFilters>) => setFilters({ ...filters, ...patch });
  const parseNumberInput = (value: string): number | null => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setDateRange({ start: null, end: null, preset: "all", mode: "range", groupBy: dateRange.groupBy });
  };

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/25 p-3.5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-zinc-300">
          <Filter className="w-4 h-4 text-emerald-400" />
          <span className="text-xs uppercase tracking-wider font-semibold">Report Filters</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-zinc-700 text-[11px] font-semibold text-zinc-400 hover:text-white"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset filters
          </button>

          <button
            type="button"
            onClick={() => setPreferences({ hideBalances: !preferences.hideBalances })}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-zinc-700 text-[11px] font-semibold text-zinc-400 hover:text-white"
          >
            {preferences.hideBalances ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            Hide balances
          </button>

          <button
            type="button"
            onClick={() => setPreferences({ permanentFiltersEnabled: !preferences.permanentFiltersEnabled })}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[11px] font-semibold",
              preferences.permanentFiltersEnabled
                ? "border-amber-500/40 text-amber-300 bg-amber-500/15"
                : "border-zinc-700 text-zinc-400 hover:text-white"
            )}
          >
            Permanent filters
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-12 gap-2">
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Status</span>
          <select
            value={filters.status}
            onChange={(event) => updateFilters({ status: event.target.value as JournalFilters["status"] })}
            className="w-full h-8 rounded-md bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 px-2"
          >
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Ticker</span>
          <select
            value={filters.symbols[0] ?? "all"}
            onChange={(event) => {
              const next = event.target.value === "all" ? [] : [event.target.value];
              updateFilters({ symbols: next, includeSymbols: next });
            }}
            className="w-full h-8 rounded-md bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 px-2"
          >
            <option value="all">All symbols</option>
            {symbols.map((symbol) => (
              <option key={symbol} value={symbol}>
                {symbol}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Date</span>
          <select
            value={dateRange.preset}
            onChange={(event) => setDateRange(createDateRangeFromPreset(event.target.value, dateRange.groupBy))}
            className="w-full h-8 rounded-md bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 px-2"
          >
            {DATE_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
            {dateRange.preset === "custom" ? <option value="custom">Custom</option> : null}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Side</span>
          <select
            value={filters.side}
            onChange={(event) => updateFilters({ side: event.target.value as JournalFilters["side"] })}
            className="w-full h-8 rounded-md bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 px-2"
          >
            <option value="all">All</option>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Exchange</span>
          <select
            value={filters.exchange || "all"}
            onChange={(event) => updateFilters({ exchange: event.target.value === "all" ? "" : event.target.value })}
            className="w-full h-8 rounded-md bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 px-2"
          >
            <option value="all">All exchanges</option>
            {exchanges.map((exchange) => (
              <option key={exchange} value={exchange}>
                {exchange}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Tags</span>
          <select
            value={filters.tags[0] ?? "all"}
            onChange={(event) => {
              const value = event.target.value as StrategyTagId | "all";
              const next = value === "all" ? [] : [value];
              updateFilters({ tags: next, includeTags: next });
            }}
            className="w-full h-8 rounded-md bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 px-2"
          >
            <option value="all">All tags</option>
            {STRATEGY_TAGS.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Hold Time</span>
          <select
            value={activeHoldFilter}
            onChange={(event) => {
              const selected = HOLD_FILTER_OPTIONS.find((option) => option.id === event.target.value);
              if (!selected) return;
              updateFilters({ minHoldTime: selected.min, maxHoldTime: selected.max });
            }}
            className="w-full h-8 rounded-md bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 px-2"
          >
            {HOLD_FILTER_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Review</span>
          <select
            value={filters.reviewStatus ?? "all"}
            onChange={(event) => updateFilters({ reviewStatus: event.target.value as JournalFilters["reviewStatus"] })}
            className="w-full h-8 rounded-md bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 px-2"
          >
            <option value="all">All trades</option>
            <option value="reviewed">Reviewed</option>
            <option value="unreviewed">Unreviewed</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Playbook</span>
          <select
            value={filters.playbookIds?.[0] ?? "all"}
            onChange={(event) => updateFilters({ playbookIds: event.target.value === "all" ? [] : [event.target.value] })}
            className="w-full h-8 rounded-md bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 px-2"
          >
            <option value="all">All playbooks</option>
            {playbooks.map((playbook) => (
              <option key={playbook.id} value={playbook.id}>
                {playbook.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Account</span>
          <select
            value={filters.connectionIds?.[0] ?? "all"}
            onChange={(event) => updateFilters({ connectionIds: event.target.value === "all" ? [] : [event.target.value] })}
            className="w-full h-8 rounded-md bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 px-2"
          >
            <option value="all">All accounts</option>
            {connections.map((connectionId) => (
              <option key={connectionId} value={connectionId}>
                {connectionId}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Exclude Symbol</span>
          <select
            value={filters.excludeSymbols?.[0] ?? "none"}
            onChange={(event) => updateFilters({ excludeSymbols: event.target.value === "none" ? [] : [event.target.value] })}
            className="w-full h-8 rounded-md bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 px-2"
          >
            <option value="none">None</option>
            {symbols.map((symbol) => (
              <option key={symbol} value={symbol}>
                {symbol}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Exclude Tag</span>
          <select
            value={filters.excludeTags?.[0] ?? "none"}
            onChange={(event) => {
              const value = event.target.value as StrategyTagId | "none";
              updateFilters({ excludeTags: value === "none" ? [] : [value] });
            }}
            className="w-full h-8 rounded-md bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 px-2"
          >
            <option value="none">None</option>
            {STRATEGY_TAGS.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">R Min</span>
          <input
            type="number"
            step="0.1"
            value={filters.minRMultiple ?? ""}
            onChange={(event) => updateFilters({ minRMultiple: parseNumberInput(event.target.value) })}
            className="w-full h-8 rounded-md bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 px-2"
            placeholder="e.g. 1"
          />
        </label>

        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">R Max</span>
          <input
            type="number"
            step="0.1"
            value={filters.maxRMultiple ?? ""}
            onChange={(event) => updateFilters({ maxRMultiple: parseNumberInput(event.target.value) })}
            className="w-full h-8 rounded-md bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 px-2"
            placeholder="e.g. 3"
          />
        </label>

        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Size Min</span>
          <input
            type="number"
            step="1"
            value={filters.minPositionSize ?? ""}
            onChange={(event) => updateFilters({ minPositionSize: parseNumberInput(event.target.value) })}
            className="w-full h-8 rounded-md bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 px-2"
            placeholder="USD"
          />
        </label>

        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Size Max</span>
          <input
            type="number"
            step="1"
            value={filters.maxPositionSize ?? ""}
            onChange={(event) => updateFilters({ maxPositionSize: parseNumberInput(event.target.value) })}
            className="w-full h-8 rounded-md bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 px-2"
            placeholder="USD"
          />
        </label>

        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Volume Min</span>
          <input
            type="number"
            step="1"
            value={filters.minVolume ?? ""}
            onChange={(event) => updateFilters({ minVolume: parseNumberInput(event.target.value) })}
            className="w-full h-8 rounded-md bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 px-2"
            placeholder="USD"
          />
        </label>

        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Volume Max</span>
          <input
            type="number"
            step="1"
            value={filters.maxVolume ?? ""}
            onChange={(event) => updateFilters({ maxVolume: parseNumberInput(event.target.value) })}
            className="w-full h-8 rounded-md bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 px-2"
            placeholder="USD"
          />
        </label>

        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Entry Min</span>
          <input
            type="number"
            step="0.01"
            value={filters.minEntryPrice ?? ""}
            onChange={(event) => updateFilters({ minEntryPrice: parseNumberInput(event.target.value) })}
            className="w-full h-8 rounded-md bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 px-2"
            placeholder="Price"
          />
        </label>

        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Entry Max</span>
          <input
            type="number"
            step="0.01"
            value={filters.maxEntryPrice ?? ""}
            onChange={(event) => updateFilters({ maxEntryPrice: parseNumberInput(event.target.value) })}
            className="w-full h-8 rounded-md bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 px-2"
            placeholder="Price"
          />
        </label>

        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Exit Min</span>
          <input
            type="number"
            step="0.01"
            value={filters.minExitPrice ?? ""}
            onChange={(event) => updateFilters({ minExitPrice: parseNumberInput(event.target.value) })}
            className="w-full h-8 rounded-md bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 px-2"
            placeholder="Price"
          />
        </label>

        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Exit Max</span>
          <input
            type="number"
            step="0.01"
            value={filters.maxExitPrice ?? ""}
            onChange={(event) => updateFilters({ maxExitPrice: parseNumberInput(event.target.value) })}
            className="w-full h-8 rounded-md bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 px-2"
            placeholder="Price"
          />
        </label>

        <div className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Date Mode</span>
          <div className="h-8 rounded-md bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 px-2 flex items-center">
            {dateRange.mode}
          </div>
        </div>
      </div>
    </div>
  );
}
