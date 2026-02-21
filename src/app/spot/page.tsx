"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { usePortfolio } from "@/contexts/PortfolioContext";
import HoldingsTable from "@/components/Dashboard/HoldingsTable";
import { AdvancedAllocation } from "@/components/Dashboard/AdvancedAllocation";
import { AccountsOverview } from "@/components/Dashboard/AccountsOverview";
import { PageWrapper } from "@/components/Layout/PageWrapper";
import { AssetAIInsight } from "@/components/Dashboard/AssetAIInsight";
import { NeuralAlphaFeed } from "@/components/Dashboard/NeuralAlphaFeed";
import { useSocialFeed } from "@/hooks/useSocialFeed";
import { SpotHighlights } from "@/components/Dashboard/SpotHighlights";
import { SpotAssetCards } from "@/components/Dashboard/SpotAssetCards";
import { AIPulseCard } from "@/components/Dashboard/AIPulseCard";
import { useAIInsight } from "@/lib/ai-orchestrator/hooks";
import { calculatePortfolioAnalytics, calculateAssetAnalytics } from "@/lib/utils/analytics";
import { formatCurrency, cn } from "@/lib/utils";
import { 
    Wallet, TrendingUp, TrendingDown, Target, DollarSign, 
    PieChart, Activity, Zap, BarChart3, Trophy, Skull, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { StatCard } from "@/components/ui/StatCard";
import Loading from "@/app/loading";
import { SectionErrorBoundary } from "@/components/Dashboard/SectionErrorBoundary";

// Custom event type for highlighting assets
declare global {
    interface WindowEventMap {
        'highlight-asset': CustomEvent<{ symbol: string }>;
    }
}

// Profit/Loss Highlight Card
function PnLHighlightCard({
    symbol,
    label,
    pnl,
    pnlPercent,
    avgPrice,
    type
}: {
    symbol: string;
    label: string;
    pnl: number;
    pnlPercent: number;
    avgPrice: number;
    type: 'profit' | 'loss';
}) {
    const isProfit = type === 'profit';
    
    return (
        <div className={cn(
            "group relative flex items-center gap-3 p-3 rounded-xl border transition-all duration-300",
            "hover:scale-[1.01] cursor-pointer",
            isProfit 
                ? "bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/10"
                : "bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent border-rose-500/20 hover:shadow-lg hover:shadow-rose-500/10"
        )}
        onClick={() => {
            window.dispatchEvent(new CustomEvent('highlight-asset', { detail: { symbol } }));
        }}
        >
            {/* Glow effect on hover */}
            <div className={cn(
                "absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                isProfit ? "bg-emerald-500/5" : "bg-rose-500/5"
            )} />
            
            <div className="relative">
                <div className={cn(
                    "absolute -top-1 -left-1 p-1 rounded-full border z-10",
                    isProfit 
                        ? "bg-emerald-500/20 border-emerald-500/30" 
                        : "bg-rose-500/20 border-rose-500/30"
                )}>
                    {isProfit 
                        ? <Trophy className="h-2.5 w-2.5 text-emerald-400" />
                        : <Skull className="h-2.5 w-2.5 text-rose-400" />
                    }
                </div>
                <TokenIcon symbol={symbol} size={36} />
            </div>
            
            <div className="relative flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className={cn(
                        "text-[9px] font-bold uppercase tracking-wider",
                        isProfit ? "text-emerald-400" : "text-rose-400"
                    )}>{label}</span>
                    {isProfit 
                        ? <ArrowUpRight className="h-3 w-3 text-emerald-400" />
                        : <ArrowDownRight className="h-3 w-3 text-rose-400" />
                    }
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-white">{symbol}</span>
                    <span className={cn(
                        "text-xs font-mono font-bold",
                        isProfit ? "text-emerald-400" : "text-rose-400"
                    )}>
                        {isProfit ? '+' : ''}{formatCurrency(pnl)}
                    </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                    <span>Avg: {formatCurrency(avgPrice)}</span>
                    <span className="text-zinc-600">•</span>
                    <span className={cn(
                        "font-bold",
                        isProfit ? "text-emerald-400" : "text-rose-400"
                    )}>
                        {isProfit ? '+' : ''}{pnlPercent.toFixed(1)}%
                    </span>
                </div>
            </div>
        </div>
    );
}

