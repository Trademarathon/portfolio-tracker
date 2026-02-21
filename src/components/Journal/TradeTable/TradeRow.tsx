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
    gridClassName: string;
}

function toUnixMs(value: number | undefined): number {
    if (!value || !Number.isFinite(value)) return 0;
    return value < 1e12 ? value * 1000 : value;
}

export const TradeRow = memo(function TradeRow({ trade, preferences, isExpanded, onExpand, index, gridClassName }: TradeRowProps) {

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

    const formatPrice = (value: number) => {
        if (preferences.hideBalances) return "••••";
        return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatPnL = (value: number) => {
        if (preferences.hideBalances) return "••••";
        const prefix = value >= 0 ? '+' : '';
        return `${prefix}$${Math.abs(value).toFixed(2)}`;
    };

    const entryPrice = Number(trade.entryPrice || trade.price || 0);
    const exitPrice = Number(trade.exitPrice || 0);
    const hasExitPrice = Number.isFinite(exitPrice) && exitPrice > 0;
    const directionalMove = hasExitPrice && entryPrice > 0
        ? (isLong ? ((exitPrice - entryPrice) / entryPrice) : ((entryPrice - exitPrice) / entryPrice)) * 100
        : 0;

    const openTimestamp = toUnixMs(trade.timestamp);
    const closeTimestamp = toUnixMs(trade.exitTime);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: Math.min(index * 0.02, 0.3) }}
            className="relative"
        >
            <span
                className={cn(
                    "absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full",
                    isProfit ? "bg-emerald-400/80" : "bg-rose-400/80"
                )}
            />

            <div
                onClick={onExpand}
                className={cn(
                    gridClassName,
                    "pl-4 pr-3 py-3.5 cursor-pointer transition-colors",
                    isExpanded ? "bg-zinc-800/35" : "hover:bg-zinc-800/20"
                )}
            >
                <div className="flex items-center gap-2.5">
                    <TokenIcon symbol={displaySymbol} size={30} />
                    <div>
                        <span className="font-bold text-white text-sm">{displaySymbol || 'UNKNOWN'}</span>
                        {trade.exchange && (
                            <p className="text-[10px] text-zinc-500 uppercase">{trade.exchange}</p>
                        )}
                    </div>
                </div>

                <div>
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
                    <p className="text-[10px] uppercase tracking-wide text-zinc-500 mt-0.5">{isLong ? "Long" : "Short"}</p>
                </div>

                <div className="text-xs">
                    <div className="flex items-center gap-2 text-zinc-300">
                        <span>{openTimestamp ? format(openTimestamp, "MMM dd, hh:mm a") : "N/A"}</span>
                        <span className="text-zinc-600">→</span>
                        <span>{closeTimestamp ? format(closeTimestamp, "MMM dd, hh:mm a") : "Open"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-600 mt-0.5">
                        <span>{openTimestamp ? format(openTimestamp, "yyyy") : ""}</span>
                        <span> </span>
                        <span>{closeTimestamp ? format(closeTimestamp, "yyyy") : ""}</span>
                    </div>
                </div>

                <div>
                    <span className={cn(
                        "inline-flex items-center px-2 py-1 rounded-md text-[11px] font-semibold",
                        holdTime === 0 ? "bg-zinc-700/60 text-zinc-300" : "bg-blue-500/20 text-blue-300"
                    )}>
                        {formatHoldTime(holdTime)}
                    </span>
                </div>

                <div className="text-xs">
                    <div className="flex items-center gap-2 text-zinc-300">
                        <span>{formatPrice(entryPrice)}</span>
                        <span className="text-zinc-600">→</span>
                        <span>{hasExitPrice ? formatPrice(exitPrice) : "Open"}</span>
                    </div>
                    <p className={cn("text-[10px] mt-0.5", directionalMove >= 0 ? "text-emerald-400" : "text-rose-400")}>
                        {hasExitPrice ? `${directionalMove >= 0 ? "+" : ""}${directionalMove.toFixed(2)}%` : "N/A"}
                    </p>
                </div>

                <div>
                    <span className={cn(
                        "inline-flex min-w-[66px] justify-center px-2.5 py-1 rounded-md text-[11px] font-semibold",
                        isProfit ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                    )}>
                        {formatPnL(pnl)}
                    </span>
                </div>

                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            onExpand();
                        }}
                        className="h-8 w-8 rounded-md border border-zinc-700/70 bg-zinc-800/55 text-zinc-400 hover:text-zinc-200"
                        aria-label={isExpanded ? "Collapse trade details" : "Expand trade details"}
                    >
                        <motion.span
                            className="inline-flex"
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <ChevronDown className="w-4 h-4" />
                        </motion.span>
                    </button>
                </div>
            </div>

            <AnimatePresence initial={false}>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t border-zinc-800/60"
                    >
                        <TradeDetails trade={trade} />
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
});
