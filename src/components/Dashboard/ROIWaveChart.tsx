"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const data = [
    { month: "Jan", roi: 20 },
    { month: "Feb", roi: 45 },
    { month: "Mar", roi: 35 },
    { month: "Apr", roi: 80 },
    { month: "May", roi: 65 },
    { month: "Jun", roi: 95 },
    { month: "Jul", roi: 85 },
    { month: "Aug", roi: 120 },
];

export function ROIWaveChart() {
    return (
        <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="colorRoi" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#71717a', fontSize: 10 }}
                    />
                    <YAxis hide />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'rgba(9, 9, 11, 0.8)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '12px',
                            backdropFilter: 'blur(12px)',
                        }}
                    />
                    <Area
                        type="monotone"
                        dataKey="roi"
                        stroke="#a855f7"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorRoi)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
