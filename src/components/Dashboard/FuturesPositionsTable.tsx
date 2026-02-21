"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Position } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import { Activity, AlertTriangle, ArrowUpRight, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { BarChart3 } from "lucide-react";

interface FuturesPositionsTableProps {
    positions: Position[];
}

export function FuturesPositionsTable({ positions }: FuturesPositionsTableProps) {
    const { setSelectedChart } = usePortfolio();

    if (!positions || positions.length === 0) {
        return (
            <Card className="border-white/10 bg-zinc-950/50 backdrop-blur-xl h-full flex flex-col justify-center items-center p-8">
                <div className="w-12 h-12 bg-zinc-900/50 rounded-full flex items-center justify-center mb-4 border border-white/5">
                    <Activity className="w-6 h-6 text-zinc-600" />
                </div>
                <h3 className="text-zinc-400 font-bold uppercase tracking-widest text-sm">No Open Positions</h3>
                <p className="text-zinc-600 text-xs mt-2">Futures & Perps will appear here.</p>
            </Card>
        );
    }

    // Sort positions by PnL (Winners first)
    const sortedPositions = [...positions].sort((a, b) => (b.pnl || 0) - (a.pnl || 0));

    return (
        <Card className="border-white/10 bg-zinc-950/50 backdrop-blur-xl overflow-hidden flex flex-col h-full">
            <CardHeader className="pb-2 border-b border-white/5 bg-white/5 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <CardTitle className="text-sm font-black uppercase tracking-widest text-zinc-300">
                        Active Positions <span className="text-zinc-600 text-[10px] ml-1">({positions.length})</span>
                    </CardTitle>
                </div>
                {/* Aggregate PnL Pill */}
                <div className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold font-mono border",
                    sortedPositions.reduce((sum, p) => sum + (p.pnl || 0), 0) >= 0
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                        : "bg-red-500/10 text-red-500 border-red-500/20"
                )}>
                    {sortedPositions.reduce((sum, p) => sum + (p.pnl || 0), 0) >= 0 ? "+" : ""}
                    {formatCurrency(sortedPositions.reduce((sum, p) => sum + (p.pnl || 0), 0))}
                </div>
            </CardHeader>
            <CardContent className="p-0 overflow-auto custom-scrollbar">
                <table className="w-full text-sm">
                    <thead className="text-[10px] font-bold text-zinc-500 uppercase bg-zinc-900/50 sticky top-0 z-10 backdrop-blur-md">
                        <tr>
                            <th className="px-4 py-3 text-left">Contract</th>
                            <th className="px-4 py-3 text-center">Side</th>
                            <th className="px-4 py-3 text-right">Size (USD)</th>
                            <th className="px-4 py-3 text-right">Entry</th>
                            <th className="px-4 py-3 text-right">Mark</th>
                            <th className="px-4 py-3 text-right">Liq. Price</th>
                            <th className="px-4 py-3 text-right">Unrealized PnL</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {sortedPositions.map((pos, idx) => {
                            const isLong = pos.side.toLowerCase() === 'long' || pos.size > 0;
                            const pnl = pos.pnl || 0;
                            const isProfit = pnl >= 0;

                            // Calculate leverage approximation (Size / Margin) if margin available, else hardcode/guess or skip
                            // For Hyperliquid, leverage is usually explicitly tracked, but we might default to "Cross" if unknown
                            const leverage = pos.leverage ? `${pos.leverage}x` : 'Cross';

                            // Liquidation Risk Calculation (Simple visual check)
                            const markPrice = pos.markPrice || 0;
                            const distToLiq = pos.liquidationPrice
                                ? Math.abs((markPrice - pos.liquidationPrice) / markPrice) * 100
                                : 100;
                            const isHighRisk = distToLiq < 10; // Less than 10% movement to liq

                            return (
                                <tr
                                    key={`${pos.symbol}-${idx}`}
                                    onClick={() => setSelectedChart({
                                        symbol: pos.symbol.split('-')[0], // Extract base symbol
                                        entryPrice: pos.entryPrice,
                                        side: pos.side
                                    })}
                                    className="group hover:bg-white/5 transition-colors cursor-pointer"
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <TokenIcon symbol={pos.symbol} size={24} />
                                            <div>
                                                <div className="font-bold text-white flex items-center gap-2">
                                                    {pos.symbol}
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-normal border border-white/5">
                                                        {leverage}
                                                    </span>
                                                    <BarChart3 className="h-3 w-3 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                                <div className="text-[10px] text-zinc-500">Perpetual</div>
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-4 py-3 text-center">
                                        <span className={cn(
                                            "px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider",
                                            isLong ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                                        )}>
                                            {isLong ? "Long" : "Short"}
                                        </span>
                                    </td>

                                    <td className="px-4 py-3 text-right font-mono text-zinc-300">
                                        ${Math.abs(pos.size * markPrice).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        <div className="text-[10px] text-zinc-500">{Math.abs(pos.size).toFixed(3)} {pos.symbol.split('-')[0]}</div>
                                    </td>

                                    <td className="px-4 py-3 text-right font-mono text-zinc-400">
                                        ${pos.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>

                                    <td className="px-4 py-3 text-right font-mono text-zinc-300">
                                        ${markPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>

                                    <td className="px-4 py-3 text-right">
                                        {pos.liquidationPrice ? (
                                            <div className="flex flex-col items-end">
                                                <span className={cn(
                                                    "font-mono",
                                                    isHighRisk ? "text-orange-500 font-bold animate-pulse" : "text-zinc-500"
                                                )}>
                                                    ${pos.liquidationPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </span>
                                                {isHighRisk && (
                                                    <span className="text-[9px] text-orange-500 flex items-center gap-1">
                                                        <AlertTriangle className="w-3 h-3" /> Risk
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-zinc-600 text-xs">-</span>
                                        )}
                                    </td>

                                    <td className="px-4 py-3 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className={cn(
                                                "font-bold font-mono text-sm",
                                                isProfit ? "text-emerald-500" : "text-red-500"
                                            )}>
                                                {isProfit ? "+" : ""}{formatCurrency(pnl)}
                                            </span>
                                            {/* ROI Calculation if possible, else hidden */}
                                            <span className={cn(
                                                "text-[10px]",
                                                isProfit ? "text-emerald-500/60" : "text-red-500/60"
                                            )}>
                                                {((pnl / (Math.abs(pos.size * pos.entryPrice) / (pos.leverage || 1))) * 100).toFixed(2)}% ROI
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </CardContent>
        </Card>
    );
}
