"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateHourlyStats, formatPnL, HourlyStats } from "@/lib/api/journal-stats";
import { Transaction } from "@/lib/api/types";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimeOfDayWidgetProps {
    trades: Transaction[];
    className?: string;
}

function getHeatColor(value: number, min: number, max: number): string {
    if (max === min || value === 0) return '#27272a'; // zinc-800

    const normalized = (value - min) / (max - min) || 0;

    if (value > 0) {
        // Green gradient
        const intensity = Math.round(normalized * 100);
        return `rgba(101, 196, 157, ${0.2 + intensity * 0.008})`;
    } else {
        // Red gradient
        const intensity = Math.round(Math.abs(normalized) * 100);
        return `rgba(222, 87, 111, ${0.2 + intensity * 0.008})`;
    }
}

export function TimeOfDayWidget({ trades, className }: TimeOfDayWidgetProps) {
    const hourlyStats = useMemo(() => calculateHourlyStats(trades), [trades]);

    const hours = Array.from({ length: 24 }, (_, i) => i);
    const pnlValues = hours.map(h => hourlyStats[h].totalPnL);
    const maxPnL = Math.max(...pnlValues, 0.01);
    const minPnL = Math.min(...pnlValues, -0.01);

    // Find best hour
    const bestHour = hours.reduce((best, h) =>
        hourlyStats[h].totalPnL > hourlyStats[best].totalPnL ? h : best
        , 0);

    const formatHour = (hour: number) => {
        if (hour === 0) return '12am';
        if (hour === 12) return '12pm';
        return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
    };

    return (
        <Card className={cn("bg-zinc-900/50 border-white/10", className)}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Clock className="h-4 w-4 text-pink-500" />
                        Time of Day Performance
                    </CardTitle>
                    {trades.length > 0 && (
                        <div className="text-[10px]">
                            <span className="text-muted-foreground">Best Hour: </span>
                            <span className="text-emerald-500 font-bold">{formatHour(bestHour)}</span>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className="pt-0">
                {trades.length === 0 ? (
                    <div className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">
                        No trades to analyze
                    </div>
                ) : (
                    <div className="space-y-2">
                        {/* Hour grid */}
                        <div className="grid grid-cols-12 gap-1">
                            {hours.slice(0, 12).map((hour) => {
                                const stats = hourlyStats[hour];
                                return (
                                    <div
                                        key={hour}
                                        className="relative group"
                                    >
                                        <div
                                            className="aspect-square rounded-sm flex items-center justify-center text-[10px] font-mono transition-transform hover:scale-110 cursor-pointer"
                                            style={{
                                                background: getHeatColor(stats.totalPnL, minPnL, maxPnL),
                                                border: stats.count > 0 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                                            }}
                                        >
                                            {stats.count > 0 ? stats.count : ''}
                                        </div>

                                        {/* Tooltip */}
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                                            <div className="bg-zinc-900 border border-white/10 rounded-lg p-2 shadow-xl whitespace-nowrap">
                                                <p className="text-xs font-bold">{formatHour(hour)}</p>
                                                <p className="text-[10px] text-muted-foreground">{stats.count} trades</p>
                                                <p className={cn(
                                                    "text-xs font-mono",
                                                    stats.totalPnL >= 0 ? "text-emerald-500" : "text-red-500"
                                                )}>
                                                    {formatPnL(stats.totalPnL)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Hour labels - AM */}
                        <div className="grid grid-cols-12 gap-1 text-[8px] text-muted-foreground text-center">
                            {hours.slice(0, 12).map((hour) => (
                                <div key={hour}>{formatHour(hour)}</div>
                            ))}
                        </div>

                        {/* Second row: PM hours */}
                        <div className="grid grid-cols-12 gap-1 mt-3">
                            {hours.slice(12).map((hour) => {
                                const stats = hourlyStats[hour];
                                return (
                                    <div
                                        key={hour}
                                        className="relative group"
                                    >
                                        <div
                                            className="aspect-square rounded-sm flex items-center justify-center text-[10px] font-mono transition-transform hover:scale-110 cursor-pointer"
                                            style={{
                                                background: getHeatColor(stats.totalPnL, minPnL, maxPnL),
                                                border: stats.count > 0 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                                            }}
                                        >
                                            {stats.count > 0 ? stats.count : ''}
                                        </div>

                                        {/* Tooltip */}
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                                            <div className="bg-zinc-900 border border-white/10 rounded-lg p-2 shadow-xl whitespace-nowrap">
                                                <p className="text-xs font-bold">{formatHour(hour)}</p>
                                                <p className="text-[10px] text-muted-foreground">{stats.count} trades</p>
                                                <p className={cn(
                                                    "text-xs font-mono",
                                                    stats.totalPnL >= 0 ? "text-emerald-500" : "text-red-500"
                                                )}>
                                                    {formatPnL(stats.totalPnL)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Hour labels - PM */}
                        <div className="grid grid-cols-12 gap-1 text-[8px] text-muted-foreground text-center">
                            {hours.slice(12).map((hour) => (
                                <div key={hour}>{formatHour(hour)}</div>
                            ))}
                        </div>

                        {/* Legend */}
                        <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-muted-foreground">
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded-sm bg-red-500/50" />
                                <span>Loss</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded-sm bg-zinc-700" />
                                <span>No trades</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded-sm bg-emerald-500/50" />
                                <span>Profit</span>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
