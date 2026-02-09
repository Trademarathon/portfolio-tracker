import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, TrendingUp, TrendingDown, Layers, Trophy } from "lucide-react";
import { motion } from "framer-motion";
import { PortfolioAsset } from "@/lib/api/types";
import Image from "next/image";
import { GlowingEffect } from "@/components/ui/glowing-effect";

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

    const cards = [
        {
            title: "Total Balance",
            icon: Wallet,
            iconColor: "text-primary",
            content: (
                <>
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
                </>
            )
        },
        {
            title: "PnL (24h)",
            icon: TrendingUp,
            iconColor: isPositive ? 'text-emerald-500' : 'text-red-500',
            content: (
                <>
                    <div className={`text-2xl font-bold ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                        {isPositive ? '+' : ''}${pnlUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Daily Variation
                    </p>
                </>
            )
        },
        {
            title: "Open Positions",
            icon: Layers,
            iconColor: "text-blue-500",
            content: (
                <>
                    <div className="text-2xl font-bold text-white">{openPositions}</div>
                    <p className="text-xs text-muted-foreground">
                        Active Trades
                    </p>
                </>
            )
        },
        {
            title: "Top Performer",
            icon: Trophy,
            iconColor: "text-amber-500",
            content: (
                <>
                    {topPerformer ? (
                        <>
                            <div className="flex items-center gap-2 mb-1">
                                <div className="h-6 w-6 rounded-full overflow-hidden bg-white/5 relative flex items-center justify-center text-[10px] font-bold border border-white/10">
                                    {topPerformer.symbol.substring(0, 1)}
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
                </>
            )
        }
    ];

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {cards.map((card, index) => (
                <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                    <div className="relative h-full rounded-xl">
                        <GlowingEffect
                            spread={40}
                            glow={true}
                            disabled={false}
                            proximity={64}
                            inactiveZone={0.01}
                        />
                        <Card className="relative h-full bg-zinc-950/80 backdrop-blur-md border-white/10 overflow-hidden">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                    {card.title}
                                </CardTitle>
                                <card.icon className={`h-4 w-4 ${card.iconColor}`} />
                            </CardHeader>
                            <CardContent>
                                {card.content}
                            </CardContent>
                        </Card>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}
