"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { JournalTrade, useJournal } from "@/contexts/JournalContext";
import { STRATEGY_TAGS, type StrategyTagId, type TradeAnnotation } from "@/lib/api/journal-types";
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
} from "lucide-react";
import { useVoiceRecognition } from "@/hooks/useVoiceRecognition";
import { VoiceInputButton } from "@/components/ui/VoiceInputButton";
import { ScreenerLightweightChart } from "@/components/Screener/ScreenerLightweightChart";
import { TradingViewChart } from "@/components/Screener/TradingViewChart";
import { normalizeSymbol } from "@/lib/utils/normalization";

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

function toFiniteNumber(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
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

function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
        reader.readAsDataURL(file);
    });
}

function normalizeChartSymbol(trade: JournalTrade): string {
    const rawSymbol = normalizeSymbol(
        trade.symbol || (trade as unknown as { rawSymbol?: string }).rawSymbol || ""
    );
    if (!rawSymbol) return "";

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
    const { preferences, annotations, addAnnotation, updateAnnotation } = useJournal();
    const annotation = annotations[trade.id];

    const [notes, setNotes] = useState(annotation?.notes || "");
    const [notesDirty, setNotesDirty] = useState(false);
    const [screenshots, setScreenshots] = useState<string[]>(annotation?.screenshots || []);

    const [showOHLCV, setShowOHLCV] = useState(true);
    const [showEntries, setShowEntries] = useState(true);
    const [showExits, setShowExits] = useState(true);
    const [showLines, setShowLines] = useState(true);
    const [showAvgLines, setShowAvgLines] = useState(true);
    const [isDragOver, setIsDragOver] = useState(false);
    const [chartFallback, setChartFallback] = useState(false);

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
    }, [annotation?.notes, annotation?.screenshots, trade.id]);

    useEffect(() => {
        setChartFallback(false);
    }, [trade.id]);

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
            strategyTag: "custom" as StrategyTagId,
            executionQuality: 3,
            notes: typeof patch.notes === "string" ? patch.notes : notes.trim(),
            createdAt: now,
            updatedAt: now,
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

    const targets: TargetRow[] = useMemo(() => {
        const fromAnnotation = parseLevelRows(annotation?.targets);
        return fromAnnotation.length > 0 ? fromAnnotation : infoTargets;
    }, [annotation?.targets, infoTargets]);

    const stops: StopRow[] = useMemo(() => {
        const fromAnnotation = parseLevelRows(annotation?.stops);
        return fromAnnotation.length > 0 ? fromAnnotation : infoStops;
    }, [annotation?.stops, infoStops]);

    const isLong = trade.side === "buy" || String(trade.side).toLowerCase() === "long";
    const chartSymbol = useMemo(() => normalizeChartSymbol(trade), [trade]);

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
    const mae = toFiniteNumber(trade.mae, 0);
    const mfe = toFiniteNumber(trade.mfe, 0);
    const realizedPnl = toFiniteNumber(trade.realizedPnl, toFiniteNumber(trade.pnl, 0));
    const mfeMaeRatio = Math.abs(mae) > 0 ? Math.abs(mfe / mae) : 0;

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
        if (Math.abs(mae) > 0) return Math.abs(mae);
        const firstStop = stops[0]?.price;
        if (!firstStop || entryPrice <= 0) return 0;
        const perUnit = Math.abs(entryPrice - firstStop);
        return perUnit * Math.max(1, Math.abs(toFiniteNumber(trade.amount, 0)));
    }, [mae, stops, entryPrice, trade.amount]);

    const actualRR = riskReference > 0 ? realizedPnl / riskReference : null;

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

    const effectiveShowEntry = showEntries || showLines;
    const effectiveShowExit = showExits || showLines;
    const avgBuyPrice = showAvgLines
        ? (isLong ? entryPrice : (effectiveShowExit && hasExitPrice ? exitPrice : undefined))
        : undefined;
    const avgSellPrice = showAvgLines
        ? (isLong ? (effectiveShowExit && hasExitPrice ? exitPrice : undefined) : entryPrice)
        : undefined;

    return (
        <div className="px-4 pb-6">
            <div className="p-6 rounded-2xl bg-zinc-800/30 border border-zinc-700/30">
                <div className="grid grid-cols-12 gap-6">
                    <div className="col-span-7 space-y-4">
                        <div className="aspect-[16/9] rounded-xl bg-zinc-900 border border-zinc-700/40 overflow-hidden">
                            {!chartSymbol ? (
                                <div className="h-full w-full flex items-center justify-center text-zinc-500 text-sm">
                                    <div className="text-center">
                                        <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                                        Chart unavailable for this ticker.
                                    </div>
                                </div>
                            ) : chartFallback ? (
                                <TradingViewChart symbol={chartSymbol} interval="60" />
                            ) : (
                                <ScreenerLightweightChart
                                    symbol={chartSymbol}
                                    interval="1h"
                                    entryPrice={effectiveShowEntry ? entryPrice : undefined}
                                    avgBuyPrice={avgBuyPrice}
                                    avgSellPrice={avgSellPrice}
                                    showAvgBuy={showAvgLines}
                                    showAvgSell={showAvgLines}
                                    showEntry={effectiveShowEntry && !showAvgLines}
                                    showVolume={showOHLCV}
                                    side={trade.side}
                                    onLoadError={() => setChartFallback(true)}
                                />
                            )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {[
                                { id: "ohlcv", label: "OHLCV", checked: showOHLCV, onChange: setShowOHLCV },
                                { id: "entries", label: "Entries", checked: showEntries, onChange: setShowEntries },
                                { id: "exits", label: "Exits", checked: showExits, onChange: setShowExits },
                                { id: "lines", label: "Open/Close lines", checked: showLines, onChange: setShowLines },
                                { id: "avgLines", label: "Average Entry/Exit", checked: showAvgLines, onChange: setShowAvgLines },
                            ].map((opt) => (
                                <label
                                    key={opt.id}
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors",
                                        opt.checked ? "bg-zinc-700 text-white" : "bg-zinc-800/50 text-zinc-500"
                                    )}
                                >
                                    <input
                                        type="checkbox"
                                        checked={opt.checked}
                                        onChange={(e) => opt.onChange(e.target.checked)}
                                        className="hidden"
                                    />
                                    {opt.label}
                                </label>
                            ))}
                        </div>

                        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-700/30">
                            <div className="grid grid-cols-4 gap-3 text-xs">
                                <div>
                                    <p className="text-zinc-500">Entry</p>
                                    <p className="text-zinc-200 font-semibold">{formatPrice(entryPrice)}</p>
                                </div>
                                <div>
                                    <p className="text-zinc-500">Exit</p>
                                    <p className="text-zinc-200 font-semibold">{hasExitPrice ? formatPrice(exitPrice) : "Open"}</p>
                                </div>
                                <div>
                                    <p className="text-zinc-500">Notional</p>
                                    <p className="text-zinc-200 font-semibold">{formatPrice(tradeNotional)}</p>
                                </div>
                                <div>
                                    <p className="text-zinc-500">Move</p>
                                    <p className={cn("font-semibold", directionalMove >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                        {directionalMove >= 0 ? "+" : ""}{directionalMove.toFixed(2)}%
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="col-span-5 space-y-4">
                        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-700/30">
                            <div className="flex items-center gap-2 mb-3">
                                <Target className="w-4 h-4 text-emerald-400" />
                                <span className="text-xs text-zinc-400 uppercase tracking-wider font-bold">Targets</span>
                            </div>
                            {targets.length === 0 ? (
                                <p className="text-xs text-zinc-500">No targets recorded for this trade.</p>
                            ) : (
                                <div className="space-y-2">
                                    <div className="grid grid-cols-3 gap-2 text-[10px] text-zinc-500 uppercase">
                                        <span>Target price</span>
                                        <span>Size %</span>
                                        <span>Triggered</span>
                                    </div>
                                    {targets.map((target, i) => (
                                        <div key={`target-${i}`} className="grid grid-cols-3 gap-2 items-center">
                                            <span className="text-sm text-zinc-300">{formatPrice(target.price)}</span>
                                            <span className="text-sm text-zinc-400">{target.sizePercent}%</span>
                                            <input
                                                type="checkbox"
                                                checked={target.triggered}
                                                readOnly
                                                className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-700/30">
                            <div className="flex items-center gap-2 mb-3">
                                <Shield className="w-4 h-4 text-rose-400" />
                                <span className="text-xs text-zinc-400 uppercase tracking-wider font-bold">Stops</span>
                            </div>
                            {stops.length === 0 ? (
                                <p className="text-xs text-zinc-500">No stop levels recorded for this trade.</p>
                            ) : (
                                <div className="space-y-2">
                                    <div className="grid grid-cols-3 gap-2 text-[10px] text-zinc-500 uppercase">
                                        <span>Stop price</span>
                                        <span>Size %</span>
                                        <span>Triggered</span>
                                    </div>
                                    {stops.map((stop, i) => (
                                        <div key={`stop-${i}`} className="grid grid-cols-3 gap-2 items-center">
                                            <span className="text-sm text-zinc-300">{formatPrice(stop.price)}</span>
                                            <span className="text-sm text-zinc-400">{stop.sizePercent}%</span>
                                            <input
                                                type="checkbox"
                                                checked={stop.triggered}
                                                readOnly
                                                className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-rose-500"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-700/30">
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div>
                                    <span className="text-zinc-500">MAE</span>
                                    <p className="text-rose-400 font-bold">{mae ? formatSignedPrice(-Math.abs(mae)) : "N/A"}</p>
                                </div>
                                <div>
                                    <span className="text-zinc-500">MFE</span>
                                    <p className="text-emerald-400 font-bold">{mfe ? formatSignedPrice(Math.abs(mfe)) : "N/A"}</p>
                                </div>
                                <div>
                                    <span className="text-zinc-500">Planned R:R</span>
                                    <p className="text-zinc-300 font-bold">{plannedRR != null ? plannedRR.toFixed(2) : "N/A"}</p>
                                </div>
                                <div>
                                    <span className="text-zinc-500">Actual R:R</span>
                                    <p className={cn("font-bold", (actualRR || 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                        {actualRR != null ? actualRR.toFixed(2) : "N/A"}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-zinc-500">Funding</span>
                                    <p className={cn("font-bold", funding >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                        {formatSignedPrice(funding)}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-zinc-500">Fees</span>
                                    <p className="text-rose-400 font-bold">{formatSignedPrice(-fees)}</p>
                                </div>
                                <div>
                                    <span className="text-zinc-500">Realized PnL</span>
                                    <p className={cn("font-bold", realizedPnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                        {formatSignedPrice(realizedPnl)}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-zinc-500">MFE/MAE</span>
                                    <p className="text-zinc-300 font-bold">{mfeMaeRatio ? mfeMaeRatio.toFixed(2) : "N/A"}</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-700/30">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Tag className="w-4 h-4 text-violet-400" />
                                    <span className="text-xs text-zinc-400 uppercase tracking-wider font-bold">Tags</span>
                                </div>
                                <Link
                                    href="/journal/preferences"
                                    className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
                                >
                                    Tag Manager
                                    <ChevronRight className="w-3 h-3" />
                                </Link>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {annotation?.strategyTag ? (
                                    (() => {
                                        const tag = STRATEGY_TAGS.find((t) => t.id === annotation.strategyTag);
                                        return tag ? (
                                            <span
                                                className="px-2 py-1 rounded-lg text-xs font-medium"
                                                style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                                            >
                                                {tag.name}
                                            </span>
                                        ) : null;
                                    })()
                                ) : (
                                    <span className="text-xs text-zinc-500">No tags added</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-6 p-4 rounded-xl bg-zinc-900/50 border border-zinc-700/30">
                    <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-blue-400" />
                            <span className="text-xs text-zinc-400 uppercase tracking-wider font-bold">Notes</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => persistNotes(notes)}
                            disabled={!notesDirty}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300 disabled:opacity-40"
                        >
                            <Save className="h-3 w-3" />
                            Save
                        </button>
                    </div>
                    <div className="relative">
                        <textarea
                            value={notes}
                            onChange={(e) => {
                                setNotes(e.target.value);
                                setNotesDirty(true);
                            }}
                            onBlur={() => {
                                if (notesDirty) persistNotes(notes);
                            }}
                            placeholder="Add your trade notes here..."
                            className="w-full h-24 p-3 pr-14 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-sm text-white placeholder:text-zinc-600 resize-none focus:outline-none focus:border-emerald-500/50 transition-colors"
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
                    {voiceError && <p className="text-[10px] text-amber-400 mt-1">{voiceError}</p>}
                </div>

                <div className="mt-4 p-4 rounded-xl bg-zinc-900/50 border border-zinc-700/30">
                    <div className="flex items-center gap-2 mb-3">
                        <ImageIcon className="w-4 h-4 text-amber-400" />
                        <span className="text-xs text-zinc-400 uppercase tracking-wider font-bold">Screenshots</span>
                    </div>
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={cn(
                            "p-6 rounded-xl border-2 border-dashed transition-colors text-center",
                            isDragOver
                                ? "border-emerald-500/50 bg-emerald-500/5"
                                : "border-zinc-700/50 bg-zinc-800/30"
                        )}
                    >
                        <Upload className="w-7 h-7 mx-auto mb-2 text-zinc-500" />
                        <p className="text-sm text-zinc-400">Drag & drop screenshots here</p>
                        <p className="text-xs text-zinc-600 mt-1">Up to 12 images, saved with this trade note</p>
                    </div>
                    {screenshots.length > 0 && (
                        <div className="mt-3 grid grid-cols-4 gap-2">
                            {screenshots.map((src, idx) => (
                                <div key={`${src.slice(0, 24)}-${idx}`} className="relative rounded-lg overflow-hidden border border-white/10 bg-black/20">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={src} alt={`trade-screenshot-${idx + 1}`} className="w-full h-20 object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => removeScreenshot(idx)}
                                        className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white/80 hover:text-white"
                                        aria-label="Remove screenshot"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
