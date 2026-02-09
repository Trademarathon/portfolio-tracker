"use client";

import { useMemo } from "react";
import { formatCurrency, formatPercentage } from "@/lib/utils";
import { TrendingUp, TrendingDown, Activity, DollarSign, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardStatsProps {
    totalValue: number;
    totalPnlUsd: number;
    totalPnlPercent: number;
    totalVolume?: number;
    activePositions?: number;
}

export function DashboardStats({ totalValue, totalPnlUsd, totalPnlPercent, totalVolume = 0, activePositions = 0 }: DashboardStatsProps) {

    const stats = [
        {
            label: "Total Balance",
            value: formatCurrency(totalValue),
            change: totalPnlPercent,
            changeLabel: "24h Change",
            icon: Wallet,
            gradient: "from-[var(--trade-purple)] to-[var(--trade-orange)]",
            glow: "shadow-[0_0_20px_-5px_rgba(127,106,255,0.3)]"
        },
        {
            label: "24h PnL",
            value: `${totalPnlUsd >= 0 ? "+" : ""}${formatCurrency(totalPnlUsd)}`,
            change: totalPnlPercent,
            changeLabel: "Today",
            icon: DollarSign,
            gradient: "from-emerald-500 to-teal-400",
            glow: "shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]"
        },
        {
            label: "24h Volume",
            value: formatCurrency(totalVolume),
            subValue: "Global Market",
            icon: Activity,
            gradient: "from-blue-500 to-cyan-400",
            glow: "shadow-[0_0_20px_-5px_rgba(59,130,246,0.3)]"
        },
        {
            label: "Active Positions",
            value: activePositions.toString(),
            subValue: "Open Trades",
            icon: TrendingUp,
            gradient: "from-orange-500 to-red-400",
            glow: "shadow-[0_0_20px_-5px_rgba(249,115,22,0.3)]"
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
                <div key={i} className="relative group">
                    <div className={cn(
                        "absolute -inset-0.5 bg-gradient-to-r opacity-20 blur transition duration-1000 group-hover:opacity-40 group-hover:duration-200 rounded-xl",
                        stat.gradient
                    )}></div>
                    <div className="relative bg-[#141318] border border-white/5 rounded-xl p-5 h-full flex flex-col justify-between overflow-hidden">
                        {/* Background Decoration */}
                        <div className={cn(
                            "absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-5 blur-xl",
                            stat.gradient.split(" ")[1] // approximate background color
                        )}></div>

                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider font-urbanist">{stat.label}</p>
                            </div>
                            <div className={cn(
                                "p-2 rounded-lg bg-white/5 border border-white/5",
                                "group-hover:scale-110 transition-transform duration-300"
                            )}>
                                <stat.icon className="w-4 h-4 text-zinc-300" />
                            </div>
                        </div>

                        <div>
                            <h3 className="text-2xl font-black text-white font-urbanist tracking-tight mb-1">
                                {stat.value}
                            </h3>

                            {stat.change !== undefined ? (
                                <div className="flex items-center gap-2">
                                    <span className={cn(
                                        "flex items-center text-xs font-bold px-1.5 py-0.5 rounded",
                                        stat.change >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                                    )}>
                                        {stat.change >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                                        {Math.abs(stat.change).toFixed(2)}%
                                    </span>
                                    <span className="text-zinc-500 text-xs font-medium">{stat.changeLabel}</span>
                                </div>
                            ) : (
                                <p className="text-zinc-500 text-xs font-medium">{stat.subValue}</p>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
