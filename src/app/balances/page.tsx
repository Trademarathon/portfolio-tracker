"use client";

import { usePortfolio } from "@/contexts/PortfolioContext";
import { formatCurrency, cn } from "@/lib/utils";
import {
    Wallet, Layers, TrendingUp, TrendingDown, DollarSign, PieChart, Shield, Zap,
    RefreshCw, Search, Activity, BarChart3, Target, Receipt, X, Trophy, Skull,
    ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { PortfolioAllocation } from "@/components/Dashboard/PortfolioAllocation";
import { AccountsOverview } from "@/components/Dashboard/AccountsOverview";
import { StablecoinDeepDive } from "@/components/Dashboard/StablecoinDeepDive";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PageWrapper } from "@/components/Layout/PageWrapper";
import Loading from "@/app/loading";
import { SectionErrorBoundary } from "@/components/Dashboard/SectionErrorBoundary";
import { HoldingsTable } from "@/components/Dashboard/HoldingsTable";
import { SpotAssetCards } from "@/components/Dashboard/SpotAssetCards";
import { Input } from "@/components/ui/input";
import { useState, useMemo, memo, useRef, useEffect, useCallback } from "react";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { calculatePortfolioAnalytics, calculateAssetAnalytics } from "@/lib/utils/analytics";
import { GlobalAIFeed } from "@/components/Dashboard/GlobalAIFeed";
import { StatCard } from "@/components/ui/StatCard";
import dynamic from "next/dynamic";
import { useAIInsight } from "@/lib/ai-orchestrator/hooks";
import { AIPulseCard } from "@/components/Dashboard/AIPulseCard";
import { AssetAIInsight } from "@/components/Dashboard/AssetAIInsight";
import { useConnectorReliability } from "@/hooks/useConnectorReliability";
import { DataReliabilityBar } from "@/components/ui/DataReliabilityBar";

const OpenPositionsTable = dynamic(
    () => import("@/components/Dashboard/Overview/OpenPositionsTable").then((m) => ({ default: m.OpenPositionsTable })),
    { ssr: false, loading: () => <div className="h-40 animate-pulse rounded-xl bg-white/5" /> }
);

const STABLE_SYMBOLS = new Set(["USDT", "USDC", "DAI", "BUSD", "PYUSD", "FRAX", "TUSD", "USDE", "USDP", "GUSD"]);

