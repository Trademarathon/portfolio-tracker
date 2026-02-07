"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PortfolioAsset } from '@/lib/api/types';

const COLORS = ['#8b5cf6', '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];

interface AllocationChartProps {
    assets: PortfolioAsset[];
}

export default function AllocationChart({ assets }: AllocationChartProps) {
    // Filter out small assets for cleaner chart
    const data = assets
        .filter(a => a.valueUsd > 0)
        .map(a => ({
            name: a.symbol,
            value: a.valueUsd
        }));

    if (data.length === 0) {
        return (
            <Card className="border-white/10 bg-card/50 backdrop-blur-sm h-full flex items-center justify-center min-h-[300px]">
                <p className="text-muted-foreground">No data for allocation.</p>
            </Card>
        );
    }

    return (
        <Card className="border-white/10 bg-card/50 backdrop-blur-sm h-full">
            <CardHeader>
                <CardTitle>Portfolio Allocation</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff' }}
                                itemStyle={{ color: '#fff' }}
                                formatter={(value: number | undefined) => [`$${(value || 0).toFixed(2)}`, 'Value'] as [string, string]}
                            />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
