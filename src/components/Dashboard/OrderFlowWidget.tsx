"use client";

import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Activity, TrendingUp, TrendingDown, Zap, Users, BarChart3 } from 'lucide-react';

interface OrderFlowWidgetProps {
    trades: Array<{
        side: 'buy' | 'sell';
        amount: number;
        price: number;
        timestamp: number;
    }>;
    symbol?: string;
}

export function OrderFlowWidget({ trades, symbol = 'BTC' }: OrderFlowWidgetProps) {
    const [tapeSpeed, setTapeSpeed] = useState(0);

    // Calculate order flow metrics
    const metrics = useMemo(() => {
        const now = Date.now();
        const oneMinAgo = now - 60 * 1000;
        const fiveMinAgo = now - 5 * 60 * 1000;

        const recentTrades = trades.filter(t => t.timestamp > fiveMinAgo);
        const lastMinuteTrades = trades.filter(t => t.timestamp > oneMinAgo);

        let buyVolume = 0;
        let sellVolume = 0;
        let buyCount = 0;
        let sellCount = 0;
        let largeBuys = 0;
        let largeSells = 0;

        recentTrades.forEach(t => {
            const notional = t.amount * t.price;
            if (t.side === 'buy') {
                buyVolume += notional;
                buyCount++;
                if (notional > 10000) largeBuys++;
            } else {
                sellVolume += notional;
                sellCount++;
                if (notional > 10000) largeSells++;
            }
        });

        const totalVolume = buyVolume + sellVolume;
        const delta = buyVolume - sellVolume;
        const ratio = totalVolume > 0 ? (buyVolume / totalVolume) * 100 : 50;

        return {
            buyVolume,
            sellVolume,
            totalVolume,
            delta,
            ratio,
            buyCount,
            sellCount,
            largeBuys,
            largeSells,
            tradesPerMinute: lastMinuteTrades.length
        };
    }, [trades]);

    // Update tape speed indicator
    useEffect(() => {
        setTapeSpeed(metrics.tradesPerMinute);
    }, [metrics.tradesPerMinute]);

    // Determine flow bias
    const getBias = (): { label: string; color: string; icon: React.ReactNode } => {
        if (metrics.ratio > 60) return { label: 'Bullish', color: 'text-emerald-500', icon: <TrendingUp className="w-3 h-3" /> };
        if (metrics.ratio < 40) return { label: 'Bearish', color: 'text-rose-500', icon: <TrendingDown className="w-3 h-3" /> };
        return { label: 'Neutral', color: 'text-zinc-500', icon: <Activity className="w-3 h-3" /> };
    };

    const bias = getBias();

    return (
        <Card className="h-full bg-zinc-900/80 backdrop-blur-xl border-zinc-800/50 overflow-hidden">
            <CardHeader className="py-3 border-b border-white/5">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-cyan-500" />
                        Order Flow
                    </CardTitle>

                    {/* Flow Bias Indicator */}
                    <div className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold",
                        bias.color,
                        metrics.ratio > 55 && "bg-emerald-500/10",
                        metrics.ratio < 45 && "bg-rose-500/10",
                        metrics.ratio >= 45 && metrics.ratio <= 55 && "bg-zinc-800"
                    )}>
                        {bias.icon}
                        {bias.label}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-3 space-y-4">
                {/* Volume Delta */}
                <div className="text-center">
                    <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Volume Delta (5m)</div>
                    <div className={cn(
                        "text-2xl font-bold font-mono",
                        metrics.delta > 0 ? "text-emerald-400" : metrics.delta < 0 ? "text-rose-400" : "text-zinc-400"
                    )}>
                        {metrics.delta >= 0 ? '+' : ''}${(metrics.delta / 1000).toFixed(1)}k
                    </div>
                </div>

                {/* Buy/Sell Ratio Bar */}
                <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold">
                        <span className="text-emerald-500">BUY {metrics.ratio.toFixed(0)}%</span>
                        <span className="text-rose-500">SELL {(100 - metrics.ratio).toFixed(0)}%</span>
                    </div>
                    <div className="h-3 bg-zinc-800 rounded-full overflow-hidden flex">
                        <motion.div
                            className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full"
                            initial={{ width: '50%' }}
                            animate={{ width: `${metrics.ratio}%` }}
                            transition={{ duration: 0.5 }}
                        />
                        <motion.div
                            className="bg-gradient-to-r from-rose-400 to-rose-600 h-full"
                            initial={{ width: '50%' }}
                            animate={{ width: `${100 - metrics.ratio}%` }}
                            transition={{ duration: 0.5 }}
                        />
                    </div>
                </div>

                {/* Volume Breakdown */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <div className="text-[10px] text-emerald-500 font-bold uppercase">Buy Volume</div>
                        <div className="text-lg font-bold font-mono text-emerald-400">
                            ${(metrics.buyVolume / 1000).toFixed(1)}k
                        </div>
                        <div className="text-[10px] text-zinc-500">{metrics.buyCount} trades</div>
                    </div>
                    <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                        <div className="text-[10px] text-rose-500 font-bold uppercase">Sell Volume</div>
                        <div className="text-lg font-bold font-mono text-rose-400">
                            ${(metrics.sellVolume / 1000).toFixed(1)}k
                        </div>
                        <div className="text-[10px] text-zinc-500">{metrics.sellCount} trades</div>
                    </div>
                </div>

                {/* Tape Speed & Large Orders */}
                <div className="flex items-center justify-between p-2 bg-zinc-800/50 rounded-lg">
                    <div className="flex items-center gap-2">
                        <Zap className={cn(
                            "w-4 h-4",
                            tapeSpeed > 30 ? "text-amber-500 animate-pulse" : "text-zinc-500"
                        )} />
                        <div>
                            <div className="text-[10px] text-zinc-500 uppercase">Tape Speed</div>
                            <div className="text-sm font-bold text-white">{tapeSpeed}/min</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-center">
                            <div className="text-[10px] text-emerald-500 font-bold">{metrics.largeBuys}</div>
                            <div className="text-[8px] text-zinc-600">Whale Buys</div>
                        </div>
                        <div className="text-center">
                            <div className="text-[10px] text-rose-500 font-bold">{metrics.largeSells}</div>
                            <div className="text-[8px] text-zinc-600">Whale Sells</div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
