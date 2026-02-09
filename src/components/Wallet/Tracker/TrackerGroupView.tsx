"use client";

import { useState } from "react";
import { TrackedGroup, GroupData } from "@/hooks/useTrackedWallets";
import { PerformancePanel } from "@/components/Wallet/PerformancePanel";
import { TransactionHistoryPanel } from "@/components/Wallet/TransactionHistoryPanel";
import { WalletAssetsList } from "@/components/Wallet/WalletAssetsList";
import { RecentActivity } from "@/components/Wallet/RecentActivity";
import { TrendingUp, Globe, Loader2, AlertCircle } from "lucide-react";
import { Transaction, Transfer } from "@/lib/api/types";

interface TrackerGroupViewProps {
    group: TrackedGroup;
    data: GroupData;
}

export function TrackerGroupView({ group, data }: TrackerGroupViewProps) {
    const [selectedAssetSymbol, setSelectedAssetSymbol] = useState<string | null>(null);

    const handleAssetSelect = (symbol: string) => {
        setSelectedAssetSymbol(symbol);
    };

    // We need to construct 'connections' mock for WalletAssetsList compatibility
    // WalletAssetsList expects [id, connection] pairs.
    // We'll map group addresses to mock connections.
    const connectionsMock = group.addresses.map(addr => [
        addr.address,
        {
            id: addr.address,
            type: addr.type,
            chain: addr.chain,
            name: addr.name || `${addr.chain} Wallet`,
            walletAddress: addr.address,
            status: 'connected'
        }
    ] as [string, any]);

    if (data.loading && data.assets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[400px] text-zinc-500">
                <Loader2 className="h-8 w-8 animate-spin mb-2" />
                <p>Loading {group.name} data...</p>
            </div>
        );
    }

    const trackerTransactions = data.transactions as unknown as Transaction[]; // Casting for compatibility

    return (
        <div className="flex flex-col gap-6 w-full">
            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-[#141318] border border-white/5 rounded-xl p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs text-zinc-500 uppercase font-bold">Group Balance</p>
                        <p className="text-xl font-bold text-white font-mono mt-1">
                            ${data.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <TrendingUp className="h-5 w-5 text-emerald-500" />
                    </div>
                </div>

                <div className="bg-[#141318] border border-white/5 rounded-xl p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs text-zinc-500 uppercase font-bold">Assets</p>
                        <p className="text-xl font-bold text-white font-mono mt-1">{data.assets.length}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                        <Globe className="h-5 w-5 text-purple-500" />
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="md:col-span-2 max-h-[300px]">
                    <RecentActivity transactions={data.transactions} className="h-[140px] md:h-full" />
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto lg:h-[500px]">
                {/* Sidebar List */}
                <div className="lg:col-span-1 h-full">
                    <WalletAssetsList
                        assets={data.assets}
                        connections={connectionsMock}
                        selectedAssetSymbol={selectedAssetSymbol}
                        onAssetSelect={handleAssetSelect}
                        className="h-full"
                    />
                </div>

                {/* Chart */}
                <div className="lg:col-span-2 h-full">
                    <PerformancePanel
                        selectedAsset={selectedAssetSymbol}
                        transactions={trackerTransactions}
                    />
                </div>
            </div>

            {/* Full History */}
            <div className="w-full">
                <TransactionHistoryPanel
                    transactions={data.transactions}
                    className="h-[500px]"
                />
            </div>
        </div>
    );
}
