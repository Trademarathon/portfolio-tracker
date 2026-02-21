"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  TrendingUp,
  PieChart,
  Wallet,
  BarChart2,
  Globe,
  BookMarked,
  BookOpen,
  Activity,
  Bell,
  Settings,
  Rocket,
  Calendar,
  Zap,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const sectionVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.4 },
  }),
};

const TOC_ENTRIES: { id: string; label: string }[] = [
  { id: "why", label: "Why we built this" },
  { id: "flow", label: "App flow" },
  { id: "before-trade", label: "Before you trade" },
  { id: "overview", label: "Overview" },
  { id: "ai-feed", label: "AI Feed" },
  { id: "markets", label: "Markets & Screener" },
  { id: "spot", label: "Spot" },
  { id: "balances", label: "Balances" },
  { id: "futures", label: "Futures" },
  { id: "wallet-tracker", label: "Wallet Tracker" },
  { id: "playbook", label: "Playbook" },
  { id: "journal", label: "Journal" },
  { id: "activity", label: "Activity" },
  { id: "alerts", label: "Alerts" },
  { id: "trading-session", label: "Trading Session" },
  { id: "settings", label: "Settings" },
];

const COMPONENT_GUIDE: Array<{
  id: string;
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  how: string;
  when: string;
  why: string;
}> = [
  {
    id: "overview",
    title: "Overview",
    href: "/",
    icon: LayoutDashboard,
    how: "Open Overview from the sidebar. Scan top-line stats, then review positions and orders. The right rail surfaces context: Global AI Feed signals and the Economic Calendar. Use the tabs to switch between ALL, SPOT, and FUTURES views.",
    when: "Use when you want a single dashboard view of portfolio, positions, orders, and market context.",
    why: "Fast, consolidated view so you act with context instead of jumping between exchange UIs.",
  },
  {
    id: "ai-feed",
    title: "AI Feed",
    href: "/",
    icon: Zap,
    how: "The Global AI Feed appears on Overview and in Markets (Screener). It includes: (1) Playbook levels per pair (entry zone, targets, stop), (2) Journal reminders for unlogged trades, (3) Perp stop-loss reminders when leverage is high and no stop is set. Cards can be dismissed and are remembered. Enable AI Feed alerts in Settings → Alerts to receive in-app or external notifications.",
    when: "Use before trading and after trading to stay aligned with your plan and clean up journal reminders.",
    why: "Keeps your plan visible per symbol and reduces risk from missing stops or missing journal entries.",
  },
  {
    id: "markets",
    title: "Markets & Screener",
    href: "/watchlist",
    icon: TrendingUp,
    how: "Open Markets to scan the screener table with real-time price, volume, funding, and OI. Apply filters and presets, open charts per symbol, and review the Global AI Feed on the right for plan-level context.",
    when: "Use when you are looking for setups or want to monitor movers and funding/flow.",
    why: "Find opportunities quickly with a professional screener and contextual feed in one place.",
  },
  {
    id: "spot",
    title: "Spot",
    href: "/spot",
    icon: PieChart,
    how: "Open Spot to see all spot holdings across connected CEXs and wallets. View current value, 24h change, and allocation %. Click any asset for detailed analytics; filter by exchange or chain.",
    when: "Use when you need to know what you hold, where you bought, and your allocation for long-term planning or rebalancing.",
    why: "One view of all spot positions so you can plan DCA, sells, and balance with confidence.",
  },
  {
    id: "balances",
    title: "Balances",
    href: "/balances",
    icon: Wallet,
    how: "Open Balances to see balance breakdown by exchange and asset. Use it alongside Spot for a full picture of your capital and free collateral.",
    when: "Use when you need to know your available balance, collateral, or cash position across exchanges.",
    why: "Avoid over-trading or under-allocating; know your balance before you trade.",
  },
  {
    id: "futures",
    title: "Futures",
    href: "/futures",
    icon: BarChart2,
    how: "Open Futures for perpetuals analytics: lifetime PnL and drawdown charts, session heatmap (when you trade best by day/time), profit factor, win rate, and open positions with unrealized PnL and liquidation distance.",
    when: "Use when you trade or have traded futures and want to analyze performance, risk, and open exposure.",
    why: "See where you make and lose money; improve timing and risk with data, not gut.",
  },
  {
    id: "wallet-tracker",
    title: "Wallet Tracker",
    href: "/wallet-tracker",
    icon: Globe,
    how: "Connect wallet addresses in Settings; view on-chain holdings and history in Wallet Tracker. Track tokens across EVM, Solana, and other supported chains.",
    when: "Use when you hold or move assets in wallets and want them in one dashboard with CEX data.",
    why: "One place for CEX and wallets: no more switching between explorers and exchanges.",
  },
  {
    id: "playbook",
    title: "Playbook",
    href: "/playbook",
    icon: BookMarked,
    how: "Use Playbook to define key levels, spot/perp plans, and bias. Active plans appear in the Global AI Feed for each pair—entry zone, targets, stop, and limits—so you can act without opening Playbook each time.",
    when: "Use when you want to define a plan once and have the app surface those levels automatically.",
    why: "Turns a vague idea into a structured plan that stays visible during execution.",
  },
  {
    id: "journal",
    title: "Journal",
    href: "/journal",
    icon: BookOpen,
    how: "Open Journal to review summaries, widgets, and reports. Use Analytics for performance patterns, Calendar for trade-by-date, and Trades for the full list. Add notes and tags to capture context and mistakes. The AI Feed will remind you when there are unlogged trades.",
    when: "Use after trading sessions and during weekly reviews.",
    why: "Builds a feedback loop so you improve timing, discipline, and risk management.",
  },
  {
    id: "activity",
    title: "Activity",
    href: "/activity",
    icon: Activity,
    how: "Open Activity to see transactions and transfers. Filter by symbol, exchange, or date; export for records.",
    when: "Use for reconciliation, audits, or tax prep.",
    why: "Centralized audit trail without digging through multiple exchanges.",
  },
  {
    id: "alerts",
    title: "Alerts",
    href: "/settings?tab=alerts",
    icon: Bell,
    how: "Configure alerts in Settings → Alerts. Add price or condition triggers; choose channels (in-app, browser push, sound, Discord, Telegram). Enable AI feed alerts to get notified when the feed shows playbook levels, journal reminder, or perp stop-loss reminder cards. The sidebar shows a count of recent alerts. Create alerts from the Markets screener or from asset views.",
    when: "Use when you want to be notified at key levels or when the AI feed has reminders (playbook, journal, perp stop loss); set and forget.",
    why: "Act on your plan when price hits; get nudged for journal and stop loss; build discipline and avoid FOMO or panic.",
  },
  {
    id: "trading-session",
    title: "Trading Session",
    href: "/",
    icon: Zap,
    how: "The Trading Session card lives in the sidebar. It shows the current market session (Asia, London, New York, etc.), overlap periods, and a live session timer when you start one. Use it to know when volatility and volume are typically higher.",
    when: "Use before trading to know which session you’re in and whether it’s a good time to trade; align with your plan.",
    why: "Trade when the market is moving; avoid dead sessions unless that’s your strategy.",
  },
  {
    id: "settings",
    title: "Settings",
    href: "/settings",
    icon: Settings,
    how: "Open Settings to manage connections (CEX API keys, wallet addresses), Alerts (channels, triggers), chart and general preferences, and cloud sync. Test connections after adding keys.",
    when: "Use during initial setup and whenever you add an exchange, wallet, or change notification preferences.",
    why: "Secure, centralized config; one place to keep the app aligned with your accounts and preferences.",
  },
];

