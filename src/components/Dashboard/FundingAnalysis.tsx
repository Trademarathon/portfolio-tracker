"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CryptoIcon } from "@/components/ui/CryptoIcon";
import { useMemo } from "react";

interface FundingEntry {
    symbol: string;
    amount: number;
    exchange: string;
}

export default function FundingAnalysis({ fundingData }: { fundingData: FundingEntry[] }) {
    const analysis = useMemo(() => {
        const stats: Record<string, { total: number; exchanges: Set<string> }> = {};
        let totalFunding = 0;

        fundingData.forEach(f => {
            const sym = f.symbol || 'Unknown';
            const amount = Number(f.amount) || 0;
            if (!stats[sym]) stats[sym] = { total: 0, exchanges: new Set() };
            stats[sym].total += amount;
            stats[sym].exchanges.add(f.exchange || 'Unknown');
            totalFunding += amount;
        });

        return {
            assets: Object.entries(stats)
                .map(([symbol, data]) => ({
                    symbol,
                    total: data.total,
                    exchanges: Array.from(data.exchanges)
                }))
                .sort((a, b) => Math.abs(b.total) - Math.abs(a.total)),
            totalFunding
        };
    }, [fundingData]);

    if (!fundingData || fundingData.length === 0) {
        return (
            <Card className="border-white/10 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle>Funding Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-sm">No funding history found.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-white/10 bg-card/50 backdrop-blur-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Total Funding PnL</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${analysis.totalFunding >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {analysis.totalFunding >= 0 ? '+' : ''}{analysis.totalFunding.toFixed(2)} USDC
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-white/10 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle>Asset Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-auto max-h-[400px]">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-muted-foreground uppercase bg-white/5 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3">Asset</th>
                                    <th className="px-4 py-3">Exchange</th>
                                    <th className="px-4 py-3 text-right">Net Funding</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analysis.assets.map((asset) => (
                                    <tr key={asset.symbol} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-3 font-medium">
                                            <div className="flex items-center gap-2">
                                                <CryptoIcon type={asset.symbol} size={20} />
                                                {asset.symbol}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-zinc-400">
                                            {asset.exchanges.join(', ')}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-mono ${asset.total >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                            {asset.total >= 0 ? '+' : ''}{asset.total.toFixed(4)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