// Top Holdings Mini Card with Sparkline and Analytics
const TopHoldingCard = memo(function TopHoldingCard({
    symbol,
    value,
    percent,
    price: _price,
    balance,
    avgBuyPrice,
    unrealizedPnlPercent,
    buyCount
}: {
    symbol: string;
    value: number;
    percent: number;
    price: number;
    balance: number;
    avgBuyPrice?: number;
    unrealizedPnlPercent?: number;
    buyCount?: number;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const priceData = useMemo(() => {
        // Lightweight deterministic sparkline to avoid per-card API requests on page load.
        let seed = 0;
        for (let i = 0; i < symbol.length; i++) seed += symbol.charCodeAt(i) * (i + 1);
        const base = 100 + (seed % 25);
        return Array.from({ length: 24 }, (_, i) => {
            const wave = Math.sin((i + seed % 7) / 3.4) * 2.2;
            const drift = i * ((seed % 2 === 0 ? 1 : -1) * 0.08);
            return base + wave + drift;
        });
    }, [symbol]);

    // Draw sparkline
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || priceData.length < 2) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const width = canvas.offsetWidth;
        const height = 32;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);

        const min = Math.min(...priceData);
        const max = Math.max(...priceData);
        const range = max - min || 1;
        const isUp = priceData[priceData.length - 1] >= priceData[0];
        const color = isUp ? "#34d399" : "#f87171";

        // Gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, `${color}15`);
        gradient.addColorStop(1, `${color}00`);

        // Fill
        ctx.beginPath();
        ctx.moveTo(0, height);
        priceData.forEach((p, i) => {
            const x = (i / (priceData.length - 1)) * width;
            const y = height - 2 - ((p - min) / range) * (height - 4);
            ctx.lineTo(x, y);
        });
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Line
        ctx.beginPath();
        priceData.forEach((p, i) => {
            const x = (i / (priceData.length - 1)) * width;
            const y = height - 2 - ((p - min) / range) * (height - 4);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }, [priceData]);

    const hasTrades = (buyCount || 0) > 0;
    const pnlIsPositive = (unrealizedPnlPercent || 0) >= 0;

    return (
        <div className="group relative flex flex-col gap-1.5 p-2.5 rounded-2xl bg-zinc-900/40 border border-white/[0.03] hover:border-cyan-500/20 transition-all cursor-pointer clone-wallet-card clone-noise">
            <div className="flex items-center gap-2.5">
                <TokenIcon symbol={symbol} size={28} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-white">{symbol}</span>
                        <span className="text-[10px] font-mono font-bold text-zinc-200 font-balance-digital">{formatCurrency(value)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[9px] text-zinc-600">{balance.toFixed(4)}</span>
                        <span className="text-[9px] font-bold clone-chip-blue px-1.5 py-0.5 rounded-md border">{percent.toFixed(1)}%</span>
                    </div>
                </div>
            </div>

            {/* Sparkline */}
            <div className="h-7 w-full rounded-md bg-black/25 border border-white/[0.04]">
                <canvas ref={canvasRef} className="w-full h-full" />
            </div>

            {/* Cost Basis Stats */}
            {hasTrades && (
                <div className="flex items-center justify-between pt-1.5 border-t border-white/[0.03]">
                    <div className="flex flex-col">
                        <span className="text-[7px] text-zinc-600 uppercase">Avg Buy</span>
                        <span className="text-[9px] font-mono font-bold text-zinc-400">
                            {avgBuyPrice && avgBuyPrice > 0 ? formatCurrency(avgBuyPrice) : '—'}
                        </span>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[7px] text-zinc-600 uppercase">PnL</span>
                        <span className={cn(
                            "text-[9px] font-mono font-bold",
                            pnlIsPositive ? "text-emerald-400" : "text-rose-400"
                        )}>
                            {pnlIsPositive ? '+' : ''}{(unrealizedPnlPercent || 0).toFixed(1)}%
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
});

// Profit/Loss Highlight Card from Spot
function PnLHighlightCard({
    symbol,
    label,
    pnl,
    pnlPercent,
    avgPrice,
    type,
    onHighlight
}: {
    symbol: string;
    label: string;
    pnl: number;
    pnlPercent: number;
    avgPrice: number;
    type: 'profit' | 'loss';
    onHighlight: (symbol: string) => void;
}) {
    const isProfit = type === 'profit';

    return (
        <div className={cn(
            "group relative flex items-center gap-3 p-3 rounded-xl border transition-all duration-300",
            "hover:scale-[1.01] cursor-pointer clone-wallet-card clone-noise",
            isProfit
                ? "bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/10"
                : "bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent border-rose-500/20 hover:shadow-lg hover:shadow-rose-500/10"
        )}
            onClick={() => onHighlight(symbol)}
        >
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

export default function BalancesPage() {
    const {
        assets,
        loading,
        connections,
        wsConnectionStatus,
        hideDust,
        setHideDust,
        totalValue,
        totalPnlUsd: _totalPnlUsd,
        totalPnlPercent: _totalPnlPercent,
        positions,
        transactions,
        transfers,
        connectionErrors,
        triggerConnectionsRefetch,
        futuresMarketData,
    } = usePortfolio();
    const assetsList = useMemo(() => (Array.isArray(assets) ? assets : []), [assets]);
    const [assetsSnapshot, setAssetsSnapshot] = useState<typeof assetsList>([]);
    const connectionsList = useMemo(() => (Array.isArray(connections) ? connections : []), [connections]);
    const enabledConnectionsList = useMemo(
        () => connectionsList.filter(c => c.enabled !== false),
        [connectionsList]
    );
    useEffect(() => {
        if (assetsList.length > 0) {
            setAssetsSnapshot(assetsList);
        }
    }, [assetsList]);

    const usingSnapshot = assetsList.length === 0 && assetsSnapshot.length > 0;
    const effectiveAssetsList = assetsList.length > 0 ? assetsList : assetsSnapshot;

    const [searchTerm, setSearchTerm] = useState("");
    const [refreshing, setRefreshing] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
    const [selectedAccountChainIds, setSelectedAccountChainIds] = useState<string[] | undefined>(undefined);
    const [aiAsset, setAiAsset] = useState<string | null>(null);
    const bootstrapRefetchedRef = useRef(false);

    const handleHighlightAsset = useCallback((symbol: string) => {
        setAiAsset(symbol);
    }, []);

    // Filter assets by selected account (connection/widget)
    const displayAssetsRaw = useMemo(() => {
        if (!selectedAccount || selectedAccount === 'All') return effectiveAssetsList;

        const allBreakdownKeys = Array.from(new Set(effectiveAssetsList.flatMap(a => Object.keys(a.breakdown || {}))));
        const keys: string[] = selectedAccountChainIds?.length
            ? selectedAccountChainIds
            : allBreakdownKeys.filter(k => k === selectedAccount || k.startsWith(selectedAccount + '::'));

        if (keys.length === 0) return [];

        return effectiveAssetsList
            .filter(asset => asset.breakdown && keys.some(k => (asset.breakdown![k] || 0) > 0))
            .map(asset => {
                const balance = keys.reduce((sum, k) => sum + (asset.breakdown![k] || 0), 0);
                return {
                    ...asset,
                    balance,
                    valueUsd: balance * (asset.price || 0),
                    allocations: 0
                };
            });
    }, [effectiveAssetsList, selectedAccount, selectedAccountChainIds]);
    const displayAssets = useMemo(() => {
        const viewTotal = displayAssetsRaw.reduce((sum, a) => sum + a.valueUsd, 0);
        return displayAssetsRaw.map(a => ({
            ...a,
            allocations: viewTotal > 0 ? (a.valueUsd / viewTotal) * 100 : 0
        }));
    }, [displayAssetsRaw]);

    // Calculate comprehensive portfolio analytics (guarded to avoid crash)
    const portfolioAnalytics = useMemo(() => {
        try {
            return calculatePortfolioAnalytics(displayAssets, Array.isArray(transactions) ? transactions : [], {
                transfers: Array.isArray(transfers) ? transfers : [],
            });
        } catch {
            return { totalCostBasis: 0, totalUnrealizedPnl: 0, totalRealizedPnl: 0, totalTrades: 0, winRate: 0 };
        }
    }, [displayAssets, transactions, transfers]);

    // Calculate per-asset analytics for top holdings only (guarded)
    const topAssetSymbols = useMemo(
        () => [...displayAssets].sort((a, b) => b.valueUsd - a.valueUsd).slice(0, 5).map(a => a.symbol),
        [displayAssets]
    );
    const assetAnalyticsMap = useMemo(() => {
        const map: Record<string, ReturnType<typeof calculateAssetAnalytics>> = {};
        const txs = Array.isArray(transactions) ? transactions : [];
        const trfs = Array.isArray(transfers) ? transfers : [];
        displayAssets.forEach(asset => {
            if (!topAssetSymbols.includes(asset.symbol)) return;
            try {
                map[asset.symbol] = calculateAssetAnalytics(asset, txs, { transfers: trfs });
            } catch {
                // skip or use default; component handles missing analytics
            }
        });
        return map;
    }, [displayAssets, transactions, topAssetSymbols, transfers]);

    // Calculate stats (reflects filter when widget selected)
    const stats = useMemo(() => {
        const stablecoins = ['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'USDP', 'FRAX'];
        const viewTotal = displayAssets.reduce((s, a) => s + a.valueUsd, 0);
        const stablecoinValue = displayAssets
            .filter(a => stablecoins.includes(a.symbol.toUpperCase()))
            .reduce((sum, a) => sum + a.valueUsd, 0);

        const cryptoValue = viewTotal - stablecoinValue;
        const topAssets = [...displayAssets]
            .sort((a, b) => b.valueUsd - a.valueUsd)
            .slice(0, 5);

        return {
            stablecoinValue,
            cryptoValue,
            stablecoinPercent: viewTotal > 0 ? (stablecoinValue / viewTotal) * 100 : 0,
            assetCount: displayAssets.filter(a => a.valueUsd > 1).length,
            topAssets,
            viewTotal,
            mostProfitable: [...Object.values(assetAnalyticsMap)].sort((a, b) => b.unrealizedPnl - a.unrealizedPnl)[0],
            biggestLoss: [...Object.values(assetAnalyticsMap)].sort((a, b) => a.unrealizedPnl - b.unrealizedPnl)[0]
        };
    }, [displayAssets, assetAnalyticsMap]);

    const handleRefresh = () => {
        setRefreshing(true);
        try {
            triggerConnectionsRefetch?.();
        } finally {
            setTimeout(() => setRefreshing(false), 1500);
        }
    };

    // If user has connected exchanges but assets are still empty, force one bootstrap refetch.
    useEffect(() => {
        if (bootstrapRefetchedRef.current) return;
        const hasEnabled = enabledConnectionsList.length > 0;
        const hasAnyAssets = effectiveAssetsList.length > 0;
        if (hasEnabled && !hasAnyAssets) {
            bootstrapRefetchedRef.current = true;
            triggerConnectionsRefetch?.();
        }
    }, [enabledConnectionsList.length, effectiveAssetsList.length, triggerConnectionsRefetch]);

    const handleSelectAccount = (accountId: string, accountMeta?: { chainIds?: string[] }) => {
        setSelectedAccount(accountId);
        setSelectedAccountChainIds(accountMeta?.chainIds);
    };

    // Include open perp/futures PnL in total when viewing all accounts (so Hyperliquid perp shows in balances)
    const positionsList = Array.isArray(positions) ? positions : [];
    const perpPnl = positionsList.reduce((sum, pos) => sum + (pos.pnl ?? 0), 0);
    const displayTotalValue = (!selectedAccount || selectedAccount === 'All')
        ? stats.viewTotal + perpPnl
        : stats.viewTotal;

    const stableStats = useMemo(() => {
        const stableValue = effectiveAssetsList.reduce((sum, asset) => {
            if (!STABLE_SYMBOLS.has(asset.symbol)) return sum;
            return sum + (asset.valueUsd || 0);
        }, 0);
        const total = totalValue || stats.viewTotal || effectiveAssetsList.reduce((sum, asset) => sum + (asset.valueUsd || 0), 0);
        return {
            stableValue,
            totalValue: total,
            stablePct: total > 0 ? (stableValue / total) * 100 : 0,
        };
    }, [effectiveAssetsList, totalValue, stats.viewTotal]);

    const topHoldings = useMemo(() => {
        return [...effectiveAssetsList]
            .sort((a, b) => (b.valueUsd || 0) - (a.valueUsd || 0))
            .slice(0, 5)
            .map((asset) => ({
                symbol: asset.symbol,
                valueUsd: asset.valueUsd || 0,
                allocPct: stableStats.totalValue ? (asset.valueUsd || 0) / stableStats.totalValue * 100 : 0,
            }));
    }, [effectiveAssetsList, stableStats.totalValue]);

    const stableContext = useMemo(
        () => ({
            stableValue: stableStats.stableValue,
            stablePct: Number(stableStats.stablePct.toFixed(2)),
            totalValue: stableStats.totalValue,
            topHoldings,
        }),
        [stableStats, topHoldings]
    );

    const { data: stableInsight, loading: stableInsightLoading } = useAIInsight(
        "balances_stablecoin_risk",
        stableContext,
        [stableStats.stablePct, effectiveAssetsList.length, stableStats.totalValue],
        true,
        { stream: true }
    );

    const reliability = useConnectorReliability({
        connections: enabledConnectionsList,
        wsConnectionStatus,
        connectionErrors,
        loading,
        dataPoints: effectiveAssetsList.length + positionsList.length,
        usingSnapshot,
    });

    if (loading && effectiveAssetsList.length === 0 && (connectionsList?.length ?? 0) === 0) {
        return (
            <PageWrapper className="flex flex-col bg-background">
                <div className="flex-1 flex items-center justify-center min-h-[50vh]">
                    <Loading />
                </div>
            </PageWrapper>
        );
    }

    return (
        <SectionErrorBoundary sectionName="Balances" fallback={
            <PageWrapper className="flex flex-col bg-background">
                <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] gap-4 p-6">
                    <p className="text-sm text-zinc-400 text-center">Something went wrong on this page.</p>
                    <button type="button" onClick={() => window.location.reload()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold">Reload page</button>
                </div>
            </PageWrapper>
        }>
            <PageWrapper className="flex flex-col gap-4 px-4 md:px-6 lg:px-8 pt-4 pb-12 max-w-none w-full">
                {/* Compact Header */}
                <div className="tm-page-header clone-noise">
                    <div className="tm-page-header-main">
                        <div className="tm-page-header-icon">
                            <Wallet className="h-5 w-5 text-zinc-200" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="tm-page-title">Account Balances</h1>
                                <div className="tm-live-pill">
                                    <div className="tm-live-pill-dot" />
                                    <span>LIVE</span>
                                </div>
                            </div>
                            <p className="tm-page-subtitle">{enabledConnectionsList.length} connected sources</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                            <Input
                                placeholder="Search..."
                                className="w-[160px] pl-8 text-xs tm-toolbar-input"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={handleRefresh}
                            className="p-2 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors tm-toolbar-input"
                        >
                            <RefreshCw className={cn("h-3.5 w-3.5 text-zinc-400", refreshing && "animate-spin")} />
                        </button>
                    </div>
                </div>

                <DataReliabilityBar
                    title="Balances Feed"
                    summary={reliability}
                    onRetry={triggerConnectionsRefetch}
                />

                <AIPulseCard
                    title="Stablecoin Risk"
                    response={stableInsight}
                    loading={stableInsightLoading}
                />

                {/* Profit/Loss Leaders - From Spot */}
                {(stats.mostProfitable?.unrealizedPnl > 0 || stats.biggestLoss?.unrealizedPnl < 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                        {stats.mostProfitable && stats.mostProfitable.unrealizedPnl > 0 && (
                            <PnLHighlightCard
                                symbol={stats.mostProfitable.symbol}
                                label="Top Profit"
                                pnl={stats.mostProfitable.unrealizedPnl}
                                pnlPercent={stats.mostProfitable.unrealizedPnlPercent}
                                avgPrice={stats.mostProfitable.avgBuyPrice}
                                type="profit"
                                onHighlight={handleHighlightAsset}
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
                                onHighlight={handleHighlightAsset}
                            />
                        )}
                    </div>
                )}

                {/* Stats Grid - Enhanced with Cost Basis & PnL (Total Value includes spot + open perp PnL) */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
                    <StatCard
                        label="Total Value"
                        value={formatCurrency(displayTotalValue)}
                        icon={DollarSign}
                        color="cyan"
                        variant="clean"
                    />
                    {positionsList.length > 0 && (
                        <StatCard
                            label="Futures PnL"
                            value={`${perpPnl >= 0 ? '+' : ''}${formatCurrency(perpPnl)}`}
                            subValue={`${positionsList.length} position${positionsList.length !== 1 ? 's' : ''}`}
                            icon={Activity}
                            trend={perpPnl >= 0 ? 'up' : 'down'}
                            color={perpPnl >= 0 ? 'emerald' : 'rose'}
                            variant="clean"
                        />
                    )}
                    <StatCard
                        label="Cost Basis"
                        value={formatCurrency(portfolioAnalytics.totalCostBasis)}
                        icon={Target}
                        color="primary"
                        variant="clean"
                    />
                    <StatCard
                        label="Unrealized PnL"
                        value={`${portfolioAnalytics.totalUnrealizedPnl >= 0 ? '+' : ''}${formatCurrency(portfolioAnalytics.totalUnrealizedPnl)}`}
                        subValue={portfolioAnalytics.totalCostBasis > 0
                            ? `${((portfolioAnalytics.totalUnrealizedPnl / portfolioAnalytics.totalCostBasis) * 100).toFixed(1)}%`
                            : '—'}
                        icon={portfolioAnalytics.totalUnrealizedPnl >= 0 ? TrendingUp : TrendingDown}
                        trend={portfolioAnalytics.totalUnrealizedPnl >= 0 ? 'up' : 'down'}
                        color={portfolioAnalytics.totalUnrealizedPnl >= 0 ? 'emerald' : 'rose'}
                        variant="clean"
                    />
                    <StatCard
                        label="Realized PnL"
                        value={`${portfolioAnalytics.totalRealizedPnl >= 0 ? '+' : ''}${formatCurrency(portfolioAnalytics.totalRealizedPnl)}`}
                        icon={Receipt}
                        trend={portfolioAnalytics.totalRealizedPnl >= 0 ? 'up' : 'down'}
                        color={portfolioAnalytics.totalRealizedPnl >= 0 ? 'emerald' : 'rose'}
                        variant="clean"
                    />
                    <StatCard
                        label="Crypto"
                        value={formatCurrency(stats.cryptoValue)}
                        subValue={`${(100 - stats.stablecoinPercent).toFixed(0)}%`}
                        icon={BarChart3}
                        color="amber"
                        variant="clean"
                    />
                    <StatCard
                        label="Stablecoins"
                        value={formatCurrency(stats.stablecoinValue)}
                        subValue={`${stats.stablecoinPercent.toFixed(0)}%`}
                        icon={Shield}
                        color="emerald"
                        variant="clean"
                    />
                    <StatCard
                        label="Assets"
                        value={String(stats.assetCount)}
                        icon={PieChart}
                        color="primary"
                        variant="clean"
                    />
                    <StatCard
                        label="Sources"
                        value={String(enabledConnectionsList.length)}
                        icon={Zap}
                        color="cyan"
                        variant="clean"
                    />
                </div>

                {/* Main Content Grid */}
                <div className="grid gap-4 lg:grid-cols-12">
                    {/* Left - Main Content */}
                    <div className="lg:col-span-9 space-y-4">
                        {/* Accounts Overview */}
                        <AccountsOverview
                            assets={effectiveAssetsList}
                            connections={enabledConnectionsList}
                            selectedAccount={selectedAccount || 'All'}
                            onSelectAccount={handleSelectAccount}
                            connectionErrors={connectionErrors ?? {}}
                            onRetryConnection={triggerConnectionsRefetch}
                        />

                        {/* Open positions (same as Overview – so perp shows in Balances) */}
                        {positionsList.length > 0 && (
                            <OpenPositionsTable
                                positions={positionsList}
                                marketData={futuresMarketData ?? {}}
                            />
                        )}

                        {/* Allocation + Liquidity row */}
                        <div className="grid gap-4 md:grid-cols-2">
                            <PortfolioAllocation assets={displayAssets} />
                            <StablecoinDeepDive assets={displayAssets} />
                        </div>

                        {/* Performance Cards - From Spot */}
                        <SpotAssetCards assets={displayAssets} onSelectAsset={handleHighlightAsset} />

                        {/* Holdings Table */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-2">
                                    <Layers className="h-4 w-4 text-cyan-400" />
                                    <h2 className="text-sm font-black text-white uppercase tracking-wider">Asset Inventory</h2>
                                    {selectedAccount && selectedAccount !== 'All' && (
                                        <button
                                            onClick={() => handleSelectAccount('All')}
                                            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-bold hover:bg-cyan-500/20 transition-colors"
                                        >
                                            <span>Showing: {selectedAccount.startsWith('hw_') ? selectedAccount.replace('hw_', '').replace(/^[a-z]+_/, '') : enabledConnectionsList.find(c => c.id === selectedAccount)?.name || selectedAccount.slice(0, 8)}</span>
                                            <X className="h-3 w-3" />
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Switch
                                        id="hide-dust"
                                        checked={hideDust}
                                        onCheckedChange={setHideDust}
                                        className="scale-75"
                                    />
                                    <Label htmlFor="hide-dust" className="text-[9px] font-bold text-zinc-500 uppercase cursor-pointer">
                                        Hide Dust
                                    </Label>
                                </div>
                            </div>
                            <HoldingsTable assets={displayAssets} connections={enabledConnectionsList} />
                        </div>
                    </div>

                    {/* Right - Sidebar */}
                    <div className="lg:col-span-3 space-y-4">
                        {/* Global AI Feed */}
                        <GlobalAIFeed
                            compact
                            scope="balances"
                            socialSymbols={effectiveAssetsList.map((a) => a.symbol)}
                        />

                        {/* Top Holdings */}
                        <div className="p-4 tm-widget-card clone-wallet-card clone-noise">
                            <div className="flex items-center gap-2 mb-3">
                                <Activity className="h-4 w-4 text-cyan-400" />
                                <h3 className="text-xs font-black text-white uppercase tracking-wider">Top Holdings</h3>
                            </div>
                            <div className="space-y-2">
                                {stats.topAssets.map((asset) => {
                                    const analytics = assetAnalyticsMap[asset.symbol];
                                    return (
                                        <TopHoldingCard
                                            key={asset.symbol}
                                            symbol={asset.symbol}
                                            value={asset.valueUsd}
                                            percent={asset.allocations}
                                            price={asset.price || 0}
                                            balance={asset.balance}
                                            avgBuyPrice={analytics?.avgBuyPrice}
                                            unrealizedPnlPercent={analytics?.unrealizedPnlPercent}
                                            buyCount={analytics?.buyCount}
                                        />
                                    );
                                })}
                            </div>
                        </div>

                        {/* Trading Activity */}
                        <div className="p-4 tm-widget-card clone-wallet-card clone-noise">
                            <h3 className="text-xs font-black text-white uppercase tracking-wider mb-3">Trading Activity</h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-zinc-500">Total Trades</span>
                                    <span className="text-[10px] font-bold text-cyan-400">{portfolioAnalytics.totalTrades}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-zinc-500">Win Rate</span>
                                    <span className={cn(
                                        "text-[10px] font-bold",
                                        portfolioAnalytics.winRate > 50 ? "text-emerald-400" : "text-amber-400"
                                    )}>
                                        {portfolioAnalytics.winRate.toFixed(1)}%
                                    </span>
                                </div>
                                <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                                    <div
                                        className={cn(
                                            "h-full rounded-full transition-all",
                                            portfolioAnalytics.winRate > 60 ? "bg-emerald-500" :
                                                portfolioAnalytics.winRate > 40 ? "bg-amber-500" : "bg-rose-500"
                                        )}
                                        style={{ width: `${portfolioAnalytics.winRate}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Portfolio Health */}
                        <div className="p-4 tm-widget-card clone-wallet-card clone-noise">
                            <h3 className="text-xs font-black text-white uppercase tracking-wider mb-3">Portfolio Health</h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-zinc-500">Diversification</span>
                                    <span className="text-[10px] font-bold text-emerald-400">
                                        {stats.assetCount > 10 ? 'High' : stats.assetCount > 5 ? 'Medium' : 'Low'}
                                    </span>
                                </div>
                                <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all"
                                        style={{ width: `${Math.min(stats.assetCount * 10, 100)}%` }}
                                    />
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                    <span className="text-[10px] text-zinc-500">Stablecoin Buffer</span>
                                    <span className={cn(
                                        "text-[10px] font-bold",
                                        stats.stablecoinPercent > 20 ? "text-emerald-400" :
                                            stats.stablecoinPercent > 10 ? "text-amber-400" : "text-rose-400"
                                    )}>
                                        {stats.stablecoinPercent.toFixed(1)}%
                                    </span>
                                </div>
                                <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                                    <div
                                        className={cn(
                                            "h-full rounded-full transition-all",
                                            stats.stablecoinPercent > 20 ? "bg-emerald-500" :
                                                stats.stablecoinPercent > 10 ? "bg-amber-500" : "bg-rose-500"
                                        )}
                                        style={{ width: `${Math.min(stats.stablecoinPercent * 2, 100)}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* AI Insight Modal from Spot */}
                <AssetAIInsight
                    symbol={aiAsset || ""}
                    isOpen={!!aiAsset}
                    onClose={() => setAiAsset(null)}
                />
            </PageWrapper>
        </SectionErrorBoundary>
    );
}
