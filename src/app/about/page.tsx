"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
    Star, Zap, Shield, Key, Rocket, Users, Target,
    Bell, Settings, ArrowRightLeft,
    TrendingUp, AlertTriangle,
    Globe, BookOpen, PieChart, Activity,
    MessageCircle, Volume2, Clock, ChevronRight,
    Layers, RefreshCw, Lock, LayoutGrid,
    Mail, ExternalLink
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

// Custom SVG Icons
const DiscordIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
);

const TelegramIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12a12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472c-.18 1.898-.962 6.502-1.36 8.627c-.168.9-.499 1.201-.82 1.23c-.696.065-1.225-.46-1.9-.902c-1.056-.693-1.653-1.124-2.678-1.8c-1.185-.78-.417-1.21.258-1.91c.177-.184 3.247-2.977 3.307-3.23c.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345c-.48.33-.913.49-1.302.48c-.428-.008-1.252-.241-1.865-.44c-.752-.245-1.349-.374-1.297-.789c.027-.216.325-.437.893-.663c3.498-1.524 5.83-2.529 6.998-3.014c3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
);

const BrainIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.04" />
        <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.04" />
    </svg>
);

const ChartIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M3 3v18h18" />
        <path d="m19 9-5 5-4-4-3 3" />
    </svg>
);



