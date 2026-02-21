"use client";

import { Card, CardContent } from "@/components/ui/card";
import { PortfolioAsset } from "@/lib/api/types";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { motion } from "framer-motion";
import { ShieldCheck, Lock, Unlock, Zap, Landmark, ArrowUpRight, BarChart3, PieChart, Activity, Layers, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { cn, formatCurrency } from "@/lib/utils";

interface StablecoinDeepDiveProps {
    assets: PortfolioAsset[];
}

const STABLES = ['USDT', 'USDC', 'DAI', 'USDE', 'FDUSD', 'BUSD', 'TUSD', 'PYUSD'];
const RING_RADIUS = 86;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;
const RING_CENTER = 110;

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export function StablecoinDeepDive({ assets: assetsProp }: StablecoinDeepDiveProps) {
    const { spotOrders, loading, connections, positions } = usePortfolio();
    const assets = useMemo(() => (Array.isArray(assetsProp) ? assetsProp : []), [assetsProp]);
    const safeSpotOrders = useMemo(() => (Array.isArray(spotOrders) ? spotOrders : []), [spotOrders]);
    const safeConnections = useMemo(() => (Array.isArray(connections) ? connections : []), [connections]);
    const safePositions = useMemo(() => (Array.isArray(positions) ? positions : []), [positions]);

    const analysis = useMemo(() => {
        let spotAvailable = 0;
        let perpMargin = 0;
        let lockedInOrders = 0;
        const assetBreakdown: Record<string, number> = {};

        // 1. Calculate Spot vs Perp from Breakdown
        assets.forEach((asset) => {
            if (STABLES.includes(asset.symbol)) {
                assetBreakdown[asset.symbol] = (assetBreakdown[asset.symbol] || 0) + asset.valueUsd;

                if (asset.breakdown) {
                    Object.entries(asset.breakdown).forEach(([key, bal]) => {
                        const val = bal * (asset.price || 1);
                        if (key.endsWith('::Perp')) {
                            perpMargin += val;
                        } else {
                            // Everything else is considered "Spot Available" unless locked
                            spotAvailable += val;
                        }
                    });
                }
            }
        });

        // 2. Calculate Locked in Orders
        safeSpotOrders.forEach((o: any) => {
            if (o.side === 'buy' && (String(o.symbol || '').endsWith('USDT') || String(o.symbol || '').endsWith('USDC') || String(o.symbol || '').endsWith('USD'))) {
                lockedInOrders += (parseFloat(String(o.price)) * parseFloat(String(o.remainingSize || o.amount || 0)));
            }
        });

        // Fallback: if no explicit ::Perp breakdown is present, estimate margin from open perp positions.
        if (perpMargin <= 0 && safePositions.length > 0) {
            perpMargin = safePositions.reduce((sum, p) => {
                const mark = Math.abs(Number(p.markPrice || p.entryPrice || 0));
                const size = Math.abs(Number(p.size || 0));
                const lev = Math.max(1, Number(p.leverage || 1));
                const notional = size * mark;
                return sum + (notional > 0 ? notional / lev : 0);
            }, 0);
        }

        // Net Spot Available is what's left after orders
        const netSpotAvailable = Math.max(0, spotAvailable - lockedInOrders);
        const total = netSpotAvailable + perpMargin + lockedInOrders;
        const assetBreakdownSorted = Object.entries(assetBreakdown).sort((a, b) => b[1] - a[1]);
        const topStable = assetBreakdownSorted[0];
        const topStableValue = topStable?.[1] || 0;
        const topStablePct = total > 0 ? (topStableValue / total) * 100 : 0;
        const diversificationHhi = total > 0
            ? assetBreakdownSorted.reduce((sum, [, v]) => {
                const weight = v / total;
                return sum + weight * weight;
            }, 0)
            : 0;
        const diversificationScore = clamp(Math.round((1 - diversificationHhi) * 100), 0, 100);
        const utilizationPct = total > 0 ? ((perpMargin + lockedInOrders) / total) * 100 : 0;
        const reserveHealth = clamp(
            Math.round(
                ((total > 0 ? (netSpotAvailable / total) * 100 : 0) * 0.58) +
                ((100 - (total > 0 ? (lockedInOrders / total) * 100 : 0)) * 0.22) +
                (diversificationScore * 0.20)
            ),
            0,
            100
        );
        const activeConnections = safeConnections.filter((c) => c.enabled !== false);
        const cexConnectionCount = activeConnections.filter((c) => ['binance', 'bybit', 'hyperliquid', 'okx'].includes(c.type)).length;
        const chainSpread = new Set(activeConnections.filter((c) => !!c.chain).map((c) => c.chain)).size;
        const stabilityBand =
            reserveHealth >= 80 ? "Fortified" :
                reserveHealth >= 65 ? "Balanced" :
                    reserveHealth >= 45 ? "Tight" : "Fragile";

        return {
            total,
            spotAvailable: netSpotAvailable,
            perpMargin,
            lockedInOrders,
            assetBreakdown: assetBreakdownSorted,
            pcts: {
                spot: total > 0 ? (netSpotAvailable / total) * 100 : 0,
                perp: total > 0 ? (perpMargin / total) * 100 : 0,
                locked: total > 0 ? (lockedInOrders / total) * 100 : 0
            },
            topStableSymbol: topStable?.[0] || "N/A",
            topStablePct,
            diversificationScore,
            utilizationPct,
            reserveHealth,
            activeConnectionCount: activeConnections.length,
            cexConnectionCount,
            chainSpread,
            stabilityBand
        };
    }, [assets, safeSpotOrders, safePositions, safeConnections]);

    if (loading || analysis.total === 0) return null;

    const segments = [
        {
            key: "spot",
            label: "Deployable Spot",
            value: analysis.spotAvailable,
            pct: analysis.pcts.spot,
            icon: Unlock,
            stroke: "#10b981",
            accent: "text-emerald-300",
            bar: "from-emerald-400 to-teal-500",
            badge: "Ready"
        },
        {
            key: "perp",
            label: "Perp Collateral",
            value: analysis.perpMargin,
            pct: analysis.pcts.perp,
            icon: Zap,
            stroke: "#818cf8",
            accent: "text-indigo-300",
            bar: "from-indigo-400 to-violet-500",
            badge: "Margin"
        },
        {
            key: "locked",
            label: "Order Reserve",
            value: analysis.lockedInOrders,
            pct: analysis.pcts.locked,
            icon: Lock,
            stroke: "#f59e0b",
            accent: "text-amber-300",
            bar: "from-amber-400 to-orange-500",
            badge: "Locked"
        }
    ] as const;

    let cumulative = 0;
    const ringSegments = segments.map((segment) => {
        const length = (RING_CIRC * Math.max(0, segment.pct)) / 100;
        const ringSegment = {
            ...segment,
            dasharray: `${Math.max(length, 0.01)} ${RING_CIRC}`,
            dashoffset: -cumulative
        };
        cumulative += length;
        return ringSegment;
    });

    const healthTone =
        analysis.reserveHealth >= 80 ? "text-emerald-300" :
            analysis.reserveHealth >= 65 ? "text-cyan-300" :
                analysis.reserveHealth >= 45 ? "text-amber-300" : "text-rose-300";

    return (
        <Card className="relative overflow-hidden border-white/10 bg-[radial-gradient(120%_100%_at_0%_0%,rgba(16,185,129,0.08),rgba(15,23,42,0.82)_42%,rgba(2,6,23,0.92)_100%)] clone-wallet-card clone-noise">
            <motion.div
                className="pointer-events-none absolute -left-20 -top-24 h-48 w-48 rounded-full bg-emerald-500/15 blur-3xl"
                animate={{ x: [0, 22, 0], y: [0, -10, 0], opacity: [0.45, 0.75, 0.45] }}
                transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
                className="pointer-events-none absolute -right-24 bottom-[-5rem] h-56 w-56 rounded-full bg-indigo-500/12 blur-3xl"
                animate={{ x: [0, -20, 0], y: [0, 12, 0], opacity: [0.3, 0.55, 0.3] }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
                className="pointer-events-none absolute inset-y-0 left-[-35%] w-[35%] bg-gradient-to-r from-transparent via-white/10 to-transparent"
                animate={{ x: ["0%", "320%"] }}
                transition={{ duration: 4.6, repeat: Infinity, ease: "linear", repeatDelay: 1.2 }}
            />

            <CardContent className="relative p-4 md:p-5 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                        <div className="rounded-xl border border-white/15 bg-white/[0.04] p-2.5 shrink-0">
                            <ShieldCheck className="h-4.5 w-4.5 text-emerald-300" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight leading-none">Stablecoin Liquidity Command Center</h2>
                            <p className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.22em] mt-2">
                                Reserve Health: <span className={cn("ml-1", healthTone)}>{analysis.stabilityBand}</span>
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-zinc-200">
                        <PieChart className="h-3 w-3 text-cyan-300" />
                        Total {formatCurrency(analysis.total)}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-4 md:gap-5">
                    <div className="relative mx-auto lg:mx-0 h-[220px] w-[220px]">
                        <motion.div
                            className="absolute inset-4 rounded-full border border-white/10"
                            animate={{ scale: [1, 1.03, 1], opacity: [0.5, 0.8, 0.5] }}
                            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                        />
                        <svg viewBox="0 0 220 220" className="h-full w-full">
                            <g transform={`rotate(-90 ${RING_CENTER} ${RING_CENTER})`}>
                                <circle
                                    cx={RING_CENTER}
                                    cy={RING_CENTER}
                                    r={RING_RADIUS}
                                    stroke="rgba(148, 163, 184, 0.16)"
                                    strokeWidth="18"
                                    fill="none"
                                />
                                {ringSegments.map((segment, index) => (
                                    <motion.circle
                                        key={segment.key}
                                        cx={RING_CENTER}
                                        cy={RING_CENTER}
                                        r={RING_RADIUS}
                                        stroke={segment.stroke}
                                        strokeWidth="18"
                                        strokeLinecap="round"
                                        fill="none"
                                        strokeDashoffset={segment.dashoffset}
                                        initial={{ strokeDasharray: `0 ${RING_CIRC}`, opacity: 0.6 }}
                                        animate={{ strokeDasharray: segment.dasharray, opacity: 1 }}
                                        transition={{ duration: 1.15, delay: 0.2 + index * 0.22, ease: [0.16, 1, 0.3, 1] }}
                                    />
                                ))}
                            </g>
                        </svg>

                        <div className="absolute inset-0 flex items-center justify-center">
                            <motion.div
                                className="rounded-full border border-white/10 bg-black/45 px-5 py-4 text-center backdrop-blur-sm"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.7, delay: 0.55 }}
                            >
                                <Landmark className="mx-auto h-5 w-5 text-emerald-300" />
                                <div className="mt-1 text-4xl font-black leading-none text-white">{Math.round(analysis.pcts.spot)}%</div>
                                <div className="mt-1 text-[9px] font-black uppercase tracking-[0.22em] text-zinc-400">Deployable</div>
                                <div className={cn("mt-2 text-[10px] font-black", healthTone)}>Health {analysis.reserveHealth}</div>
                            </motion.div>
                        </div>
                    </div>

                    <div className="min-w-0 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {segments.map((segment, index) => {
                                const Icon = segment.icon;
                                return (
                                    <motion.div
                                        key={segment.key}
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.25 + index * 0.09, duration: 0.45 }}
                                        whileHover={{ y: -3, scale: 1.01 }}
                                        className="rounded-xl border border-white/10 bg-black/20 p-3 backdrop-blur-sm"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="inline-flex items-center gap-1.5 min-w-0">
                                                <div className="rounded-md bg-white/5 p-1">
                                                    <Icon className={cn("h-3.5 w-3.5", segment.accent)} />
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-wide text-zinc-300 truncate">{segment.label}</span>
                                            </div>
                                            <span className={cn("text-[9px] font-black uppercase", segment.accent)}>{segment.badge}</span>
                                        </div>

                                        <div className="mt-2.5 flex items-baseline justify-between gap-2 min-w-0">
                                            <div className="text-lg font-black text-white truncate">{formatCurrency(segment.value)}</div>
                                            <div className="text-[10px] font-black text-zinc-400">{segment.pct.toFixed(1)}%</div>
                                        </div>

                                        <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-900/70 overflow-hidden">
                                            <motion.div
                                                className={cn("h-full rounded-full bg-gradient-to-r", segment.bar)}
                                                initial={{ width: 0 }}
                                                animate={{ width: `${segment.pct}%` }}
                                                transition={{ duration: 1.05, delay: 0.4 + index * 0.1, ease: "easeOut" }}
                                            />
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5, duration: 0.45 }}
                                className="rounded-xl border border-white/10 bg-black/25 p-3"
                            >
                                <div className="flex items-center gap-1.5 text-zinc-400">
                                    <BarChart3 className="h-3.5 w-3.5" />
                                    <span className="text-[10px] font-black uppercase tracking-wider">Reserve Health</span>
                                </div>
                                <div className={cn("mt-2 text-2xl font-black leading-none", healthTone)}>{analysis.reserveHealth}</div>
                                <div className="mt-1 text-[10px] text-zinc-500">{analysis.stabilityBand} liquidity posture</div>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.58, duration: 0.45 }}
                                className="rounded-xl border border-white/10 bg-black/25 p-3"
                            >
                                <div className="flex items-center gap-1.5 text-zinc-400">
                                    <Activity className="h-3.5 w-3.5" />
                                    <span className="text-[10px] font-black uppercase tracking-wider">Utilization</span>
                                </div>
                                <div className="mt-2 text-2xl font-black leading-none text-cyan-300">{analysis.utilizationPct.toFixed(1)}%</div>
                                <div className="mt-1 text-[10px] text-zinc-500">Collateral + reserves in use</div>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.66, duration: 0.45 }}
                                className="rounded-xl border border-white/10 bg-black/25 p-3"
                            >
                                <div className="flex items-center gap-1.5 text-zinc-400">
                                    <Layers className="h-3.5 w-3.5" />
                                    <span className="text-[10px] font-black uppercase tracking-wider">Venue Spread</span>
                                </div>
                                <div className="mt-2 text-2xl font-black leading-none text-indigo-300">{analysis.activeConnectionCount}</div>
                                <div className="mt-1 text-[10px] text-zinc-500">{analysis.cexConnectionCount} CEX | {analysis.chainSpread} chains</div>
                            </motion.div>
                        </div>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.72 }}
                            className="rounded-xl border border-white/10 bg-black/25 p-3"
                        >
                            <div className="mb-2 flex items-center justify-between">
                                <div className="inline-flex items-center gap-1.5">
                                    <TrendingUp className="h-3.5 w-3.5 text-zinc-300" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Treasury Mix</span>
                                </div>
                                <span className="text-[10px] font-black text-zinc-500">{analysis.diversificationScore} diversification</span>
                            </div>

                            <div className="space-y-2">
                                {analysis.assetBreakdown.slice(0, 5).map(([symbol, value], index) => {
                                    const pct = analysis.total > 0 ? (value / analysis.total) * 100 : 0;
                                    return (
                                        <motion.div
                                            key={symbol}
                                            initial={{ opacity: 0, x: 8 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.78 + index * 0.06, duration: 0.35 }}
                                            className="space-y-1"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-[11px] font-black text-white">{symbol}</span>
                                                <span className="text-[10px] font-bold text-zinc-400">{pct.toFixed(1)}%</span>
                                            </div>
                                            <div className="h-1.5 w-full rounded-full bg-zinc-900/70 overflow-hidden">
                                                <motion.div
                                                    className="h-full rounded-full bg-gradient-to-r from-zinc-300 to-zinc-500"
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${pct}%` }}
                                                    transition={{ duration: 0.85, delay: 0.86 + index * 0.06, ease: "easeOut" }}
                                                />
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </div>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.86, duration: 0.4 }}
                    className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 flex items-center gap-2"
                >
                    <ArrowUpRight className="h-4 w-4 text-cyan-300 shrink-0" />
                    <p className="text-[10px] font-medium leading-relaxed text-zinc-300">
                        Largest concentration is <span className="font-black text-white">{analysis.topStableSymbol}</span> at{" "}
                        <span className="font-black text-cyan-300">{analysis.topStablePct.toFixed(1)}%</span> of stable reserves.
                        Keep below 60% to reduce single-issuer risk.
                    </p>
                </motion.div>
            </CardContent>
        </Card>
    );
}
