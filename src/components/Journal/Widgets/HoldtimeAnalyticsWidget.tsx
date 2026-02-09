"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateHoldtimeStats, formatPnL, formatHoldTime, HoldtimeStats, TradingSubStats } from "@/lib/api/journal-stats";
import { Transaction } from "@/lib/api/types";
import { Clock, Zap, Calendar, Timer, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface HoldtimeAnalyticsWidgetProps {
    trades: Transaction[];
    className?: string;
}

interface HoldtimeCategoryProps {
    label: string;
    description: string;
    stats: TradingSubStats;
    icon: React.ReactNode;
    gradientFrom: string;
    gradientTo: string;
}

function HoldtimeCategory({ label, description, stats, icon, gradientFrom, gradientTo }: HoldtimeCategoryProps) {
    const winRatePercent = stats.winRate * 100;

    return (
        <div
            className={cn(
                "relative overflow-hidden rounded-lg p-4",
                "bg-gradient-to-br border border-white/10"
            )}
            style={{
                background: `linear-gradient(135deg, ${gradientFrom}20, ${gradientTo}10)`
            }}
        >
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                    <div
                        className="p-2 rounded-lg"
                        style={{ background: `${gradientFrom}30` }}
                    >
                        {icon}
                    </div>
                    <div>
                        <h4 className="font-bold text-sm">{label}</h4>
                        <p className="text-[10px] text-muted-foreground">{description}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-lg font-bold font-mono">{stats.count}</p>
                    <p className="text-[10px] text-muted-foreground">trades</p>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
                <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Win Rate</p>
                    <p className={cn(
                        "text-sm font-bold font-mono",
                        winRatePercent >= 50 ? "text-emerald-500" : "text-amber-500"
                    )}>
                        {winRatePercent.toFixed(1)}%
                    </p>
                </div>
                <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Total PnL</p>
                    <p className={cn(
                        "text-sm font-bold font-mono",
                        stats.totalPnL >= 0 ? "text-emerald-500" : "text-red-500"
                    )}>
                        {formatPnL(stats.totalPnL)}
                    </p>
                </div>
                <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Avg PnL</p>
                    <p className={cn(
                        "text-sm font-bold font-mono",
                        stats.avgPnL >= 0 ? "text-emerald-500" : "text-red-500"
                    )}>
                        {formatPnL(stats.avgPnL)}
                    </p>
                </div>
            </div>

            {/* Win rate bar */}
            <div className="mt-3 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all"
                    style={{
                        width: `${winRatePercent}%`,
                        background: winRatePercent >= 50 ? '#65c49d' : '#f59e0b'
                    }}
                />
            </div>
        </div>
    );
}

export function HoldtimeAnalyticsWidget({ trades, className }: HoldtimeAnalyticsWidgetProps) {
    const holdtimeStats = useMemo(() => calculateHoldtimeStats(trades), [trades]);

    const categories = [
        {
            label: "Scalps",
            description: "< 1 hour",
            stats: holdtimeStats.scalp,
            icon: <Zap className="h-4 w-4 text-yellow-400" />,
            gradientFrom: "#facc15",
            gradientTo: "#fcd34d",
        },
        {
            label: "Day Trades",
            description: "1-24 hours",
            stats: holdtimeStats.dayTrade,
            icon: <Clock className="h-4 w-4 text-blue-400" />,
            gradientFrom: "#3b82f6",
            gradientTo: "#60a5fa",
        },
        {
            label: "Swing Trades",
            description: "1-7 days",
            stats: holdtimeStats.swing,
            icon: <Calendar className="h-4 w-4 text-purple-400" />,
            gradientFrom: "#a855f7",
            gradientTo: "#c084fc",
        },
        {
            label: "Position Trades",
            description: "> 7 days",
            stats: holdtimeStats.position,
            icon: <TrendingUp className="h-4 w-4 text-emerald-400" />,
            gradientFrom: "#10b981",
            gradientTo: "#34d399",
        },
    ];

    // Find best performing category
    const bestCategory = categories.reduce((best, cat) =>
        cat.stats.avgPnL > best.stats.avgPnL ? cat : best
        , categories[0]);

    return (
        <Card className={cn("bg-zinc-900/50 border-white/10", className)}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Timer className="h-4 w-4 text-cyan-500" />
                        Hold Time Analysis
                    </CardTitle>
                    {trades.length > 0 && (
                        <div className="text-[10px] text-right">
                            <span className="text-muted-foreground">Best: </span>
                            <span className="text-emerald-500 font-bold">{bestCategory.label}</span>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className="pt-0">
                {trades.length === 0 ? (
                    <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                        No trades to analyze
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {categories.map((cat, i) => (
                            <HoldtimeCategory key={i} {...cat} />
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
