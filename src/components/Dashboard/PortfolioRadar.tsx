"use client";

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";

const data = [
    { subject: 'DeFi', A: 120, fullMark: 150 },
    { subject: 'L1s', A: 98, fullMark: 150 },
    { subject: 'Gaming', A: 86, fullMark: 150 },
    { subject: 'AI', A: 99, fullMark: 150 },
    { subject: 'Meme', A: 85, fullMark: 150 },
    { subject: 'Infra', A: 65, fullMark: 150 },
];

export function PortfolioRadar() {
    return (
        <div className="h-[250px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
                    <PolarGrid stroke="#3f3f46" strokeDasharray="3 3" />
                    <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fill: '#a1a1aa', fontSize: 10 }}
                    />
                    <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
                    <Radar
                        name="Allocation"
                        dataKey="A"
                        stroke="#22c55e"
                        strokeWidth={2}
                        fill="#22c55e"
                        fillOpacity={0.3}
                    />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
}
