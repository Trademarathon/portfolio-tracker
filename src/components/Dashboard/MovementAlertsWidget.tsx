"use client";

import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRealtimeMarket } from "@/hooks/useRealtimeMarket";
import { useMovementAlerts } from "@/hooks/useMovementAlerts";
import { useAlerts } from "@/hooks/useAlerts";
import { normalizeSymbol } from "@/lib/utils/normalization";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { AlphaSignalExport } from "@/components/Dashboard/NeuralAlphaFeed";
import { getMovementAlertsSettings } from "@/lib/movementAlertsSettings";
import {
    Activity,
    ArrowUpCircle,
    ArrowDownCircle,
    TrendingUp,
    TrendingDown,
    BarChart3,
    Flag,
    Clock,
    Zap,
    Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ComponentSettingsLink } from "@/components/ui/ComponentSettingsLink";

const STABLES = ["USDT", "USDC", "DAI", "BUSD", "TUSD", "FRAX"];
const SYMBOL_RE = /^[A-Z][A-Z0-9]{1,14}$/;
const WATCHLIST_FAVORITES_KEY = "watchlist_favorites";

function isTrackableSymbol(symbol: string): boolean {
    const s = (symbol || "").toUpperCase().trim();
    if (!s) return false;
    if (s.startsWith("@")) return false;
    if (/^\d+$/.test(s)) return false;
    return SYMBOL_RE.test(s);
}

const NEW_ALERT_THRESHOLD_MS = 2 * 60 * 1000;

const MOVEMENT_CONFIGS: Record<
    string,
    { icon: React.ElementType; color: string; bgColor: string; glowColor: string }
> = {
    IMMINENT_MOVEMENT: {
        icon: Activity,
        color: "text-amber-400",
        bgColor: "bg-amber-500/10",
        glowColor: "shadow-amber-400/40",
    },
    BREAK_UP: {
        icon: ArrowUpCircle,
        color: "text-emerald-400",
        bgColor: "bg-emerald-500/10",
        glowColor: "shadow-emerald-400/50",
    },
    BREAK_DOWN: {
        icon: ArrowDownCircle,
        color: "text-rose-400",
        bgColor: "bg-rose-500/10",
        glowColor: "shadow-rose-400/50",
    },
    GOING_UP: {
        icon: TrendingUp,
        color: "text-emerald-400",
        bgColor: "bg-emerald-500/10",
        glowColor: "shadow-emerald-400/40",
    },
    GOING_DOWN: {
        icon: TrendingDown,
        color: "text-rose-400",
        bgColor: "bg-rose-500/10",
        glowColor: "shadow-rose-400/40",
    },
    SUDDEN_VOLUME: {
        icon: BarChart3,
        color: "text-cyan-400",
        bgColor: "bg-cyan-500/10",
        glowColor: "shadow-cyan-400/40",
    },
    EXTREME_UP: {
        icon: Flag,
        color: "text-emerald-400",
        bgColor: "bg-emerald-500/10",
        glowColor: "shadow-emerald-400/50",
    },
    EXTREME_DOWN: {
        icon: Flag,
        color: "text-rose-400",
        bgColor: "bg-rose-500/10",
        glowColor: "shadow-rose-400/50",
    },
};

function formatTimeAgo(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
}

