"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { usePortfolio } from "@/contexts/PortfolioContext";
import { useRealtimeMarket } from "@/hooks/useRealtimeMarket";
import { useBinanceCommodities } from "@/hooks/useBinanceCommodities";
import { motion } from "framer-motion";
import { Position } from '@/lib/api/types';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { Activity, Layers, Radar } from "lucide-react";
import { cn } from "@/lib/utils";

// Core layout (eager)
import { PageWrapper } from "@/components/Layout/PageWrapper";
import { DashboardHeader } from "@/components/Dashboard/Overview/DashboardHeader";
import { MarketPulse } from "@/components/Dashboard/Overview/MarketPulse";
import { MovementAlertsWidget } from "@/components/Dashboard/MovementAlertsWidget";
import { AlertsFeedWidget } from "@/components/Dashboard/AlertsFeedWidget";
import { MarketsList } from "@/components/Wallet/MarketsList";
import { PortfolioAllocation } from "@/components/Dashboard/Overview/PortfolioAllocation";
import Loading from "@/app/loading";
import { SectionErrorBoundary } from "@/components/Dashboard/SectionErrorBoundary";
import { AIPulseCard } from "@/components/Dashboard/AIPulseCard";
import { useAIInsight } from "@/lib/ai-orchestrator/hooks";

