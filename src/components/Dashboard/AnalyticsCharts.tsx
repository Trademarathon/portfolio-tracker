"use client";

import React from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from 'date-fns';

interface ChartData {
    date: number;
    value: number;
}

interface AnalyticsChartsProps {
    pnlData: ChartData[];
    drawdownData: ChartData[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-zinc-900 border border-white/10 p-3 rounded-lg shadow-xl outline-none">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">
                    {format(new Date(label), 'MMM d, yyyy HH:mm')}
                </p>
                <p className={`text-sm font-bold ${payload[0].value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {payload[0].value >= 0 ? '+' : ''}${payload[0].value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
            </div>
        );
    }
    return null;
};

export default function AnalyticsCharts({ pnlData, drawdownData }: AnalyticsChartsProps) {
    return (
        <div className="space-y-4">
            {/* Lifetime PNL Chart */}
            <Card className="neo-card neo-card-cool bg-zinc-900/50 border-white/5 overflow-hidden">
                <CardHeader className="pb-0">
                    <CardTitle className="text-sm font-medium text-zinc-400">Lifetime PNL</CardTitle>
                </CardHeader>
                <CardContent className="p-0 h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={pnlData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorPnlRed" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                            <XAxis
                                dataKey="date"
                                hide
                            />
                            <YAxis
                                hide
                                domain={['auto', 'auto']}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <ReferenceLine y={0} stroke="#ffffff10" />
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke={pnlData[pnlData.length - 1]?.value >= 0 ? "#10b981" : "#ef4444"}
                                fillOpacity={1}
                                fill={`url(#${pnlData[pnlData.length - 1]?.value >= 0 ? 'colorPnl' : 'colorPnlRed'})`}
                                strokeWidth={2}
                                animationDuration={180}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Drawdown Chart */}
            <Card className="neo-card neo-card-warm bg-zinc-900/50 border-white/5 overflow-hidden">
                <CardHeader className="pb-0">
                    <CardTitle className="text-sm font-medium text-zinc-400">Drawdown ($)</CardTitle>
                </CardHeader>
                <CardContent className="p-0 h-[150px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={drawdownData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorDd" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                            <XAxis
                                dataKey="date"
                                hide
                            />
                            <YAxis
                                hide
                                domain={['auto', 0]}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke="#ef444480"
                                fillOpacity={1}
                                fill="url(#colorDd)"
                                strokeWidth={1}
                                animationDuration={180}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
}
