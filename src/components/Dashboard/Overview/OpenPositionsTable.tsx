"use client";

import { Position } from "@/lib/api/types";
import { Card, CardHeader } from "@/components/ui/card";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { cn } from "@/lib/utils";
import { ArrowUpRight, MoreHorizontal, Share2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useState, memo } from "react";

interface OpenPositionsTableProps {
    positions: Position[];
    marketData?: Record<string, { funding: number, oi: number, volume24h: number, markPrice: number }>;
}

export const OpenPositionsTable = memo(({ positions, marketData = {} }: OpenPositionsTableProps) => {
    const [sortConfig, setSortConfig] = useState<{ key: keyof Position | 'pnl' | 'liqDist', direction: 'asc' | 'desc' }>({ key: 'pnl', direction: 'desc' });

    const sortedPositions = useMemo(() => {
        return [...positions].sort((a, b) => {
            let valA: number = 0;
            let valB: number = 0;

            if (sortConfig.key === 'pnl') {
                valA = a.pnl || 0;
                valB = b.pnl || 0;
            } else if (sortConfig.key === 'liqDist') {
                // Calculate distance to liquidation %
                const markA = a.markPrice || a.entryPrice;
                const markB = b.markPrice || b.entryPrice;
                const liqA = a.liquidationPrice || 0;
                const liqB = b.liquidationPrice || 0;

                valA = liqA > 0 ? Math.abs((markA - liqA) / markA) : 100;
                valB = liqB > 0 ? Math.abs((markB - liqB) / markB) : 100;
            } else {
                // @ts-ignore
                valA = a[sortConfig.key] || 0;
                // @ts-ignore
                valB = b[sortConfig.key] || 0;
            }

            return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
        });
    }, [positions, sortConfig]);

    const handleSort = (key: any) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    if (positions.length === 0) {
        return (
            <Card className="rounded-xl bg-gradient-to-br from-zinc-950/90 to-zinc-900/90 border-white/10 overflow-hidden transition-all duration-150 hover:border-white/15 neo-card neo-card-cool">
                <CardHeader className="py-3 px-4 border-b border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/20">
                            <Share2 className="w-4 h-4 text-emerald-400" />
                        </div>
                        <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Open Positions</h3>
                    </div>
                </CardHeader>
                <div className="h-[200px] flex flex-col items-center justify-center text-zinc-500 gap-2">
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                        <Share2 className="w-5 h-5 opacity-50" />
                    </div>
                    <p className="text-xs font-medium">No open positions</p>
                </div>
            </Card>
        )
    }

    return (
        <Card className="rounded-xl bg-gradient-to-br from-zinc-950/90 to-zinc-900/90 border-white/10 overflow-hidden transition-all duration-150 hover:border-white/15 neo-card neo-card-cool">
            <CardHeader className="py-3 px-4 border-b border-white/5 bg-white/[0.02] flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/20">
                        <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                    </div>
                    <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-widest">Open Positions <span className="text-zinc-500 ml-1">({positions.length})</span></h3>
                </div>

                {/* Optional: Add PnL summary here if space permits */}
            </CardHeader>

            <div
                className="overflow-x-auto overflow-y-auto"
                style={{
                    minHeight: `180px`,
                    maxHeight: `${Math.min(400, 110 + positions.length * 54)}px`,
                }}
            >
                <table className="dense-table w-full text-sm text-left">
                    <thead className="text-xs text-zinc-500 uppercase bg-white/5 font-mono">
                        <tr>
                            <th className="px-4 py-3 font-medium cursor-pointer hover:text-zinc-300" onClick={() => handleSort('symbol')}>Symbol</th>
                            <th className="px-4 py-3 font-medium text-right cursor-pointer hover:text-zinc-300" onClick={() => handleSort('size')}>Size (USD)</th>
                            <th className="px-4 py-3 font-medium text-right cursor-pointer hover:text-zinc-300" onClick={() => handleSort('entryPrice')}>Entry</th>
                            <th className="px-4 py-3 font-medium text-right cursor-pointer hover:text-zinc-300" onClick={() => handleSort('markPrice')}>Mark</th>
                            <th className="px-4 py-3 font-medium text-right cursor-pointer hover:text-zinc-300" onClick={() => handleSort('liqDist')}>Liq Price</th>
                            <th className="px-4 py-3 font-medium text-right">Funding</th>
                            <th className="px-4 py-3 font-medium text-right cursor-pointer hover:text-zinc-300" onClick={() => handleSort('pnl')}>Unrealized PnL</th>
                            <th className="px-4 py-3 w-[50px]"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        <AnimatePresence>
                            {sortedPositions.map((pos, idx) => {
                                const pnl = pos.pnl || 0;
                                const isProfit = pnl >= 0;
                                const mark = pos.markPrice || pos.entryPrice;
                                const sizeUsd = Math.abs(pos.size) * mark;
                                const liqPrice = pos.liquidationPrice || 0;

                                const symbolKey = pos.symbol.replace('-PERP', '');
                                const mData = marketData[symbolKey];
                                const fundingRate = mData ? mData.funding * 100 : 0;

                                // Calculate liquidation risk
                                const distToLiq = liqPrice > 0 ? Math.abs((mark - liqPrice) / mark) * 100 : 100;
                                const isLiqRisk = distToLiq < 5; // < 5% distance is risky

                                return (
                                    <motion.tr
                                        key={`${pos.connectionId || pos.exchange || 'na'}:${pos.symbol}:${pos.side}:${pos.entryPrice}:${idx}`}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        layout
                                        className="hover:bg-white/5 transition-colors group"
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <TokenIcon symbol={pos.symbol.replace(/USDT|PERP|-USD/g, '')} size={24} />
                                                <div>
                                                    <div className="font-bold text-zinc-100 flex items-center gap-2">
                                                        {pos.symbol}
                                                        <span className={cn(
                                                            "text-[10px] px-1 py-0.5 rounded uppercase font-black tracking-wider",
                                                            pos.side === 'long' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                                                        )}>
                                                            {pos.side} {pos.leverage}x
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-4 py-3 text-right font-mono text-zinc-300">
                                            ${sizeUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            <div className="text-[10px] text-zinc-500">{pos.size} Coins</div>
                                        </td>

                                        <td className="px-4 py-3 text-right font-mono text-zinc-400">
                                            ${pos.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>

                                        <td className="px-4 py-3 text-right font-mono text-zinc-300 font-bold">
                                            ${mark.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>

                                        <td className="px-4 py-3 text-right font-mono">
                                            {liqPrice > 0 ? (
                                                <div className="flex flex-col items-end">
                                                    <span className={cn(
                                                        "text-xs font-bold",
                                                        isLiqRisk ? "text-rose-500 animate-pulse-slow" : "text-zinc-400"
                                                    )}>
                                                        ${liqPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </span>
                                                    <span className={cn(
                                                        "text-[10px]",
                                                        isLiqRisk ? "text-rose-500 font-bold" : "text-zinc-600"
                                                    )}>
                                                        {distToLiq.toFixed(2)}% away
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-emerald-500 text-xs">Safe</span>
                                            )}
                                        </td>

                                        <td className="px-4 py-3 text-right font-mono">
                                            <span className={cn(
                                                "text-xs",
                                                fundingRate > 0 ? "text-rose-400" : fundingRate < 0 ? "text-emerald-400" : "text-zinc-500"
                                            )}>
                                                {fundingRate > 0 ? '+' : ''}{fundingRate.toFixed(4)}%
                                            </span>
                                        </td>

                                        <td className="px-4 py-3 text-right">
                                            <div className={cn(
                                                "font-black font-mono text-sm flex items-center justify-end gap-1",
                                                isProfit ? "text-emerald-400" : "text-rose-400"
                                            )}>
                                                {pnl > 0 ? '+' : ''}{pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </div>
                                            {/* We could calculate ROE if margin was available, assume margin based on leverage? */}
                                            {/* ROE = PnL / (Size / Leverage) */}
                                        </td>

                                        <td className="px-4 py-3 text-center">
                                            <button className="p-1 hover:bg-white/10 rounded-md text-zinc-500 hover:text-white transition-colors">
                                                <MoreHorizontal className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </motion.tr>
                                );
                            })}
                        </AnimatePresence>
                    </tbody>
                </table>
            </div>

        </Card>
    );
});
