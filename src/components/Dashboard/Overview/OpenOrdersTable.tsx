"use client";

import { Card, CardHeader } from "@/components/ui/card";
import { ListFilter, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { memo } from "react";

interface OpenOrdersTableProps {
    orders: any[]; // Using any[] for now to match usePortfolioData, will cast internally
    prices: Record<string, number>;
}

export const OpenOrdersTable = memo(({ orders, prices }: OpenOrdersTableProps) => {

    // Process and sort orders by distance to execution
    const processedOrders = orders.map((o: any) => {
        const currentPrice = prices[o.symbol] || 0;
        const distPercent = currentPrice > 0 ? Math.abs((o.price - currentPrice) / currentPrice) * 100 : 100;

        return {
            ...o,
            currentPrice,
            distPercent
        };
    }).sort((a, b) => a.distPercent - b.distPercent); // Closest first

    if (processedOrders.length === 0) {
        return (
            <Card className="rounded-xl bg-gradient-to-br from-zinc-950/90 to-zinc-900/90 border-white/10 overflow-hidden transition-all duration-300 hover:border-white/15 clone-card">
                <CardHeader className="py-3 px-4 border-b border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/20">
                            <ListFilter className="w-4 h-4 text-amber-400" />
                        </div>
                        <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Open Orders</h3>
                    </div>
                </CardHeader>
                <div className="h-[200px] flex flex-col items-center justify-center text-zinc-500 gap-2">
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                        <ListFilter className="w-5 h-5 opacity-50" />
                    </div>
                    <p className="text-xs font-medium">No active orders</p>
                </div>
            </Card>
        );
    }

    return (
        <Card className="rounded-xl bg-gradient-to-br from-zinc-950/90 to-zinc-900/90 border-white/10 overflow-hidden transition-all duration-300 hover:border-white/15 clone-card">
            <CardHeader className="py-3 px-4 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/20">
                        <Clock className="w-4 h-4 text-amber-400" />
                    </div>
                    <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-widest">Open Orders <span className="text-zinc-500 ml-1">({processedOrders.length})</span></h3>
                </div>
            </CardHeader>

            <div
                className="overflow-y-auto overflow-x-auto custom-scrollbar"
                style={{
                    minHeight: `${Math.max(180, 70 + processedOrders.length * 48)}px`,
                    maxHeight: `${Math.min(420, 110 + processedOrders.length * 48)}px`,
                }}
            >
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-zinc-500 uppercase bg-white/5 font-mono sticky top-0 backdrop-blur-md z-10">
                        <tr>
                            <th className="px-4 py-3 font-medium">Symbol</th>
                            <th className="px-4 py-3 font-medium text-right">Price</th>
                            <th className="px-4 py-3 font-medium text-right">Dist</th>
                            <th className="px-4 py-3 font-medium text-right">Qty</th>
                            <th className="px-4 py-3 font-medium text-right">Age</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {processedOrders.map((order: any, i: number) => {
                            const isBuy = order.side.toLowerCase() === 'buy' || order.side.toLowerCase() === 'bid';
                            const isClose = order.distPercent < 2;
                            const isNearMatch = order.distPercent < 3;
                            const isVeryClose = order.distPercent < 0.5;
                            const isAboutToFill = order.distPercent <= 0.8;

                            // Age calculation (older than 10 days)
                            const tenDaysInMs = 10 * 24 * 60 * 60 * 1000;
                            const isOld = order.timestamp && (Date.now() - order.timestamp > tenDaysInMs);

                            return (
                                <tr
                                    key={order.id || i}
                                    className={cn(
                                        "hover:bg-white/5 transition-colors relative",
                                        isVeryClose && "bg-indigo-500/5",
                                        isNearMatch && !isAboutToFill && "animate-pulse-slow shadow-[inset_0_0_24px_rgba(99,102,241,0.04)]",
                                        isAboutToFill && "animate-order-fill-row-glow bg-emerald-500/5 border-l-2 border-l-emerald-500/60"
                                    )}
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="font-bold text-zinc-200">{order.symbol}</div>
                                            {(order.isPerp || order.symbol.includes('PERP')) && (
                                                <span className="text-[8px] px-1 py-px bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded font-black uppercase">Perp</span>
                                            )}
                                        </div>
                                        <div className={cn("text-[10px] uppercase font-black w-fit px-1 rounded", isBuy ? "text-emerald-500 bg-emerald-500/10" : "text-rose-500 bg-rose-500/10")}>
                                            {order.type || 'Limit'} {order.side}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-zinc-300">
                                        ${(order.price || 0).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className={cn(
                                            "font-bold text-xs px-1.5 py-0.5 rounded w-fit ml-auto transition-all duration-1000 inline-flex items-center gap-1",
                                            isAboutToFill && "bg-emerald-500/25 text-emerald-300 animate-order-fill-glow ring-1 ring-emerald-400/25",
                                            !isAboutToFill && isNearMatch && "bg-indigo-500/20 text-indigo-300 shadow-[0_0_24px_-4px_rgba(99,102,241,0.2)] animate-pulse",
                                            !isAboutToFill && isClose && !isNearMatch && "text-white",
                                            !isAboutToFill && !isClose && !isNearMatch && "text-zinc-500"
                                        )}>
                                            {isAboutToFill && (
                                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                            )}
                                            {order.distPercent.toFixed(2)}%
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="text-zinc-200 font-mono text-xs">
                                            {order.amount.toLocaleString()}
                                        </div>
                                        <div className="text-[10px] text-zinc-500">
                                            ${(order.amount * order.price).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <span className={cn(
                                            "text-[10px] px-1.5 py-0.5 rounded transition-all duration-1000",
                                            isOld ? "bg-amber-500/20 text-amber-400 font-black shadow-[0_0_24px_-4px_rgba(245,158,11,0.2)] animate-pulse" : "text-zinc-600"
                                        )}>
                                            {order.timestamp ? formatDistanceToNow(order.timestamp, { addSuffix: true }).replace("about ", "") : '-'}
                                        </span>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </Card>
    );
});