// Heavy components: lazy for faster TTI and lower memory (60fps-friendly)
const OpenPositionsTable = dynamic(() => import("@/components/Dashboard/Overview/OpenPositionsTable").then((m) => ({ default: m.OpenPositionsTable })), { ssr: false, loading: () => <div className="h-48 animate-pulse rounded-xl bg-white/5" /> });
const OpenOrdersTable = dynamic(() => import("@/components/Dashboard/Overview/OpenOrdersTable").then((m) => ({ default: m.OpenOrdersTable })), { ssr: false, loading: () => <div className="h-32 animate-pulse rounded-xl bg-white/5" /> });
const GlobalAIFeed = dynamic(() => import("@/components/Dashboard/GlobalAIFeed").then((m) => ({ default: m.GlobalAIFeed })), { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-xl bg-white/5" /> });
const SpotHighlights = dynamic(() => import("@/components/Dashboard/SpotHighlights").then((m) => ({ default: m.SpotHighlights })), { ssr: false });
const FuturesHighlights = dynamic(() => import("@/components/Dashboard/Overview/FuturesHighlights").then((m) => ({ default: m.FuturesHighlights })), { ssr: false });
const HoldingsTable = dynamic(() => import("@/components/Dashboard/HoldingsTable"), { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-xl bg-white/5" /> });
const EconomicCalendar = dynamic(() => import("@/components/Dashboard/EconomicCalendar").then((m) => ({ default: m.EconomicCalendar })), { ssr: false });

const OVERVIEW_LAYOUT_KEY = "overview_panel_layout";
const DEFAULT_MAIN = 75;
const DEFAULT_SIDEBAR = 25;

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.04 } }
};
const item = {
  hidden: { opacity: 0, y: 12, filter: "blur(4px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.52, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }
  }
};

export default function DashboardPage() {
  const {
    assets,
    positions,
    spotOrders,
    totalValue,
    prices,
    connections,
    futuresMarketData,
    addManualTransaction
  } = usePortfolio();

  // Realtime market hook for BTC ticker and overall market pulse
  const { prices: marketPrices, stats } = useRealtimeMarket(["BTC"]);
  const { gold: goldTicker, silver: silverTicker } = useBinanceCommodities();

  const [activeTab, setActiveTab] = useState<'all' | 'spot' | 'futures'>('all');
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const [savedLayout, setSavedLayout] = useState<{ main: number; sidebar: number }>(() => {
    if (typeof window === "undefined") return { main: DEFAULT_MAIN, sidebar: DEFAULT_SIDEBAR };
    try {
      const raw = localStorage.getItem(OVERVIEW_LAYOUT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { main?: number; sidebar?: number };
        if (typeof parsed.main === "number" && typeof parsed.sidebar === "number" && parsed.main >= 20 && parsed.sidebar >= 15) {
          return { main: parsed.main, sidebar: parsed.sidebar };
        }
      }
    } catch {
      // ignore
    }
    return { main: DEFAULT_MAIN, sidebar: DEFAULT_SIDEBAR };
  });

  const handleOverviewLayoutChanged = useCallback((layout: { [id: string]: number }) => {
    const main = layout.main ?? DEFAULT_MAIN;
    const sidebar = layout.sidebar ?? DEFAULT_SIDEBAR;
    setSavedLayout({ main, sidebar });
    try {
      localStorage.setItem(OVERVIEW_LAYOUT_KEY, JSON.stringify({ main, sidebar }));
    } catch {
      // ignore
    }
  }, []);

  // Cast positions (null-safe: default to [])
  const typedPositions = useMemo(() => (positions ?? []) as Position[], [positions]);
  const orders = useMemo(() => spotOrders ?? [], [spotOrders]);

  // Totals Calculation
  const totalPnlUsd = useMemo(() => {
    return typedPositions.reduce((acc, pos) => acc + (pos.pnl || 0), 0);
  }, [typedPositions]);

  const totalPnlPercent = useMemo(() => {
    // Use positions' invested capital (margin = entryPrice * |size| / leverage) as denominator
    const totalInvested = typedPositions.reduce((sum, pos) =>
      sum + Math.abs(pos.entryPrice * pos.size) / (pos.leverage || 1), 0);
    return totalInvested > 0 ? (totalPnlUsd / totalInvested) * 100 : 0;
  }, [totalPnlUsd, typedPositions]);

  const overviewContext = useMemo(() => {
    const topHoldings = (assets || [])
      .slice()
      .sort((a, b) => (b.valueUsd || 0) - (a.valueUsd || 0))
      .slice(0, 5)
      .map((a) => ({ symbol: a.symbol, allocPct: a.allocations, valueUsd: a.valueUsd }));
    const topPnL = typedPositions
      .slice()
      .sort((a, b) => Math.abs(b.pnl || 0) - Math.abs(a.pnl || 0))
      .slice(0, 5)
      .map((p) => ({ symbol: p.symbol, pnl: p.pnl, leverage: p.leverage }));
    return {
      topHoldings,
      topPnL,
      totalValue,
      totalPnlUsd,
      totalPnlPercent,
      openOrders: orders.length,
    };
  }, [assets, typedPositions, totalValue, totalPnlUsd, totalPnlPercent, orders.length]);

  const { data: aiOverviewPulse, loading: aiOverviewLoading } = useAIInsight(
    "overview_pulse",
    overviewContext,
    [overviewContext],
    true,
    { stream: true }
  );

  // Derived Data based on Active Tab
  const filteredPositions = useMemo(() => {
    if (activeTab === 'spot') return [];
    return typedPositions;
  }, [typedPositions, activeTab]);

  const filteredOrders = useMemo(() => {
    if (activeTab === 'spot') return orders.filter((o: any) => !o.isPerp);
    if (activeTab === 'futures') return orders.filter((o: any) => o.isPerp);
    return orders;
  }, [orders, activeTab]);

  // Stats for Widgets
  const btcPrice = marketPrices['BTC'] || prices['BTC'] || 0;
  const btcChange = stats['BTC']?.change24h || 0;
  const orderCount = Array.isArray(orders) ? orders.length : 0;
  const positionCount = Array.isArray(filteredPositions) ? filteredPositions.length : 0;
  const assetsCount = Array.isArray(assets) ? assets.length : 0;

  if (!hasHydrated) {
    return (
      <PageWrapper className="min-h-screen flex flex-col bg-background">
        <div className="flex-1 flex items-center justify-center">
          <Loading />
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper className="relative h-screen max-h-screen flex flex-col bg-background overflow-hidden">
      <motion.div
        className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl"
        animate={{ x: [0, 34, 0], y: [0, -18, 0], opacity: [0.32, 0.58, 0.32] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute right-[-7rem] top-[-4rem] h-80 w-80 rounded-full bg-indigo-500/12 blur-3xl"
        animate={{ x: [0, -30, 0], y: [0, 20, 0], opacity: [0.25, 0.48, 0.25] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative z-10 flex flex-col h-screen min-h-0">
        {/* Sticky Header */}
        <DashboardHeader
          totalValue={totalValue}
          totalPnlUsd={totalPnlUsd}
          totalPnlPercent={totalPnlPercent}
          btcPrice={btcPrice}
          btcChange={btcChange}
          gold={goldTicker}
          silver={silverTicker}
        />

        <MarketPulse />

        {/* Main Content - Resizable panels (no overlap) */}
        <motion.main
          variants={container}
          initial="hidden"
          animate="show"
          className="flex-1 min-h-0 overflow-hidden flex flex-col gap-3 px-4 md:px-6 lg:px-8 pt-2 pb-3 max-w-none w-full"
        >
          <motion.div variants={item} className="rounded-2xl border border-white/10 bg-gradient-to-r from-zinc-950/75 via-zinc-900/70 to-zinc-950/75 p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/[0.03]">
                <Radar className="h-4 w-4 text-cyan-300" />
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Overview Mode</span>
              </div>

              <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/25 p-1">
                {(['all', 'spot', 'futures'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                      activeTab === tab
                        ? "bg-indigo-500/25 text-indigo-200 border border-indigo-400/30 shadow-[0_0_22px_rgba(99,102,241,0.28)]"
                        : "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06]"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.03]">
                  <Activity className="h-3 w-3 text-emerald-300" />
                  <span className="text-[10px] font-bold text-zinc-300">{positionCount} positions</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.03]">
                  <Layers className="h-3 w-3 text-amber-300" />
                  <span className="text-[10px] font-bold text-zinc-300">{orderCount} orders</span>
                </div>
                <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.03]">
                  <span className="text-[10px] font-bold text-zinc-300">{assetsCount} assets tracked</span>
                </div>
              </div>
            </div>
          </motion.div>

        <Group
          id="overview"
          orientation="horizontal"
          className="flex-1 min-h-0 w-full"
          defaultLayout={{ main: savedLayout.main, sidebar: savedLayout.sidebar }}
          onLayoutChanged={handleOverviewLayoutChanged}
        >
          <Panel id="main" defaultSize={DEFAULT_MAIN} minSize={30} maxSize={85} className="min-w-0">
            <div className="h-full overflow-y-auto overflow-x-hidden pr-1.5 space-y-3 pb-1">
              <motion.div variants={item}>
                {activeTab === 'futures' ? (
                  <FuturesHighlights positions={typedPositions} marketData={futuresMarketData ?? {}} />
                ) : (
                  <SpotHighlights assets={assets ?? []} orders={orders} />
                )}
              </motion.div>
              <motion.div variants={item}>
                <AIPulseCard
                  title="Overview Pulse"
                  response={aiOverviewPulse}
                  loading={aiOverviewLoading}
                />
              </motion.div>
              <motion.div variants={item} className="relative">
                <SectionErrorBoundary sectionName="AI Feed">
                  <GlobalAIFeed compact />
                </SectionErrorBoundary>
              </motion.div>
              {(activeTab === 'all' || activeTab === 'futures') && (
                <motion.div variants={item} className="space-y-4">
                  <SectionErrorBoundary sectionName="positions">
                    <OpenPositionsTable positions={filteredPositions} marketData={futuresMarketData ?? undefined} />
                  </SectionErrorBoundary>
                  <SectionErrorBoundary sectionName="orders">
                    <OpenOrdersTable orders={filteredOrders} prices={prices ?? {}} />
                  </SectionErrorBoundary>
                </motion.div>
              )}
              {activeTab === 'spot' && (
                <motion.div variants={item}>
                  <HoldingsTable assets={assets ?? []} connections={connections ?? []} onAddTransaction={addManualTransaction} />
                </motion.div>
              )}
            </div>
          </Panel>
          <Separator
            id="overview-sep"
            className="relative w-3 shrink-0 flex items-stretch group/sep bg-transparent transition-colors hover:bg-black/15 data-[resize-handle-active]:bg-indigo-500/20 clone-divider"
          >
            <div
              className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 rounded-full bg-border hover:bg-indigo-500/60 group-data-[resize-handle-active]/sep:bg-indigo-500 transition-colors pointer-events-none"
              aria-hidden
            />
          </Separator>
          <Panel id="sidebar" defaultSize={DEFAULT_SIDEBAR} minSize={15} maxSize={70} className="min-w-0">
            <div className="h-full overflow-y-auto overflow-x-hidden space-y-3 pl-2 pr-0.5 pb-1">
              <motion.div variants={item} className="w-full">
                <PortfolioAllocation assets={assets ?? []} compact />
              </motion.div>
              <motion.div variants={item} className="w-full">
                <MovementAlertsWidget compact />
              </motion.div>
              <motion.div variants={item} className="w-full">
                <AlertsFeedWidget compact />
              </motion.div>
              <motion.div variants={item} className="w-full">
                <EconomicCalendar compact maxEvents={4} />
              </motion.div>
              <motion.div variants={item}>
                <MarketsList compact />
              </motion.div>
            </div>
          </Panel>
        </Group>
        </motion.main>
      </div>
    </PageWrapper>
  );
}
