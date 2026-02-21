"use client";

import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { useRealtimeMarket } from "@/hooks/useRealtimeMarket";
import { useMovementAlerts } from "@/hooks/useMovementAlerts";
import { useAlerts } from "@/hooks/useAlerts";
import { normalizeSymbol } from "@/lib/utils/normalization";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { AlphaSignalExport } from "@/components/Dashboard/NeuralAlphaFeed";
import {
    getAlertsFeedSettings,
    type AlertsFeedSettings,
} from "@/lib/alertsFeedSettings";
import {
    Rss,
    Activity,
    ArrowUpCircle,
    ArrowDownCircle,
    TrendingUp,
    TrendingDown,
    BarChart3,
    Flag,
    Clock,
    Sparkles,
    ShoppingCart,
    PieChart,
    Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ComponentSettingsLink } from "@/components/ui/ComponentSettingsLink";

const STABLES = ["USDT", "USDC", "DAI", "BUSD", "TUSD", "FRAX"];
const SYMBOL_RE = /^[A-Z][A-Z0-9]{1,14}$/;

function isTrackableSymbol(symbol: string): boolean {
    const s = (symbol || "").toUpperCase().trim();
    if (!s) return false;
    if (s.startsWith("@")) return false;
    if (/^\d+$/.test(s)) return false;
    return SYMBOL_RE.test(s);
}

const NEW_ITEM_THRESHOLD_MS = 3 * 60 * 1000;

const MOVEMENT_CONFIGS: Record<
    string,
    { icon: React.ElementType; color: string; bgColor: string }
> = {
    IMMINENT_MOVEMENT: { icon: Activity, color: "text-amber-400", bgColor: "bg-amber-500/10" },
    BREAK_UP: { icon: ArrowUpCircle, color: "text-emerald-400", bgColor: "bg-emerald-500/10" },
    BREAK_DOWN: { icon: ArrowDownCircle, color: "text-rose-400", bgColor: "bg-rose-500/10" },
    GOING_UP: { icon: TrendingUp, color: "text-emerald-400", bgColor: "bg-emerald-500/10" },
    GOING_DOWN: { icon: TrendingDown, color: "text-rose-400", bgColor: "bg-rose-500/10" },
    SUDDEN_VOLUME: { icon: BarChart3, color: "text-cyan-400", bgColor: "bg-cyan-500/10" },
    EXTREME_UP: { icon: Flag, color: "text-emerald-400", bgColor: "bg-emerald-500/10" },
    EXTREME_DOWN: { icon: Flag, color: "text-rose-400", bgColor: "bg-rose-500/10" },
    WHALE_ACCUMULATION: { icon: PieChart, color: "text-indigo-400", bgColor: "bg-indigo-500/10" },
    FUTURES_INSIGHT: { icon: BarChart3, color: "text-violet-400", bgColor: "bg-violet-500/10" },
    ORDER_RECOMMENDATION: { icon: ShoppingCart, color: "text-cyan-400", bgColor: "bg-cyan-500/10" },
    ECONOMIC_EVENT: { icon: Flag, color: "text-amber-400", bgColor: "bg-amber-500/10" },
};

const MOVEMENT_TYPES = new Set<AlphaSignalExport["type"]>([
    "IMMINENT_MOVEMENT",
    "BREAK_UP",
    "BREAK_DOWN",
    "GOING_UP",
    "GOING_DOWN",
    "SUDDEN_VOLUME",
    "EXTREME_UP",
    "EXTREME_DOWN",
]);

function formatTimeAgo(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
}

