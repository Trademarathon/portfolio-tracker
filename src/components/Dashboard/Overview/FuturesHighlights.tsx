"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Position } from "@/lib/api/types";
import { Activity, BarChart3, Clock, DollarSign, TrendingUp, Zap } from "lucide-react";
import { GlowingEffect } from "@/components/ui/glowing-effect";

import { memo } from "react";

interface FuturesHighlightsProps {
    positions: Position[];
    marketData: Record<string, { funding: number, oi: number, volume24h: number, markPrice: number }>;
}

export const FuturesHighlights = memo(({ positions = [], marketData = {} }: FuturesHighlightsProps) => {
    // 1. Total Notional Exposure
    const totalExposure = positions.reduce((sum, p) => sum + (p.size * (p.markPrice || p.entryPrice)), 0);

    // 2. Weighted Average Funding (estimate)
    let totalWeightedFunding = 0;
    let totalSize = 0;

    positions.forEach(p => {
        const data = marketData[p.symbol.replace('-PERP', '')];
        if (data) {
            const sizeUsd = p.size * (p.markPrice || p.entryPrice);
            totalWeightedFunding += data.funding * sizeUsd;
            totalSize += sizeUsd;
        }
    });

    const avgFunding = totalSize > 0 ? (totalWeightedFunding / totalSize) * 100 : 0; // as %

    // 3. Global Stats (Summed from marketData)
    const globalOI = Object.values(marketData).reduce((sum, d) => sum + d.oi, 0);
    const globalVolume = Object.values(marketData).reduce((sum, d) => sum + d.volume24h, 0);

    return (
        <div className="flex flex-col gap-4">
            {/* AGGREGATE FUTURES HEADER */}
            <Card className="bg-zinc-950/50 border-white/5 p-4 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex flex-col gap-1 shrink-0">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Total Notional Exposure</span>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-white font-mono">${totalExposure.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        <span className="text-xs text-zinc-400">across {positions.length} positions</span>
                    </div>
                </div>

                <div className="flex-1 w-full grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase">Avg Funding (Hourly)</span>
                        <span className={`text-sm font-bold font-mono ${avgFunding >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {avgFunding > 0 ? '+' : ''}{avgFunding.toFixed(4)}%
                        </span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase">Global OI</span>
                        <span className="text-sm font-bold font-mono text-zinc-300">
                            ${(globalOI / 1e9).toFixed(2)}B
                        </span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase">24h Vol (Perps)</span>
                        <span className="text-sm font-bold font-mono text-zinc-300">
                            ${(globalVolume / 1e9).toFixed(2)}B
                        </span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase">Net Skew</span>
                        <span className="text-sm font-bold font-mono text-indigo-400">
                            Mixed
                        </span>
                    </div>
                </div>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
                {/* Funding Opportunities */}
                <div className="relative h-full rounded-xl">
                    <GlowingEffect spread={40} glow={true} proximity={64} inactiveZone={0.01} />
                    <Card className="relative h-full bg-zinc-900/50 border-white/10 overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Top Funding Payers</CardTitle>
                            <DollarSign className="h-4 w-4 text-rose-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {Object.entries(marketData)
                                    .sort((a, b) => b[1].funding - a[1].funding)
                                    .slice(0, 3)
                                    .map(([symbol, data]) => (
                                        <div key={symbol} className="flex justify-between items-center text-xs">
                                            <span className="font-bold text-zinc-300">{symbol}</span>
                                            <span className="text-rose-400 font-mono">{(data.funding * 100).toFixed(4)}%</span>
                                        </div>
                                    ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Highest OI Markets */}
                <div className="relative h-full rounded-xl">
                    <GlowingEffect spread={40} glow={true} proximity={64} inactiveZone={0.01} />
                    <Card className="relative h-full bg-zinc-900/50 border-white/10 overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Highest OI Markets</CardTitle>
                            <BarChart3 className="h-4 w-4 text-indigo-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {Object.entries(marketData)
                                    .sort((a, b) => b[1].oi - a[1].oi)
                                    .slice(0, 3)
                                    .map(([symbol, data]) => (
                                        <div key={symbol} className="flex justify-between items-center text-xs">
                                            <span className="font-bold text-zinc-300">{symbol}</span>
                                            <span className="text-zinc-400 font-mono">${(data.oi / 1e6).toFixed(1)}M</span>
                                        </div>
                                    ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Market Velocity */}
                <div className="relative h-full rounded-xl">
                    <GlowingEffect spread={40} glow={true} proximity={64} inactiveZone={0.01} />
                    <Card className="relative h-full bg-zinc-900/50 border-white/10 overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs font-bold text-zinc-500 uppercase tracking-wider">High Volume (24h)</CardTitle>
                            <Zap className="h-4 w-4 text-amber-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {Object.entries(marketData)
                                    .sort((a, b) => b[1].volume24h - a[1].volume24h)
                                    .slice(0, 3)
                                    .map(([symbol, data]) => (
                                        <div key={symbol} className="flex justify-between items-center text-xs">
                                            <span className="font-bold text-zinc-300">{symbol}</span>
                                            <span className="text-amber-400 font-mono">${(data.volume24h / 1e6).toFixed(1)}M</span>
                                        </div>
                                    ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
});
