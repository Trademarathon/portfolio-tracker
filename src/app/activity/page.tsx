"use client";

import { usePortfolio } from "@/contexts/PortfolioContext";
import FundingAnalysis from "@/components/Dashboard/FundingAnalysis";
import { SectionErrorBoundary } from "@/components/Dashboard/SectionErrorBoundary";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageWrapper } from "@/components/Layout/PageWrapper";
import Loading from "@/app/loading";
import { useMemo, useState, useEffect, useCallback, useDeferredValue } from "react";
import { useSearchParams } from "next/navigation";
import { UnifiedActivity } from "@/lib/api/transactions";
import {
  ArrowRightLeft,
  Filter,
  TrendingUp,
  History,
  Search,
  Download,
  Calendar,
  Layers,
  Sparkles,
  RefreshCw,
} from "lucide-react";
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
import { useActivityIntel } from "@/hooks/useActivityIntel";
import { ActivityKpiStrip } from "@/components/Activity/ActivityKpiStrip";
import { RouteMatrixCard } from "@/components/Activity/RouteMatrixCard";
import { MovementMemoryPanel } from "@/components/Activity/MovementMemoryPanel";
import { ActivityLedgerTable } from "@/components/Activity/ActivityLedgerTable";
import { ActivityEventDrawer } from "@/components/Activity/ActivityEventDrawer";
import { FeeDriftCard } from "@/components/Activity/FeeDriftCard";
import { RealtimeFlowMap } from "@/components/Activity/RealtimeFlowMap";
import type { ActivityEventEnriched, MovementRouteKey } from "@/lib/activity/types";
import { buildActivityAIContext, type ActivityAIContextMode } from "@/lib/activity/ai-context";
import { useUserHistory } from "@/hooks/useUserHistory";
import { processActivities } from "@/lib/api/transactions";
import type { PortfolioConnection } from "@/lib/api/types";
import { useConnectorReliability } from "@/hooks/useConnectorReliability";
import { DataReliabilityBar } from "@/components/ui/DataReliabilityBar";

type ActivityFilter = "all" | "trades" | "transfers";
type ActivityAiMode = "overview" | "route_health" | "fee_drift" | "memory_signal";

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
  const direct = (tx as any).exchange || "";
  if (direct) return direct;
  const byId = (tx as any).connectionId ? connectionMap[(tx as any).connectionId] : "";
  if (byId) return byId;
  if ((tx as any).from && (tx as any).to) return `${(tx as any).from} -> ${(tx as any).to}`;
  return "Wallet";
}

