"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useJournal } from "@/contexts/JournalContext";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { DollarSign, BarChart3, TrendingUp, TrendingDown } from "lucide-react";

export function StatsBar() {
    const { stats, filteredTrades, preferences } = useJournal();
    const { totalValue } = usePortfolio();

    // Prefer live portfolio balance from connected accounts.
    // Fall back to trade notional when no balance snapshot is available.
    const tradedNotional = useMemo(() => {
        return filteredTrades.reduce((sum, t) => {
            const cost = Number((t as unknown as { cost?: number }).cost || 0);
            return sum + (cost > 0 ? cost : (t.amount * t.price));
        }, 0);
    }, [filteredTrades]);
    const portfolioValue = totalValue > 0 ? totalValue : tradedNotional;

    // Format currency
    const formatValue = (value: number) => {
        if (preferences.hideBalances) return "••••••";
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    };

    const longRatio = stats.totalTrades > 0 
        ? (stats.longCount / stats.totalTrades) * 100 
        : 50;

    return (
        <div className="tm-widget-grid grid-cols-2 xl:grid-cols-4">
            {/* Portfolio Value */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16 }}
                className="neo-card neo-card-warm neo-float p-4 tm-widget-card"
            >
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center">
                        <DollarSign className="w-4 h-4 text-zinc-200" />
                    </div>
                    <span className="title-md text-zinc-500">Portfolio Value</span>
                </div>
                <p className="neo-digits text-2xl font-black text-white">{formatValue(portfolioValue)}</p>
                <p className="text-[11px] text-zinc-500 mt-1">
                    {totalValue > 0 ? "Live balance across connected accounts" : "Estimated from synced trade notional"}
                </p>
            </motion.div>

            {/* Win Rate */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16 }}
                className="neo-card neo-card-cool p-4 tm-widget-card"
            >
                <div className="flex items-center justify-between mb-3">
                    <span className="title-md text-zinc-500">Total Win Rate</span>
                </div>
                <div className="flex items-center gap-4">
                    {/* Donut Chart */}
                    <div className="relative w-16 h-16">
                        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                            {/* Background */}
                            <circle
                                cx="18"
                                cy="18"
                                r="14"
                                fill="none"
                                stroke="#27272a"
                                strokeWidth="4"
                            />
                            {/* Wins (green) */}
                            <circle
                                cx="18"
                                cy="18"
                                r="14"
                                fill="none"
                                stroke="#10b981"
                                strokeWidth="4"
                                strokeDasharray={`${stats.winRate * 0.88} 88`}
                                strokeLinecap="round"
                            />
                            {/* Losses (red) */}
                            <circle
                                cx="18"
                                cy="18"
                                r="14"
                                fill="none"
                                stroke="#ef4444"
                                strokeWidth="4"
                                strokeDasharray={`${(100 - stats.winRate - (stats.breakevenTrades / stats.totalTrades * 100 || 0)) * 0.88} 88`}
                                strokeDashoffset={`${-stats.winRate * 0.88}`}
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-sm font-bold text-white">{Math.round(stats.winRate)}%</span>
                        </div>
                    </div>
                    {/* Legend */}
                    <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                            <span className="text-emerald-400 font-bold">{stats.winningTrades}</span>
                            <span className="text-zinc-500">Wins</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-rose-400 font-bold">{stats.losingTrades}</span>
                            <span className="text-zinc-500">Losses</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-zinc-400 font-bold">{stats.breakevenTrades}</span>
                            <span className="text-zinc-500">Breakeven</span>
                        </div>
                    </div>
                </div>
                <button className="mt-3 text-[11px] text-emerald-400 hover:underline">
                    Set Breakeven filter ↗
                </button>
            </motion.div>

            {/* Total Trade Count */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16 }}
                className="neo-card p-4 tm-widget-card"
            >
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center">
                        <BarChart3 className="w-4 h-4 text-zinc-200" />
                    </div>
                    <span className="title-md text-zinc-500">Total Trade Count</span>
                </div>
                <p className="text-2xl font-black text-white">{stats.totalTrades}</p>
                <p className="text-[11px] text-zinc-500 mt-1">
                    Total volume of <span className="text-white font-medium">{formatValue(stats.totalVolume)}</span> with an average of{" "}
                    <span className="text-white font-medium">{formatValue(stats.totalVolume / (stats.totalTrades || 1))}</span> volume per trade
                </p>
            </motion.div>

            {/* Long Ratio / Short Ratio */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16 }}
                className="neo-card p-4 tm-widget-card"
            >
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        <span className="title-md text-zinc-500">Long Ratio</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="title-md text-zinc-500">Short Ratio</span>
                        <TrendingDown className="w-4 h-4 text-rose-400" />
                    </div>
                </div>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xl font-black text-emerald-400">{longRatio.toFixed(1)}%</span>
                    <span className="text-xl font-black text-rose-400">{(100 - longRatio).toFixed(1)}%</span>
                </div>
                {/* Progress bar */}
                <div className="h-2 rounded-full overflow-hidden flex">
                    <div 
                        className="h-full bg-emerald-500 transition-all duration-[180ms]"
                        style={{ width: `${longRatio}%` }}
                    />
                    <div 
                        className="h-full bg-rose-500 transition-all duration-[180ms]"
                        style={{ width: `${100 - longRatio}%` }}
                    />
                </div>
            </motion.div>
        </div>
    );
}
