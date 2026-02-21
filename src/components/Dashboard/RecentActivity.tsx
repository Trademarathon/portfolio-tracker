"use client";

import { useState, CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { Position, Transaction } from "@/lib/api/types";
import { UnifiedActivity } from "@/lib/api/transactions";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, ShoppingCart, Activity, ArrowRightLeft, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { List } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';

interface RecentActivityProps {
    positions: Position[];
    activities: UnifiedActivity[];
    loading?: boolean;
}

type TabType = "positions" | "recent-buys" | "all-activity";

export function RecentActivity({ positions, activities, loading }: RecentActivityProps) {
    const [activeTab, setActiveTab] = useState<TabType>("positions");

    // Filter recent buy transactions (last 20)
    const recentBuys = activities
        .filter(tx => tx.activityType === 'trade' && (tx as Transaction).side === "buy")
        .slice(0, 20) as (Transaction & { activityType: 'trade' })[];

    // Virtualize All Activity - Remove slice limit or increase significantly
    const allActivity = activities;

    const tabs = [
        { id: "positions" as TabType, label: "Open Positions", count: positions.length, icon: TrendingUp },
        { id: "recent-buys" as TabType, label: "Recent Buys", count: recentBuys.length, icon: ShoppingCart },
        { id: "all-activity" as TabType, label: "All Activity", count: allActivity.length, icon: Activity },
    ];

    if (loading) {
        return <div className="animate-pulse h-[500px] bg-zinc-900 rounded-xl border border-white/5" />;
    }

    const ActivityRow = ({ index, style }: { index: number, style: CSSProperties }) => {
        const act = allActivity[index];
        const isTrade = act.activityType === 'trade' || (act as any).type === 'Buy' || (act as any).type === 'Sell';
        const isInternal = act.activityType === 'internal';
        const isTransfer = act.activityType === 'transfer' || (act as any).type === 'Deposit' || (act as any).type === 'Withdraw';

        const side = (act as any).side || (act as any).type || 'UNKNOWN';
        const typeLabel = isTrade
            ? String(side || '').toUpperCase()
            : isInternal
                ? 'INTERNAL'
                : String(((act as any).type || 'UNKNOWN') || '').toUpperCase();
        let typeColor = 'text-zinc-500';
        let Icon = Activity;

        if (isTrade) {
            const s = side.toLowerCase();
            typeColor = (s === 'buy' || s === 'long') ? 'text-emerald-500' : 'text-red-500';
            Icon = (s === 'buy' || s === 'long') ? ShoppingCart : TrendingDown;
        } else if (isInternal) {
            typeColor = 'text-blue-500';
            Icon = ArrowRightLeft;
        } else if (isTransfer) {
            const type = (act as any).type;
            typeColor = type === 'Deposit' ? 'text-emerald-500' : 'text-orange-500';
            Icon = type === 'Deposit' ? ArrowDownLeft : ArrowUpRight;
        }

        const symbol = isTrade ? ((act as any).symbol || (act as any).asset || 'UNKNOWN') : act.asset;
        const amount = act.amount;

        let details = '';
        if (isTrade) {
            details = `@ $${((act as any).price || 0).toLocaleString()}`;
        } else if (isInternal) {
            details = `${(act as any).from} → ${(act as any).to}`;
        } else if (isTransfer) {
            details = (act as any).address ? `${(act as any).address.slice(0, 6)}...` : '-';
        }

        return (
            <div style={style}>
                <div
                    onClick={() => window.location.href = `/asset/${symbol.replace('/USDT', '')}`}
                    className="flex items-center h-full border-b border-white/5 hover:bg-white/5 transition-colors px-3 text-sm cursor-pointer"
                >
                    <div className="w-[100px] text-zinc-500 font-mono text-xs shrink-0">
                        {format(act.timestamp, 'MM/dd HH:mm')}
                    </div>
                    <div className={cn("w-[100px] font-bold text-xs flex items-center gap-1.5 shrink-0", typeColor)}>
                        <Icon className="w-3 h-3" />
                        {typeLabel}
                    </div>
                    <div className="w-[120px] flex items-center gap-2 shrink-0">
                        <TokenIcon symbol={symbol.replace('/USDT', '')} size={16} />
                        <span className="font-bold text-white text-xs truncate">{symbol}</span>
                    </div>
                    <div className="w-[100px] text-right text-zinc-300 font-mono text-xs shrink-0">
                        {amount}
                    </div>
                    <div className="flex-1 text-xs text-zinc-400 px-3 truncate">
                        {details}
                    </div>
                    <div className="w-[80px] text-right text-xs text-zinc-500 uppercase shrink-0">
                        {(act as any).status || 'Completed'}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <Card className="border-white/10 bg-zinc-950/50 backdrop-blur-xl overflow-hidden flex flex-col h-[500px]">
            <CardHeader className="pb-3 shrink-0">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-zinc-400">
                    Activity Feed
                </CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0 flex-1 flex flex-col min-h-0">
                {/* Tab Navigation */}
                <div className="flex gap-2 px-4 mb-4 border-b border-white/5 shrink-0">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "relative px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all",
                                    activeTab === tab.id
                                        ? "text-white"
                                        : "text-zinc-500 hover:text-zinc-300"
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <Icon className="h-3.5 w-3.5" />
                                    <span>{tab.label}</span>
                                    <span className={cn(
                                        "px-1.5 py-0.5 rounded text-[10px] font-black",
                                        activeTab === tab.id
                                            ? "bg-primary/20 text-primary"
                                            : "bg-white/5 text-zinc-600"
                                    )}>
                                        {tab.count}
                                    </span>
                                </div>
                                {activeTab === tab.id && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Tab Content */}
                <div className="flex-1 min-h-0 px-0">
                    <AnimatePresence mode="wait">
                        {activeTab === "positions" && (
                            <motion.div
                                key="positions"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="h-full overflow-auto px-4 pb-4"
                            >
                                {positions.length === 0 ? (
                                    <div className="text-center py-12 text-zinc-500 text-sm">
                                        No open positions found.
                                    </div>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead className="text-xs text-zinc-500 uppercase bg-white/5 sticky top-0 z-10">
                                            <tr>
                                                <th className="px-3 py-2.5 text-left">Symbol</th>
                                                <th className="px-3 py-2.5 text-left">Side</th>
                                                <th className="px-3 py-2.5 text-right">Size</th>
                                                <th className="px-3 py-2.5 text-right">Entry</th>
                                                <th className="px-3 py-2.5 text-right">Mark</th>
                                                <th className="px-3 py-2.5 text-right">PnL</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {positions.map((pos, idx) => (
                                                <tr
                                                    key={`${pos.symbol}-${idx}`}
                                                    onClick={() => window.location.href = `/asset/${pos.symbol.replace(/USDT|PERP|-USD/g, '')}`}
                                                    className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                                                >
                                                    <td className="px-3 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <TokenIcon symbol={pos.symbol.replace(/USDT|PERP|-USD/g, '')} size={20} />
                                                            <span className="font-bold text-white">{pos.symbol}</span>
                                                        </div>
                                                    </td>
                                                    <td className={cn(
                                                        "px-3 py-3 font-black uppercase text-xs",
                                                        pos.side === 'long' ? "text-emerald-500" : "text-red-500"
                                                    )}>
                                                        {pos.side}
                                                    </td>
                                                    <td className="px-3 py-3 text-right text-zinc-300">{pos.size}</td>
                                                    <td className="px-3 py-3 text-right text-zinc-400 font-mono text-xs">
                                                        ${pos.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="px-3 py-3 text-right text-zinc-400 font-mono text-xs">
                                                        ${(pos.markPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className={cn(
                                                        "px-3 py-3 text-right font-bold",
                                                        (pos.pnl || 0) >= 0 ? "text-emerald-500" : "text-red-500"
                                                    )}>
                                                        ${(pos.pnl || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </motion.div>
                        )}

                        {activeTab === "recent-buys" && (
                            <motion.div
                                key="recent-buys"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="h-full overflow-auto px-4 pb-4"
                            >
                                { /* ... existing table for recent buys ... */}
                                {recentBuys.length === 0 ? (
                                    <div className="text-center py-12 text-zinc-500 text-sm">No recent buys.</div>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead className="text-xs text-zinc-500 uppercase bg-white/5 sticky top-0 z-10">
                                            <tr>
                                                <th className="px-3 py-2.5 text-left">Time</th>
                                                <th className="px-3 py-2.5 text-left">Symbol</th>
                                                <th className="px-3 py-2.5 text-right">Price</th>
                                                <th className="px-3 py-2.5 text-right">Amount</th>
                                                <th className="px-3 py-2.5 text-right">Total</th>
                                                <th className="px-3 py-2.5 text-left">Source</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {recentBuys.map((tx) => (
                                                <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                    <td className="px-3 py-3 text-zinc-500 font-mono text-xs">
                                                        {format(tx.timestamp, 'MM/dd HH:mm')}
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <TokenIcon symbol={tx.symbol} size={20} />
                                                            <span className="font-bold text-white">{tx.symbol}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 text-right text-zinc-400 font-mono text-xs">
                                                        ${(tx.price || 0).toLocaleString()}
                                                    </td>
                                                    <td className="px-3 py-3 text-right text-zinc-300">
                                                        {tx.amount}
                                                    </td>
                                                    <td className="px-3 py-3 text-right font-bold text-emerald-500">
                                                        ${((tx.price || 0) * tx.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="px-3 py-3 text-xs text-zinc-500">
                                                        {tx.exchange}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </motion.div>
                        )}

                        {activeTab === "all-activity" && (
                            <motion.div
                                key="all-activity"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="h-full flex flex-col"
                            >
                                <div className="flex items-center h-10 border-b border-white/5 bg-white/5 text-zinc-500 text-xs font-medium uppercase tracking-wider px-3 shrink-0">
                                    <div className="w-[100px]">Time</div>
                                    <div className="w-[100px]">Type</div>
                                    <div className="w-[120px]">Asset</div>
                                    <div className="w-[100px] text-right">Amount</div>
                                    <div className="flex-1 px-3">Details</div>
                                    <div className="w-[80px] text-right">Status</div>
                                </div>
                                <div className="flex-1 min-h-0">
                                    <AutoSizer renderProp={({ height, width }: { height: number | undefined; width: number | undefined }) => (
                                        <List<{}>
                                            rowCount={allActivity.length}
                                            rowHeight={50}
                                            rowComponent={ActivityRow}
                                            rowProps={{}}
                                            style={{ height, width }}
                                            className="custom-scrollbar"
                                        />
                                    )} />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </CardContent>
        </Card>
    );
}
