"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateSessionStats, formatPnL, SessionStats, TradingSubStats } from "@/lib/api/journal-stats";
import { Transaction } from "@/lib/api/types";
import { Globe, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface TradingSessionWidgetProps {
    trades: Transaction[];
    className?: string;
}

interface SessionBarProps {
    label: string;
    timeRange: string;
    stats: TradingSubStats;
    color: string;
    maxCount: number;
}

function SessionBar({ label, timeRange, stats, color, maxCount }: SessionBarProps) {
    const width = maxCount > 0 ? (stats.count / maxCount) * 100 : 0;
    const winRatePercent = stats.winRate * 100;

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{label}</span>
                    <span className="text-[10px] text-muted-foreground">{timeRange}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                    <span className="font-mono">{stats.count} trades</span>
                    <span className={cn(
                        "font-bold font-mono",
                        winRatePercent >= 50 ? "text-emerald-500" : "text-amber-500"
                    )}>
                        {winRatePercent.toFixed(0)}%
                    </span>
                    <span className={cn(
                        "font-bold font-mono min-w-[70px] text-right",
                        stats.totalPnL >= 0 ? "text-emerald-500" : "text-red-500"
                    )}>
                        {formatPnL(stats.totalPnL)}
                    </span>
                </div>
            </div>

            {/* Bar */}
            <div className="h-8 bg-zinc-800/50 rounded-lg overflow-hidden relative">
                <motion.div
                    className="h-full rounded-lg flex items-center px-3"
                    style={{ background: `linear-gradient(90deg, ${color}40, ${color}90)` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${width}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                >
                    {width > 20 && (
                        <span className="text-[10px] font-bold text-white/90 uppercase tracking-wider">
                            Win: {winRatePercent.toFixed(0)}%
                        </span>
                    )}
                </motion.div>
            </div>
        </div>
    );
}

export function TradingSessionWidget({ trades, className }: TradingSessionWidgetProps) {
    const sessionStats = useMemo(() => calculateSessionStats(trades), [trades]);

    const sessions = [
        {
            label: "🇯🇵 Asia",
            timeRange: "00:00 - 08:00 UTC",
            stats: sessionStats.asia,
            color: "#f59e0b", // Yellow/Orange
        },
        {
            label: "🇬🇧 London",
            timeRange: "08:00 - 16:00 UTC",
            stats: sessionStats.london,
            color: "#3b82f6", // Blue
        },
        {
            label: "🇺🇸 New York",
            timeRange: "13:00 - 21:00 UTC",
            stats: sessionStats.newYork,
            color: "#10b981", // Green
        },
        {
            label: "🔄 Overlap",
            timeRange: "13:00 - 16:00 UTC",
            stats: sessionStats.overlap,
            color: "#a855f7", // Purple
        },
    ];

    const maxCount = Math.max(...sessions.map(s => s.stats.count), 1);

    // Find best session by avg PnL
    const bestSession = sessions.reduce((best, s) =>
        s.stats.avgPnL > best.stats.avgPnL ? s : best
        , sessions[0]);

    return (
        <Card className={cn("bg-zinc-900/50 border-white/10", className)}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Globe className="h-4 w-4 text-indigo-500" />
                        Trading Sessions
                    </CardTitle>
                    {trades.length > 0 && (
                        <div className="text-[10px]">
                            <span className="text-muted-foreground">Best: </span>
                            <span className="text-emerald-500 font-bold">{bestSession.label.replace(/[🇯🇵🇬🇧🇺🇸🔄]\s/, '')}</span>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className="pt-0">
                {trades.length === 0 ? (
                    <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
                        No trades to analyze
                    </div>
                ) : (
                    <div className="space-y-4">
                        {sessions.map((session, i) => (
                            <SessionBar
                                key={i}
                                {...session}
                                maxCount={maxCount}
                            />
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