function FeedItemCard({
    signal,
    isNew,
    settings,
    index,
    compact,
}: {
    signal: AlphaSignalExport;
    isNew: boolean;
    settings: AlertsFeedSettings;
    index: number;
    compact: boolean;
}) {
    const config = MOVEMENT_CONFIGS[signal.type] ?? MOVEMENT_CONFIGS.IMMINENT_MOVEMENT;
    const Icon = config.icon;

    return (
        <motion.article
            layout
            initial={settings.animateNewItems ? { opacity: 0, y: 10, filter: "blur(3px)" } : false}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -6, filter: "blur(2px)" }}
            whileHover={{ y: -2, scale: 1.003 }}
            transition={{
                duration: 0.3,
                delay: settings.animateNewItems ? Math.min(index * 0.018, 0.14) : 0,
                ease: [0.22, 1, 0.36, 1],
            }}
            className={cn(
                "group relative overflow-hidden rounded-xl border p-3",
                "border-white/10 bg-gradient-to-r from-zinc-950/92 via-zinc-900/72 to-zinc-950/90",
                "hover:border-white/20",
                signal.priority === "high" && "border-rose-500/35",
                isNew && settings.glowNewItems && "ring-1 ring-cyan-300/35",
                compact && "p-2.5"
            )}
        >
            <div
                className={cn(
                    "absolute inset-y-0 left-0 w-[2px]",
                    signal.priority === "high" ? "bg-rose-400/80" : "bg-cyan-300/45"
                )}
            />
            <motion.div
                className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100"
                transition={{ duration: 0.35 }}
                style={{
                    background:
                        "radial-gradient(120% 150% at 100% 0%, rgba(56,189,248,0.12) 0%, rgba(0,0,0,0) 58%)",
                }}
            />

            <div className="relative flex items-start gap-3">
                <div
                    className={cn(
                        "flex-shrink-0 rounded-lg border border-white/10 p-2",
                        config.bgColor,
                        config.color
                    )}
                >
                    <Icon className="h-3.5 w-3.5" />
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                        <span className={cn(
                            "truncate font-black tracking-tight text-zinc-100",
                            compact ? "text-[11px]" : "text-[12px]"
                        )}>
                            {signal.symbol}
                        </span>
                        {settings.showTimestamps && (
                            <span className="inline-flex items-center gap-1 shrink-0 text-[10px] text-zinc-500">
                                <Clock className="h-2.5 w-2.5" />
                                {formatTimeAgo(signal.timestamp)}
                            </span>
                        )}
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span
                            className={cn(
                                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider",
                                config.bgColor,
                                config.color
                            )}
                        >
                            {signal.title.replace(/_/g, " ")}
                        </span>
                        {(signal.data as { source?: string })?.source === "screener" && (
                            <span className="inline-flex items-center rounded-md border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-amber-300">
                                Screener
                            </span>
                        )}
                        {isNew && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-emerald-300">
                                <Sparkles className="h-2.5 w-2.5" />
                                New
                            </span>
                        )}
                    </div>

                    <p className={cn(
                        "mt-1.5 line-clamp-2 leading-relaxed text-zinc-400",
                        compact ? "text-[10px]" : "text-[11px]"
                    )}>
                        {signal.description}
                    </p>
                </div>
            </div>
        </motion.article>
    );
}

