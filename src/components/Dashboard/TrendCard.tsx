"use client";

import { cn } from "@/lib/utils";
import { ArrowUpRight, TrendingUp } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

interface TrendCardProps {
    title: string;
    value: string;
    trend: number;
    trendLabel?: string;
    variant?: "green" | "purple" | "dark";
    chartData?: { value: number }[];
    className?: string;
}

const VARIANTS = {
    green: "bg-[#86efac] text-zinc-900", // Light green
    purple: "bg-[#c084fc] text-white", // Light purple
    dark: "bg-zinc-900 text-white border border-white/10"
};

export function TrendCard({
    title,
    value,
    trend,
    trendLabel,
    variant = "green",
    chartData = [],
    className
}: TrendCardProps) {
    const isPositive = trend >= 0;
    const baseClass = VARIANTS[variant];
    const isDark = variant === "dark";

    // Mock chart data if none provided
    const data = chartData.length > 0 ? chartData : [
        { value: 10 }, { value: 15 }, { value: 12 }, { value: 20 }, { value: 18 }, { value: 25 }, { value: 22 }, { value: 30 }
    ];

    return (
        <div className={cn("rounded-[2rem] p-6 relative overflow-hidden h-full min-h-[220px] flex flex-col justify-between", baseClass, className)}>
            <div className="flex justify-between items-start z-10">
                <div className="flex items-center gap-2">
                    {variant !== 'dark' && (
                        <div className={cn("p-2 rounded-full", isDark ? "bg-white/10" : "bg-black/5")}>
                            <TrendingUp className="w-4 h-4" />
                        </div>
                    )}
                    <span className={cn("text-sm font-bold", isDark ? "text-zinc-400" : "opacity-80")}>
                        {title}
                    </span>
                </div>
                <div className="p-2 rounded-full bg-black/5">
                    <ArrowUpRight className="w-4 h-4" />
                </div>
            </div>

            <div className="z-10 mt-4">
                <div className="text-3xl font-black tracking-tighter mb-2">
                    {value}
                </div>
                {trendLabel && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/5 backdrop-blur-sm text-xs font-bold">
                        <span className={isPositive ? "text-inherit" : "text-rose-600"}>
                            {isPositive ? "+" : ""}{trend}%
                        </span>
                        {/* Progress Bar visual */}
                        <div className="w-12 h-1.5 bg-black/10 rounded-full ml-1 overflow-hidden">
                            <div className="h-full bg-current opacity-50 w-[70%]" />
                        </div>
                    </div>
                )}
            </div>

            {/* Sparkline */}
            <div className="absolute inset-x-0 bottom-0 h-24 opacity-30 pointer-events-none">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke="currentColor"
                            strokeWidth={2}
                            fill="currentColor"
                            fillOpacity={0.2}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
