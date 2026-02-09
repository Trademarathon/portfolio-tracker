"use client";

import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SessionData {
    pnl: number;
    count: number;
    wins: number;
}

interface DayOfWeekData extends SessionData {
    day: string;
}

interface TimeOfDayData extends SessionData {
    hour: number;
}

interface SessionAnalysisProps {
    dayOfWeek: DayOfWeekData[];
    timeOfDay: TimeOfDayData[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const winRate = data.count > 0 ? (data.wins / data.count) * 100 : 0;
        return (
            <div className="bg-zinc-900 border border-white/10 p-3 rounded-lg shadow-xl outline-none">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">{label}</p>
                <p className={`text-sm font-bold ${data.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {data.pnl >= 0 ? '+' : ''}${data.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <div className="mt-2 pt-2 border-t border-white/5 flex flex-col gap-1">
                    <p className="text-[10px] text-zinc-400 flex justify-between gap-4">
                        <span>Trades:</span> <span className="text-zinc-200">{data.count}</span>
                    </p>
                    <p className="text-[10px] text-zinc-400 flex justify-between gap-4">
                        <span>Win Rate:</span> <span className="text-zinc-200">{winRate.toFixed(1)}%</span>
                    </p>
                </div>
            </div>
        );
    }
    return null;
};

export default function SessionAnalysis({ dayOfWeek, timeOfDay }: SessionAnalysisProps) {
    return (
        <div className="grid gap-4 md:grid-cols-2">
            {/* Day of Week PNL */}
            <Card className="bg-zinc-900/50 border-white/5 overflow-hidden">
                <CardHeader className="pb-2">
                    <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Day of Week Performance</CardTitle>
                </CardHeader>
                <CardContent className="h-[250px] p-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dayOfWeek} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                            <XAxis
                                dataKey="day"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#71717a', fontSize: 10 }}
                            />
                            <YAxis hide />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff05' }} />
                            <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                                {dayOfWeek.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.6} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Time of Day PNL */}
            <Card className="bg-zinc-900/50 border-white/5 overflow-hidden">
                <CardHeader className="pb-2">
                    <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Time of Day (UTC)</CardTitle>
                </CardHeader>
                <CardContent className="h-[250px] p-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={timeOfDay} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                            <XAxis
                                dataKey="hour"
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(h) => `${h}:00`}
                                tick={{ fill: '#71717a', fontSize: 10 }}
                            />
                            <YAxis hide />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff05' }} />
                            <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                                {timeOfDay.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.6} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
}
