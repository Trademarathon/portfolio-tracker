"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { ChevronDown, ChevronUp, RotateCcw, Settings2 } from "lucide-react";
import { STRATEGY_TAGS, type StrategyTagId } from "@/lib/api/journal-types";
import {
  type DateRange,
  type JournalFilters,
  type JournalPreferences,
  type JournalTrade,
  useJournal,
} from "@/contexts/JournalContext";
import { cn } from "@/lib/utils";
import { TradeRow } from "./TradeRow";

type SortField = "symbol" | "side" | "openTime" | "holdTime" | "entryPrice" | "pnl";
type SortDirection = "asc" | "desc";
type DateGroupBy = "open" | "close";

interface TradeTableProps {
  trades: JournalTrade[];
  preferences: JournalPreferences;
  showOpenOnly?: boolean;
}

const TABLE_GRID_CLASS =
  "grid grid-cols-[minmax(170px,1.45fr)_minmax(150px,1fr)_minmax(250px,1.8fr)_minmax(110px,0.75fr)_minmax(230px,1.65fr)_minmax(110px,0.7fr)_48px] items-center gap-3";

const columns: { id: SortField; label: string }[] = [
  { id: "symbol", label: "Symbol" },
  { id: "side", label: "Side & Size" },
  { id: "openTime", label: "Open & Close Times" },
  { id: "holdTime", label: "Hold Time" },
  { id: "entryPrice", label: "Entry & Exit" },
  { id: "pnl", label: "PnL" },
];

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

const HOLD_FILTER_OPTIONS = [
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
      return { start: new Date(now.getFullYear(), 0, 1), end: now, preset, mode: "range", groupBy };
    case "all":
    case "last25":
    case "last100":
    default:
      return { start: null, end: null, preset, mode: "range", groupBy };
  }
}

