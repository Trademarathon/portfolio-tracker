"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
    endOfDay,
    endOfMonth,
    endOfWeek,
    format,
    startOfDay,
    startOfMonth,
    startOfWeek,
    subMonths,
    subWeeks,
} from "date-fns";
import {
    type DateRange,
    type JournalFilters,
    type JournalTrade,
    useJournal,
} from "@/contexts/JournalContext";
import { STRATEGY_TAGS, type StrategyTagId } from "@/lib/api/journal-types";
import {
    buildCumulativePnlAndDrawdownSeries,
    buildUtcDayOfWeekBuckets,
    buildUtcTwoHourBuckets,
} from "@/lib/journal/analytics-core";
import { cn } from "@/lib/utils";
import {
    Activity,
    BarChart3,
    CalendarDays,
    Clock3,
    RefreshCw,
} from "lucide-react";

type MetricMode = "count" | "pnl" | "winRate";
type DateGroupBy = "open" | "close";

type HoldFilterOption = {
    id: string;
    label: string;
    min: number | null;
    max: number | null;
};

type HoldBucket = {
    id: string;
    label: string;
    min: number;
    max: number;
};

type SessionBucketId = "new_york" | "london" | "tokyo" | "overlap" | "outside";

type MetricPoint = {
    id: string;
    label: string;
    count: number;
    wins: number;
    losses: number;
    pnl: number;
    winRate: number;
};

type SeriesStats = {
    points: number[];
    largestDrawdown: number;
    endingEquity: number;
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
};

const HOLD_FILTER_OPTIONS: HoldFilterOption[] = [
    { id: "all", label: "Any hold time", min: null, max: null },
    { id: "under_5m", label: "Under 5m", min: 0, max: 5 * 60 * 1000 },
    { id: "5m_30m", label: "5m - 30m", min: 5 * 60 * 1000, max: 30 * 60 * 1000 },
    { id: "30m_2h", label: "30m - 2h", min: 30 * 60 * 1000, max: 2 * 60 * 60 * 1000 },
    { id: "2h_1d", label: "2h - 1d", min: 2 * 60 * 60 * 1000, max: 24 * 60 * 60 * 1000 },
    { id: "1d_plus", label: "1d+", min: 24 * 60 * 60 * 1000, max: null },
];

const HOLD_ANALYTICS_BUCKETS: HoldBucket[] = [
    { id: "under_5m", label: "under 5m", min: 0, max: 5 * 60 * 1000 },
    { id: "5m_15m", label: "5m-15m", min: 5 * 60 * 1000, max: 15 * 60 * 1000 },
    { id: "15m_30m", label: "15m-30m", min: 15 * 60 * 1000, max: 30 * 60 * 1000 },
    { id: "30m_1h", label: "30m-1h", min: 30 * 60 * 1000, max: 60 * 60 * 1000 },
    { id: "1h_2h", label: "1h-2h", min: 60 * 60 * 1000, max: 2 * 60 * 60 * 1000 },
    { id: "2h_4h", label: "2h-4h", min: 2 * 60 * 60 * 1000, max: 4 * 60 * 60 * 1000 },
    { id: "4h_8h", label: "4h-8h", min: 4 * 60 * 60 * 1000, max: 8 * 60 * 60 * 1000 },
    { id: "8h_12h", label: "8h-12h", min: 8 * 60 * 60 * 1000, max: 12 * 60 * 60 * 1000 },
    { id: "12h_1d", label: "12h-1d", min: 12 * 60 * 60 * 1000, max: 24 * 60 * 60 * 1000 },
    { id: "1d_7d", label: "1d-7d", min: 24 * 60 * 60 * 1000, max: 7 * 24 * 60 * 60 * 1000 },
    { id: "7d_30d", label: "7d-30d", min: 7 * 24 * 60 * 60 * 1000, max: 30 * 24 * 60 * 60 * 1000 },
    { id: "30d_plus", label: "30d+", min: 30 * 24 * 60 * 60 * 1000, max: Number.POSITIVE_INFINITY },
];

const DAY_ORDER = [
    { id: "monday", label: "Monday", idx: 1 },
    { id: "tuesday", label: "Tuesday", idx: 2 },
    { id: "wednesday", label: "Wednesday", idx: 3 },
    { id: "thursday", label: "Thursday", idx: 4 },
    { id: "friday", label: "Friday", idx: 5 },
    { id: "saturday", label: "Saturday", idx: 6 },
    { id: "sunday", label: "Sunday", idx: 0 },
] as const;

const SESSION_LABELS: Record<SessionBucketId, string> = {
    new_york: "New York (US)",
    london: "London (EU)",
    tokyo: "Tokyo (AS)",
    overlap: "US and EU overlapping",
    outside: "Outside Sessions",
};

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

function getTradePnl(trade: JournalTrade): number {
    return Number(trade.realizedPnl ?? trade.pnl ?? 0);
}

function getTradeVolume(trade: JournalTrade): number {
    const explicit = Number(trade.cost ?? 0);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;

    const amount = Number(trade.amount ?? 0);
    const price = Number(trade.price ?? 0);
    const fallback = amount * price;
    return Number.isFinite(fallback) ? Math.abs(fallback) : 0;
}

function winRateFromCounts(wins: number, losses: number): number {
    const decisiveTrades = Math.max(0, wins) + Math.max(0, losses);
    return decisiveTrades > 0 ? (Math.max(0, wins) / decisiveTrades) * 100 : 0;
}

