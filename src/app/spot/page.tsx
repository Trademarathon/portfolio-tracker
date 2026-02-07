"use client";

import { useState, useMemo } from "react";
import { usePortfolioData } from "@/hooks/usePortfolioData";
import HoldingsTable from "@/components/Dashboard/HoldingsTable";
import { AdvancedAllocation } from "@/components/Dashboard/AdvancedAllocation";
import { SpotHighlights } from "@/components/Dashboard/SpotHighlights";
import { AccountsOverview } from "@/components/Dashboard/AccountsOverview";

export default function SpotPage() {
    const { assets, loading } = usePortfolioData();
    const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

    // Filter Assets based on Selected Account
    const filteredAssets = useMemo(() => {
        if (!selectedAccount || selectedAccount === 'All') return assets;

        return assets.filter(asset => {
            return asset.breakdown && asset.breakdown[selectedAccount] && asset.breakdown[selectedAccount] > 0;
        }).map(asset => ({
            ...asset,
            // Adjust balance/value to reflect only this account
            balance: asset.breakdown![selectedAccount],
            valueUsd: asset.breakdown![selectedAccount] * (asset.price || 0),
            allocations: 0 // Will re-calc below
        }));
    }, [assets, selectedAccount]);

    // Recalculate allocations for the filtered view
    const viewTotal = filteredAssets.reduce((sum, a) => sum + a.valueUsd, 0);
    const finalDisplayAssets = filteredAssets.map(a => ({
        ...a,
        allocations: viewTotal > 0 ? (a.valueUsd / viewTotal) * 100 : 0
    }));

    return (
        <div className="flex flex-col gap-6 pb-12">
            <h1 className="text-3xl font-bold tracking-tight text-white">Spot Holdings</h1>

            <AccountsOverview
                assets={assets}
                selectedAccount={selectedAccount || 'All'}
                onSelectAccount={setSelectedAccount}
            />

            {/* Only show Highlights on 'All' view for now, or adapted for account */}
            {(!selectedAccount || selectedAccount === 'All') && (
                <SpotHighlights assets={assets} />
            )}

            <div className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-2">
                    <HoldingsTable assets={finalDisplayAssets} />
                </div>
                <div>
                    <AdvancedAllocation assets={finalDisplayAssets} loading={loading} />
                </div>
            </div>
        </div>
    );
}
