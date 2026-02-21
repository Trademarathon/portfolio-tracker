"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { JournalTrade, useJournal } from "@/contexts/JournalContext";
import { format } from "date-fns";

interface PnLChartProps {
    trades: JournalTrade[];
}

export function PnLChart({ trades }: PnLChartProps) {
    const { preferences } = useJournal();

    // Generate equity curve data
    const equityCurve = useMemo(() => {
        if (trades.length === 0) return [];
        
        const sortedTrades = [...trades].sort((a, b) => a.timestamp - b.timestamp);
        let cumulative = 0;
        
        return sortedTrades.map(t => {
            cumulative += t.realizedPnl || 0;
            return {
                timestamp: t.timestamp,
                pnl: t.realizedPnl || 0,
                cumulative,
            };
        });
    }, [trades]);

    // Calculate chart dimensions
    const width = 1000;
    const height = 200;
    const padding = { top: 20, right: 20, bottom: 30, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Calculate scales
    const { pathData, fillPath, minPnL, maxPnL } = useMemo(() => {
        if (equityCurve.length < 2) {
            return { pathData: "", fillPath: "", minPnL: 0, maxPnL: 0 };
        }

        const values = equityCurve.map(p => p.cumulative);
        const minPnL = Math.min(0, ...values);
        const maxPnL = Math.max(0, ...values);
        const range = maxPnL - minPnL || 1;

        const points = equityCurve.map((point, i) => {
            const x = padding.left + (i / (equityCurve.length - 1)) * chartWidth;
            const y = padding.top + chartHeight - ((point.cumulative - minPnL) / range) * chartHeight;
            return { x, y };
        });

        const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

        const zeroY = padding.top + chartHeight - ((0 - minPnL) / range) * chartHeight;
        const fillPath = `M ${padding.left},${zeroY} ${points.map(p => `L ${p.x},${p.y}`).join(' ')} L ${padding.left + chartWidth},${zeroY} Z`;

        return { pathData, fillPath, minPnL, maxPnL };
    }, [equityCurve, chartWidth, chartHeight, padding.left, padding.top]);

    // Format values for display
    const formatPnL = (value: number) => {
        if (preferences.hideBalances) return "••••";
        const prefix = value >= 0 ? '+' : '';
        return `${prefix}$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Date range display
    const dateRangeText = useMemo(() => {
        if (equityCurve.length === 0) return "";
        const start = format(equityCurve[0].timestamp, "MMM d, yyyy");
        const end = format(equityCurve[equityCurve.length - 1].timestamp, "MMM d, yyyy");
        return `${start} - ${end}`;
    }, [equityCurve]);

    // Total PnL
    const totalPnL = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].cumulative : 0;
    const isProfit = totalPnL >= 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16 }}
            className="neo-card neo-card-cool p-6 rounded-2xl bg-zinc-900/40 border border-white/10"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="title-md text-zinc-500">Lifetime PnL</h3>
                    <p className={cn(
                        "neo-digits text-2xl font-black mt-1",
                        isProfit ? "text-emerald-400" : "text-rose-400"
                    )}>
                        {formatPnL(totalPnL)}
                    </p>
                </div>
                <span className="text-xs text-zinc-500">{dateRangeText}</span>
            </div>

            {/* Chart */}
            {equityCurve.length >= 2 ? (
                <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={isProfit ? "#10b981" : "#ef4444"} stopOpacity="0.3" />
                            <stop offset="100%" stopColor={isProfit ? "#10b981" : "#ef4444"} stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    {/* Grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                        const y = padding.top + ratio * chartHeight;
                        return (
                            <line
                                key={i}
                                x1={padding.left}
                                y1={y}
                                x2={width - padding.right}
                                y2={y}
                                stroke="#27272a"
                                strokeWidth="1"
                            />
                        );
                    })}

                    {/* Zero line */}
                    <line
                        x1={padding.left}
                        y1={padding.top + chartHeight - ((0 - minPnL) / (maxPnL - minPnL || 1)) * chartHeight}
                        x2={width - padding.right}
                        y2={padding.top + chartHeight - ((0 - minPnL) / (maxPnL - minPnL || 1)) * chartHeight}
                        stroke="#52525b"
                        strokeWidth="1"
                        strokeDasharray="4,4"
                    />

                    {/* Fill */}
                    <path d={fillPath} fill="url(#pnlGradient)" />

                    {/* Line */}
                    <motion.path
                        d={pathData}
                        fill="none"
                        stroke={isProfit ? "#10b981" : "#ef4444"}
                        strokeWidth="2"
                        strokeLinecap="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                    />

                    {/* Y-axis labels */}
                    <text x={padding.left - 10} y={padding.top + 5} textAnchor="end" className="fill-zinc-500 text-[10px]">
                        {formatPnL(maxPnL)}
                    </text>
                    <text x={padding.left - 10} y={padding.top + chartHeight} textAnchor="end" className="fill-zinc-500 text-[10px]">
                        {formatPnL(minPnL)}
                    </text>
                </svg>
            ) : (
                <div className="h-[200px] flex items-center justify-center text-zinc-500 text-sm">
                    No trade data available
                </div>
            )}
        </motion.div>
    );
}
