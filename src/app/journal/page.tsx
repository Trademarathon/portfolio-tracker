"use client";

import { motion } from "framer-motion";
import { StatsBar } from "@/components/Journal/Home/StatsBar";
import { PnLChart } from "@/components/Journal/Home/PnLChart";
import { WeeklyCalendar } from "@/components/Journal/Home/WeeklyCalendar";
import { DayReport } from "@/components/Journal/Home/DayReport";
import { RecentTrades } from "@/components/Journal/Home/RecentTrades";
import { RealTimeAlertsPanel } from "@/components/Journal/RealTimeAlertsPanel";
import { ActivePlansPanel } from "@/components/Journal/Home/ActivePlansPanel";
import { ExchangesSyncStatus } from "@/components/Journal/Home/ExchangesSyncStatus";
import { useJournal } from "@/contexts/JournalContext";
import { useAIInsight } from "@/lib/ai-orchestrator/hooks";
import { AIPulseCard } from "@/components/Dashboard/AIPulseCard";
import { useMemo } from "react";

export default function JournalHomePage() {
    const { isLoading, filteredTrades, stats, spotPlans, perpPlans } = useJournal();
    const reflectionContext = useMemo(() => {
        const missingNotes = filteredTrades.filter((t) => !t.notes || t.notes.trim().length === 0).length;
        return {
            tradeCount: filteredTrades.length,
            missingNotes,
            stats,
            spotPlans: spotPlans.length,
            perpPlans: perpPlans.length,
        };
    }, [filteredTrades, stats, spotPlans.length, perpPlans.length]);

    const { data: reflectionInsight, loading: reflectionLoading } = useAIInsight(
        "journal_reflection",
        reflectionContext,
        [filteredTrades.length, spotPlans.length, perpPlans.length],
        true,
        { stream: true }
    );

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="journal-neo-active space-y-4"
        >
            {/* Sync Status Banner */}
            <ExchangesSyncStatus />

            <AIPulseCard
                title="Journal Reflection"
                response={reflectionInsight}
                loading={reflectionLoading}
            />
            
            {/* Stats Bar */}
            <StatsBar />

            {/* Main Grid - PnL Chart + Alerts */}
            <div className="grid grid-cols-12 gap-4">
                {/* Lifetime PnL Chart */}
                <div className="col-span-12 lg:col-span-9">
                    <PnLChart trades={filteredTrades} />
                </div>
                
                {/* Real-time Alerts Panel */}
                <div className="col-span-12 lg:col-span-3">
                    <RealTimeAlertsPanel />
                </div>
            </div>

            {/* Secondary Grid */}
            <div className="grid grid-cols-12 gap-4">
                {/* Past 4 Weeks Calendar */}
                <div className="col-span-12 lg:col-span-9">
                    <WeeklyCalendar trades={filteredTrades} />
                </div>

                {/* Day Report */}
                <div className="col-span-12 lg:col-span-3">
                    <DayReport trades={filteredTrades} stats={stats} />
                </div>
            </div>
            
            {/* Bottom Grid - Recent Trades + Active Plans */}
            <div className="grid grid-cols-12 gap-4">
                {/* Recent Trades */}
                <div className="col-span-12 lg:col-span-9">
                    <RecentTrades trades={filteredTrades.slice(0, 3)} />
                </div>
                
                {/* Active Plans */}
                <div className="col-span-12 lg:col-span-3">
                    <ActivePlansPanel spotPlans={spotPlans} perpPlans={perpPlans} />
                </div>
            </div>
        </motion.div>
    );
}
