"use client";

import { TradingSessionManager } from "@/components/Journal/TradingSession";
import { PageWrapper } from "@/components/Layout/PageWrapper";
import { SectionErrorBoundary } from "@/components/Dashboard/SectionErrorBoundary";
import { useJournal } from "@/contexts/JournalContext";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { useAIInsight } from "@/lib/ai-orchestrator/hooks";
import { AIPulseCard } from "@/components/Dashboard/AIPulseCard";
import { useMemo } from "react";

export default function PlaybookPage() {
    const { spotPlans, perpPlans } = useJournal();
    const { positions } = usePortfolio();
    const safePositions = Array.isArray(positions) ? positions : [];
    const playbookContext = useMemo(() => ({
        spotPlans: spotPlans.length,
        perpPlans: perpPlans.length,
        openPositions: safePositions.length,
    }), [spotPlans.length, perpPlans.length, safePositions.length]);

    const { data: playbookInsight, loading: playbookLoading } = useAIInsight(
        "playbook_alignment",
        playbookContext,
        [spotPlans.length, perpPlans.length, safePositions.length],
        true,
        { stream: true }
    );

    return (
        <SectionErrorBoundary sectionName="Playbook" fallback={
            <PageWrapper className="journal-neo-active min-h-screen bg-[#141310] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <p className="text-sm text-zinc-400">Something went wrong on this page.</p>
                    <button type="button" onClick={() => window.location.reload()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold">Reload</button>
                </div>
            </PageWrapper>
        }>
        <PageWrapper className="journal-neo-active flex flex-col gap-4 px-4 md:px-6 lg:px-8 pt-4 pb-12 max-w-none w-full bg-[#141310]">
            <AIPulseCard
                title="Playbook Alignment"
                response={playbookInsight}
                loading={playbookLoading}
            />
            <TradingSessionManager />
        </PageWrapper>
        </SectionErrorBoundary>
    );
}
