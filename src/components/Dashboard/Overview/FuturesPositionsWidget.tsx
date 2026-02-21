"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { Position } from "@/lib/api/types";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { cn } from "@/lib/utils";

interface FuturesPositionsWidgetProps {
    positions: Position[];
}

export function FuturesPositionsWidget({ positions }: FuturesPositionsWidgetProps) {
    // Sort by PnL desc
    const sortedPositions = [...positions].sort((a, b) => (b.pnl || 0) - (a.pnl || 0));

    return (
        <Card className="h-full bg-[#141318]/60 backdrop-blur-xl border-white/5 overflow-hidden flex flex-col">
            <CardHeader className="py-3 px-4 border-b border-white/5 flex flex-row items-center justify-between shrink-0">
                <CardTitle className="text-sm font-bold text-zinc-400 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-500" />
                    Active Futures
                    <span className="ml-2 bg-indigo-500/10 text-indigo-400 text-[10px] px-1.5 py-0.5 rounded-full border border-indigo-500/20">
                        {positions.length}
                    </span>
                </CardTitle>
                <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Live</span>
                </div>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto flex-1 custom-scrollbar">
                {positions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-500 opacity-50 min-h-[150px]">
                        <Activity className="w-8 h-8 mb-2" />
                        <p className="text-xs">No active positions</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        <AnimatePresence>
                            {sortedPositions.map((pos, i) => {
                                const isLong = pos.side === 'long';
                                const pnl = pos.pnl || 0;
                                const isProfitable = pnl >= 0;

                                return (
                                    <motion.div
                                        key={pos.symbol}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="p-3 hover:bg-white/5 transition-colors group cursor-pointer"
                                    >
                                        <div className="flex justify-between items-center mb-1">
                                            <div className="flex items-center gap-2">
                                                <TokenIcon symbol={pos.symbol} size={24} />
                                                <span className="font-bold text-sm text-white">{pos.symbol}</span>
                                                <span className={cn(
                                                    "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase",
                                                    isLong ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                                                )}>
                                                    {pos.side} {pos.leverage}x
                                                </span>
                                            </div>
                                            <div className={cn(
                                                "font-mono font-bold text-sm flex items-center gap-1",
                                                isProfitable ? "text-emerald-400" : "text-rose-400"
                                            )}>
                                                {pnl > 0 ? '+' : ''}{pnl.toFixed(2)}
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] text-zinc-500">
                                            <span>
                                                Size: <span className="text-zinc-300">{pos.size}</span>
                                            </span>
                                            <span className="flex items-center gap-1">
                                                Entry: <span className="text-zinc-300">${pos.entryPrice.toLocaleString()}</span>
                                                <span className="mx-1">•</span>
                                                Mark: <span className="text-zinc-300">${pos.markPrice?.toLocaleString()}</span>
                                            </span>
                                        </div>
                                        {/* Progress Bar for ROE Visual if needed, maybe overkill */}
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
