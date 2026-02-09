"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

interface PortfolioGaugeProps {
    value: number;
    max: number;
    label: string;
    subLabel?: string;
    color?: string; // Hex color
    className?: string;
}

export function PortfolioGauge({
    value,
    max,
    label,
    subLabel,
    color = "#a3e635", // Default to lime (approx)
    className
}: PortfolioGaugeProps) {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));
    const data = [
        { name: "Value", value: percentage },
        { name: "Remaining", value: 100 - percentage },
    ];

    return (
        <div className={cn("bg-[#e4e4e7] text-zinc-900 rounded-[2rem] p-6 relative overflow-hidden flex flex-col justify-between h-full min-h-[220px]", className)}>
            <div className="flex justify-between items-start z-10">
                <div className="p-2 bg-white rounded-full inline-flex">
                    <TrendingUp className="w-4 h-4 text-zinc-900" />
                </div>
            </div>

            <div className="absolute inset-0 top-8">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="70%"
                            startAngle={180}
                            endAngle={0}
                            innerRadius="60%"
                            outerRadius="80%"
                            paddingAngle={0}
                            dataKey="value"
                            stroke="none"
                        >
                            <Cell key="cell-0" fill="#18181b" /> {/* Dark arc for value */}
                            <Cell key="cell-1" fill="rgba(0,0,0,0.05)" /> {/* Light arc for background */}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
            </div>

            <div className="text-center z-10 mt-auto">
                <div className="text-3xl font-black tracking-tighter mb-1">
                    {percentage.toFixed(0)}%
                </div>
                <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">
                    Avg score: {value.toLocaleString()}
                </div>

                <div className="flex justify-between items-end">
                    <div>
                        <div className="text-4xl font-black tracking-tighter leading-none">
                            ${value.toLocaleString()}
                        </div>
                        <div className="text-sm font-medium text-zinc-600">
                            {label}
                        </div>
                    </div>
                </div>
            </div>

            {/* Decorative pattern/texture could go here */}
        </div>
    );
}
