"use client";

import { useEffect, useState, useMemo } from 'react';
import { getGlobalFundingRates, FundingRate } from '@/lib/api/funding';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowUpRight, ArrowDownRight, Minus, Activity, TrendingUp, TrendingDown } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

export function FundingRateWidget() {
    const [rates, setRates] = useState<FundingRate[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getGlobalFundingRates().then(data => {
            setRates(data);
            setLoading(false);
        });

        // Refresh every 60s
        const interval = setInterval(() => {
            getGlobalFundingRates().then(setRates);
        }, 60000);

        return () => clearInterval(interval);
    }, []);

    const stats = useMemo(() => {
        if (!rates.length) return null;

        const sorted = [...rates].sort((a, b) => b.fundingRate - a.fundingRate);
        const positive = sorted.filter(r => r.fundingRate > 0);
        const negative = sorted.filter(r => r.fundingRate < 0);

        // Average Funding Rate (Weighted by nothing for now, just simple average or median might be better)
        // A simple average is fine for general sentiment.
        const avgFunding = rates.reduce((acc, r) => acc + r.fundingRate, 0) / rates.length;

        // Sentiment Logic
        let sentiment = 'Neutral';
        let sentimentColor = 'text-yellow-500';
        if (avgFunding > 0.0001) { sentiment = 'Bullish'; sentimentColor = 'text-green-500'; } // > 0.01%
        if (avgFunding > 0.0005) { sentiment = 'Extreme Greed'; sentimentColor = 'text-emerald-400'; } // > 0.05%
        if (avgFunding < 0) { sentiment = 'Bearish'; sentimentColor = 'text-red-500'; }
        if (avgFunding < -0.0002) { sentiment = 'Extreme Fear'; sentimentColor = 'text-rose-600'; }

        return {
            highest: sorted.slice(0, 5),
            lowest: sorted.slice(-5).reverse(), // Most negative first
            positiveCount: positive.length,
            negativeCount: negative.length,
            avgFunding,
            sentiment,
            sentimentColor
        };
    }, [rates]);

    if (loading) return (
        <Card className="h-full border-zinc-800 bg-zinc-950/50 backdrop-blur-xl">
            <CardHeader><CardTitle className="text-sm font-medium text-zinc-400">Funding Rates</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-center h-[200px]">
                <Activity className="w-6 h-6 animate-spin text-zinc-600" />
            </CardContent>
        </Card>
    );

    if (!stats) return null;

    // Meter Calculation
    // Scale: -0.05% to 0.05% typically. Let's clamp for UI.
    // 0 is center (50%). 
    // Max range: +/- 0.1% (0.001)
    const meterPercent = Math.min(Math.max(((stats.avgFunding + 0.0005) / 0.001) * 100, 0), 100);

    return (
        <Card className="h-full border-zinc-800 bg-zinc-950/50 backdrop-blur-xl overflow-hidden flex flex-col">
            <CardHeader className="pb-2 border-b border-zinc-800/50">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                        <Activity className="w-4 h-4" /> Market Sentiment
                    </CardTitle>
                    <Badge variant="outline" className={`${stats.sentimentColor} border-zinc-800 bg-zinc-900/50`}>
                        {stats.sentiment}
                    </Badge>
                </div>
            </CardHeader>

            <div className="p-4 pb-0">
                {/* Meter UI */}
                <div className="relative h-4 bg-zinc-900 rounded-full overflow-hidden mb-1">
                    <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-zinc-600 z-10" /> {/* Zero Line */}
                    <div
                        className={`absolute top-0 bottom-0 transition-all duration-1000 ${stats.avgFunding > 0 ? 'bg-gradient-to-r from-green-900 to-green-500 left-1/2' : 'bg-gradient-to-l from-red-900 to-red-500 right-1/2'}`}
                        style={{
                            width: `${Math.abs(stats.avgFunding / 0.001 * 50)}%`, // Scale relative to center
                        }}
                    />
                </div>
                <div className="flex justify-between text-[10px] text-zinc-500 mb-4 px-1">
                    <span>Bearish (-0.1%)</span>
                    <span>Neutral</span>
                    <span>Bullish (+0.1%)</span>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-zinc-900/30 rounded p-2 text-center">
                        <div className="text-[10px] text-zinc-500">Avg Rate</div>
                        <div className={`text-sm font-mono ${stats.avgFunding > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {(stats.avgFunding * 100).toFixed(4)}%
                        </div>
                    </div>
                    <div className="bg-zinc-900/30 rounded p-2 text-center">
                        <div className="text-[10px] text-zinc-500">Long/Short Ratio</div>
                        {/* Proxy ratio using positive/negative count */}
                        <div className="text-sm font-mono text-zinc-300">
                            {stats.positiveCount}/{stats.negativeCount}
                        </div>
                    </div>
                </div>
            </div>

            <CardContent className="flex-1 p-0">
                <Tabs defaultValue="high" className="w-full h-full flex flex-col">
                    <TabsList className="w-full justify-start rounded-none border-b border-zinc-800 bg-transparent p-0">
                        <TabsTrigger
                            value="high"
                            className="flex-1 rounded-none border-b-2 border-transparent px-4 py-2 text-xs text-zinc-500 data-[state=active]:border-green-500 data-[state=active]:text-green-500 data-[state=active]:bg-transparent"
                        >
                            High Funding
                        </TabsTrigger>
                        <TabsTrigger
                            value="low"
                            className="flex-1 rounded-none border-b-2 border-transparent px-4 py-2 text-xs text-zinc-500 data-[state=active]:border-red-500 data-[state=active]:text-red-500 data-[state=active]:bg-transparent"
                        >
                            Negative
                        </TabsTrigger>
                    </TabsList>

                    <div className="flex-1 overflow-auto max-h-[250px] p-0">
                        <TabsContent value="high" className="m-0">
                            <ul className="divide-y divide-zinc-800/50">
                                {stats.highest.map(rate => (
                                    <li key={rate.symbol} className="flex justify-between items-center p-3 hover:bg-zinc-900/30 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-medium text-zinc-300">{rate.symbol.replace('USDT', '')}</span>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs font-mono text-green-400">{(rate.fundingRate * 100).toFixed(4)}%</div>
                                            <div className="text-[10px] text-zinc-600">APR: {(rate.annualized).toFixed(1)}%</div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </TabsContent>
                        <TabsContent value="low" className="m-0">
                            <ul className="divide-y divide-zinc-800/50">
                                {stats.lowest.map(rate => (
                                    <li key={rate.symbol} className="flex justify-between items-center p-3 hover:bg-zinc-900/30 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-medium text-zinc-300">{rate.symbol.replace('USDT', '')}</span>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs font-mono text-red-400">{(rate.fundingRate * 100).toFixed(4)}%</div>
                                            <div className="text-[10px] text-zinc-600">APR: {(rate.annualized).toFixed(1)}%</div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </TabsContent>
                    </div>
                </Tabs>
            </CardContent>
        </Card>
    );
}