export function TradeTable({ trades, preferences, showOpenOnly = false }: TradeTableProps) {
  const {
    connectedExchanges,
    syncDiagnostics,
    playbooks,
    trades: allJournalTrades,
    filters,
    setFilters,
    dateRange,
    setDateRange,
  } = useJournal();
  const [sortField, setSortField] = useState<SortField>("openTime");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const symbols = useMemo(
    () =>
      Array.from(new Set((allJournalTrades || []).map((trade) => String(trade.symbol || "")).filter(Boolean))).sort(),
    [allJournalTrades]
  );
  const exchanges = useMemo(
    () =>
      Array.from(new Set((allJournalTrades || []).map((trade) => String(trade.exchange || "")).filter(Boolean))).sort(),
    [allJournalTrades]
  );

  const activeHoldFilter =
    HOLD_FILTER_OPTIONS.find((item) => item.min === filters.minHoldTime && item.max === filters.maxHoldTime)?.id ?? "all";

  const updateFilters = (patch: Partial<JournalFilters>) => setFilters({ ...filters, ...patch });

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setDateRange({ start: null, end: null, preset: "all", mode: "range", groupBy: dateRange.groupBy });
  };

  const filteredTrades = useMemo(() => {
    const result = trades;
    if (showOpenOnly) return result.filter((trade) => trade.isOpen);
    return result.filter((trade) => !trade.isOpen);
  }, [trades, showOpenOnly]);

  const sortedTrades = useMemo(() => {
    return [...filteredTrades].sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sortField) {
        case "symbol":
          aVal = a.symbol || "";
          bVal = b.symbol || "";
          break;
        case "side":
          aVal = a.side || "";
          bVal = b.side || "";
          break;
        case "openTime":
          aVal = a.timestamp;
          bVal = b.timestamp;
          break;
        case "holdTime":
          aVal = a.holdTime || 0;
          bVal = b.holdTime || 0;
          break;
        case "entryPrice":
          aVal = a.entryPrice || a.price || 0;
          bVal = b.entryPrice || b.price || 0;
          break;
        case "pnl":
          aVal = a.realizedPnl || 0;
          bVal = b.realizedPnl || 0;
          break;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      return sortDirection === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [filteredTrades, sortDirection, sortField]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const totalPages = Math.ceil(sortedTrades.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, dateRange, showOpenOnly]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) setCurrentPage(1);
  }, [currentPage, totalPages]);

  const currentTrades = sortedTrades.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
      return;
    }
    setSortField(field);
    setSortDirection("desc");
  };

  const hasSyncFailure = Object.values(syncDiagnostics).some((diag) => diag.status === "error");
  const firstSyncError = Object.entries(syncDiagnostics).find(([, diag]) => diag.status === "error");
  const hasAnyStoredTrades = Array.isArray(allJournalTrades) && allJournalTrades.length > 0;
  const emptyStateMessage = (() => {
    if (connectedExchanges.length === 0) return "No exchanges connected";
    if (!hasAnyStoredTrades && hasSyncFailure) return "Trade sync failed. Check connection diagnostics and retry.";
    if (!hasAnyStoredTrades) return "No trades returned from connected exchanges yet";
    return "Trades are currently filtered out";
  })();

  const startItem = sortedTrades.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, sortedTrades.length);

  return (
    <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/35 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800/60 bg-zinc-900/50">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-11 gap-2.5">
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Status</span>
            <select
              value={filters.status}
              onChange={(event) => updateFilters({ status: event.target.value as JournalFilters["status"] })}
              className="w-full h-8 rounded-md bg-zinc-950/60 border border-zinc-800 text-xs text-zinc-300 px-2"
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
              className="w-full h-8 rounded-md bg-zinc-950/60 border border-zinc-800 text-xs text-zinc-300 px-2"
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
              onChange={(event) =>
                setDateRange(createDateRangeFromPreset(event.target.value, dateRange.groupBy as DateGroupBy))
              }
              className="w-full h-8 rounded-md bg-zinc-950/60 border border-zinc-800 text-xs text-zinc-300 px-2"
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
              className="w-full h-8 rounded-md bg-zinc-950/60 border border-zinc-800 text-xs text-zinc-300 px-2"
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
              className="w-full h-8 rounded-md bg-zinc-950/60 border border-zinc-800 text-xs text-zinc-300 px-2"
            >
              <option value="all">All exchanges</option>
              {exchanges.map((exchange) => (
                <option key={exchange} value={exchange}>
                  {exchange}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Tags</span>
              <Link href="/journal/preferences" className="text-[10px] text-emerald-400 hover:text-emerald-300">
                Create Tag Cluster
              </Link>
            </div>
            <select
              value={filters.tags[0] ?? "all"}
              onChange={(event) => {
                const nextTag = event.target.value as StrategyTagId | "all";
                const next = nextTag === "all" ? [] : [nextTag];
                updateFilters({ tags: next, includeTags: next });
              }}
              className="w-full h-8 rounded-md bg-zinc-950/60 border border-zinc-800 text-xs text-zinc-300 px-2"
            >
              <option value="all">All tags</option>
              {STRATEGY_TAGS.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </div>

          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Review</span>
            <select
              value={filters.reviewStatus ?? "all"}
              onChange={(event) => updateFilters({ reviewStatus: event.target.value as JournalFilters["reviewStatus"] })}
              className="w-full h-8 rounded-md bg-zinc-950/60 border border-zinc-800 text-xs text-zinc-300 px-2"
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
              className="w-full h-8 rounded-md bg-zinc-950/60 border border-zinc-800 text-xs text-zinc-300 px-2"
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
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Hold Time</span>
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            </div>
            <select
              value={activeHoldFilter}
              onChange={(event) => {
                const selected = HOLD_FILTER_OPTIONS.find((option) => option.id === event.target.value);
                if (!selected) return;
                updateFilters({ minHoldTime: selected.min, maxHoldTime: selected.max });
              }}
              className="w-full h-8 rounded-md bg-zinc-950/60 border border-zinc-800 text-xs text-zinc-300 px-2"
            >
              {HOLD_FILTER_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="overflow-x-auto border-b border-zinc-800/60">
        <div className={cn(TABLE_GRID_CLASS, "min-w-[1080px] px-4 py-2.5 bg-zinc-900/45")}>
          {columns.map((column) => (
            <button
              key={column.id}
              type="button"
              onClick={() => handleSort(column.id)}
              className={cn(
                "flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] font-semibold transition-colors text-left",
                sortField === column.id ? "text-emerald-400" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {column.label}
              {sortField === column.id ? (
                sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
              ) : null}
            </button>
          ))}
          <div className="flex justify-end text-zinc-500">
            <Settings2 className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[1080px] divide-y divide-zinc-800/55">
          {currentTrades.length > 0 ? (
            currentTrades.map((trade, index) => (
              <TradeRow
                key={trade.id}
                trade={trade}
                preferences={preferences}
                isExpanded={expandedId === trade.id}
                onExpand={() => setExpandedId(expandedId === trade.id ? null : trade.id)}
                index={index}
                gridClassName={TABLE_GRID_CLASS}
              />
            ))
          ) : (
            <div className="py-16 text-center">
              <p className="text-zinc-500 text-sm">{emptyStateMessage}</p>
              {firstSyncError && !hasAnyStoredTrades ? (
                <p className="text-[11px] text-amber-500 mt-2">
                  {firstSyncError[0]}: {firstSyncError[1].message || "Connection/auth error"}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-3 border-t border-zinc-800/60 flex items-center justify-between">
        <span className="text-xs text-zinc-500">
          Showing {startItem} - {endItem} of {sortedTrades.length}
        </span>

        {totalPages > 1 ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="h-7 w-7 rounded-md border border-zinc-700 text-zinc-400 hover:text-white disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronUp className="h-3.5 w-3.5 rotate-[-90deg] mx-auto" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="h-7 w-7 rounded-md border border-zinc-700 text-zinc-400 hover:text-white disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronDown className="h-3.5 w-3.5 rotate-[-90deg] mx-auto" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
