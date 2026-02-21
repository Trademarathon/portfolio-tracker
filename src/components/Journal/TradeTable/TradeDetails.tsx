"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { JournalTrade, useJournal } from "@/contexts/JournalContext";
import {
    STRATEGY_TAGS,
    EXECUTION_QUALITY,
    type ExecutionQuality,
    type StrategyTagId,
    type TradeAnnotation,
} from "@/lib/api/journal-types";
import { StrategyTagSelector } from "@/components/Journal/StrategyTagSelector";
import Link from "next/link";
import {
    Target,
    Shield,
    MessageSquare,
    Image as ImageIcon,
    Tag,
    ChevronRight,
    Upload,
    X,
    BarChart3,
    Save,
    Plus,
} from "lucide-react";
import { useVoiceRecognition } from "@/hooks/useVoiceRecognition";
import { VoiceInputButton } from "@/components/ui/VoiceInputButton";
import { ScreenerLightweightChart } from "@/components/Screener/ScreenerLightweightChart";
import { normalizeSymbol } from "@/lib/utils/normalization";
import { getHyperliquidSpotMeta, resolveHyperliquidSymbol } from "@/lib/api/hyperliquid";
import { format as formatDate } from "date-fns";

interface TradeDetailsProps {
    trade: JournalTrade;
}

interface TargetRow {
    price: number;
    sizePercent: number;
    triggered: boolean;
}

interface StopRow {
    price: number;
    sizePercent: number;
    triggered: boolean;
}

type ChartInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
type ChartCandle = {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
};

function toFiniteNumber(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function toUnixSeconds(value: unknown): number | null {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    if (n > 1e17) return Math.floor(n / 1_000_000_000);
    if (n > 1e14) return Math.floor(n / 1_000_000);
    if (n > 1e12) return Math.floor(n / 1_000);
    return Math.floor(n);
}

function parseLevelRows(raw: unknown): Array<{ price: number; sizePercent: number; triggered: boolean }> {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((row) => {
            const rec = (row && typeof row === "object") ? row as Record<string, unknown> : null;
            if (!rec) return null;
            const price = toFiniteNumber(rec.price, NaN);
            if (!Number.isFinite(price) || price <= 0) return null;
            const sizePercent = toFiniteNumber(rec.sizePercent, 100);
            const triggered = Boolean(rec.triggered);
            return {
                price,
                sizePercent: Math.max(0, Math.min(100, sizePercent)),
                triggered,
            };
        })
        .filter((row): row is { price: number; sizePercent: number; triggered: boolean } => row !== null);
}

function normalizeLevelRowsForSave(
    rows: Array<{ price: number; sizePercent: number; triggered: boolean }>
): Array<{ price: number; sizePercent: number; triggered: boolean }> {
    return rows
        .map((row) => ({
            price: toFiniteNumber(row.price, 0),
            sizePercent: Math.max(0, Math.min(100, toFiniteNumber(row.sizePercent, 100))),
            triggered: Boolean(row.triggered),
        }))
        .filter((row) => row.price > 0);
}

function normalizeExecutionQuality(value: unknown, fallback: ExecutionQuality = 3): ExecutionQuality {
    const n = Number(value);
    if (n === 1 || n === 2 || n === 3 || n === 4 || n === 5) return n;
    return fallback;
}

function normalizeMistakeTags(input: string[]): string[] {
    const unique = new Set<string>();
    input.forEach((tag) => {
        const normalized = String(tag || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_");
        if (normalized) unique.add(normalized);
    });
    return Array.from(unique).slice(0, 16);
}

function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
        reader.readAsDataURL(file);
    });
}

function isIndexAliasSymbol(value: unknown): boolean {
    const s = String(value || "").trim();
    return /^@?\d+$/.test(s);
}

function pickChartBaseSymbol(trade: JournalTrade, resolvedOverride?: string): string {
    const enriched = trade as unknown as {
        rawSymbol?: string;
        asset?: string;
        info?: Record<string, unknown>;
    };
    const info = (enriched.info && typeof enriched.info === "object") ? enriched.info : {};
    const candidates = [
        resolvedOverride || "",
        trade.symbol || "",
        enriched.rawSymbol || "",
        enriched.asset || "",
        typeof info.symbol === "string" ? info.symbol : "",
        typeof info.s === "string" ? info.s : "",
        typeof info.coin === "string" ? info.coin : "",
    ];

    for (const candidate of candidates) {
        const normalized = normalizeSymbol(candidate);
        if (!normalized) continue;
        if (isIndexAliasSymbol(candidate) || isIndexAliasSymbol(normalized)) continue;
        return normalized;
    }
    return "";
}

function normalizeChartSymbol(trade: JournalTrade, resolvedOverride?: string): string {
    const rawSymbol = pickChartBaseSymbol(trade, resolvedOverride);
    if (!rawSymbol || isIndexAliasSymbol(rawSymbol)) return "";

    const exchangeRaw = String(trade.exchange || "").toUpperCase();
    const exchange = exchangeRaw.includes("BYBIT")
        ? "BYBIT"
        : exchangeRaw.includes("HYPER")
            ? "HYPERLIQUID"
            : "BINANCE";

    const pair = /(USDT|USD|USDC|PERP)$/i.test(rawSymbol) ? rawSymbol : `${rawSymbol}USDT`;
    const tvPair = exchange === "HYPERLIQUID" ? pair.replace(/USDT$/i, "PERP") : pair.replace(/PERP$/i, "USDT");
    return `${exchange}:${tvPair}`;
}

