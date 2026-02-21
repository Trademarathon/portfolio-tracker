"use client";

import { ArrowDown, PieChart } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/ui/StatCard";

interface QuickSummaryWidgetProps {
    drawdown: number;
    stablecoinPct: number;
    btcExposurePct: number;
}

export function QuickSummaryWidget({ drawdown, stablecoinPct }: QuickSummaryWidgetProps) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-1 gap-3">
            <StatCard
                label="Max DD"
                value={`-${drawdown.toFixed(2)}%`}
                subValue="From All-Time High"
                icon={ArrowDown}
                color="rose"
            />
            <div className={cn(
                "flex flex-col gap-2 p-3 rounded-xl bg-gradient-to-br border from-indigo-500/10 to-indigo-500/5 border-indigo-500/20 transition-all duration-300 hover:scale-[1.01]"
            )}>
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-black/20 text-indigo-400">
                        <PieChart className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Stablecoins</span>
                        <span className="text-lg font-black text-white truncate">{stablecoinPct.toFixed(1)}%</span>
                    </div>
                </div>
                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 transition-all" style={{ width: `${Math.min(stablecoinPct, 100)}%` }} />
                </div>
            </div>
        </div>
    );
}
