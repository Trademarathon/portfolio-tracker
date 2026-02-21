"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useJournal } from "@/contexts/JournalContext";
import { TradeTable } from "@/components/Journal/TradeTable/TradeTable";

export default function TradesPage() {
    const { filteredTrades, isLoading, preferences } = useJournal();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    // Count open positions
    const safeTrades = filteredTrades ?? [];
    const openCount = safeTrades.filter(t => t.isOpen).length;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
        >
            {openCount > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-md border border-zinc-700 bg-zinc-900/70 px-3 py-1.5 text-xs text-zinc-300">
                        {openCount} open position{openCount > 1 ? "s" : ""} was detected
                    </span>
                    <Link
                        href="/journal/trades/open"
                        className="inline-flex items-center rounded-md border border-zinc-700 bg-zinc-900/70 px-3 py-1.5 text-xs text-zinc-300 hover:text-white"
                    >
                        Go to the Open positions page
                    </Link>
                </div>
            )}

            <TradeTable trades={safeTrades} preferences={preferences} showOpenOnly={false} />
        </motion.div>
    );
}
