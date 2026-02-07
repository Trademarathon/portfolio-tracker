"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";
import { PortfolioAsset } from "@/lib/api/types";
import { TokenIcon } from "@/components/ui/TokenIcon";

interface StablecoinWidgetProps {
    assets: PortfolioAsset[];
    loading: boolean;
}

export function StablecoinWidget({ assets, loading }: StablecoinWidgetProps) {
    if (loading) {
        return <div className="animate-pulse h-64 bg-zinc-900 rounded-xl" />;
    }

    const stablecoins = assets.filter(a => a.sector === 'Stablecoin' && a.balance > 0);
    const totalStableValue = stablecoins.reduce((acc, curr) => acc + (curr.valueUsd || 0), 0);

    if (stablecoins.length === 0) return null;

    return (
        <Card className="bg-gradient-to-br from-zinc-900 to-zinc-950 border-white/10 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    <CardTitle className="text-sm font-bold uppercase tracking-widest text-zinc-400">
                        Dry Powder
                    </CardTitle>
                </div>
                <div className="text-lg font-black text-white">
                    ${totalStableValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
                {stablecoins.sort((a, b) => (b.valueUsd || 0) - (a.valueUsd || 0)).map((asset) => (
                    <div key={asset.symbol} className="space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <TokenIcon symbol={asset.symbol} size={20} />
                                <span className="text-xs font-bold text-white">{asset.symbol}</span>
                            </div>
                            <span className="text-xs font-mono text-zinc-400">
                                ${(asset.valueUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="pl-6 space-y-1.5 border-l border-white/10 ml-2.5">
                            {Object.entries(asset.breakdown || {}).map(([source, balance]) => {
                                // Assume 1:1 for stables or use price if available
                                const val = balance * (asset.price || 1);
                                return (
                                    <div key={source} className="flex items-center justify-between text-[10px]">
                                        <span className="text-zinc-500 flex items-center gap-1.5">
                                            <div className="w-1 h-1 rounded-full bg-zinc-700" />
                                            {source}
                                        </span>
                                        <span className="text-zinc-300 font-mono">
                                            ${val.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
