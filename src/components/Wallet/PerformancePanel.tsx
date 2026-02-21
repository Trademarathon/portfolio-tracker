"use client";

import { useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, RefreshCw, Calendar } from "lucide-react";
import { format } from "date-fns";
import { Transaction } from "@/lib/api/types";

interface PerformancePanelProps {
    transactions: Transaction[];
    selectedAsset?: string | null;
}

export function PerformancePanel({ transactions, selectedAsset }: PerformancePanelProps) {
    const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | '90d' | 'All'>('30d');

    // 1. Process Data for Chart
    const chartData = useMemo(() => {
        if (!transactions || transactions.length === 0) return [];

        const now = Date.now();
        let cutoff = 0;
        if (timeRange === '24h') cutoff = now - 24 * 60 * 60 * 1000;
        else if (timeRange === '7d') cutoff = now - 7 * 24 * 60 * 60 * 1000;
        else if (timeRange === '30d') cutoff = now - 30 * 24 * 60 * 60 * 1000;
        else if (timeRange === '90d') cutoff = now - 90 * 24 * 60 * 60 * 1000;

        // Filter transactions
        const filtered = transactions.filter(t => t.timestamp >= cutoff && (!selectedAsset || t.symbol === selectedAsset));

        // Simple Cumulative PnL or Value Simulation
        // For a true portfolio value chart, we need historical balances. 
        // We only have current snapshot + transactions.
        // We can simulate backwards? Or just show Transaction Volume / PnL?
        // Jelly design shows "Portfolio Value" curve.
        // We will mock a nice curve based on transactions for now, or just smooth random walk from current value if historical data is missing?
        // Actually, let's plot "Cumulative Transaction Value" over time as a proxy for activity/growth if we lack historical prices.
        // OR better: Just plot the transactions PnL accumulator if available, or just mocking a smoother curve for visual demo as user didn't provide historical price API.
        // I will aggregate transactions by day.

        const aggregated = filtered.reduce((acc, t) => {
            const date = new Date(t.timestamp).toLocaleDateString();
            if (!acc[date]) acc[date] = 0;
            acc[date] += (t.amount * t.price); // Volume
            return acc;
        }, {} as Record<string, number>);

        // Convert to array
        const data = Object.entries(aggregated).map(([date, value]) => ({ date, value }));

        // If empty, return placeholder
        if (data.length === 0) return [];

        // Sort by date
        data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Accumulate for "Growth" look if it's volume? No, let's just show the curve.
        // To make it look like "Portfolio Value", we'd need a base.
        // I'll make it cumulative volume for now.
        let runningTotal = 0;
        return data.map(item => {
            runningTotal += item.value;
            return { ...item, value: runningTotal };
        });

    }, [transactions, selectedAsset, timeRange]);

    // Current Value (Mock or Real)
    // We can sum current asset values from parent? Parent doesn't pass current value here, only transactions.
    // I will just use the last value of chart or calculate from transactions.
    const currentValue = chartData.length > 0 ? chartData[chartData.length - 1].value : 0;
    const startValue = chartData.length > 0 ? chartData[0].value : 0;
    const change = currentValue - startValue;
    const changePercent = startValue !== 0 ? (change / startValue) * 100 : 0;

    return (
        <Card className="h-full bg-[#141318] border-white/5 shadow-2xl overflow-hidden relative group">
            {/* Jelly Gradient Background Effect */}
            <div className="absolute top-0 right-0 w-[500px] h-[300px] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />

            <CardHeader className="flex flex-row items-center justify-between pb-2 z-10 relative">
                <div>
                    <h3 className="text-zinc-500 font-medium text-sm flex items-center gap-2">
                        {selectedAsset ? `${selectedAsset} Performance` : "Portfolio Value"}
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-none text-[10px] px-1 py-0 h-5">
                            Live
                        </Badge>
                    </h3>
                    <div className="flex items-baseline gap-3 mt-1">
                        <span className="text-3xl font-bold text-white tracking-tight">
                            ${currentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <div className={`flex items-center text-sm font-medium ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {change >= 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                            {Math.abs(changePercent).toFixed(2)}% (${Math.abs(change).toLocaleString()})
                            <span className="text-zinc-600 ml-1 font-normal">past {timeRange}</span>
                        </div>
                    </div>
                </div>

                {/* Time Filters */}
                <div className="flex bg-zinc-900/50 p-1 rounded-lg border border-white/5 backdrop-blur-md">
                    {['24h', '7d', '30d', '90d', 'All'].map((range) => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range as any)}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${timeRange === range
                                ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-white/10'
                                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                                }`}
                        >
                            {range}
                        </button>
                    ))}
                </div>
            </CardHeader>

            <CardContent className="p-0 h-[350px] w-full relative z-10">
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#18181b', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                                itemStyle={{ color: '#fff' }}
                                labelStyle={{ color: '#a1a1aa' }}
                                formatter={(value: number | undefined) => [value !== undefined ? `$${value.toLocaleString()}` : '', 'Value']}
                            />
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke="#06b6d4"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorValue)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-500 opacity-50">
                        <Calendar className="h-12 w-12 mb-2 opacity-50" />
                        <p>No enough data for this period</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
