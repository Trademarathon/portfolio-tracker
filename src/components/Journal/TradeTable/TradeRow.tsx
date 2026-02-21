"use client";

import { motion, AnimatePresence } from "framer-motion";
import { memo } from "react";
import { cn } from "@/lib/utils";
import { JournalTrade, JournalPreferences } from "@/contexts/JournalContext";
import { TradeDetails } from "./TradeDetails";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { format } from "date-fns";
import { ChevronDown, TrendingUp, TrendingDown } from "lucide-react";
import { normalizeSymbol } from "@/lib/utils/normalization";

interface TradeRowProps {
    trade: JournalTrade;
    preferences: JournalPreferences;
    isExpanded: boolean;
    onExpand: () => void;
    index: number;
}

export const TradeRow = memo(function TradeRow({ trade, preferences, isExpanded, onExpand, index }: TradeRowProps) {

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

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: Math.min(index * 0.02, 0.3) }}
        >
            {/* Main Row */}
            <div
                onClick={onExpand}
                className={cn(
                    "grid grid-cols-12 gap-4 items-center py-4 px-4 cursor-pointer transition-colors",
                    isExpanded ? "bg-zinc-800/40" : "hover:bg-zinc-800/20"
                )}
            >
                {/* Symbol */}
                <div className="col-span-2 flex items-center gap-3">
                    <TokenIcon symbol={displaySymbol} size={32} />
                    <div>
                        <span className="font-bold text-white">{displaySymbol || 'UNKNOWN'}</span>
                        {trade.exchange && (
                            <p className="text-[10px] text-zinc-500">{trade.exchange}</p>
                        )}
                    </div>
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
                        <p className="text-zinc-300">{format(trade.timestamp, "MMM d, hh:mm a")}</p>
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
                <div className="col-span-1">
                    <span className="text-xs text-rose-400">
                        {typeof trade.mae === 'number' && Number.isFinite(trade.mae) && trade.mae !== 0
                            ? formatPrice(-Math.abs(trade.mae))
                            : "N/A"}
                    </span>
                </div>

                {/* MFE */}
                <div className="col-span-1">
                    <span className="text-xs text-emerald-400">
                        {typeof trade.mfe === 'number' && Number.isFinite(trade.mfe) && trade.mfe !== 0
                            ? formatPrice(Math.abs(trade.mfe))
                            : "N/A"}
                    </span>
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
                    <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <ChevronDown className="w-4 h-4 text-zinc-500" />
                    </motion.div>
                </div>
            </div>

            {/* Expanded Details */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <TradeDetails trade={trade} />
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
});
