"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { TrendingUp, AlertCircle, LineChart, ShieldCheck, Wallet, PieChart, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { usePortfolioData } from "@/hooks/usePortfolioData";

export const AnalyticsDashboard = () => {
    const { assets, wsConnectionStatus } = usePortfolioData();

    // Get wallet connections
    const walletConnections = Array.from(wsConnectionStatus?.entries() || [])
        .filter(([_, info]) => ['zerion', 'wallet', 'evm', 'solana'].includes(info.type));

    // Get wallet assets
    const walletAssets = assets.filter(asset => {
        if (!asset.breakdown) return false;
        return Object.keys(asset.breakdown).some(sourceId => {
            const connection = wsConnectionStatus?.get(sourceId);
            return connection && ['zerion', 'wallet', 'evm', 'solana'].includes(connection.type);
        });
    }).map(asset => {
        const walletBalance = Object.entries(asset.breakdown || {}).reduce((balSum, [sourceId, amount]) => {
            const connection = wsConnectionStatus?.get(sourceId);
            return connection && ['zerion', 'wallet', 'evm', 'solana'].includes(connection.type)
                ? balSum + amount
                : balSum;
        }, 0);
        return {
            symbol: asset.symbol,
            balance: walletBalance,
            value: walletBalance * asset.price,
            change24h: asset.priceChange24h || 0
        };
    }).sort((a, b) => b.value - a.value);

    const totalValue = walletAssets.reduce((sum, a) => sum + a.value, 0);
    const topAsset = walletAssets[0];
    const topGainer = walletAssets.reduce((best, curr) => curr.change24h > best.change24h ? curr : best, walletAssets[0] || { symbol: '-', change24h: 0 });
    const topLoser = walletAssets.reduce((worst, curr) => curr.change24h < worst.change24h ? curr : worst, walletAssets[0] || { symbol: '-', change24h: 0 });

    // No wallets
    if (walletConnections.length === 0) {
        return (
            <Card className="bg-[#141318] border-white/5 h-full">
                <CardHeader>
                    <CardTitle className="text-xl font-bold font-urbanist">Portfolio Insights</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="h-12 w-12 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
                        <PieChart className="h-6 w-6 text-zinc-500" />
                    </div>
                    <p className="text-zinc-500 text-sm mb-2">No wallet data</p>
                    <p className="text-zinc-600 text-xs">Connect wallets to see insights</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-[#141318] border-white/5 h-full">
            <CardHeader>
                <CardTitle className="text-xl font-bold font-urbanist">Portfolio Insights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Largest Holding */}
                {topAsset && (
                    <div className="p-4 rounded-xl bg-gradient-to-r from-purple-900/20 to-purple-800/20 border border-purple-500/20">
                        <div className="flex items-start gap-4">
                            <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                                <PieChart className="h-5 w-5 text-purple-400" />
                            </div>
                            <div>
                                <h4 className="text-white font-bold mb-1">Largest Holding: {topAsset.symbol}</h4>
                                <p className="text-sm text-zinc-400">
                                    ${topAsset.value.toLocaleString('en-US', { minimumFractionDigits: 2 })} ({((topAsset.value / totalValue) * 100).toFixed(1)}% of portfolio)
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Top Gainer */}
                {topGainer && topGainer.change24h > 0 && (
                    <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-900/20 to-emerald-800/20 border border-emerald-500/20">
                        <div className="flex items-start gap-4">
                            <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                                <ArrowUpRight className="h-5 w-5 text-emerald-400" />
                            </div>
                            <div>
                                <h4 className="text-white font-bold mb-1">Top Gainer: {topGainer.symbol}</h4>
                                <p className="text-sm text-emerald-400">
                                    +{topGainer.change24h.toFixed(2)}% in 24h
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Top Loser */}
                {topLoser && topLoser.change24h < 0 && (
                    <div className="p-4 rounded-xl bg-gradient-to-r from-red-900/20 to-red-800/20 border border-red-500/20">
                        <div className="flex items-start gap-4">
                            <div className="h-10 w-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                                <ArrowDownRight className="h-5 w-5 text-red-400" />
                            </div>
                            <div>
                                <h4 className="text-white font-bold mb-1">Top Loser: {topLoser.symbol}</h4>
                                <p className="text-sm text-red-400">
                                    {topLoser.change24h.toFixed(2)}% in 24h
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Diversification */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-start gap-4">
                        <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                            <ShieldCheck className="h-5 w-5 text-blue-400" />
                        </div>
                        <div>
                            <h4 className="text-white font-bold mb-1">Diversification</h4>
                            <p className="text-sm text-zinc-400">
                                {walletAssets.length} assets across {walletConnections.length} wallet{walletConnections.length > 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