function exportActivityCsv(events: ActivityEventEnriched[]) {
  const headers = [
    "Time",
    "Source",
    "Type",
    "Asset",
    "Amount",
    "From",
    "To",
    "Route",
    "Fee Amount",
    "Fee Asset",
    "Fee USD",
    "Market Px @ Event",
    "Cost Basis @ Event",
    "Market Value",
    "Basis Value",
    "Confidence",
    "Last Similar (min)",
    "Tx Hash",
  ];

  const rows = events.map((event) =>
    [
      format(new Date(event.timestamp), "yyyy-MM-dd HH:mm:ss"),
      event.sourceLabel,
      event.rawType,
      event.asset,
      String(event.amount),
      event.fromLabel,
      event.toLabel,
      event.routeKey,
      event.feeAmount != null ? String(event.feeAmount) : "",
      event.feeAsset || "",
      event.feeUsd != null ? String(event.feeUsd) : "",
      event.marketPriceUsdAtEvent != null ? String(event.marketPriceUsdAtEvent) : "",
      event.costBasisUsdAtEvent != null ? String(event.costBasisUsdAtEvent) : "",
      event.marketValueUsdAtEvent != null ? String(event.marketValueUsdAtEvent) : "",
      event.basisValueUsdAtEvent != null ? String(event.basisValueUsdAtEvent) : "",
      event.valuationConfidence,
      event.lastSimilarDeltaMinutes != null ? String(event.lastSimilarDeltaMinutes) : "",
      event.txHash || "",
    ]
      .map((cell) => {
        const raw = String(cell ?? "");
        return raw.includes(",") || raw.includes('"') ? `"${raw.replace(/"/g, '""')}"` : raw;
      })
      .join(",")
  );

  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `activity-intel-${format(new Date(), "yyyy-MM-dd-HHmm")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function aiFeatureForMode(mode: ActivityAiMode): "activity_anomaly" | "activity_route_health" | "activity_fee_drift" | "activity_memory_signal" {
  if (mode === "route_health") return "activity_route_health";
  if (mode === "fee_drift") return "activity_fee_drift";
  if (mode === "memory_signal") return "activity_memory_signal";
  return "activity_anomaly";
}

function normalizeConnectionName(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function normalizeAlias(value: unknown): string {
  return normalizeConnectionName(value).replace(/[^a-z0-9]/g, "");
}

const GENERIC_CONNECTION_TYPES = new Set([
  "wallet",
  "evm",
  "solana",
  "aptos",
  "ton",
  "zerion",
  "manual",
]);

function filterConnectedActivities(
  list: UnifiedActivity[],
  connections: PortfolioConnection[]
): UnifiedActivity[] {
  if (!list.length) return [];
  const idSet = new Set<string>();
  const walletSet = new Set<string>();
  const nameSet = new Set<string>();
  const aliasSet = new Set<string>();
  connections.forEach((conn) => {
    if (conn.enabled === false) return;
    idSet.add(String(conn.id));
    if (conn.walletAddress) walletSet.add(String(conn.walletAddress).toLowerCase());
    const displayName = normalizeConnectionName(conn.displayName);
    const name = normalizeConnectionName(conn.name);
    const type = normalizeConnectionName(conn.type);
    if (displayName) {
      nameSet.add(displayName);
      aliasSet.add(normalizeAlias(displayName));
    }
    if (name) {
      nameSet.add(name);
      aliasSet.add(normalizeAlias(name));
    }
    if (type && !GENERIC_CONNECTION_TYPES.has(type)) {
      nameSet.add(type);
      aliasSet.add(normalizeAlias(type));
    }
  });

  return list.filter((tx) => {
    const connId = String((tx as any).connectionId || "");
    const fromConnId = String((tx as any).fromConnectionId || "");
    const toConnId = String((tx as any).toConnectionId || "");
    const address = String((tx as any).address || "").toLowerCase();
    const exchange = normalizeConnectionName((tx as any).exchange || "");
    const from = normalizeConnectionName((tx as any).from || "");
    const to = normalizeConnectionName((tx as any).to || "");
    const exchangeAlias = normalizeAlias((tx as any).exchange || "");
    const fromAlias = normalizeAlias((tx as any).from || "");
    const toAlias = normalizeAlias((tx as any).to || "");
    if (connId && idSet.has(connId)) return true;
    if (fromConnId && idSet.has(fromConnId)) return true;
    if (toConnId && idSet.has(toConnId)) return true;
    if (address && walletSet.has(address)) return true;
    if (exchange && nameSet.has(exchange)) return true;
    if (from && nameSet.has(from)) return true;
    if (to && nameSet.has(to)) return true;
    if (exchangeAlias && aliasSet.has(exchangeAlias)) return true;
    if (fromAlias && aliasSet.has(fromAlias)) return true;
    if (toAlias && aliasSet.has(toAlias)) return true;
    return false;
  });
}

export default function ActivityPage() {
  const searchParams = useSearchParams();
  const {
    activities,
    funding,
    loading,
    prices,
    connections,
    wsConnectionStatus,
    connectionErrors,
    triggerConnectionsRefetch,
  } = usePortfolio();
  const filterParam = searchParams.get("filter") as ActivityFilter | null;

  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [selectedRoute, setSelectedRoute] = useState<MovementRouteKey | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<ActivityEventEnriched | null>(null);
  const [aiMode, setAiMode] = useState<ActivityAiMode>("overview");
  const [aiRefreshTick, setAiRefreshTick] = useState(0);
  const [lastGood, setLastGood] = useState<{ activities: UnifiedActivity[]; funding: any[]; updatedAt: number }>({
    activities: [],
    funding: [],
    updatedAt: 0,
  });
  const deferredQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    if (filterParam === "trades" || filterParam === "transfers" || filterParam === "all") {
      setActivityFilter(filterParam);
    }
  }, [filterParam]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") setAiRefreshTick((prev) => prev + 1);
    }, 180_000);
    return () => clearInterval(timer);
  }, []);

  const connectedOnly = useMemo(
    () => (connections || []).filter((connection) => connection.enabled !== false),
    [connections]
  );
  const connectedScopeKey = useMemo(
    () => connectedOnly.map((connection) => String(connection.id)).sort().join(","),
    [connectedOnly]
  );

  const historyFallback = useUserHistory(connectedOnly);

  const connectionMap = useMemo(() => {
    const map: Record<string, string> = {};
    (connections || []).forEach((c) => {
      if (c?.id) map[c.id] = c.displayName || c.name || c.id;
    });
    return map;
  }, [connections]);

  const liveActivitiesFallback = useMemo(() => {
    const trades = (historyFallback.data?.trades || []) as any[];
    const transfers = (historyFallback.data?.transfers || []) as any[];
    if (!trades.length && !transfers.length) return [] as UnifiedActivity[];
    const walletMap: Record<string, string> = {};
    const localConnectionMap: Record<string, string> = {};
    connectedOnly.forEach((connection) => {
      if (connection.walletAddress) walletMap[String(connection.walletAddress)] = connection.displayName || connection.name;
      localConnectionMap[connection.id] = connection.displayName || connection.name;
    });
    return processActivities(trades, transfers, walletMap, localConnectionMap);
  }, [historyFallback.data?.trades, historyFallback.data?.transfers, connectedOnly]);

  const sourceActivities = useMemo(() => {
    if (connectedOnly.length === 0) return [];
    const base = (activities?.length ?? 0) > 0 ? activities : liveActivitiesFallback;
    if (!base?.length) return [];
    return filterConnectedActivities(base, connectedOnly);
  }, [activities, liveActivitiesFallback, connectedOnly]);

  const sourceFunding = useMemo(() => {
    if (connectedOnly.length === 0) return [];
    const base = (funding?.length ?? 0) > 0 ? funding : historyFallback.data?.funding || [];
    const idSet = new Set(connectedOnly.map((connection) => String(connection.id)));
    const nameSet = new Set<string>();
    const aliasSet = new Set<string>();
    connectedOnly.forEach((connection) => {
      const displayName = normalizeConnectionName(connection.displayName);
      const name = normalizeConnectionName(connection.name);
      const type = normalizeConnectionName(connection.type);
      if (displayName) {
        nameSet.add(displayName);
        aliasSet.add(normalizeAlias(displayName));
      }
      if (name) {
        nameSet.add(name);
        aliasSet.add(normalizeAlias(name));
      }
      if (type && !GENERIC_CONNECTION_TYPES.has(type)) {
        nameSet.add(type);
        aliasSet.add(normalizeAlias(type));
      }
    });

    return (base || []).filter((entry: any) => {
      const connectionId = String(entry?.connectionId || "");
      if (connectionId && idSet.has(connectionId)) return true;
      const exchange = normalizeConnectionName(entry?.exchange || "");
      const exchangeAlias = normalizeAlias(entry?.exchange || "");
      if (exchange && nameSet.has(exchange)) return true;
      if (exchangeAlias && aliasSet.has(exchangeAlias)) return true;
      return false;
    });
  }, [funding, historyFallback.data?.funding, connectedOnly]);

  useEffect(() => {
    setLastGood({
      activities: [],
      funding: [],
      updatedAt: 0,
    });
    setSelectedRoute(null);
    setSelectedEvent(null);
  }, [connectedScopeKey]);

  useEffect(() => {
    if (sourceActivities.length > 0 || sourceFunding.length > 0) {
      setLastGood({
        activities: sourceActivities,
        funding: sourceFunding,
        updatedAt: Date.now(),
      });
    }
  }, [sourceActivities, sourceFunding]);

  const usingSnapshot = sourceActivities.length === 0 && sourceFunding.length === 0 && (lastGood.activities.length > 0 || lastGood.funding.length > 0);
  const effectiveActivities = sourceActivities.length > 0 ? sourceActivities : lastGood.activities;
  const effectiveFunding = sourceFunding.length > 0 ? sourceFunding : lastGood.funding;

  const reliability = useConnectorReliability({
    connections: connectedOnly,
    wsConnectionStatus,
    connectionErrors,
    loading: loading || historyFallback.isFetching,
    dataPoints: effectiveActivities.length + effectiveFunding.length,
    usingSnapshot,
  });

  const rawTypeFiltered = useMemo(
    () => filterActivities(effectiveActivities, activityFilter),
    [effectiveActivities, activityFilter]
  );

  const uniqueSources = useMemo(() => {
    if (!rawTypeFiltered.length) return [];
    const set = new Set<string>();
    rawTypeFiltered.forEach((tx) => set.add(getSourceLabel(tx, connectionMap)));
    return Array.from(set).sort();
  }, [rawTypeFiltered, connectionMap]);

  const fromMs = useMemo(() => (dateFrom ? new Date(dateFrom).getTime() : undefined), [dateFrom]);
  const toMs = useMemo(
    () => (dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : undefined),
    [dateTo]
  );

  const intel = useActivityIntel({
    activities: rawTypeFiltered,
    prices: prices || {},
    connections: connectedOnly || [],
    loading: loading || historyFallback.isFetching,
    filters: {
      activityType: activityFilter,
      source: sourceFilter,
      query: deferredQuery,
      fromMs,
      toMs,
    },
  });

  const displayedEvents = useMemo(
    () => (selectedRoute ? intel.events.filter((event) => event.routeKey === selectedRoute) : intel.events),
    [intel.events, selectedRoute]
  );

  const routeAsset = useMemo(() => {
    if (!selectedRoute) return null;
    const split = selectedRoute.split(":");
    return split.length > 1 ? split[split.length - 1] : null;
  }, [selectedRoute]);

  const fundingFiltered = useMemo(() => {
    if (!routeAsset) return effectiveFunding ?? [];
    const target = routeAsset.toUpperCase();
    return (effectiveFunding ?? []).filter((item: any) => String(item.symbol || "").toUpperCase() === target);
  }, [effectiveFunding, routeAsset]);

  const counts = useMemo(() => {
    if (!effectiveActivities?.length) return { trades: 0, transfers: 0 };
    let trades = 0;
    let transfers = 0;
    effectiveActivities.forEach((tx) => {
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
  }, [effectiveActivities]);

  const aiFeature = aiFeatureForMode(aiMode);
  const aiContextMode = aiMode as ActivityAIContextMode;
  const aiContext = useMemo(
    () =>
      buildActivityAIContext({
        mode: aiContextMode,
        events: displayedEvents,
        matrix: intel.matrix,
        feeDrift: intel.feeDrift,
        memory: intel.memory,
        range: { fromMs, toMs },
        filters: { source: sourceFilter, activityType: activityFilter, query: deferredQuery },
      }),
    [aiContextMode, displayedEvents, intel.matrix, intel.feeDrift, intel.memory, fromMs, toMs, sourceFilter, activityFilter, deferredQuery]
  );

  const { data: activityInsight, loading: activityLoading, error: activityError } = useAIInsight(
    aiFeature,
    aiContext,
    [aiFeature, aiRefreshTick, displayedEvents.length, selectedRoute || "all"],
    true,
    { stream: false }
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!activityInsight) return;
    localStorage.setItem(
      "activity_ai_telemetry_v1",
      JSON.stringify({
        at: Date.now(),
        mode: aiMode,
        feature: aiFeature,
        provider: activityInsight.provider,
        model: activityInsight.model,
        cached: activityInsight.cached,
      })
    );
  }, [activityInsight, aiMode, aiFeature]);

  const handleExport = useCallback(() => {
    exportActivityCsv(displayedEvents);
  }, [displayedEvents]);

  if ((loading || historyFallback.isLoading) && (effectiveActivities?.length ?? 0) === 0) {
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
              Movement intelligence across wallets and exchanges: route, fee, value, recurrence.
            </p>
          </div>
        </div>
      </div>

      <DataReliabilityBar
        title="Activity Feeds"
        summary={reliability}
        onRetry={() => {
          historyFallback.refetch();
          triggerConnectionsRefetch();
        }}
      />

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-300" />
            <span className="text-sm font-semibold text-zinc-200">AI Insight</span>
          </div>
          <div className="flex items-center gap-2">
            <Select value={aiMode} onValueChange={(value) => setAiMode(value as ActivityAiMode)}>
              <SelectTrigger className="h-8 w-[180px] border-white/10 bg-white/5 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overview">Overview</SelectItem>
                <SelectItem value="route_health">Route Health</SelectItem>
                <SelectItem value="fee_drift">Fee Drift</SelectItem>
                <SelectItem value="memory_signal">Memory Signal</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-8 border-white/10 bg-white/5 text-xs"
              onClick={() => setAiRefreshTick((prev) => prev + 1)}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Refresh insight
            </Button>
          </div>
        </div>
        <AIPulseCard title="Activity Intelligence" response={activityInsight} loading={activityLoading} error={activityError} />
      </div>

      <Tabs defaultValue="history" className="w-full">
        <TabsList className="bg-white/5 border border-white/10 p-1 mb-6 gap-1">
          <TabsTrigger value="history" className="px-6 flex items-center gap-2">
            <History className="h-4 w-4" />
            Transaction History
            <span className="ml-1 text-xs opacity-70">({effectiveActivities?.length ?? 0})</span>
          </TabsTrigger>
          <TabsTrigger value="funding" className="px-6 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Funding Analysis
            <span className="ml-1 text-xs opacity-70">({effectiveFunding?.length ?? 0})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-4">
          <SectionErrorBoundary sectionName="Transaction History">
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
                    {f === "all" && `All (${effectiveActivities?.length ?? 0})`}
                    {f === "trades" && `Trades (${counts.trades})`}
                    {f === "transfers" && `Transfers (${counts.transfers})`}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    placeholder="Search asset, route, tx hash…"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="pl-9 bg-white/5 border-white/10"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-zinc-500 shrink-0" />
                  <Input
                    type="date"
                    placeholder="From"
                    value={dateFrom}
                    onChange={(event) => setDateFrom(event.target.value)}
                    className="bg-white/5 border-white/10"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-zinc-500 shrink-0" />
                  <Input
                    type="date"
                    placeholder="To"
                    value={dateTo}
                    onChange={(event) => setDateTo(event.target.value)}
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
                      {uniqueSources.map((source) => (
                        <SelectItem key={source} value={source}>
                          {source}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs text-zinc-500">
                  Showing {displayedEvents.length} movement rows
                  {selectedRoute ? ` · focused route: ${selectedRoute}` : ""}
                </span>
                <div className="flex items-center gap-2">
                  {selectedRoute && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 border-white/10 bg-white/5 hover:bg-white/10"
                      onClick={() => setSelectedRoute(null)}
                    >
                      Clear route focus
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    disabled={!displayedEvents.length}
                    className="gap-2 border-white/10 bg-white/5 hover:bg-white/10"
                  >
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </div>

            <ActivityKpiStrip kpis={intel.kpis} />

            <RealtimeFlowMap matrix={intel.matrix} events={displayedEvents} />

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2">
                <RouteMatrixCard rows={intel.matrix} selectedRoute={selectedRoute} onSelectRoute={setSelectedRoute} />
              </div>
              <MovementMemoryPanel rows={intel.memory} onFocusRoute={setSelectedRoute} />
            </div>

            <FeeDriftCard rows={intel.feeDrift} />

            <ActivityLedgerTable events={displayedEvents} onOpenEvent={setSelectedEvent} />

            <ActivityEventDrawer
              event={selectedEvent}
              open={Boolean(selectedEvent)}
              onOpenChange={(open) => {
                if (!open) setSelectedEvent(null);
              }}
              aiNote={activityInsight?.content}
            />
          </SectionErrorBoundary>
        </TabsContent>

        <TabsContent value="funding" className="space-y-4">
          <SectionErrorBoundary sectionName="Funding Analysis">
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs">
              <div className="text-zinc-400">
                  {routeAsset ? (
                  <>
                    Funding filtered by route asset <span className="text-zinc-200 font-semibold">{routeAsset}</span>
                  </>
                  ) : (
                    "Funding currently shows all assets."
                  )}
                </div>
              {routeAsset ? (
                <Button variant="outline" size="sm" className="h-7 border-white/10" onClick={() => setSelectedRoute(null)}>
                  Clear route-linked filter
                </Button>
              ) : null}
            </div>
            <FundingAnalysis fundingData={fundingFiltered ?? []} />
          </SectionErrorBoundary>
        </TabsContent>
      </Tabs>
    </PageWrapper>
  );
}
