"use client";

import { useState, useEffect, useMemo } from "react";
import { useTrackedWallets } from "@/hooks/useTrackedWallets";
import { TrackerGroupManager } from "@/components/Wallet/Tracker/TrackerGroupManager";
import { TrackerGroupView } from "@/components/Wallet/Tracker/TrackerGroupView";
import { Button } from "@/components/ui/button";
import { QuickTrackerBar } from "@/components/Wallet/Tracker/QuickTrackerBar";
import { Plus, Wallet, ShieldCheck } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssetDetailModal } from "@/components/Wallet/AssetDetailModal"; // Keep if needed for asset details
import { PageWrapper } from "@/components/Layout/PageWrapper";
import { useAIInsight } from "@/lib/ai-orchestrator/hooks";
import { AIPulseCard } from "@/components/Dashboard/AIPulseCard";

export default function WalletTrackerPage() {
    const {
        groups,
        groupData,
        loading,
        addGroup,
        removeGroup,
        addAddressToGroup,
        removeAddressFromGroup
    } = useTrackedWallets();

    const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

    // Auto-select first group if none selected
    useEffect(() => {
        if (!activeGroupId && groups.length > 0) {
            setActiveGroupId(groups[0].id);
        } else if (activeGroupId && !groups.find(g => g.id === activeGroupId)) {
            // If active group deleted, select first available or null
            setActiveGroupId(groups.length > 0 ? groups[0].id : null);
        }
    }, [groups, activeGroupId]);

    const activeGroup = groups.find(g => g.id === activeGroupId);
    const activeData = activeGroupId ? groupData[activeGroupId] : null;

    const walletContext = useMemo(() => ({
        groupCount: groups.length,
        activeGroup: activeGroup?.name || null,
        addressCount: activeGroup?.addresses.length ?? 0,
        totalValue: activeData?.totalValue ?? 0,
        assetCount: activeData?.assets?.length ?? 0,
        txCount: activeData?.transactions?.length ?? 0,
    }), [groups.length, activeGroup?.name, activeGroup?.addresses.length, activeData?.totalValue, activeData?.assets?.length, activeData?.transactions?.length]);

    const { data: walletInsight, loading: walletInsightLoading } = useAIInsight(
        "wallet_health",
        walletContext,
        [activeGroupId, activeData?.assets?.length ?? 0, activeData?.transactions?.length ?? 0],
        true,
        { stream: true }
    );

    return (
        <PageWrapper className="flex flex-col gap-6 px-4 md:px-6 lg:px-8 pt-4 pb-12 max-w-none w-full">
        <div className="flex flex-col gap-6 pb-8 max-w-[1600px] mx-auto w-full min-h-[calc(100vh-120px)]">
            {/* Header */}
            <div className="tm-page-header clone-noise mb-2">
                <div className="tm-page-header-main">
                    <div className="tm-page-header-icon">
                        <ShieldCheck className="h-5 w-5 text-indigo-400" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <h1 className="tm-page-title">Wallet Tracker</h1>
                        <p className="tm-page-subtitle">
                            Track specific wallet addresses independently.
                        </p>
                    </div>
                </div>

                <TrackerGroupManager
                    groups={groups}
                    addGroup={addGroup}
                    removeGroup={removeGroup}
                    addAddressToGroup={addAddressToGroup}
                    removeAddressFromGroup={removeAddressFromGroup}
                />
            </div>

            <AIPulseCard
                title="Wallet Health"
                response={walletInsight}
                loading={walletInsightLoading}
            />

            <QuickTrackerBar
                groups={groups}
                activeGroupId={activeGroupId}
                onAddAddress={addAddressToGroup}
                onAddGroup={addGroup}
            />

            {/* Content Area */}
            {
                groups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 border border-dashed border-white/10 rounded-2xl bg-[#141318]/50">
                        <div className="h-16 w-16 rounded-full bg-indigo-500/10 flex items-center justify-center mb-4">
                            <Wallet className="h-8 w-8 text-indigo-500" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">No Wallet Groups Configured</h3>
                        <p className="text-zinc-500 text-center max-w-md mb-6">
                            Create a group (e.g., "Main Portfolio" or "Whale Watch") and add wallet addresses to start tracking their performance.
                        </p>
                        <TrackerGroupManager
                            groups={groups}
                            addGroup={addGroup}
                            removeGroup={removeGroup}
                            addAddressToGroup={addAddressToGroup}
                            removeAddressFromGroup={removeAddressFromGroup}
                        />
                    </div>
                ) : (
                    <>
                        {/* Group Tabs */}
                        <div className="w-full border-b border-white/5 pb-1">
                            <Tabs
                                value={activeGroupId || undefined}
                                onValueChange={setActiveGroupId}
                                className="w-full"
                            >
                                <TabsList className="bg-transparent h-auto p-0 gap-2 flex-wrap justify-start">
                                    {groups.map(group => (
                                        <TabsTrigger
                                            key={group.id}
                                            value={group.id}
                                            className="rounded-t-lg rounded-b-none px-6 py-3 data-[state=active]:bg-[#141318] data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 data-[state=active]:text-indigo-400 text-zinc-500 bg-transparent border-transparent transition-all"
                                        >
                                            {group.name}
                                        </TabsTrigger>
                                    ))}
                                </TabsList>
                            </Tabs>
                        </div>

                        {/* Group View */}
                        {activeGroup && activeData ? (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <TrackerGroupView
                                    group={activeGroup}
                                    data={activeData}
                                />
                            </div>
                        ) : (
                            <div className="p-12 text-center text-zinc-500">
                                Select a group to view details.
                            </div>
                        )}
                    </>
                )
            }


        </div>
        </PageWrapper>
    );
}
