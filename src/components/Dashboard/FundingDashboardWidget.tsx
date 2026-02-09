"use client";

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Banknote, TrendingUp, TrendingDown, Clock, Percent } from 'lucide-react';
import { Position } from '@/lib/api/types';

interface FundingData {
    symbol: string;
    fundingRate: number;
    nextFunding: number; // timestamp
    accruedFunding?: number;
}

interface FundingDashboardProps {
    positions: Position[];
    fundingRates?: Record<string, number>;
}

export function FundingDashboard({ positions, fundingRates = {} }: FundingDashboardProps) {
    // Calculate funding for each position
    const positionsWithFunding = useMemo(() => {
        return positions.map(pos => {
            const symbol = pos.symbol.replace('-PERP', '').replace('/USDT', '');
            const rate = fundingRates[symbol] || (pos as any).fundingRate || 0;
            const markPrice = pos.markPrice || pos.entryPrice || 0;
            const notional = Math.abs(pos.size * markPrice);

            // Funding is paid/received based on position direction
            // If long and rate > 0, you PAY funding
            // If short and rate > 0, you RECEIVE funding
            const isLong = pos.size > 0;
            const hourlyFunding = notional * (rate / 100);
            const estimatedDaily = hourlyFunding * 3; // 3 funding periods per day

            return {
                ...pos,
                symbol,
                rate,
                notional,
                isLong,
                willPay: (isLong && rate > 0) || (!isLong && rate < 0),
                hourlyFunding: Math.abs(hourlyFunding),
                estimatedDaily
            };
        }).sort((a, b) => Math.abs(b.rate) - Math.abs(a.rate));
    }, [positions, fundingRates]);

    // Aggregate stats
    const stats = useMemo(() => {
        let totalPaying = 0;
        let totalReceiving = 0;

        positionsWithFunding.forEach(p => {
            if (p.willPay) {
                totalPaying += p.hourlyFunding;
            } else {
                totalReceiving += p.hourlyFunding;
            }
        });

        return {
            netHourly: totalReceiving - totalPaying,
            netDaily: (totalReceiving - totalPaying) * 3,
            paying: totalPaying * 3,
            receiving: totalReceiving * 3
        };
    }, [positionsWithFunding]);

    // Time until next funding
    const timeToNextFunding = useMemo(() => {
        const now = new Date();
        const hours = now.getUTCHours();
        const nextFundingHour = [0, 8, 16].find(h => h > hours) || 24;
        const hoursUntil = nextFundingHour - hours;
        const minutesUntil = 60 - now.getUTCMinutes();

        return { hours: hoursUntil > 0 ? hoursUntil - 1 : 23, minutes: minutesUntil };
    }, []);

    return (
        <Card className="h-full bg-zinc-900/80 backdrop-blur-xl border-zinc-800/50 overflow-hidden">
            <CardHeader className="py-3 border-b border-white/5">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                        <Banknote className="w-4 h-4 text-purple-500" />
                        Funding Rates
                    </CardTitle>

                    {/* Next Funding Countdown */}
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                        <Clock className="w-3 h-3" />
                        <span>Next in {timeToNextFunding.hours}h {timeToNextFunding.minutes}m</span>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-3 space-y-3">
                {/* Net Funding Summary */}
                <div className={cn(
                    "p-3 rounded-lg flex items-center justify-between",
                    stats.netDaily >= 0
                        ? "bg-emerald-500/10 border border-emerald-500/20"
                        : "bg-rose-500/10 border border-rose-500/20"
                )}>
                    <div>
                        <div className="text-[10px] text-zinc-500 uppercase font-bold">Est. Daily Net</div>
                        <div className={cn(
                            "text-xl font-bold font-mono",
                            stats.netDaily >= 0 ? "text-emerald-400" : "text-rose-400"
                        )}>
                            {stats.netDaily >= 0 ? '+' : ''}{stats.netDaily.toFixed(2)}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="flex items-center gap-2 text-[10px]">
                            <span className="text-emerald-500">↓ ${stats.receiving.toFixed(2)}</span>
                            <span className="text-rose-500">↑ ${stats.paying.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* Per Position Breakdown */}
                {positionsWithFunding.length === 0 ? (
                    <div className="text-center text-zinc-500 py-8">
                        <Percent className="w-6 h-6 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No open positions</p>
                    </div>
                ) : (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto scrollbar-hide">
                        {positionsWithFunding.map((pos, i) => (
                            <motion.div
                                key={pos.symbol}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="flex items-center justify-between p-2 rounded bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <div className={cn(
                                        "w-1 h-8 rounded-full",
                                        pos.willPay ? "bg-rose-500" : "bg-emerald-500"
                                    )} />
                                    <div>
                                        <div className="font-bold text-sm text-white flex items-center gap-1.5">
                                            {pos.symbol}
                                            <span className={cn(
                                                "text-[9px] px-1 py-0.5 rounded",
                                                pos.isLong ? "bg-emerald-500/20 text-emerald-500" : "bg-rose-500/20 text-rose-500"
                                            )}>
                                                {pos.isLong ? 'LONG' : 'SHORT'}
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-zinc-500">
                                            ${pos.notional.toLocaleString(undefined, { maximumFractionDigits: 0 })} notional
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={cn(
                                        "text-sm font-mono font-bold",
                                        pos.rate > 0
                                            ? (pos.isLong ? "text-rose-400" : "text-emerald-400")
                                            : (pos.isLong ? "text-emerald-400" : "text-rose-400")
                                    )}>
                                        {pos.rate >= 0 ? '+' : ''}{pos.rate.toFixed(4)}%
                                    </div>
                                    <div className={cn(
                                        "text-[10px]",
                                        pos.willPay ? "text-rose-500" : "text-emerald-500"
                                    )}>
                                        {pos.willPay ? '-' : '+'}${pos.hourlyFunding.toFixed(2)}/8h
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
