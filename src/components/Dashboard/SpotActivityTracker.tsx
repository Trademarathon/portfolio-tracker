"use client";

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from 'framer-motion';
import { TokenIcon } from '@/components/ui/TokenIcon';
import { cn } from '@/lib/utils';
import { Zap, Check, ArrowUpRight, ArrowDownLeft, Clock, Filter } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface Trade {
    id: string;
    symbol: string;
    side: 'buy' | 'sell';
    price: number;
    amount: number;
    timestamp: number;
    exchange: string;
    type?: string; // 'limit' | 'market'
    fee?: number;
    pnl?: number;
}

interface SpotActivityTrackerProps {
    trades: Trade[];
    maxItems?: number;
}

export function SpotActivityTracker({ trades, maxItems = 8 }: SpotActivityTrackerProps) {
    const spotTrades = useMemo(() => {
        return trades
            .filter(t => !t.symbol.includes('PERP') && !t.symbol.includes('-P'))
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, maxItems);
    }, [trades, maxItems]);

    // Stats
    const stats = useMemo(() => {
        const last24h = Date.now() - 24 * 60 * 60 * 1000;
        const recent = spotTrades.filter(t => t.timestamp > last24h);

        let limitFills = 0;
        let marketFills = 0;
        let totalVolume = 0;

        recent.forEach(t => {
            const notional = t.amount * t.price;
            totalVolume += notional;
            if (t.type === 'limit' || t.type === 'Limit') {
                limitFills++;
            } else {
                marketFills++;
            }
        });

        return {
            count: recent.length,
            limitFills,
            marketFills,
            volume: totalVolume
        };
    }, [spotTrades]);

    const formatPrice = (price: number): string => {
        if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
        if (price >= 1) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
        return `$${price.toLocaleString(undefined, { maximumFractionDigits: 6 })}`;
    };

    return (
        <Card className="h-full bg-zinc-900/80 backdrop-blur-xl border-zinc-800/50 overflow-hidden">
            <CardHeader className="py-3 border-b border-white/5">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-emerald-500" />
                        Spot Activity
                    </CardTitle>

                    {/* Quick Stats */}
                    <div className="flex items-center gap-3 text-[10px]">
                        <div className="flex items-center gap-1 text-emerald-500">
                            <Check className="w-3 h-3" />
                            <span className="font-bold">{stats.limitFills}</span>
                            <span className="text-zinc-600">limits</span>
                        </div>
                        <div className="flex items-center gap-1 text-zinc-500">
                            <span className="font-bold">${(stats.volume / 1000).toFixed(1)}k</span>
                            <span className="text-zinc-600">24h</span>
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-0">
                {spotTrades.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                        <Zap className="w-8 h-8 mb-2 opacity-30" />
                        <p className="text-sm">No recent spot trades</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5 max-h-[350px] overflow-y-auto scrollbar-hide">
                        {spotTrades.map((trade, i) => {
                            const isBuy = trade.side === 'buy';
                            const symbol = trade.symbol.replace('/USDT', '').replace('USDT', '');
                            const isLimit = trade.type === 'limit' || trade.type === 'Limit';
                            const notional = trade.amount * trade.price;

                            return (
                                <motion.div
                                    key={trade.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.03 }}
                                    className="flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
                                >
                                    {/* Left: Symbol + Type */}
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        <div className="relative">
                                            <TokenIcon symbol={symbol} size={28} />
                                            <div className={cn(
                                                "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center",
                                                isBuy ? "bg-emerald-500" : "bg-rose-500"
                                            )}>
                                                {isBuy
                                                    ? <ArrowDownLeft className="w-2 h-2 text-white" />
                                                    : <ArrowUpRight className="w-2 h-2 text-white" />
                                                }
                                            </div>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className={cn(
                                                    "text-xs font-bold",
                                                    isBuy ? "text-emerald-500" : "text-rose-500"
                                                )}>
                                                    {trade.side?.toUpperCase?.() || ''}
                                                </span>
                                                <span className="text-sm font-bold text-white">{symbol}</span>
                                                {isLimit && (
                                                    <span className="px-1 py-0.5 bg-amber-500/20 text-amber-500 text-[8px] font-bold rounded">
                                                        LIMIT
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-zinc-500 flex items-center gap-1">
                                                <Clock className="w-2.5 h-2.5" />
                                                {formatDistanceToNow(trade.timestamp, { addSuffix: true })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Price + Amount */}
                                    <div className="flex flex-col items-end text-right">
                                        <div className="text-sm font-mono text-white">
                                            {formatPrice(trade.price)}
                                        </div>
                                        <div className="text-[10px] text-zinc-500 font-mono">
                                            {trade.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} × ${notional.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
