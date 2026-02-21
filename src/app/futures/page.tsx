"use client";

import { usePortfolio } from "@/contexts/PortfolioContext";
import { OpenPositionsTable } from "@/components/Dashboard/Overview/OpenPositionsTable";
import AnalyticsCharts from "@/components/Dashboard/AnalyticsCharts";
import AdvancedMetrics from "@/components/Dashboard/AdvancedMetrics";
import SessionAnalysis from "@/components/Dashboard/SessionAnalysis";
import { Shield, Zap, TrendingUp, AlertTriangle } from "lucide-react";
import { PageWrapper } from "@/components/Layout/PageWrapper";
import Loading from "@/app/loading";
import { SectionErrorBoundary } from "@/components/Dashboard/SectionErrorBoundary";
import { useAIInsight } from "@/lib/ai-orchestrator/hooks";
import { AIPulseCard } from "@/components/Dashboard/AIPulseCard";
import { useMemo } from "react";

export default function FuturesPage() {
    const { positions, futuresAnalytics, futuresMarketData, loading } = usePortfolio();
    const safePositions = Array.isArray(positions) ? positions : [];

    const futuresContext = useMemo(() => {
        const topPositions = safePositions
            .slice(0, 6)
            .map((p) => ({
                symbol: p.symbol,
                leverage: p.leverage,
                size: p.size,
                pnl: p.pnl,
                side: p.side,
            }));
        return {
            positions: topPositions,
            positionCount: safePositions.length,
            metrics: futuresAnalytics?.metrics || null,
        };
    }, [safePositions, futuresAnalytics?.metrics]);

    const { data: futuresInsight, loading: futuresInsightLoading } = useAIInsight(
        "futures_risk",
        futuresContext,
        [safePositions.length, futuresAnalytics?.metrics?.maxDrawdown ?? 0],
        true,
        { stream: true }
    );

    if (loading && !futuresAnalytics) {
        return (
            <PageWrapper className="flex flex-col bg-background">
                <div className="flex-1 flex items-center justify-center min-h-[50vh]">
                    <Loading />
                </div>
            </PageWrapper>
        );
    }

    return (
        <SectionErrorBoundary sectionName="Futures" fallback={
            <PageWrapper className="flex flex-col bg-background">
                <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] gap-4 p-6">
                    <p className="text-sm text-zinc-400 text-center">Something went wrong on this page.</p>
                    <button type="button" onClick={() => window.location.reload()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold">Reload page</button>
                </div>
            </PageWrapper>
        }>
        <PageWrapper className="futures-neo-active flex flex-col gap-6 px-4 md:px-6 lg:px-8 pt-4 pb-12 max-w-none">
            <div className="tm-page-header neo-header">
                <div className="tm-page-header-main">
                    <div className="tm-page-header-icon border-sky-500/35 bg-gradient-to-br from-sky-500/20 to-cyan-500/10">
                        <Zap className="h-5 w-5 text-sky-300" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <h1 className="tm-page-title title-lg">Futures Analytics</h1>
                        <p className="tm-page-subtitle">Professional-grade performance tracking and risk metrics.</p>
                    </div>
                </div>

                {safePositions.length > 0 && (
                    <div className="neo-chip text-sky-200">
                        <Shield size={14} className="text-sky-300" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                            {safePositions.length} Active Positions
                        </span>
                    </div>
                )}
            </div>

            <AIPulseCard
                title="Perp Risk"
                response={futuresInsight}
                loading={futuresInsightLoading}
            />

            {/* Performance Metrics Bar */}
            {futuresAnalytics?.metrics && (
                <div className="neo-card neo-card-cool bg-zinc-900/30 border border-white/5 rounded-2xl p-6 backdrop-blur-sm">
                    <AdvancedMetrics metrics={futuresAnalytics?.metrics} />
                </div>
            )}

            {/* Charts Section */}
            {futuresAnalytics && (
                <div className="grid gap-6 lg:grid-cols-12">
                    <div className="lg:col-span-8">
                        <AnalyticsCharts
                            pnlData={futuresAnalytics.pnlSeries}
                            drawdownData={futuresAnalytics.drawdownSeries}
                        />
                    </div>

                    <div className="lg:col-span-4 space-y-4">
                        <div className="neo-card neo-card-warm bg-gradient-to-br from-zinc-900 to-zinc-950 border border-white/10 rounded-xl p-5 h-full flex flex-col justify-between">
                            <div>
                                <h3 className="title-md text-zinc-500 mb-4 flex items-center gap-2">
                                    <AlertTriangle size={14} className="text-orange-400" />
                                    Risk Summary
                                </h3>

                                <div className="space-y-6">
                                    <div className="flex justify-between items-center group">
                                        <span className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors">Max Drawdown</span>
                                        <span className="text-lg font-mono font-bold text-red-400/80">
                                            ${Math.abs(futuresAnalytics?.metrics?.maxDrawdown ?? 0).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center group">
                                        <span className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors">Win/Loss Ratio</span>
                                        <span className="text-lg font-mono font-bold text-zinc-100">
                                            {((futuresAnalytics?.metrics?.winCount ?? 0) / (futuresAnalytics?.metrics?.lossCount || 1)).toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center group">
                                        <span className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors">Avg Risk/Reward</span>
                                        <span className="text-lg font-mono font-bold text-emerald-400/80">
                                            {((futuresAnalytics?.metrics?.avgWin ?? 0) / (futuresAnalytics?.metrics?.avgLoss || 1)).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 pt-6 border-t border-white/5">
                                <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg border border-white/5 text-[11px] text-zinc-400">
                                    <TrendingUp size={16} className="text-zinc-500 shrink-0" />
                                    Your profit factor of {(futuresAnalytics?.metrics?.profitFactor ?? 0).toFixed(2)} indicates a {(futuresAnalytics?.metrics?.profitFactor ?? 0) > 1.5 ? 'highly profitable' : 'steady'} strategy.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Session Analysis Section */}
            {futuresAnalytics?.session && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-1 h-5 bg-blue-500 rounded-full" />
                        <h2 className="text-lg font-bold text-zinc-100 uppercase tracking-wider">Session Analysis</h2>
                    </div>
                    <SessionAnalysis
                        dayOfWeek={futuresAnalytics.session.dayOfWeek}
                        timeOfDay={futuresAnalytics.session.timeOfDay}
                    />
                </div>
            )}

            {/* Active Positions Section */}
            <div className="pt-4">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-5 bg-emerald-500 rounded-full" />
                    <h2 className="text-lg font-bold text-zinc-100">Open Positions</h2>
                </div>

                {safePositions.length === 0 ? (
                    <div className="p-12 border border-white/5 border-dashed rounded-2xl bg-zinc-900/20 text-center text-zinc-500">
                        <AlertTriangle className="mx-auto mb-3 opacity-20" size={32} />
                        No active futures positions detected.
                    </div>
                ) : (
                    <OpenPositionsTable positions={safePositions} marketData={futuresMarketData} />
                )}
            </div>
        </PageWrapper>
        </SectionErrorBoundary>
    );
}
