"use client";

import { useEffect, useMemo, useState, type ElementType } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRealtimeMarket } from "@/hooks/useRealtimeMarket";
import { useMovementAlerts } from "@/hooks/useMovementAlerts";
import { useAlerts } from "@/hooks/useAlerts";
import { useScreenerData, type EnhancedTickerData } from "@/hooks/useScreenerData";
import { normalizeSymbol } from "@/lib/utils/normalization";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { AlphaSignalExport } from "@/components/Dashboard/NeuralAlphaFeed";
import type { ScreenerFilter } from "@/components/Screener/FiltersPanel";
import { getMovementAlertsSettings } from "@/lib/movementAlertsSettings";
import {
    Activity,
    ArrowDownCircle,
    ArrowUpCircle,
    BarChart3,
    Clock,
    Flag,
    Sparkles,
    TrendingDown,
    TrendingUp,
    Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ComponentSettingsLink } from "@/components/ui/ComponentSettingsLink";

const STABLES = ["USDT", "USDC", "DAI", "BUSD", "TUSD", "FRAX"];
const SYMBOL_RE = /^[A-Z][A-Z0-9]{1,14}$/;
const WATCHLIST_FAVORITES_KEY = "watchlist_favorites";
const WATCHLIST_FILTERS_KEY = "watchlist_filters";
const WATCHLIST_FILTERS_EVENT = "watchlist-filters-changed";
const NEW_ALERT_THRESHOLD_MS = 2 * 60 * 1000;
const MAX_SCOPED_SYMBOLS = 24;

type FeedFilter = "all" | "high" | "fresh" | "breakouts";
type SortMode = "latest" | "strength";
type SignalSource = "movement" | "watchlist";
type SignalTone = "amber" | "emerald" | "rose" | "cyan";
type Preset = "all" | "high-volume" | "oi-spike" | "big-movers" | "high-funding";

interface FeedSignal extends AlphaSignalExport {
    source: SignalSource;
    confidence: number | null;
}

interface WatchlistFiltersState {
    version: 1;
    search: string;
    preset: Preset;
    exchangeFilter: string;
    filters: ScreenerFilter[];
    updatedAt?: number;
}

const PRIORITY_WEIGHT: Record<AlphaSignalExport["priority"], number> = {
    high: 3,
    medium: 2,
    low: 1,
};

const TYPE_META: Record<
    string,
    { icon: ElementType; tone: SignalTone; label: string; isBreakout?: boolean }
> = {
    IMMINENT_MOVEMENT: { icon: Activity, tone: "amber", label: "Imminent movement" },
    BREAK_UP: { icon: ArrowUpCircle, tone: "emerald", label: "Break up", isBreakout: true },
    BREAK_DOWN: { icon: ArrowDownCircle, tone: "rose", label: "Break down", isBreakout: true },
    GOING_UP: { icon: TrendingUp, tone: "emerald", label: "Going up" },
    GOING_DOWN: { icon: TrendingDown, tone: "rose", label: "Going down" },
    SUDDEN_VOLUME: { icon: BarChart3, tone: "cyan", label: "Volume expansion" },
    EXTREME_UP: { icon: Flag, tone: "emerald", label: "Extreme up" },
    EXTREME_DOWN: { icon: Flag, tone: "rose", label: "Extreme down" },
};

const ALERT_SIGNAL_TYPE_MAP: Record<string, AlphaSignalExport["type"]> = {
    breakout_up: "BREAK_UP",
    breakout_down: "BREAK_DOWN",
    trend_shift: "IMMINENT_MOVEMENT",
    squeeze: "IMMINENT_MOVEMENT",
    massive_buy: "GOING_UP",
    massive_sell: "GOING_DOWN",
};

const TONE_STYLES: Record<
    SignalTone,
    { icon: string; chip: string; border: string; glow: string; accent: string }
