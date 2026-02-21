"use client";

import { useMemo } from 'react';
import { List } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';
import { ExchangeIcon } from '@/components/ui/ExchangeIcon';
import { motion } from 'framer-motion';

interface SpotOrder {
    id: string;
    symbol: string;
    assetName?: string;
    type: string;
    side: 'buy' | 'sell';
    price: number;
    amount: number;
    filled: number;
    remaining: number;
    status: string;
    timestamp: number;
    exchange: string;
    connectionName: string;
}

interface SpotOrdersTableProps {
    orders: SpotOrder[];
    prices: Record<string, number>;
}

import { getTokenName } from "@/lib/token-metadata";
import { cn } from "@/lib/utils";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { BarChart3 } from "lucide-react";

// Filter to only show spot orders (exclude perps/futures)
const isSpotOrder = (order: SpotOrder) => {
    // If order has explicit isPerp flag, use it
    if ((order as any).isPerp === true) return false;
    if ((order as any).isPerp === false) return true;
    
    const symbol = order.symbol || '';
    
    // Hyperliquid spot symbols start with @ (token indices)
    if (symbol.startsWith('@')) return true;
    
    // Check for common futures/perp patterns
    const s = symbol.toUpperCase();
    if (s.includes('PERP') || s.includes('-SWAP') || s.includes('_PERP')) return false;
    if (s.startsWith('1000')) return false; // Multiplied tokens like 1000PEPE
    if (s.includes('_')) return false; // Futures often use underscores
    
    // Check exchange type - Hyperliquid non-@ symbols are perps
    const exchange = (order.exchange || order.connectionName || '').toLowerCase();
    if (exchange.includes('hyperliquid') && !symbol.startsWith('@')) {
        return false;
    }
    
    return true; // Default to spot
};

export function SpotOrdersTable({ orders, prices }: SpotOrdersTableProps) {
    const { setSelectedChart } = usePortfolio();
    
    // Filter to only show spot orders
    const spotOnlyOrders = useMemo(() => {
        return orders.filter(isSpotOrder);
    }, [orders]);
    
    const sortedOrders = useMemo(() => {
        return [...spotOnlyOrders].sort((a, b) => b.timestamp - a.timestamp);
    }, [spotOnlyOrders]);

    if (sortedOrders.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                <p className="text-sm font-medium">No open spot orders</p>
                <p className="text-xs text-zinc-600">Your spot limit orders will appear here</p>
            </div>
        );
    }

    const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
        const order = sortedOrders[index];
        if (!order) return null;

        const isBuy = order.side === 'buy';
        const currentPrice = prices && order.symbol ? prices[order.symbol] || 0 : 0;
        let distance = 0;
        if (currentPrice > 0 && order.price) {
            distance = ((currentPrice - order.price) / currentPrice) * 100;
        }

        return (
            <div style={style} className="px-4">
                <div
                    className="flex items-center h-full py-2 border-b border-white/5 hover:bg-white/[0.02] transition-colors group cursor-pointer"
                    onClick={() => setSelectedChart({
                        symbol: order.symbol,
                        entryPrice: order.price,
                        side: order.side
                    })}
                >
                    {/* Expand icon placeholder */}
                    <div className="w-[32px] mx-2 flex items-center justify-center">
                        <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold",
                            isBuy ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                        )}>
                            {order.symbol?.charAt(0) || '?'}
                        </div>
                    </div>
                    
                    {/* Asset */}
                    <div className="flex-[2] min-w-[180px] flex items-center gap-3">
                        <div className="relative">
                            <ExchangeIcon exchange={order.connectionName || order.exchange || 'Unknown'} size={28} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-sm">
                                    {order.assetName && order.assetName !== order.symbol ? order.assetName : (order.symbol ? getTokenName(order.symbol) : 'Unknown')}
                                </span>
                                <BarChart3 className="h-3 w-3 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{order.symbol || '---'}</span>
                                <span className="text-[8px] bg-zinc-800/80 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-700/50">
                                    {order.connectionName || order.exchange || 'Exchange'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Side / Type */}
                    <div className="flex-[1.2] text-right hidden md:block">
                        <span className={cn(
                            "font-bold text-sm",
                            isBuy ? "text-emerald-400" : "text-rose-400"
                        )}>
                            {order.side?.toUpperCase() || '---'}
                        </span>
                        <div className="text-[10px] text-zinc-500">{order.type?.toUpperCase() || '---'}</div>
                    </div>

                    {/* Price / Distance */}
                    <div className="flex-1 text-right hidden md:block">
                        <div className="text-white font-bold text-sm">
                            ${(order.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                        </div>
                        {currentPrice > 0 && (
                            <div className={cn("text-[10px] font-medium", distance > 0 ? "text-emerald-500" : "text-rose-500")}>
                                {Math.abs(distance).toFixed(2)}% away
                            </div>
                        )}
                    </div>

                    {/* Amount */}
                    <div className="flex-1 text-right">
                        <div className="text-white font-medium text-sm">{(order.amount || 0).toLocaleString()}</div>
                        <div className="text-[10px] text-zinc-500">Amount</div>
                    </div>

                    {/* Progress */}
                    <div className="w-[80px] text-right ml-4">
                        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                                className={cn(
                                    "h-full rounded-full transition-all",
                                    isBuy ? "bg-emerald-500" : "bg-rose-500"
                                )}
                                style={{ width: `${order.amount ? (order.filled / order.amount) * 100 : 0}%` }}
                            />
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-1">
                            {order.amount ? ((order.filled / order.amount) * 100).toFixed(1) : '0.0'}% Filled
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="w-full h-full flex flex-col">
            {/* Header - matching Assets table style */}
            <div className="flex items-center h-10 border-b border-white/5 bg-white/5 text-zinc-500 text-[10px] font-bold uppercase tracking-widest px-4">
                <div className="w-[32px] mx-2"></div>
                <div className="flex-[2] min-w-[180px]">Asset / Source</div>
                <div className="flex-[1.2] text-right hidden md:block">Side / Type</div>
                <div className="flex-1 text-right hidden md:block">Price / Dist</div>
                <div className="flex-1 text-right">Amount</div>
                <div className="w-[80px] text-right ml-4">Progress</div>
            </div>
            
            {/* Rows */}
            <div className="flex-1 min-h-0">
                <AutoSizer renderProp={({ height, width }: { height: number | undefined; width: number | undefined }) => (
                    <List<{}>
                        rowCount={sortedOrders.length}
                        rowHeight={65}
                        rowComponent={Row}
                        rowProps={{}}
                        style={{ height: height || 400, width: width || 800 }}
                        className="custom-scrollbar"
                    />
                )} />
            </div>
        </div>
    );
}
