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
import { useMemo, useState, useEffect } from "react";
import { useConnectorReliability } from "@/hooks/useConnectorReliability";
import { DataReliabilityBar } from "@/components/ui/DataReliabilityBar";
import { RiskMetricsPanel } from "@/components/Dashboard/RiskMetricsPanel";

type SideFilter = "all" | "long" | "short";
type TimeRangeFilter = "7d" | "30d" | "90d" | "all";

export default function FuturesPage() {
    const {
        positions,
        futuresAnalytics,
        futuresMarketData,
        loading,
        connections,
        wsConnectionStatus,
        connectionErrors,
        triggerConnectionsRefetch,
    } = usePortfolio();
    const safePositions = useMemo(() => (Array.isArray(positions) ? positions : []), [positions]);
    const enabledConnections = useMemo(
        () => (Array.isArray(connections) ? connections : []).filter((connection) => connection.enabled !== false),
        [connections]
    );
    const [positionsSnapshot, setPositionsSnapshot] = useState<typeof safePositions>([]);
    const [analyticsSnapshot, setAnalyticsSnapshot] = useState<typeof futuresAnalytics | null>(null);
    const [marketDataSnapshot, setMarketDataSnapshot] = useState<typeof futuresMarketData | undefined>(undefined);
    const [exchangeFilter, setExchangeFilter] = useState<string>("all");
    const [sideFilter, setSideFilter] = useState<SideFilter>("all");
    const [timeRangeFilter, setTimeRangeFilter] = useState<TimeRangeFilter>("30d");
    const [symbolFilter, setSymbolFilter] = useState<string>("");

    useEffect(() => {
        if (safePositions.length > 0) setPositionsSnapshot(safePositions);
    }, [safePositions]);

    useEffect(() => {
        if (futuresAnalytics) setAnalyticsSnapshot(futuresAnalytics);
    }, [futuresAnalytics]);

    useEffect(() => {
        if (futuresMarketData && Object.keys(futuresMarketData).length > 0) {
            setMarketDataSnapshot(futuresMarketData);
        }
    }, [futuresMarketData]);

    const effectivePositions = safePositions.length > 0 ? safePositions : positionsSnapshot;
    const effectiveAnalytics = futuresAnalytics ?? analyticsSnapshot;
    const effectiveMarketData = futuresMarketData && Object.keys(futuresMarketData).length > 0
        ? futuresMarketData
        : marketDataSnapshot;
    const usingSnapshot = (safePositions.length === 0 && positionsSnapshot.length > 0) || (!futuresAnalytics && !!analyticsSnapshot);

    const exchangeOptions = useMemo(() => {
        const values = Array.from(
            new Set(
                effectivePositions
                    .map((p) => String(p.exchange || "").toLowerCase().trim())
                    .filter(Boolean)
            )
        ).sort();
        return values;
    }, [effectivePositions]);

    const filteredPositions = useMemo(() => {
        const query = symbolFilter.trim().toUpperCase();
        return effectivePositions.filter((p) => {
            const exchange = String(p.exchange || "").toLowerCase();
            const symbol = String(p.symbol || "").toUpperCase();
            if (exchangeFilter !== "all" && exchange !== exchangeFilter) return false;
            if (sideFilter !== "all" && p.side !== sideFilter) return false;
            if (query && !symbol.includes(query)) return false;
            return true;
        });
    }, [effectivePositions, exchangeFilter, sideFilter, symbolFilter]);

    const chartRange = useMemo(() => {
        if (timeRangeFilter === "all") return null;
        const now = Date.now();
        if (timeRangeFilter === "7d") return now - 7 * 24 * 60 * 60 * 1000;
        if (timeRangeFilter === "30d") return now - 30 * 24 * 60 * 60 * 1000;
        return now - 90 * 24 * 60 * 60 * 1000;
    }, [timeRangeFilter]);

    const chartPnlSeries = useMemo(() => {
        const series = effectiveAnalytics?.pnlSeries || [];
        if (!chartRange) return series;
        const filtered = series.filter((point) => point.date >= chartRange);
        return filtered.length > 1 ? filtered : series;
    }, [effectiveAnalytics?.pnlSeries, chartRange]);

    const chartDrawdownSeries = useMemo(() => {
        const series = effectiveAnalytics?.drawdownSeries || [];
        if (!chartRange) return series;
        const filtered = series.filter((point) => point.date >= chartRange);
        return filtered.length > 1 ? filtered : series;
    }, [effectiveAnalytics?.drawdownSeries, chartRange]);

    const futuresContext = useMemo(() => {
        const topPositions = filteredPositions
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
            positionCount: filteredPositions.length,
            metrics: effectiveAnalytics?.metrics || null,
        };
    }, [filteredPositions, effectiveAnalytics?.metrics]);

    const estimatedMarginBase = useMemo(() => {
        return filteredPositions.reduce((sum, pos) => {
            const mark = pos.markPrice || pos.entryPrice || 0;
            const notional = Math.abs((pos.size || 0) * mark);
            const leverage = Math.max(1, Number(pos.leverage || 1));
            return sum + notional / leverage;
        }, 0);
    }, [filteredPositions]);

    const totalFuturesPnl = useMemo(
        () => filteredPositions.reduce((sum, pos) => sum + (pos.pnl || 0), 0),
        [filteredPositions]
    );

    const drawdownStats = useMemo(() => {
        const values = chartPnlSeries.map((p) => Number(p.value || 0));
        if (values.length === 0) return { current: 0, max: 0, peak: 0 };
        const peak = Math.max(0, ...values);
        if (peak <= 0) return { current: 0, max: 0, peak: 0 };

        const currentEquity = values[values.length - 1] || 0;
        const current = Math.max(0, ((peak - currentEquity) / peak) * 100);
        const maxDrawdownAbs = Math.abs(Number(effectiveAnalytics?.metrics?.maxDrawdown || 0));
        const max = Math.max(current, (maxDrawdownAbs / peak) * 100);
        return { current, max, peak };
    }, [chartPnlSeries, effectiveAnalytics?.metrics?.maxDrawdown]);

    const { data: futuresInsight, loading: futuresInsightLoading } = useAIInsight(
        "futures_risk",
        futuresContext,
        [filteredPositions.length, effectiveAnalytics?.metrics?.maxDrawdown ?? 0, exchangeFilter, sideFilter, symbolFilter],
        true,
        { stream: true }
    );

    const reliability = useConnectorReliability({
        connections: enabledConnections,
        wsConnectionStatus,
        connectionErrors,
        loading,
        dataPoints: filteredPositions.length + chartPnlSeries.length,
        usingSnapshot,
    });

    if (loading && !effectiveAnalytics && filteredPositions.length === 0) {
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

                {filteredPositions.length > 0 && (
                    <div className="neo-chip text-sky-200">
                        <Shield size={14} className="text-sky-300" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                            {filteredPositions.length} Active Positions
                        </span>
                    </div>
                )}
            </div>

            <div className="neo-card bg-zinc-900/25 border border-white/5 rounded-xl p-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <select
                        value={exchangeFilter}
                        onChange={(e) => setExchangeFilter(e.target.value)}
                        className="bg-zinc-900/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-200"
                    >
                        <option value="all">All exchanges</option>
                        {exchangeOptions.map((exchange) => (
                            <option key={exchange} value={exchange}>
                                {exchange.toUpperCase()}
                            </option>
                        ))}
                    </select>

                    <select
                        value={sideFilter}
                        onChange={(e) => setSideFilter(e.target.value as SideFilter)}
                        className="bg-zinc-900/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-200"
                    >
                        <option value="all">All sides</option>
                        <option value="long">Long</option>
                        <option value="short">Short</option>
                    </select>

                    <select
                        value={timeRangeFilter}
                        onChange={(e) => setTimeRangeFilter(e.target.value as TimeRangeFilter)}
                        className="bg-zinc-900/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-200"
                    >
                        <option value="7d">Last 7 days</option>
                        <option value="30d">Last 30 days</option>
                        <option value="90d">Last 90 days</option>
                        <option value="all">All time</option>
                    </select>

                    <input
                        value={symbolFilter}
                        onChange={(e) => setSymbolFilter(e.target.value)}
                        placeholder="Filter symbol (e.g. BTC)"
                        className="bg-zinc-900/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-500"
                    />
                </div>
            </div>

            <DataReliabilityBar
                title="Futures Feed"
                summary={reliability}
                onRetry={triggerConnectionsRefetch}
            />

            <AIPulseCard
                title="Perp Risk"
                response={futuresInsight}
                loading={futuresInsightLoading}
            />

            <RiskMetricsPanel
                positions={filteredPositions}
                totalValue={Math.max(estimatedMarginBase, 1)}
                totalPnl={totalFuturesPnl}
                drawdown={drawdownStats}
            />

            {/* Performance Metrics Bar */}
            {effectiveAnalytics?.metrics && (
                <div className="neo-card neo-card-cool bg-zinc-900/30 border border-white/5 rounded-2xl p-6 backdrop-blur-sm">
                    <AdvancedMetrics metrics={effectiveAnalytics?.metrics} />
                </div>
            )}

            {/* Charts Section */}
            {effectiveAnalytics && (
                <div className="grid gap-6 lg:grid-cols-12">
                    <div className="lg:col-span-8">
                        <AnalyticsCharts
                            pnlData={chartPnlSeries}
                            drawdownData={chartDrawdownSeries}
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
                                            ${Math.abs(effectiveAnalytics?.metrics?.maxDrawdown ?? 0).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center group">
                                        <span className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors">Win/Loss Ratio</span>
                                        <span className="text-lg font-mono font-bold text-zinc-100">
                                            {((effectiveAnalytics?.metrics?.winCount ?? 0) / (effectiveAnalytics?.metrics?.lossCount || 1)).toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center group">
                                        <span className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors">Avg Risk/Reward</span>
                                        <span className="text-lg font-mono font-bold text-emerald-400/80">
                                            {((effectiveAnalytics?.metrics?.avgWin ?? 0) / (effectiveAnalytics?.metrics?.avgLoss || 1)).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 pt-6 border-t border-white/5">
                                <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg border border-white/5 text-[11px] text-zinc-400">
                                    <TrendingUp size={16} className="text-zinc-500 shrink-0" />
                                    Your profit factor of {(effectiveAnalytics?.metrics?.profitFactor ?? 0).toFixed(2)} indicates a {(effectiveAnalytics?.metrics?.profitFactor ?? 0) > 1.5 ? 'highly profitable' : 'steady'} strategy.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Session Analysis Section */}
            {effectiveAnalytics?.session && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-1 h-5 bg-blue-500 rounded-full" />
                        <h2 className="text-lg font-bold text-zinc-100 uppercase tracking-wider">Session Analysis</h2>
                    </div>
                    <SessionAnalysis
                        dayOfWeek={effectiveAnalytics.session.dayOfWeek}
                        timeOfDay={effectiveAnalytics.session.timeOfDay}
                    />
                </div>
            )}

            {/* Active Positions Section */}
            <div className="pt-4">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-5 bg-emerald-500 rounded-full" />
                    <h2 className="text-lg font-bold text-zinc-100">Open Positions</h2>
                </div>

                {filteredPositions.length === 0 ? (
                    <div className="p-12 border border-white/5 border-dashed rounded-2xl bg-zinc-900/20 text-center text-zinc-500">
                        <AlertTriangle className="mx-auto mb-3 opacity-20" size={32} />
                        No futures positions match the current filters.
                    </div>
                ) : (
                    <OpenPositionsTable positions={filteredPositions} marketData={effectiveMarketData ?? {}} />
                )}
            </div>
        </PageWrapper>
        </SectionErrorBoundary>
    );
}
