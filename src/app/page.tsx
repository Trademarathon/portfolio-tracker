"use client";

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { usePortfolioData } from "@/hooks/usePortfolioData";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useRealtimeMarket } from "@/hooks/useRealtimeMarket";
import { formatCurrency, cn } from "@/lib/utils";

import { ConnectionStatus } from "@/components/Dashboard/ConnectionStatus";

// Lazy load heavy components
const OverviewCard = dynamic(() => import("@/components/Dashboard/OverviewCard"), {
  ssr: false,
  loading: () => <div className="animate-pulse h-[200px] bg-zinc-900 rounded-xl border border-white/5" />
});
const HoldingsTable = dynamic(() => import("@/components/Dashboard/HoldingsTable"), {
  ssr: false,
  loading: () => <div className="animate-pulse h-[300px] bg-zinc-900 rounded-xl border border-white/5" />
});
const AdvancedAllocation = dynamic(() => import("@/components/Dashboard/AdvancedAllocation").then(mod => mod.AdvancedAllocation), {
  ssr: false,
  loading: () => <div className="animate-pulse h-[400px] bg-zinc-900 rounded-xl border border-white/5" />
});
const RecentActivity = dynamic(() => import("@/components/Dashboard/RecentActivity").then(mod => mod.RecentActivity), {
  ssr: false,
  loading: () => <div className="animate-pulse h-[500px] bg-zinc-900 rounded-xl border border-white/5" />
});
const MarketTable = dynamic(() => import("@/components/Screener/MarketTable").then(mod => mod.MarketTable), {
  ssr: false,
  loading: () => <div className="animate-pulse h-[300px] bg-zinc-900 rounded-xl border border-white/5" />
});
const StablecoinWidget = dynamic(() => import("@/components/Dashboard/StablecoinWidget").then(mod => mod.StablecoinWidget), {
  ssr: false,
  loading: () => <div className="animate-pulse h-[150px] bg-zinc-900 rounded-xl border border-white/5" />
});
const DrawdownMeter = dynamic(() => import("@/components/Dashboard/DrawdownMeter").then(mod => mod.DrawdownMeter), {
  ssr: false,
  loading: () => <div className="animate-pulse h-[100px] bg-zinc-900 rounded-xl border border-white/5" />
});
const FundingRateWidget = dynamic(() => import("@/components/Dashboard/FundingRateWidget").then(mod => mod.FundingRateWidget), {
  ssr: false,
  loading: () => <div className="animate-pulse h-[120px] bg-zinc-900 rounded-xl border border-white/5" />
});
const FeeRatioWidget = dynamic(() => import("@/components/Dashboard/FeeRatioWidget"), {
  ssr: false,
  loading: () => <div className="animate-pulse h-[120px] bg-zinc-900 rounded-xl border border-white/5" />
});

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

import { LayoutGrid, Zap } from "lucide-react";
import { NeoGlassCard } from "@/components/ui/NeoGlassCard";
import { ROIWaveChart } from "@/components/Dashboard/ROIWaveChart";
import { PortfolioRadar } from "@/components/Dashboard/PortfolioRadar";

