"use client";

import { useMemo, useState, useEffect } from "react";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { PageWrapper } from "@/components/Layout/PageWrapper";
import { SectionErrorBoundary } from "@/components/Dashboard/SectionErrorBoundary";
import { AccountsOverview } from "@/components/Dashboard/AccountsOverview";
import { SpotAssetCards } from "@/components/Dashboard/SpotAssetCards";
import { HoldingsTable } from "@/components/Dashboard/HoldingsTable";
import { GlobalAIFeed } from "@/components/Dashboard/GlobalAIFeed";
import { AssetAIInsight } from "@/components/Dashboard/AssetAIInsight";
import { AIPulseCard } from "@/components/Dashboard/AIPulseCard";
import { useAIInsight } from "@/lib/ai-orchestrator/hooks";
import { StatCard } from "@/components/ui/StatCard";
import { Wallet, PieChart, Activity, Target } from "lucide-react";
import Loading from "@/app/loading";
import { useConnectorReliability } from "@/hooks/useConnectorReliability";
import { DataReliabilityBar } from "@/components/ui/DataReliabilityBar";

const STABLE_SYMBOLS = new Set(["USDT", "USDC", "DAI", "BUSD", "PYUSD", "FRAX", "TUSD", "USDE", "USDP", "GUSD"]);

function isSpotBreakdownKey(key: string): boolean {
    return !key.endsWith("::Perp");
}

