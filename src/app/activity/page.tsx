"use client";

import { usePortfolio } from "@/contexts/PortfolioContext";
import TransactionHistory from "@/components/Dashboard/TransactionHistory";
import FundingAnalysis from "@/components/Dashboard/FundingAnalysis";
import { SectionErrorBoundary } from "@/components/Dashboard/SectionErrorBoundary";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageWrapper } from "@/components/Layout/PageWrapper";
import Loading from "@/app/loading";
import { useMemo, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { UnifiedActivity } from "@/lib/api/transactions";
import { ArrowRightLeft, Filter, TrendingUp, History, Search, Download, Calendar, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAIInsight } from "@/lib/ai-orchestrator/hooks";
import { AIPulseCard } from "@/components/Dashboard/AIPulseCard";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";

type ActivityFilter = "all" | "trades" | "transfers";

function filterActivities(activities: UnifiedActivity[] | undefined, filter: ActivityFilter): UnifiedActivity[] {
    if (!activities?.length) return [];
    if (filter === "all") return activities;
    return activities.filter((tx) => {
        const isTrade = tx.activityType === "trade" || (tx as any).type === "Buy" || (tx as any).type === "Sell";
        const isTransfer =
            tx.activityType === "transfer" ||
            tx.activityType === "internal" ||
            (tx as any).type === "Deposit" ||
            (tx as any).type === "Withdraw";
        if (filter === "trades") return isTrade;
        if (filter === "transfers") return isTransfer;
        return true;
    });
}

function getSourceLabel(tx: UnifiedActivity, connectionMap: Record<string, string>): string {
    const direct = (tx as any).exchange || '';
    if (direct) return direct;
    const byId = (tx as any).connectionId ? connectionMap[(tx as any).connectionId] : '';
    if (byId) return byId;
    if ((tx as any).from && (tx as any).to) return `${(tx as any).from} → ${(tx as any).to}`;
    return "Wallet";
}

function exportToCsv(transactions: UnifiedActivity[]) {
    const headers = ["Time", "Source", "Type", "Asset", "Amount", "Price", "Fee", "Fee Currency", "Details"];
    const rows = transactions.map((tx) => {
        const isTrade = tx.activityType === "trade" || (tx as any).type === "Buy" || (tx as any).type === "Sell";
        const isTransfer = tx.activityType === "transfer" || (tx as any).type === "Deposit" || (tx as any).type === "Withdraw";
        const isInternal = tx.activityType === "internal";
        const side = (tx as any).side || (tx as any).type || "UNKNOWN";
        const typeLabel = isTrade ? String(side).toUpperCase() : isTransfer ? String((tx as any).type || "TRANSFER").toUpperCase() : "INTERNAL";
        const asset = isTrade ? ((tx as any).symbol || (tx as any).asset) : (tx as any).asset;
        const price = isTrade ? ((tx as any).price || 0) : "";
        const fee = (tx as any).fee !== undefined ? (tx as any).fee : "";
        const feeCur = (tx as any).feeCurrency || "";
        const details = isInternal
            ? `${(tx as any).from} → ${(tx as any).to}`
            : (tx as any).address ? `${(tx as any).address}` : (tx as any).status || "Completed";
        return [
            format(new Date(tx.timestamp), "yyyy-MM-dd HH:mm:ss"),
            (tx as any).exchange || (tx as any).connectionId || "Wallet",
            typeLabel,
            asset,
            String(tx.amount),
            String(price),
            String(fee),
            feeCur,
            details,
        ].map((c) => (c.includes(",") || c.includes('"') ? `"${String(c).replace(/"/g, '""')}"` : c)).join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-export-${format(new Date(), "yyyy-MM-dd-HHmm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

export default function ActivityPage() {
    const searchParams = useSearchParams();
    const { activities, funding, loading, prices, connections } = usePortfolio();
    const filterParam = searchParams.get("filter") as ActivityFilter | null;

    const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [sourceFilter, setSourceFilter] = useState<string>("all");

    useEffect(() => {
        if (filterParam === "trades" || filterParam === "transfers" || filterParam === "all") {
            setActivityFilter(filterParam);
        }
    }, [filterParam]);

    const connectionMap = useMemo(() => {
        const map: Record<string, string> = {};
        (connections || []).forEach((c) => {
            if (c?.id) map[c.id] = c.displayName || c.name || c.id;
        });
        return map;
    }, [connections]);

    const uniqueSources = useMemo(() => {
        if (!activities?.length) return [];
        const set = new Set<string>();
        activities.forEach((tx) => {
            const src = getSourceLabel(tx, connectionMap);
            set.add(src);
        });
        return Array.from(set).sort();
    }, [activities, connectionMap]);

    const typeFiltered = useMemo(
        () => filterActivities(activities, activityFilter),
        [activities, activityFilter]
    );

    const filteredActivities = useMemo(() => {
        let out = typeFiltered;

        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            out = out.filter((tx) => {
                const asset = String((tx as any).symbol || (tx as any).asset || "").toLowerCase();
                const addr = String((tx as any).address || "").toLowerCase();
                const id = String(tx.id || "").toLowerCase();
                return asset.includes(q) || addr.includes(q) || id.includes(q);
            });
        }

        if (sourceFilter && sourceFilter !== "all") {
            out = out.filter((tx) => {
                const src = getSourceLabel(tx, connectionMap);
                return src === sourceFilter;
            });
        }

        if (dateFrom) {
            const fromTs = new Date(dateFrom).getTime();
            out = out.filter((tx) => tx.timestamp >= fromTs);
        }
        if (dateTo) {
            const toTs = new Date(dateTo + "T23:59:59").getTime();
            out = out.filter((tx) => tx.timestamp <= toTs);
        }

        return out;
    }, [typeFiltered, searchQuery, sourceFilter, dateFrom, dateTo, connectionMap]);

    const counts = useMemo(() => {
        if (!activities?.length) return { trades: 0, transfers: 0 };
        let trades = 0;
        let transfers = 0;
        activities.forEach((tx) => {
            const isTrade = tx.activityType === "trade" || (tx as any).type === "Buy" || (tx as any).type === "Sell";
            const isTransfer =
                tx.activityType === "transfer" ||
                tx.activityType === "internal" ||
                (tx as any).type === "Deposit" ||
                (tx as any).type === "Withdraw";
            if (isTrade) trades++;
            if (isTransfer) transfers++;
        });
        return { trades, transfers };
    }, [activities]);

    const activityFeature = activityFilter === "transfers" ? "transfers_risk" : "activity_anomaly";

    const activityContext = useMemo(() => {
        const largest = filteredActivities.reduce((max, tx) => {
            const amount = Number((tx as any).amount || 0);
            return amount > max ? amount : max;
        }, 0);
        return {
            total: filteredActivities.length,
            trades: counts.trades,
            transfers: counts.transfers,
            largestAmount: largest,
            sources: uniqueSources.slice(0, 6),
        };
    }, [filteredActivities, counts, uniqueSources]);

    const { data: activityInsight, loading: activityLoading } = useAIInsight(
        activityFeature,
        activityContext,
        [activityFeature, filteredActivities.length, counts.trades, counts.transfers],
        true,
        { stream: true }
    );

    const handleExport = useCallback(() => {
        exportToCsv(filteredActivities);
    }, [filteredActivities]);

    if (loading && (activities?.length ?? 0) === 0) {
        return (
            <PageWrapper className="flex flex-col bg-background">
                <div className="flex-1 flex items-center justify-center min-h-[50vh]">
                    <Loading />
                </div>
            </PageWrapper>
        );
    }

    return (
        <PageWrapper className="flex flex-col gap-6 px-4 md:px-6 lg:px-8 pt-4 pb-24 max-w-none">
            <div className="tm-page-header clone-noise">
                <div className="tm-page-header-main">
                    <div className="tm-page-header-icon">
                        <ArrowRightLeft className="h-5 w-5 text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="tm-page-title">Activity</h1>
                        <p className="tm-page-subtitle">
                            Transactions, transfers, and funding — unified view from all connected accounts.
                        </p>
                    </div>
                </div>
            </div>

            <AIPulseCard
                title={activityFeature === "transfers_risk" ? "Transfers Risk" : "Activity Anomaly"}
                response={activityInsight}
                loading={activityLoading}
            />

            <Tabs defaultValue="history" className="w-full">
                <TabsList className="bg-white/5 border border-white/10 p-1 mb-6 gap-1">
                    <TabsTrigger value="history" className="px-6 flex items-center gap-2">
                        <History className="h-4 w-4" />
                        Transaction History
                        <span className="ml-1 text-xs opacity-70">({activities?.length ?? 0})</span>
                    </TabsTrigger>
                    <TabsTrigger value="funding" className="px-6 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Funding Analysis
                        <span className="ml-1 text-xs opacity-70">({funding?.length ?? 0})</span>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="history" className="space-y-4">
                    <SectionErrorBoundary sectionName="Transaction History">
                    {/* Advanced filters */}
                    <div className="flex flex-col gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                        <div className="flex items-center gap-2 flex-wrap">
                            <Filter className="h-4 w-4 text-zinc-500 shrink-0" />
                            <span className="text-sm text-zinc-500 shrink-0">Filter:</span>
                            {(["all", "trades", "transfers"] as const).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setActivityFilter(f)}
                                    className={cn(
                                        "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                                        activityFilter === f
                                            ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                                            : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-300 border border-transparent"
                                    )}
                                >
                                    {f === "all" && `All (${activities?.length ?? 0})`}
                                    {f === "trades" && `Trades (${counts.trades})`}
                                    {f === "transfers" && `Transfers (${counts.transfers})`}
                                </button>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                                <Input
                                    placeholder="Search asset, symbol, address…"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 bg-white/5 border-white/10"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-zinc-500 shrink-0" />
                                <Input
                                    type="date"
                                    placeholder="From"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="bg-white/5 border-white/10"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-zinc-500 shrink-0" />
                                <Input
                                    type="date"
                                    placeholder="To"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    className="bg-white/5 border-white/10"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Layers className="h-4 w-4 text-zinc-500 shrink-0" />
                                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                                    <SelectTrigger className="bg-white/5 border-white/10">
                                        <SelectValue placeholder="Source" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All sources</SelectItem>
                                        {uniqueSources.map((s) => (
                                            <SelectItem key={s} value={s}>
                                                {s}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="text-xs text-zinc-500">
                                Showing {filteredActivities.length} of {typeFiltered.length} (filtered)
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleExport}
                                disabled={!filteredActivities.length}
                                className="gap-2 border-white/10 bg-white/5 hover:bg-white/10"
                            >
                                <Download className="h-4 w-4" />
                                Export CSV
                            </Button>
                        </div>
                    </div>

                    <TransactionHistory transactions={filteredActivities} prices={prices || {}} connectionMap={connectionMap} />
                    </SectionErrorBoundary>
                </TabsContent>

                <TabsContent value="funding">
                    <SectionErrorBoundary sectionName="Funding Analysis">
                        <FundingAnalysis fundingData={funding ?? []} />
                    </SectionErrorBoundary>
                </TabsContent>
            </Tabs>
        </PageWrapper>
    );
}