export function TradeDetails({ trade }: TradeDetailsProps) {
    const { preferences, annotations, playbooks, addAnnotation, updateAnnotation } = useJournal();
    const annotation = annotations[trade.id];

    const [notes, setNotes] = useState(annotation?.notes || "");
    const [notesDirty, setNotesDirty] = useState(false);
    const [screenshots, setScreenshots] = useState<string[]>(annotation?.screenshots || []);
    const [screenshotUrlInput, setScreenshotUrlInput] = useState("");

    const [showOHLCV, setShowOHLCV] = useState(true);
    const [showEntries, setShowEntries] = useState(true);
    const [showExits, setShowExits] = useState(true);
    const [showLines, setShowLines] = useState(true);
    const [showAvgLines, setShowAvgLines] = useState(true);
    const [chartInterval, setChartInterval] = useState<ChartInterval>("1m");
    const [isDragOver, setIsDragOver] = useState(false);
    const [chartLoadError, setChartLoadError] = useState<string | null>(null);
    const [chartCandles, setChartCandles] = useState<ChartCandle[]>([]);
    const [targets, setTargets] = useState<TargetRow[]>([]);
    const [stops, setStops] = useState<StopRow[]>([]);
    const [mistakeTags, setMistakeTags] = useState<string[]>([]);
    const [mistakeTagInput, setMistakeTagInput] = useState("");
    const [resolvedHyperliquidSymbol, setResolvedHyperliquidSymbol] = useState<string | null>(null);
    const tradeRawSymbol = useMemo(
        () => String((trade as unknown as { rawSymbol?: string }).rawSymbol || trade.symbol || "").trim(),
        [trade]
    );

    const { isListening, isTranscribing, error: voiceError, isSupported: voiceSupported, toggleListening } = useVoiceRecognition({
        onTranscript: (text) => {
            setNotes(text);
            setNotesDirty(true);
        },
    });

    useEffect(() => {
        setNotes(annotation?.notes || "");
        setNotesDirty(false);
        setScreenshots(Array.isArray(annotation?.screenshots) ? annotation.screenshots : []);
        setScreenshotUrlInput("");
    }, [annotation?.notes, annotation?.screenshots, trade.id]);

    useEffect(() => {
        setChartLoadError(null);
        setChartInterval("1m");
        setResolvedHyperliquidSymbol(null);
        setChartCandles([]);
    }, [trade.id]);

    useEffect(() => {
        const exchange = String(trade.exchange || "").toLowerCase();
        if (!exchange.includes("hyperliquid")) return;

        const rawCandidate = tradeRawSymbol;
        if (!isIndexAliasSymbol(rawCandidate)) return;

        let cancelled = false;
        (async () => {
            const spotMeta = await getHyperliquidSpotMeta();
            if (cancelled || !spotMeta) return;
            const resolved = resolveHyperliquidSymbol(rawCandidate, spotMeta);
            if (!resolved || isIndexAliasSymbol(resolved)) return;
            setResolvedHyperliquidSymbol(resolved);
        })();

        return () => {
            cancelled = true;
        };
    }, [trade.id, trade.exchange, tradeRawSymbol]);

    const saveAnnotationPatch = useCallback((patch: Partial<TradeAnnotation>) => {
        const now = Date.now();
        if (annotation) {
            updateAnnotation(trade.id, {
                ...patch,
                updatedAt: now,
            });
            return;
        }

        addAnnotation({
            id: trade.id,
            tradeId: trade.id,
            strategyTag: (patch.strategyTag as StrategyTagId) || ("custom" as StrategyTagId),
            playbookId: typeof patch.playbookId === "string" ? patch.playbookId : undefined,
            reviewed: typeof patch.reviewed === "boolean" ? patch.reviewed : undefined,
            reviewedAt: typeof patch.reviewedAt === "number" ? patch.reviewedAt : (patch.reviewed ? now : undefined),
            executionQuality: normalizeExecutionQuality(patch.executionQuality, 3),
            notes: typeof patch.notes === "string" ? patch.notes : notes.trim(),
            createdAt: now,
            updatedAt: now,
            customTagName: patch.customTagName,
            marketProfile: patch.marketProfile,
            atrAtEntry: patch.atrAtEntry,
            trevSettings: patch.trevSettings,
            mistakeTags: patch.mistakeTags,
            targets: patch.targets,
            stops: patch.stops,
            screenshots: patch.screenshots,
        });
    }, [annotation, updateAnnotation, trade.id, addAnnotation, notes]);

    const persistNotes = useCallback((nextNotes: string) => {
        const normalized = nextNotes.trim();
        if ((annotation?.notes || "") === normalized) {
            setNotesDirty(false);
            return;
        }
        saveAnnotationPatch({ notes: normalized });
        setNotesDirty(false);
    }, [annotation?.notes, saveAnnotationPatch]);

    const persistScreenshots = useCallback((next: string[]) => {
        saveAnnotationPatch({ screenshots: next });
    }, [saveAnnotationPatch]);

    const persistTargets = useCallback((next: TargetRow[]) => {
        const normalized = normalizeLevelRowsForSave(next);
        setTargets(normalized);
        saveAnnotationPatch({ targets: normalized });
    }, [saveAnnotationPatch]);

    const persistStops = useCallback((next: StopRow[]) => {
        const normalized = normalizeLevelRowsForSave(next);
        setStops(normalized);
        saveAnnotationPatch({ stops: normalized });
    }, [saveAnnotationPatch]);

    const infoTargets = useMemo(() => {
        const info = (trade as unknown as { info?: unknown }).info;
        if (!info || typeof info !== "object") return [];
        return parseLevelRows((info as Record<string, unknown>).targets);
    }, [trade]);

    const infoStops = useMemo(() => {
        const info = (trade as unknown as { info?: unknown }).info;
        if (!info || typeof info !== "object") return [];
        return parseLevelRows((info as Record<string, unknown>).stops);
    }, [trade]);

    const baseTargets: TargetRow[] = useMemo(() => {
        const fromAnnotation = parseLevelRows(annotation?.targets);
        return fromAnnotation.length > 0 ? fromAnnotation : infoTargets;
    }, [annotation?.targets, infoTargets]);

    const baseStops: StopRow[] = useMemo(() => {
        const fromAnnotation = parseLevelRows(annotation?.stops);
        return fromAnnotation.length > 0 ? fromAnnotation : infoStops;
    }, [annotation?.stops, infoStops]);

    useEffect(() => {
        setTargets(baseTargets);
    }, [trade.id, baseTargets]);

    useEffect(() => {
        setStops(baseStops);
    }, [trade.id, baseStops]);

    useEffect(() => {
        setMistakeTags(normalizeMistakeTags(Array.isArray(annotation?.mistakeTags) ? annotation.mistakeTags : []));
        setMistakeTagInput("");
    }, [trade.id, annotation?.mistakeTags]);

    const isLong = trade.side === "buy" || String(trade.side).toLowerCase() === "long";
    const chartSymbol = useMemo(
        () => normalizeChartSymbol(trade, resolvedHyperliquidSymbol || undefined),
        [trade, resolvedHyperliquidSymbol]
    );

    useEffect(() => {
        setChartLoadError(null);
    }, [chartSymbol, chartInterval]);

    const entryPrice = toFiniteNumber(trade.entryPrice ?? trade.price, 0);
    const rawExitPrice = toFiniteNumber(trade.exitPrice, NaN);
    const inferredExitPrice = trade.isOpen ? NaN : toFiniteNumber(trade.price, NaN);
    const exitPrice = Number.isFinite(rawExitPrice) ? rawExitPrice : inferredExitPrice;
    const hasExitPrice = Number.isFinite(exitPrice) && exitPrice > 0;

    const tradeNotional = toFiniteNumber((trade as unknown as { cost?: number }).cost, 0) > 0
        ? toFiniteNumber((trade as unknown as { cost?: number }).cost, 0)
        : toFiniteNumber(trade.amount, 0) * entryPrice;

    const directionalMove = hasExitPrice && entryPrice > 0
        ? (isLong ? ((exitPrice - entryPrice) / entryPrice) : ((entryPrice - exitPrice) / entryPrice)) * 100
        : 0;

    const fees = Math.abs(toFiniteNumber(trade.fees, 0));
    const funding = toFiniteNumber(trade.funding, 0);
    const chartExcursionFallback = useMemo(() => {
        if (!Array.isArray(chartCandles) || chartCandles.length === 0) return null;
        if (!(entryPrice > 0)) return null;
        const quantity = Math.abs(toFiniteNumber(trade.amount, 0));
        if (!Number.isFinite(quantity) || quantity <= 0) return null;

        const entrySec = toUnixSeconds(trade.entryTime ?? trade.timestamp) ?? toUnixSeconds(trade.timestamp);
        const exitSec = hasExitPrice
            ? (toUnixSeconds(trade.exitTime ?? trade.timestamp) ?? null)
            : null;

        const inTradeCandles = chartCandles.filter((bar) => {
            const t = Number(bar.time);
            if (!Number.isFinite(t) || t <= 0) return false;
            if (entrySec != null && t < entrySec) return false;
            if (exitSec != null && t > exitSec) return false;
            return true;
        });
        const scope = inTradeCandles.length > 0 ? inTradeCandles : chartCandles;
        let minLow = Number.POSITIVE_INFINITY;
        let maxHigh = Number.NEGATIVE_INFINITY;
        for (const bar of scope) {
            const low = Number(bar.low);
            const high = Number(bar.high);
            if (Number.isFinite(low)) minLow = Math.min(minLow, low);
            if (Number.isFinite(high)) maxHigh = Math.max(maxHigh, high);
        }
        if (!Number.isFinite(minLow) || !Number.isFinite(maxHigh)) return null;

        const adversePerUnit = isLong
            ? Math.min(0, minLow - entryPrice)
            : Math.min(0, entryPrice - maxHigh);
        const favorablePerUnit = isLong
            ? Math.max(0, maxHigh - entryPrice)
            : Math.max(0, entryPrice - minLow);

        const maeValue = Math.abs(adversePerUnit * quantity);
        const mfeValue = Math.abs(favorablePerUnit * quantity);
        if (!(maeValue > 0 || mfeValue > 0)) return null;
        return { mae: maeValue, mfe: mfeValue };
    }, [
        chartCandles,
        entryPrice,
        hasExitPrice,
        isLong,
        trade.amount,
        trade.entryTime,
        trade.exitTime,
        trade.timestamp,
    ]);

    const rawMae = toFiniteNumber(trade.mae, NaN);
    const rawMfe = toFiniteNumber(trade.mfe, NaN);
    const mae = Number.isFinite(rawMae) && Math.abs(rawMae) > 0
        ? Math.abs(rawMae)
        : toFiniteNumber(chartExcursionFallback?.mae, 0);
    const mfe = Number.isFinite(rawMfe) && Math.abs(rawMfe) > 0
        ? Math.abs(rawMfe)
        : toFiniteNumber(chartExcursionFallback?.mfe, 0);
    const hasMae = Number.isFinite(mae) && mae > 0;
    const hasMfe = Number.isFinite(mfe) && mfe > 0;
    const realizedPnl = toFiniteNumber(trade.realizedPnl, toFiniteNumber(trade.pnl, 0));
    const mfeMaeRatio = hasMae && hasMfe ? Math.abs(mfe / mae) : 0;

    const plannedRR = useMemo(() => {
        const firstTarget = targets[0]?.price;
        const firstStop = stops[0]?.price;
        if (!firstTarget || !firstStop || entryPrice <= 0) return null;
        const reward = isLong ? (firstTarget - entryPrice) : (entryPrice - firstTarget);
        const risk = isLong ? (entryPrice - firstStop) : (firstStop - entryPrice);
        if (reward <= 0 || risk <= 0) return null;
        return reward / risk;
    }, [targets, stops, entryPrice, isLong]);

    const riskReference = useMemo(() => {
        if (hasMae) return Math.abs(mae);
        const firstStop = stops[0]?.price;
        if (!firstStop || entryPrice <= 0) return 0;
        const perUnit = Math.abs(entryPrice - firstStop);
        return perUnit * Math.max(1, Math.abs(toFiniteNumber(trade.amount, 0)));
    }, [hasMae, mae, stops, entryPrice, trade.amount]);

    const actualRR = riskReference > 0 ? realizedPnl / riskReference : null;
    const strategyTag = annotation?.strategyTag || ("custom" as StrategyTagId);
    const executionQuality = normalizeExecutionQuality(annotation?.executionQuality, 3);
    const executionQualityInfo = EXECUTION_QUALITY.find((q) => q.value === executionQuality);

    const formatPrice = (value: number) => {
        if (preferences.hideBalances) return "••••";
        return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatSignedPrice = (value: number) => {
        if (preferences.hideBalances) return "••••";
        const sign = value > 0 ? "+" : value < 0 ? "-" : "";
        return `${sign}$${Math.abs(value).toFixed(2)}`;
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
        if (!files.length) return;
        try {
            const uploaded = await Promise.all(files.slice(0, 6).map(readFileAsDataUrl));
            const next = [...screenshots, ...uploaded].slice(0, 12);
            setScreenshots(next);
            persistScreenshots(next);
        } catch {
            // Keep UI responsive on read errors.
        }
    };

    const removeScreenshot = (idx: number) => {
        const next = screenshots.filter((_, i) => i !== idx);
        setScreenshots(next);
        persistScreenshots(next);
    };

    const addScreenshotFromUrl = () => {
        const candidate = screenshotUrlInput.trim();
        if (!candidate) return;
        const next = [...screenshots, candidate].slice(0, 12);
        setScreenshots(next);
        persistScreenshots(next);
        setScreenshotUrlInput("");
    };

    const updateTarget = (index: number, patch: Partial<TargetRow>) => {
        const next = targets.map((row, i) => (i === index ? { ...row, ...patch } : row));
        persistTargets(next);
    };

    const updateStop = (index: number, patch: Partial<StopRow>) => {
        const next = stops.map((row, i) => (i === index ? { ...row, ...patch } : row));
        persistStops(next);
    };

    const addTarget = () => {
        const anchor = entryPrice > 0 ? entryPrice : 1;
        const nextPrice = isLong ? anchor * 1.01 : anchor * 0.99;
        persistTargets([
            ...targets,
            { price: Number(nextPrice.toFixed(2)), sizePercent: 100, triggered: false },
        ]);
    };

    const addStop = () => {
        const anchor = entryPrice > 0 ? entryPrice : 1;
        const nextPrice = isLong ? anchor * 0.99 : anchor * 1.01;
        persistStops([
            ...stops,
            { price: Number(nextPrice.toFixed(2)), sizePercent: 100, triggered: false },
        ]);
    };

    const removeTarget = (index: number) => {
        const next = targets.filter((_, i) => i !== index);
        persistTargets(next);
    };

    const removeStop = (index: number) => {
        const next = stops.filter((_, i) => i !== index);
        persistStops(next);
    };

    const persistStrategyTag = useCallback((strategyTag: StrategyTagId) => {
        saveAnnotationPatch({ strategyTag });
    }, [saveAnnotationPatch]);

    const persistExecutionQuality = useCallback((executionQuality: ExecutionQuality) => {
        saveAnnotationPatch({ executionQuality });
    }, [saveAnnotationPatch]);

    const persistPlaybook = useCallback((playbookId: string) => {
        saveAnnotationPatch({ playbookId: playbookId || undefined });
    }, [saveAnnotationPatch]);

    const persistReviewed = useCallback((reviewed: boolean) => {
        saveAnnotationPatch({
            reviewed,
            reviewedAt: reviewed ? Date.now() : undefined,
        });
    }, [saveAnnotationPatch]);

    const persistMistakeTags = useCallback((next: string[]) => {
        const normalized = normalizeMistakeTags(next);
        setMistakeTags(normalized);
        saveAnnotationPatch({ mistakeTags: normalized });
    }, [saveAnnotationPatch]);

    const addMistakeTagsFromInput = () => {
        if (!mistakeTagInput.trim()) return;
        const additions = mistakeTagInput
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean);
        if (!additions.length) return;
        persistMistakeTags([...mistakeTags, ...additions]);
        setMistakeTagInput("");
    };

    const removeMistakeTag = (tag: string) => {
        persistMistakeTags(mistakeTags.filter((current) => current !== tag));
    };

    const effectiveShowEntry = showEntries || showLines;
    const effectiveShowExit = showExits || showLines;
    const avgBuyPrice = showAvgLines
        ? (isLong ? entryPrice : (effectiveShowExit && hasExitPrice ? exitPrice : undefined))
        : undefined;
    const avgSellPrice = showAvgLines
        ? (isLong ? (effectiveShowExit && hasExitPrice ? exitPrice : undefined) : entryPrice)
        : undefined;
    const chartIntervals: ChartInterval[] = ["1m", "5m", "15m", "1h", "4h", "1d"];
    const selectedStrategyTag = STRATEGY_TAGS.find((tag) => tag.id === strategyTag);
    const chartRangeLabel = useMemo(() => {
        const toMs = (value: number | undefined) => {
            if (!value || !Number.isFinite(value)) return 0;
            return value < 1e12 ? value * 1000 : value;
        };
        const start = toMs(trade.entryTime ?? trade.timestamp);
        const end = toMs(trade.exitTime ?? trade.timestamp);
        if (!start || !end) return null;
        return `${formatDate(start, "MMM d, yyyy")} → ${formatDate(end, "MMM d, yyyy")}`;
    }, [trade.entryTime, trade.exitTime, trade.timestamp]);

    const handleCandlesLoaded = useCallback((candles: Array<{ time: number; open: number; high: number; low: number; close: number }>) => {
        if (!Array.isArray(candles) || candles.length === 0) {
            setChartCandles([]);
            return;
        }
        const next = candles
            .map((bar) => ({
                time: Number(bar.time),
                open: Number(bar.open),
                high: Number(bar.high),
                low: Number(bar.low),
                close: Number(bar.close),
            }))
            .filter((bar) =>
                Number.isFinite(bar.time) &&
                Number.isFinite(bar.open) &&
                Number.isFinite(bar.high) &&
                Number.isFinite(bar.low) &&
                Number.isFinite(bar.close)
            );
        setChartCandles(next);
    }, []);

    return (
        <div className="px-3 pb-4">
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/55 overflow-hidden">
                <div className="px-3 py-2.5 border-b border-zinc-800/60 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-2">
                        <select
                            value={chartInterval}
                            onChange={(event) => setChartInterval(event.target.value as ChartInterval)}
                            className="h-7 rounded-md border border-zinc-700 bg-zinc-900 px-2 text-[11px] font-semibold text-zinc-300"
                        >
                            {chartIntervals.map((interval) => (
                                <option key={interval} value={interval}>
                                    {interval}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        {[
                            { id: "ohlcv", label: "OHLCV", checked: showOHLCV, onChange: setShowOHLCV },
                            { id: "entries", label: "Entries", checked: showEntries, onChange: setShowEntries },
                            { id: "exits", label: "Exits", checked: showExits, onChange: setShowExits },
                            { id: "lines", label: "Open/Close lines", checked: showLines, onChange: setShowLines },
                            { id: "avg", label: "Average Entry/Exit", checked: showAvgLines, onChange: setShowAvgLines },
                        ].map((option) => (
                            <label key={option.id} className="inline-flex items-center gap-1.5 text-zinc-300">
                                <input
                                    type="checkbox"
                                    checked={option.checked}
                                    onChange={(event) => option.onChange(event.target.checked)}
                                    className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900 text-emerald-500"
                                />
                                <span className="text-[11px]">{option.label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {chartLoadError ? (
                    <div className="px-3 pt-2 text-[11px] text-amber-400">{chartLoadError}</div>
                ) : null}

                <div className="px-3 py-3">
                    <div className="h-[460px] rounded-xl border border-zinc-700/60 bg-zinc-950 overflow-hidden relative">
                        {!chartSymbol ? (
                            <div className="h-full w-full flex items-center justify-center text-zinc-500 text-sm">
                                <div className="text-center">
                                    <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                                    Chart unavailable for this ticker.
                                </div>
                            </div>
                        ) : (
                            <ScreenerLightweightChart
                                symbol={chartSymbol}
                                interval={chartInterval}
                                entryPrice={effectiveShowEntry ? entryPrice : undefined}
                                avgBuyPrice={avgBuyPrice}
                                avgSellPrice={avgSellPrice}
                                showAvgBuy={showAvgLines}
                                showAvgSell={showAvgLines}
                                showEntry={effectiveShowEntry && !showAvgLines}
                                showVolume={showOHLCV}
                                lowerPaneMode="pnl"
                                positionSize={Math.abs(toFiniteNumber(trade.amount, 0))}
                                entryTimestamp={toFiniteNumber(trade.entryTime ?? trade.timestamp, 0)}
                                exitTimestamp={hasExitPrice ? toFiniteNumber(trade.exitTime ?? trade.timestamp, 0) : undefined}
                                exitPrice={hasExitPrice ? exitPrice : undefined}
                                side={trade.side}
                                onLoadError={(message) => setChartLoadError(message)}
                                onCandlesLoaded={handleCandlesLoaded}
                            />
                        )}
                        {chartRangeLabel ? (
                            <span className="pointer-events-none absolute right-3 top-3 text-[11px] text-zinc-400">
                                {chartRangeLabel}
                            </span>
                        ) : null}
                    </div>
                </div>

                <div className="px-3 pb-3">
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/35 p-3">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Target className="h-3.5 w-3.5 text-emerald-400" />
                                    <span className="text-xs text-zinc-300 font-semibold">Targets</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={addTarget}
                                    className="text-[11px] text-emerald-300 hover:text-emerald-200"
                                >
                                    Add +
                                </button>
                            </div>
                            {targets.length === 0 ? (
                                <p className="text-xs text-zinc-500">No targets recorded for this trade.</p>
                            ) : (
                                <div className="space-y-2">
                                    <div className="grid grid-cols-[1fr_80px_90px_34px] gap-2 text-[10px] uppercase tracking-wide text-zinc-500">
                                        <span>Target price</span>
                                        <span>Size %</span>
                                        <span>Triggered?</span>
                                        <span />
                                    </div>
                                    {targets.map((target, index) => (
                                        <div key={`target-${index}`} className="grid grid-cols-[1fr_80px_90px_34px] gap-2 items-center">
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={target.price}
                                                onChange={(event) => {
                                                    const next = parseFloat(event.target.value);
                                                    updateTarget(index, { price: Number.isFinite(next) ? next : 0 });
                                                }}
                                                className="h-8 rounded-md border border-zinc-700 bg-zinc-900/70 px-2 text-xs text-zinc-200"
                                            />
                                            <input
                                                type="number"
                                                step="1"
                                                min="0"
                                                max="100"
                                                value={target.sizePercent}
                                                onChange={(event) => {
                                                    const next = parseFloat(event.target.value);
                                                    updateTarget(index, { sizePercent: Number.isFinite(next) ? next : 0 });
                                                }}
                                                className="h-8 rounded-md border border-zinc-700 bg-zinc-900/70 px-2 text-xs text-zinc-200"
                                            />
                                            <input
                                                type="checkbox"
                                                checked={target.triggered}
                                                onChange={(event) => updateTarget(index, { triggered: event.target.checked })}
                                                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-emerald-500"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeTarget(index)}
                                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700 text-zinc-500 hover:text-rose-300"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/35 p-3">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Shield className="h-3.5 w-3.5 text-rose-400" />
                                    <span className="text-xs text-zinc-300 font-semibold">Stops</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={addStop}
                                    className="text-[11px] text-rose-300 hover:text-rose-200"
                                >
                                    Add +
                                </button>
                            </div>
                            {stops.length === 0 ? (
                                <p className="text-xs text-zinc-500">No stop levels recorded for this trade.</p>
                            ) : (
                                <div className="space-y-2">
                                    <div className="grid grid-cols-[1fr_80px_90px_34px] gap-2 text-[10px] uppercase tracking-wide text-zinc-500">
                                        <span>Stop price</span>
                                        <span>Size %</span>
                                        <span>Triggered?</span>
                                        <span />
                                    </div>
                                    {stops.map((stop, index) => (
                                        <div key={`stop-${index}`} className="grid grid-cols-[1fr_80px_90px_34px] gap-2 items-center">
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={stop.price}
                                                onChange={(event) => {
                                                    const next = parseFloat(event.target.value);
                                                    updateStop(index, { price: Number.isFinite(next) ? next : 0 });
                                                }}
                                                className="h-8 rounded-md border border-zinc-700 bg-zinc-900/70 px-2 text-xs text-zinc-200"
                                            />
                                            <input
                                                type="number"
                                                step="1"
                                                min="0"
                                                max="100"
                                                value={stop.sizePercent}
                                                onChange={(event) => {
                                                    const next = parseFloat(event.target.value);
                                                    updateStop(index, { sizePercent: Number.isFinite(next) ? next : 0 });
                                                }}
                                                className="h-8 rounded-md border border-zinc-700 bg-zinc-900/70 px-2 text-xs text-zinc-200"
                                            />
                                            <input
                                                type="checkbox"
                                                checked={stop.triggered}
                                                onChange={(event) => updateStop(index, { triggered: event.target.checked })}
                                                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-rose-500"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeStop(index)}
                                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700 text-zinc-500 hover:text-rose-300"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/35 p-3">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-zinc-300 font-semibold">Stats</span>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                <div>
                                    <div className="text-zinc-500">MAE</div>
                                    <div className="text-rose-300 font-semibold">{hasMae ? formatSignedPrice(-Math.abs(mae)) : "N/A"}</div>
                                </div>
                                <div>
                                    <div className="text-zinc-500">MFE</div>
                                    <div className="text-emerald-300 font-semibold">{hasMfe ? formatSignedPrice(Math.abs(mfe)) : "N/A"}</div>
                                </div>
                                <div>
                                    <div className="text-zinc-500">Planned R:R</div>
                                    <div className="text-zinc-300 font-semibold">{plannedRR != null ? plannedRR.toFixed(2) : "N/A"}</div>
                                </div>
                                <div>
                                    <div className="text-zinc-500">Actual R:R</div>
                                    <div className={cn("font-semibold", (actualRR || 0) >= 0 ? "text-emerald-300" : "text-rose-300")}>
                                        {actualRR != null ? actualRR.toFixed(2) : "N/A"}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-zinc-500">Funding</div>
                                    <div className={cn("font-semibold", funding >= 0 ? "text-emerald-300" : "text-rose-300")}>
                                        {formatSignedPrice(funding)}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-zinc-500">Fees</div>
                                    <div className="text-rose-300 font-semibold">{formatSignedPrice(-fees)}</div>
                                </div>
                                <div>
                                    <div className="text-zinc-500">Realized PnL</div>
                                    <div className={cn("font-semibold", realizedPnl >= 0 ? "text-emerald-300" : "text-rose-300")}>
                                        {formatSignedPrice(realizedPnl)}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-zinc-500">Move</div>
                                    <div className={cn("font-semibold", directionalMove >= 0 ? "text-emerald-300" : "text-rose-300")}>
                                        {hasExitPrice ? `${directionalMove >= 0 ? "+" : ""}${directionalMove.toFixed(2)}%` : "N/A"}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-zinc-500">Notional</div>
                                    <div className="text-zinc-300 font-semibold">{formatPrice(tradeNotional)}</div>
                                </div>
                                <div>
                                    <div className="text-zinc-500">MFE/MAE</div>
                                    <div className="text-zinc-300 font-semibold">{hasMae && hasMfe ? mfeMaeRatio.toFixed(2) : "N/A"}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="px-3 pb-4">
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/35 p-3">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Tag className="h-3.5 w-3.5 text-violet-400" />
                                    <span className="text-xs text-zinc-300 font-semibold">Tags</span>
                                </div>
                                <Link href="/journal/preferences" className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300">
                                    Tag manager
                                    <ChevronRight className="h-3 w-3" />
                                </Link>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[11px] text-zinc-500 uppercase tracking-wide">Strategy</span>
                                    <StrategyTagSelector value={strategyTag} onChange={persistStrategyTag} size="sm" />
                                </div>

                                {selectedStrategyTag ? (
                                    <span
                                        className="inline-flex rounded-md px-2 py-1 text-[11px] font-semibold"
                                        style={{ backgroundColor: `${selectedStrategyTag.color}22`, color: selectedStrategyTag.color }}
                                    >
                                        {selectedStrategyTag.name}
                                    </span>
                                ) : (
                                    <p className="text-xs text-zinc-500">No strategy tag selected.</p>
                                )}

                                <div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] text-zinc-500 uppercase tracking-wide">Execution Quality</span>
                                        <span className="text-[10px] text-zinc-400">{executionQualityInfo?.label || "Average"}</span>
                                    </div>
                                    <div className="grid grid-cols-5 gap-1 mt-1.5">
                                        {EXECUTION_QUALITY.map((quality) => (
                                            <button
                                                key={quality.value}
                                                type="button"
                                                onClick={() => persistExecutionQuality(quality.value)}
                                                className={cn(
                                                    "h-7 rounded-md border text-xs font-semibold",
                                                    executionQuality === quality.value
                                                        ? "text-white border-white/30 bg-white/10"
                                                        : "text-zinc-500 border-zinc-700/60 bg-zinc-800/50 hover:text-zinc-300"
                                                )}
                                            >
                                                {quality.value}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] text-zinc-500 uppercase tracking-wide">Playbook</span>
                                        <select
                                            value={annotation?.playbookId || ""}
                                            onChange={(event) => persistPlaybook(event.target.value)}
                                            className="h-7 rounded-md border border-zinc-700 bg-zinc-900 px-2 text-[11px] text-zinc-300 max-w-[170px]"
                                        >
                                            <option value="">Unassigned</option>
                                            {playbooks.map((playbook) => (
                                                <option key={playbook.id} value={playbook.id}>
                                                    {playbook.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <label className="inline-flex items-center gap-2 text-[11px] text-zinc-300">
                                        <input
                                            type="checkbox"
                                            checked={annotation?.reviewed === true}
                                            onChange={(event) => persistReviewed(event.target.checked)}
                                            className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900 text-emerald-500"
                                        />
                                        Reviewed
                                        {annotation?.reviewedAt ? (
                                            <span className="text-zinc-500">
                                                ({formatDate(annotation.reviewedAt < 1e12 ? annotation.reviewedAt * 1000 : annotation.reviewedAt, "MMM d, HH:mm")})
                                            </span>
                                        ) : null}
                                    </label>
                                </div>

                                <div>
                                    <div className="text-[11px] text-zinc-500 uppercase tracking-wide">Mistake tags</div>
                                    <div className="mt-1.5 flex gap-2">
                                        <input
                                            type="text"
                                            value={mistakeTagInput}
                                            onChange={(event) => setMistakeTagInput(event.target.value)}
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter") {
                                                    event.preventDefault();
                                                    addMistakeTagsFromInput();
                                                }
                                            }}
                                            placeholder="chased, early_exit"
                                            className="h-8 flex-1 rounded-md border border-zinc-700 bg-zinc-900/70 px-2 text-xs text-zinc-200 placeholder:text-zinc-600"
                                        />
                                        <button
                                            type="button"
                                            onClick={addMistakeTagsFromInput}
                                            className="h-8 inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900/70 px-2 text-xs text-zinc-300 hover:text-white"
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                            Add
                                        </button>
                                    </div>

                                    {mistakeTags.length > 0 ? (
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            {mistakeTags.map((tag) => (
                                                <button
                                                    key={tag}
                                                    type="button"
                                                    onClick={() => removeMistakeTag(tag)}
                                                    className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-300 hover:bg-amber-500/20"
                                                >
                                                    {tag}
                                                    <X className="h-3 w-3" />
                                                </button>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/35 p-3">
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                    <MessageSquare className="h-3.5 w-3.5 text-blue-400" />
                                    <span className="text-xs text-zinc-300 font-semibold">Notes</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => persistNotes(notes)}
                                    disabled={!notesDirty}
                                    className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-300 disabled:opacity-40"
                                >
                                    <Save className="h-3 w-3" />
                                    Save
                                </button>
                            </div>
                            <div className="relative">
                                <textarea
                                    value={notes}
                                    onChange={(event) => {
                                        setNotes(event.target.value);
                                        setNotesDirty(true);
                                    }}
                                    onBlur={() => {
                                        if (notesDirty) persistNotes(notes);
                                    }}
                                    placeholder="Type your notes here..."
                                    className="w-full h-[168px] rounded-lg border border-zinc-700 bg-zinc-900/70 p-3 pr-12 text-sm text-zinc-200 placeholder:text-zinc-600 resize-none focus:outline-none focus:border-emerald-500/50"
                                />
                                <div className="absolute right-3 bottom-3">
                                    <VoiceInputButton
                                        isListening={isListening}
                                        isTranscribing={isTranscribing}
                                        onClick={() => voiceSupported && toggleListening(notes)}
                                        disabled={!voiceSupported}
                                        title={voiceSupported ? (isListening ? "Stop recording" : "Record & transcribe") : "Voice not supported"}
                                        size="sm"
                                    />
                                </div>
                            </div>
                            {voiceError ? <p className="text-[10px] text-amber-400 mt-1">{voiceError}</p> : null}
                        </div>

                        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/35 p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <ImageIcon className="h-3.5 w-3.5 text-amber-400" />
                                <span className="text-xs text-zinc-300 font-semibold">Screenshots</span>
                            </div>
                            <div className="flex gap-2 mb-2">
                                <input
                                    type="text"
                                    value={screenshotUrlInput}
                                    onChange={(event) => setScreenshotUrlInput(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault();
                                            addScreenshotFromUrl();
                                        }
                                    }}
                                    placeholder="Paste chart/Gyazo link"
                                    className="h-8 flex-1 rounded-md border border-zinc-700 bg-zinc-900/70 px-2 text-xs text-zinc-200 placeholder:text-zinc-600"
                                />
                                <button
                                    type="button"
                                    onClick={addScreenshotFromUrl}
                                    className="h-8 rounded-md border border-zinc-700 bg-zinc-900/70 px-2 text-xs text-zinc-300 hover:text-white"
                                >
                                    Add
                                </button>
                            </div>
                            <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                className={cn(
                                    "rounded-lg border-2 border-dashed p-5 text-center transition-colors",
                                    isDragOver ? "border-emerald-500/60 bg-emerald-500/5" : "border-zinc-700/60 bg-zinc-900/40"
                                )}
                            >
                                <Upload className="w-6 h-6 mx-auto mb-2 text-zinc-500" />
                                <p className="text-xs text-zinc-400">Drop screenshots to attach, or browse</p>
                            </div>

                            {screenshots.length > 0 ? (
                                <div className="mt-2 grid grid-cols-3 gap-2">
                                    {screenshots.map((src, index) => (
                                        <div key={`${src.slice(0, 24)}-${index}`} className="relative rounded-md overflow-hidden border border-zinc-700 bg-black/20">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={src} alt={`trade-screenshot-${index + 1}`} className="h-20 w-full object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => removeScreenshot(index)}
                                                className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded bg-black/70 text-white/80 hover:text-white"
                                                aria-label="Remove screenshot"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