> = {
    amber: {
        icon: "bg-amber-500/15 text-amber-300 border-amber-300/25",
        chip: "bg-amber-500/12 text-amber-300 border-amber-300/30",
        border: "border-amber-300/25",
        glow: "ring-1 ring-amber-300/35",
        accent: "bg-amber-300/80",
    },
    emerald: {
        icon: "bg-emerald-500/15 text-emerald-300 border-emerald-300/25",
        chip: "bg-emerald-500/12 text-emerald-300 border-emerald-300/30",
        border: "border-emerald-300/25",
        glow: "ring-1 ring-emerald-300/35",
        accent: "bg-emerald-300/80",
    },
    rose: {
        icon: "bg-rose-500/15 text-rose-300 border-rose-300/25",
        chip: "bg-rose-500/12 text-rose-300 border-rose-300/30",
        border: "border-rose-300/25",
        glow: "ring-1 ring-rose-300/35",
        accent: "bg-rose-300/80",
    },
    cyan: {
        icon: "bg-cyan-500/15 text-cyan-300 border-cyan-300/25",
        chip: "bg-cyan-500/12 text-cyan-300 border-cyan-300/30",
        border: "border-cyan-300/25",
        glow: "ring-1 ring-cyan-300/35",
        accent: "bg-cyan-300/80",
    },
};

function isTrackableSymbol(symbol: string): boolean {
    const s = (symbol || "").toUpperCase().trim();
    if (!s) return false;
    if (s.startsWith("@")) return false;
    if (/^\d+$/.test(s)) return false;
    return SYMBOL_RE.test(s);
}

const PRESET_VALUES: Preset[] = ["all", "high-volume", "oi-spike", "big-movers", "high-funding"];

const DEFAULT_WATCHLIST_FILTERS: WatchlistFiltersState = {
    version: 1,
    search: "",
    preset: "all",
    exchangeFilter: "all",
    filters: [],
};

function isPresetValue(value: unknown): value is Preset {
    return typeof value === "string" && PRESET_VALUES.includes(value as Preset);
}

function isScreenerFilter(value: unknown): value is ScreenerFilter {
    if (!value || typeof value !== "object") return false;
    const f = value as Partial<ScreenerFilter>;
    const validOperator = f.operator === "gt" || f.operator === "lt" || f.operator === "gte" || f.operator === "lte";
    return (
        typeof f.id === "string" &&
        typeof f.metric === "string" &&
        typeof f.label === "string" &&
        validOperator &&
        typeof f.value === "number" &&
        Number.isFinite(f.value)
    );
}

function readWatchlistFiltersState(): WatchlistFiltersState {
    if (typeof window === "undefined") return DEFAULT_WATCHLIST_FILTERS;
    try {
        const raw = localStorage.getItem(WATCHLIST_FILTERS_KEY);
        if (!raw) return DEFAULT_WATCHLIST_FILTERS;
        const parsed = JSON.parse(raw) as Partial<WatchlistFiltersState>;
        return {
            version: 1,
            search: typeof parsed.search === "string" ? parsed.search : "",
            preset: isPresetValue(parsed.preset) ? parsed.preset : "all",
            exchangeFilter: typeof parsed.exchangeFilter === "string" ? parsed.exchangeFilter : "all",
            filters: Array.isArray(parsed.filters) ? parsed.filters.filter(isScreenerFilter) : [],
            updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : undefined,
        };
    } catch {
        return DEFAULT_WATCHLIST_FILTERS;
    }
}

function hasActiveScope(scope: WatchlistFiltersState): boolean {
    return Boolean(
        scope.search.trim() ||
        scope.exchangeFilter !== "all" ||
        scope.preset !== "all" ||
        scope.filters.length > 0
    );
}

function applyPreset(rows: EnhancedTickerData[], preset: Preset): EnhancedTickerData[] {
    if (preset === "high-volume") return rows.filter((row) => (row.volume24h || 0) > 1e9);
    if (preset === "oi-spike") return rows.filter((row) => (row.openInterest || 0) > 5e8);
    if (preset === "big-movers") return rows.filter((row) => Math.abs(row.change1h || row.change24h || 0) > 2);
    if (preset === "high-funding") return rows.filter((row) => Math.abs((row.fundingRate || 0) * 100) > 0.01);
    return rows;
}

