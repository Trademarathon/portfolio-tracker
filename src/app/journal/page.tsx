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
import { DataReliabilityBar } from "@/components/ui/DataReliabilityBar";
import type { ConnectorReliabilitySummary, ConnectorReliabilityState } from "@/hooks/useConnectorReliability";
import { useMemo, useState, useEffect, useCallback } from "react";

function labelForState(state: ConnectorReliabilityState): string {
    if (state === "ready") return "Live";
    if (state === "backfilling") return "Backfilling";
    if (state === "degraded") return "Degraded";
    return "Down";
}

export default function JournalHomePage() {
    const {
        isLoading,
        isSyncing,
        filteredTrades,
        stats,
        spotPlans,
        perpPlans,
        connectedExchanges,
        syncDiagnostics,
        syncTrades,
    } = useJournal();
    const [tradesSnapshot, setTradesSnapshot] = useState<typeof filteredTrades>([]);
    const [statsSnapshot, setStatsSnapshot] = useState(stats);
    const [plansSnapshot, setPlansSnapshot] = useState<{ spotPlans: typeof spotPlans; perpPlans: typeof perpPlans }>({
        spotPlans: [],
        perpPlans: [],
    });

    useEffect(() => {
        if (filteredTrades.length > 0) {
            setTradesSnapshot(filteredTrades);
        }
    }, [filteredTrades]);

    const statsFingerprint = useMemo(
        () => `${stats.totalTrades}|${stats.totalPnl}|${stats.winRate}|${stats.avgPnl}|${stats.totalVolume}`,
        [stats.totalTrades, stats.totalPnl, stats.winRate, stats.avgPnl, stats.totalVolume]
    );
    useEffect(() => {
        if (!isLoading) {
            setStatsSnapshot(stats);
        }
    }, [isLoading, statsFingerprint, stats]);

    const plansFingerprint = useMemo(
        () => `${spotPlans.map((plan) => plan.id).join(",")}|${perpPlans.map((plan) => plan.id).join(",")}`,
        [spotPlans, perpPlans]
    );
    useEffect(() => {
        if (!isLoading) {
            setPlansSnapshot({ spotPlans, perpPlans });
        }
    }, [isLoading, plansFingerprint, spotPlans, perpPlans]);

    const usingSnapshot = isLoading && filteredTrades.length === 0 && tradesSnapshot.length > 0;
    const effectiveTrades = filteredTrades.length > 0 ? filteredTrades : (usingSnapshot ? tradesSnapshot : filteredTrades);
    const effectiveStats = usingSnapshot ? statsSnapshot : stats;
    const effectiveSpotPlans = spotPlans.length > 0 ? spotPlans : (usingSnapshot ? plansSnapshot.spotPlans : spotPlans);
    const effectivePerpPlans = perpPlans.length > 0 ? perpPlans : (usingSnapshot ? plansSnapshot.perpPlans : perpPlans);

    const journalReliability = useMemo<ConnectorReliabilitySummary>(() => {
        const exchanges = (connectedExchanges.length > 0 ? connectedExchanges : Object.keys(syncDiagnostics)).filter(Boolean);
        const connectors = exchanges.map((exchange) => {
            const diagnostic = syncDiagnostics[exchange];
            let state: ConnectorReliabilityState = "ready";
            if (!diagnostic) {
                state = isSyncing ? "backfilling" : "degraded";
            } else if (diagnostic.status === "error") {
                state = "down";
            } else if (diagnostic.status === "empty") {
                state = isSyncing ? "backfilling" : "degraded";
            } else {
                state = "ready";
            }

            return {
                id: exchange,
                name: exchange.toUpperCase(),
                type: "exchange",
                state,
                lastUpdateMs: diagnostic?.lastSyncAt,
                error: diagnostic?.message,
            };
        });

        const counts = {
            total: connectors.length,
            ready: connectors.filter((connector) => connector.state === "ready").length,
            degraded: connectors.filter((connector) => connector.state === "degraded").length,
            backfilling: connectors.filter((connector) => connector.state === "backfilling").length,
            down: connectors.filter((connector) => connector.state === "down").length,
        };
        const lastUpdateMs = connectors.reduce<number | undefined>((latest, connector) => {
            if (!connector.lastUpdateMs) return latest;
            if (!latest) return connector.lastUpdateMs;
            return Math.max(latest, connector.lastUpdateMs);
        }, undefined);

        let state: ConnectorReliabilityState = "ready";
        if (counts.total === 0) {
            state = effectiveTrades.length > 0 ? "ready" : (isLoading || isSyncing ? "backfilling" : "down");
        } else if ((isLoading || isSyncing) && effectiveTrades.length === 0) {
            state = "backfilling";
        } else if (counts.down === counts.total && effectiveTrades.length === 0) {
            state = "down";
        } else if (counts.degraded > 0 || counts.down > 0 || usingSnapshot || isSyncing) {
            state = "degraded";
        }

        return {
            state,
            label: labelForState(state),
            counts,
            lastUpdateMs,
            usingSnapshot,
            connectors,
        };
    }, [connectedExchanges, syncDiagnostics, isSyncing, isLoading, effectiveTrades.length, usingSnapshot]);

    const handleRetrySync = useCallback(() => {
        void syncTrades();
    }, [syncTrades]);

    const reflectionContext = useMemo(() => {
        const missingNotes = effectiveTrades.filter((t) => !t.notes || t.notes.trim().length === 0).length;
        return {
            tradeCount: effectiveTrades.length,
            missingNotes,
            stats: effectiveStats,
            spotPlans: effectiveSpotPlans.length,
            perpPlans: effectivePerpPlans.length,
        };
    }, [effectiveTrades, effectiveStats, effectiveSpotPlans.length, effectivePerpPlans.length]);

    const { data: reflectionInsight, loading: reflectionLoading } = useAIInsight(
        "journal_reflection",
        reflectionContext,
        [effectiveTrades.length, effectiveSpotPlans.length, effectivePerpPlans.length, effectiveStats.totalTrades],
        true,
        { stream: true }
    );

    if (isLoading && effectiveTrades.length === 0 && effectiveSpotPlans.length === 0 && effectivePerpPlans.length === 0) {
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

            <DataReliabilityBar
                title="Journal Sync"
                summary={journalReliability}
                onRetry={handleRetrySync}
            />

            <AIPulseCard
                title="Journal Reflection"
                response={reflectionInsight}
                loading={reflectionLoading}
            />
            
            {/* Stats Bar */}
            <StatsBar stats={effectiveStats} trades={effectiveTrades} />

            {/* Main Grid - PnL Chart + Alerts */}
            <div className="grid grid-cols-12 gap-4">
                {/* Lifetime PnL Chart */}
                <div className="col-span-12 lg:col-span-9">
                    <PnLChart trades={effectiveTrades} />
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
                    <WeeklyCalendar trades={effectiveTrades} />
                </div>

                {/* Day Report */}
                <div className="col-span-12 lg:col-span-3">
                    <DayReport trades={effectiveTrades} stats={effectiveStats} />
                </div>
            </div>
            
            {/* Bottom Grid - Recent Trades + Active Plans */}
            <div className="grid grid-cols-12 gap-4">
                {/* Recent Trades */}
                <div className="col-span-12 lg:col-span-9">
                    <RecentTrades trades={effectiveTrades.slice(0, 3)} />
                </div>
                
                {/* Active Plans */}
                <div className="col-span-12 lg:col-span-3">
                    <ActivePlansPanel spotPlans={effectiveSpotPlans} perpPlans={effectivePerpPlans} />
                </div>
            </div>
        </motion.div>
    );
}
