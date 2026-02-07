"use client";

import dynamic from 'next/dynamic';
import { usePortfolioData } from "@/hooks/usePortfolioData";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

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

export default function Home() {
  const router = useRouter();
  const { assets, activities, positions, loading, totalValue, totalPnlUsd, totalPnlPercent, drawdowns, wsConnectionStatus } = usePortfolioData();

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
          <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Real-time overview of your crypto portfolio.</p>
        </div>
        <ConnectionStatus status={wsConnectionStatus || new Map()} />
      </motion.div>

      {/* Top Row: Overview + Risk Analysis */}
      <motion.div variants={item} className="grid gap-4 lg:grid-cols-12">
        {/* Overview Card - Takes 2/3 width */}
        <div className="lg:col-span-8">
          <OverviewCard
            totalValue={totalValue}
            pnlUsd={totalPnlUsd}
            pnlPercent={totalPnlPercent}
            openPositions={positions.length}
            loading={loading}
            assets={assets}
          />
        </div>

        {/* Dry Powder Widget - Takes 1/3 width */}
        <div className="lg:col-span-4">
          <StablecoinWidget assets={assets} loading={loading} />
        </div>
      </motion.div>

      {/* Risk Analysis Section - Full Width */}
      <motion.div variants={item} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DrawdownMeter
          title="Total Drawdown"
          value={drawdowns?.total || 0}
          maxDrawdown={drawdowns?.max.total || 0}
          peak={drawdowns?.peaks.total || 0}
          current={totalValue}
        />
        <DrawdownMeter
          title="Spot Drawdown"
          value={drawdowns?.spot || 0}
          maxDrawdown={drawdowns?.max.spot || 0}
          peak={drawdowns?.peaks.spot || 0}
          current={totalValue}
        />
        <DrawdownMeter
          title="Futures Drawdown"
          value={drawdowns?.futures || 0}
          maxDrawdown={drawdowns?.max.futures || 0}
          peak={drawdowns?.peaks.futures || 0}
          current={totalValue}
        />
      </motion.div>

      {/* Main Content Grid */}
      <motion.div variants={item} className="grid gap-4 lg:grid-cols-12">
        {/* Left Column: Activity Feed + Holdings */}
        <div className="lg:col-span-8 space-y-4">
          <RecentActivity
            positions={positions}
            activities={activities}
            loading={loading}
          />
          <HoldingsTable />
        </div>

        {/* Right Column: Screener + Allocation */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Screener</h3>
              <Button
                variant="ghost"
                size="sm"
                className="text-[10px] uppercase font-bold text-primary"
                onClick={() => router.push('/watchlist')}
              >
                Full Terminal
              </Button>
            </div>
            <MarketTable
              isCompact={true}
              symbols={assets.map(a => a.symbol)}
              onSelect={(symbol) => router.push(`/watchlist?symbol=${symbol}`)}
              selectedSymbol=""
            />
          </div>

          <FundingRateWidget />

          <AdvancedAllocation assets={assets} loading={loading} />
        </div>
      </motion.div>
    </motion.main>
  );
}
