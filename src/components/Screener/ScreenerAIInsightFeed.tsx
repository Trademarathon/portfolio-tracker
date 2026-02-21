"use client";

import { useMemo, useState } from "react";
import { Sparkles, User, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScreenerInsight } from "@/lib/screenerInsights";

const DEFAULT_TIER = "Advanced" as const;
type Tier = "Advanced" | "Pro";

export interface ScreenerAIInsightFeedProps {
    insights: ScreenerInsight[];
    /** Symbols selected for AI insight (e.g. BTCUSDT) for filter dropdown */
    symbols: string[];
    /** Set of symbol keys (SYMBOL-exchange) or base symbols that user holds */
    heldSymbols?: Set<string>;
    /** Filter to only show insights for symbols user holds */
    onlyMyPositions?: boolean;
    onOnlyMyPositionsChange?: (value: boolean) => void;
    /** Filter by single symbol; empty = all */
    filterSymbol?: string;
    onFilterSymbolChange?: (symbol: string) => void;
    tier?: Tier;
    className?: string;
}

export function ScreenerAIInsightFeed({
    insights,
    symbols,
    heldSymbols = new Set(),
    onlyMyPositions = false,
    onOnlyMyPositionsChange,
    filterSymbol = "",
    onFilterSymbolChange,
    tier = DEFAULT_TIER,
    className,
}: ScreenerAIInsightFeedProps) {
    const [localOnlyPositions, setLocalOnlyPositions] = useState(onlyMyPositions);
    const onlyPositions = onOnlyMyPositionsChange ? onlyMyPositions : localOnlyPositions;
    const setOnlyPositions = onOnlyMyPositionsChange ?? setLocalOnlyPositions;

    const isHeld = (insight: ScreenerInsight) => {
        if (!heldSymbols.size) return false;
        const base = (insight.symbol || "").toUpperCase();
        return heldSymbols.has(base) || heldSymbols.has(insight.symbolKey);
    };

    const filtered = useMemo(() => {
        let list = insights;
        if (onlyPositions) list = list.filter(i => isHeld(i));
        if (filterSymbol) list = list.filter(i => (i.symbol || "").toUpperCase() === filterSymbol.toUpperCase());
        return list;
    }, [insights, onlyPositions, filterSymbol, heldSymbols]);

    return (
        <div className={cn("flex flex-col border border-white/10 rounded-lg bg-zinc-900/50 overflow-hidden", className)}>
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/5 bg-zinc-800/50">
                <div className="flex items-center gap-2">
                    <div className="p-1 rounded bg-amber-500/20 border border-amber-500/30">
                        <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">AI Insight Feed</span>
                    <span className={cn(
                        "text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border",
                        tier === "Pro" ? "bg-violet-500/20 text-violet-400 border-violet-500/30" : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                    )}>
                        {tier}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    {heldSymbols.size > 0 && (
                        <button
                            onClick={() => setOnlyPositions(!onlyPositions)}
                            className={cn(
                                "flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold uppercase border transition-colors",
                                onlyPositions ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : "text-zinc-500 border-white/10 hover:bg-white/5"
                            )}
                        >
                            <User className="h-3 w-3" />
                            My positions
                        </button>
                    )}
                    {symbols.length > 1 && onFilterSymbolChange && (
                        <select
                            value={filterSymbol}
                            onChange={e => onFilterSymbolChange(e.target.value)}
                            className="h-6 min-w-0 max-w-[100px] rounded border border-white/10 bg-zinc-800 text-[9px] font-bold text-zinc-300 px-1.5"
                        >
                            <option value="">All</option>
                            {symbols.map(s => (
                                <option key={s} value={s}>{s.replace(/USDT$/i, "")}</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-2 pb-3 divide-y divide-white/5">
                {filtered.length === 0 ? (
                    <p className="text-[10px] text-zinc-500 font-bold py-4 text-center">No insights for current filters.</p>
                ) : (
                    filtered.map((insight) => (
                        <div
                            key={insight.symbolKey}
                            className={cn(
                                "p-2 rounded-lg border text-left transition-colors mt-2",
                                "border-white/5 bg-white/[0.02] hover:bg-white/5",
                                insight.type === "pump" && "border-emerald-500/10 bg-emerald-500/5",
                                insight.type === "dump" && "border-rose-500/10 bg-rose-500/5"
                            )}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-bold text-zinc-200 uppercase">{insight.symbol}</span>
                                {isHeld(insight) && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                        You hold
                                    </span>
                                )}
                            </div>
                            <p className="text-[10px] text-zinc-400 mt-1">{insight.reason}</p>
                            <p className={cn(
                                "text-[9px] mt-0.5 font-medium",
                                insight.type === "pump" && "text-emerald-400",
                                insight.type === "dump" && "text-rose-400",
                                insight.type === "neutral" && "text-zinc-500"
                            )}>
                                {insight.recommendation}
                            </p>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
