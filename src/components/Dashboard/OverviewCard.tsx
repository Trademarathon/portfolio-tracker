import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, TrendingUp, TrendingDown, Layers, Trophy } from "lucide-react";
import { motion } from "framer-motion";
import { PortfolioAsset } from "@/lib/api/types";
import Image from "next/image";

interface OverviewProps {
    totalValue: number;
    pnlUsd: number;
    pnlPercent: number;
    openPositions: number;
    loading: boolean;
    assets?: PortfolioAsset[];
}

export default function OverviewCard({ totalValue, pnlUsd, pnlPercent, openPositions, loading, assets = [] }: OverviewProps) {
    if (loading) {
        return <div className="animate-pulse h-32 bg-zinc-900 rounded-xl" />;
    }

    const isPositive = pnlUsd >= 0;

    // Calculate Top Performer
    // Filter for assets with value > $10 to avoid dust skewing results
    const topPerformer = assets
        .filter(a => a.valueUsd > 10)
        .sort((a, b) => (b.priceChange24h || 0) - (a.priceChange24h || 0))[0];

    const topPerformance = topPerformer?.priceChange24h || 0;
    const isTopPositive = topPerformance >= 0;

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                <Card className="bg-gradient-to-br from-zinc-900 to-zinc-950 border-white/10 h-full">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Balance
                        </CardTitle>
                        <Wallet className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">
                            ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            <span className={`${isPositive ? 'text-emerald-500' : 'text-red-500'} flex items-center gap-1`}>
                                {isPositive ? '+' : ''}{pnlPercent.toFixed(2)}%
                                {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            </span>{" "}
                            (24h)
                        </p>
                    </CardContent>
                </Card>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
            >
                <Card className="bg-gradient-to-br from-zinc-900 to-zinc-950 border-white/10 h-full">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            PnL (24h)
                        </CardTitle>
                        <TrendingUp className={`h-4 w-4 ${isPositive ? 'text-emerald-500' : 'text-red-500'}`} />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                            {isPositive ? '+' : ''}${pnlUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Daily Variation
                        </p>
                    </CardContent>
                </Card>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
            >
                <Card className="bg-gradient-to-br from-zinc-900 to-zinc-950 border-white/10 h-full">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Open Positions
                        </CardTitle>
                        <Layers className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{openPositions}</div>
                        <p className="text-xs text-muted-foreground">
                            Active Trades
                        </p>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Top Performer Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.3 }}
            >
                <Card className="bg-gradient-to-br from-zinc-900 to-zinc-950 border-white/10 h-full">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Top Performer
                        </CardTitle>
                        <Trophy className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        {topPerformer ? (
                            <>
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="h-6 w-6 rounded-full overflow-hidden bg-white/5 relative">
                                        {/* Fallback icon if no logo, but we usually have one or use a generic one */}
                                        {/* Ideally we use the same TokenIcon component, but let's simluate or import it if needed. 
                                            For now, just text or use a generic image if we don't import TokenIcon 
                                        */}
                                        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
                                            {topPerformer.symbol.substring(0, 1)}
                                        </div>
                                    </div>
                                    <div className="text-2xl font-bold text-white">
                                        {topPerformer.symbol}
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    <span className={`${isTopPositive ? 'text-emerald-500' : 'text-red-500'} font-bold`}>
                                        {isTopPositive ? '+' : ''}{topPerformance.toFixed(2)}%
                                    </span>{" "}
                                    (24h)
                                </p>
                            </>
                        ) : (
                            <>
                                <div className="text-2xl font-bold text-zinc-500">--</div>
                                <p className="text-xs text-muted-foreground">No data available</p>
                            </>
                        )}
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