function UserJourneyFlowSVG() {
  const boxes = [
    { x: 20, y: 30, w: 100, h: 50, label: "1. Connect", sub: "Add API keys & wallets" },
    { x: 160, y: 30, w: 100, h: 50, label: "2. Sync", sub: "Real-time data" },
    { x: 300, y: 30, w: 100, h: 50, label: "3. View", sub: "Overview & Holdings" },
    { x: 440, y: 30, w: 100, h: 50, label: "4. Trade", sub: "Markets" },
    { x: 580, y: 30, w: 100, h: 50, label: "5. Analyze", sub: "Journal & AI" },
    { x: 720, y: 30, w: 100, h: 50, label: "6. Optimize", sub: "Alerts & Reports" },
  ];
  const arrowX = [100, 240, 380, 520, 660];
  return (
    <svg viewBox="0 0 900 180" className="w-full min-w-[600px] h-auto" style={{ maxHeight: "200px" }}>
      <defs>
        <linearGradient id="guideFlowGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.3" />
        </linearGradient>
        <marker id="guideArrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" opacity="0.6" />
        </marker>
      </defs>
      {boxes.map((box, i) => (
        <g key={i}>
          <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="8" fill="url(#guideFlowGrad1)" stroke="#6366f1" strokeWidth="1.5" opacity="0.9" />
          <text x={box.x + box.w / 2} y={box.y + 22} textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">{box.label}</text>
          <text x={box.x + box.w / 2} y={box.y + 38} textAnchor="middle" fill="#a1a1aa" fontSize="8">{box.sub}</text>
        </g>
      ))}
      {arrowX.map((x, i) => (
        <line key={i} x1={x + 40} y1="55" x2={x + 80} y2="55" stroke="#6366f1" strokeWidth="2" markerEnd="url(#guideArrowhead)" opacity="0.7" />
      ))}
    </svg>
  );
}

