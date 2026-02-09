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

export function SpotOrdersTable({ orders, prices }: SpotOrdersTableProps) {
    const sortedOrders = useMemo(() => {
        return [...orders].sort((a, b) => b.timestamp - a.timestamp);
    }, [orders]);

    if (orders.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
                <p className="text-lg font-medium">No open spot orders</p>
                <p className="text-sm">Your limit orders will appear here</p>
            </div>
        );
    }

    const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
        const order = sortedOrders[index];
        const isBuy = order.side === 'buy';

        const currentPrice = prices[order.symbol] || 0;
        let distance = 0;
        if (currentPrice > 0) {
            distance = ((currentPrice - order.price) / currentPrice) * 100;
        }

        return (
            <div style={style} className="px-4">
                <div className="flex items-center justify-between py-3 border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors group">
                    <div className="flex items-center gap-3 w-1/4">
                        <ExchangeIcon exchange={order.connectionName} size={20} />
                        <div>
                            <div className="font-bold text-zinc-100">{order.assetName && order.assetName !== order.symbol ? order.assetName : getTokenName(order.symbol)}</div>
                            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{order.symbol}</div>
                        </div>
                    </div>

                    <div className="flex flex-col items-center w-1/6">
                        <span className={isBuy ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                            {order.side.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-zinc-500">{order.type.toUpperCase()}</span>
                    </div>

                    <div className="flex flex-col items-end w-1/6">
                        <div className="text-zinc-100 font-bold">${order.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</div>
                        {currentPrice > 0 && (
                            <div className={cn("text-[10px] font-medium", distance > 0 ? "text-emerald-500" : "text-rose-500")}>
                                {Math.abs(distance).toFixed(2)}% away
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col items-end w-1/6">
                        <div className="text-zinc-100">{order.amount.toLocaleString()}</div>
                        <div className="text-[10px] text-zinc-500">Amount</div>
                    </div>

                    <div className="flex flex-col items-end w-1/6">
                        <div className="w-16 h-1 bg-zinc-800 rounded-full overflow-hidden mt-1">
                            <div
                                className="h-full bg-emerald-500"
                                style={{ width: `${(order.filled / order.amount) * 100}%` }}
                            />
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-1">
                            {((order.filled / order.amount) * 100).toFixed(1)}% Filled
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="w-full h-[400px] bg-zinc-900/50 rounded-xl border border-zinc-800/50 overflow-hidden">
            <div className="flex items-center justify-between px-8 py-3 bg-zinc-800/30 border-b border-zinc-800 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                <div className="w-1/4 text-left">Asset / Source</div>
                <div className="w-1/6 text-center">Side / Type</div>
                <div className="w-1/6 text-right">Price / Dist</div>
                <div className="w-1/6 text-right">Amount</div>
                <div className="w-1/6 text-right">Progress</div>
            </div>
            <AutoSizer renderProp={({ height, width }: { height: number | undefined; width: number | undefined }) => (
                <List<{}>
                    rowCount={sortedOrders.length}
                    rowHeight={65}
                    rowComponent={Row}
                    rowProps={{}}
                    style={{ height: height || 400, width: width || 800 }}
                    className="scrollbar-hide"
                />
            )} />
        </div>
    );
}
