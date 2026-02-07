"use client";

import { usePortfolioData } from "@/hooks/usePortfolioData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Wallet, Layers } from "lucide-react";
import { motion } from "framer-motion";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { ExchangeIcon } from "@/components/ui/ExchangeIcon";

export default function BalancesPage() {
    const { assets, loading } = usePortfolioData();

    // Aggregate balances by Source (Account Name)
    const accountBalances: { [key: string]: { total: number, assets: { symbol: string, balance: number, value: number }[] } } = {};

    assets.forEach(asset => {
        if (asset.breakdown && asset.price) {
            Object.entries(asset.breakdown).forEach(([source, balance]) => {
                if (!accountBalances[source]) {
                    accountBalances[source] = { total: 0, assets: [] };
                }
                const value = balance * asset.price!;
                accountBalances[source].total += value;
                accountBalances[source].assets.push({
                    symbol: asset.symbol,
                    balance: balance,
                    value: value
                });
            });
        }
    });

    const sortedAccounts = Object.entries(accountBalances).sort(([, a], [, b]) => b.total - a.total);

    if (loading && assets.length === 0) {
        return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading balances...</div>;
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 pb-32">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold font-mono text-white">Account Balances</h1>
                <p className="text-muted-foreground">Detailed breakdown of your assets across all connected accounts.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sortedAccounts.map(([source, data], index) => (
                    <motion.div
                        key={source}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                    >
                        <Card className="bg-card/30 backdrop-blur-md border-white/5 hover:border-primary/20 transition-all group overflow-hidden relative">
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Layers className="h-24 w-24 text-primary transform rotate-12" />
                            </div>

                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <ExchangeIcon exchange={source} size={40} className="shadow-lg" />
                                        <div className="overflow-hidden">
                                            <CardTitle className="text-lg font-bold truncate max-w-[180px]" title={source}>{source}</CardTitle>
                                            <p className="text-xs text-muted-foreground uppercase">{source.includes("Binance") || source.includes("Bybit") ? "Exchange" : "On-Chain"}</p>
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="mb-6">
                                    <p className="text-sm text-muted-foreground">Total Value</p>
                                    <p className="text-3xl font-bold text-white font-mono tracking-tighter">
                                        {formatCurrency(data.total)}
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Top Assets</p>
                                    {data.assets.sort((a, b) => b.value - a.value).slice(0, 4).map(asset => (
                                        <div key={asset.symbol} className="flex items-center justify-between p-2 rounded bg-white/5 hover:bg-white/10 transition-colors">
                                            <div className="flex items-center gap-2">
                                                <TokenIcon symbol={asset.symbol} size={24} />
                                                <span className="font-bold text-sm">{asset.symbol}</span>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-medium text-white">{formatCurrency(asset.value)}</p>
                                                <p className="text-[10px] text-muted-foreground">{asset.balance.toFixed(4)} {asset.symbol}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {data.assets.length > 4 && (
                                        <p className="text-xs text-center text-muted-foreground pt-2">
                                            + {data.assets.length - 4} more assets
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                ))}

                {sortedAccounts.length === 0 && (
                    <div className="col-span-full py-12 text-center border-2 border-dashed border-white/10 rounded-xl">
                        <p className="text-muted-foreground mb-4">No accounts connected yet.</p>
                        <a href="/settings" className="bg-primary px-4 py-2 rounded text-white font-bold hover:bg-primary/90">Connect Account</a>
                    </div>
                )}
            </div>
        </div>
    );
}
