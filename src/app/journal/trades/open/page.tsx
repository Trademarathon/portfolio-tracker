"use client";

import { motion } from "framer-motion";
import { useJournal } from "@/contexts/JournalContext";
import { TradeTable } from "@/components/Journal/TradeTable/TradeTable";
import { AlertCircle } from "lucide-react";

export default function OpenPositionsPage() {
    const { filteredTrades, preferences, isLoading } = useJournal();
    const safeTrades = filteredTrades ?? [];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const openCount = safeTrades.filter(t => t.isOpen).length;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
        >
            {/* Header Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50"
            >
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                        <AlertCircle className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">Open Positions</h2>
                        <p className="text-sm text-zinc-500">
                            {openCount > 0
                                ? `You currently have ${openCount} open position${openCount > 1 ? 's' : ''}`
                                : 'No open positions detected'}
                        </p>
                    </div>
                </div>
            </motion.div>

            {/* Trade Table */}
            <TradeTable trades={safeTrades} preferences={preferences} showOpenOnly={true} />
        </motion.div>
    );
}
