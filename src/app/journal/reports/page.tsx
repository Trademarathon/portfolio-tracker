"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useJournal } from "@/contexts/JournalContext";
import {
  buildEquityCurve,
  buildSymbolStats,
  buildTagStats,
  getClosedTrades,
  winRateFromCounts,
} from "@/lib/journal/reports";
import { formatMoney } from "@/components/Journal/Reports/charts";
import { ReportsSubnav } from "@/components/Journal/Reports/shared";
import {
  Activity,
  ArrowUpRight,
  CircleDot,
  CandlestickChart,
  Clock3,
  GitCompareArrows,
  Layers3,
  PieChart,
  Shield,
  Sparkles,
  Tag,
  TrendingUp,
  Trophy,
} from "lucide-react";

type QuickReportCard = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "violet" | "blue" | "emerald" | "amber" | "rose" | "sky";
  value: string;
  delta: string;
};

function buildSparkPath(values: number[], width: number, height: number): string {
  if (!values.length) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(1, max - min);
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  return values
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / spread) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export default function ReportsPage() {
  const { filteredTrades, annotations, stats, preferences, isLoading } = useJournal();

  const closedTrades = useMemo(() => getClosedTrades(filteredTrades), [filteredTrades]);
  const tagStats = useMemo(() => buildTagStats(closedTrades, annotations), [annotations, closedTrades]);
  const symbolStats = useMemo(() => buildSymbolStats(closedTrades), [closedTrades]);

  const topTag = tagStats[0];
  const topSymbol = symbolStats[0];

  const grossProfit = useMemo(
    () => closedTrades.filter((trade) => Number(trade.realizedPnl ?? trade.pnl ?? 0) > 0).reduce((sum, trade) => sum + Number(trade.realizedPnl ?? trade.pnl ?? 0), 0),
    [closedTrades]
  );
  const grossLoss = useMemo(
    () =>
      Math.abs(
        closedTrades
          .filter((trade) => Number(trade.realizedPnl ?? trade.pnl ?? 0) < 0)
          .reduce((sum, trade) => sum + Number(trade.realizedPnl ?? trade.pnl ?? 0), 0)
      ),
    [closedTrades]
  );
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  const equitySeries = useMemo(() => buildEquityCurve(closedTrades), [closedTrades]);
  const sparkValues = useMemo(() => equitySeries.map((point) => point.y), [equitySeries]);
  const sparkPath = useMemo(() => buildSparkPath(sparkValues, 540, 120), [sparkValues]);
  const winLossRatio = closedTrades.filter((trade) => Number(trade.realizedPnl ?? trade.pnl ?? 0) > 0).length /
    Math.max(1, closedTrades.filter((trade) => Number(trade.realizedPnl ?? trade.pnl ?? 0) < 0).length);

  const assignedPlaybookTrades = useMemo(
    () => closedTrades.filter((trade) => Boolean(annotations[trade.id]?.playbookId)).length,
    [closedTrades, annotations]
  );

  const optionsTradeCount = useMemo(
    () =>
      closedTrades.filter((trade) => {
        const info = trade.info && typeof trade.info === "object" ? (trade.info as Record<string, unknown>) : {};
        const instrument = String((trade as unknown as { instrumentType?: unknown }).instrumentType ?? info.instrumentType ?? "").toLowerCase();
        if (instrument === "option") return true;
        if (Number.isFinite(Number((trade as unknown as { dte?: unknown }).dte ?? info.dte ?? info.daysToExpiry))) return true;
        return false;
      }).length,
    [closedTrades]
  );

  const quickCards: QuickReportCard[] = useMemo(() => {
    const cards: QuickReportCard[] = [
      {
        id: "tags",
        title: "Tags Report",
        description: "Strategy-level performance, hold profile, and directional quality.",
        href: "/journal/reports/tags",
        icon: Tag,
        tone: "violet",
        value: topTag ? formatMoney(topTag.totalPnl, preferences.hideBalances, true) : "$0.00",
        delta: topTag ? `${winRateFromCounts(topTag.wins, topTag.losses).toFixed(0)}% win rate` : "No tagged trades",
      },
      {
        id: "symbols",
        title: "Symbols Report",
        description: "Market-by-market output with side bias and funding behavior.",
        href: "/journal/reports/symbols",
        icon: PieChart,
        tone: "blue",
        value: topSymbol ? formatMoney(topSymbol.totalPnl, preferences.hideBalances, true) : "$0.00",
        delta: topSymbol ? `${winRateFromCounts(topSymbol.wins, topSymbol.losses).toFixed(0)}% win rate` : "No symbol data",
      },
      {
        id: "pnl-curve",
        title: "PnL Curve Report",
        description: "Compare curves by side, session, holdtime, day, and custom buckets.",
        href: "/journal/reports/pnl-curve",
        icon: TrendingUp,
        tone: "emerald",
        value: formatMoney(stats.totalPnl, preferences.hideBalances, true),
        delta: `${closedTrades.length} closed trades`,
      },
      {
        id: "risk",
        title: "Risk Report",
        description: "Position size, volume, and R-multiple diagnostics.",
        href: "/journal/reports/risk",
        icon: Shield,
        tone: "amber",
        value: `${profitFactor > 0 ? profitFactor.toFixed(2) : "0.00"} PF`,
        delta: "Includes stop-based R coverage",
      },
      {
        id: "day-time",
        title: "Day & Time Report",
        description: "Find your strongest weekdays, sessions, and UTC windows.",
        href: "/journal/reports/day-time",
        icon: Clock3,
        tone: "sky",
        value: `${stats.winRate.toFixed(1)}%`,
        delta: "Timing edge breakdown",
      },
      {
        id: "playbook",
        title: "Playbook Report",
        description: "Track outcomes by assigned playbook and execution context.",
        href: "/journal/reports/playbook",
        icon: Layers3,
        tone: "violet",
        value: `${assignedPlaybookTrades}`,
        delta: "Trades linked to playbooks",
      },
      {
        id: "win-loss",
        title: "Win vs Loss Report",
        description: "Side-by-side winner and loser cohorts with metric deltas.",
        href: "/journal/reports/win-loss",
        icon: Trophy,
        tone: "rose",
        value: Number.isFinite(winLossRatio) ? `${winLossRatio.toFixed(2)}x` : "∞",
        delta: "Winners to losers ratio",
      },
      {
        id: "compare",
        title: "Compare Report",
        description: "A/B compare any cohort with full delta metrics.",
        href: "/journal/reports/compare",
        icon: GitCompareArrows,
        tone: "blue",
        value: `${closedTrades.length}`,
        delta: "Trades ready for cohort compare",
      },
      {
        id: "options",
        title: "Options Report",
        description: "DTE and option-type performance across option trades.",
        href: "/journal/reports/options",
        icon: CircleDot,
        tone: "emerald",
        value: `${optionsTradeCount}`,
        delta: "Option trades in current filters",
      },
    ];
    return cards;
  }, [assignedPlaybookTrades, closedTrades.length, optionsTradeCount, preferences.hideBalances, profitFactor, stats.totalPnl, stats.winRate, topSymbol, topTag, winLossRatio]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-12 gap-4">
      <div className="col-span-12 xl:col-span-2">
        <ReportsSubnav />
      </div>

      <div className="col-span-12 xl:col-span-10 space-y-4">
        <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-4xl font-black text-white">Reports</h2>
              <p className="text-sm text-zinc-500 mt-1">Live command center for performance diagnostics.</p>
            </div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-emerald-500/35 bg-emerald-500/10 text-[11px] font-semibold text-emerald-300">
              <Activity className="w-3.5 h-3.5" />
              Live data
            </div>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 mt-4">
            <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/50 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Net PnL</p>
              <p className={cn("text-lg font-bold", stats.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                {formatMoney(stats.totalPnl, preferences.hideBalances, true)}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/50 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Win Rate</p>
              <p className="text-lg font-bold text-zinc-100">{stats.winRate.toFixed(1)}%</p>
            </div>
            <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/50 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Closed Trades</p>
              <p className="text-lg font-bold text-zinc-100">{closedTrades.length}</p>
            </div>
            <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/50 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Profit Factor</p>
              <p className="text-lg font-bold text-zinc-100">{Number.isFinite(profitFactor) ? profitFactor.toFixed(2) : "∞"}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 2xl:grid-cols-3 gap-3">
          <div className="2xl:col-span-2 rounded-xl border border-zinc-800/70 bg-zinc-900/35 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-white inline-flex items-center gap-2">
                <CandlestickChart className="w-4 h-4 text-emerald-400" />
                Equity Snapshot
              </h3>
              <Link href="/journal/reports/pnl-curve" className="text-xs text-emerald-300 hover:text-emerald-200 inline-flex items-center gap-1">
                Open Curve Report
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/45 p-2.5">
              {sparkPath ? (
                <svg viewBox="0 0 540 120" className="w-full h-[180px]">
                  <defs>
                    <linearGradient id="reports-equity-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(87,212,170,0.42)" />
                      <stop offset="100%" stopColor="rgba(87,212,170,0.02)" />
                    </linearGradient>
                  </defs>
                  <path d={sparkPath} fill="none" stroke="#57d4aa" strokeWidth={2.2} strokeLinecap="round" />
                  <path d={`${sparkPath} L 540 120 L 0 120 Z`} fill="url(#reports-equity-gradient)" opacity={0.85} />
                </svg>
              ) : (
                <div className="h-[180px] flex items-center justify-center text-sm text-zinc-600">No curve data yet</div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 p-4">
            <h3 className="text-lg font-bold text-white inline-flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              Top Signals
            </h3>
            <div className="space-y-2.5">
              <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/45 p-2.5">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Best Tag</p>
                <p className="text-sm font-semibold text-zinc-200">{topTag?.label || "N/A"}</p>
                <p className={cn("text-xs mt-1", (topTag?.totalPnl || 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  {topTag ? formatMoney(topTag.totalPnl, preferences.hideBalances, true) : "No data"}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/45 p-2.5">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Best Symbol</p>
                <p className="text-sm font-semibold text-zinc-200">{topSymbol?.label || "N/A"}</p>
                <p className={cn("text-xs mt-1", (topSymbol?.totalPnl || 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  {topSymbol ? formatMoney(topSymbol.totalPnl, preferences.hideBalances, true) : "No data"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
          {quickCards.map((card, index) => {
            const toneClasses = {
              violet: "bg-violet-500/15 text-violet-300 border-violet-500/25",
              blue: "bg-blue-500/15 text-blue-300 border-blue-500/25",
              emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
              amber: "bg-amber-500/15 text-amber-300 border-amber-500/25",
              rose: "bg-rose-500/15 text-rose-300 border-rose-500/25",
              sky: "bg-sky-500/15 text-sky-300 border-sky-500/25",
            }[card.tone];

            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.08, 0.24) }}
                className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={cn("w-10 h-10 rounded-lg border flex items-center justify-center", toneClasses)}>
                    <card.icon className="w-4.5 h-4.5" />
                  </div>
                  <Link href={card.href} className="text-xs text-zinc-400 hover:text-zinc-100 inline-flex items-center gap-1">
                    Open
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <h4 className="text-lg font-bold text-white mt-3">{card.title}</h4>
                <p className="text-sm text-zinc-500 mt-1">{card.description}</p>
                <div className="mt-4">
                  <p className="text-xl font-bold text-zinc-100">{card.value}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{card.delta}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
