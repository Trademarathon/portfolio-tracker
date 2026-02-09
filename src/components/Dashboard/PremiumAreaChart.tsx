"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { formatCurrency } from "@/lib/utils";
import { useState } from "react";
import { cn } from "@/lib/utils";

const mockData = [
    { date: "00:00", value: 42000 },
    { date: "04:00", value: 43500 },
    { date: "08:00", value: 46200 },
    { date: "12:00", value: 45800 },
    { date: "16:00", value: 47100 },
    { date: "20:00", value: 48500 },
    { date: "24:00", value: 49200 },
];

export function PremiumAreaChart() {
    const [timeRange, setTimeRange] = useState("24H");

    const ranges = ["1H", "24H", "7D", "1M", "1Y"];

    return (
        <div className="relative h-full flex flex-col bg-[#141318] border border-white/5 rounded-xl p-6 overflow-hidden">
            {/* Header */}
            <div className="flex flex-row justify-between items-center mb-6 z-10">
                <div>
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest font-urbanist mb-1">Portfolio Performance</h3>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-white font-urbanist">$49,200.00</span>
                        <span className="text-emerald-400 text-sm font-bold bg-emerald-500/10 px-2 py-0.5 rounded">+17.1%</span>
                    </div>
                </div>
                <div className="flex bg-zinc-900/50 p-1 rounded-lg border border-white/5">
                    {ranges.map(range => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={cn(
                                "px-3 py-1 text-xs font-bold rounded-md transition-all",
                                timeRange === range
                                    ? "bg-white/10 text-white shadow-sm"
                                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                            )}
                        >
                            {range}
                        </button>
                    ))}
                </div>
            </div>

            {/* Chart */}
            <div className="flex-1 w-full min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={mockData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#7F6AFF" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#7F6AFF" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis
                            dataKey="date"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                            dy={10}
                        />
                        <YAxis
                            hide={false}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                            tickFormatter={(value: number) => `$${value / 1000}k`}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#18181b',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '12px',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                            }}
                            itemStyle={{ color: '#fff' }}
                            labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
                            formatter={(value: any) => [formatCurrency(Number(value) || 0), "Value"]}
                        />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#7F6AFF"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorValue)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
