"use client";

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { Zap, ListFilter, BarChart2, LayoutGrid } from "lucide-react";
import { OpenOrdersTable } from "@/components/Dashboard/Overview/OpenOrdersTable";
import { RecentActivity } from "@/components/Dashboard/RecentActivity";
import { Transaction } from "@/lib/api/types";
import { UnifiedActivity } from "@/lib/api/transactions";
import { cn } from "@/lib/utils";

type MarketType = 'spot' | 'perp';

interface OrderManagementProps {
    symbol: string;
    /** Legacy: single positions array (treated as perp) */
    positions?: any[];
    /** Legacy: single orders array */
    orders?: any[];
    spotPositions?: any[];
    perpPositions?: any[];
    spotOrders?: any[];
    perpOrders?: any[];
    history?: UnifiedActivity[];
    currentPrice: number;
}

export function OrderManagement({
    symbol,
    positions: legacyPositions,
    orders: legacyOrders,
    spotPositions = [],
    perpPositions = [],
    spotOrders = [],
    perpOrders = [],
    history = [],
    currentPrice,
}: OrderManagementProps) {
    const [marketType, setMarketType] = useState<MarketType>('perp');

    // Support legacy props (positions/orders) - treat as perp
    const spotPos = spotPositions?.length ? spotPositions : [];
    const perpPos = (perpPositions?.length ? perpPositions : legacyPositions) ?? [];
    const spotOrd = spotOrders ?? [];
    const perpOrd = (perpOrders?.length ? perpOrders : legacyOrders) ?? [];

    const positions = marketType === 'spot' ? spotPos : perpPos;
    const orders = marketType === 'spot' ? spotOrd : perpOrd;

    const relevantHistory = useMemo(() => {
        return history.filter(h => {
            if (h.activityType === 'trade') {
                return (h as Transaction).symbol?.includes(symbol);
            }
            return false;
        });
    }, [history, symbol]);

    const prices: Record<string, number> = { [symbol]: currentPrice };

    return (
        <Card className="bg-[#141310] border-white/5 w-full h-full flex flex-col">
            <CardHeader className="px-4 py-3 border-b border-white/5 shrink-0">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-bold text-zinc-400 uppercase tracking-widest">
                            Positions & Open Orders
                        </CardTitle>
                        {/* Spot / Perp Toggle */}
                        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-white/5 border border-white/10">
                            <button
                                onClick={() => setMarketType('spot')}
                                className={cn(
                                    "px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all",
                                    marketType === 'spot'
                                        ? "bg-indigo-500 text-white shadow-sm"
                                        : "text-zinc-500 hover:text-zinc-300"
                                )}
                            >
                                <BarChart2 className="w-3 h-3 inline-block mr-1.5 -mt-0.5" />
                                Spot
                            </button>
                            <button
                                onClick={() => setMarketType('perp')}
                                className={cn(
                                    "px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all",
                                    marketType === 'perp'
                                        ? "bg-indigo-500 text-white shadow-sm"
                                        : "text-zinc-500 hover:text-zinc-300"
                                )}
                            >
                                <LayoutGrid className="w-3 h-3 inline-block mr-1.5 -mt-0.5" />
                                Perp
                            </button>
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-0 flex-1 min-h-0 overflow-hidden">
                <Tabs defaultValue="positions" className="h-full flex flex-col">
                    <div className="px-4 pt-2 pb-0 shrink-0">
                        <TabsList className="bg-white/5 h-8 justify-start">
                            <TabsTrigger value="positions" className="text-xs h-6 px-3 data-[state=active]:bg-indigo-500">
                                Positions ({positions.length})
                            </TabsTrigger>
                            <TabsTrigger value="orders" className="text-xs h-6 px-3 data-[state=active]:bg-indigo-500">
                                Open Orders ({orders.length})
                            </TabsTrigger>
                            <TabsTrigger value="history" className="text-xs h-6 px-3 data-[state=active]:bg-indigo-500">
                                History
                            </TabsTrigger>
                        </TabsList>
                    </div>
                    <TabsContent value="positions" className="h-full m-0 flex flex-col outline-none overflow-hidden">
                        <div className="flex-1 overflow-auto custom-scrollbar min-h-0">
                            {positions.length > 0 ? (
                                <div className="flex flex-col">
                                    {/* PnL summary for perp */}
                                    {marketType === 'perp' && positions.length > 0 && (
                                        <div className="px-4 py-3 border-b border-white/5 bg-gradient-to-b from-indigo-500/5 to-transparent">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-0.5">Total Unrealized PnL</div>
                                                    <span className={cn(
                                                        "text-lg font-black",
                                                        positions.reduce((acc: number, p: any) => acc + (p.pnl || 0), 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                                                    )}>
                                                        $ {positions.reduce((acc: number, p: any) => acc + (p.pnl || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                    </span>
                                                </div>
                                                <div className="text-right text-[10px] text-zinc-500">
                                                    Total Value: $ {positions.reduce((acc: number, p: any) => acc + (p.size || 0) * (p.entryPrice || currentPrice), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <table className="w-full text-[11px] text-left border-collapse">
                                        <thead className="text-[9px] text-zinc-500 uppercase font-black bg-[#0c0c0e]/80 border-b border-white/5 sticky top-0 z-20 backdrop-blur-md">
                                            <tr>
                                                <th className="px-4 py-2.5 font-black tracking-tighter">Symbol</th>
                                                <th className="px-3 py-2.5 font-black tracking-tighter text-right">Size</th>
                                                <th className="px-3 py-2.5 font-black tracking-tighter text-right">Entry / Mark</th>
                                                {marketType === 'perp' && (
                                                    <>
                                                        <th className="px-3 py-2.5 font-black tracking-tighter text-right text-amber-500/80">Liq.</th>
                                                        <th className="px-3 py-2.5 font-black tracking-tighter text-right">PnL</th>
                                                    </>
                                                )}
                                                <th className="px-4 py-2.5 font-black tracking-tighter text-right w-24">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/[0.03]">
                                            {positions.map((pos: any, idx: number) => {
                                                const posSize = Math.abs(pos.size || 0);
                                                const entryPrice = pos.entryPrice || currentPrice;
                                                const markPrice = pos.markPrice || currentPrice;
                                                const value = posSize * markPrice;
                                                const pnl = pos.pnl ?? (pos.side === 'short' ? (entryPrice - markPrice) * posSize : (markPrice - entryPrice) * posSize);
                                                const margin = marketType === 'perp' ? (posSize * entryPrice) / (pos.leverage || 10) : value;
                                                const roe = margin > 0 ? (pnl / margin) * 100 : 0;
                                                return (
                                                    <tr key={pos.id || idx} className="group hover:bg-white/[0.04] transition-all">
                                                        <td className="px-4 py-3">
                                                            <div className="flex flex-col gap-0.5">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-bold text-white">{symbol}</span>
                                                                    <span className={cn(
                                                                        "text-[8px] px-1.5 py-0.5 rounded font-black uppercase",
                                                                        (pos.side || 'long') === 'long' ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                                                                    )}>
                                                                        {pos.side || 'long'}
                                                                    </span>
                                                                    {marketType === 'perp' && pos.leverage && (
                                                                        <span className="text-[8px] text-zinc-500">{pos.leverage}x</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-3 text-right font-mono">
                                                            <div className="text-zinc-200 font-bold">{posSize.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
                                                            <div className="text-[9px] text-zinc-500">$ {value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                                        </td>
                                                        <td className="px-3 py-3 text-right font-mono text-zinc-300">
                                                            <div>$ {entryPrice.toLocaleString()}</div>
                                                            <div className="text-[9px] text-zinc-500">$ {markPrice.toLocaleString()}</div>
                                                        </td>
                                                        {marketType === 'perp' && (
                                                            <>
                                                                <td className="px-3 py-3 text-right font-mono text-amber-500/80 text-[10px]">
                                                                    {pos.liquidationPrice ? `$ ${pos.liquidationPrice.toLocaleString()}` : '—'}
                                                                </td>
                                                                <td className="px-3 py-3 text-right font-mono">
                                                                    <div className={cn("font-bold", pnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
                                                                        {pnl >= 0 ? '+' : ''}$ {Math.abs(pnl).toLocaleString()}
                                                                    </div>
                                                                    {pos.leverage && <div className="text-[9px] text-zinc-500">{roe >= 0 ? '+' : ''}{roe.toFixed(2)}% ROE</div>}
                                                                </td>
                                                            </>
                                                        )}
                                                        <td className="px-4 py-3 text-right">
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-zinc-500 p-8 space-y-4">
                                    <div className="p-4 rounded-full bg-white/5 border border-white/5">
                                        <Zap className="w-8 h-8 opacity-30" />
                                    </div>
                                    <p className="text-sm font-medium">No {marketType} positions for {symbol}</p>

                                </div>
                            )}
                        </div>
                        {positions.length > 0 && marketType === 'perp' && (
                            <div className="px-4 py-2 border-t border-white/5 bg-[#0c0c0e] flex items-center justify-between text-[10px] shrink-0">
                                <span className="text-zinc-500">UPnL:</span>
                                <span className={cn(
                                    "font-bold",
                                    positions.reduce((acc: number, p: any) => acc + (p.pnl || 0), 0) >= 0 ? "text-emerald-500" : "text-rose-500"
                                )}>
                                    $ {positions.reduce((acc: number, p: any) => acc + (p.pnl || 0), 0).toLocaleString()}
                                </span>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="orders" className="h-full m-0 overflow-auto outline-none">
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="h-full"
                        >
                            {orders.length > 0 ? (
                                <OpenOrdersTable orders={orders} prices={prices} />
                            ) : (
                                <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-zinc-500 p-8">
                                    <div className="p-4 rounded-full bg-white/5 border border-white/5 mb-3">
                                        <ListFilter className="w-8 h-8 opacity-30" />
                                    </div>
                                    <p className="text-sm font-medium">No {marketType} orders for {symbol}</p>
                                </div>
                            )}
                        </motion.div>
                    </TabsContent>

                    <TabsContent value="history" className="h-full m-0 overflow-auto outline-none">
                        <RecentActivity positions={[]} activities={relevantHistory} loading={false} />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
