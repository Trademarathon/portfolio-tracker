"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { JournalTrade, JournalStats, useJournal } from "@/contexts/JournalContext";
import { getDay } from "date-fns";
import { Info } from "lucide-react";

interface DayReportProps {
    trades: JournalTrade[];
    stats: JournalStats;
}

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function DayReport({ trades, stats }: DayReportProps) {
    const { preferences } = useJournal();
    const [activeTab, setActiveTab] = useState<"report" | "leaderboard">("report");

    const today = new Date();
    const dayOfWeek = getDay(today);
    const dayName = dayNames[dayOfWeek];

    // Calculate stats for this day of week across all trades
    const dayStats = useMemo(() => {
        const dayTrades = trades.filter(t => getDay(new Date(t.timestamp)) === dayOfWeek);
        const closedDayTrades = dayTrades.filter(t => !t.isOpen);
        
        const wins = closedDayTrades.filter(t => (t.realizedPnl || 0) > 0);
        const losses = closedDayTrades.filter(t => (t.realizedPnl || 0) < 0);
        
        const totalPnl = closedDayTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
        const avgPnl = closedDayTrades.length > 0 ? totalPnl / closedDayTrades.length : 0;
        const winRate = closedDayTrades.length > 0 ? (wins.length / closedDayTrades.length) * 100 : 0;

        return {
            totalTrades: closedDayTrades.length,
            wins: wins.length,
            losses: losses.length,
            totalPnl,
            avgPnl,
            winRate,
        };
    }, [trades, dayOfWeek]);

    // Format currency
    const formatPnL = (value: number) => {
        if (preferences.hideBalances) return "••••";
        return `$${Math.abs(value).toFixed(2)}`;
    };

    // Comparison text
    const comparisonText = useMemo(() => {
        const diff = dayStats.avgPnl - stats.avgPnl;
        const isHigher = diff >= 0;
        return {
            text: `Trades opened on ${dayName}s have an average PnL of $${Math.abs(dayStats.avgPnl).toFixed(2)} which is ${isHigher ? 'higher' : 'lower'} than your overall average PnL of $${Math.abs(stats.avgPnl).toFixed(2)} per trade.`,
            isHigher,
        };
    }, [dayStats, stats, dayName]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16 }}
            className="neo-card p-6 rounded-2xl bg-zinc-900/40 border border-white/10 h-full flex flex-col"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white">{dayName} Report</h3>
                <div className="group relative">
                    <Info className="w-4 h-4 text-zinc-500 cursor-help" />
                    <div className="absolute right-0 top-full mt-2 w-64 p-3 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        A simple breakdown of your performance on the current weekday
                    </div>
                </div>
            </div>

            {/* Average PnL */}
            <div className="mb-4">
                <p className="text-xs text-zinc-500 mb-1">Average Total PnL on {dayName}s</p>
                <p className={cn(
                    "text-3xl font-black",
                    dayStats.avgPnl >= 0 ? "text-emerald-400" : "text-rose-400"
                )}>
                    {formatPnL(dayStats.avgPnl)}
                </p>
            </div>

            {/* Comparison text */}
            <p className="text-xs text-zinc-500 mb-6 leading-relaxed">
                {comparisonText.text}
            </p>

            {/* Win Rate Section */}
            <div className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl p-4">
                <h4 className="text-sm font-bold text-white mb-4">{dayName} Win Rate</h4>
                
                <div className="flex items-center gap-6">
                    {/* Donut Chart */}
                    <div className="relative w-24 h-24">
                        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
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
                                strokeDasharray={`${dayStats.winRate * 0.88} 88`}
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
                                strokeDasharray={`${(100 - dayStats.winRate) * 0.88} 88`}
                                strokeDashoffset={`${-dayStats.winRate * 0.88}`}
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-lg font-bold text-white">{Math.round(dayStats.winRate)}%</span>
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="space-y-3">
                        <div>
                            <p className="text-xs text-zinc-500">Winning trades</p>
                            <p className="text-xl font-black text-emerald-400">{dayStats.wins}</p>
                        </div>
                        <div>
                            <p className="text-xs text-zinc-500">Losing trades</p>
                            <p className="text-xl font-black text-rose-400">{dayStats.losses}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                    onClick={() => setActiveTab("report")}
                    className={cn(
                        "py-2.5 rounded-lg text-xs font-bold transition-colors",
                        activeTab === "report"
                            ? "bg-zinc-800 text-white"
                            : "text-zinc-500 hover:text-zinc-300"
                    )}
                >
                    Day Report
                </button>
                <button
                    onClick={() => setActiveTab("leaderboard")}
                    className={cn(
                        "py-2.5 rounded-lg text-xs font-bold transition-colors",
                        activeTab === "leaderboard"
                            ? "bg-zinc-800 text-white"
                            : "text-zinc-500 hover:text-zinc-300"
                    )}
                >
                    Leaderboard
                </button>
            </div>
        </motion.div>
    );
}
