import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PortfolioAsset } from "@/lib/api/types";
import { TrendingUp, TrendingDown, Trophy } from "lucide-react";
import { memo, useMemo, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface SpotHighlightsProps {
    assets: PortfolioAsset[];
    orders: any[];
}

export const SpotHighlights = memo(({ assets = [], orders = [] }: SpotHighlightsProps) => {
    const [isAnimating, setIsAnimating] = useState(true);
    
    // Trigger animation on mount
    useEffect(() => {
        const timer = setTimeout(() => setIsAnimating(false), 2000);
        return () => clearTimeout(timer);
    }, []);
    
    if (assets.length === 0) return null;

    // Highest Holding
    const highestHolding = [...assets].sort((a, b) => b.valueUsd - a.valueUsd)[0];

    // Filter out assets with 0 balance or tiny value for performance stats to avoid dust noise
    const activeAssets = assets.filter(a => a.valueUsd > 1);

    // Top Gainer / Loser
    const sortedByPerformance = [...activeAssets].sort((a, b) => (b.priceChange24h || 0) - (a.priceChange24h || 0));
    const topGainer = sortedByPerformance[0];
    const topLoser = sortedByPerformance[sortedByPerformance.length - 1];

    return (
        <div className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-3">
                {/* Highest Holding - StatCard style */}
                <div className={cn(
                    "flex items-center gap-3 p-3 rounded-xl bg-gradient-to-br border transition-all duration-300 hover:scale-[1.01] clone-card",
                    "from-amber-500/10 to-amber-500/5 border-amber-500/20"
                )}>
                    <div className="p-2 rounded-lg bg-black/20 text-amber-400">
                        <Trophy className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Highest Holding</span>
                        <span className="text-lg font-black text-white truncate">
                            {highestHolding.symbol} ${highestHolding.valueUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-bold">{highestHolding.allocations.toFixed(1)}% of Portfolio</span>
                    </div>
                </div>

                {/* Top Gainer - StatCard style */}
                <div className={cn(
                    "flex items-center gap-3 p-3 rounded-xl bg-gradient-to-br border transition-all duration-300 hover:scale-[1.01] clone-card",
                    "from-emerald-500/10 to-emerald-500/5 border-emerald-500/20"
                )}>
                    <div className="p-2 rounded-lg bg-black/20 text-emerald-400">
                        <TrendingUp className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Top Performer (24h)</span>
                        {topGainer && (topGainer.priceChange24h || 0) > 0 ? (
                            <>
                                <span className="text-lg font-black text-emerald-400 truncate">
                                    {topGainer.symbol} +{topGainer.priceChange24h?.toFixed(2)}%
                                </span>
                                <span className="text-[10px] text-zinc-500 font-bold">${topGainer.price?.toLocaleString()}</span>
                            </>
                        ) : (
                            <span className="text-sm font-bold text-zinc-500">No positive movers</span>
                        )}
                    </div>
                </div>

                {/* Top Loser - StatCard style */}
                <div className={cn(
                    "flex items-center gap-3 p-3 rounded-xl bg-gradient-to-br border transition-all duration-300 hover:scale-[1.01] clone-card",
                    "from-rose-500/10 to-rose-500/5 border-rose-500/20"
                )}>
                    <div className="p-2 rounded-lg bg-black/20 text-rose-400">
                        <TrendingDown className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Worst Performer (24h)</span>
                        {topLoser && (topLoser.priceChange24h || 0) < 0 ? (
                            <>
                                <span className="text-lg font-black text-rose-400 truncate">
                                    {topLoser.symbol} {topLoser.priceChange24h?.toFixed(2)}%
                                </span>
                                <span className="text-[10px] text-zinc-500 font-bold">${topLoser.price?.toLocaleString()}</span>
                            </>
                        ) : (
                            <span className="text-sm font-bold text-zinc-500">No negative movers</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});
