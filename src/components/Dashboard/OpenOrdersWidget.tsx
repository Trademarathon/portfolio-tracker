"use client";

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion, AnimatePresence } from 'framer-motion';
import { ExchangeIcon } from '@/components/ui/ExchangeIcon';
import { TokenIcon } from '@/components/ui/TokenIcon';
import { cn } from '@/lib/utils';
import { ListOrdered, TrendingUp, TrendingDown, Clock, X } from 'lucide-react';
import { getTokenName } from '@/lib/token-metadata';
import { normalizeSymbol } from '@/lib/utils/normalization';

interface Order {
    id: string;
    symbol: string;
    assetName?: string;
    type: string;
    side: 'buy' | 'sell' | 'long' | 'short';
    price: number;
    amount: number;
    filled?: number;
    remaining?: number;
    status?: string;
    timestamp: number;
    exchange: string;
    connectionName?: string;
    // Perp specific
    leverage?: number;
    reduceOnly?: boolean;
}

interface OpenOrdersWidgetProps {
    spotOrders: Order[];
    perpOrders?: Order[];
    prices: Record<string, number>;
    onCancelOrder?: (orderId: string, exchange: string) => void;
}

type TabType = 'spot' | 'perp';

export function OpenOrdersWidget({ spotOrders, perpOrders = [], prices, onCancelOrder }: OpenOrdersWidgetProps) {
    const [activeTab, setActiveTab] = useState<TabType>('spot');

    const tabs = [
        { id: 'spot' as TabType, label: 'Spot', count: spotOrders.length },
        { id: 'perp' as TabType, label: 'Perp', count: perpOrders.length },
    ];

    const currentOrders = useMemo(() => {
        const orders = activeTab === 'spot' ? spotOrders : perpOrders;
        return [...orders].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
    }, [activeTab, spotOrders, perpOrders]);

    const getDistancePercent = (order: Order): number => {
        const symbol = normalizeSymbol((order as unknown as { rawSymbol?: string }).rawSymbol || order.symbol);
        const currentPrice = prices[symbol] || 0;
        if (currentPrice === 0) return 0;
        return ((currentPrice - order.price) / currentPrice) * 100;
    };

    const formatPrice = (price: number): string => {
        if (price >= 1000) return price.toLocaleString(undefined, { maximumFractionDigits: 0 });
        if (price >= 1) return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
        return price.toLocaleString(undefined, { maximumFractionDigits: 6 });
    };

    return (
        <Card className="h-full bg-zinc-900/80 backdrop-blur-xl border-zinc-800/50 overflow-hidden">
            <CardHeader className="py-3 border-b border-white/5">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                        <ListOrdered className="w-4 h-4 text-amber-500" />
                        Open Orders
                    </CardTitle>

                    {/* Tab Switcher */}
                    <div className="flex bg-zinc-800/50 rounded-lg p-0.5">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-md transition-all flex items-center gap-1.5",
                                    activeTab === tab.id
                                        ? "bg-zinc-700 text-white"
                                        : "text-zinc-500 hover:text-zinc-300"
                                )}
                            >
                                {tab.label}
                                <span className={cn(
                                    "px-1.5 py-0.5 rounded text-[10px]",
                                    activeTab === tab.id ? "bg-zinc-600" : "bg-zinc-800"
                                )}>
                                    {tab.count}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-0">
                {currentOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                        <ListOrdered className="w-8 h-8 mb-2 opacity-30" />
                        <p className="text-sm">No open {activeTab} orders</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        <AnimatePresence mode="popLayout">
                            {currentOrders.map((order, i) => {
                                // Stable side detection - normalize to lowercase once
                                const side = String(order.side || '').toLowerCase();
                                const isBuy = side === 'buy' || side === 'long';
                                const type = String(order.type || '').toUpperCase();
                                
                                // Safe price and amount handling
                                const price = Number(order.price) || 0;
                                const amount = Number(order.amount) || 0;
                                const filled = Number(order.filled) || 0;
                                
                                const distance = getDistancePercent(order);
                                const fillPercent = amount > 0 ? (filled / amount) * 100 : 0;
                                const symbol = normalizeSymbol((order as unknown as { rawSymbol?: string }).rawSymbol || order.symbol);

                                return (
                                    <motion.div
                                        key={order.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        transition={{ delay: Math.min(i * 0.05, 0.3) }}
                                        className="flex items-center justify-between p-3 hover:bg-white/5 transition-colors group"
                                    >
                                        {/* Left: Symbol + Side */}
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <div className="relative">
                                                <TokenIcon symbol={symbol} size={28} />
                                                <div className={cn(
                                                    "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center",
                                                    isBuy ? "bg-emerald-500" : "bg-rose-500"
                                                )}>
                                                    {isBuy
                                                        ? <TrendingUp className="w-2 h-2 text-white" />
                                                        : <TrendingDown className="w-2 h-2 text-white" />
                                                    }
                                                </div>
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-bold text-sm text-white truncate">
                                                    {order.assetName || getTokenName(symbol)}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[10px]">
                                                    <span className={cn(
                                                        "font-bold",
                                                        isBuy ? "text-emerald-500" : "text-rose-500"
                                                    )}>
                                                        {side.toUpperCase() || '-'}
                                                    </span>
                                                    <span className="text-zinc-600">•</span>
                                                    <span className="text-zinc-500">{type || '-'}</span>
                                                    {order.leverage && (
                                                        <>
                                                            <span className="text-zinc-600">•</span>
                                                            <span className="text-amber-500">{order.leverage}x</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Middle: Price + Distance */}
                                        <div className="flex flex-col items-end mx-3">
                                            <div className="font-mono text-sm text-white">
                                                ${formatPrice(price)}
                                            </div>
                                            {distance !== 0 && (
                                                <div className={cn(
                                                    "text-[10px] font-mono",
                                                    (isBuy && distance > 0) || (!isBuy && distance < 0)
                                                        ? "text-emerald-500"
                                                        : "text-zinc-500"
                                                )}>
                                                    {Math.abs(distance).toFixed(1)}% away
                                                </div>
                                            )}
                                        </div>

                                        {/* Right: Amount + Fill Bar */}
                                        <div className="flex flex-col items-end min-w-[60px]">
                                            <div className="text-xs text-zinc-300 font-mono">
                                                {amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                            </div>
                                            {fillPercent > 0 && (
                                                <div className="w-12 h-1 bg-zinc-800 rounded-full mt-1 overflow-hidden">
                                                    <div
                                                        className="h-full bg-emerald-500 rounded-full"
                                                        style={{ width: `${Math.min(fillPercent, 100)}%` }}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* Cancel Button (on hover) */}
                                        {onCancelOrder && (
                                            <button
                                                onClick={() => onCancelOrder(order.id, order.exchange)}
                                                className="ml-2 p-1 rounded hover:bg-rose-500/20 text-zinc-600 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}

                {/* Footer */}
                {currentOrders.length > 0 && (
                    <div className="px-3 py-2 border-t border-white/5 bg-zinc-900/50">
                        <div className="flex items-center justify-between text-[10px] text-zinc-500">
                            <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>Real-time</span>
                            </div>
                            <span>
                                {activeTab === 'spot' ? spotOrders.length : perpOrders.length} total orders
                            </span>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