function filterMetricValue(row: EnhancedTickerData, metric: string): number {
    if (metric === "volume1h") return (row.volume1h ?? ((row.volume24h || 0) / 24)) || 0;
    if (metric === "volume24h") return row.volume24h || 0;
    if (metric === "openInterest") return row.openInterest || 0;
    if (metric === "fundingRate") return (row.fundingRate || 0) * 100;
    if (metric === "momentumScore") return row.momentumScore || 0;
    if (metric === "rvol") return row.rvol || 0;
    const raw = (row as Record<string, unknown>)[metric];
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
}

function applyAdvancedFilters(rows: EnhancedTickerData[], filters: ScreenerFilter[]): EnhancedTickerData[] {
    if (filters.length === 0) return rows;
    return rows.filter((row) =>
        filters.every((filter) => {
            const value = filterMetricValue(row, filter.metric);
            if (filter.operator === "gt") return value > filter.value;
            if (filter.operator === "gte") return value >= filter.value;
            if (filter.operator === "lt") return value < filter.value;
            if (filter.operator === "lte") return value <= filter.value;
            return true;
        })
    );
}

function applyWatchlistScope(rows: EnhancedTickerData[], scope: WatchlistFiltersState): EnhancedTickerData[] {
    let filtered = [...rows];
    const search = scope.search.trim().toLowerCase();
    if (search) {
        filtered = filtered.filter((row) => (row.symbol || "").toLowerCase().includes(search));
    }
    if (scope.exchangeFilter !== "all") {
        filtered = filtered.filter((row) => row.exchange === scope.exchangeFilter);
    }
    filtered = applyPreset(filtered, scope.preset);
    filtered = applyAdvancedFilters(filtered, scope.filters);
    return filtered;
}

function formatTimeAgo(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
}

function readConfidence(signal: AlphaSignalExport): number | null {
    const raw = signal.data?.confidencePercent;
    if (typeof raw === "number" && Number.isFinite(raw)) {
        return Math.max(1, Math.min(99, Math.round(raw)));
    }
    return null;
}

function strengthScore(signal: FeedSignal): number {
    const base = PRIORITY_WEIGHT[signal.priority] * 100;
    const confidence = signal.confidence ?? 0;
    return base + confidence;
}

function dedupeSignalKey(signal: FeedSignal, windowMs: number): string {
    const bucket = Math.floor(signal.timestamp / Math.max(windowMs, 1));
    return `${signal.symbol.toUpperCase()}-${signal.type}-${bucket}`;
}

function isBreakoutType(type: string): boolean {
    return Boolean(TYPE_META[type]?.isBreakout);
}