function getTradeHoldTimeMs(trade: JournalTrade): number {
    const explicit = Number(trade.holdTime ?? 0);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;

    const entryTime = Number(trade.entryTime ?? trade.timestamp ?? 0);
    const exitTime = Number(trade.exitTime ?? 0);
    if (entryTime > 0 && exitTime > entryTime) return exitTime - entryTime;

    return 0;
}

function getTradeMaeAbs(trade: JournalTrade): number | null {
    const value = Number(trade.mae);
    if (!Number.isFinite(value) || value === 0) return null;
    return Math.abs(value);
}

function getTradeMfeAbs(trade: JournalTrade): number | null {
    const value = Number(trade.mfe);
    if (!Number.isFinite(value) || value === 0) return null;
    return Math.abs(value);
}

function getTradeTimestamp(trade: JournalTrade, groupBy: DateGroupBy): number {
    if (groupBy === "close") {
        return Number(trade.exitTime ?? trade.timestamp ?? 0);
    }
    return Number(trade.entryTime ?? trade.timestamp ?? 0);
}

function getOrderType(trade: JournalTrade): "maker" | "market" | "unknown" {
    const info = trade.info && typeof trade.info === "object" ? trade.info : {};

    const raw = String(
        trade.takerOrMaker ??
            (info as Record<string, unknown>).takerOrMaker ??
            (info as Record<string, unknown>).maker ??
            (info as Record<string, unknown>).isMaker ??
            (info as Record<string, unknown>).liquidity ??
            (info as Record<string, unknown>).orderType ??
            ""
    ).toLowerCase();

    if (raw.includes("maker") || raw.includes("limit") || raw.includes("post")) return "maker";
    if (raw.includes("taker") || raw.includes("market")) return "market";

    return "unknown";
}

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

function formatDuration(ms: number): string {
    if (!Number.isFinite(ms) || ms <= 0) return "0h";

    const totalMinutes = Math.floor(ms / (1000 * 60));
    const totalHours = Math.floor(totalMinutes / 60);
    const days = Math.floor(totalHours / 24);

    if (days > 0) return `${days}d ${totalHours % 24}h`;
    if (totalHours > 0) return `${totalHours}h ${totalMinutes % 60}m`;
    return `${totalMinutes}m`;
}

