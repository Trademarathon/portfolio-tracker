"use client";

import { useState, useEffect, useMemo } from 'react';
import { usePortfolioData } from "@/hooks/usePortfolioData";
import { useRealtimeMarket } from "@/hooks/useRealtimeMarket";
import { motion } from "framer-motion";
import { Position } from '@/lib/api/types';

// Components
import { ConnectionStatus } from "@/components/Dashboard/ConnectionStatus";
import { PriceTickerCard } from "@/components/Dashboard/TradeNest/PriceTickerCard";
import { SentimentWidget } from "@/components/Dashboard/TradeNest/SentimentWidget";
import { FuturesPositionsWidget } from "@/components/Dashboard/TradeNest/FuturesPositionsWidget";
import { MarketsList } from "@/components/Wallet/MarketsList";
import { RecentActivity } from "@/components/Dashboard/RecentActivity";
import { Zap, LayoutGrid } from 'lucide-react';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

// Mock Sparkline Generator
const generateSparkline = (startPrice: number, change: number) => {
  const points = 20;
  const volatility = 0.02; // 2%
  const data = [];
  let current = startPrice * (1 - change / 100); // Approximate start

  // Trend
  const step = (startPrice - current) / points;

  for (let i = 0; i < points; i++) {
    // Add minimal random noise + trend
    const noise = (Math.random() - 0.5) * volatility * startPrice;
    current += step + noise;
    data.push({ value: current });
  }
  // Ensure last point is current price
  data.push({ value: startPrice });
  return data;
};

export default function DashboardPage() {
  const {
    assets,
    activities,
    positions,
    loading,
    totalValue,
    wsConnectionStatus,
    prices
  } = usePortfolioData();

  const [hasHydrated, setHasHydrated] = useState(false);

  // Cast positions
  const typedPositions = positions as Position[];

  // Prices
  const btcPrice = prices['BTC'] || 96000; // Fallback
  const ethPrice = prices['ETH'] || 2600;
  const solPrice = prices['SOL'] || 190; // Example

  // Changes (Mocked if not real, or calculate from history if available)
  // useRealtimeMarket provides stats. But let's assume simple mocks for visual demo if stats missing.
  // Actually useRealtimeMarket is better.
  const { stats } = useRealtimeMarket(['BTC', 'ETH', 'SOL']);

  const btcChange = stats['BTC']?.change24h || 1.2;
  const ethChange = stats['ETH']?.change24h || -0.5;
  const solChange = stats['SOL']?.change24h || 5.4;

  const btcChart = useMemo(() => generateSparkline(btcPrice, btcChange), [btcPrice, btcChange]);
  const ethChart = useMemo(() => generateSparkline(ethPrice, ethChange), [ethPrice, ethChange]);
  const solChart = useMemo(() => generateSparkline(solPrice, solChange), [solPrice, solChange]);

  useEffect(() => { setHasHydrated(true); }, []);

  if (!hasHydrated) return null;

  return (
    <motion.main
      className="flex flex-col gap-6 pb-6 min-h-screen p-4 md:p-6 max-w-[1600px] mx-auto"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div variants={item} className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-white font-urbanist flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-indigo-500" />
            Trade Nest
          </h1>
          <p className="text-sm text-zinc-500">Welcome back, Traveler.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">System Online</span>
          </div>
          <ConnectionStatus status={wsConnectionStatus || new Map()} />
        </div>
      </motion.div>

      {/* Row 1: Price Tickers & Sentiment */}
      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-40">
        <PriceTickerCard
          symbol="BTC"
          name="Bitcoin"
          price={btcPrice}
          change24h={btcChange}
          chartData={btcChart}
          color="orange"
          link="https://app.hyperliquid.xyz/trade/BTC"
        />
        <PriceTickerCard
          symbol="ETH"
          name="Ethereum"
          price={ethPrice}
          change24h={ethChange}
          chartData={ethChart}
          color="indigo"
          link="https://app.hyperliquid.xyz/trade/ETH"
        />
        <PriceTickerCard
          symbol="SOL"
          name="Solana"
          price={solPrice}
          change24h={solChange}
          chartData={solChart}
          color="purple"
          link="https://app.hyperliquid.xyz/trade/SOL"
        />
        <SentimentWidget />
      </motion.div>

      {/* Row 2: Futures & Activity */}
      <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[400px]">
        {/* Futures (2/3 width) */}
        <div className="lg:col-span-2 h-full">
          <FuturesPositionsWidget positions={typedPositions} />
        </div>
        {/* Activity (1/3 width) */}
        <div className="lg:col-span-1 h-full">
          <RecentActivity positions={typedPositions} activities={activities} />
        </div>
      </motion.div>

      {/* Row 3: Market Overview */}
      <motion.div variants={item} className="grid grid-cols-1 gap-4">
        <div className="h-[400px]">
          <MarketsList />
        </div>
      </motion.div>

    </motion.main>
  );
}