export default function Home() {
  const router = useRouter();
  const { assets, activities, positions, loading, totalValue, totalPnlUsd, totalPnlPercent, drawdowns, wsConnectionStatus, feeStats, isDemo } = usePortfolioData();
  const [hasHydrated, setHasHydrated] = useState(false);

  // Real-time Market Data for Dashboard Stats
  // We fetch a broad set of symbols to populate the dashboard stats even if not holding them
  const defaultTrackedSymbols = useMemo(() => ['BTC', 'ETH', 'SOL', 'AVAX', 'ARB', 'TIA', 'HYPE', 'JUP', 'WIF', 'PEPE', 'SUI', 'APT', 'DOGE', 'NEAR'], []);
  const allTrackedSymbols = useMemo(() => {
    const assetSymbols = assets.map(a => a.symbol);
    return Array.from(new Set([...assetSymbols, ...defaultTrackedSymbols]));
  }, [assets, defaultTrackedSymbols]);

  const { stats: marketStats } = useRealtimeMarket(allTrackedSymbols);

  // Aggregate Dashboard Metrics
  const dashboardMetrics = useMemo(() => {
    let totalVol = 0;
    let totalOi = 0;
    const items = Object.values(marketStats);

    items.forEach(stat => {
      totalVol += stat.volume24h || 0;
      totalOi += stat.openInterest || 0;
    });

    // Sort for top performers
    const sorted = [...items].sort((a, b) => (b.change24h || 0) - (a.change24h || 0));
    const topPerformers = sorted.slice(0, 3);

    return {
      totalVol,
      totalOi,
      topPerformers
    };
  }, [marketStats]);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  if (!hasHydrated) {
    return (
      <div className="flex flex-col gap-4 animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
          <div className="h-10 w-48 bg-zinc-900 rounded-xl animate-pulse" />
          <div className="h-10 w-32 bg-zinc-900 rounded-xl animate-pulse" />
        </div>
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-8 h-[200px] bg-zinc-900 rounded-xl animate-pulse" />
          <div className="lg:col-span-4 h-[200px] bg-zinc-900 rounded-xl animate-pulse" />
        </div>
        <div className="h-[400px] bg-zinc-900 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <motion.main
      className="flex flex-col gap-4 pb-8"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div variants={item} className="flex flex-row items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-serif font-bold tracking-tight text-white mb-1">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Real-time <span className="italic font-serif text-zinc-400">overview</span> of your crypto portfolio.</p>
        </div>
        <ConnectionStatus status={wsConnectionStatus || new Map()} />
      </motion.div>

      {/* Bento Grid Layout */}
      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full">

        {/* Main Chart Section (ROI Wave) */}
        <div className="col-span-1 md:col-span-8 flex flex-col gap-6">
          <NeoGlassCard className="p-6 h-[400px] flex flex-col relative group">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest font-serif">Portfolio ROI</h2>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-4xl font-black text-white tracking-tight">
                    {totalPnlPercent >= 0 ? '+' : ''}{totalPnlPercent.toFixed(2)}%
                  </span>
                  <span className={cn(
                    "text-xs font-bold px-2 py-1 rounded-full",
                    totalPnlUsd >= 0 ? "text-emerald-400 bg-emerald-500/10" : "text-rose-400 bg-rose-500/10"
                  )}>
                    {totalPnlUsd >= 0 ? '+' : ''}{formatCurrency(totalPnlUsd)} today
                  </span>
                </div>
              </div>
            </div>
            <div className="flex-1 w-full">
              <ROIWaveChart />
            </div>
          </NeoGlassCard>

          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 gap-6">
            <NeoGlassCard className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-2 w-2 rounded-full bg-neon-cyan neon-glow-cyan" />
                <span className="text-xs font-bold text-zinc-500 uppercase">Tracked Volume (24h)</span>
              </div>
              <span className="text-2xl font-bold text-white">
                {formatCurrency(dashboardMetrics.totalVol)}
              </span>
            </NeoGlassCard>
            <NeoGlassCard className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-2 w-2 rounded-full bg-neon-purple neon-glow-purple" />
                <span className="text-xs font-bold text-zinc-500 uppercase">Tracked OI</span>
              </div>
              <span className="text-2xl font-bold text-white">
                {formatCurrency(dashboardMetrics.totalOi)}
              </span>
            </NeoGlassCard>
          </div>
        </div>

        {/* Right Column: Radar & Holdings */}
        <div className="col-span-1 md:col-span-4 flex flex-col gap-6">
          <NeoGlassCard className="p-6 flex flex-col h-[350px]">
            <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest font-serif mb-4">Sector Exposure</h2>
            <PortfolioRadar />
          </NeoGlassCard>

          <NeoGlassCard className="p-6 flex-1 min-h-[250px]">
            <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest font-serif mb-4">Top Performers</h2>
            <div className="space-y-4">
              {dashboardMetrics.topPerformers.length > 0 ? (
                dashboardMetrics.topPerformers.map((token, i) => (
                  <div key={token.symbol} className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-[10px] font-bold">
                        {token.symbol[0]}
                      </div>
                      <span className="font-bold">{token.symbol}</span>
                    </div>
                    <span className={cn("font-mono font-bold", (token.change24h || 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {(token.change24h || 0) > 0 ? '+' : ''}{(token.change24h || 0).toFixed(2)}%
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center text-zinc-500 py-8 text-sm">Loading market data...</div>
              )}
            </div>
          </NeoGlassCard>
        </div>
      </motion.div>
    </motion.main >
  );
}