function formatCurrency(value: number, hideBalances: boolean): string {
    if (hideBalances) return "••••";
    return `$${Math.abs(value).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function formatSignedCurrency(value: number, hideBalances: boolean): string {
    if (hideBalances) return "••••";
    const sign = value > 0 ? "+" : value < 0 ? "-" : "";
    return `${sign}$${Math.abs(value).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function formatMetricValue(mode: MetricMode, value: number, hideBalances: boolean): string {
    if (mode === "count") return `${value.toFixed(value >= 10 ? 0 : 1)}`;
    if (mode === "winRate") return `${value.toFixed(1)}%`;
    return formatSignedCurrency(value, hideBalances);
}

function buildSeriesStats(closedTrades: JournalTrade[]): {
    equity: SeriesStats;
    drawdown: SeriesStats;
} {
    const series = buildCumulativePnlAndDrawdownSeries(closedTrades, {
        getTimestamp: (trade) => Number(trade.timestamp),
        getPnlDelta: getTradePnl,
    });
    const equityPoints = series.pnlSeries.map((point) => point.value);
    const drawdownPoints = series.drawdownSeries.map((point) => point.value);

    return {
        equity: {
            points: equityPoints,
            largestDrawdown: series.maxDrawdown,
            endingEquity: series.totalPnl,
        },
        drawdown: {
            points: drawdownPoints,
            largestDrawdown: series.maxDrawdown,
            endingEquity: drawdownPoints.length > 0 ? drawdownPoints[drawdownPoints.length - 1] : 0,
        },
    };
}

function SeriesAreaChart({
    points,
    positive,
}: {
    points: number[];
    positive: boolean;
}) {
    if (points.length < 2) {
        return (
            <div className="h-full w-full flex items-center justify-center text-xs text-zinc-600">
                No closed-trade series yet
            </div>
        );
    }

    const width = 100;
    const height = 38;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = Math.max(1, max - min);

    const line = points
        .map((value, index) => {
            const x = (index / Math.max(1, points.length - 1)) * width;
            const y = height - ((value - min) / range) * height;
            return `${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(" ");

    const fill = `0,${height} ${line} ${width},${height}`;

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
            <polygon
                className={cn(
                    positive ? "fill-emerald-500/15" : "fill-rose-500/15"
                )}
                points={fill}
            />
            <polyline
                className={cn(
                    "fill-none stroke-[1.4]",
                    positive ? "stroke-emerald-400" : "stroke-rose-400"
                )}
                points={line}
            />
        </svg>
    );
}

function RatioDonut({
    left,
    right,
    leftLabel,
    rightLabel,
}: {
    left: number;
    right: number;
    leftLabel: string;
    rightLabel: string;
}) {
    const safeLeft = Number.isFinite(left) ? Math.max(0, left) : 0;
    const safeRight = Number.isFinite(right) ? Math.max(0, right) : 0;
    const total = Math.max(1, safeLeft + safeRight);
    const leftRatio = safeLeft / total;
    const rightRatio = safeRight / total;

    const radius = 32;
    const stroke = 5;
    const circumference = 2 * Math.PI * radius;
    const leftDash = leftRatio * circumference;
    const rightDash = rightRatio * circumference;

    return (
        <div className="flex items-center justify-between gap-3">
            <div className="relative w-[84px] h-[84px]">
                <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                    <circle cx="40" cy="40" r={radius} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
                    <circle
                        cx="40"
                        cy="40"
                        r={radius}
                        stroke="#49d3a2"
                        strokeWidth={stroke}
                        fill="none"
                        strokeDasharray={`${leftDash} ${circumference - leftDash}`}
                        strokeLinecap="round"
                    />
                    <circle
                        cx="40"
                        cy="40"
                        r={radius}
                        stroke="#f0627c"
                        strokeWidth={stroke}
                        fill="none"
                        strokeDasharray={`${rightDash} ${circumference - rightDash}`}
                        strokeDashoffset={-leftDash}
                        strokeLinecap="round"
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-zinc-300">
                    {(leftRatio * 100).toFixed(0)}% / {(rightRatio * 100).toFixed(0)}%
                </div>
            </div>

            <div className="space-y-2 text-[11px] text-zinc-500">
                <div className="flex items-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span>{leftLabel}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-400" />
                    <span>{rightLabel}</span>
                </div>
            </div>
        </div>
    );
}

function MetricModeToggle({
    mode,
    onModeChange,
}: {
    mode: MetricMode;
    onModeChange: (mode: MetricMode) => void;
}) {
    return (
        <div className="inline-flex rounded-lg border border-zinc-800 overflow-hidden">
            {(["count", "pnl", "winRate"] as MetricMode[]).map((item) => (
                <button
                    key={item}
                    type="button"
                    onClick={() => onModeChange(item)}
                    className={cn(
                        "px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors",
                        mode === item
                            ? "bg-zinc-700 text-white"
                            : "bg-zinc-900/30 text-zinc-500 hover:text-zinc-300"
                    )}
                >
                    {item === "winRate" ? "Win rate" : item}
                </button>
            ))}
        </div>
    );
}

function VerticalMetricBars({
    data,
    mode,
    hideBalances,
}: {
    data: MetricPoint[];
    mode: MetricMode;
    hideBalances: boolean;
}) {
    const values = data.map((item) => {
        if (mode === "count") return item.count;
        if (mode === "winRate") return item.winRate;
        return item.pnl;
    });

    const hasNegative = values.some((value) => value < 0);
    const maxPositive = Math.max(1, ...values.filter((value) => value > 0));
    const maxNegative = Math.max(1, ...values.filter((value) => value < 0).map((value) => Math.abs(value)));

    if (data.length === 0) {
        return (
            <div className="h-[250px] flex items-center justify-center text-sm text-zinc-600">
                Not enough trade data for this section
            </div>
        );
    }

    return (
        <div className="overflow-x-auto pb-1">
            <div className={cn("flex gap-2", data.length > 7 ? "min-w-[920px]" : "") }>
                {data.map((item) => {
                    const value = mode === "count" ? item.count : mode === "winRate" ? item.winRate : item.pnl;

                    const positiveHeight = hasNegative
                        ? `${(Math.max(0, value) / maxPositive) * 44}%`
                        : `${(Math.max(0, value) / maxPositive) * 90}%`;

                    const negativeHeight = hasNegative
                        ? `${(Math.abs(Math.min(0, value)) / maxNegative) * 44}%`
                        : "0%";

                    return (
                        <div key={item.id} className="flex-1 min-w-[64px]">
                            <div className="relative h-[180px] rounded-md">
                                <div
                                    className={cn(
                                        "absolute left-0 right-0 h-px bg-zinc-700/70",
                                        hasNegative ? "top-1/2" : "bottom-0"
                                    )}
                                />

                                {value > 0 && (
                                    <div
                                        title={formatMetricValue(mode, value, hideBalances)}
                                        className="absolute left-2 right-2 rounded-t-md bg-emerald-400/80"
                                        style={{
                                            height: positiveHeight,
                                            bottom: hasNegative ? "50%" : "0%",
                                        }}
                                    />
                                )}

                                {value < 0 && hasNegative && (
                                    <div
                                        title={formatMetricValue(mode, value, hideBalances)}
                                        className="absolute left-2 right-2 rounded-b-md bg-rose-400/80"
                                        style={{
                                            height: negativeHeight,
                                            top: "50%",
                                        }}
                                    />
                                )}
                            </div>

                            <p className="mt-2 text-[11px] text-zinc-500 text-center leading-tight">{item.label}</p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function AnalysisChartCard({
    title,
    data,
    mode,
    onModeChange,
    hideBalances,
    controls,
}: {
    title: string;
    data: MetricPoint[];
    mode: MetricMode;
    onModeChange: (mode: MetricMode) => void;
    hideBalances: boolean;
    controls?: React.ReactNode;
}) {
    return (
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/35 p-4">
            <div className="flex items-center justify-between mb-4 gap-3">
                <h3 className="text-xl font-bold text-white">{title}</h3>
                <div className="flex items-center gap-3">
                    {controls}
                    <MetricModeToggle mode={mode} onModeChange={onModeChange} />
                </div>
            </div>

            <VerticalMetricBars data={data} mode={mode} hideBalances={hideBalances} />
        </div>
    );
}

export default function AnalyticsPage() {
    const {
        trades,
        filteredTrades,
        annotations,
        filters,
        setFilters,
        dateRange,
        setDateRange,
        stats,
        preferences,
        isLoading,
    } = useJournal();

    const [holdMode, setHoldMode] = useState<MetricMode>("pnl");
    const [sessionMode, setSessionMode] = useState<MetricMode>("pnl");
    const [dayMode, setDayMode] = useState<MetricMode>("pnl");
    const [timeMode, setTimeMode] = useState<MetricMode>("pnl");
    const [sessionGroupBy, setSessionGroupBy] = useState<DateGroupBy>(dateRange.groupBy ?? "open");
    const [timeGroupBy, setTimeGroupBy] = useState<DateGroupBy>(dateRange.groupBy ?? "open");
    const [includeWeekends, setIncludeWeekends] = useState(true);

    const allSymbols = useMemo(
        () => Array.from(new Set(trades.map((trade) => String(trade.symbol || "")).filter(Boolean))).sort(),
        [trades]
    );

    const allExchanges = useMemo(
        () => Array.from(new Set(trades.map((trade) => String(trade.exchange || "")).filter(Boolean))).sort(),
        [trades]
    );

    const closedTrades = useMemo(
        () =>
            filteredTrades
                .filter((trade) => !trade.isOpen)
                .sort((a, b) => Number(a.timestamp) - Number(b.timestamp)),
        [filteredTrades]
    );

    const curve = useMemo(() => buildSeriesStats(closedTrades), [closedTrades]);

    const dateRangeText = useMemo(() => {
        if (closedTrades.length === 0) return "No closed-trade data";
        const start = format(closedTrades[0].timestamp, "MMM d, yyyy");
        const end = format(closedTrades[closedTrades.length - 1].timestamp, "MMM d, yyyy");
        return `${start} - ${end}`;
    }, [closedTrades]);

    const advancedMetrics = useMemo(() => {
        if (closedTrades.length === 0) {
            return {
                avgMae: 0,
                avgMfe: 0,
                maeSamples: 0,
                mfeSamples: 0,
                mfeMaeRatio: 0,
                sharpeRatio: 0,
                sortinoRatio: 0,
                expectedValue: 0,
                limitFees: 0,
                marketFees: 0,
                unknownFees: 0,
                totalFees: 0,
                makerVolume: 0,
                marketVolume: 0,
                unknownVolume: 0,
                fundingPaid: 0,
                fundingReceived: 0,
                netFunding: 0,
            };
        }

        const returns = closedTrades.map((trade) => getTradePnl(trade));
        const avgReturn = returns.reduce((sum, value) => sum + value, 0) / returns.length;
        const variance =
            returns.reduce((sum, value) => sum + Math.pow(value - avgReturn, 2), 0) /
            Math.max(1, returns.length);
        const stdDev = Math.sqrt(variance);

        const downside = returns.filter((value) => value < 0);
        const downsideVariance =
            downside.reduce((sum, value) => sum + Math.pow(value, 2), 0) / Math.max(1, downside.length);
        const downsideDeviation = Math.sqrt(downsideVariance);

        const maeValues = closedTrades
            .map((trade) => getTradeMaeAbs(trade))
            .filter((value): value is number => value !== null);
        const mfeValues = closedTrades
            .map((trade) => getTradeMfeAbs(trade))
            .filter((value): value is number => value !== null);
        const avgMae = maeValues.length > 0 ? maeValues.reduce((sum, value) => sum + value, 0) / maeValues.length : 0;
        const avgMfe = mfeValues.length > 0 ? mfeValues.reduce((sum, value) => sum + value, 0) / mfeValues.length : 0;

        const winRateRatio = stats.winningTrades / Math.max(1, stats.winningTrades + stats.losingTrades);
        const expectedValue = winRateRatio * stats.avgWin - (1 - winRateRatio) * stats.avgLoss;

        const feeBreakdown = closedTrades.reduce(
            (acc, trade) => {
                const feeValue = Math.abs(Number(trade.fees ?? trade.feeUsd ?? trade.fee ?? 0));
                const volume = getTradeVolume(trade);
                const orderType = getOrderType(trade);

                if (orderType === "maker") {
                    acc.limitFees += feeValue;
                    acc.makerVolume += volume;
                } else if (orderType === "market") {
                    acc.marketFees += feeValue;
                    acc.marketVolume += volume;
                } else {
                    acc.unknownFees += feeValue;
                    acc.unknownVolume += volume;
                }

                return acc;
            },
            {
                limitFees: 0,
                marketFees: 0,
                unknownFees: 0,
                makerVolume: 0,
                marketVolume: 0,
                unknownVolume: 0,
            }
        );

        const fundingPaid = Math.abs(
            closedTrades
                .map((trade) => Number(trade.funding ?? 0))
                .filter((value) => value < 0)
                .reduce((sum, value) => sum + value, 0)
        );

        const fundingReceived = closedTrades
            .map((trade) => Number(trade.funding ?? 0))
            .filter((value) => value > 0)
            .reduce((sum, value) => sum + value, 0);

        return {
            avgMae,
            avgMfe,
            maeSamples: maeValues.length,
            mfeSamples: mfeValues.length,
            mfeMaeRatio: avgMae > 0 ? avgMfe / avgMae : 0,
            sharpeRatio: stdDev > 0 ? avgReturn / stdDev : 0,
            sortinoRatio: downsideDeviation > 0 ? avgReturn / downsideDeviation : 0,
            expectedValue,
            limitFees: feeBreakdown.limitFees,
            marketFees: feeBreakdown.marketFees,
            unknownFees: feeBreakdown.unknownFees,
            totalFees: feeBreakdown.limitFees + feeBreakdown.marketFees + feeBreakdown.unknownFees,
            makerVolume: feeBreakdown.makerVolume,
            marketVolume: feeBreakdown.marketVolume,
            unknownVolume: feeBreakdown.unknownVolume,
            fundingPaid,
            fundingReceived,
            netFunding: fundingReceived - fundingPaid,
        };
    }, [closedTrades, stats.avgLoss, stats.avgWin, stats.losingTrades, stats.winningTrades]);

    const holdTimeData = useMemo(() => {
        const buckets = HOLD_ANALYTICS_BUCKETS.map((bucket) => ({
            ...bucket,
            count: 0,
            wins: 0,
            losses: 0,
            pnl: 0,
        }));

        const withHold = closedTrades.filter((trade) => getTradeHoldTimeMs(trade) > 0);

        withHold.forEach((trade) => {
            const hold = getTradeHoldTimeMs(trade);
            const pnl = getTradePnl(trade);
            const bucket = buckets.find((item) => hold >= item.min && hold < item.max);
            if (!bucket) return;
            bucket.count += 1;
            bucket.pnl += pnl;
            if (pnl > 0) bucket.wins += 1;
            if (pnl < 0) bucket.losses += 1;
        });

        const averageCount = withHold.length / Math.max(1, buckets.length);
        const averagePnl = withHold.reduce((sum, trade) => sum + getTradePnl(trade), 0) / Math.max(1, withHold.length);
        const averageWins = withHold.filter((trade) => getTradePnl(trade) > 0).length;
        const averageLosses = withHold.filter((trade) => getTradePnl(trade) < 0).length;

        const points: MetricPoint[] = [
            {
                id: "average",
                label: "Average",
                count: averageCount,
                wins: averageWins,
                losses: averageLosses,
                pnl: averagePnl,
                winRate: winRateFromCounts(averageWins, averageLosses),
            },
            ...buckets.map((bucket) => ({
                id: bucket.id,
                label: bucket.label,
                count: bucket.count,
                wins: bucket.wins,
                losses: bucket.losses,
                pnl: bucket.pnl,
                winRate: winRateFromCounts(bucket.wins, bucket.losses),
            })),
        ];

        return points;
    }, [closedTrades]);

    const sessionData = useMemo(() => {
        const acc: Record<SessionBucketId, { count: number; wins: number; losses: number; pnl: number }> = {
            new_york: { count: 0, wins: 0, losses: 0, pnl: 0 },
            london: { count: 0, wins: 0, losses: 0, pnl: 0 },
            tokyo: { count: 0, wins: 0, losses: 0, pnl: 0 },
            overlap: { count: 0, wins: 0, losses: 0, pnl: 0 },
            outside: { count: 0, wins: 0, losses: 0, pnl: 0 },
        };

        const scopedTrades = closedTrades.filter((trade) => {
            if (includeWeekends) return true;
            const ts = getTradeTimestamp(trade, sessionGroupBy);
            const day = new Date(ts).getUTCDay();
            return day !== 0 && day !== 6;
        });

        scopedTrades.forEach((trade) => {
            const ts = getTradeTimestamp(trade, sessionGroupBy);
            const hour = new Date(ts).getUTCHours();
            const pnl = getTradePnl(trade);

            let bucket: SessionBucketId = "outside";
            if (hour >= 13 && hour < 16) bucket = "overlap";
            else if (hour >= 13 && hour < 21) bucket = "new_york";
            else if (hour >= 8 && hour < 13) bucket = "london";
            else if (hour >= 0 && hour < 8) bucket = "tokyo";

            acc[bucket].count += 1;
            acc[bucket].pnl += pnl;
            if (pnl > 0) acc[bucket].wins += 1;
            if (pnl < 0) acc[bucket].losses += 1;
        });

        const labels: SessionBucketId[] = ["new_york", "london", "tokyo", "overlap", "outside"];
        const totalCount = labels.reduce((sum, key) => sum + acc[key].count, 0);
        const totalPnl = labels.reduce((sum, key) => sum + acc[key].pnl, 0);
        const totalWins = labels.reduce((sum, key) => sum + acc[key].wins, 0);
        const totalLosses = labels.reduce((sum, key) => sum + acc[key].losses, 0);

        const average: MetricPoint = {
            id: "average",
            label: "Average",
            count: totalCount / Math.max(1, labels.length),
            wins: totalWins,
            losses: totalLosses,
            pnl: totalPnl / Math.max(1, totalCount),
            winRate: winRateFromCounts(totalWins, totalLosses),
        };

        return [
            average,
            ...labels.map((id) => ({
                id,
                label: SESSION_LABELS[id],
                count: acc[id].count,
                wins: acc[id].wins,
                losses: acc[id].losses,
                pnl: acc[id].pnl,
                winRate: winRateFromCounts(acc[id].wins, acc[id].losses),
            })),
        ];
    }, [closedTrades, includeWeekends, sessionGroupBy]);

    const dayOfWeekData = useMemo(() => {
        const rawBuckets = buildUtcDayOfWeekBuckets(closedTrades, {
            getTimestamp: (trade) => getTradeTimestamp(trade, "open"),
            getPnl: getTradePnl,
            dayLabels: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        });
        const byDayIndex = new Map(rawBuckets.map((bucket) => [bucket.dayIndex, bucket]));

        const rows = DAY_ORDER.map((day) => {
            const bucket = byDayIndex.get(day.idx);
            const count = bucket?.count || 0;
            const wins = bucket?.wins || 0;
            const losses = bucket?.losses || 0;
            const pnl = bucket?.pnl || 0;
            return {
                id: day.id,
                label: day.label,
                count,
                wins,
                losses,
                pnl,
                winRate: winRateFromCounts(wins, losses),
            };
        });

        const totalCount = rows.reduce((sum, item) => sum + item.count, 0);
        const totalPnl = rows.reduce((sum, item) => sum + item.pnl, 0);
        const totalWins = rows.reduce((sum, item) => sum + item.wins, 0);
        const totalLosses = rows.reduce((sum, item) => sum + item.losses, 0);

        const average: MetricPoint = {
            id: "average",
            label: "Average",
            count: totalCount / Math.max(1, rows.length),
            wins: totalWins,
            losses: totalLosses,
            pnl: totalPnl / Math.max(1, totalCount),
            winRate: winRateFromCounts(totalWins, totalLosses),
        };

        return [
            average,
            ...rows,
        ];
    }, [closedTrades]);

    const timeOfDayData = useMemo(() => {
        const bins = buildUtcTwoHourBuckets(closedTrades, {
            getTimestamp: (trade) => getTradeTimestamp(trade, timeGroupBy),
            getPnl: getTradePnl,
        }).map((bucket, index) => ({
            id: `bin_${index}`,
            label: `${String(bucket.hour).padStart(2, "0")}-${String((bucket.hour + 2) % 24).padStart(2, "0")}`,
            count: bucket.count,
            wins: bucket.wins,
            losses: bucket.losses,
            pnl: bucket.pnl,
            winRate: winRateFromCounts(bucket.wins, bucket.losses),
        }));

        const totalCount = bins.reduce((sum, item) => sum + item.count, 0);
        const totalPnl = bins.reduce((sum, item) => sum + item.pnl, 0);
        const totalWins = bins.reduce((sum, item) => sum + item.wins, 0);
        const totalLosses = bins.reduce((sum, item) => sum + item.losses, 0);

        const average: MetricPoint = {
            id: "average",
            label: "Average",
            count: totalCount / Math.max(1, bins.length),
            wins: totalWins,
            losses: totalLosses,
            pnl: totalPnl / Math.max(1, totalCount),
            winRate: winRateFromCounts(totalWins, totalLosses),
        };

        return [
            average,
            ...bins,
        ];
    }, [closedTrades, timeGroupBy]);

    const activeHoldFilter = useMemo(() => {
        const match = HOLD_FILTER_OPTIONS.find(
            (item) => item.min === filters.minHoldTime && item.max === filters.maxHoldTime
        );
        return match?.id ?? "all";
    }, [filters.maxHoldTime, filters.minHoldTime]);

    const updateFilters = (patch: Partial<JournalFilters>) => {
        setFilters({ ...filters, ...patch });
    };

    const handleResetFilters = () => {
        setFilters(DEFAULT_FILTERS);
        setDateRange({ start: null, end: null, preset: "all", mode: "range", groupBy: dateRange.groupBy });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-4">
                <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2 text-zinc-300">
                        <BarChart3 className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm font-semibold uppercase tracking-wider">Analytics Filters</span>
                    </div>

                    <button
                        type="button"
                        onClick={handleResetFilters}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-700 text-xs font-semibold text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Reset filters
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8 gap-2.5">
                    <label className="space-y-1">
                        <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Status</span>
                        <select
                            value={filters.status}
                            onChange={(event) => updateFilters({ status: event.target.value as JournalFilters["status"] })}
                            className="w-full h-9 rounded-lg bg-zinc-900/50 border border-zinc-800 text-sm text-zinc-300 px-2.5"
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
                                const value = event.target.value;
                                updateFilters({ symbols: value === "all" ? [] : [value] });
                            }}
                            className="w-full h-9 rounded-lg bg-zinc-900/50 border border-zinc-800 text-sm text-zinc-300 px-2.5"
                        >
                            <option value="all">All symbols</option>
                            {allSymbols.map((symbol) => (
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
                            className="w-full h-9 rounded-lg bg-zinc-900/50 border border-zinc-800 text-sm text-zinc-300 px-2.5"
                        >
                            {DATE_PRESETS.map((preset) => (
                                <option key={preset.id} value={preset.id}>
                                    {preset.label}
                                </option>
                            ))}
                            {dateRange.preset === "custom" && <option value="custom">Custom range</option>}
                        </select>
                    </label>

                    <label className="space-y-1">
                        <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Side</span>
                        <select
                            value={filters.side}
                            onChange={(event) => updateFilters({ side: event.target.value as JournalFilters["side"] })}
                            className="w-full h-9 rounded-lg bg-zinc-900/50 border border-zinc-800 text-sm text-zinc-300 px-2.5"
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
                            className="w-full h-9 rounded-lg bg-zinc-900/50 border border-zinc-800 text-sm text-zinc-300 px-2.5"
                        >
                            <option value="all">All exchanges</option>
                            {allExchanges.map((exchange) => (
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
                                updateFilters({ tags: value === "all" ? [] : [value] });
                            }}
                            className="w-full h-9 rounded-lg bg-zinc-900/50 border border-zinc-800 text-sm text-zinc-300 px-2.5"
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
                                const next = HOLD_FILTER_OPTIONS.find((option) => option.id === event.target.value);
                                if (!next) return;
                                updateFilters({ minHoldTime: next.min, maxHoldTime: next.max });
                            }}
                            className="w-full h-9 rounded-lg bg-zinc-900/50 border border-zinc-800 text-sm text-zinc-300 px-2.5"
                        >
                            {HOLD_FILTER_OPTIONS.map((option) => (
                                <option key={option.id} value={option.id}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="space-y-1">
                        <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Tagged trades</span>
                        <div className="h-9 px-2.5 rounded-lg border border-zinc-800 bg-zinc-900/50 text-sm text-zinc-300 flex items-center justify-between">
                            <span>{Object.keys(annotations).length}</span>
                            <span className="text-[10px] text-zinc-500">annotations</span>
                        </div>
                    </label>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/35 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xl font-bold text-white">Lifetime PNL</h3>
                        <span className="text-xs text-zinc-500">{dateRangeText}</span>
                    </div>

                    <div className="h-[210px]">
                        <SeriesAreaChart points={curve.equity.points} positive={curve.equity.endingEquity >= 0} />
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                        <span className={cn("text-xl font-black", stats.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400") }>
                            {formatSignedCurrency(stats.totalPnl, preferences.hideBalances)}
                        </span>
                        <span className="text-xs text-zinc-500">{closedTrades.length} closed trades</span>
                    </div>
                </div>

                <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/35 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xl font-bold text-white">Drawdown($)</h3>
                        <span className="text-xs text-zinc-500">{dateRangeText}</span>
                    </div>

                    <div className="h-[210px]">
                        <SeriesAreaChart points={curve.drawdown.points} positive={false} />
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                        <span className="text-xl font-black text-rose-400">
                            {formatSignedCurrency(curve.equity.largestDrawdown, preferences.hideBalances)}
                        </span>
                        <span className="text-xs text-zinc-500">Largest drawdown</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/35 p-4">
                    <h3 className="text-xl font-bold text-white mb-3">Metrics</h3>

                    <div className="space-y-1 text-sm">
                        {[
                            { label: "Total PnL ($)", value: formatSignedCurrency(stats.totalPnl, preferences.hideBalances), positive: stats.totalPnl >= 0 },
                            { label: "Win Rate", value: `${stats.winRate.toFixed(2)}%` },
                            { label: "Average Win", value: formatCurrency(stats.avgWin, preferences.hideBalances), positive: true },
                            { label: "Average Loss", value: formatSignedCurrency(-stats.avgLoss, preferences.hideBalances), positive: false },
                            {
                                label: "Average MAE",
                                value: advancedMetrics.maeSamples > 0
                                    ? formatCurrency(advancedMetrics.avgMae, preferences.hideBalances)
                                    : "N/A",
                                positive: false
                            },
                            {
                                label: "Average MFE",
                                value: advancedMetrics.mfeSamples > 0
                                    ? formatCurrency(advancedMetrics.avgMfe, preferences.hideBalances)
                                    : "N/A",
                                positive: true
                            },
                            {
                                label: "MFE/MAE Ratio",
                                value: advancedMetrics.maeSamples > 0 && advancedMetrics.mfeSamples > 0
                                    ? advancedMetrics.mfeMaeRatio.toFixed(2)
                                    : "N/A"
                            },
                            { label: "Volume Traded", value: formatCurrency(stats.totalVolume, preferences.hideBalances) },
                            { label: "Average Trade Size", value: formatCurrency(stats.totalVolume / Math.max(1, stats.totalTrades), preferences.hideBalances) },
                            { label: "Average Hold Time", value: formatDuration(stats.avgHoldTime) },
                            { label: "Sharpe Ratio", value: advancedMetrics.sharpeRatio.toFixed(2) },
                            { label: "Sortino Ratio", value: advancedMetrics.sortinoRatio.toFixed(2) },
                            { label: "Profit Factor", value: stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2) },
                            { label: "Expected Value", value: formatSignedCurrency(advancedMetrics.expectedValue, preferences.hideBalances), positive: advancedMetrics.expectedValue >= 0 },
                        ].map((row) => (
                            <div
                                key={row.label}
                                className="grid grid-cols-[1fr_auto] gap-3 px-3 py-1.5 rounded bg-white/[0.03] border border-white/[0.03]"
                            >
                                <span className="text-zinc-400">{row.label}</span>
                                <span className={cn(
                                    "font-semibold",
                                    row.positive === true && "text-emerald-400",
                                    row.positive === false && "text-rose-400",
                                    row.positive === undefined && "text-zinc-200"
                                )}>
                                    {row.value}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/35 p-4">
                    <h3 className="text-xl font-bold text-white mb-3">Order types and Funding</h3>

                    <div className="space-y-1 text-sm mb-4">
                        {[
                            {
                                label: "Fees (limit)",
                                value: formatSignedCurrency(-advancedMetrics.limitFees, preferences.hideBalances),
                                tone: "text-rose-400",
                                rightLabel: "Funding Paid",
                                rightValue: formatSignedCurrency(-advancedMetrics.fundingPaid, preferences.hideBalances),
                                rightTone: "text-rose-400",
                            },
                            {
                                label: "Fees (market)",
                                value: formatSignedCurrency(-advancedMetrics.marketFees, preferences.hideBalances),
                                tone: "text-rose-400",
                                rightLabel: "Funding Received",
                                rightValue: formatSignedCurrency(advancedMetrics.fundingReceived, preferences.hideBalances),
                                rightTone: "text-emerald-400",
                            },
                            {
                                label: "Total Fees",
                                value: formatSignedCurrency(-advancedMetrics.totalFees, preferences.hideBalances),
                                tone: "text-rose-400",
                                rightLabel: "Net Funding",
                                rightValue: formatSignedCurrency(advancedMetrics.netFunding, preferences.hideBalances),
                                rightTone: advancedMetrics.netFunding >= 0 ? "text-emerald-400" : "text-rose-400",
                            },
                        ].map((row) => (
                            <div key={row.label} className="grid grid-cols-2 gap-2">
                                <div className="grid grid-cols-[1fr_auto] gap-2 px-3 py-1.5 rounded bg-white/[0.03] border border-white/[0.03]">
                                    <span className="text-zinc-400">{row.label}</span>
                                    <span className={cn("font-semibold", row.tone)}>{row.value}</span>
                                </div>
                                <div className="grid grid-cols-[1fr_auto] gap-2 px-3 py-1.5 rounded bg-white/[0.03] border border-white/[0.03]">
                                    <span className="text-zinc-400">{row.rightLabel}</span>
                                    <span className={cn("font-semibold", row.rightTone)}>{row.rightValue}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                        <div className="rounded-xl border border-zinc-800/70 p-3 bg-zinc-950/30">
                            <p className="text-sm font-semibold text-zinc-200 mb-1">Limit vs Market orders by volume</p>
                            <p className="text-xs text-zinc-500 mb-3">
                                Maker {advancedMetrics.makerVolume.toFixed(0)} / Market {advancedMetrics.marketVolume.toFixed(0)}
                            </p>
                            <RatioDonut
                                left={advancedMetrics.makerVolume}
                                right={advancedMetrics.marketVolume + advancedMetrics.unknownVolume}
                                leftLabel="Maker volume"
                                rightLabel="Market + unknown"
                            />
                        </div>

                        <div className="rounded-xl border border-zinc-800/70 p-3 bg-zinc-950/30">
                            <p className="text-sm font-semibold text-zinc-200 mb-1">Funding paid vs received</p>
                            <p className="text-xs text-zinc-500 mb-3">
                                Paid {advancedMetrics.fundingPaid.toFixed(2)} / Received {advancedMetrics.fundingReceived.toFixed(2)}
                            </p>
                            <RatioDonut
                                left={advancedMetrics.fundingReceived}
                                right={advancedMetrics.fundingPaid}
                                leftLabel="Funding received"
                                rightLabel="Funding paid"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <AnalysisChartCard
                    title="PnL by Holdtime"
                    data={holdTimeData}
                    mode={holdMode}
                    onModeChange={setHoldMode}
                    hideBalances={preferences.hideBalances}
                    controls={
                        <div className="inline-flex items-center gap-2 text-xs text-zinc-500">
                            <Clock3 className="w-3.5 h-3.5" />
                            <span>Type:</span>
                            <span className="text-zinc-200 font-semibold">Regular</span>
                        </div>
                    }
                />

                <AnalysisChartCard
                    title="Trading session analysis"
                    data={sessionData}
                    mode={sessionMode}
                    onModeChange={setSessionMode}
                    hideBalances={preferences.hideBalances}
                    controls={
                        <div className="flex items-center gap-3">
                            <label className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                                <input
                                    type="checkbox"
                                    checked={includeWeekends}
                                    onChange={(event) => setIncludeWeekends(event.target.checked)}
                                    className="w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-800 text-emerald-500"
                                />
                                Include weekends
                            </label>
                            <div className="inline-flex rounded-lg border border-zinc-800 overflow-hidden">
                                {(["open", "close"] as DateGroupBy[]).map((value) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setSessionGroupBy(value)}
                                        className={cn(
                                            "px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
                                            sessionGroupBy === value
                                                ? "bg-zinc-700 text-white"
                                                : "bg-zinc-900/30 text-zinc-500 hover:text-zinc-300"
                                        )}
                                    >
                                        Trade {value}
                                    </button>
                                ))}
                            </div>
                        </div>
                    }
                />

                <AnalysisChartCard
                    title="Day of Week"
                    data={dayOfWeekData}
                    mode={dayMode}
                    onModeChange={setDayMode}
                    hideBalances={preferences.hideBalances}
                    controls={
                        <div className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                            <CalendarDays className="w-3.5 h-3.5" />
                            UTC
                        </div>
                    }
                />

                <AnalysisChartCard
                    title="Time of Day (UTC+0)"
                    data={timeOfDayData}
                    mode={timeMode}
                    onModeChange={setTimeMode}
                    hideBalances={preferences.hideBalances}
                    controls={
                        <div className="inline-flex rounded-lg border border-zinc-800 overflow-hidden">
                            {(["open", "close"] as DateGroupBy[]).map((value) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setTimeGroupBy(value)}
                                    className={cn(
                                        "px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
                                        timeGroupBy === value
                                            ? "bg-zinc-700 text-white"
                                            : "bg-zinc-900/30 text-zinc-500 hover:text-zinc-300"
                                    )}
                                >
                                    Trade {value}
                                </button>
                            ))}
                        </div>
                    }
                />
            </div>

            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/35 px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                        <p className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-emerald-400" />
                            Analytics Summary
                        </p>
                        <p className="text-xs text-zinc-500">
                            {closedTrades.length} closed trades analyzed, {stats.winningTrades} wins, {stats.losingTrades} losses, {stats.breakevenTrades} breakeven.
                        </p>
                    </div>
                    <div className="text-right">
                        <p className={cn("text-lg font-black", stats.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                            {formatSignedCurrency(stats.totalPnl, preferences.hideBalances)}
                        </p>
                        <p className="text-xs text-zinc-500">Net from filtered view</p>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