// Feature Card Component
const FeatureCard = ({
    icon: Icon,
    title,
    description,
    href,
    color = "indigo",
    steps
}: {
    icon: any;
    title: string;
    description: string;
    href?: string;
    color?: string;
    steps?: string[];
}) => {
    const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
        indigo: { bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/20" },
        emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
        amber: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
        rose: { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20" },
        purple: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
        cyan: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20" },
        blue: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
    };

    const colors = colorClasses[color] || colorClasses.indigo;

    const content = (
        <Card className={cn(
            "bg-card/30 border-border hover:border-white/20 transition-all group h-full",
            href && "cursor-pointer hover:bg-white/[0.02]"
        )}>
            <CardContent className="p-5">
                <div className="flex items-start gap-4">
                    <div className={cn("p-3 rounded-xl shrink-0", colors.bg)}>
                        <Icon className={cn("h-5 w-5", colors.text)} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-bold text-white">{title}</h4>
                            {href && (
                                <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
                            )}
                        </div>
                        <p className="text-xs text-zinc-500 leading-relaxed mb-3">{description}</p>
                        {steps && (
                            <div className="space-y-1.5">
                                {steps.map((step, i) => (
                                    <div key={i} className="flex items-start gap-2">
                                        <span className={cn("text-[10px] font-black rounded px-1.5 py-0.5 shrink-0", colors.bg, colors.text)}>
                                            {i + 1}
                                        </span>
                                        <span className="text-[11px] text-zinc-400">{step}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    if (href) {
        return <Link href={href}>{content}</Link>;
    }

    return content;
};

export default function AboutPage() {
    return (
        <div className="flex flex-col gap-10 pb-16 max-w-6xl mx-auto w-full">
            {/* Header */}
            <div className="flex flex-col gap-4 px-1">
                <div className="flex items-center gap-4">
                    <div className="relative h-12 w-52 overflow-hidden">
                        <Image
                            src="/trade-marathon-logo.png"
                            alt="Trade Marathon®"
                            fill
                            className="object-contain filter dark:brightness-110"
                        />
                    </div>
                </div>
                <p className="text-xl text-muted-foreground font-serif italic opacity-80">
                    Empowering traders with premium cross-chain analytics.
                </p>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    Still early beta
                </span>
            </div>

            {/* Recent Updates */}
            <Card className="bg-emerald-500/5 border-emerald-500/20" id="recent-updates">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <RefreshCw className="h-5 w-5 text-emerald-400" />
                        Recent Updates
                    </CardTitle>
                    <CardDescription>Latest improvements and new features</CardDescription>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-3 text-sm">
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 mt-0.5">•</span>
                            <span><strong className="text-zinc-300">Activity tab</strong> — Transactions & Transfers merged into one unified Activity view with search, date filters, source filter, and CSV export</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 mt-0.5">•</span>
                            <span><strong className="text-zinc-300">First-time hint</strong> — "How to Use" guide appears on first install, auto-dismisses after 5s or manual close</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 mt-0.5">•</span>
                            <span><strong className="text-zinc-300">Founder section</strong> — Ravi (Founder & Lead Architect) with vision, website (trademarathon.trade), and email</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 mt-0.5">•</span>
                            <span><strong className="text-zinc-300">How to Use guide</strong> — Full step-by-step guide with SVG diagrams, examples, and data flow architecture</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 mt-0.5">•</span>
                            <span><strong className="text-zinc-300">HFT-grade performance</strong> — Ultra-fast tab switching with prefetch, optimized bundle, reduced RAM usage</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 mt-0.5">•</span>
                            <span><strong className="text-zinc-300">Trading security</strong> — PIN, session lock, allow trading per connection, lock on tab blur</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 mt-0.5">•</span>
                            <span><strong className="text-zinc-300">OKX support</strong> — Full CEX integration for orders, positions, and real-time sync</span>
                        </li>
                    </ul>
                </CardContent>
            </Card>

            {/* Mission & Founder */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-2 bg-card/50 backdrop-blur-xl border-border overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Target className="h-32 w-32" />
                    </div>
                    <CardHeader>
                        <CardTitle className="text-xl flex items-center gap-2">
                            <Rocket className="h-5 w-5 text-trade-purple" />
                            The Mission
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-muted-foreground leading-relaxed">
                        <p>
                            Trade Marathon® was born out of a necessity for clarity in the fast-paced world of decentralized finance and centralized exchanges. We believe that every trader deserves professional-grade tools to track, analyze, and optimize their portfolio.
                        </p>
                        <p>
                            Our platform provides a unified dashboard that bridges the gap between CEXs like Binance and Bybit, and on-chain wallets across Ethereum, Solana, Bitcoin, and dozens of other networks.
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-trade-purple/5 border-trade-purple/20 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-trade-purple" />
                    <CardHeader>
                        <CardTitle className="text-xl flex items-center gap-2">
                            <Users className="h-5 w-5 text-trade-purple" />
                            Founder
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-1">
                            <h3 className="text-lg font-bold text-foreground">Ravi</h3>
                            <p className="text-xs font-mono uppercase tracking-widest text-trade-purple font-bold">Founder & Lead Architect</p>
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm font-semibold text-foreground">My Vision</p>
                            <p className="text-sm text-muted-foreground italic">
                                &quot;Transparency and execution are the twin pillars of successful trading. We build for the marathon, not the sprint.&quot;
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Empowering every trader with professional-grade tools — unified across CEXs and chains — so they can track, analyze, and optimize with clarity.
                            </p>
                        </div>
                        <div className="pt-4 border-t border-trade-purple/10 space-y-4">
                            <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-black/30 border border-white/5">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">My socials</p>
                                <a
                                    href="https://www.trademarathon.trade"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex flex-col items-center gap-2 group"
                                >
                                    <Image
                                        src="/trademarathon-socials-qr.png"
                                        alt="QR code for www.trademarathon.trade"
                                        width={120}
                                        height={120}
                                        className="rounded-lg"
                                    />
                                    <span className="flex items-center gap-1.5 text-sm text-trade-purple group-hover:text-trade-purple/80 transition-colors">
                                        <span className="w-1.5 h-1.5 rounded-full bg-trade-purple shrink-0" />
                                        www.trademarathon.trade
                                    </span>
                                </a>
                            </div>
                            <a
                                href="https://www.trademarathon.trade"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-trade-purple hover:text-trade-purple/80 transition-colors"
                            >
                                <ExternalLink className="h-4 w-4" />
                                www.trademarathon.trade
                            </a>
                            <a
                                href="mailto:ravi@trademarathon.trade"
                                className="flex items-center gap-2 text-sm text-trade-purple hover:text-trade-purple/80 transition-colors"
                            >
                                <Mail className="h-4 w-4" />
                                ravi@trademarathon.trade
                            </a>
                            <p className="text-xs text-muted-foreground pt-2">Trade Marathon Team</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Complete How to Use Guide */}
            <div className="space-y-8" id="how-to-use">
                <div className="flex items-center gap-3 px-1">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
                        <BookOpen className="h-6 w-6 text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">How to Use Trade Marathon®</h2>
                        <p className="text-sm text-zinc-500">Full guide with examples and visual diagrams</p>
                    </div>
                </div>

                {/* User Journey Flow - SVG Diagram */}
                <Card className="bg-card/50 backdrop-blur-xl border-border overflow-hidden">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Rocket className="h-5 w-5 text-indigo-400" />
                            User Journey Flow
                        </CardTitle>
                        <CardDescription>Your path from setup to optimized trading</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="w-full overflow-x-auto py-4">
                            <svg viewBox="0 0 900 180" className="w-full min-w-[700px] h-auto" style={{ maxHeight: '200px' }}>
                                <defs>
                                    <linearGradient id="flowGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
                                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.3" />
                                    </linearGradient>
                                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                        <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" opacity="0.6" />
                                    </marker>
                                </defs>
                                {/* Flow boxes */}
                                {[
                                    { x: 20, y: 30, w: 100, h: 50, label: "1. Connect", sub: "Add API keys & wallets" },
                                    { x: 160, y: 30, w: 100, h: 50, label: "2. Sync", sub: "Real-time data" },
                                    { x: 300, y: 30, w: 100, h: 50, label: "3. View", sub: "Overview & Holdings" },
                                    { x: 440, y: 30, w: 100, h: 50, label: "4. Trade", sub: "Markets" },
                                    { x: 580, y: 30, w: 100, h: 50, label: "5. Analyze", sub: "Journal & AI" },
                                    { x: 720, y: 30, w: 100, h: 50, label: "6. Optimize", sub: "Alerts & Reports" },
                                ].map((box, i) => (
                                    <g key={i}>
                                        <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="8" fill="url(#flowGrad1)" stroke="#6366f1" strokeWidth="1.5" opacity="0.9" />
                                        <text x={box.x + box.w / 2} y={box.y + 22} textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">{box.label}</text>
                                        <text x={box.x + box.w / 2} y={box.y + 38} textAnchor="middle" fill="#a1a1aa" fontSize="8">{box.sub}</text>
                                    </g>
                                ))}
                                {/* Arrows */}
                                {[100, 240, 380, 520, 660].map((x, i) => (
                                    <line key={i} x1={x + 40} y1="55" x2={x + 80} y2="55" stroke="#6366f1" strokeWidth="2" markerEnd="url(#arrowhead)" opacity="0.7" />
                                ))}
                            </svg>
                        </div>
                    </CardContent>
                </Card>

                {/* Detailed Steps with Examples */}
                <div className="space-y-6">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm font-black">1</span>
                        Connect Your Data Sources
                    </h3>
                    <Card className="bg-card/30 border-border">
                        <CardContent className="p-6 space-y-4">
                            <p className="text-sm text-zinc-400 leading-relaxed">
                                Navigate to <strong className="text-white">Settings → Connections</strong>. You can connect:
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                                    <h4 className="font-bold text-indigo-400 text-sm mb-2">CEX Exchanges</h4>
                                    <p className="text-xs text-zinc-400 mb-2">Binance, Bybit, OKX, Hyperliquid</p>
                                    <p className="text-[11px] text-zinc-500 font-mono">
                                        Example: Add Binance → Paste API Key + Secret → Test Connection → Enable &quot;Allow Trading&quot; if you want to place orders
                                    </p>
                                </div>
                                <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                                    <h4 className="font-bold text-cyan-400 text-sm mb-2">On-Chain Wallets</h4>
                                    <p className="text-xs text-zinc-400 mb-2">EVM, Solana, Bitcoin, 50+ chains</p>
                                    <p className="text-[11px] text-zinc-500 font-mono">
                                        Example: Add Wallet → Paste 0x... address → Select chain (ETH, ARB, etc.) → View balances
                                    </p>
                                </div>
                            </div>
                            <p className="text-[10px] text-zinc-500">
                                <strong>Tip:</strong> Use read-only API keys when possible. Enable &quot;Allow Trading&quot; only for connections you actively trade from.
                            </p>
                        </CardContent>
                    </Card>

                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-sm font-black">2</span>
                        Sync & View Your Portfolio
                    </h3>
                    <Card className="bg-card/30 border-border">
                        <CardContent className="p-6 space-y-4">
                            <p className="text-sm text-zinc-400 leading-relaxed">
                                Data syncs automatically. Go to <strong className="text-white">Overview</strong> (home) or <strong className="text-white">Spot Holdings</strong>.
                            </p>
                            <div className="p-4 rounded-xl bg-white/5 border border-white/5 font-mono text-[11px] space-y-2">
                                <p className="text-zinc-500">Example: You have 10 ETH on Binance and 5 ETH on a wallet.</p>
                                <p className="text-white">→ Overview shows: &quot;15 ETH total • $45,000&quot;</p>
                                <p className="text-white">→ Spot Holdings: Click &quot;Binance&quot; card → See only Binance holdings (10 ETH)</p>
                                <p className="text-white">→ Click &quot;ALL OPS&quot; → See aggregated 15 ETH</p>
                            </div>
                        </CardContent>
                    </Card>

                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center text-sm font-black">3</span>
                        Markets & watchlist
                    </h3>
                    <Card className="bg-card/30 border-border">
                        <CardContent className="p-6 space-y-4">
                            <p className="text-sm text-zinc-400 leading-relaxed">
                                Go to <strong className="text-white">Markets</strong>. Browse pairs, add favorites, and open charts for any symbol.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                                    <h4 className="font-bold text-purple-400 text-sm mb-2">Before Trading</h4>
                                    <p className="text-[11px] text-zinc-400 mb-2">Enable in Settings → Security:</p>
                                    <ul className="text-[10px] text-zinc-500 space-y-1 list-disc list-inside">
                                        <li>Enable Trading toggle</li>
                                        <li>Set Trading PIN (optional)</li>
                                        <li>Set &quot;Allow Trading&quot; on your connection</li>
                                    </ul>
                                </div>
                                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                    <h4 className="font-bold text-amber-400 text-sm mb-2">Example</h4>
                                    <p className="text-[11px] text-zinc-400 font-mono">
                                        Open Markets → Add BTC to watchlist → Open chart for detailed view
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-black">4</span>
                        Analyze & Optimize
                    </h3>
                    <Card className="bg-card/30 border-border">
                        <CardContent className="p-6 space-y-4">
                            <p className="text-sm text-zinc-400 leading-relaxed">
                                Use <strong className="text-white">Trade Journal</strong> for annotations, <strong className="text-white">Global AI Feed</strong> for signals, <strong className="text-white">Alerts</strong> for notifications.
                            </p>
                            <div className="p-4 rounded-xl bg-white/5 border border-white/5 font-mono text-[11px] space-y-2">
                                <p className="text-zinc-500">Example: Set up alert for &quot;BTC price &gt; $100,000&quot;</p>
                                <p className="text-white">→ Settings → Alerts → Add Alert → Trigger: Price &gt; 100000 → Channel: Discord</p>
                                <p className="text-white">→ When BTC hits $100K, you get a Discord notification</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Architecture Diagram */}
                <Card className="bg-card/50 backdrop-blur-xl border-border overflow-hidden">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Layers className="h-5 w-5 text-indigo-400" />
                            Data Flow Architecture
                        </CardTitle>
                        <CardDescription>How your data flows from sources to Trade Marathon</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="w-full overflow-x-auto py-4">
                            <svg viewBox="0 0 800 220" className="w-full min-w-[600px] h-auto" style={{ maxHeight: '240px' }}>
                                <defs>
                                    <linearGradient id="cexGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" stopColor="#f0b90b" stopOpacity="0.4" />
                                        <stop offset="100%" stopColor="#f0b90b" stopOpacity="0.1" />
                                    </linearGradient>
                                    <linearGradient id="walletGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.1" />
                                    </linearGradient>
                                    <linearGradient id="appGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.5" />
                                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.2" />
                                    </linearGradient>
                                </defs>
                                {/* Sources */}
                                <rect x="30" y="20" width="120" height="40" rx="6" fill="url(#cexGrad)" stroke="#f0b90b" strokeWidth="1" />
                                <text x="90" y="45" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">CEX (Binance, Bybit, OKX)</text>
                                <rect x="30" y="80" width="120" height="40" rx="6" fill="url(#walletGrad)" stroke="#3b82f6" strokeWidth="1" />
                                <text x="90" y="105" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">Wallets (EVM, Solana)</text>
                                {/* Arrows to app */}
                                <path d="M 150 40 L 280 85 L 280 110 L 150 155" fill="none" stroke="#6366f1" strokeWidth="2" strokeDasharray="4 4" opacity="0.6" />
                                <path d="M 150 100 L 280 110" fill="none" stroke="#6366f1" strokeWidth="2" strokeDasharray="4 4" opacity="0.6" />
                                {/* Trade Marathon */}
                                <rect x="290" y="70" width="220" height="80" rx="12" fill="url(#appGrad)" stroke="#6366f1" strokeWidth="2" />
                                <text x="400" y="95" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold">Trade Marathon®</text>
                                <text x="400" y="115" textAnchor="middle" fill="#a1a1aa" fontSize="9">API Server • WebSocket • Local Storage</text>
                                <text x="400" y="132" textAnchor="middle" fill="#71717a" fontSize="8">Unified Dashboard • Real-time Sync</text>
                                {/* Arrows to outputs */}
                                <line x1="510" y1="110" x2="580" y2="110" stroke="#6366f1" strokeWidth="2" opacity="0.6" />
                                <polygon points="580,110 573,106 573,114" fill="#6366f1" opacity="0.6" />
                                {/* Outputs */}
                                <rect x="590" y="30" width="90" height="35" rx="6" fill="rgba(99,102,241,0.2)" stroke="#6366f1" strokeWidth="1" />
                                <text x="635" y="52" textAnchor="middle" fill="#fff" fontSize="9">Overview</text>
                                <rect x="590" y="75" width="90" height="35" rx="6" fill="rgba(99,102,241,0.2)" stroke="#6366f1" strokeWidth="1" />
                                <text x="635" y="97" textAnchor="middle" fill="#fff" fontSize="9">Markets</text>
                                <rect x="590" y="120" width="90" height="35" rx="6" fill="rgba(99,102,241,0.2)" stroke="#6366f1" strokeWidth="1" />
                                <text x="635" y="142" textAnchor="middle" fill="#fff" fontSize="9">Journal</text>
                                <rect x="590" y="165" width="90" height="35" rx="6" fill="rgba(99,102,241,0.2)" stroke="#6366f1" strokeWidth="1" />
                                <text x="635" y="187" textAnchor="middle" fill="#fff" fontSize="9">Alerts</text>
                            </svg>
                        </div>
                    </CardContent>
                </Card>

                {/* The Plan & Vision */}
                <Card className="bg-gradient-to-br from-trade-purple/10 to-indigo-500/5 border-trade-purple/20">
                    <CardHeader>
                        <CardTitle className="text-xl flex items-center gap-2">
                            <Target className="h-5 w-5 text-trade-purple" />
                            The Plan & Vision
                        </CardTitle>
                        <CardDescription>What we&apos;re building and why</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <h4 className="font-bold text-white">Core Philosophy</h4>
                                <ul className="space-y-2 text-sm text-zinc-400">
                                    <li className="flex items-start gap-2">
                                        <span className="text-trade-purple mt-0.5">•</span>
                                        <span><strong className="text-zinc-300">Unified view</strong> — One dashboard for all CEXs, wallets, and chains</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-trade-purple mt-0.5">•</span>
                                        <span><strong className="text-zinc-300">Real-time first</strong> — WebSocket sync, sub-second latency</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-trade-purple mt-0.5">•</span>
                                        <span><strong className="text-zinc-300">Security first</strong> — PIN, session lock, allow trading per connection</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-trade-purple mt-0.5">•</span>
                                        <span><strong className="text-zinc-300">Build for the marathon</strong> — Journal, learn, iterate</span>
                                    </li>
                                </ul>
                            </div>
                            <div className="space-y-4">
                                <h4 className="font-bold text-white">What&apos;s Included</h4>
                                <ul className="space-y-2 text-sm text-zinc-400">
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-400 mt-0.5">✓</span>
                                        <span>Overview, Spot, Balances, Futures, Markets & Screener</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-400 mt-0.5">✓</span>
                                        <span>Global AI Feed, Economic Calendar, Wallet Tracker, Playbook</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-400 mt-0.5">✓</span>
                                        <span>Trade Journal, Alerts (Discord, Telegram)</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-400 mt-0.5">✓</span>
                                        <span>Export/Import, Indian Markets, Voice Transcription</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                            <p className="text-sm text-amber-100/90 italic">
                                &quot;Transparency and execution are the twin pillars of successful trading. We build for the marathon, not the sprint.&quot;
                            </p>
                            <p className="text-xs text-amber-400/80 mt-2 font-bold">— Trade Marathon Team</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Start */}
            <div className="space-y-6">
                <div className="flex items-center gap-3 px-1">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20">
                        <Zap className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">Quick Start Guide</h2>
                        <p className="text-sm text-zinc-500">Get up and running in 4 simple steps</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[
                        { title: "Connect", icon: Key, desc: "Add your CEX API keys or wallet addresses in Settings.", color: "indigo" },
                        { title: "Sync", icon: RefreshCw, desc: "Real-time balance and trade history sync across all sources.", color: "cyan" },
                        { title: "Analyze", icon: ChartIcon, desc: "Overview dashboard with positions, orders, and AI feed.", color: "purple" },
                        { title: "Optimize", icon: Target, desc: "Global AI Feed insights and journal your trades.", color: "emerald" }
                    ].map((step, i) => (
                        <Card key={i} className="bg-card/30 border-border hover:border-trade-purple/30 transition-colors">
                            <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                                <div className="relative">
                                    <div className={cn(
                                        "h-14 w-14 rounded-2xl flex items-center justify-center",
                                        step.color === "indigo" && "bg-indigo-500/10 text-indigo-400",
                                        step.color === "cyan" && "bg-cyan-500/10 text-cyan-400",
                                        step.color === "purple" && "bg-purple-500/10 text-purple-400",
                                        step.color === "emerald" && "bg-emerald-500/10 text-emerald-400",
                                    )}>
                                        <step.icon className="h-7 w-7" />
                                    </div>
                                    <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                                        <span className="text-[10px] font-black text-white">{i + 1}</span>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-bold text-foreground mb-1">{step.title}</h4>
                                    <p className="text-xs text-muted-foreground">{step.desc}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Main Features */}
            <div className="space-y-6">
                <div className="flex items-center gap-3 px-1">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
                        <Layers className="h-5 w-5 text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">Core Features</h2>
                        <p className="text-sm text-zinc-500">Everything you need for professional trading</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FeatureCard
                        icon={LayoutGrid}
                        title="Overview Dashboard"
                        description="Unified portfolio view with highlights, open positions, open orders, and Global AI Feed. Spot holdings in dedicated tab."
                        href="/"
                        color="indigo"
                        steps={[
                            "View net worth, PnL, and BTC ticker in header",
                            "Switch between ALL, SPOT, FUTURES tabs",
                            "Open Positions and Orders stacked below highlights",
                            "Global AI Feed with economic events and insights"
                        ]}
                    />

                    <FeatureCard
                        icon={TrendingUp}
                        title="Markets & Screener"
                        description="Browse markets, add favorites to your watchlist, and use the professional screener with real-time data, funding rates, and volume. Open charts for any symbol."
                        href="/watchlist"
                        color="purple"
                        steps={[
                            "Browse all available markets and screener",
                            "Add symbols to your watchlist",
                            "Sort by price change, volume, or funding rate",
                            "Open charts and analytics for any pair"
                        ]}
                    />

                    <FeatureCard
                        icon={PieChart}
                        title="Spot Holdings"
                        description="View all your spot holdings across CEXs and wallets with real-time prices and allocation breakdown."
                        href="/spot"
                        color="emerald"
                        steps={[
                            "See all assets with current value and 24h change",
                            "View allocation % for each asset",
                            "Click any asset for detailed analytics",
                            "Filter by exchange or chain"
                        ]}
                    />

                    <FeatureCard
                        icon={TrendingUp}
                        title="Futures Analytics"
                        description="Professional-grade perpetual futures tracking: PnL and drawdown charts, session heatmap, profit factor, win rate, and open positions with liquidation distance."
                        href="/futures"
                        color="amber"
                        steps={[
                            "Lifetime PnL and drawdown analytics",
                            "Session heatmap: when you trade best (day/time)",
                            "Advanced metrics: profit factor, win/loss ratio, risk/reward",
                            "Open positions with unrealized PnL and liquidation price"
                        ]}
                    />

                    <FeatureCard
                        icon={ArrowRightLeft}
                        title="Transactions & Transfers"
                        description="Complete history of all your trades and transfers with filtering and export options."
                        href="/activity"
                        color="blue"
                        steps={[
                            "View all buy/sell transactions",
                            "Filter by symbol, exchange, or date",
                            "See realized PnL for closed trades",
                            "Export to CSV for tax reporting"
                        ]}
                    />

                    <FeatureCard
                        icon={BookOpen}
                        title="Trade Journal"
                        description="Document your trades with annotations, emotions, and learnings for continuous improvement."
                        href="/journal"
                        color="rose"
                        steps={[
                            "Add notes to any trade",
                            "Tag with emotions (FOMO, Greed, etc.)",
                            "Track win/loss patterns",
                            "Review past trades for learning"
                        ]}
                    />
                </div>
            </div>

            {/* Global AI Feed & Alerts */}
            <div className="space-y-6">
                <div className="flex items-center gap-3 px-1">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                        <BrainIcon className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">Global AI Feed & Alerts</h2>
                        <p className="text-sm text-zinc-500">Real-time intelligence from Spot, Balances, Playbooks, Calendar, Futures & Tx</p>
                    </div>
                </div>

                <Card className="bg-gradient-to-br from-purple-500/5 to-indigo-500/5 border-purple-500/20">
                    <CardContent className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* AI Signal Types */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Zap className="h-4 w-4 text-purple-400" />
                                    AI Signal Types
                                </h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { emoji: "🎯", label: "Take Profit", desc: "When assets reach profit targets" },
                                        { emoji: "🛑", label: "Stop Loss", desc: "When positions hit loss thresholds" },
                                        { emoji: "💰", label: "DCA Opportunity", desc: "Good entry points for averaging" },
                                        { emoji: "📈", label: "Sell Signal", desc: "When to consider taking profits" },
                                        { emoji: "🧠", label: "Price Memory", desc: "Price within 5% of historical buy/sell (accurate %)" },
                                        { emoji: "📅", label: "Economic Calendar", desc: "Real-time events from Trading Economics" },
                                        { emoji: "⚠️", label: "Risk Alerts", desc: "Concentration & exposure warnings" },
                                        { emoji: "↔️", label: "Transfer Insights", desc: "Deposit & withdrawal tracking" },
                                    ].map((signal, i) => (
                                        <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-white/5">
                                            <span className="text-lg">{signal.emoji}</span>
                                            <div>
                                                <p className="text-xs font-bold text-white">{signal.label}</p>
                                                <p className="text-[9px] text-zinc-500">{signal.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Alert Channels */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Bell className="h-4 w-4 text-amber-400" />
                                    Alert Delivery Channels
                                </h3>
                                <div className="space-y-3">
                                    {[
                                        { icon: Bell, label: "In-App Notifications", desc: "Toast notifications within the app", color: "indigo" },
                                        { icon: Globe, label: "Browser Push", desc: "Desktop notifications even when minimized", color: "blue" },
                                        { icon: Volume2, label: "Sound Alerts", desc: "Audible notifications with custom sounds", color: "amber" },
                                        { icon: DiscordIcon, label: "Discord Webhook", desc: "Send alerts to your Discord channel", color: "purple" },
                                        { icon: TelegramIcon, label: "Telegram Bot", desc: "Receive alerts via Telegram", color: "cyan" },
                                    ].map((channel, i) => (
                                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                                            <div className={cn(
                                                "p-2 rounded-lg",
                                                channel.color === "indigo" && "bg-indigo-500/20 text-indigo-400",
                                                channel.color === "blue" && "bg-blue-500/20 text-blue-400",
                                                channel.color === "amber" && "bg-amber-500/20 text-amber-400",
                                                channel.color === "purple" && "bg-[#5865F2]/20 text-[#5865F2]",
                                                channel.color === "cyan" && "bg-[#0088cc]/20 text-[#0088cc]",
                                            )}>
                                                <channel.icon className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-white">{channel.label}</p>
                                                <p className="text-[10px] text-zinc-500">{channel.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                    <p className="text-[11px] text-amber-400 font-medium">
                                        <strong>Pro Tip:</strong> Configure Discord/Telegram in Settings → Alerts to receive notifications even when you're away from the app.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Settings & Configuration */}
            <div className="space-y-6">
                <div className="flex items-center gap-3 px-1">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-zinc-500/20 to-zinc-600/20">
                        <Settings className="h-5 w-5 text-zinc-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">Settings & Configuration</h2>
                        <p className="text-sm text-zinc-500">Customize your experience</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FeatureCard
                        icon={Key}
                        title="Connections"
                        description="Connect your exchange accounts and wallet addresses."
                        href="/settings?tab=connections"
                        color="indigo"
                        steps={[
                            "Add CEX API keys (Binance, Bybit, etc.)",
                            "Add wallet addresses (EVM, Solana, Bitcoin)",
                            "Enable read-only or trading permissions",
                            "Test connections to verify setup"
                        ]}
                    />

                    <FeatureCard
                        icon={Bell}
                        title="Alerts Configuration"
                        description="Set up multi-channel notifications for trading signals."
                        href="/settings?tab=alerts"
                        color="amber"
                        steps={[
                            "Enable in-app and browser notifications",
                            "Configure Discord webhook URL",
                            "Set up Telegram bot integration",
                            "Choose AI signal types to alert on"
                        ]}
                    />

                    <FeatureCard
                        icon={ChartIcon}
                        title="Chart & preferences"
                        description="Customize chart appearance and default settings."
                        href="/settings?tab=general"
                        color="purple"
                        steps={[
                            "Choose chart style (Candles, Heikin, etc.)",
                            "Set custom colors for up/down candles",
                            "Configure default indicators",
                            "Set background and theme preferences"
                        ]}
                    />
                </div>
            </div>

            {/* Discord & Telegram Setup */}
            <div className="space-y-6">
                <div className="flex items-center gap-3 px-1">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-[#5865F2]/20 to-[#0088cc]/20">
                        <MessageCircle className="h-5 w-5 text-[#5865F2]" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">External Notifications Setup</h2>
                        <p className="text-sm text-zinc-500">Never miss a trading signal</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Discord Setup */}
                    <Card className="bg-[#5865F2]/5 border-[#5865F2]/20">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <DiscordIcon className="h-5 w-5 text-[#5865F2]" />
                                Discord Webhook Setup
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                {[
                                    "Open Discord and go to your server",
                                    "Right-click the channel → Edit Channel",
                                    "Go to Integrations → Webhooks",
                                    "Click 'New Webhook' and copy the URL",
                                    "Paste the URL in Settings → Alerts → Discord",
                                    "Click 'Test Connection' to verify"
                                ].map((step, i) => (
                                    <div key={i} className="flex items-start gap-2">
                                        <span className="text-[10px] font-black bg-[#5865F2]/20 text-[#5865F2] rounded px-1.5 py-0.5 shrink-0">
                                            {i + 1}
                                        </span>
                                        <span className="text-xs text-zinc-400">{step}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Telegram Setup */}
                    <Card className="bg-[#0088cc]/5 border-[#0088cc]/20">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <TelegramIcon className="h-5 w-5 text-[#0088cc]" />
                                Telegram Bot Setup
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                {[
                                    "Open Telegram and search for @BotFather",
                                    "Send /newbot and follow the prompts",
                                    "Copy the bot token provided",
                                    "Start a chat with @userinfobot to get your Chat ID",
                                    "Enter both in Settings → Alerts → Telegram",
                                    "Click 'Test Connection' to verify"
                                ].map((step, i) => (
                                    <div key={i} className="flex items-start gap-2">
                                        <span className="text-[10px] font-black bg-[#0088cc]/20 text-[#0088cc] rounded px-1.5 py-0.5 shrink-0">
                                            {i + 1}
                                        </span>
                                        <span className="text-xs text-zinc-400">{step}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Advanced Features */}
            <div className="space-y-6">
                <div className="flex items-center gap-3 px-1">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-rose-500/20 to-orange-500/20">
                        <Shield className="h-5 w-5 text-rose-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">Advanced Features</h2>
                        <p className="text-sm text-zinc-500">Power user capabilities</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-card/30 border-border">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 rounded-xl bg-rose-500/10">
                                    <AlertTriangle className="h-5 w-5 text-rose-400" />
                                </div>
                                <h4 className="font-bold text-white">Risk Metrics</h4>
                            </div>
                            <ul className="space-y-2 text-xs text-zinc-400">
                                <li className="flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-rose-400" />
                                    Liquidation distance monitoring
                                </li>
                                <li className="flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-rose-400" />
                                    Portfolio concentration alerts
                                </li>
                                <li className="flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-rose-400" />
                                    Exposure tracking (long/short)
                                </li>
                                <li className="flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-rose-400" />
                                    Real-time margin utilization
                                </li>
                            </ul>
                        </CardContent>
                    </Card>

                    <Card className="bg-card/30 border-border">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 rounded-xl bg-amber-500/10">
                                    <Clock className="h-5 w-5 text-amber-400" />
                                </div>
                                <h4 className="font-bold text-white">Economic Calendar</h4>
                            </div>
                            <ul className="space-y-2 text-xs text-zinc-400">
                                <li className="flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-amber-400" />
                                    Real-time events from Trading Economics API
                                </li>
                                <li className="flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-amber-400" />
                                    Today & tomorrow filter, 60s auto-refresh
                                </li>
                                <li className="flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-amber-400" />
                                    Actual, Forecast, Previous values
                                </li>
                                <li className="flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-amber-400" />
                                    High/Critical impact highlighting
                                </li>
                            </ul>
                        </CardContent>
                    </Card>

                    <Card className="bg-card/30 border-border">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 rounded-xl bg-emerald-500/10">
                                    <Activity className="h-5 w-5 text-emerald-400" />
                                </div>
                                <h4 className="font-bold text-white">Real-Time Data</h4>
                            </div>
                            <ul className="space-y-2 text-xs text-zinc-400">
                                <li className="flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-emerald-400" />
                                    WebSocket price feeds
                                </li>
                                <li className="flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-emerald-400" />
                                    Live orderbook updates
                                </li>
                                <li className="flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-emerald-400" />
                                    Economic Calendar (Trading Economics, 60s refresh)
                                </li>
                                <li className="flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-emerald-400" />
                                    Global AI Feed with real-time signals
                                </li>
                            </ul>
                        </CardContent>
                    </Card>

                    <Card className="bg-card/30 border-border">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 rounded-xl bg-blue-500/10">
                                    <Lock className="h-5 w-5 text-blue-400" />
                                </div>
                                <h4 className="font-bold text-white">Security</h4>
                            </div>
                            <ul className="space-y-2 text-xs text-zinc-400">
                                <li className="flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-blue-400" />
                                    API keys encrypted at rest
                                </li>
                                <li className="flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-blue-400" />
                                    Read-only mode support
                                </li>
                                <li className="flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-blue-400" />
                                    No private key storage
                                </li>
                                <li className="flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-blue-400" />
                                    Local-first data storage
                                </li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Product Stats */}
            <Card className="bg-gradient-to-br from-trade-purple/10 to-transparent border-border">
                <CardContent className="p-8">
                    <div className="flex flex-col md:flex-row items-center gap-8">
                        <div className="flex-1 space-y-4">
                            <h3 className="text-2xl font-bold font-serif">A Unified Experience</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                Whether you're tracking spot holdings on Binance or LP positions on Uniswap, Trade Marathon® provides a singular, high-performance interface. The Overview dashboard unifies positions, orders, and the Global AI Feed. Real-time Economic Calendar and TM Screener keep you ahead of the market.
                            </p>
                            <div className="grid grid-cols-4 gap-4">
                                <Card className="bg-background/50 border-border p-3 text-center">
                                    <p className="text-[10px] font-bold uppercase text-zinc-500 mb-1">Chains</p>
                                    <p className="text-xl font-bold">50+</p>
                                </Card>
                                <Card className="bg-background/50 border-border p-3 text-center">
                                    <p className="text-[10px] font-bold uppercase text-zinc-500 mb-1">Exchanges</p>
                                    <p className="text-xl font-bold">10+</p>
                                </Card>
                                <Card className="bg-background/50 border-border p-3 text-center">
                                    <p className="text-[10px] font-bold uppercase text-zinc-500 mb-1">Tokens</p>
                                    <p className="text-xl font-bold">10K+</p>
                                </Card>
                                <Card className="bg-background/50 border-border p-3 text-center">
                                    <p className="text-[10px] font-bold uppercase text-zinc-500 mb-1">Accuracy</p>
                                    <p className="text-xl font-bold">100%</p>
                                </Card>
                            </div>
                        </div>
                        <div className="w-full md:w-1/3 flex justify-center">
                            <div className="relative">
                                <div className="absolute -inset-4 bg-trade-purple/20 blur-2xl rounded-full" />
                                <div className="relative bg-card border border-border h-48 w-48 rounded-3xl flex items-center justify-center rotate-3 shadow-2xl overflow-hidden p-6">
                                    <Image
                                        src="/trade-marathon-logo.png"
                                        alt="Trade Marathon® Logo"
                                        width={160}
                                        height={160}
                                        className="object-contain"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Footer */}
            <div className="text-center pt-8 border-t border-white/5 space-y-2">
                <p className="text-xs text-zinc-600">
                    Trade Marathon® v2.0 • Early Beta • Global AI Feed • Real-time Economic Calendar • Built with precision for serious traders
                </p>
                <p className="text-xs text-zinc-500">
                    For a full component-by-component guide, see <Link href="/how-it-works" className="text-indigo-400 hover:text-indigo-300 font-medium">How it works</Link>.
                </p>
                <p className="text-[10px] text-zinc-700">
                    © 2025 Trade Marathon®. All rights reserved. Trade Marathon® is a registered trademark.
                </p>
                <p className="text-[9px] text-zinc-800 max-w-xl mx-auto">
                    By using this software you agree to the license terms. Trading involves risk. Past performance does not guarantee future results. This software is provided &quot;AS IS&quot; without warranty of any kind.
                </p>
            </div>
        </div>
    );
}
