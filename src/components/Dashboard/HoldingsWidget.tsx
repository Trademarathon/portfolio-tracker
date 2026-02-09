"use client";

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PortfolioAsset } from '@/lib/api/types';
import { TokenIcon } from '@/components/ui/TokenIcon';
import { getTokenName } from '@/lib/token-metadata';
import { ResponsiveContainer, AreaChart, Area, YAxis } from 'recharts';
import { ArrowUp, ArrowDown, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface HoldingsWidgetProps {
    assets: PortfolioAsset[];
}

export function HoldingsWidget({ assets }: HoldingsWidgetProps) {
    const topAssets = useMemo(() => {
        return [...assets]
            .sort((a, b) => b.valueUsd - a.valueUsd)
            .slice(0, 4); // Top 4
    }, [assets]);

    // Generate fake sparkline data based on 24h change
    const getSparklineData = (change: number) => {
        const data = [];
        let value = 100;
        const trend = change > 0 ? 1 : -1;
        const volatility = Math.abs(change) / 10;

        for (let i = 0; i < 20; i++) {
            value = value + (Math.random() - 0.5) * 5 + (trend * i * volatility);
            data.push({ i, value: Math.max(0, value) });
        }
        return data;
    };

    if (topAssets.length === 0) {
        return (
            <Card className="h-full border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
                <CardContent className="flex flex-col items-center justify-center h-full text-zinc-500 gap-2">
                    <Wallet className="w-8 h-8 opacity-20" />
                    <span className="text-sm">No assets found</span>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="h-full border-zinc-800 bg-zinc-900/50 backdrop-blur-xl overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent pointer-events-none" />

            <CardHeader className="py-4 border-b border-white/5">
                <CardTitle className="text-sm font-medium uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-indigo-500" />
                    Top Holdings
                </CardTitle>
            </CardHeader>

            <CardContent className="p-0">
                <div className="flex flex-col divide-y divide-white/5">
                    {topAssets.map((asset, i) => {
                        const isPositive = (asset.priceChange24h || 0) >= 0;
                        const data = getSparklineData(asset.priceChange24h || 0);

                        return (
                            <motion.div
                                key={asset.symbol}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors group relative overflow-hidden"
                            >
                                <div className="flex items-center gap-3 relative z-10">
                                    <div className="relative">
                                        <TokenIcon symbol={asset.symbol} size={36} />
                                        <div className="absolute -bottom-1 -right-1 flex items-center justify-center w-4 h-4 bg-zinc-900 rounded-full border border-zinc-800 text-[10px] font-bold text-zinc-400">
                                            {i + 1}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="font-bold text-zinc-100">{getTokenName(asset.symbol)}</div>
                                        <div className="text-xs text-zinc-500 flex items-center gap-1">
                                            {asset.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })} {asset.symbol}
                                        </div>
                                    </div>
                                </div>

                                {/* Mini Sparkline */}
                                <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-24 h-full opacity-20 group-hover:opacity-40 transition-opacity">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={data}>
                                            <defs>
                                                <linearGradient id={`gradient-${asset.symbol}`} x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity={0.8} />
                                                    <stop offset="95%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <Area
                                                type="monotone"
                                                dataKey="value"
                                                stroke={isPositive ? "#10b981" : "#ef4444"}
                                                fill={`url(#gradient-${asset.symbol})`}
                                                strokeWidth={2}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="flex flex-col items-end relative z-10">
                                    <div className="font-mono font-bold text-white">
                                        ${asset.valueUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </div>
                                    <div className={cn(
                                        "flex items-center text-xs font-mono",
                                        isPositive ? "text-emerald-400" : "text-rose-400"
                                    )}>
                                        {isPositive ? <ArrowUp className="w-3 h-3 mr-0.5" /> : <ArrowDown className="w-3 h-3 mr-0.5" />}
                                        {Math.abs(asset.priceChange24h || 0).toFixed(2)}%
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
