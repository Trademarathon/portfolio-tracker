"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { JournalTrade, useJournal } from "@/contexts/JournalContext";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { format } from "date-fns";
import { ChevronDown, TrendingUp, TrendingDown, FileText } from "lucide-react";
import { normalizeSymbol } from "@/lib/utils/normalization";

interface RecentTradesProps {
    trades: JournalTrade[];
}

function TradeRow({ trade }: { trade: JournalTrade }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const { preferences } = useJournal();

    const isLong = trade.side === 'buy' || (trade.side as string) === 'long';
    const pnl = trade.realizedPnl || 0;
    const isProfit = pnl >= 0;
    const displaySymbol = normalizeSymbol(trade.symbol || (trade as unknown as { rawSymbol?: string }).rawSymbol || '');
    const tradeNotional = Number((trade as unknown as { cost?: number }).cost || 0) > 0
        ? Number((trade as unknown as { cost?: number }).cost || 0)
        : (trade.amount * trade.price);

    // Calculate hold time
    const holdTime = trade.holdTime || 0;
    const formatHoldTime = (ms: number) => {
        if (ms === 0) return "N/A";
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        if (hours >= 24) {
            const days = Math.floor(hours / 24);
            return `${days}d ${hours % 24}h`;
        }
        return `${hours}h ${minutes}m`;
    };

    // Hold time badge color
    const getHoldTimeBadgeColor = (ms: number) => {
        const hours = ms / (1000 * 60 * 60);
        if (hours < 1) return "bg-emerald-500/20 text-emerald-400";
        if (hours < 4) return "bg-blue-500/20 text-blue-400";
        if (hours < 24) return "bg-amber-500/20 text-amber-400";
        return "bg-purple-500/20 text-purple-400";
    };

    // Format values
    const formatPrice = (value: number) => {
        if (preferences.hideBalances) return "••••";
        return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatPnL = (value: number) => {
        if (preferences.hideBalances) return "••••";
        const prefix = value >= 0 ? '+' : '';
        return `${prefix}$${Math.abs(value).toFixed(2)}`;
    };

    const mae = Number(trade.mae);
    const mfe = Number(trade.mfe);
    const hasMae = Number.isFinite(mae) && Math.abs(mae) > 0;
    const hasMfe = Number.isFinite(mfe) && Math.abs(mfe) > 0;

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.16 }}
        >
            {/* Main Row */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                className="grid grid-cols-12 gap-4 items-center py-4 px-4 hover:bg-zinc-800/30 rounded-xl cursor-pointer transition-colors"
            >
                {/* Symbol */}
                <div className="col-span-2 flex items-center gap-3">
                    <TokenIcon symbol={displaySymbol} size={32} />
                    <span className="font-bold text-white">{displaySymbol || 'UNKNOWN'}</span>
                </div>

                {/* Side & Size */}
                <div className="col-span-1">
                    <div className="flex items-center gap-1.5">
                        {isLong ? (
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                            <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                        )}
                        <span className={cn(
                            "text-sm font-bold",
                            isLong ? "text-emerald-400" : "text-rose-400"
                        )}>
                            {formatPrice(tradeNotional)}
                        </span>
                    </div>
                </div>

                {/* Open & Close Times */}
                <div className="col-span-2">
                    <div className="text-xs">
                        <p className="text-zinc-400">{format(trade.timestamp, "MMM d, hh:mm a")}</p>
                        {trade.exitTime && (
                            <p className="text-zinc-500">{format(trade.exitTime, "MMM d, hh:mm a")}</p>
                        )}
                    </div>
                </div>

                {/* Hold Time */}
                <div className="col-span-1">
                    <span className={cn(
                        "px-2 py-1 rounded-lg text-xs font-bold",
                        getHoldTimeBadgeColor(holdTime)
                    )}>
                        {formatHoldTime(holdTime)}
                    </span>
                </div>

                {/* Entry & Exit */}
                <div className="col-span-2">
                    <div className="text-xs">
                        <p className="text-zinc-300">{formatPrice(trade.entryPrice || trade.price)}</p>
                        {trade.exitPrice && (
                            <p className="text-zinc-500">→ {formatPrice(trade.exitPrice)}</p>
                        )}
                    </div>
                </div>

                {/* MAE */}
                <div className="col-span-1 text-xs text-zinc-400">
                    {hasMae ? formatPrice(Math.abs(mae)) : "N/A"}
                </div>

                {/* MFE */}
                <div className="col-span-1 text-xs text-zinc-400">
                    {hasMfe ? formatPrice(Math.abs(mfe)) : "N/A"}
                </div>

                {/* PnL */}
                <div className="col-span-1">
                    <span className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold",
                        isProfit ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                    )}>
                        {formatPnL(pnl)}
                    </span>
                </div>

                {/* Expand */}
                <div className="col-span-1 flex justify-end">
                    <ChevronDown className={cn(
                        "w-4 h-4 text-zinc-500 transition-transform",
                        isExpanded && "rotate-180"
                    )} />
                </div>
            </div>

            {/* Expanded Details */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-4">
                            <div className="p-4 rounded-xl bg-zinc-800/30 border border-zinc-700/30">
                                <p className="text-sm text-zinc-400">
                                    Expand for full trade details including chart, targets, stops, and notes.
                                </p>
                                <Link
                                    href={`/journal/trades?id=${trade.id}`}
                                    className="inline-flex items-center gap-2 mt-3 text-xs text-emerald-400 hover:underline"
                                >
                                    View full details →
                                </Link>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

export function RecentTrades({ trades }: RecentTradesProps) {
    const { filteredTrades } = useJournal();
    const openPositions = filteredTrades.filter(t => t.isOpen);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16 }}
            className="neo-card neo-card-cool rounded-2xl bg-zinc-900/40 border border-white/10 overflow-hidden"
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h3 className="title-md text-zinc-500">Last 3 Trades</h3>
                {openPositions.length > 0 && (
                    <div className="flex items-center gap-4">
                        <span className="text-xs text-amber-400">{openPositions.length} open position{openPositions.length > 1 ? 's' : ''} was detected</span>
                        <Link
                            href="/journal/trades/open"
                            className="text-xs text-zinc-400 hover:text-white transition-colors"
                        >
                            Go to the Open positions page
                        </Link>
                    </div>
                )}
            </div>

            {/* Column Headers */}
            <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-white/10 text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-bold">
                <div className="col-span-2">Symbol</div>
                <div className="col-span-1">Side & Size</div>
                <div className="col-span-2">Open & Close Times</div>
                <div className="col-span-1">Hold Time</div>
                <div className="col-span-2">Entry & Exit</div>
                <div className="col-span-1">MAE</div>
                <div className="col-span-1">MFE</div>
                <div className="col-span-1">PnL</div>
                <div className="col-span-1"></div>
            </div>

            {/* Trade Rows */}
            <div className="dense-table divide-y divide-zinc-800/30">
                {trades.length > 0 ? (
                    trades.map((trade) => (
                        <TradeRow key={trade.id} trade={trade} />
                    ))
                ) : (
                    <div className="py-12 text-center text-zinc-500 text-sm">
                        No trades found
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-zinc-800/50 flex justify-center">
                <Link
                    href="/journal/trades"
                    className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors"
                >
                    <FileText className="w-4 h-4" />
                    Go to journal to see all trades
                </Link>
            </div>
        </motion.div>
    );
}
