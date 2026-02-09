"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateDrawdownCurve, formatPnL, DrawdownPoint } from "@/lib/api/journal-stats";
import { Transaction } from "@/lib/api/types";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface DrawdownWidgetProps {
    trades: Transaction[];
    initialCapital?: number;
    className?: string;
}

export function DrawdownWidget({ trades, initialCapital = 10000, className }: DrawdownWidgetProps) {
    const drawdownCurve = useMemo(() => {
        return generateDrawdownCurve(trades, initialCapital);
    }, [trades, initialCapital]);

    const maxDrawdown = useMemo(() => {
        if (drawdownCurve.length === 0) return { value: 0, percent: 0 };
        const max = drawdownCurve.reduce((max, p) => p.drawdown > max.drawdown ? p : max, drawdownCurve[0]);
        return {
            value: max.drawdown,
            percent: max.drawdownPercent
        };
    }, [drawdownCurve]);

    const currentDrawdown = drawdownCurve.length > 0
        ? drawdownCurve[drawdownCurve.length - 1]
        : { drawdown: 0, drawdownPercent: 0 };

    // Chart dimensions
    const width = 400;
    const height = 80;
    const padding = { top: 5, right: 10, bottom: 5, left: 10 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const maxDD = Math.max(maxDrawdown.value, 1);

    // Generate path
    const pathData = useMemo(() => {
        if (drawdownCurve.length < 2) return "";

        const points = drawdownCurve.map((point, i) => {
            const x = padding.left + (i / (drawdownCurve.length - 1)) * chartWidth;
            const y = padding.top + (point.drawdown / maxDD) * chartHeight;
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        });

        return points.join(' ');
    }, [drawdownCurve, chartWidth, chartHeight, maxDD]);

    // Fill path
    const fillPath = useMemo(() => {
        if (drawdownCurve.length < 2) return "";

        const points = drawdownCurve.map((point, i) => {
            const x = padding.left + (i / (drawdownCurve.length - 1)) * chartWidth;
            const y = padding.top + (point.drawdown / maxDD) * chartHeight;
            return `${x},${y}`;
        });

        const startX = padding.left;
        const endX = padding.left + chartWidth;

        return `M ${startX},${padding.top} L ${points.join(' L ')} L ${endX},${padding.top} Z`;
    }, [drawdownCurve, chartWidth, chartHeight, maxDD]);

    return (
        <Card className={cn("bg-zinc-900/50 border-white/10", className)}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Activity className="h-4 w-4 text-amber-500" />
                        Drawdown
                    </CardTitle>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-[10px] text-muted-foreground uppercase">Max DD</p>
                            <p className="text-sm font-bold text-red-500">
                                {maxDrawdown.percent.toFixed(1)}%
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-muted-foreground uppercase">Current</p>
                            <p className={cn(
                                "text-sm font-bold",
                                currentDrawdown.drawdown > 0 ? "text-red-500" : "text-emerald-500"
                            )}>
                                {currentDrawdown.drawdownPercent.toFixed(1)}%
                            </p>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-0">
                {drawdownCurve.length < 2 ? (
                    <div className="h-[80px] flex items-center justify-center text-muted-foreground text-sm">
                        Need trades to display drawdown
                    </div>
                ) : (
                    <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
                        {/* Gradient */}
                        <defs>
                            <linearGradient id="ddGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#de576f" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="#de576f" stopOpacity="0" />
                            </linearGradient>
                        </defs>

                        {/* Fill */}
                        <path
                            d={fillPath}
                            fill="url(#ddGradient)"
                        />

                        {/* Line */}
                        <path
                            d={pathData}
                            fill="none"
                            stroke="#de576f"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />

                        {/* Max drawdown line */}
                        {maxDrawdown.value > 0 && (
                            <>
                                <line
                                    x1={padding.left}
                                    y1={padding.top + chartHeight}
                                    x2={width - padding.right}
                                    y2={padding.top + chartHeight}
                                    stroke="#de576f"
                                    strokeWidth="1"
                                    strokeDasharray="2 2"
                                    opacity="0.5"
                                />
                                <text
                                    x={width - padding.right}
                                    y={padding.top + chartHeight - 4}
                                    textAnchor="end"
                                    className="fill-red-500 text-[8px] font-mono"
                                >
                                    Max: -${maxDrawdown.value.toFixed(0)}
                                </text>
                            </>
                        )}
                    </svg>
                )}
            </CardContent>
        </Card>
    );
}