export default function SpotPage() {
    const { assets, spotOrders, loading, connections, totalValue, transactions, transfers, connectionErrors, triggerConnectionsRefetch } = usePortfolio();
    const assetsList = Array.isArray(assets) ? assets : [];
    const socialItems = useSocialFeed({
        symbols: assetsList.map((a) => a.symbol),
        scope: "spot",
    });
    const connectionsList = Array.isArray(connections) ? connections : [];
    const enabledConnectionsList = useMemo(
        () => connectionsList.filter(c => c.enabled !== false),
        [connectionsList]
    );
    const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
    const [selectedAccountChainIds, setSelectedAccountChainIds] = useState<string[] | undefined>(undefined);
    const [aiAsset, setAiAsset] = useState<string | null>(null);
    const [highlightedSymbol, setHighlightedSymbol] = useState<string | null>(null);

    // Listen for highlight-asset events from NeuralAlphaFeed
    useEffect(() => {
        const handleHighlight = (e: CustomEvent<{ symbol: string }>) => {
            const symbol = e.detail.symbol;
            setHighlightedSymbol(symbol);
            
            // Scroll to the asset card
            setTimeout(() => {
                const element = document.getElementById(`asset-card-${symbol}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
            
            // Clear highlight after animation
            setTimeout(() => {
                setHighlightedSymbol(null);
            }, 3000);
        };

        window.addEventListener('highlight-asset', handleHighlight);
        return () => window.removeEventListener('highlight-asset', handleHighlight);
    }, []);

    // Filter Assets based on Selected Account (must run before any conditional return to satisfy Rules of Hooks)
    // Breakdown keys can be connectionId or connectionId::Spot (CEX uses ::Spot)
    // For hardware wallets, use chainIds (e.g. connId, connId::Chain) when provided
    const filteredAssets = useMemo(() => {
        const mapByKeys = (keys: string[]) => {
            if (keys.length === 0) return [] as typeof assetsList;
            return assetsList
                .map(asset => {
                    const breakdown = asset.breakdown || {};
                    const balance = keys.reduce((sum, k) => sum + (breakdown[k] || 0), 0);
                    if (balance <= 0) return null;
                    return {
                        ...asset,
                        balance,
                        valueUsd: balance * (asset.price || 0),
                        allocations: 0
                    };
                })
                .filter(Boolean) as typeof assetsList;
        };

        // Spot page should only include spot/wallet balances, never explicit perp buckets.
        const isSpotKey = (key: string) => !key.endsWith('::Perp');

        if (!selectedAccount || selectedAccount === 'All') {
            const allSpotKeys = Array.from(
                new Set(
                    assetsList.flatMap((a) => Object.keys(a.breakdown || {}).filter(isSpotKey))
                )
            );
            return mapByKeys(allSpotKeys);
        }

        const allBreakdownKeys = Array.from(new Set(assetsList.flatMap(a => Object.keys(a.breakdown || {}))));
        const matchingKeys: string[] = (selectedAccountChainIds?.length
            ? selectedAccountChainIds
            : allBreakdownKeys.filter(k => k === selectedAccount || k.startsWith(selectedAccount + '::')))
            .filter(isSpotKey);

        if (matchingKeys.length === 0) return [];

        return mapByKeys(matchingKeys);
    }, [assetsList, selectedAccount, selectedAccountChainIds]);

    // Recalculate allocations for the filtered view
    const viewTotal = filteredAssets.reduce((sum, a) => sum + a.valueUsd, 0);
    const finalDisplayAssets = filteredAssets.map(a => ({
        ...a,
        allocations: viewTotal > 0 ? (a.valueUsd / viewTotal) * 100 : 0
    }));

    // Calculate portfolio analytics (guarded to avoid crash on bad data)
    const portfolioAnalytics = useMemo(() => {
        try {
            return calculatePortfolioAnalytics(finalDisplayAssets, Array.isArray(transactions) ? transactions : [], {
                transfers: Array.isArray(transfers) ? transfers : [],
            });
        } catch {
            return { totalCostBasis: 0, totalUnrealizedPnl: 0, totalRealizedPnl: 0, totalTrades: 0, winRate: 0 };
        }
    }, [finalDisplayAssets, transactions, transfers]);

    // Quick stats
    const stats = useMemo(() => {
        const stablecoins = ['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD'];
        const stablecoinValue = finalDisplayAssets
            .filter(a => stablecoins.includes(a.symbol.toUpperCase()))
            .reduce((sum, a) => sum + a.valueUsd, 0);
        
        const topGainer = [...finalDisplayAssets]
            .filter(a => a.priceChange24h)
            .sort((a, b) => (b.priceChange24h || 0) - (a.priceChange24h || 0))[0];
        
        const topLoser = [...finalDisplayAssets]
            .filter(a => a.priceChange24h)
            .sort((a, b) => (a.priceChange24h || 0) - (b.priceChange24h || 0))[0];
        
        // Calculate most profitable and biggest loss based on unrealized PnL
        const nonStableAssets = finalDisplayAssets.filter(a => 
            !stablecoins.includes(a.symbol.toUpperCase()) && a.valueUsd > 1
        );
        // Limit expensive per-asset analytics work for responsiveness on large portfolios.
        const analysisCandidates = [...nonStableAssets]
            .sort((a, b) => b.valueUsd - a.valueUsd)
            .slice(0, 40);
        
        const assetsWithPnL = analysisCandidates.map(asset => {
            try {
                const withTransfers = calculateAssetAnalytics(asset, Array.isArray(transactions) ? transactions : [], {
                    transfers: Array.isArray(transfers) ? transfers : [],
                });
                return {
                    ...asset,
                    unrealizedPnl: withTransfers.unrealizedPnl,
                    unrealizedPnlPercent: withTransfers.unrealizedPnlPercent,
                    avgBuyPrice: withTransfers.avgBuyPrice,
                    costBasis: withTransfers.costBasis
                };
            } catch {
                return { ...asset, unrealizedPnl: 0, unrealizedPnlPercent: 0, avgBuyPrice: 0, costBasis: 0 };
            }
        }).filter(a => a.avgBuyPrice > 0); // Only assets with trade history
        
        const mostProfitable = [...assetsWithPnL]
            .sort((a, b) => b.unrealizedPnl - a.unrealizedPnl)[0];
        
        const biggestLoss = [...assetsWithPnL]
            .sort((a, b) => a.unrealizedPnl - b.unrealizedPnl)[0];
            
        return {
            stablecoinValue,
            stablecoinPercent: viewTotal > 0 ? (stablecoinValue / viewTotal) * 100 : 0,
            assetCount: finalDisplayAssets.filter(a => a.valueUsd > 1).length,
            topGainer,
            topLoser,
            mostProfitable,
            biggestLoss
        };
    }, [finalDisplayAssets, viewTotal, transactions, transfers]);

    const spotRiskContext = useMemo(() => {
        const topAssets = finalDisplayAssets
            .slice()
            .sort((a, b) => (b.valueUsd || 0) - (a.valueUsd || 0))
            .slice(0, 8)
            .map((a) => ({
                symbol: a.symbol,
                allocPct: a.allocations,
                valueUsd: a.valueUsd,
                pnl24h: a.priceChange24h,
            }));
        return {
            topAssets,
            stablecoinPct: stats.stablecoinPercent,
            totalValue: viewTotal,
            winRate: portfolioAnalytics.winRate,
        };
    }, [finalDisplayAssets, stats.stablecoinPercent, viewTotal, portfolioAnalytics.winRate]);

    const { data: aiSpotRisk, loading: aiSpotLoading } = useAIInsight(
        "spot_position_risk",
        spotRiskContext,
        [spotRiskContext],
        true,
        { stream: true }
    );

    if (loading && assetsList.length === 0 && (connectionsList?.length ?? 0) === 0) {
        return (
            <PageWrapper className="flex flex-col bg-background">
                <div className="flex-1 flex items-center justify-center min-h-[50vh]">
                    <Loading />
                </div>
            </PageWrapper>
        );
    }

    return (
        <SectionErrorBoundary sectionName="Spot Holdings" fallback={
            <PageWrapper className="flex flex-col bg-background">
                <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] gap-4 p-6">
                    <p className="text-sm text-zinc-400 text-center">Something went wrong on this page.</p>
                    <button type="button" onClick={() => window.location.reload()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold">Reload page</button>
                </div>
            </PageWrapper>
        }>
        <PageWrapper className="flex flex-col gap-4 px-4 md:px-6 lg:px-8 pt-4 pb-12 max-w-none w-full">
            {/* Compact Header with Stats */}
            <div className="flex flex-col gap-3">
                <div className="tm-page-header clone-noise">
                    <div className="tm-page-header-main">
                        <div className="tm-page-header-icon">
                            <Wallet className="h-5 w-5 text-cyan-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="tm-page-title">Spot Holdings</h1>
                                <div className="tm-live-pill">
                                    <div className="tm-live-pill-dot animate-pulse" />
                                    <span>LIVE</span>
                                </div>
                            </div>
                            <p className="tm-page-subtitle">{enabledConnectionsList.length} sources • {stats.assetCount} assets</p>
                        </div>
                    </div>
                </div>

                {/* Quick Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    <StatCard 
                        label="Total Value" 
                        value={formatCurrency(viewTotal)} 
                        icon={DollarSign}
                        color="cyan"
                    />
                    <StatCard 
                        label="Cost Basis" 
                        value={formatCurrency(portfolioAnalytics.totalCostBasis)}
                        icon={Target}
                        color="indigo"
                    />
                    <StatCard 
                        label="Unrealized PnL" 
                        value={`${portfolioAnalytics.totalUnrealizedPnl >= 0 ? '+' : ''}${formatCurrency(portfolioAnalytics.totalUnrealizedPnl)}`}
                        subValue={portfolioAnalytics.totalCostBasis > 0 
                            ? `${((portfolioAnalytics.totalUnrealizedPnl / portfolioAnalytics.totalCostBasis) * 100).toFixed(1)}%` 
                            : ''}
                        icon={portfolioAnalytics.totalUnrealizedPnl >= 0 ? TrendingUp : TrendingDown}
                        trend={portfolioAnalytics.totalUnrealizedPnl >= 0 ? 'up' : 'down'}
                        color={portfolioAnalytics.totalUnrealizedPnl >= 0 ? 'emerald' : 'rose'}
                    />
                    <StatCard 
                        label="Realized PnL" 
                        value={`${portfolioAnalytics.totalRealizedPnl >= 0 ? '+' : ''}${formatCurrency(portfolioAnalytics.totalRealizedPnl)}`}
                        icon={BarChart3}
                        trend={portfolioAnalytics.totalRealizedPnl >= 0 ? 'up' : 'down'}
                        color={portfolioAnalytics.totalRealizedPnl >= 0 ? 'emerald' : 'rose'}
                    />
                    <StatCard 
                        label="Stablecoins" 
                        value={formatCurrency(stats.stablecoinValue)}
                        subValue={`${stats.stablecoinPercent.toFixed(0)}%`}
                        icon={PieChart}
                        color="amber"
                    />
                    <StatCard 
                        label="Win Rate" 
                        value={`${portfolioAnalytics.winRate.toFixed(0)}%`}
                        subValue={`${portfolioAnalytics.totalTrades} trades`}
                        icon={Activity}
                        trend={portfolioAnalytics.winRate >= 50 ? 'up' : 'down'}
                        color={portfolioAnalytics.winRate >= 50 ? 'emerald' : 'amber'}
                    />
                </div>

                <AIPulseCard
                    title="Spot Risk Notes"
                    response={aiSpotRisk}
                    loading={aiSpotLoading}
                />

                {/* Profit/Loss Leaders - Only show if we have data */}
                {(stats.mostProfitable?.unrealizedPnl > 0 || stats.biggestLoss?.unrealizedPnl < 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {stats.mostProfitable && stats.mostProfitable.unrealizedPnl > 0 && (
                            <PnLHighlightCard
                                symbol={stats.mostProfitable.symbol}
                                label="Top Profit"
                                pnl={stats.mostProfitable.unrealizedPnl}
                                pnlPercent={stats.mostProfitable.unrealizedPnlPercent}
                                avgPrice={stats.mostProfitable.avgBuyPrice}
                                type="profit"
                            />
                        )}
                        {stats.biggestLoss && stats.biggestLoss.unrealizedPnl < 0 && (
                            <PnLHighlightCard
                                symbol={stats.biggestLoss.symbol}
                                label="Biggest Loss"
                                pnl={stats.biggestLoss.unrealizedPnl}
                                pnlPercent={stats.biggestLoss.unrealizedPnlPercent}
                                avgPrice={stats.biggestLoss.avgBuyPrice}
                                type="loss"
                            />
                        )}
                    </div>
                )}
            </div>

            {/* Accounts Overview - Compact */}
            <AccountsOverview
                assets={assetsList}
                connections={enabledConnectionsList}
                selectedAccount={selectedAccount || 'All'}
                onSelectAccount={(account, meta) => {
                    setSelectedAccount(account);
                    setSelectedAccountChainIds(meta?.chainIds);
                }}
                connectionErrors={connectionErrors ?? {}}
                onRetryConnection={triggerConnectionsRefetch}
            />

            {/* Main Content Grid */}
            <div className="grid gap-4 lg:grid-cols-12">
                {/* Left Column - Main Content */}
                <div className="lg:col-span-9 space-y-4">
                    {/* Highlights - Key metrics and alerts */}
                    {(!selectedAccount || selectedAccount === 'All') && (
                        <SpotHighlights assets={assetsList} orders={Array.isArray(spotOrders) ? spotOrders : []} />
                    )}

                    {/* Asset Cards with Sparklines - Detailed view */}
                    <SpotAssetCards assets={finalDisplayAssets} onSelectAsset={setAiAsset} highlightedSymbol={highlightedSymbol} />

                    {/* Holdings Table */}
                    <HoldingsTable assets={finalDisplayAssets} />
                </div>

                {/* Right Column - Sidebar */}
                <div className="lg:col-span-3">
                    <div className="sticky top-4 space-y-4">
                        {/* Neural Alpha Feed - AI Insights */}
                        <div className="min-h-[200px]">
                            <NeuralAlphaFeed
                                compact
                                additionalItems={socialItems}
                                allowedTypes={[
                                    "PLAYBOOK_PLAN_LEVELS",
                                    "PLAYBOOK_COMPOSITE_TRIGGER",
                                    "PLAYBOOK_VALUE_ACCEPTANCE",
                                    "LEVEL_NO_ORDER_WARNING",
                                    "PLAYBOOK_LEVEL_EXECUTED",
                                    "PLAYBOOK_PLAN_COMPLETE",
                                    "JOURNAL_REMINDER",
                                    "PERP_STOPLOSS_REMINDER",
                                    "SOCIAL_MENTION",
                                ]}
                            />
                        </div>
                        
                        {/* Portfolio Allocation */}
                        <AdvancedAllocation assets={finalDisplayAssets} loading={loading} />
                        
                        {/* Top Movers - Enhanced */}
                        {(stats.topGainer || stats.topLoser) && (
                            <div className="p-3 rounded-xl bg-zinc-900/50 border border-white/[0.05] backdrop-blur-sm">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="p-1 rounded-md bg-amber-500/10">
                                        <Zap className="h-3 w-3 text-amber-400" />
                                    </div>
                                    <h3 className="text-[10px] font-black text-white uppercase tracking-wider">24h Movers</h3>
                                </div>
                                <div className="space-y-2">
                                    {stats.topGainer && stats.topGainer.priceChange24h && stats.topGainer.priceChange24h > 0 && (
                                        <div 
                                            className="group flex items-center justify-between p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10 hover:bg-emerald-500/10 transition-all cursor-pointer"
                                            onClick={() => window.dispatchEvent(new CustomEvent('highlight-asset', { detail: { symbol: stats.topGainer!.symbol } }))}
                                        >
                                            <div className="flex items-center gap-2">
                                                <TokenIcon symbol={stats.topGainer.symbol} size={20} />
                                                <div>
                                                    <span className="text-xs font-bold text-white block">{stats.topGainer.symbol}</span>
                                                    <span className="text-[9px] text-zinc-500">{formatCurrency(stats.topGainer.price || 0)}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <TrendingUp className="w-3 h-3 text-emerald-400" />
                                                <span className="text-xs font-mono font-bold text-emerald-400">
                                                    +{stats.topGainer.priceChange24h.toFixed(2)}%
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                    {stats.topLoser && stats.topLoser.priceChange24h && stats.topLoser.priceChange24h < 0 && (
                                        <div 
                                            className="group flex items-center justify-between p-2.5 rounded-lg bg-rose-500/5 border border-rose-500/10 hover:bg-rose-500/10 transition-all cursor-pointer"
                                            onClick={() => window.dispatchEvent(new CustomEvent('highlight-asset', { detail: { symbol: stats.topLoser!.symbol } }))}
                                        >
                                            <div className="flex items-center gap-2">
                                                <TokenIcon symbol={stats.topLoser.symbol} size={20} />
                                                <div>
                                                    <span className="text-xs font-bold text-white block">{stats.topLoser.symbol}</span>
                                                    <span className="text-[9px] text-zinc-500">{formatCurrency(stats.topLoser.price || 0)}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <TrendingDown className="w-3 h-3 text-rose-400" />
                                                <span className="text-xs font-mono font-bold text-rose-400">
                                                    {stats.topLoser.priceChange24h.toFixed(2)}%
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* AI Insight Modal */}
            <AssetAIInsight
                symbol={aiAsset || ""}
                isOpen={!!aiAsset}
                onClose={() => setAiAsset(null)}
            />
        </PageWrapper>
        </SectionErrorBoundary>
    );
}
