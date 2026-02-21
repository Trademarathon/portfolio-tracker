"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { cn, formatCurrency } from "@/lib/utils";
import { KEY_LEVEL_LABELS } from "@/lib/api/alerts";
import type { SpotPlan, PerpPlan } from "@/lib/api/session";
import type { KeyLevel } from "@/lib/api/session";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { getValueWithCloud, setValueWithCloud } from "@/lib/supabase/sync";
import { useScreenerData } from "@/hooks/useScreenerData";
import { normalizeSymbol } from "@/lib/utils/normalization";
import {
    Sparkles,
    Clock,
    Target,
    CheckCircle2,
    Calendar,
} from "lucide-react";

const PLAYBOOK_EXECUTED_ORDERS_KEY = "playbook_executed_orders";
const MAX_EXECUTED_ORDERS = 50;

type CompositeType = "daily" | "weekly" | "monthly" | "session";

interface LevelReminder {
    id: string;
    symbol: string;
    planType: "spot" | "perp";
    compositeType: CompositeType;
    daysSinceUpdate: number;
    lastSetAt: number;
}

interface ExecutedOrder {
    id: string;
    symbol: string;
    planType: "spot" | "perp";
    levelType: string;
    levelValue: number;
    price: number;
    exchange: string;
    timestamp: number;
}

interface BlockedRuleEvent {
    id: string;
    symbol: string;
    reason: string;
    mode: string;
    exchange: string;
    timestamp: number;
}

const COMPOSITE_CONFIG: Record<
    CompositeType,
    { label: string; daysThreshold: number; color: string; bgColor: string }
> = {
    daily: {
        label: "Daily Composite",
        daysThreshold: 1,
        color: "text-cyan-400",
        bgColor: "bg-cyan-500/10",
    },
    weekly: {
        label: "Weekly Composite",
        daysThreshold: 7,
        color: "text-amber-400",
        bgColor: "bg-amber-500/10",
    },
    monthly: {
        label: "Monthly Composite",
        daysThreshold: 30,
        color: "text-violet-400",
        bgColor: "bg-violet-500/10",
    },
    session: {
        label: "Session Composite",
        daysThreshold: 1,
        color: "text-emerald-400",
        bgColor: "bg-emerald-500/10",
    },
};

const DAILY_LEVELS: KeyLevel[] = ["D_VAH", "D_VAL", "D_POC"];
const WEEKLY_LEVELS: KeyLevel[] = ["W_VAH", "W_VAL", "W_POC"];
const MONTHLY_LEVELS: KeyLevel[] = ["M_VAH", "M_VAL", "M_POC"];
const SESSION_LEVELS: KeyLevel[] = ["S_VAH", "S_VAL", "S_POC"];

function hasCompositeLevels(
    keyLevels: Partial<Record<KeyLevel, number>>,
    levels: KeyLevel[]
): boolean {
    return levels.some((k) => keyLevels[k] != null && keyLevels[k]! > 0);
}

function getDaysSince(ts: number): number {
    return Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000));
}

function formatTimeAgo(ts: number): string {
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 60) return "just now";
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    const days = Math.floor(sec / 86400);
    if (days === 1) return "1 day ago";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
}

function parseExecutedOrders(raw: string | null): ExecutedOrder[] {
    if (!raw) return [];
    try {
        return JSON.parse(raw).slice(0, MAX_EXECUTED_ORDERS);
    } catch {
        return [];
    }
}

function loadExecutedOrders(): ExecutedOrder[] {
    try {
        return parseExecutedOrders(localStorage.getItem(PLAYBOOK_EXECUTED_ORDERS_KEY));
    } catch {
        return [];
    }
}

function levelLabel(levelType: string): string {
    if (levelType === "target") return "Target";
    if (levelType === "stop") return "Stop";
    if (levelType === "entry_low") return "Entry Low";
    if (levelType === "entry_high") return "Entry High";
    return (KEY_LEVEL_LABELS as Record<string, string>)[levelType] || levelType;
}

