"use client";

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
            className="space-y-6"
        >
            {/* Open Positions Alert */}
            {openCount > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between"
                >
                    <span className="text-sm text-amber-400">
                        {openCount} open position{openCount > 1 ? 's' : ''} was detected
                    </span>
                    <a
                        href="/journal/trades/open"
                        className="text-sm text-amber-400 hover:underline"
                    >
                        Go to the Open positions page →
                    </a>
                </motion.div>
            )}

            {/* Trade Table */}
            <TradeTable trades={safeTrades} preferences={preferences} showOpenOnly={false} />
        </motion.div>
    );
}