export default function HowItWorksPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const sections = TOC_ENTRIES.map((e) => ({ id: e.id, node: document.getElementById(e.id) })).filter((s) => s.node);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = (entry.target as HTMLElement).id;
          if (id) setActiveId(id);
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
    );
    sections.forEach((s) => s.node && observer.observe(s.node));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8" ref={containerRef}>
        {/* Sticky ToC */}
        <motion.nav
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="sticky top-4 z-10 mb-10 rounded-xl border border-border bg-card/80 backdrop-blur-md px-4 py-3 shadow-sm"
        >
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">On this page</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {TOC_ENTRIES.map((entry) => (
              <a
                key={entry.id}
                href={`#${entry.id}`}
                className={cn(
                  "text-sm transition-colors hover:text-foreground",
                  activeId === entry.id ? "text-indigo-400 font-medium" : "text-muted-foreground"
                )}
              >
                {entry.label}
              </a>
            ))}
          </div>
        </motion.nav>

        {/* Hero / Why we built this */}
        <motion.section
          id="why"
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          custom={0}
          className="mb-16"
        >
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
            How it works
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Trade Marathon gives you one place to plan, execute, and review. See positions, balances, journal insights, and live market context without switching between tools.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            <Card className="border-indigo-500/20 bg-indigo-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-indigo-400" />
                  Long-term holders
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>Track spot holdings, allocation, and balance in one place. Plan DCA entries with Playbook levels and use Journal for review and learning.</p>
              </CardContent>
            </Card>
            <Card className="border-purple-500/20 bg-purple-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-purple-400" />
                  Scalpers & active traders
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>Use the Markets screener to scan setups. Check Trading Session context and the Global AI Feed before placing orders.</p>
              </CardContent>
            </Card>
          </div>
        </motion.section>

        {/* App flow */}
        <motion.section
          id="flow"
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          custom={1}
          className="mb-16"
        >
          <Card className="bg-card/50 border-border overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Rocket className="h-5 w-5 text-indigo-400" />
                App flow
              </CardTitle>
              <p className="text-sm text-muted-foreground">Your path from setup to optimized trading</p>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <div className="w-full overflow-x-auto py-4">
                <UserJourneyFlowSVG />
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* Before you trade */}
        <motion.section
          id="before-trade"
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          custom={2}
          className="mb-16"
        >
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-amber-400" />
                Before you trade
              </CardTitle>
              <p className="text-sm text-muted-foreground">Check session and context so you trade with clarity</p>
            </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
              <p><strong className="text-foreground">Economic Calendar</strong> (Overview) — Real-time events so you’re not caught off guard.</p>
              <p><strong className="text-foreground">Global AI Feed</strong> (Overview + Markets) — Shows playbook levels per pair, journal reminders for unlogged trades, and stop-loss reminders for risky perp positions. Cards support dismiss and memory; alerts can notify you across channels.</p>
              <p><strong className="text-foreground">Trading Session</strong> (sidebar) — Which session is active (Asia, London, New York) and whether it’s overlap. Know when volume and volatility are typically higher.</p>
              <p>Optional: enable social feed cards in Settings if you want extra headline context in one place.</p>
          </CardContent>
        </Card>
        </motion.section>

        {/* Component-by-component guide */}
        <section className="space-y-10">
          <h2 className="text-2xl font-bold tracking-tight">Component guide</h2>
          <p className="text-muted-foreground">How to use, when to use, and why for each part of the app.</p>
          {COMPONENT_GUIDE.map((guide, index) => (
            <motion.div
              key={guide.id}
              id={guide.id}
              variants={sectionVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-40px" }}
              custom={index + 3}
            >
              <Card className="overflow-hidden border-border bg-card/50">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <guide.icon className="h-5 w-5 text-indigo-400 shrink-0" />
                      {guide.title}
                    </CardTitle>
                    <Link
                      href={guide.href}
                      className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 shrink-0"
                    >
                      Open <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">How to use</h4>
                    <p className="text-muted-foreground">{guide.how}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">When to use</h4>
                    <p className="text-muted-foreground">{guide.when}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">Why to use</h4>
                    <p className="text-muted-foreground">{guide.why}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </section>

        {/* Journal sub-areas callout */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          custom={20}
          className="mt-12"
        >
          <Card className="border-border bg-card/30">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-indigo-400" />
                Journal sub-areas
              </CardTitle>
              <p className="text-sm text-muted-foreground">Quick reference for Journal tabs</p>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p><strong className="text-foreground">Home</strong> — Summary, weekly calendar, quick links to Dashboard, Reports, Analytics, Calendar, Trades.</p>
              <p><strong className="text-foreground">Dashboard</strong> — Custom widgets (PnL, win rate, hold time, etc.).</p>
              <p><strong className="text-foreground">Reports</strong> — Tags, Symbols, PnL Curve for breakdowns.</p>
              <p><strong className="text-foreground">Analytics</strong> — Deeper performance and pattern analytics.</p>
              <p><strong className="text-foreground">Calendar</strong> — Trades by date.</p>
              <p><strong className="text-foreground">Trades</strong> — All Trades and Open Positions.</p>
              <p><strong className="text-foreground">Preferences</strong> — Journal settings.</p>
            </CardContent>
          </Card>
        </motion.section>

        <footer className="mt-16 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <Link href="/" className="text-indigo-400 hover:text-indigo-300 font-medium">
            Back to Overview
          </Link>
          <span className="mx-2">·</span>
          <Link href="/about" className="text-indigo-400 hover:text-indigo-300 font-medium">
            About
          </Link>
        </footer>
      </div>
    </div>
  );
}
