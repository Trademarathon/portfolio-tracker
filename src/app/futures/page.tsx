"use client";

import { usePortfolioData } from "@/hooks/usePortfolioData";
import OpenPositionsTable from "@/components/Dashboard/OpenPositionsTable";

export default function FuturesPage() {
    const { positions, loading } = usePortfolioData();

    return (
        <div className="flex flex-col gap-6 pb-12">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-white">Futures & Margin</h1>
                <p className="text-muted-foreground">Active open interest, margin utilization, and PnL.</p>
            </div>

            {loading ? (
                <div className="text-muted-foreground">Loading positions...</div>
            ) : positions.length === 0 ? (
                <div className="p-8 border border-white/10 rounded-lg bg-zinc-900/50 text-center text-muted-foreground">
                    No open futures positions found on connected exchanges.
                </div>
            ) : (
                <OpenPositionsTable positions={positions} />
            )}

            {/* Future: Add Margin Summary Component Here */}
        </div>
    );
}
