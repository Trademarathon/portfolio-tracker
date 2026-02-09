"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateDayOfWeekStats, formatPnL, DayOfWeekStats, TradingSubStats } from "@/lib/api/journal-stats";
import { Transaction } from "@/lib/api/types";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface DayOfWeekWidgetProps {
    trades: Transaction[];
    className?: string;
}

interface DayBarProps {
    day: string;
    shortDay: string;
    stats: TradingSubStats;
    maxPnL: number;
    minPnL: number;
}

function DayBar({ day, shortDay, stats, maxPnL, minPnL }: DayBarProps) {
    const range = Math.max(Math.abs(maxPnL), Math.abs(minPnL)) || 1;
    const height = Math.abs(stats.totalPnL) / range * 100;
    const isPositive = stats.totalPnL >= 0;
    const winRatePercent = stats.winRate * 100;

    return (
        <div className="flex flex-col items-center">
            {/* Stats tooltip area */}
            <div className="text-center mb-2 min-h-[40px]">
                <p className={cn(
                    "text-xs font-bold font-mono",
                    isPositive ? "text-emerald-500" : "text-red-500"
                )}>
                    {formatPnL(stats.totalPnL)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                    {stats.count} trades
                </p>
            </div>

            {/* Bar chart area */}
            <div className="relative h-[100px] w-full flex items-end justify-center">
                {/* Zero line */}
                <div className="absolute top-1/2 left-0 right-0 h-px bg-zinc-700" />

                {/* Bar */}
                {stats.count > 0 && (
                    <motion.div
                        className={cn(
                            "w-6 rounded-sm",
                            isPositive ? "bg-emerald-500/80" : "bg-red-500/80"
                        )}
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.min(height, 48)}%` }}
                        transition={{ duration: 0.3, delay: 0.05 }}
                        style={{
                            [isPositive ? 'bottom' : 'top']: '50%',
                            position: 'absolute',
                        }}
                    />
                )}
            </div>

            {/* Day label */}
            <div className="mt-2 text-center">
                <p className="text-xs font-bold">{shortDay}</p>
                <p className={cn(
                    "text-[10px]",
                    winRatePercent >= 50 ? "text-emerald-500" : "text-amber-500"
                )}>
                    {winRatePercent.toFixed(0)}%
                </p>
            </div>
        </div>
    );
}

export function DayOfWeekWidget({ trades, className }: DayOfWeekWidgetProps) {
    const dayStats = useMemo(() => calculateDayOfWeekStats(trades), [trades]);

    const days: { key: keyof DayOfWeekStats; label: string; short: string }[] = [
        { key: 'monday', label: 'Monday', short: 'Mon' },
        { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
        { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
        { key: 'thursday', label: 'Thursday', short: 'Thu' },
        { key: 'friday', label: 'Friday', short: 'Fri' },
        { key: 'saturday', label: 'Saturday', short: 'Sat' },
        { key: 'sunday', label: 'Sunday', short: 'Sun' },
    ];

    const pnlValues = days.map(d => dayStats[d.key].totalPnL);
    const maxPnL = Math.max(...pnlValues, 0);
    const minPnL = Math.min(...pnlValues, 0);

    // Find best and worst days
    const sortedDays = [...days].sort((a, b) =>
        dayStats[b.key].totalPnL - dayStats[a.key].totalPnL
    );
    const bestDay = sortedDays[0];
    const worstDay = sortedDays[sortedDays.length - 1];

    return (
        <Card className={cn("bg-zinc-900/50 border-white/10", className)}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-orange-500" />
                        Day of Week Performance
                    </CardTitle>
                    {trades.length > 0 && (
                        <div className="flex gap-3 text-[10px]">
                            <span>
                                <span className="text-muted-foreground">Best: </span>
                                <span className="text-emerald-500 font-bold">{bestDay.short}</span>
                            </span>
                            <span>
                                <span className="text-muted-foreground">Worst: </span>
                                <span className="text-red-500 font-bold">{worstDay.short}</span>
                            </span>
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
                    <div className="grid grid-cols-7 gap-1">
                        {days.map((day) => (
                            <DayBar
                                key={day.key}
                                day={day.label}
                                shortDay={day.short}
                                stats={dayStats[day.key]}
                                maxPnL={maxPnL}
                                minPnL={minPnL}
                            />
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