function AlertCard({
    signal,
    isNew,
    glowEnabled,
    animateEnabled,
    index,
    compact,
}: {
    signal: AlphaSignalExport;
    isNew: boolean;
    glowEnabled: boolean;
    animateEnabled: boolean;
    index: number;
    compact: boolean;
}) {
    const config = MOVEMENT_CONFIGS[signal.type] ?? MOVEMENT_CONFIGS.IMMINENT_MOVEMENT;
    const Icon = config.icon;

    return (
        <motion.article
            layout
            initial={animateEnabled ? { opacity: 0, y: 12, filter: "blur(4px)" } : false}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(2px)" }}
            whileHover={{ y: -2, scale: 1.004 }}
            transition={{
                duration: 0.35,
                delay: animateEnabled ? Math.min(index * 0.02, 0.16) : 0,
                ease: [0.22, 1, 0.36, 1],
            }}
            className={cn(
                "group relative overflow-hidden rounded-xl border p-3 transition-all duration-300",
                "bg-gradient-to-r from-zinc-950/90 via-zinc-900/70 to-zinc-950/80 border-white/10 hover:border-white/20",
                signal.priority === "high" && "border-rose-500/35 shadow-[0_0_35px_-18px_rgba(251,113,133,0.45)]",
                isNew && glowEnabled && "ring-1 ring-amber-300/35 shadow-[0_0_42px_-22px_rgba(251,191,36,0.45)]",
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
                        "radial-gradient(90% 140% at 0% 0%, rgba(34,211,238,0.1) 0%, rgba(0,0,0,0) 55%)",
                }}
            />

            <div className="relative flex items-start gap-3">
                <div
                    className={cn(
                        "relative flex-shrink-0 rounded-xl border p-2 shadow-inner transition-all",
                        config.bgColor,
                        config.color,
                        "border-white/10",
                        isNew && glowEnabled && config.glowColor
                    )}
                >
                    <Icon className="h-3.5 w-3.5" />
                    {isNew && glowEnabled && (
                        <motion.div
                            className={cn("absolute inset-0 rounded-xl blur-md", config.bgColor)}
                            animate={{ opacity: [0.18, 0.45, 0.18] }}
                            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                        />
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <span className={cn(
                            "font-black tracking-tight text-zinc-100",
                            compact ? "text-xs" : "text-sm"
                        )}>
                            {signal.symbol}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500">
                            <Clock className="h-2.5 w-2.5" />
                            {formatTimeAgo(signal.timestamp)}
                        </span>
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
                        {signal.data?.confidencePercent != null && (
                            <span className="inline-flex items-center rounded-md border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-black text-amber-300">
                                {signal.data.confidencePercent}% confidence
                            </span>
                        )}
                        {isNew && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-black text-emerald-300">
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

export function MovementAlertsWidget({ compact = false }: { compact?: boolean } = {}) {
    const [settings, setSettings] = useState(getMovementAlertsSettings);
    const [favoriteSymbols, setFavoriteSymbols] = useState<string[]>([]);

    useEffect(() => {
        const readFavorites = () => {
            try {
                const raw = localStorage.getItem(WATCHLIST_FAVORITES_KEY);
                if (!raw) {
                    setFavoriteSymbols([]);
                    return;
                }
                const parsed = JSON.parse(raw) as unknown;
                if (!Array.isArray(parsed)) {
                    setFavoriteSymbols([]);
                    return;
                }
                const symbols = Array.from(
                    new Set(
                        parsed
                            .filter((v): v is string => typeof v === "string")
                            .map((key) => normalizeSymbol(String(key).split("-")[0] || ""))
                            .filter((s) => s && isTrackableSymbol(s) && !STABLES.includes(s.toUpperCase()))
                    )
                );
                setFavoriteSymbols(symbols);
            } catch {
                setFavoriteSymbols([]);
            }
        };

        readFavorites();
        window.addEventListener("watchlist-favorites-changed", readFavorites);
        window.addEventListener("storage", readFavorites);
        return () => {
            window.removeEventListener("watchlist-favorites-changed", readFavorites);
            window.removeEventListener("storage", readFavorites);
        };
    }, []);

    useEffect(() => {
        const handler = () => setSettings(getMovementAlertsSettings());
        window.addEventListener("movement-alerts-settings-changed", handler);
        return () => window.removeEventListener("movement-alerts-settings-changed", handler);
    }, []);

    const relevantSymbols = useMemo(() => favoriteSymbols, [favoriteSymbols]);

    const { stats } = useRealtimeMarket(relevantSymbols);
    const movementSignals = useMovementAlerts(relevantSymbols, stats);
    const { signals: alertSignals } = useAlerts();

    const allSignals = useMemo((): AlphaSignalExport[] => {
        const list: AlphaSignalExport[] = [...movementSignals];
        const relevantSet = new Set(relevantSymbols.map((s) => s.toUpperCase()));

        const typeMap: Record<string, AlphaSignalExport["type"]> = {
            breakout_up: "BREAK_UP",
            breakout_down: "BREAK_DOWN",
            trend_shift: "IMMINENT_MOVEMENT",
            squeeze: "IMMINENT_MOVEMENT",
            massive_buy: "GOING_UP",
            massive_sell: "GOING_DOWN",
        };

        (alertSignals || [])
            .slice(0, 5)
            .filter((s) => s)
            .forEach((s) => {
                const sym = normalizeSymbol(s.symbol);
                if (!relevantSet.has(sym.toUpperCase())) return;
                let type = typeMap[s.type] || "IMMINENT_MOVEMENT";
                if (s.type === "massive_buy" && s.intensity > 80) type = "EXTREME_UP";
                if (s.type === "massive_sell" && s.intensity > 80) type = "EXTREME_DOWN";
                list.push({
                    id: `alert-${s.id}`,
                    type,
                    symbol: sym,
                    title: type.replace(/_/g, " "),
                    description: s.message,
                    timestamp: s.timestamp,
                    priority: s.intensity > 80 ? "high" : "medium",
                    data: { confidencePercent: s.intensity },
                });
            });

        const cap = compact ? Math.min(settings.maxAlertsShown, 6) : settings.maxAlertsShown;
        return list.sort((a, b) => b.timestamp - a.timestamp).slice(0, cap);
    }, [movementSignals, alertSignals, relevantSymbols, settings.maxAlertsShown, compact]);

    const now = Date.now();
    const highPriorityCount = allSignals.filter((signal) => signal.priority === "high").length;
    const freshCount = allSignals.filter((signal) => now - signal.timestamp < NEW_ALERT_THRESHOLD_MS).length;

    return (
        <Card className={cn(
            "relative isolate flex w-full flex-col overflow-hidden rounded-2xl border-white/10 bg-gradient-to-br from-zinc-950/95 via-zinc-950/85 to-zinc-900/90 hover:border-amber-400/30",
            compact ? "min-h-[290px]" : "min-h-[360px]"
        )}>
            <motion.div
                className="pointer-events-none absolute -left-16 -top-10 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl"
                animate={{ opacity: [0.18, 0.45, 0.2], x: [0, 16, 0], y: [0, 8, 0] }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
                className="pointer-events-none absolute right-[-3.5rem] top-[-2rem] h-48 w-48 rounded-full bg-orange-500/10 blur-3xl"
                animate={{ opacity: [0.12, 0.35, 0.12], x: [0, -14, 0], y: [0, 10, 0] }}
                transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
            />

            <ComponentSettingsLink tab="alerts" corner="top-right" title="Open Alert settings" size="xs" />

            <CardHeader className={cn(
                "relative z-10 border-b border-white/10 bg-gradient-to-r from-amber-500/[0.08] via-transparent to-transparent",
                compact ? "px-3.5 py-2.5" : "px-4 py-3.5"
            )}>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="relative rounded-xl border border-amber-400/25 bg-amber-500/10 p-2">
                            <Zap className="h-4 w-4 text-amber-300" />
                            <motion.div
                                className="absolute inset-0 rounded-xl bg-amber-300/15"
                                animate={{ opacity: [0.12, 0.38, 0.12] }}
                                transition={{ duration: 2.1, repeat: Infinity, ease: "easeInOut" }}
                            />
                        </div>
                        <div>
                            <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-300">
                                Live Movement Alerts
                            </CardTitle>
                            <p className={cn("mt-0.5 text-zinc-500", compact ? "text-[9px]" : "text-[10px]")}>
                                Momentum engine focused on tracked symbols
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] font-black text-zinc-300">
                            {allSignals.length}/{settings.maxAlertsShown}
                        </span>
                        <span className="text-[9px] uppercase tracking-wider text-zinc-500">
                            {relevantSymbols.length} symbols
                        </span>
                    </div>
                </div>

                <div className={cn("flex flex-wrap items-center gap-1.5", compact ? "mt-2" : "mt-3")}>
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-zinc-400">
                        Real-time
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
                        <p className="text-[11px] font-semibold text-zinc-400">Movement alerts are disabled</p>
                        <p className="mt-1 text-[10px] text-zinc-600">Enable in Settings → Alerts</p>
                    </div>
                ) : allSignals.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
                        <Clock className="mb-2 h-6 w-6 text-zinc-600" />
                        <p className="text-[11px] font-semibold text-zinc-400">No active movement events</p>
                        <p className="mt-1 text-[10px] text-zinc-600">
                            {relevantSymbols.length
                                ? `Watching: ${relevantSymbols.join(", ")}`
                                : "Add favorites in Markets/Screener to activate this stream"}
                        </p>
                    </div>
                ) : (
                    <div className={cn(
                        "flex min-h-0 flex-1 flex-col overflow-y-auto pr-1",
                        compact ? "gap-1.5" : "gap-2"
                    )}>
                        <AnimatePresence mode="popLayout">
                            {allSignals.map((signal, index) => (
                                <AlertCard
                                    key={signal.id}
                                    signal={signal}
                                    isNew={now - signal.timestamp < NEW_ALERT_THRESHOLD_MS}
                                    glowEnabled={settings.glowNewAlerts}
                                    animateEnabled={settings.animateNewAlerts}
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
