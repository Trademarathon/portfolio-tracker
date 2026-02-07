import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PortfolioAsset } from "@/lib/api/types";
import { TrendingUp, TrendingDown, Trophy, AlertCircle } from "lucide-react";

interface SpotHighlightsProps {
    assets: PortfolioAsset[];
}

export function SpotHighlights({ assets }: SpotHighlightsProps) {
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
        <div className="grid gap-4 md:grid-cols-3">
            {/* Highest Holding */}
            <Card className="bg-zinc-900/50 border-white/10">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Highest Holding</CardTitle>
                    <Trophy className="h-4 w-4 text-yellow-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold flex items-center gap-2">
                        {highestHolding.symbol}
                        <span className="text-sm font-normal text-muted-foreground">
                            ${highestHolding.valueUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {highestHolding.allocations.toFixed(1)}% of Portfolio
                    </p>
                </CardContent>
            </Card>

            {/* Top Gainer */}
            <Card className="bg-zinc-900/50 border-white/10">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Top Performer (24h)</CardTitle>
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                    {topGainer && (topGainer.priceChange24h || 0) > 0 ? (
                        <>
                            <div className="text-2xl font-bold flex items-center gap-2 text-emerald-500">
                                {topGainer.symbol}
                                <span className="text-sm font-normal text-emerald-500/80">
                                    +{topGainer.priceChange24h?.toFixed(2)}%
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Price: ${topGainer.price?.toLocaleString()}
                            </p>
                        </>
                    ) : (
                        <div className="text-sm text-muted-foreground pt-1">No positive movers</div>
                    )}
                </CardContent>
            </Card>

            {/* Top Loser */}
            <Card className="bg-zinc-900/50 border-white/10">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Worst Performer (24h)</CardTitle>
                    <TrendingDown className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                    {topLoser && (topLoser.priceChange24h || 0) < 0 ? (
                        <>
                            <div className="text-2xl font-bold flex items-center gap-2 text-red-500">
                                {topLoser.symbol}
                                <span className="text-sm font-normal text-red-500/80">
                                    {topLoser.priceChange24h?.toFixed(2)}%
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Price: ${topLoser.price?.toLocaleString()}
                            </p>
                        </>
                    ) : (
                        <div className="text-sm text-muted-foreground pt-1">No negative movers</div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
