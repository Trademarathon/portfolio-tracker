"use client";

import React, { useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, ShieldAlert, Zap, TrendingUp, TrendingDown, ChevronDown, Settings2, MoreHorizontal } from 'lucide-react';
import { useL2Book } from '@/hooks/useL2Book';
import { cn } from '@/lib/utils';

interface TerminalDOMProps {
    symbol: string;
    currentPrice: number;
    positions?: any[];
}

export function TerminalDOM({ symbol, currentPrice, positions = [] }: TerminalDOMProps) {
    const book = useL2Book(symbol);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Filter position for this symbol
    const position = positions.find(p => p.symbol === symbol);

    // Process levels
    const processedLevels = useMemo(() => {
        if (!book || !book.levels) return { levels: [], maxVol: 0 };

        // bids: book.levels[0], asks: book.levels[1]
        const bids = book.levels[0].map((l) => ({ ...l, type: 'bid' as const }));
        const asks = book.levels[1].map((l) => ({ ...l, type: 'ask' as const }));

        // combine and sort
        const combined = [...bids, ...asks].sort((a, b) => parseFloat(b.px) - parseFloat(a.px));

        const maxVol = Math.max(...combined.map((l) => parseFloat(l.sz)), 0.00001);

        return {
            levels: combined,
            maxVol
        };
    }, [book]);

    // Auto-scroll to current price
    useEffect(() => {
        if (scrollRef.current && processedLevels.levels.length > 0) {
            // Find index of level closest to current price
            let closestIndex = 0;
            let minDiff = Infinity;
            processedLevels.levels.forEach((l: any, i: number) => {
                const diff = Math.abs(parseFloat(l.px) - currentPrice);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestIndex = i;
                }
            });

            const element = scrollRef.current.children[closestIndex] as HTMLElement;
            if (element) {
                const containerHeight = scrollRef.current.offsetHeight;
                scrollRef.current.scrollTop = element.offsetTop - (containerHeight / 2) + (element.offsetHeight / 2);
            }
        }
    }, [currentPrice, processedLevels.levels.length]);

    return (
        <div className="flex flex-col h-full bg-[#0c0c0e] border-l border-white/5 w-[280px] shrink-0 font-mono select-none">
            {/* TOP HEADER */}
            <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between text-[10px] font-black uppercase tracking-tighter bg-zinc-900/50">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-zinc-300">{symbol} DOM</span>
                    <span className="text-zinc-600 px-1.5 py-0.5 rounded bg-white/5 ml-1">10x CR</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-500">
                    <span className="hover:text-white cursor-pointer transition-colors">100</span>
                    <span className="text-indigo-500 font-bold underline cursor-pointer">1,000</span>
                    <Settings2 size={12} className="ml-1 hover:text-white cursor-pointer" />
                </div>
            </div>

            {/* LADDER HEADER */}
            <div className="grid grid-cols-3 px-3 py-1.5 border-b border-white/5 text-[9px] font-bold text-zinc-500 bg-black/20">
                <span>SIZE</span>
                <span className="text-center">PRICE</span>
                <span className="text-right">VOL</span>
            </div>

            {/* LADDER CONTENT */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto scrollbar-none relative"
            >
                {processedLevels.levels.map((level, i) => {
                    const price = parseFloat(level.px);
                    const size = parseFloat(level.sz);
                    const isCurrent = Math.abs(price - currentPrice) < (price * 0.0001); // Close enough
                    const volPercent = (size / processedLevels.maxVol) * 100;

                    const isBid = level.type === 'bid';

                    // Check if price matches position entry
                    const isEntry = position && Math.abs(price - position.entryPrice) < (price * 0.0001);

                    return (
                        <div
                            key={level.px}
                            className={cn(
                                "grid grid-cols-3 px-3 py-0.5 relative group cursor-pointer transition-colors border-y border-transparent",
                                isCurrent ? "bg-indigo-500/10 border-indigo-500/20" : "hover:bg-white/5",
                                isEntry && "bg-orange-500/10 border-orange-500/20"
                            )}
                        >
                            {/* BACKGROUND BARS */}
                            <div className="absolute inset-0 pointer-events-none opacity-20 overflow-hidden">
                                <div
                                    className={cn(
                                        "h-full transition-all duration-300",
                                        isBid ? "bg-emerald-500 ml-auto" : "bg-rose-500 mr-auto"
                                    )}
                                    style={{ width: `${volPercent}%` }}
                                />
                            </div>

                            {/* SIZE (LHS) */}
                            <div className={cn(
                                "text-[10px] z-10 font-bold",
                                isBid ? "text-emerald-500/80" : "text-rose-500/80"
                            )}>
                                {isBid ? size.toLocaleString(undefined, { maximumFractionDigits: 1 }) : ""}
                            </div>

                            {/* PRICE (CENTER) */}
                            <div className={cn(
                                "text-[11px] text-center z-10 font-black",
                                isCurrent ? "text-white scale-110" : i % 2 === 0 ? "text-zinc-300" : "text-zinc-500"
                            )}>
                                {price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>

                            {/* VOL (RHS) */}
                            <div className={cn(
                                "text-[10px] text-right z-10 font-bold",
                                !isBid ? "text-rose-500/80" : "text-emerald-500/80"
                            )}>
                                {!isBid ? size.toLocaleString(undefined, { maximumFractionDigits: 1 }) : ""}
                            </div>

                            {/* CURRENT PRICE MARKER */}
                            {isCurrent && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3 bg-indigo-500 rounded-r shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                            )}

                            {/* ENTRY MARKER */}
                            {isEntry && (
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1 pr-1">
                                    <span className="text-[8px] font-black text-orange-400">ENTRY</span>
                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* BOTTOM STATS CONTAINER */}
            <div className="p-3 border-t border-white/5 bg-zinc-900/80 space-y-2.5">
                {position ? (
                    <>
                        <div className="flex justify-between items-center text-[9px] uppercase font-black tracking-widest text-zinc-500">
                            <span>Position Size</span>
                            <span className={cn(position.side === 'long' ? "text-emerald-400" : "text-rose-400")}>
                                {position.side.toUpperCase()} {position.size} {symbol.split('-')[0]}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[9px] text-zinc-500 font-bold uppercase">Avg Price</span>
                            <span className="text-[11px] text-zinc-300 font-black">$ {position.entryPrice.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[9px] text-zinc-500 font-bold uppercase">Unrealized PnL</span>
                            <span className={cn(
                                "text-[11px] font-black",
                                position.pnl >= 0 ? "text-emerald-500" : "text-rose-500"
                            )}>
                                {position.pnl >= 0 ? "+" : ""}$ {position.pnl.toLocaleString()}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                            <button className="py-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black text-emerald-500 uppercase tracking-widest hover:bg-emerald-500/20 transition-all">Buy Market</button>
                            <button className="py-2 rounded bg-rose-500/10 border border-rose-500/20 text-[10px] font-black text-rose-500 uppercase tracking-widest hover:bg-rose-500/20 transition-all">Sell Market</button>
                        </div>
                    </>
                ) : (
                    <div className="py-4 text-center space-y-2">
                        <div className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em]">No Active Position</div>
                        <button className="w-full py-2.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:bg-indigo-500/20 transition-all">Initialize Trade</button>
                    </div>
                )}
            </div>
        </div>
    );
}