function MovementAlertRow({
    signal,
    index,
    compact,
    animateEnabled,
    glowEnabled,
}: {
    signal: FeedSignal;
    index: number;
    compact: boolean;
    animateEnabled: boolean;
    glowEnabled: boolean;
}) {
    const meta = TYPE_META[signal.type] ?? TYPE_META.IMMINENT_MOVEMENT;
    const tone = TONE_STYLES[meta.tone];
    const Icon = meta.icon;
    const isFresh = Date.now() - signal.timestamp <= NEW_ALERT_THRESHOLD_MS;

    return (
        <motion.article
            layout
            initial={animateEnabled ? { opacity: 0, y: 10, filter: "blur(5px)" } : false}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(2px)" }}
            transition={{
                duration: 0.3,
                delay: animateEnabled ? Math.min(index * 0.03, 0.15) : 0,
                ease: [0.22, 1, 0.36, 1],
            }}
            className={cn(
                "group relative overflow-hidden rounded-xl border bg-gradient-to-r from-zinc-950/95 via-zinc-900/75 to-zinc-950/95 p-3 transition-all",
                "hover:border-white/25",
                tone.border,
                compact && "p-2.5",
                signal.priority === "high" && "shadow-[0_0_0_1px_rgba(244,63,94,0.28)]",
                isFresh && glowEnabled && tone.glow
            )}
        >
            <div className={cn("absolute inset-y-0 left-0 w-[2px]", tone.accent)} />

            <div className="relative flex items-start gap-3">
                <div
                    className={cn(
                        "relative flex-shrink-0 rounded-xl border p-2",
                        tone.icon
                    )}
                >
                    <Icon className="h-3.5 w-3.5" />
                    {isFresh && glowEnabled && (
                        <motion.div
                            className={cn("absolute inset-0 rounded-xl blur-md", tone.chip)}
                            animate={{ opacity: [0.15, 0.4, 0.15] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                        />
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                        <div className={cn("font-black text-zinc-100", compact ? "text-xs" : "text-sm")}>
                            {signal.symbol}
                        </div>
                        <div className="inline-flex items-center gap-1 text-[10px] text-zinc-500">
                            <Clock className="h-2.5 w-2.5" />
                            {formatTimeAgo(signal.timestamp)}
                        </div>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span
                            className={cn(
                                "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider",
                                tone.chip
                            )}
                        >
                            {signal.title}
                        </span>
                        {signal.confidence != null && (
                            <span className="inline-flex items-center rounded-md border border-amber-300/30 bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-black text-amber-300">
                                {signal.confidence}% confidence
                            </span>
                        )}
                        <span
                            className={cn(
                                "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider",
                                signal.priority === "high"
                                    ? "border-rose-300/30 bg-rose-500/10 text-rose-300"
                                    : signal.priority === "medium"
                                        ? "border-zinc-300/20 bg-zinc-500/10 text-zinc-300"
                                        : "border-zinc-400/20 bg-zinc-500/5 text-zinc-400"
                            )}
                        >
                            {signal.priority}
                        </span>
                        <span className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-zinc-400">
                            {signal.source === "movement" ? "engine" : "watchlist"}
                        </span>
                        {isFresh && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300/30 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-black text-emerald-300">
                                <Sparkles className="h-2.5 w-2.5" />
                                New
                            </span>
                        )}
                    </div>

                    <p className={cn("mt-1.5 line-clamp-2 leading-relaxed text-zinc-400", compact ? "text-[10px]" : "text-[11px]")}>
                        {signal.description}
                    </p>
                </div>
            </div>
        </motion.article>
    );
}

export function MovementAlertsWidget({ compact = false }: { compact?: boolean } = {}) {
    const [settings, setSettings] = useState(getMovementAlertsSettings);
    const [favoriteSymbols, setFavoriteSymbols] = useState<string[]>([]);
    const [watchlistScope, setWatchlistScope] = useState<WatchlistFiltersState>(readWatchlistFiltersState);
    const [filterMode, setFilterMode] = useState<FeedFilter>("all");
    const [sortMode, setSortMode] = useState<SortMode>("latest");
    const { tickersList: screenerRows = [] } = useScreenerData({
        live: false,
        enableRestFallback: false,
        fetchMarkets: true,
    });

    useEffect(() => {
        const readFavorites = () => {
            try {
                const raw = localStorage.getItem(WATCHLIST_FAVORITES_KEY);
                if (!raw) {
                    setFavoriteSymbols([]);
                    return;
                }
                const parsed = JSON.parse(raw) as unknown;
                if (!Array.isArray(parsed)) {
                    setFavoriteSymbols([]);
                    return;
                }
                const symbols = Array.from(
                    new Set(
                        parsed
                            .filter((v): v is string => typeof v === "string")
                            .map((key) => normalizeSymbol(String(key).split("-")[0] || ""))
                            .filter((s) => s && isTrackableSymbol(s) && !STABLES.includes(s.toUpperCase()))
                    )
                );
                setFavoriteSymbols(symbols);
            } catch {
                setFavoriteSymbols([]);
            }
        };

        readFavorites();
        window.addEventListener("watchlist-favorites-changed", readFavorites);
        window.addEventListener("storage", readFavorites);
        return () => {
            window.removeEventListener("watchlist-favorites-changed", readFavorites);
            window.removeEventListener("storage", readFavorites);
        };
    }, []);

    useEffect(() => {
        const handler = () => setSettings(getMovementAlertsSettings());
        window.addEventListener("movement-alerts-settings-changed", handler);
        return () => window.removeEventListener("movement-alerts-settings-changed", handler);
    }, []);

    useEffect(() => {
        const updateScope = () => setWatchlistScope(readWatchlistFiltersState());
        updateScope();
        window.addEventListener(WATCHLIST_FILTERS_EVENT, updateScope);
        window.addEventListener("storage", updateScope);
        return () => {
            window.removeEventListener(WATCHLIST_FILTERS_EVENT, updateScope);
            window.removeEventListener("storage", updateScope);
        };
    }, []);

    const scopedSymbols = useMemo(() => {
        const scoped = applyWatchlistScope(screenerRows, watchlistScope);
        const deduped = new Set<string>();
        const sorted = scoped.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
        for (const row of sorted) {
            const symbol = normalizeSymbol(row.symbol || "");
            if (!symbol || !isTrackableSymbol(symbol) || STABLES.includes(symbol.toUpperCase())) continue;
            deduped.add(symbol);
            if (deduped.size >= MAX_SCOPED_SYMBOLS) break;
        }
        return Array.from(deduped);
    }, [screenerRows, watchlistScope]);

    const relevantSymbols = useMemo(() => {
        const scopeActive = hasActiveScope(watchlistScope);
        if (!scopeActive) {
            return favoriteSymbols;
        }
        const scopedSet = new Set(scopedSymbols.map((s) => s.toUpperCase()));
        const scopedFavorites = favoriteSymbols.filter((symbol) => scopedSet.has(symbol.toUpperCase()));
        if (scopedFavorites.length > 0) {
            return scopedFavorites;
        }
        if (scopedSymbols.length > 0) {
            return scopedSymbols;
        }
        return favoriteSymbols.slice(0, MAX_SCOPED_SYMBOLS);
    }, [favoriteSymbols, scopedSymbols, watchlistScope]);

    const scopeActive = hasActiveScope(watchlistScope);
    const { stats } = useRealtimeMarket(relevantSymbols);
    const movementSignals = useMovementAlerts(relevantSymbols, stats);
    const { signals: alertSignals } = useAlerts();

    const combinedSignals = useMemo((): FeedSignal[] => {
        const relevantSet = new Set(relevantSymbols.map((s) => s.toUpperCase()));
        const list: FeedSignal[] = [];

        movementSignals.forEach((signal) => {
            if (!relevantSet.has(signal.symbol.toUpperCase())) return;
            list.push({
                ...signal,
                source: "movement",
                confidence: readConfidence(signal),
            });
        });

        (alertSignals || [])
            .slice(0, 24)
            .forEach((signal) => {
                const symbol = normalizeSymbol(signal.symbol);
                if (!relevantSet.has(symbol.toUpperCase())) return;
                let type = ALERT_SIGNAL_TYPE_MAP[signal.type] || "IMMINENT_MOVEMENT";
                if (signal.type === "massive_buy" && signal.intensity > 80) type = "EXTREME_UP";
                if (signal.type === "massive_sell" && signal.intensity > 80) type = "EXTREME_DOWN";
                list.push({
                    id: `alert-${signal.id}`,
                    type,
                    symbol,
                    title: type.replace(/_/g, " "),
                    description: signal.message,
                    timestamp: signal.timestamp,
                    priority: signal.intensity >= 80 ? "high" : signal.intensity >= 40 ? "medium" : "low",
                    data: { confidencePercent: signal.intensity },
                    source: "watchlist",
                    confidence: Math.max(1, Math.min(99, Math.round(signal.intensity))),
                });
            });

        const cutoff = Date.now() - settings.maxAgeMinutes * 60 * 1000;
        const dedupeWindowMs = Math.max(1, settings.dedupeWindowMinutes) * 60 * 1000;
        const deduped = new Map<string, FeedSignal>();

        for (const signal of list) {
            if (signal.timestamp < cutoff) continue;
            const key = dedupeSignalKey(signal, dedupeWindowMs);
            const current = deduped.get(key);
            if (!current) {
                deduped.set(key, signal);
                continue;
            }
            const currentScore = strengthScore(current);
            const nextScore = strengthScore(signal);
            if (nextScore > currentScore || (nextScore === currentScore && signal.timestamp > current.timestamp)) {
                deduped.set(key, signal);
            }
        }

        const sorted = Array.from(deduped.values()).sort((a, b) => {
            if (sortMode === "strength") {
                const byStrength = strengthScore(b) - strengthScore(a);
                if (byStrength !== 0) return byStrength;
                return b.timestamp - a.timestamp;
            }
            const byTime = b.timestamp - a.timestamp;
            if (byTime !== 0) return byTime;
            return strengthScore(b) - strengthScore(a);
        });

        const cap = compact ? Math.min(settings.maxAlertsShown, 6) : settings.maxAlertsShown;
        return sorted.slice(0, cap);
    }, [
        relevantSymbols,
        movementSignals,
        alertSignals,
        settings.maxAgeMinutes,
        settings.dedupeWindowMinutes,
        settings.maxAlertsShown,
        compact,
        sortMode,
    ]);

    const filteredSignals = useMemo(() => {
        const freshCutoff = Date.now() - NEW_ALERT_THRESHOLD_MS;
        switch (filterMode) {
            case "high":
                return combinedSignals.filter((signal) => signal.priority === "high");
            case "fresh":
                return combinedSignals.filter((signal) => signal.timestamp >= freshCutoff);
            case "breakouts":
                return combinedSignals.filter((signal) => isBreakoutType(signal.type));
            default:
                return combinedSignals;
        }
    }, [combinedSignals, filterMode]);

    const now = Date.now();
    const highPriorityCount = combinedSignals.filter((signal) => signal.priority === "high").length;
    const freshCount = combinedSignals.filter((signal) => now - signal.timestamp <= NEW_ALERT_THRESHOLD_MS).length;
    const breakoutCount = combinedSignals.filter((signal) => isBreakoutType(signal.type)).length;
    const coveredSymbolsCount = new Set(combinedSignals.map((signal) => signal.symbol)).size;

    const filterOptions: Array<{ id: FeedFilter; label: string; count: number }> = [
        { id: "all", label: "All", count: combinedSignals.length },
        { id: "high", label: "High", count: highPriorityCount },
        { id: "fresh", label: "Fresh", count: freshCount },
        { id: "breakouts", label: "Breakouts", count: breakoutCount },
    ];

    return (
        <Card
            className={cn(
                "relative isolate flex w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-950/95 via-zinc-950/90 to-zinc-900/90",
                "hover:border-amber-300/30",
                compact ? "min-h-[320px]" : "min-h-[390px]"
            )}
        >
            <motion.div
                className="pointer-events-none absolute -left-16 -top-10 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl"
                animate={{ opacity: [0.18, 0.4, 0.18], x: [0, 12, 0], y: [0, 6, 0] }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
                className="pointer-events-none absolute right-[-3.5rem] top-[-2rem] h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl"
                animate={{ opacity: [0.12, 0.35, 0.12], x: [0, -10, 0], y: [0, 8, 0] }}
                transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
            />

            <ComponentSettingsLink tab="alerts" corner="top-right" title="Open Alert settings" size="xs" />

            <CardHeader
                className={cn(
                    "relative z-10 border-b border-white/10 bg-gradient-to-r from-amber-500/[0.08] via-cyan-500/[0.03] to-transparent",
                    compact ? "px-3.5 py-2.5" : "px-4 py-3.5"
                )}
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="relative rounded-xl border border-amber-300/25 bg-amber-500/10 p-2">
                            <Zap className="h-4 w-4 text-amber-300" />
                            <motion.div
                                className="absolute inset-0 rounded-xl bg-amber-300/15"
                                animate={{ opacity: [0.12, 0.35, 0.12] }}
                                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                            />
                        </div>
                        <div>
                            <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-200">
                                Live Movement Alerts
                            </CardTitle>
                            <p className={cn("mt-0.5 text-zinc-500", compact ? "text-[9px]" : "text-[10px]")}>
                                {scopeActive
                                    ? "Synced to Markets filter scope"
                                    : "CoinPush-style feed for tracked futures symbols"}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] font-black text-zinc-200">
                            {combinedSignals.length}/{settings.maxAlertsShown}
                        </span>
                        <span className="text-[9px] uppercase tracking-wider text-zinc-500">
                            {coveredSymbolsCount || relevantSymbols.length} symbols
                        </span>
                    </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                        {scopeActive && (
                            <span className="inline-flex items-center rounded-full border border-cyan-300/30 bg-cyan-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-cyan-200">
                                Markets scope
                            </span>
                        )}
                        {filterOptions.map((option) => (
                            <button
                                key={option.id}
                                type="button"
                                onClick={() => setFilterMode(option.id)}
                                className={cn(
                                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider transition-colors",
                                    filterMode === option.id
                                        ? "border-amber-300/30 bg-amber-500/15 text-amber-200"
                                        : "border-white/10 bg-white/[0.04] text-zinc-400 hover:text-zinc-200"
                                )}
                            >
                                {option.count} {option.label}
                            </button>
                        ))}
                    </div>

                    <div className="inline-flex rounded-full border border-white/10 bg-black/20 p-0.5">
                        <button
                            type="button"
                            onClick={() => setSortMode("latest")}
                            className={cn(
                                "rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider transition-colors",
                                sortMode === "latest" ? "bg-white/10 text-zinc-200" : "text-zinc-500"
                            )}
                        >
                            Latest
                        </button>
                        <button
                            type="button"
                            onClick={() => setSortMode("strength")}
                            className={cn(
                                "rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider transition-colors",
                                sortMode === "strength" ? "bg-white/10 text-zinc-200" : "text-zinc-500"
                            )}
                        >
                            Strongest
                        </button>
                    </div>
                </div>
            </CardHeader>

            <CardContent className={cn("relative z-10 flex min-h-0 flex-1 flex-col", compact ? "p-3" : "p-4")}>
                {!settings.enabled ? (
                    <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
                        <p className="text-[11px] font-semibold text-zinc-400">Movement alerts are disabled</p>
                        <p className="mt-1 text-[10px] text-zinc-600">Enable in Settings → Alerts</p>
                    </div>
                ) : relevantSymbols.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
                        <Clock className="mb-2 h-6 w-6 text-zinc-600" />
                        <p className="text-[11px] font-semibold text-zinc-400">No tracked symbols</p>
                        <p className="mt-1 text-[10px] text-zinc-600">
                            {scopeActive
                                ? "Current Markets filter returned no symbols"
                                : "Add favorites in Markets/Screener to activate this feed"}
                        </p>
                    </div>
                ) : filteredSignals.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
                        <Clock className="mb-2 h-6 w-6 text-zinc-600" />
                        <p className="text-[11px] font-semibold text-zinc-400">No signals for this filter</p>
                        <p className="mt-1 text-[10px] text-zinc-600">
                            Try another filter or reduce thresholds in Alert settings
                        </p>
                    </div>
                ) : (
                    <div className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto pr-1", compact ? "gap-1.5" : "gap-2")}>
                        <AnimatePresence mode="popLayout">
                            {filteredSignals.map((signal, index) => (
                                <MovementAlertRow
                                    key={signal.id}
                                    signal={signal}
                                    index={index}
                                    compact={compact}
                                    animateEnabled={settings.animateNewAlerts}
                                    glowEnabled={settings.glowNewAlerts}
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
