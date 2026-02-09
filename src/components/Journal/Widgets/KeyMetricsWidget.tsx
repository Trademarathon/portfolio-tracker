"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateTradingStats, formatPnL, TradingStats } from "@/lib/api/journal-stats";
import { Transaction } from "@/lib/api/types";
import {
    Target,
    TrendingUp,
    TrendingDown,
    Scale,
    Clock,
    Zap,
    Shield,
    BarChart3
} from "lucide-react";
import { cn } from "@/lib/utils";

interface KeyMetricsWidgetProps {
    trades: Transaction[];
    className?: string;
}

interface MetricCardProps {
    label: string;
    value: string | number;
    subValue?: string;
    icon: React.ReactNode;
    color?: string;
    tooltip?: string;
}

function MetricCard({ label, value, subValue, icon, color = "text-primary" }: MetricCardProps) {
    return (
        <div className="bg-zinc-800/50 rounded-lg p-3 flex flex-col gap-1">
            <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                    {label}
                </span>
                <span className={cn("opacity-60", color)}>{icon}</span>
            </div>
            <div className={cn("text-lg font-bold font-mono", color)}>
                {value}
            </div>
            {subValue && (
                <span className="text-[10px] text-muted-foreground">{subValue}</span>
            )}
        </div>
    );
}

export function KeyMetricsWidget({ trades, className }: KeyMetricsWidgetProps) {
    const stats = useMemo(() => calculateTradingStats(trades), [trades]);

    const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;
    const formatRatio = (value: number) => {
        if (value === Infinity) return "∞";
        if (value === 0) return "0.00";
        return value.toFixed(2);
    };

    const metrics = [
        {
            label: "Win Rate",
            value: formatPercent(stats.winRate),
            subValue: `${stats.winningTrades}W / ${stats.losingTrades}L`,
            icon: <Target className="h-4 w-4" />,
            color: stats.winRate >= 0.5 ? "text-emerald-500" : "text-amber-500",
        },
        {
            label: "Profit Factor",
            value: formatRatio(stats.profitFactor),
            subValue: stats.profitFactor >= 1 ? "Profitable" : "Losing",
            icon: <Scale className="h-4 w-4" />,
            color: stats.profitFactor >= 1 ? "text-emerald-500" : "text-red-500",
        },
        {
            label: "Expectancy",
            value: formatPnL(stats.expectancy),
            subValue: "Per trade",
            icon: <Zap className="h-4 w-4" />,
            color: stats.expectancy >= 0 ? "text-emerald-500" : "text-red-500",
        },
        {
            label: "Sharpe Ratio",
            value: formatRatio(stats.sharpeRatio),
            subValue: stats.sharpeRatio >= 1 ? "Good" : stats.sharpeRatio >= 2 ? "Excellent" : "Below avg",
            icon: <BarChart3 className="h-4 w-4" />,
            color: stats.sharpeRatio >= 1 ? "text-emerald-500" : "text-amber-500",
        },
        {
            label: "Max Drawdown",
            value: `${stats.maxDrawdownPercent.toFixed(1)}%`,
            subValue: formatPnL(-stats.maxDrawdown),
            icon: <TrendingDown className="h-4 w-4" />,
            color: stats.maxDrawdownPercent <= 10 ? "text-emerald-500" : "text-red-500",
        },
        {
            label: "Avg Win",
            value: formatPnL(stats.avgWin),
            subValue: `Largest: ${formatPnL(stats.largestWin)}`,
            icon: <TrendingUp className="h-4 w-4" />,
            color: "text-emerald-500",
        },
        {
            label: "Avg Loss",
            value: formatPnL(-stats.avgLoss),
            subValue: `Largest: ${formatPnL(-stats.largestLoss)}`,
            icon: <TrendingDown className="h-4 w-4" />,
            color: "text-red-500",
        },
        {
            label: "Risk/Reward",
            value: stats.avgLoss > 0 ? `1:${(stats.avgWin / stats.avgLoss).toFixed(2)}` : "N/A",
            subValue: "Avg Win / Avg Loss",
            icon: <Shield className="h-4 w-4" />,
            color: stats.avgWin > stats.avgLoss ? "text-emerald-500" : "text-amber-500",
        },
    ];

    return (
        <Card className={cn("bg-zinc-900/50 border-white/10", className)}>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-blue-500" />
                    Key Metrics
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
                {trades.length === 0 ? (
                    <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                        No trades to analyze
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {metrics.map((metric, i) => (
                            <MetricCard key={i} {...metric} />
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