export function AlertsFeedWidget({ compact = false }: { compact?: boolean } = {}) {
    const { assets, positions, spotOrders } = usePortfolio();
    const [settings, setSettings] = useState(getAlertsFeedSettings);

    useEffect(() => {
        const handler = () => setSettings(getAlertsFeedSettings());
        window.addEventListener("alerts-feed-settings-changed", handler);
        return () => window.removeEventListener("alerts-feed-settings-changed", handler);
    }, []);

    const relevantSymbols = useMemo(() => {
        const fromAssets = (assets || []).map((a) => normalizeSymbol(a.symbol));
        const fromOrders = (spotOrders || []).map((o) =>
            normalizeSymbol((o as { symbol?: string })?.symbol || "")
        );
        const fromPositions = (positions || []).map((p) =>
            normalizeSymbol((p.symbol || "").replace("-PERP", ""))
        );
        return Array.from(new Set([...fromAssets, ...fromOrders, ...fromPositions])).filter(
            (s) => s && isTrackableSymbol(s) && !STABLES.includes(s.toUpperCase())
        );
    }, [assets, spotOrders, positions]);

    const { stats } = useRealtimeMarket(relevantSymbols);
    const movementSignals = useMovementAlerts(relevantSymbols, stats);
    const { signals: alertSignals } = useAlerts();

    const allSignals = useMemo((): AlphaSignalExport[] => {
        const list: AlphaSignalExport[] = [];
        const now = Date.now();
        const relevantSet = new Set(relevantSymbols.map((s) => s.toUpperCase()));

        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const minP = priorityOrder[settings.minPriority];

        if (settings.showMovementAlerts) {
            movementSignals.forEach((s) => {
                const p = priorityOrder[s.priority] ?? 1;
                if (p >= minP) list.push(s);
            });

            const typeMap: Record<string, AlphaSignalExport["type"]> = {
                breakout_up: "BREAK_UP",
                breakout_down: "BREAK_DOWN",
                trend_shift: "IMMINENT_MOVEMENT",
                squeeze: "IMMINENT_MOVEMENT",
                massive_buy: "GOING_UP",
                massive_sell: "GOING_DOWN",
            };

            (alertSignals || [])
                .slice(0, settings.movementAlertsLimit)
                .filter(
                    (s) =>
                        s &&
                        (settings.includeScreenerAlertsAllSymbols ||
                            relevantSet.has(normalizeSymbol(s.symbol).toUpperCase()))
                )
                .forEach((s) => {
                    let type = typeMap[s.type] || "IMMINENT_MOVEMENT";
                    if (s.type === "massive_buy" && s.intensity > 80) type = "EXTREME_UP";
                    if (s.type === "massive_sell" && s.intensity > 80) type = "EXTREME_DOWN";
                    list.push({
                        id: `alert-${s.id}`,
                        type,
                        symbol: normalizeSymbol(s.symbol),
                        title: type.replace(/_/g, " "),
                        description: s.message,
                        timestamp: s.timestamp,
                        priority: s.intensity > 80 ? "high" : "medium",
                        data: { confidencePercent: s.intensity, source: "screener" as const },
                    });
                });
        }

        if (settings.showAIInsights) {
            if (settings.showPortfolioAlerts) {
                const safeAssets = assets || [];
                const totalValue = safeAssets.reduce((s, a) => s + (a.valueUsd || 0), 0);
                const stableValue = safeAssets
                    .filter((a) => STABLES.includes((a.symbol || "").toUpperCase()))
                    .reduce((s, a) => s + (a.valueUsd || 0), 0);
                const stablePct = totalValue > 0 ? (stableValue / totalValue) * 100 : 0;

                if (stablePct > 80 && totalValue > 100) {
                    list.push({
                        id: "rec-diversify",
                        type: "WHALE_ACCUMULATION",
                        symbol: "USDC",
                        title: "Diversification",
                        description: `${stablePct.toFixed(0)}% in stables. Consider deploying capital for yield.`,
                        timestamp: now - 300000,
                        priority: "medium",
                        data: {},
                    });
                }
            }

            if (settings.showPortfolioAlerts && (positions as any[]).length > 0) {
                (positions as any[]).slice(0, 3).forEach((pos, i) => {
                    const pnl = pos.pnl || 0;
                    const pnlPct =
                        pos.entryPrice > 0
                            ? (pnl / (Math.abs(pos.size) * pos.entryPrice)) * 100
                            : 0;
                    const isProfit = pnl >= 0;
                    const sign = isProfit ? "+" : "";
                    list.push({
                        id: `fut-${pos.symbol}-${i}`,
                        type: "FUTURES_INSIGHT",
                        symbol: (pos.symbol || "").replace("-PERP", ""),
                        title: `${(pos.side || "LONG").toUpperCase()} ${pos.leverage || 1}x`,
                        description: isProfit
                            ? `${sign}$${pnl.toFixed(2)} (+${pnlPct.toFixed(1)}%). Consider trailing stop.`
                            : `$${pnl.toFixed(2)} (${pnlPct.toFixed(1)}%). Monitor liquidation risk.`,
                        timestamp: now - (i + 1) * 60000,
                        priority: Math.abs(pnlPct) > 30 ? "high" : "medium",
                        data: { pnlPercent: pnlPct, pnlUsd: pnl },
                    });
                });
            }

            if (settings.showOrderRecommendations && (spotOrders || []).length > 0) {
                const spotOnly = (spotOrders || []).filter((o: any) => {
                    if (o.isPerp) return false;
                    const s = (o.symbol || "").toUpperCase();
                    return !s.includes("PERP") && !s.includes("-SWAP");
                });
                spotOnly.slice(0, 2).forEach((o: any, i: number) => {
                    const sym = normalizeSymbol((o.symbol || "").replace(/USDT|USDC$/i, ""));
                    list.push({
                        id: `order-${o.id || i}`,
                        type: "ORDER_RECOMMENDATION",
                        symbol: sym,
                        title: `${(o.side || "buy").toUpperCase()} @ $${(o.price || 0).toLocaleString()}`,
                        description: `${(o.amount || 0).toLocaleString()} ${sym} limit order awaiting fill.`,
                        timestamp: o.timestamp || now - 600000,
                        priority: "low",
                        data: { limitPrice: o.price, amount: o.amount },
                    });
                });
            }
        }

        const cap = compact ? Math.min(settings.maxItems, 6) : settings.maxItems;
        return list
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, cap);
    }, [
        movementSignals,
        alertSignals,
        relevantSymbols,
        assets,
        positions,
        spotOrders,
        settings,
        compact,
    ]);

    const now = Date.now();
    const highPriorityCount = allSignals.filter((signal) => signal.priority === "high").length;
    const freshCount = allSignals.filter((signal) => now - signal.timestamp < NEW_ITEM_THRESHOLD_MS).length;
    const movementCount = allSignals.filter((signal) => MOVEMENT_TYPES.has(signal.type)).length;
    const aiCount = allSignals.length - movementCount;

    return (
        <Card className={cn(
            "relative isolate flex w-full flex-col overflow-hidden rounded-2xl border-white/10 bg-gradient-to-br from-zinc-950/95 via-zinc-950/84 to-zinc-900/90 hover:border-cyan-400/30",
            compact ? "min-h-[290px]" : "min-h-[360px]"
        )}>
            <motion.div
                className="pointer-events-none absolute -left-16 top-[-2.5rem] h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl"
                animate={{ opacity: [0.14, 0.4, 0.16], x: [0, 18, 0], y: [0, 12, 0] }}
                transition={{ duration: 8.5, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
                className="pointer-events-none absolute right-[-4rem] top-0 h-44 w-44 rounded-full bg-indigo-500/10 blur-3xl"
                animate={{ opacity: [0.12, 0.34, 0.12], x: [0, -14, 0], y: [0, 10, 0] }}
                transition={{ duration: 9.5, repeat: Infinity, ease: "easeInOut" }}
            />

            <ComponentSettingsLink tab="alerts" corner="top-right" title="Open Alert settings" size="xs" />

            <CardHeader className={cn(
                "relative z-10 border-b border-white/10 bg-gradient-to-r from-cyan-500/[0.08] via-transparent to-transparent",
                compact ? "px-3.5 py-2.5" : "px-4 py-3.5"
            )}>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="relative rounded-xl border border-cyan-400/25 bg-cyan-500/10 p-2">
                            <Rss className="h-4 w-4 text-cyan-300" />
                            <motion.div
                                className="absolute inset-0 rounded-xl bg-cyan-300/15"
                                animate={{ opacity: [0.12, 0.38, 0.12] }}
                                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                            />
                        </div>
                        <div>
                            <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-300">
                                Alerts Feed
                            </CardTitle>
                            <p className={cn("mt-0.5 text-zinc-500", compact ? "text-[9px]" : "text-[10px]")}>
                                AI insights + movement context in one stream
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] font-black text-zinc-300">{allSignals.length}</span>
                        <span className="text-[9px] uppercase tracking-wider text-zinc-500">active items</span>
                    </div>
                </div>

                <div className={cn("flex flex-wrap items-center gap-1.5", compact ? "mt-2" : "mt-3")}>
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-zinc-400">
                        <Brain className="h-2.5 w-2.5" />
                        {aiCount} AI
                    </span>
                    <span className="inline-flex items-center rounded-full border border-cyan-400/25 bg-cyan-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-cyan-300">
                        {movementCount} movement
                    </span>
                    <span className="inline-flex items-center rounded-full border border-rose-400/25 bg-rose-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-rose-300">
                        {highPriorityCount} high-priority
                    </span>
                    <span className="inline-flex items-center rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-300">
                        {freshCount} fresh
                    </span>
                </div>
            </CardHeader>

            <CardContent className={cn(
                "relative z-10 flex min-h-0 flex-1 flex-col",
                compact ? "p-3" : "p-4"
            )}>
                {!settings.enabled ? (
                    <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
                        <p className="text-[11px] font-semibold text-zinc-400">Alerts feed is disabled</p>
                        <p className="mt-1 text-[10px] text-zinc-600">Enable in Settings → Alerts</p>
                    </div>
                ) : allSignals.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
                        <Sparkles className="mb-2 h-6 w-6 text-zinc-600" />
                        <p className="text-[11px] font-semibold text-zinc-400">No alerts yet</p>
                        <p className="mt-1 text-[10px] text-zinc-600">
                            The stream will populate as market and portfolio conditions change
                        </p>
                    </div>
                ) : (
                    <div className={cn(
                        "flex min-h-0 flex-1 flex-col overflow-y-auto pr-1",
                        compact ? "gap-1.5" : "gap-2"
                    )}>
                        <AnimatePresence mode="popLayout">
                            {allSignals.map((signal, index) => (
                                <FeedItemCard
                                    key={signal.id}
                                    signal={signal}
                                    isNew={now - signal.timestamp < NEW_ITEM_THRESHOLD_MS}
                                    settings={settings}
                                    index={index}
                                    compact={compact}
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