export default function SpotPage() {
    const {
        assets,
        loading,
        connections,
        wsConnectionStatus,
        connectionErrors,
        triggerConnectionsRefetch,
    } = usePortfolio();

    const assetsList = useMemo(() => (Array.isArray(assets) ? assets : []), [assets]);
    const [assetsSnapshot, setAssetsSnapshot] = useState<typeof assetsList>([]);
    const connectionsList = useMemo(() => (Array.isArray(connections) ? connections : []), [connections]);
    const enabledConnections = useMemo(
        () => connectionsList.filter((conn) => conn.enabled !== false),
        [connectionsList]
    );
    useEffect(() => {
        if (assetsList.length > 0) {
            setAssetsSnapshot(assetsList);
        }
    }, [assetsList]);

    const usingSnapshot = assetsList.length === 0 && assetsSnapshot.length > 0;
    const effectiveAssetsList = assetsList.length > 0 ? assetsList : assetsSnapshot;

    const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
    const [selectedAccountChainIds, setSelectedAccountChainIds] = useState<string[] | undefined>(undefined);
    const [aiAsset, setAiAsset] = useState<string | null>(null);

    const filteredAssetsRaw = useMemo(() => {
        const allSpotKeys = Array.from(
            new Set(effectiveAssetsList.flatMap((asset) => Object.keys(asset.breakdown || {}).filter(isSpotBreakdownKey)))
        );

        const selectedKeys = (!selectedAccount || selectedAccount === "All")
            ? allSpotKeys
            : (selectedAccountChainIds?.length
                ? selectedAccountChainIds
                : allSpotKeys.filter((k) => k === selectedAccount || k.startsWith(`${selectedAccount}::`)));

        if (!selectedKeys.length) return [];

        return effectiveAssetsList
            .map((asset) => {
                const breakdown = asset.breakdown || {};
                const balance = selectedKeys.reduce((sum, key) => sum + (breakdown[key] || 0), 0);
                if (balance <= 0) return null;
                return {
                    ...asset,
                    balance,
                    valueUsd: balance * (asset.price || 0),
                    allocations: 0,
                };
            })
            .filter(Boolean) as typeof assetsList;
    }, [effectiveAssetsList, selectedAccount, selectedAccountChainIds]);

    const displayAssets = useMemo(() => {
        const viewTotal = filteredAssetsRaw.reduce((sum, asset) => sum + asset.valueUsd, 0);
        return filteredAssetsRaw.map((asset) => ({
            ...asset,
            allocations: viewTotal > 0 ? (asset.valueUsd / viewTotal) * 100 : 0,
        }));
    }, [filteredAssetsRaw]);

    const stablecoinValue = useMemo(
        () => displayAssets
            .filter((asset) => STABLE_SYMBOLS.has(asset.symbol.toUpperCase()))
            .reduce((sum, asset) => sum + asset.valueUsd, 0),
        [displayAssets]
    );
    const stablecoinPct = useMemo(() => {
        const sum = displayAssets.reduce((acc, asset) => acc + asset.valueUsd, 0);
        return sum > 0 ? (stablecoinValue / sum) * 100 : 0;
    }, [displayAssets, stablecoinValue]);

    const { data: spotInsight, loading: spotInsightLoading } = useAIInsight(
        "spot_position_risk",
        {
            topHoldings: [...displayAssets]
                .sort((a, b) => (b.valueUsd || 0) - (a.valueUsd || 0))
                .slice(0, 8)
                .map((asset) => ({ symbol: asset.symbol, valueUsd: asset.valueUsd, allocation: asset.allocations })),
        },
        [displayAssets],
        displayAssets.length > 0
    );

    const effectiveTotalValue = useMemo(
        () => effectiveAssetsList.reduce((sum, asset) => sum + (asset.valueUsd || 0), 0),
        [effectiveAssetsList]
    );
    const reliability = useConnectorReliability({
        connections: enabledConnections,
        wsConnectionStatus,
        connectionErrors,
        loading,
        dataPoints: effectiveAssetsList.length + displayAssets.length,
        usingSnapshot,
    });

    if (loading && effectiveAssetsList.length === 0) return <Loading />;

    return (
        <SectionErrorBoundary sectionName="Spot">
            <PageWrapper>
                <div className="space-y-4">
                    <DataReliabilityBar
                        title="Spot Feeds"
                        summary={reliability}
                        onRetry={triggerConnectionsRefetch}
                    />
                    <div className="grid gap-3 md:grid-cols-4">
                        <StatCard
                            label="Spot Value"
                            value={`$${effectiveTotalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                            subValue={`${displayAssets.length} assets`}
                            icon={Wallet}
                            trend="up"
                        />
                        <StatCard
                            label="Stablecoin Buffer"
                            value={`${stablecoinPct.toFixed(1)}%`}
                            subValue={`$${stablecoinValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                            icon={PieChart}
                            trend={stablecoinPct > 20 ? "up" : "neutral"}
                        />
                        <StatCard
                            label="Tracked Holdings"
                            value={displayAssets.length.toString()}
                            subValue={selectedAccount && selectedAccount !== "All" ? "Filtered view" : "All accounts"}
                            icon={Activity}
                            trend="neutral"
                        />
                        <StatCard
                            label="Risk Focus"
                            value={stablecoinPct > 60 ? "Defensive" : stablecoinPct > 30 ? "Balanced" : "Offensive"}
                            subValue="Spot allocation mix"
                            icon={Target}
                            trend={stablecoinPct >= 30 ? "up" : "down"}
                        />
                    </div>

                    <AIPulseCard
                        title="Spot Risk Notes"
                        response={spotInsight}
                        loading={spotInsightLoading}
                        className="clone-wallet-card clone-noise"
                    />

                    <div className="grid gap-4 lg:grid-cols-12">
                        <div className="space-y-4 lg:col-span-9">
                            <AccountsOverview
                                assets={effectiveAssetsList}
                                connections={enabledConnections}
                                selectedAccount={selectedAccount || "All"}
                                onSelectAccount={(id, accountMeta) => {
                                    setSelectedAccount(id);
                                    setSelectedAccountChainIds(accountMeta?.chainIds);
                                }}
                                connectionErrors={connectionErrors ?? {}}
                                onRetryConnection={triggerConnectionsRefetch}
                            />

                            <SpotAssetCards
                                assets={displayAssets}
                                onSelectAsset={(symbol) => setAiAsset(symbol)}
                            />

                            <HoldingsTable assets={displayAssets} connections={enabledConnections} />
                        </div>

                        <div className="space-y-4 lg:col-span-3">
                            <GlobalAIFeed
                                compact
                                scope="spot"
                                socialSymbols={displayAssets.map((asset) => asset.symbol)}
                            />
                        </div>
                    </div>
                </div>

                <AssetAIInsight
                    symbol={aiAsset || ""}
                    isOpen={!!aiAsset}
                    onClose={() => setAiAsset(null)}
                />
            </PageWrapper>
        </SectionErrorBoundary>
    );
}