export function PlaybookDedicatedFeed({
    spotPlans,
    perpPlans,
    className,
}: {
    spotPlans: SpotPlan[];
    perpPlans: PerpPlan[];
    className?: string;
}) {
    const { user, cloudSyncEnabled } = useSupabaseAuth();
    const { assets } = usePortfolio();
    const screener = useScreenerData({ live: false, enableRestFallback: false, fetchMarkets: false });
    const [executedOrders, setExecutedOrders] = useState<ExecutedOrder[]>([]);
    const [blockedEvents, setBlockedEvents] = useState<BlockedRuleEvent[]>([]);

    const persistExecutedOrders = useCallback(
        (orders: ExecutedOrder[]) => {
            const trimmed = orders.slice(0, MAX_EXECUTED_ORDERS);
            const raw = JSON.stringify(trimmed);
            try {
                localStorage.setItem(PLAYBOOK_EXECUTED_ORDERS_KEY, raw);
            } catch {
                // ignore
            }
            if (user?.id && cloudSyncEnabled) {
                setValueWithCloud(PLAYBOOK_EXECUTED_ORDERS_KEY, raw, user.id, true).catch(() => {});
            }
        },
        [user?.id, cloudSyncEnabled]
    );

    // Load persisted executed orders on mount; when sync on, use cloud as source of truth
    useEffect(() => {
        if (user?.id && cloudSyncEnabled) {
            let cancelled = false;
            getValueWithCloud(PLAYBOOK_EXECUTED_ORDERS_KEY, user.id, true).then((raw) => {
                if (cancelled) return;
                setExecutedOrders(parseExecutedOrders(raw));
            });
            return () => {
                cancelled = true;
            };
        }
        setExecutedOrders(loadExecutedOrders());
    }, [user?.id, cloudSyncEnabled]);

    // Compute level reminders
    const reminders = useMemo(() => {
        const out: LevelReminder[] = [];

        const processPlan = (
            plan: SpotPlan | PerpPlan,
            planType: "spot" | "perp"
        ) => {
            const updatedAt = plan.updatedAt || plan.createdAt;
            const daysSince = getDaysSince(updatedAt);
            const keyLevels = plan.keyLevels || {};

            if (hasCompositeLevels(keyLevels, DAILY_LEVELS) && daysSince > 1) {
                out.push({
                    id: `${plan.id}-daily`,
                    symbol: plan.symbol,
                    planType,
                    compositeType: "daily",
                    daysSinceUpdate: daysSince,
                    lastSetAt: updatedAt,
                });
            }
            if (hasCompositeLevels(keyLevels, WEEKLY_LEVELS) && daysSince > 7) {
                out.push({
                    id: `${plan.id}-weekly`,
                    symbol: plan.symbol,
                    planType,
                    compositeType: "weekly",
                    daysSinceUpdate: daysSince,
                    lastSetAt: updatedAt,
                });
            }
            if (hasCompositeLevels(keyLevels, MONTHLY_LEVELS) && daysSince > 30) {
                out.push({
                    id: `${plan.id}-monthly`,
                    symbol: plan.symbol,
                    planType,
                    compositeType: "monthly",
                    daysSinceUpdate: daysSince,
                    lastSetAt: updatedAt,
                });
            }
            if ((plan.sessionCompositeEnabled ?? true) && hasCompositeLevels(keyLevels, SESSION_LEVELS) && daysSince > 1) {
                out.push({
                    id: `${plan.id}-session`,
                    symbol: plan.symbol,
                    planType,
                    compositeType: "session",
                    daysSinceUpdate: daysSince,
                    lastSetAt: updatedAt,
                });
            }
        };

        spotPlans.forEach((p) => processPlan(p, "spot"));
        perpPlans.forEach((p) => processPlan(p, "perp"));

        return out.sort((a, b) => a.daysSinceUpdate - b.daysSinceUpdate);
    }, [spotPlans, perpPlans]);

    const compositeTriggers = useMemo(() => {
        const out: Array<{
            id: string;
            symbol: string;
            type: CompositeType;
            levelType: string;
            levelValue: number;
            price: number;
        }> = [];
        const tolerancePct = 0.0025;
        const assetMap = new Map<string, number>();
        assets.forEach((a) => assetMap.set(a.symbol.toUpperCase(), a.price || 0));
        const screenerMap = new Map<string, number>();
        if (screener?.tickersList?.length) {
            screener.tickersList.forEach((t) => {
                const base = normalizeSymbol(t.symbol || t.base || "");
                if (!base) return;
                if (!screenerMap.has(base)) screenerMap.set(base, t.price || 0);
            });
        }
        const priceFor = (symbol: string) => assetMap.get(symbol.toUpperCase()) || screenerMap.get(normalizeSymbol(symbol)) || 0;

        const processPlan = (plan: SpotPlan | PerpPlan) => {
            const price = priceFor(plan.symbol);
            if (!price) return;
            const levels = plan.keyLevels || {};
            const checkLevels = (type: CompositeType, list: KeyLevel[]) => {
                list.forEach((lvl) => {
                    const value = (levels as Record<string, number>)[lvl];
                    if (!value) return;
                    const diff = Math.abs((price - value) / value);
                    if (diff <= tolerancePct) {
                        out.push({
                            id: `${plan.id}-${lvl}`,
                            symbol: plan.symbol,
                            type,
                            levelType: lvl,
                            levelValue: value,
                            price,
                        });
                    }
                });
            };
            if (plan.sessionCompositeEnabled ?? true) checkLevels("session", SESSION_LEVELS);
            checkLevels("daily", DAILY_LEVELS);
            checkLevels("weekly", WEEKLY_LEVELS);
            checkLevels("monthly", MONTHLY_LEVELS);
        };

        spotPlans.forEach(processPlan);
        perpPlans.forEach(processPlan);
        return out.slice(0, 8);
    }, [spotPlans, perpPlans, assets, screener?.tickersList]);

    // Subscribe to playbook events for executed orders
    useEffect(() => {
        const addOrder = (order: ExecutedOrder) => {
            setExecutedOrders((prev) => {
                const next = [order, ...prev].slice(0, MAX_EXECUTED_ORDERS);
                persistExecutedOrders(next);
                return next;
            });
        };

        const onLevelTriggered = (e: CustomEvent) => {
            const { alert, currentPrice, exchange } = e.detail || {};
            if (!alert?.symbol) return;
            const order: ExecutedOrder = {
                id: `exec-${alert.id}-${Date.now()}`,
                symbol: alert.symbol,
                planType: "spot",
                levelType: alert.levelType,
                levelValue: alert.levelValue,
                price: currentPrice ?? alert.levelValue,
                exchange: exchange || "Binance",
                timestamp: Date.now(),
            };
            addOrder(order);
        };

        const onBuyPhaseDone = (e: CustomEvent) => {
            const { progress, exchange } = e.detail || {};
            if (!progress?.symbol) return;
            const order: ExecutedOrder = {
                id: `exec-buy-${progress.planId}-${Date.now()}`,
                symbol: progress.symbol,
                planType: "spot",
                levelType: "buy_phase",
                levelValue: 0,
                price: 0,
                exchange: exchange || "Binance",
                timestamp: Date.now(),
            };
            addOrder(order);
        };

        const onPlanComplete = (e: CustomEvent) => {
            const { progress, exchange } = e.detail || {};
            if (!progress?.symbol) return;
            const order: ExecutedOrder = {
                id: `exec-complete-${progress.planId}-${Date.now()}`,
                symbol: progress.symbol,
                planType: "spot",
                levelType: "plan_complete",
                levelValue: 0,
                price: 0,
                exchange: exchange || "Binance",
                timestamp: Date.now(),
            };
            addOrder(order);
        };

        const onRuleBlocked = (e: CustomEvent) => {
            const { alert, blockedReasons, mode, exchange } = e.detail || {};
            if (!alert?.symbol || !Array.isArray(blockedReasons) || blockedReasons.length === 0) return;
            const next: BlockedRuleEvent = {
                id: `blocked-${alert.id}-${Date.now()}`,
                symbol: alert.symbol,
                reason: String(blockedReasons[0]),
                mode: String(mode || 'critical'),
                exchange: String(exchange || 'binance'),
                timestamp: Date.now(),
            };
            setBlockedEvents((prev) => [next, ...prev].slice(0, 40));
        };

        window.addEventListener("playbook-alert-triggered", onLevelTriggered as EventListener);
        window.addEventListener("playbook-buy-phase-done", onBuyPhaseDone as EventListener);
        window.addEventListener("playbook-plan-complete", onPlanComplete as EventListener);
        window.addEventListener("playbook-rule-blocked", onRuleBlocked as EventListener);
        return () => {
            window.removeEventListener("playbook-alert-triggered", onLevelTriggered as EventListener);
            window.removeEventListener("playbook-buy-phase-done", onBuyPhaseDone as EventListener);
            window.removeEventListener("playbook-plan-complete", onPlanComplete as EventListener);
            window.removeEventListener("playbook-rule-blocked", onRuleBlocked as EventListener);
        };
    }, [persistExecutedOrders]);

    const showReminders = reminders.length > 0;
    const showExecuted = executedOrders.length > 0;
    const showTriggers = compositeTriggers.length > 0;
    const showBlocked = blockedEvents.length > 0;
    const isEmpty = !showReminders && !showExecuted && !showTriggers && !showBlocked;

    return (
        <div
            className={cn(
                "rounded-xl bg-zinc-900/80 backdrop-blur-sm border border-zinc-800/50 overflow-hidden",
                className
            )}
        >
            <div className="p-3 border-b border-zinc-800/50">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10">
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="text-xs font-black text-white uppercase tracking-wider">
                            Playbook AI Feed
                        </h3>
                        <p className="text-[10px] text-zinc-500">
                            Composite triggers, reminders & executions
                        </p>
                    </div>
                </div>
            </div>

            <div className="p-2 max-h-[420px] overflow-y-auto space-y-3">
                {isEmpty && (
                    <div className="py-8 text-center text-zinc-500 text-xs">
                        <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No triggers or reminders yet.</p>
                        <p className="text-[10px] mt-1">
                            Add plans with composite levels to get weekly reminders.
                        </p>
                    </div>
                )}

                {/* Level Reminders */}
                {showReminders && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-1.5 px-1">
                            <Calendar className="w-3 h-3 text-amber-400" />
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                Update Levels
                            </span>
                        </div>
                        {reminders.map((r) => {
                            const config = COMPOSITE_CONFIG[r.compositeType];
                            return (
                                <div
                                    key={r.id}
                                    className={cn(
                                        "p-2.5 rounded-lg border",
                                        config.bgColor,
                                        "border-zinc-700/50"
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <TokenIcon
                                                symbol={r.symbol}
                                                size={20}
                                            />
                                            <div className="min-w-0">
                                                <span className="text-xs font-bold text-white block truncate">
                                                    {r.symbol}
                                                </span>
                                                <span
                                                    className={cn(
                                                        "text-[10px] font-medium",
                                                        config.color
                                                    )}
                                                >
                                                    {config.label}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] text-zinc-500 shrink-0">
                                            <Clock className="w-2.5 h-2.5" />
                                            {r.daysSinceUpdate}d ago
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-zinc-400 mt-1.5">
                                        Last set {r.daysSinceUpdate} day
                                        {r.daysSinceUpdate !== 1 ? "s" : ""}{" "}
                                        ago. Consider refreshing composite
                                        levels.
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Composite Triggers */}
                {showTriggers && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-1.5 px-1">
                            <Target className="w-3 h-3 text-emerald-400" />
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                Composite Hits
                            </span>
                        </div>
                        {compositeTriggers.map((t) => {
                            const config = COMPOSITE_CONFIG[t.type];
                            return (
                                <div
                                    key={t.id}
                                    className={cn("p-2.5 rounded-lg border", config.bgColor, "border-zinc-700/50")}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <TokenIcon symbol={t.symbol} size={18} />
                                            <div className="min-w-0">
                                                <span className="text-xs font-bold text-white block truncate">
                                                    {t.symbol}
                                                </span>
                                                <span className={cn("text-[10px] font-medium", config.color)}>
                                                    {config.label}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="text-[10px] text-zinc-500 shrink-0">
                                            {levelLabel(t.levelType)} · {formatCurrency(t.levelValue)}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-zinc-400 mt-1">
                                        Price {formatCurrency(t.price)} near composite level.
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Executed Orders */}
                {showExecuted && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-1.5 px-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                Executed at Marked Levels
                            </span>
                        </div>
                        {executedOrders.map((o) => (
                            <div
                                key={o.id}
                                className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <TokenIcon symbol={o.symbol} size={18} />
                                        <div className="min-w-0">
                                            <span className="text-xs font-bold text-white block truncate">
                                                {o.symbol}
                                            </span>
                                            <span className="text-[10px] text-emerald-400">
                                                {o.levelType === "buy_phase"
                                                    ? "All buy levels done"
                                                    : o.levelType === "plan_complete"
                                                    ? "Plan complete"
                                                    : `${levelLabel(o.levelType)} @ ${formatCurrency(o.levelValue)}`}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="text-[10px] text-zinc-500 shrink-0">
                                        {formatTimeAgo(o.timestamp)}
                                    </span>
                                </div>
                                {o.price > 0 && (
                                    <p className="text-[10px] text-zinc-400 mt-1">
                                        Executed @ {formatCurrency(o.price)}{" "}
                                        on {o.exchange}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Blocked Rule Events */}
                {showBlocked && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-1.5 px-1">
                            <Target className="w-3 h-3 text-amber-400" />
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                Blocked By Rules
                            </span>
                        </div>
                        {blockedEvents.map((event) => (
                            <div
                                key={event.id}
                                className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <TokenIcon symbol={event.symbol} size={18} />
                                        <div className="min-w-0">
                                            <span className="text-xs font-bold text-white block truncate">
                                                {event.symbol}
                                            </span>
                                            <span className="text-[10px] text-amber-400 truncate block">
                                                {event.reason}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="text-[10px] text-zinc-500 shrink-0">
                                        {formatTimeAgo(event.timestamp)}
                                    </span>
                                </div>
                                <p className="text-[10px] text-zinc-400 mt-1">
                                    Mode: {event.mode} | Exchange: {event.exchange}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
