"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateEquityCurve, formatPnL, getPnLColor, EquityCurvePoint } from "@/lib/api/journal-stats";
import { Transaction } from "@/lib/api/types";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface PnLCurveWidgetProps {
    trades: Transaction[];
    className?: string;
}

export function PnLCurveWidget({ trades, className }: PnLCurveWidgetProps) {
    const equityCurve = useMemo(() => {
        return generateEquityCurve(trades);
    }, [trades]);

    const totalPnL = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].cumulativePnL : 0;
    const isProfit = totalPnL >= 0;

    // Calculate min/max for scaling
    const minPnL = Math.min(0, ...equityCurve.map(p => p.cumulativePnL));
    const maxPnL = Math.max(0, ...equityCurve.map(p => p.cumulativePnL));
    const range = maxPnL - minPnL || 1;

    // Generate SVG path
    const width = 400;
    const height = 120;
    const padding = { top: 10, right: 10, bottom: 10, left: 10 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const pathData = useMemo(() => {
        if (equityCurve.length < 2) return "";

        const points = equityCurve.map((point, i) => {
            const x = padding.left + (i / (equityCurve.length - 1)) * chartWidth;
            const y = padding.top + chartHeight - ((point.cumulativePnL - minPnL) / range) * chartHeight;
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        });

        return points.join(' ');
    }, [equityCurve, chartWidth, chartHeight, minPnL, range]);

    // Generate fill path
    const fillPath = useMemo(() => {
        if (equityCurve.length < 2) return "";

        const zeroY = padding.top + chartHeight - ((0 - minPnL) / range) * chartHeight;

        const points = equityCurve.map((point, i) => {
            const x = padding.left + (i / (equityCurve.length - 1)) * chartWidth;
            const y = padding.top + chartHeight - ((point.cumulativePnL - minPnL) / range) * chartHeight;
            return `${x},${y}`;
        });

        const startX = padding.left;
        const endX = padding.left + chartWidth;

        return `M ${startX},${zeroY} L ${points.join(' L ')} L ${endX},${zeroY} Z`;
    }, [equityCurve, chartWidth, chartHeight, minPnL, range]);

    // Zero line position
    const zeroY = padding.top + chartHeight - ((0 - minPnL) / range) * chartHeight;

    return (
        <Card className={cn("bg-zinc-900/50 border-white/10", className)}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        {isProfit ? (
                            <TrendingUp className="h-4 w-4 text-emerald-500" />
                        ) : (
                            <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                        Equity Curve
                    </CardTitle>
                    <div className={cn(
                        "text-lg font-bold font-mono",
                        isProfit ? "text-emerald-500" : "text-red-500"
                    )}>
                        {formatPnL(totalPnL)}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-0">
                {equityCurve.length < 2 ? (
                    <div className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">
                        Need at least 2 trades to display curve
                    </div>
                ) : (
                    <div className="relative">
                        <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
                            {/* Gradient definition */}
                            <defs>
                                <linearGradient id="pnlGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor={isProfit ? "#65c49d" : "#de576f"} stopOpacity="0.3" />
                                    <stop offset="100%" stopColor={isProfit ? "#65c49d" : "#de576f"} stopOpacity="0" />
                                </linearGradient>
                            </defs>

                            {/* Zero line */}
                            <line
                                x1={padding.left}
                                y1={zeroY}
                                x2={width - padding.right}
                                y2={zeroY}
                                stroke="#3d3d3e"
                                strokeWidth="1"
                                strokeDasharray="4 4"
                            />

                            {/* Fill area */}
                            <path
                                d={fillPath}
                                fill="url(#pnlGradient)"
                            />

                            {/* Line */}
                            <path
                                d={pathData}
                                fill="none"
                                stroke={isProfit ? "#65c49d" : "#de576f"}
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />

                            {/* End point */}
                            {equityCurve.length > 0 && (
                                <circle
                                    cx={width - padding.right}
                                    cy={padding.top + chartHeight - ((totalPnL - minPnL) / range) * chartHeight}
                                    r="4"
                                    fill={isProfit ? "#65c49d" : "#de576f"}
                                />
                            )}
                        </svg>

                        {/* Labels */}
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                            <span>
                                {equityCurve.length > 0 && format(equityCurve[0].timestamp, 'MMM d')}
                            </span>
                            <span>{equityCurve.length} trades</span>
                            <span>
                                {equityCurve.length > 0 && format(equityCurve[equityCurve.length - 1].timestamp, 'MMM d')}
                            </span>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
