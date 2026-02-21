"use client";

import { memo, useState, useMemo, useCallback, useRef, useEffect, type MouseEvent } from "react";
import { motion, AnimatePresence, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { useAIFeedAlerts } from "@/hooks/useAIFeedAlerts";
import { getValueWithCloud, setValueWithCloud } from "@/lib/supabase/sync";
import {
    loadMemory,
    saveMemory,
    addDismissed,
    setCooldown,
    markLastSeen,
    isSuppressed,
    cleanupMemory,
    AI_FEED_MEMORY_KEY,
    type MemoryStore,
} from "@/lib/ai-memory";
import { useSupabaseRealtimeSyncUpdate } from "@/hooks/useSupabaseRealtime";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { CryptoIcon } from "@/components/ui/CryptoIcon";
import { ShiningText } from "@/components/ui/shining-text";
import { cn, formatCurrency } from "@/lib/utils";
import { KEY_LEVEL_LABELS } from "@/lib/api/alerts";
import { calculateAssetAnalytics } from "@/lib/utils/analytics";
import { buildScoreContext, scoreSignal, dedupeSignals, type AIKind, type AISource, type ScoredSignal } from "@/lib/ai-feed/score";
import { evaluatePerpHandbookWarnings } from "@/lib/ai-feed/handbook-rules";
import { useScreenerData } from "@/hooks/useScreenerData";
import { normalizeSymbol } from "@/lib/utils/normalization";
import { 
    Sparkles, TrendingUp, TrendingDown, Clock, ArrowRight, 
    AlertTriangle, Target, Zap, ChevronDown, RefreshCw,
    Wallet, ArrowRightLeft, DollarSign, Fuel, BarChart3,
    ShoppingCart, Eye, Bell, ShieldAlert, Layers, CheckCircle2,
    Activity, ArrowUpCircle, ArrowDownCircle, Flag, X,
    FileText, BookOpen
} from "lucide-react";
import { SpotPlan, PerpPlan, KeyLevel, getSpotPlans, getPerpPlans, saveSpotPlans, savePerpPlans, SPOT_PLANS_KEY, PERP_PLANS_KEY } from "@/lib/api/session";

// Signal types for the feed
type SignalType = 
    | 'SELL_SIGNAL' 
    | 'BUY_SIGNAL' 
    | 'WHALE_ACCUMULATION' 
    | 'VOLATILITY_ALERT' 
    | 'STRUCTURE_BREAK'
    | 'ORDER_RECOMMENDATION' 
    | 'TRANSFER_INSIGHT' 
    | 'FEE_ALERT' 
    | 'AVG_PRICE_UPDATE' 
    | 'TAKE_PROFIT' 
    | 'SET_TP_ALERT' 
    | 'SET_SL_ALERT' 
    | 'DCA_LEVELS' 
    | 'PRICE_MEMORY'
    | 'PLAYBOOK_LEVEL_EXECUTED'
    | 'PLAYBOOK_PLAN_COMPLETE'
    | 'PLAYBOOK_BUY_PHASE_DONE'
    | 'ECONOMIC_EVENT'
    | 'FUTURES_INSIGHT'
    | 'TRX_ACTIVITY'
    | 'IMMINENT_MOVEMENT'
    | 'BREAK_UP'
    | 'BREAK_DOWN'
    | 'GOING_UP'
    | 'GOING_DOWN'
    | 'SUDDEN_VOLUME'
    | 'EXTREME_UP'
    | 'EXTREME_DOWN'
    | 'PLAYBOOK_PLAN_LEVELS'
    | 'JOURNAL_REMINDER'
    | 'PERP_STOPLOSS_REMINDER'
    | 'SOCIAL_MENTION'
    | 'PLAYBOOK_COMPOSITE_TRIGGER'
    | 'PLAYBOOK_VALUE_ACCEPTANCE'
    | 'LEVEL_NO_ORDER_WARNING'
    | 'PLAYBOOK_RULE_WARNING'
    | 'AI_SUMMARY';

interface AlphaSignal {
    id: string;
    type: SignalType;
    symbol: string;
    title: string;
    description: string;
    timestamp: number;
    priority: 'high' | 'medium' | 'low';
    kind?: AIKind;
    source?: AISource;
    score?: number;
    data?: {
        price?: number;
        targetPrice?: number;
        avgBuyPrice?: number;
        pnlPercent?: number;
        pnlUsd?: number;
        from?: string;
        to?: string;
        amount?: number;
        amountUsd?: number;
        fee?: number;
        feeSymbol?: string;
        chain?: string;
        txHash?: string;
        oldAvg?: number;
        newAvg?: number;
        recommendedAction?: string;
        limitPrice?: number;
        exchange?: string;
        orderSide?: 'buy' | 'sell';
        stablecoinAlloc?: number;
        stablecoinValue?: number;
        // Take Profit / Stop Loss levels
        tpLevels?: { price: number; percent: number }[];
        slLevels?: { price: number; percent: number }[];
        // DCA levels
        dcaLevels?: { price: number; percent: number; label: string }[];
        hasNoOrder?: boolean;
        holdingValue?: number;
        // Price memory data
        memoryPrice?: number;
        memoryType?: 'buy' | 'sell';
        memoryDate?: number;
        holdingBalance?: number;
        holdingEmpty?: boolean;
        aiRecommendation?: string;
        daysSinceTrade?: number;
        priceDeviation?: number;
        levelType?: string;
        levelValue?: number;
        pendingSellLevels?: { levelType: string; levelValue: number }[];
        confidencePercent?: number;
        source?: string;
        model?: string;
        // Playbook plan levels
        planType?: 'spot' | 'perp';
        entryZone?: { low: number; high: number };
        targets?: number[];
        stopLoss?: number;
        buyLimits?: number[];
        sellLimits?: number[];
        // Journal reminder
        unjournaledCount?: number;
        // Perp stop-loss reminder
        leverage?: number;
        side?: 'long' | 'short';
        entryPrice?: number;
        markPrice?: number;
        url?: string;
        author?: string;
        compositeType?: "daily" | "weekly" | "monthly" | "session" | "stacked";
        compositeLevelType?: string;
        compositeLevelValue?: number;
        valueRotationCount?: number;
        valueTestCount?: number;
        valueAcceptance?: "accepted" | "rejected" | "in_progress";
        profileContext?: {
            tpoShape?: string;
            footprint?: string;
            dom?: string;
            tape?: string;
        };
        openInterest?: number;
        trades15m?: number;
        socialMentions?: number;
        socialTop?: string;
        econEvents?: string[];
        plannedSize?: number;
        filledSize?: number;
        lastProfit?: number;
    };
}

// Signal type configurations
const SIGNAL_CONFIGS: Record<SignalType, { icon: React.ElementType; color: string; bgColor: string }> = {
    SELL_SIGNAL: { icon: TrendingDown, color: 'text-rose-400', bgColor: 'bg-rose-500/10' },
    BUY_SIGNAL: { icon: TrendingUp, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
    WHALE_ACCUMULATION: { icon: Zap, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10' },
    VOLATILITY_ALERT: { icon: AlertTriangle, color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
    STRUCTURE_BREAK: { icon: Target, color: 'text-indigo-400', bgColor: 'bg-indigo-500/10' },
    ORDER_RECOMMENDATION: { icon: ShoppingCart, color: 'text-purple-400', bgColor: 'bg-purple-500/10' },
    TRANSFER_INSIGHT: { icon: ArrowRightLeft, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
    FEE_ALERT: { icon: Fuel, color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
    AVG_PRICE_UPDATE: { icon: BarChart3, color: 'text-teal-400', bgColor: 'bg-teal-500/10' },
    TAKE_PROFIT: { icon: DollarSign, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
    SET_TP_ALERT: { icon: Bell, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
    SET_SL_ALERT: { icon: ShieldAlert, color: 'text-rose-400', bgColor: 'bg-rose-500/10' },
    DCA_LEVELS: { icon: Layers, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10' },
    PRICE_MEMORY: { icon: Clock, color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
    PLAYBOOK_LEVEL_EXECUTED: { icon: Target, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
    PLAYBOOK_PLAN_COMPLETE: { icon: CheckCircle2, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
    PLAYBOOK_BUY_PHASE_DONE: { icon: Layers, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10' },
    ECONOMIC_EVENT: { icon: DollarSign, color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
    FUTURES_INSIGHT: { icon: BarChart3, color: 'text-indigo-400', bgColor: 'bg-indigo-500/10' },
    TRX_ACTIVITY: { icon: ShoppingCart, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
    IMMINENT_MOVEMENT: { icon: Activity, color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
    BREAK_UP: { icon: ArrowUpCircle, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
    BREAK_DOWN: { icon: ArrowDownCircle, color: 'text-rose-400', bgColor: 'bg-rose-500/10' },
    GOING_UP: { icon: TrendingUp, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
    GOING_DOWN: { icon: TrendingDown, color: 'text-rose-400', bgColor: 'bg-rose-500/10' },
    SUDDEN_VOLUME: { icon: BarChart3, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10' },
    EXTREME_UP: { icon: Flag, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
    EXTREME_DOWN: { icon: Flag, color: 'text-rose-400', bgColor: 'bg-rose-500/10' },
    PLAYBOOK_PLAN_LEVELS: { icon: Layers, color: 'text-indigo-400', bgColor: 'bg-indigo-500/10' },
    JOURNAL_REMINDER: { icon: BookOpen, color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
    PERP_STOPLOSS_REMINDER: { icon: ShieldAlert, color: 'text-rose-400', bgColor: 'bg-rose-500/10' },
    SOCIAL_MENTION: { icon: FileText, color: 'text-indigo-300', bgColor: 'bg-indigo-500/10' },
    PLAYBOOK_COMPOSITE_TRIGGER: { icon: Target, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
    PLAYBOOK_VALUE_ACCEPTANCE: { icon: CheckCircle2, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
    LEVEL_NO_ORDER_WARNING: { icon: AlertTriangle, color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
    PLAYBOOK_RULE_WARNING: { icon: ShieldAlert, color: 'text-amber-300', bgColor: 'bg-amber-500/10' },
    AI_SUMMARY: { icon: Sparkles, color: 'text-cyan-300', bgColor: 'bg-cyan-500/10' },
};

const FEED_UPDATE_INTERVAL_MS = 30000;
const AI_FEED_DISMISSED_IDS_KEY = "ai_feed_dismissed_ids";
const AI_FEED_LAST_SEEN_KEY = "ai_feed_last_seen_timestamp";
const AI_FEED_TP_THRESHOLD_KEY = "ai_feed_tp_threshold_pct";
const AI_FEED_DCA_THRESHOLD_KEY = "ai_feed_dca_threshold_pct";
const AI_FEED_COMPOSITE_TRIGGER_KEY = "ai_feed_composite_triggered";
const AI_FEED_COMPOSITE_REACTION_KEY = "ai_feed_composite_reaction";
const AI_FEED_COMPOSITE_TOLERANCE_KEY = "ai_feed_composite_tolerance";
const JOURNAL_TRADES_KEY = "journal_trades";
const JOURNAL_ANNOTATIONS_KEY = "trade_journal_annotations";
const DEFAULT_COMPOSITE_TOLERANCE = 0.0025;
const UNJOURNALED_DAYS = 14;
const MAX_DISMISSED_IDS = 200;
const DEFAULT_TP_THRESHOLD_PCT = 30;
const DEFAULT_DCA_THRESHOLD_PCT = 20;

// Format time ago (stable: "Just now" for anything under 1 min to avoid flicker)
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

function formatCompactUsd(value: number): string {
    if (!Number.isFinite(value)) return "$0";
    const abs = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    if (abs >= 1_000_000_000_000) return `${sign}$${(abs / 1_000_000_000_000).toFixed(2)}T`;
    if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`;
    return `${sign}$${abs.toFixed(2)}`;
}

// Individual signal card
const SignalCard = memo(function SignalCard({
    signal,
    onDismiss,
    onSnooze,
    isNew,
    isTop,
    compact,
}: {
    signal: AlphaSignal;
    onDismiss?: (id: string) => void;
    onSnooze?: (id: string) => void;
    isNew?: boolean;
    isTop?: boolean;
    compact?: boolean;
}) {
    const config = SIGNAL_CONFIGS[signal.type];
    const Icon = config.icon;
    const [detailsOpen, setDetailsOpen] = useState(false);
    const pointerX = useMotionValue(50);
    const pointerY = useMotionValue(50);
    const smoothX = useSpring(pointerX, { stiffness: 220, damping: 26, mass: 0.35 });
    const smoothY = useSpring(pointerY, { stiffness: 220, damping: 26, mass: 0.35 });
    const spotlight = useMotionTemplate`radial-gradient(420px circle at ${smoothX}% ${smoothY}%, rgba(56, 189, 248, 0.2) 0%, rgba(56, 189, 248, 0.08) 30%, rgba(0,0,0,0) 72%)`;

    const handlePointerMove = useCallback((event: MouseEvent<HTMLElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;
        pointerX.set(Math.min(100, Math.max(0, x)));
        pointerY.set(Math.min(100, Math.max(0, y)));
    }, [pointerX, pointerY]);

    const handlePointerLeave = useCallback(() => {
        pointerX.set(50);
        pointerY.set(50);
    }, [pointerX, pointerY]);

    return (
        <motion.article
            layout
            initial={isNew ? { opacity: 0, y: 10, filter: "blur(3px)" } : false}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -6, filter: "blur(2px)" }}
            whileHover={{ y: -3, scale: 1.004 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            onMouseMove={handlePointerMove}
            onMouseLeave={handlePointerLeave}
            className={cn(
                "group relative mx-2 mb-2 cursor-pointer overflow-hidden rounded-2xl border transition-all duration-300",
                "before:pointer-events-none before:absolute before:inset-[1px] before:z-[1] before:rounded-[15px] before:content-['']",
                "before:bg-gradient-to-b before:from-white/[0.08] before:via-transparent before:to-transparent",
                compact ? "p-3" : "p-4",
                signal.priority === 'high'
                    ? "border-rose-400/35 bg-[linear-gradient(152deg,rgba(70,17,31,0.44),rgba(13,14,20,0.95))] shadow-[0_20px_40px_rgba(0,0,0,0.42)]"
                    : "border-white/12 bg-[linear-gradient(152deg,rgba(19,21,29,0.9),rgba(11,13,18,0.96))] shadow-[0_18px_36px_rgba(0,0,0,0.36)] hover:border-white/24"
            )}
        >
            <motion.div
                className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{ background: spotlight }}
            />
            <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(90%_70%_at_100%_-20%,rgba(168,85,247,0.12),transparent_60%)] opacity-60" />
            <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent opacity-70" />
            {/* Top signal badge */}
            {isTop && (signal.score || 0) > 80 && (
                <span className="absolute right-12 top-2.5 z-20 rounded-full border border-amber-400/35 bg-amber-500/14 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-amber-200">
                    Top signal
                </span>
            )}
            {/* Dismiss button */}
            {(onDismiss || onSnooze) && (
                <div className="absolute right-2.5 top-2.5 z-20 flex items-center gap-1.5 opacity-0 transition-all group-hover:opacity-100">
                    {onSnooze && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onSnooze(signal.id);
                            }}
                            className="rounded-lg border border-white/10 bg-black/35 p-1.5 text-zinc-400 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
                            title="Snooze 2h"
                            aria-label="Snooze 2h"
                        >
                            <Clock className="w-3.5 h-3.5" />
                        </button>
                    )}
                    {onDismiss && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDismiss(signal.id);
                            }}
                            className="rounded-lg border border-white/10 bg-black/35 p-1.5 text-zinc-400 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
                            title="Dismiss"
                            aria-label="Dismiss"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            )}
            {/* Priority indicator */}
            {signal.priority === 'high' && (
                <div className="absolute bottom-0 left-0 top-0 z-10 w-[3px] bg-gradient-to-b from-rose-300/95 via-rose-400 to-rose-600 shadow-[0_0_14px_rgba(244,63,94,0.75)]" />
            )}

            <div className="relative z-10 flex items-start gap-3">
                {/* Token Icon */}
                <div className="relative shrink-0">
                    <div className="rounded-xl border border-white/10 bg-black/35 p-1.5 backdrop-blur-xl">
                        <TokenIcon symbol={signal.symbol} size={compact ? 32 : 36} />
                    </div>
                    <div className={cn(
                        "absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-zinc-800 shadow-[0_4px_10px_rgba(0,0,0,0.35)]",
                        config.bgColor
                    )}>
                        <Icon className={cn("w-2.5 h-2.5", config.color)} />
                    </div>
                </div>
                
                <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <span className="text-[15px] font-black tracking-[0.01em] text-white">{signal.symbol}</span>
                            {signal.score != null && (
                                <span className="inline-flex items-center rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-black tracking-[0.12em] text-zinc-300">
                                    {Math.round(signal.score)} score
                                </span>
                            )}
                        </div>
                        <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] text-zinc-400">
                            {isNew && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                            <Clock className="w-2.5 h-2.5" />
                            {formatTimeAgo(signal.timestamp)}
                        </div>
                    </div>
                    
                    {/* Signal Type Badge */}
                    <div className={cn(
                        "mt-1.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.13em]",
                        config.bgColor, config.color
                    )}>
                        <Icon className="w-2.5 h-2.5" />
                        {signal.title}
                    </div>
                    
                    {/* Description */}
                    <p className={cn(
                        "mt-2 leading-relaxed text-zinc-300/90",
                        compact ? "line-clamp-2 text-[11px]" : "line-clamp-2 text-[11.5px]"
                    )}>
                        {signal.description}
                    </p>

                    {signal.type === 'SOCIAL_MENTION' && signal.data?.url && (
                        <div className="mt-2 flex items-center gap-2 text-[10px]">
                            <span className="text-zinc-500">{signal.data.author || "X"}</span>
                            <a
                                href={signal.data.url}
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold text-indigo-300 transition-colors hover:text-indigo-200"
                            >
                                View post
                            </a>
                        </div>
                    )}
                    
                    {/* Confidence percent (for movement alerts) */}
                    {signal.data?.confidencePercent != null && (
                        <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                            {signal.data.confidencePercent}% strength
                        </div>
                    )}
                    
                    {/* Additional Data */}
                    {signal.data && (
                        <div className="mt-2.5 space-y-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                                {signal.data.price != null && signal.data.price > 0 && (
                                    <span className="inline-flex items-center rounded-md border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold text-zinc-200">
                                        Price {formatCurrency(signal.data.price)}
                                    </span>
                                )}
                                {signal.data.pnlPercent != null && (
                                    <span
                                        className={cn(
                                            "inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-bold",
                                            signal.data.pnlPercent >= 0
                                                ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
                                                : "border-rose-400/25 bg-rose-500/10 text-rose-300"
                                        )}
                                    >
                                        {signal.data.pnlPercent >= 0 ? "+" : ""}
                                        {signal.data.pnlPercent.toFixed(1)}%
                                    </span>
                                )}
                                {signal.data.confidencePercent != null && (
                                    <span className="inline-flex items-center rounded-md border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold text-amber-300">
                                        {signal.data.confidencePercent}% confidence
                                    </span>
                                )}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setDetailsOpen((open) => !open);
                                    }}
                                    className="ml-auto inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.03] px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-200 transition-colors hover:border-white/30 hover:bg-white/[0.08]"
                                >
                                    <ChevronDown className={cn("h-2.5 w-2.5 transition-transform", detailsOpen && "rotate-180")} />
                                    {detailsOpen ? "Hide details" : "View details"}
                                </button>
                            </div>

                            <AnimatePresence initial={false}>
                                {detailsOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0, y: -4 }}
                                        animate={{ opacity: 1, height: "auto", y: 0 }}
                                        exit={{ opacity: 0, height: 0, y: -4 }}
                                        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                                        className="overflow-hidden"
                                    >
                                        <div className="space-y-1.5 rounded-xl border border-white/12 bg-black/35 p-2.5 backdrop-blur-md">
                            {/* Transfer details */}
                            {signal.type === 'TRANSFER_INSIGHT' && signal.data.from && signal.data.to && (
                                <div className="flex items-center gap-2 text-[10px]">
                                    <div className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800/50">
                                        <CryptoIcon type="exchange" id={signal.data.from.toLowerCase()} size={14} />
                                        <span className="text-zinc-300">{signal.data.from}</span>
                                    </div>
                                    <ArrowRight className="w-3 h-3 text-zinc-600" />
                                    <div className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800/50">
                                        <Wallet className="w-3 h-3 text-zinc-400" />
                                        <span className="text-zinc-300">{signal.data.to}</span>
                                    </div>
                                </div>
                            )}
                            
                            {/* Amount and Fee */}
                            {(signal.data.amount || signal.data.fee) && (
                                <div className="flex items-center gap-3 text-[10px]">
                                    {signal.data.amount && (
                                        <div className="flex items-center gap-1">
                                            <span className="text-zinc-500">Amount:</span>
                                            <span className="font-mono font-bold text-zinc-300">
                                                {signal.data.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} {signal.symbol}
                                            </span>
                                        </div>
                                    )}
                                    {signal.data.fee && (
                                        <div className="flex items-center gap-1">
                                            <Fuel className="w-2.5 h-2.5 text-orange-400" />
                                            <span className="text-zinc-500">Fee:</span>
                                            <span className="font-mono font-bold text-orange-400">
                                                {formatCurrency(signal.data.fee)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {/* Avg Price Update */}
                            {signal.type === 'AVG_PRICE_UPDATE' && signal.data.oldAvg && signal.data.newAvg && (
                                <div className="flex items-center gap-2 text-[10px]">
                                    <span className="text-zinc-500">Avg Price:</span>
                                    <span className="font-mono text-zinc-400 line-through">
                                        {formatCurrency(signal.data.oldAvg)}
                                    </span>
                                    <ArrowRight className="w-2.5 h-2.5 text-zinc-600" />
                                    <span className="font-mono font-bold text-cyan-400">
                                        {formatCurrency(signal.data.newAvg)}
                                    </span>
                                </div>
                            )}
                            
                            {/* Price targets */}
                            {(signal.data.price || signal.data.targetPrice) && (
                                <div className="flex items-center gap-3 text-[10px]">
                                    {signal.data.price && (
                                        <div className="flex items-center gap-1">
                                            <span className="text-zinc-500">Current:</span>
                                            <span className="font-mono font-bold text-zinc-300">
                                                {formatCurrency(signal.data.price)}
                                            </span>
                                        </div>
                                    )}
                                    {signal.data.targetPrice && (
                                        <div className="flex items-center gap-1">
                                            <Target className="w-2.5 h-2.5 text-emerald-400" />
                                            <span className="text-zinc-500">Target:</span>
                                            <span className="font-mono font-bold text-emerald-400">
                                                {formatCurrency(signal.data.targetPrice)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {/* PnL - Show both % and USD */}
                            {signal.data.pnlPercent !== undefined && (
                                <div className="flex items-center gap-2 text-[10px]">
                                    <span className="text-zinc-500">PnL:</span>
                                    <span className={cn(
                                        "font-mono font-bold",
                                        signal.data.pnlPercent >= 0 ? "text-emerald-400" : "text-rose-400"
                                    )}>
                                        {signal.data.pnlPercent >= 0 ? '+' : ''}{signal.data.pnlPercent.toFixed(2)}%
                                    </span>
                                    {signal.data.pnlUsd !== undefined && (
                                        <span className={cn(
                                            "font-mono font-bold px-1.5 py-0.5 rounded",
                                            signal.data.pnlUsd >= 0 ? "text-emerald-400 bg-emerald-500/10" : "text-rose-400 bg-rose-500/10"
                                        )}>
                                            {signal.data.pnlUsd >= 0 ? '+' : ''}{formatCurrency(signal.data.pnlUsd)}
                                        </span>
                                    )}
                                </div>
                            )}
                            
                            {/* Order Recommendation - Enhanced with exchange, amount, USD */}
                            {signal.type === 'ORDER_RECOMMENDATION' && (
                                <div className="space-y-2 mt-2">
                                    {/* Exchange Badge */}
                                    {signal.data.exchange && (
                                        <div className="flex items-center gap-2">
                                            <CryptoIcon type="exchange" id={signal.data.exchange.toLowerCase()} size={16} />
                                            <span className="text-[10px] font-bold text-zinc-300">{signal.data.exchange}</span>
                                            <span className={cn(
                                                "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded",
                                                signal.data.orderSide === 'buy' 
                                                    ? "text-emerald-400 bg-emerald-500/10" 
                                                    : "text-rose-400 bg-rose-500/10"
                                            )}>
                                                {signal.data.orderSide || 'limit'}
                                            </span>
                                        </div>
                                    )}
                                    
                                    {/* Amount in pair and USD */}
                                    {signal.data.amount && (
                                        <div className="flex items-center gap-3 text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className="text-zinc-500 font-medium">Amount:</span>
                                                <span className="font-mono font-bold text-white">
                                                    {signal.data.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} {signal.symbol.replace('USDT', '').replace('USDC', '')}
                                                </span>
                                            </div>
                                            {signal.data.amountUsd && (
                                                <span className="font-mono font-bold text-cyan-400">
                                                    ≈ {formatCurrency(signal.data.amountUsd)}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    
                                    {/* Stablecoin allocation insight */}
                                    {signal.data.stablecoinAlloc !== undefined && signal.data.stablecoinValue !== undefined && (
                                        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-xl bg-cyan-500/5 border border-cyan-500/15 text-xs">
                                            <DollarSign className="w-4 h-4 text-cyan-400 shrink-0" />
                                            <span className="text-zinc-400 font-medium">Available stables:</span>
                                            <span className="font-mono font-bold text-cyan-400">
                                                {formatCurrency(signal.data.stablecoinValue)}
                                            </span>
                                            <span className="text-zinc-500 text-[11px]">({signal.data.stablecoinAlloc.toFixed(1)}%)</span>
                                        </div>
                                    )}
                                    
                                    {signal.data.limitPrice && (
                                        <button 
                                            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition-colors"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                // Extract base symbol (remove USDT/USDC suffix)
                                                const baseSymbol = signal.symbol.replace('USDT', '').replace('USDC', '').replace('BUSD', '');
                                                window.dispatchEvent(new CustomEvent('highlight-asset', { detail: { symbol: baseSymbol } }));
                                            }}
                                        >
                                            <ShoppingCart className="w-4 h-4 shrink-0" />
                                            Set Limit @ {formatCurrency(signal.data.limitPrice)}
                                        </button>
                                    )}
                                </div>
                            )}
                            
                            {/* Sell recommendation */}
                            {signal.type === 'SELL_SIGNAL' && signal.data.targetPrice && (
                                <div className="flex items-center gap-2 mt-2">
                                    <button 
                                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold hover:bg-rose-500/20 transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            window.dispatchEvent(new CustomEvent('highlight-asset', { detail: { symbol: signal.symbol } }));
                                        }}
                                    >
                                        <TrendingDown className="w-3 h-3" />
                                        Consider Selling
                                    </button>
                                </div>
                            )}

                            {/* Playbook plan levels */}
                            {signal.type === 'PLAYBOOK_PLAN_LEVELS' && signal.data && (
                                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
                                    {signal.data.entryZone && (
                                        <span className="text-zinc-400">
                                            Entry: {formatCurrency(signal.data.entryZone.low)} – {formatCurrency(signal.data.entryZone.high)}
                                        </span>
                                    )}
                                    {signal.data.targets && signal.data.targets.length > 0 && (
                                        <span className="text-emerald-400">
                                            Targets: {signal.data.targets.map((t: number) => formatCurrency(t)).join(', ')}
                                        </span>
                                    )}
                                    {signal.data.stopLoss != null && (
                                        <span className="text-rose-400">Stop: {formatCurrency(signal.data.stopLoss)}</span>
                                    )}
                                    {signal.data.buyLimits && signal.data.buyLimits.length > 0 && (
                                        <span className="text-cyan-400">
                                            Buy limits: {signal.data.buyLimits.map((b: number) => formatCurrency(b)).join(', ')}
                                        </span>
                                    )}
                                    {signal.data.sellLimits && signal.data.sellLimits.length > 0 && (
                                        <span className="text-amber-400">
                                            Sell limits: {signal.data.sellLimits.map((s: number) => formatCurrency(s)).join(', ')}
                                        </span>
                                    )}
                                </div>
                            )}

                            {(signal.type === "PLAYBOOK_PLAN_LEVELS" || signal.type === "PLAYBOOK_COMPOSITE_TRIGGER" || signal.type === "PLAYBOOK_VALUE_ACCEPTANCE") && signal.data && (
                                <div className="mt-2 space-y-1.5">
                                    {(signal.data.valueRotationCount != null || signal.data.valueTestCount != null || signal.data.valueAcceptance) && (
                                        <div className="flex flex-wrap items-center gap-2 text-[10px]">
                                            <span className="text-zinc-500">Rotations:</span>
                                            <span className="text-zinc-300 font-mono">{signal.data.valueRotationCount ?? 0}</span>
                                            <span className="text-zinc-500">Tests:</span>
                                            <span className="text-zinc-300 font-mono">{signal.data.valueTestCount ?? 0}</span>
                                            {signal.data.valueAcceptance && (
                                                <span className={cn(
                                                    "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider",
                                                    signal.data.valueAcceptance === "accepted" ? "text-emerald-300 bg-emerald-500/10" :
                                                    signal.data.valueAcceptance === "rejected" ? "text-rose-300 bg-rose-500/10" :
                                                    "text-amber-300 bg-amber-500/10"
                                                )}>
                                                    {signal.data.valueAcceptance.replace("_", " ")}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {(signal.data.plannedSize != null || signal.data.filledSize != null) && (
                                        <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                                            {signal.data.plannedSize != null && (
                                                <span>Planned: <span className="text-zinc-300 font-mono">{signal.data.plannedSize}</span></span>
                                            )}
                                            {signal.data.filledSize != null && (
                                                <span>Filled: <span className="text-zinc-300 font-mono">{signal.data.filledSize}</span></span>
                                            )}
                                        </div>
                                    )}

                                    {signal.type === "PLAYBOOK_COMPOSITE_TRIGGER" && signal.data?.lastProfit != null && (
                                        <div className="text-[10px] text-zinc-500">
                                            Level quality: <span className="text-zinc-300 font-mono">{signal.data.lastProfit}</span>
                                        </div>
                                    )}

                                    {(signal.data.openInterest != null || signal.data.trades15m != null) && (
                                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-zinc-500">
                                            {signal.data.openInterest != null && (
                                                <span>OI: <span className="text-zinc-300 font-mono">{formatCompactUsd(signal.data.openInterest)}</span></span>
                                            )}
                                            {signal.data.trades15m != null && (
                                                <span>Trades 15m: <span className="text-zinc-300 font-mono">{signal.data.trades15m}</span></span>
                                            )}
                                        </div>
                                    )}

                                    {(signal.data.socialMentions != null || signal.data.socialTop) && (
                                        <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                                            <span>Social:</span>
                                            <span className="text-zinc-300 font-mono">{signal.data.socialMentions ?? 0} mentions</span>
                                            {signal.data.socialTop && <span className="text-zinc-400">Top: {signal.data.socialTop}</span>}
                                        </div>
                                    )}

                                    {signal.data.econEvents?.length ? (
                                        <div className="text-[10px] text-zinc-500">
                                            Upcoming: <span className="text-zinc-300">{signal.data.econEvents.join(" · ")}</span>
                                        </div>
                                    ) : null}

                                    {(signal.data.profileContext?.tpoShape || signal.data.profileContext?.footprint || signal.data.profileContext?.dom || signal.data.profileContext?.tape) && (
                                        <div className="text-[10px] text-zinc-500">
                                            {signal.data.profileContext?.tpoShape && <span className="mr-2">TPO: <span className="text-zinc-300">{signal.data.profileContext.tpoShape}</span></span>}
                                            {signal.data.profileContext?.footprint && <span className="mr-2">Footprint: <span className="text-zinc-300">{signal.data.profileContext.footprint}</span></span>}
                                            {signal.data.profileContext?.dom && <span className="mr-2">DOM: <span className="text-zinc-300">{signal.data.profileContext.dom}</span></span>}
                                            {signal.data.profileContext?.tape && <span>Tape: <span className="text-zinc-300">{signal.data.profileContext.tape}</span></span>}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Journal reminder CTA */}
                            {signal.type === 'JOURNAL_REMINDER' && (
                                <div className="mt-2">
                                    <button
                                        type="button"
                                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold hover:bg-amber-500/20 transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (typeof window !== 'undefined') window.location.href = '/journal/trades';
                                        }}
                                    >
                                        <BookOpen className="w-4 h-4 shrink-0" />
                                        Open Journal
                                    </button>
                                </div>
                            )}

                            {/* Perp stop-loss reminder CTA */}
                            {signal.type === 'PERP_STOPLOSS_REMINDER' && signal.data && (
                                <div className="mt-2 flex items-center gap-2 flex-wrap">
                                    {signal.data.leverage != null && (
                                        <span className="text-[10px] font-mono text-zinc-400">{signal.data.leverage}x</span>
                                    )}
                                    {signal.data.pnlPercent != null && (
                                        <span className="font-mono font-bold text-rose-400 text-[10px]">
                                            {signal.data.pnlPercent.toFixed(1)}%
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold hover:bg-rose-500/20 transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const base = signal.symbol.replace('USDT', '').replace('USDC', '').replace('BUSD', '');
                                            window.dispatchEvent(new CustomEvent('highlight-asset', { detail: { symbol: base } }));
                                        }}
                                    >
                                        <ShieldAlert className="w-3 h-3 shrink-0" />
                                        Set stop loss
                                    </button>
                                </div>
                            )}
                            
                            {/* Take Profit Alert - Show TP levels */}
                            {signal.type === 'SET_TP_ALERT' && signal.data.tpLevels && (
                                <div className="mt-2 space-y-1.5">
                                    <div className="flex items-center gap-1 text-[9px] text-zinc-500 uppercase font-bold">
                                        <Target className="w-3 h-3 text-emerald-400" />
                                        Suggested Take Profit Levels
                                    </div>
                                    <div className="grid grid-cols-3 gap-1">
                                        {signal.data.tpLevels.map((tp, i) => (
                                            <button 
                                                key={i}
                                                className="flex flex-col items-center p-2 rounded bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    window.dispatchEvent(new CustomEvent('highlight-asset', { detail: { symbol: signal.symbol } }));
                                                }}
                                            >
                                                <span className="text-[10px] font-mono font-bold text-emerald-400">
                                                    {formatCurrency(tp.price)}
                                                </span>
                                                <span className="text-[8px] text-emerald-400/70">
                                                    +{tp.percent.toFixed(0)}%
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[9px] text-amber-400 flex items-center gap-1 mt-1">
                                        <Bell className="w-2.5 h-2.5" />
                                        No take profit order set for this position
                                    </p>
                                </div>
                            )}
                            
                            {/* Stop Loss Alert - Show SL levels */}
                            {signal.type === 'SET_SL_ALERT' && signal.data.slLevels && (
                                <div className="mt-2 space-y-1.5">
                                    <div className="flex items-center gap-1 text-[9px] text-zinc-500 uppercase font-bold">
                                        <ShieldAlert className="w-3 h-3 text-rose-400" />
                                        Suggested Stop Loss Levels
                                    </div>
                                    <div className="grid grid-cols-3 gap-1">
                                        {signal.data.slLevels.map((sl, i) => (
                                            <button 
                                                key={i}
                                                className="flex flex-col items-center p-2 rounded bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    window.dispatchEvent(new CustomEvent('highlight-asset', { detail: { symbol: signal.symbol } }));
                                                }}
                                            >
                                                <span className="text-[10px] font-mono font-bold text-rose-400">
                                                    {formatCurrency(sl.price)}
                                                </span>
                                                <span className="text-[8px] text-rose-400/70">
                                                    {sl.percent.toFixed(0)}%
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[9px] text-amber-400 flex items-center gap-1 mt-1">
                                        <ShieldAlert className="w-2.5 h-2.5" />
                                        Protect your position with a stop loss
                                    </p>
                                </div>
                            )}
                            
                            {/* Price Memory Alert */}
                            {signal.type === 'PRICE_MEMORY' && signal.data && (
                                <div className="mt-2 space-y-2">
                                    {/* Price comparison - only show "≈" when truly near (≤5%), else show actual % */}
                                    {(() => {
                                        const deviation = signal.data.priceDeviation ?? 100;
                                        const isNear = deviation <= 5;
                                        const priceHigher = (signal.data.price || 0) > (signal.data.memoryPrice || 0);
                                        const diffLabel = !isNear && deviation < 100
                                            ? `${deviation.toFixed(0)}% ${priceHigher ? 'above' : 'below'}`
                                            : null;
                                        return (
                                    <div className="flex items-center gap-3 p-2 rounded bg-amber-500/5 border border-amber-500/20">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-zinc-500 uppercase">Current Price</span>
                                            <span className="text-sm font-bold text-white">{formatCurrency(signal.data.price || 0)}</span>
                                        </div>
                                        <div className="text-zinc-500 text-xs">
                                            {isNear ? '≈' : diffLabel ? diffLabel : 'vs'}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-zinc-500 uppercase">Your {signal.data.memoryType === 'buy' ? 'Buy' : 'Sell'}</span>
                                            <span className={cn(
                                                "text-sm font-bold",
                                                signal.data.memoryType === 'buy' ? "text-emerald-400" : "text-rose-400"
                                            )}>
                                                {formatCurrency(signal.data.memoryPrice || 0)}
                                            </span>
                                        </div>
                                        <div className="text-[9px] text-zinc-500 ml-auto">
                                            {signal.data.daysSinceTrade}d ago
                                        </div>
                                    </div>
                                        );
                                    })()}
                                    
                                    {/* Current holdings */}
                                    <div className={cn(
                                        "flex items-center justify-between p-2 rounded",
                                        signal.data.holdingEmpty && (signal.data.holdingValue || 0) > 0 
                                            ? "bg-amber-500/10 border border-amber-500/20" // Dust
                                            : signal.data.holdingEmpty 
                                                ? "bg-rose-500/5 border border-rose-500/20" // Empty
                                                : "bg-zinc-800/50" // Has holdings
                                    )}>
                                        <div className="flex items-center gap-2">
                                            <Wallet className={cn(
                                                "w-3.5 h-3.5",
                                                signal.data.holdingEmpty && (signal.data.holdingValue || 0) > 0 
                                                    ? "text-amber-400" 
                                                    : signal.data.holdingEmpty 
                                                        ? "text-rose-400" 
                                                        : "text-zinc-500"
                                            )} />
                                            <span className="text-[10px] text-zinc-400">Your Holdings</span>
                                        </div>
                                        <div className="text-right">
                                            {signal.data.holdingEmpty && (signal.data.holdingValue || 0) <= 0 ? (
                                                <span className="text-[10px] font-bold text-rose-400">Empty / Sold All</span>
                                            ) : signal.data.holdingEmpty && (signal.data.holdingValue || 0) > 0 ? (
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[10px] font-bold text-amber-400">
                                                        Dust Only
                                                    </span>
                                                    <span className="text-[9px] text-amber-500/70">
                                                        {signal.data.holdingBalance?.toLocaleString()} {signal.symbol} ({formatCurrency(signal.data.holdingValue || 0)})
                                                    </span>
                                                </div>
                                            ) : (
                                                <>
                                                    <span className="text-[11px] font-bold text-white">
                                                        {signal.data.holdingBalance?.toLocaleString()} {signal.symbol}
                                                    </span>
                                                    <span className="text-[9px] text-zinc-500 ml-1">
                                                        ({formatCurrency(signal.data.holdingValue || 0)})
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* AI Recommendation */}
                                    {(() => {
                                        const stables = ['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'FRAX'];
                                        const isStable = stables.includes(signal.symbol?.toUpperCase() ?? '');
                                        const isStableAlert = isStable;
                                        const recommendation = signal.data?.aiRecommendation || signal.data?.recommendedAction
                                            || (isStableAlert ? 'Stablecoins rarely need action – focus on volatile pairs for trading signals.' : null);
                                        return recommendation ? (
                                            <div className="flex items-start gap-2 p-2 rounded bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                                                <Sparkles className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                                                <p className="text-[10px] text-amber-200 leading-relaxed">
                                                    {recommendation}
                                                </p>
                                            </div>
                                        ) : null;
                                    })()}
                                    
                                    {/* Action button */}
                                    <button 
                                        className={cn(
                                            "w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] font-bold transition-colors",
                                            signal.data.memoryType === 'buy'
                                                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                                                : "bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20"
                                        )}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            window.dispatchEvent(new CustomEvent('highlight-asset', { detail: { symbol: signal.symbol } }));
                                        }}
                                    >
                                        <Eye className="w-3 h-3" />
                                        View {signal.symbol} Details
                                    </button>
                                </div>
                            )}
                            
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </div>
        </motion.article>
    );
});

// Main component
export type AlphaSignalExport = AlphaSignal;

export const NeuralAlphaFeed = memo(function NeuralAlphaFeed({
    className,
    compact = false,
    additionalItems = [],
    variant = "default",
    allowedTypes,
}: {
    className?: string;
    compact?: boolean;
    additionalItems?: AlphaSignal[];
    variant?: "default" | "global";
    allowedTypes?: SignalType[];
}) {
    const { assets, transactions, transfers, spotOrders, connections, positions } = usePortfolio();
    const { user, cloudSyncEnabled } = useSupabaseAuth();
    const { processAISignals, isEnabled: alertsEnabled } = useAIFeedAlerts();
    const [showAll, setShowAll] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [playbookSignals, setPlaybookSignals] = useState<AlphaSignal[]>([]);
    const [spotPlans, setSpotPlans] = useState<SpotPlan[]>([]);
    const [perpPlans, setPerpPlans] = useState<PerpPlan[]>([]);
    const [journalTrades, setJournalTrades] = useState<{ id: string; symbol?: string; price?: number; pnl?: number; timestamp?: number }[]>([]);
    const [journalAnnotations, setJournalAnnotations] = useState<Array<{
        id: string;
        tradeId: string;
        strategyTag: string;
        executionQuality: number;
        notes: string;
        marketProfile?: { profileType?: string; keyLevels?: string; context?: string };
        mistakeTags?: string[];
        createdAt: number;
        updatedAt: number;
    }>>([]);
    const [, forceMemoryUpdate] = useState(0);
    const memoryRef = useRef<MemoryStore | null>(null);
    const [lastSeenTimestamp, setLastSeenTimestamp] = useState<number>(0);
    const [tpThresholdPct, setTpThresholdPct] = useState(DEFAULT_TP_THRESHOLD_PCT);
    const [dcaThresholdPct, setDcaThresholdPct] = useState(DEFAULT_DCA_THRESHOLD_PCT);
    const [compositeTolerance, setCompositeTolerance] = useState(DEFAULT_COMPOSITE_TOLERANCE);
    const screener = useScreenerData({ live: false, enableRestFallback: false });
    const compositeTriggeredRef = useRef<Record<string, number>>({});
    const compositeReactionRef = useRef<Record<string, {
        lastTouchAt?: number;
        levelValue?: number;
        maxDrawdownPct?: number;
        timeToReturnMinutes?: number;
        timeOutsideValueMinutes?: number;
        outsideStartAt?: number;
    }>>({});
    const baseTimeRef = useRef(Date.now());
    const lastProcessedSignalsRef = useRef<Set<string>>(new Set());
    const lastSnapshotRef = useRef(0);
    const dataRef = useRef({ assets, transactions, transfers, spotOrders, connections, positions });
    dataRef.current = {
        assets,
        transactions: transactions ?? [],
        transfers: transfers ?? [],
        spotOrders: spotOrders ?? [],
        connections: connections ?? [],
        positions: positions ?? [],
    };
    const [snapshot, setSnapshot] = useState({
        assets: Array.isArray(assets) ? assets : [],
        transactions: Array.isArray(transactions) ? transactions : [],
        transfers: Array.isArray(transfers) ? transfers : [],
        spotOrders: Array.isArray(spotOrders) ? spotOrders : [],
        connections: Array.isArray(connections) ? connections : [],
        positions: Array.isArray(positions) ? positions : [],
    });

    // Load spot/perp plans (cloud when sync on, else localStorage); subscribe to updates
    useEffect(() => {
        if (typeof window === "undefined") return;
        const loadPlans = () => {
            setSpotPlans(getSpotPlans());
            setPerpPlans(getPerpPlans());
        };
        if (user?.id && cloudSyncEnabled) {
            let cancelled = false;
            Promise.all([
                getValueWithCloud(SPOT_PLANS_KEY, user.id, true),
                getValueWithCloud(PERP_PLANS_KEY, user.id, true),
            ]).then(([spotRaw, perpRaw]) => {
                if (cancelled) return;
                try {
                    if (spotRaw) setSpotPlans(JSON.parse(typeof spotRaw === "string" ? spotRaw : JSON.stringify(spotRaw)));
                    if (perpRaw) setPerpPlans(JSON.parse(typeof perpRaw === "string" ? perpRaw : JSON.stringify(perpRaw)));
                } catch {
                    loadPlans();
                }
            });
            return () => { cancelled = true; };
        } else {
            loadPlans();
        }
        const onSpot = () => setSpotPlans(getSpotPlans());
        const onPerp = () => setPerpPlans(getPerpPlans());
        window.addEventListener("spot-plans-updated", onSpot);
        window.addEventListener("perp-plans-updated", onPerp);
        return () => {
            window.removeEventListener("spot-plans-updated", onSpot);
            window.removeEventListener("perp-plans-updated", onPerp);
        };
    }, [user?.id, cloudSyncEnabled]);

    // Load journal trades (cloud when sync on, else localStorage); subscribe to storage/events for refresh
    useEffect(() => {
        if (typeof window === "undefined") return;
        const loadJournal = () => {
            try {
                const raw = localStorage.getItem(JOURNAL_TRADES_KEY);
                const list = raw ? JSON.parse(raw) : [];
                setJournalTrades(Array.isArray(list) ? list.map((t: { id: string; symbol?: string; price?: number; pnl?: number; timestamp?: number }) => ({
                    id: t.id,
                    symbol: t.symbol,
                    price: t.price,
                    pnl: t.pnl,
                    timestamp: t.timestamp,
                })) : []);
            } catch {
                setJournalTrades([]);
            }
        };
        if (user?.id && cloudSyncEnabled) {
            let cancelled = false;
            getValueWithCloud(JOURNAL_TRADES_KEY, user.id, cloudSyncEnabled).then((saved) => {
                if (cancelled) return;
                try {
                    const list = saved ? (typeof saved === "string" ? JSON.parse(saved) : saved) : [];
                    setJournalTrades(Array.isArray(list) ? list.map((t: { id: string; symbol?: string; price?: number; pnl?: number; timestamp?: number }) => ({
                        id: t.id,
                        symbol: t.symbol,
                        price: t.price,
                        pnl: t.pnl,
                        timestamp: t.timestamp,
                    })) : []);
                } catch {
                    loadJournal();
                }
            });
            return () => { cancelled = true; };
        }
        loadJournal();
        const onStorage = (e: StorageEvent) => {
            if (e.key === JOURNAL_TRADES_KEY) loadJournal();
        };
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, [user?.id, cloudSyncEnabled]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const loadAnnotations = () => {
            try {
                const raw = localStorage.getItem(JOURNAL_ANNOTATIONS_KEY);
                const list = raw ? JSON.parse(raw) : [];
                setJournalAnnotations(Array.isArray(list) ? list : []);
            } catch {
                setJournalAnnotations([]);
            }
        };
        loadAnnotations();
        const onStorage = (e: StorageEvent) => {
            if (e.key === JOURNAL_ANNOTATIONS_KEY) loadAnnotations();
        };
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, []);

    useEffect(() => {
        let cancelled = false;
        loadMemory("ai", user?.id ?? null, cloudSyncEnabled).then((memory) => {
            if (cancelled) return;
            memoryRef.current = memory;
            if (memory.lastSeen.aiFeed) setLastSeenTimestamp(memory.lastSeen.aiFeed);
            forceMemoryUpdate((v) => v + 1);
        });
        if (user?.id && cloudSyncEnabled) {
            getValueWithCloud(AI_FEED_TP_THRESHOLD_KEY, user.id, cloudSyncEnabled).then((saved) => {
                if (cancelled) return;
                const n = typeof saved === "number" ? saved : typeof saved === "string" ? parseInt(saved, 10) : NaN;
                if (n >= 10 && n <= 100) setTpThresholdPct(n);
            });
            getValueWithCloud(AI_FEED_DCA_THRESHOLD_KEY, user.id, cloudSyncEnabled).then((saved) => {
                if (cancelled) return;
                const n = typeof saved === "number" ? saved : typeof saved === "string" ? parseInt(saved, 10) : NaN;
                if (n >= 5 && n <= 80) setDcaThresholdPct(n);
            });
            getValueWithCloud(AI_FEED_COMPOSITE_TOLERANCE_KEY, user.id, cloudSyncEnabled).then((saved) => {
                if (cancelled) return;
                const n = typeof saved === "number" ? saved : typeof saved === "string" ? parseFloat(saved) : NaN;
                if (!Number.isNaN(n) && n >= 0.0005 && n <= 0.01) setCompositeTolerance(n);
            });
        }
        return () => { cancelled = true; };
    }, [user?.id, cloudSyncEnabled]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            const raw = localStorage.getItem(AI_FEED_COMPOSITE_TRIGGER_KEY);
            if (raw) compositeTriggeredRef.current = JSON.parse(raw);
        } catch {
            compositeTriggeredRef.current = {};
        }
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            const raw = localStorage.getItem(AI_FEED_COMPOSITE_REACTION_KEY);
            if (raw) compositeReactionRef.current = JSON.parse(raw);
        } catch {
            compositeReactionRef.current = {};
        }
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail || {};
            const pct = parseFloat(detail.compositeTolerancePct);
            if (!Number.isNaN(pct)) {
                setCompositeTolerance(Math.max(0.0005, Math.min(0.01, pct / 100)));
                if (user?.id && cloudSyncEnabled) {
                    setValueWithCloud(AI_FEED_COMPOSITE_TOLERANCE_KEY, String(pct / 100), user.id, cloudSyncEnabled).catch(() => {});
                }
            }
        };
        window.addEventListener("playbook-settings-updated", handler as EventListener);
        return () => window.removeEventListener("playbook-settings-updated", handler as EventListener);
    }, [user?.id, cloudSyncEnabled]);

    useEffect(() => {
        const t = setInterval(() => {
            if (!memoryRef.current) return;
            memoryRef.current = cleanupMemory(memoryRef.current);
            forceMemoryUpdate((v) => v + 1);
        }, 60_000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        if (!user?.id || !cloudSyncEnabled) return;
        const t = setTimeout(() => {
            if (!memoryRef.current) return;
            const now = Date.now();
            memoryRef.current = markLastSeen(memoryRef.current, "aiFeed", now);
            setLastSeenTimestamp(now);
            saveMemory("ai", memoryRef.current, user.id, cloudSyncEnabled).catch(() => {});
        }, 4000);
        return () => clearTimeout(t);
    }, [user?.id, cloudSyncEnabled]);

    const handleRealtimeMemoryUpdate = useCallback(
        async (key: string) => {
            if (key !== AI_FEED_MEMORY_KEY || !user?.id || !cloudSyncEnabled) return;
            const memory = await loadMemory("ai", user.id, cloudSyncEnabled);
            memoryRef.current = memory;
            if (memory.lastSeen.aiFeed) setLastSeenTimestamp(memory.lastSeen.aiFeed);
            forceMemoryUpdate((v) => v + 1);
        },
        [user?.id, cloudSyncEnabled]
    );
    useSupabaseRealtimeSyncUpdate(handleRealtimeMemoryUpdate);

    const handleDismiss = useCallback(
        (id: string, signal?: { type?: string; symbol?: string }) => {
            if (!memoryRef.current) return;
            memoryRef.current = addDismissed(memoryRef.current, {
                id,
                type: signal?.type,
                symbol: signal?.symbol,
            });
            forceMemoryUpdate((v) => v + 1);
            saveMemory("ai", memoryRef.current, user?.id ?? null, cloudSyncEnabled).catch(() => {});
        },
        [user?.id, cloudSyncEnabled]
    );

    const handleSnooze = useCallback(
        (id: string, signal?: { type?: string; symbol?: string }, ms = 2 * 60 * 60 * 1000) => {
            if (!memoryRef.current) return;
            memoryRef.current = setCooldown(memoryRef.current, { id, type: signal?.type, symbol: signal?.symbol }, ms);
            forceMemoryUpdate((v) => v + 1);
            saveMemory("ai", memoryRef.current, user?.id ?? null, cloudSyncEnabled).catch(() => {});
        },
        [user?.id, cloudSyncEnabled]
    );

    useEffect(() => {
        const now = Date.now();
        if (now - lastSnapshotRef.current >= FEED_UPDATE_INTERVAL_MS || lastSnapshotRef.current === 0) {
            lastSnapshotRef.current = now;
            setSnapshot({ ...dataRef.current });
        }
        const id = setInterval(() => {
            lastSnapshotRef.current = Date.now();
            setSnapshot({ ...dataRef.current });
        }, FEED_UPDATE_INTERVAL_MS);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        const levelLabel = (levelType: string) =>
            levelType === 'target' ? 'Target' : levelType === 'stop' ? 'Stop' :
            levelType === 'entry_low' ? 'Entry Low' : levelType === 'entry_high' ? 'Entry High' :
            (KEY_LEVEL_LABELS as Record<string, string>)[levelType] || levelType;

        const onLevelTriggered = (e: CustomEvent) => {
            const { alert, currentPrice, exchange } = e.detail || {};
            if (!alert?.symbol) return;
            const label = levelLabel(alert.levelType);
            const signal: AlphaSignal = {
                id: `playbook-${alert.id}-${Date.now()}`,
                type: 'PLAYBOOK_LEVEL_EXECUTED',
                symbol: alert.symbol,
                title: 'Spot Plan Level Executed',
                description: `Your ${alert.symbol} plan – ${label} at ${formatCurrency(alert.levelValue)} was executed at ${new Date().toLocaleTimeString()} on ${exchange || 'Binance'}.`,
                timestamp: Date.now(),
                priority: 'high',
                data: { price: currentPrice, levelType: alert.levelType, levelValue: alert.levelValue, exchange: exchange || 'Binance' }
            };
            setPlaybookSignals(prev => [signal, ...prev].slice(0, 50));
        };

        const onBuyPhaseDone = (e: CustomEvent) => {
            const { progress, exchange } = e.detail || {};
            if (!progress?.symbol) return;
            const pending = progress.pendingSellLevels?.length
                ? progress.pendingSellLevels.map((p: { levelType: string; levelValue: number }) => `${p.levelType} $${p.levelValue?.toLocaleString()}`).join(', ')
                : 'none';
            const signal: AlphaSignal = {
                id: `playbook-buy-done-${progress.planId}-${Date.now()}`,
                type: 'PLAYBOOK_BUY_PHASE_DONE',
                symbol: progress.symbol,
                title: 'All Buy Levels Executed',
                description: `Your ${progress.symbol} plan – all buy levels executed. Pending sell levels: ${pending}.`,
                timestamp: Date.now(),
                priority: 'high',
                data: { exchange: exchange || 'Binance', pendingSellLevels: progress.pendingSellLevels }
            };
            setPlaybookSignals(prev => [signal, ...prev].slice(0, 50));
        };

        const onPlanComplete = (e: CustomEvent) => {
            const { progress, exchange } = e.detail || {};
            if (!progress?.symbol) return;
            const signal: AlphaSignal = {
                id: `playbook-complete-${progress.planId}-${Date.now()}`,
                type: 'PLAYBOOK_PLAN_COMPLETE',
                symbol: progress.symbol,
                title: 'Plan Complete',
                description: `Your ${progress.symbol} plan – all buy and sell levels executed. Plan complete.`,
                timestamp: Date.now(),
                priority: 'high',
                data: { exchange: exchange || 'Binance' }
            };
            setPlaybookSignals(prev => [signal, ...prev].slice(0, 50));
        };

        window.addEventListener('playbook-alert-triggered', onLevelTriggered as EventListener);
        window.addEventListener('playbook-buy-phase-done', onBuyPhaseDone as EventListener);
        window.addEventListener('playbook-plan-complete', onPlanComplete as EventListener);
        return () => {
            window.removeEventListener('playbook-alert-triggered', onLevelTriggered as EventListener);
            window.removeEventListener('playbook-buy-phase-done', onBuyPhaseDone as EventListener);
            window.removeEventListener('playbook-plan-complete', onPlanComplete as EventListener);
        };
    }, []);

    // Calculate stablecoin stats from throttled snapshot to avoid flicker
    const stablecoinStats = useMemo(() => {
        const stablecoins = ['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'FRAX'];
        const stableAssets = snapshot.assets.filter((a) => stablecoins.includes(a.symbol.toUpperCase()));
        const stablecoinValue = stableAssets.reduce((sum, a) => sum + a.valueUsd, 0);
        const totalValue = snapshot.assets.reduce((sum, a) => sum + a.valueUsd, 0);
        const stablecoinAlloc = totalValue > 0 ? (stablecoinValue / totalValue) * 100 : 0;
        return { stablecoinValue, stablecoinAlloc, totalValue };
    }, [snapshot.assets]);

    const screenerBySymbol = useMemo(() => {
        const map = new Map<string, { price?: number; openInterest?: number; trades15m?: number; change1h?: number; volume24h?: number }>();
        if (!screener?.tickersList?.length) return map;
        screener.tickersList.forEach((t) => {
            const base = normalizeSymbol(t.symbol || t.base || "");
            if (!base) return;
            const existing = map.get(base) || {};
            map.set(base, {
                price: existing.price ?? t.price,
                openInterest: existing.openInterest ?? t.openInterest,
                trades15m: existing.trades15m ?? t.trades15m,
                change1h: existing.change1h ?? t.change1h,
                volume24h: existing.volume24h ?? t.volume24h,
            });
        });
        return map;
    }, [screener?.tickersList]);

    const assetPriceBySymbol = useMemo(() => {
        const map = new Map<string, number>();
        snapshot.assets.forEach((a) => {
            map.set(a.symbol.toUpperCase(), a.price || 0);
        });
        return map;
    }, [snapshot.assets]);

    const socialBySymbol = useMemo(() => {
        const map = new Map<string, { count: number; top?: string }>();
        additionalItems
            .filter((s) => s.type === "SOCIAL_MENTION")
            .forEach((s) => {
                const key = normalizeSymbol(s.symbol || "");
                if (!key) return;
                const prev = map.get(key) || { count: 0, top: undefined as string | undefined };
                map.set(key, { count: prev.count + 1, top: prev.top || s.data?.author });
            });
        return map;
    }, [additionalItems]);

    const econEvents = useMemo(() => {
        return additionalItems
            .filter((s) => s.type === "ECONOMIC_EVENT")
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(0, 3)
            .map((s) => s.title);
    }, [additionalItems]);

    const journalTradesById = useMemo(() => {
        const map = new Map<string, { id: string; symbol?: string; price?: number; pnl?: number; timestamp?: number }>();
        journalTrades.forEach((t) => map.set(t.id, t));
        return map;
    }, [journalTrades]);

    const annotationsBySymbol = useMemo(() => {
        const map = new Map<string, typeof journalAnnotations>();
        journalAnnotations.forEach((ann) => {
            const trade = journalTradesById.get(ann.tradeId);
            const symbol = trade?.symbol || "";
            if (!symbol) return;
            const key = normalizeSymbol(symbol);
            const list = map.get(key) || [];
            list.push(ann);
            map.set(key, list);
        });
        return map;
    }, [journalAnnotations, journalTradesById]);
    
    // Generate AI signals based on portfolio data - using useMemo for stability
    const signals = useMemo(() => {
        // Touch refreshKey to allow manual refresh
        void refreshKey;
        
        const newSignals: AlphaSignal[] = [];
        const now = baseTimeRef.current;
        const seenIds = new Set<string>();
        
        const addSignal = (signal: AlphaSignal) => {
            if (!seenIds.has(signal.id)) {
                seenIds.add(signal.id);
                newSignals.push(signal);
            }
        };
        
        // 1. Analyze assets for sell signals and order alerts
        const stablecoins = ['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'FRAX'];
        
        snapshot.assets.forEach((asset) => {
            // Skip stablecoins for trading signals
            if (stablecoins.includes(asset.symbol.toUpperCase())) return;
            
            const analytics = calculateAssetAnalytics(asset, snapshot.transactions, {
                transfers: snapshot.transfers,
                depositBasisPrice: asset.price || 0,
            });

            // Check if there are any open orders for this asset
            const hasOpenSellOrder = snapshot.spotOrders.some((o) => 
                o.symbol?.includes(asset.symbol) && o.side === 'sell'
            );
            // Take profit signal - price significantly above avg buy
            if (analytics.avgBuyPrice > 0 && asset.price) {
                const pnlPercent = ((asset.price - analytics.avgBuyPrice) / analytics.avgBuyPrice) * 100;
                const pnlUsd = (asset.price - analytics.avgBuyPrice) * asset.balance;
                const holdingValue = asset.valueUsd || asset.balance * (asset.price || 0);
                
                // Alert for assets in significant profit WITHOUT a take profit order
                if (pnlPercent > tpThresholdPct && !hasOpenSellOrder && holdingValue > 10) {
                    addSignal({
                        id: `tp-alert-${asset.symbol}`,
                        type: 'SET_TP_ALERT',
                        symbol: asset.symbol,
                        title: 'Set Take Profit',
                        description: `${asset.symbol} is +${pnlPercent.toFixed(0)}% in profit (${formatCurrency(pnlUsd)}). You have no sell order set!`,
                        timestamp: now - 60000,
                        priority: pnlPercent > 75 ? 'high' : 'medium',
                        data: {
                            price: asset.price,
                            avgBuyPrice: analytics.avgBuyPrice,
                            pnlPercent,
                            pnlUsd,
                            holdingValue,
                            hasNoOrder: true,
                            tpLevels: [
                                { price: asset.price * 1.10, percent: 10 + pnlPercent },
                                { price: asset.price * 1.25, percent: 25 + pnlPercent },
                                { price: asset.price * 1.50, percent: 50 + pnlPercent }
                            ],
                            aiRecommendation: `Lock in gains: set a limit sell at +10%, +25%, or +50% from current price. Consider trailing stop if you stay long.`
                        }
                    });
                }
                
                // Regular take profit suggestion at high profit
                if (pnlPercent > 50) {
                    addSignal({
                        id: `sell-${asset.symbol}`,
                        type: 'SELL_SIGNAL',
                        symbol: asset.symbol,
                        title: 'Take Profit Zone',
                        description: `${asset.symbol} is ${pnlPercent.toFixed(0)}% above your average buy. Consider taking profits.`,
                        timestamp: now - 180000,
                        priority: pnlPercent > 100 ? 'high' : 'medium',
                        data: {
                            price: asset.price,
                            avgBuyPrice: analytics.avgBuyPrice,
                            pnlPercent,
                            pnlUsd,
                            targetPrice: analytics.avgBuyPrice * 1.25,
                            aiRecommendation: pnlPercent > 100 ? 'Strong profit zone. Consider taking 25–50% off the table and letting the rest run with a trailing stop.' : 'Scale out part of the position; keep a runner with a stop above breakeven.'
                        }
                    });
                }
                
                // Alert for assets in significant LOSS - suggest stop loss
                if (pnlPercent < -25 && !hasOpenSellOrder && holdingValue > 10) {
                    addSignal({
                        id: `sl-alert-${asset.symbol}`,
                        type: 'SET_SL_ALERT',
                        symbol: asset.symbol,
                        title: 'Set Stop Loss',
                        description: `${asset.symbol} is ${pnlPercent.toFixed(0)}% in loss (${formatCurrency(pnlUsd)}). Consider setting a stop loss!`,
                        timestamp: now - 90000,
                        priority: pnlPercent < -40 ? 'high' : 'medium',
                        data: {
                            price: asset.price,
                            avgBuyPrice: analytics.avgBuyPrice,
                            pnlPercent,
                            pnlUsd,
                            holdingValue,
                            hasNoOrder: true,
                            slLevels: [
                                { price: asset.price * 0.95, percent: pnlPercent - 5 },
                                { price: asset.price * 0.90, percent: pnlPercent - 10 },
                                { price: asset.price * 0.85, percent: pnlPercent - 15 }
                            ],
                            aiRecommendation: `Protect capital: set a stop loss at -5% to -15% from current price. If you're still bullish, consider DCA instead of adding at market.`
                        }
                    });
                }
                
                // DCA opportunity - price below avg (threshold from cloud or default)
                if (pnlPercent < -dcaThresholdPct) {
                    addSignal({
                        id: `buy-${asset.symbol}`,
                        type: 'BUY_SIGNAL',
                        symbol: asset.symbol,
                        title: 'DCA Opportunity',
                        description: `${asset.symbol} is ${Math.abs(pnlPercent).toFixed(0)}% below your average. Good DCA zone.`,
                        timestamp: now - 420000,
                        priority: pnlPercent < -40 ? 'high' : 'medium',
                        data: {
                            price: asset.price,
                            avgBuyPrice: analytics.avgBuyPrice,
                            pnlPercent,
                            pnlUsd,
                            aiRecommendation: `Price is below your average cost. Add in size you're comfortable holding long-term; avoid chasing if momentum is still down.`
                        }
                    });
                }
            }
            
            // Large holding warning
            if (asset.allocations > 30) {
                addSignal({
                    id: `concentration-${asset.symbol}`,
                    type: 'VOLATILITY_ALERT',
                    symbol: asset.symbol,
                    title: 'Concentration Risk',
                    description: `${asset.symbol} represents ${asset.allocations.toFixed(1)}% of your portfolio. Consider diversifying.`,
                    timestamp: now - 660000,
                    priority: asset.allocations > 50 ? 'high' : 'medium',
                    data: {
                        price: asset.price,
                        aiRecommendation: asset.allocations > 50
                            ? 'High concentration. Consider trimming 20–30% into stables or other assets to reduce single-asset risk.'
                            : 'Consider rebalancing: take some profit or add to other positions to diversify.'
                    }
                });
            }
        });
        
        // 1.5. Price Memory Signals - Alert when price returns to historical buy/sell levels
        const txList = snapshot.transactions;
        const symbolTxMap = new Map<string, any[]>();
        
        // Group transactions by symbol
        txList.forEach(tx => {
            const sym = tx.symbol?.toUpperCase() || '';
            if (!sym || stablecoins.includes(sym)) return;
            if (!symbolTxMap.has(sym)) symbolTxMap.set(sym, []);
            symbolTxMap.get(sym)!.push(tx);
        });
        
        // Check each symbol for price memory alerts
        symbolTxMap.forEach((txs, symbol) => {
            const asset = snapshot.assets.find((a) => a.symbol.toUpperCase() === symbol);
            const currentPrice = asset?.price || 0;
            const holdingBalance = asset?.balance || 0;
            const holdingValue = asset?.valueUsd || 0;
            const holdingEmpty = holdingValue < 1; // Less than $1 = dust/empty (for meme coins)
            const isDust = holdingValue > 0 && holdingValue < 5; // Dust amount
            
            // Sort transactions by timestamp (oldest first)
            const sortedTxs = [...txs].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
            
            // Find old transactions where price is near current price
            const now = Date.now();
            const MIN_DAYS_AGO = 3; // Only alert for trades at least 3 days old
            const PRICE_NEAR_THRESHOLD = 5; // 5% - only "near" when truly close (was 15% - too loose)
            
            sortedTxs.forEach(tx => {
                const txPrice = tx.price || 0;
                const txTimestamp = tx.timestamp || 0;
                const daysSinceTrade = Math.floor((now - txTimestamp) / (1000 * 60 * 60 * 24));
                
                // Only consider trades from at least MIN_DAYS_AGO
                if (daysSinceTrade < MIN_DAYS_AGO) return;
                if (txPrice <= 0) return;
                
                // Calculate how close current price is to historical trade price
                const priceDistance = currentPrice > 0 
                    ? Math.abs((currentPrice - txPrice) / txPrice) * 100
                    : 100; // If no current price, assume far away
                
                // Only "near" when within 5% - avoid misleading "near your buy price" when 15% away
                const isPriceNear = priceDistance <= PRICE_NEAR_THRESHOLD;
                const shouldAlert = isPriceNear || (isDust && currentPrice > 0);
                
                if (shouldAlert) {
                    const isBuy = tx.side === 'buy' || tx.type === 'Buy';
                    const isSell = tx.side === 'sell' || tx.type === 'Sell';
                    
                    let aiRecommendation = '';
                    let priority: 'high' | 'medium' | 'low' = 'medium';
                    let title = '';
                    let description = '';
                    
                    // Special handling for dust holdings
                    if (isDust) {
                        title = 'Dust Holdings Alert';
                        description = `You have dust ${symbol} (${formatCurrency(holdingValue)}). Last ${isBuy ? 'bought' : 'sold'} at ${formatCurrency(txPrice)} ${daysSinceTrade} days ago.`;
                        
                        if (isPriceNear) {
                            aiRecommendation = `Price is near your last ${isBuy ? 'buy' : 'sell'} level! You only have dust (${holdingBalance.toLocaleString()} ${symbol} = ${formatCurrency(holdingValue)}). Consider buying more or selling the dust.`;
                            priority = 'high';
                        } else {
                            const priceChange = ((currentPrice - txPrice) / txPrice) * 100;
                            aiRecommendation = `You have dust ${symbol}. Current price ${formatCurrency(currentPrice)} is ${priceChange > 0 ? '+' : ''}${priceChange.toFixed(0)}% from your ${isBuy ? 'buy' : 'sell'} at ${formatCurrency(txPrice)}. Consider accumulating or clearing the dust.`;
                        }
                    } else if (isBuy) {
                        title = 'Price at Buy Level';
                        description = `${symbol} price ${formatCurrency(currentPrice)} within ${priceDistance.toFixed(1)}% of your buy ${formatCurrency(txPrice)} from ${daysSinceTrade} days ago.`;
                        
                        if (holdingEmpty) {
                            aiRecommendation = `You bought ${symbol} at ${formatCurrency(txPrice)} ${daysSinceTrade} days ago and sold it all. Price is back! Consider re-entering if still bullish.`;
                            priority = 'high';
                        } else {
                            aiRecommendation = `Price returned to your entry from ${daysSinceTrade} days ago. You still hold ${holdingBalance.toLocaleString()} ${symbol} (${formatCurrency(holdingValue)}). Good opportunity to DCA or hold.`;
                        }
                    } else if (isSell) {
                        title = 'Price at Sell Level';
                        description = `${symbol} price ${formatCurrency(currentPrice)} within ${priceDistance.toFixed(1)}% of your sell ${formatCurrency(txPrice)} from ${daysSinceTrade} days ago.`;
                        
                        if (holdingEmpty) {
                            aiRecommendation = `You sold ${symbol} at ${formatCurrency(txPrice)} ${daysSinceTrade} days ago. Price is back at that level! You have no holdings - consider if you want to re-buy.`;
                            priority = 'medium';
                        } else {
                            aiRecommendation = `Price returned to your sell level from ${daysSinceTrade} days ago. You still hold ${holdingBalance.toLocaleString()} ${symbol} (${formatCurrency(holdingValue)}). Consider taking profits again.`;
                            priority = 'high';
                        }
                    }
                    
                    if (aiRecommendation) {
                        addSignal({
                            id: `price-memory-${symbol}-${tx.id || txTimestamp}`,
                            type: 'PRICE_MEMORY',
                            symbol,
                            title,
                            description,
                            timestamp: now - 30000, // Show near top
                            priority,
                            data: {
                                price: currentPrice,
                                memoryPrice: txPrice,
                                memoryType: isBuy ? 'buy' : 'sell',
                                memoryDate: txTimestamp,
                                holdingBalance,
                                holdingValue,
                                holdingEmpty: holdingEmpty || isDust,
                                aiRecommendation,
                                daysSinceTrade,
                                priceDeviation: priceDistance
                            }
                        });
                    }
                }
            });
        });
        
        // 2. Analyze transfers for insights (limit to 5 to avoid duplicates)
        snapshot.transfers.slice(0, 5).forEach((transfer, i) => {
            const conn = snapshot.connections.find((c) => c.id === transfer.connectionId);
            const isWithdraw = transfer.type === 'Withdraw';
            const transferId = transfer.id || `t-${i}`;
            const asset = snapshot.assets.find((a) => a.symbol === transfer.asset);
            const amountUsd = asset ? transfer.amount * (asset.price || 0) : undefined;
            
            addSignal({
                id: `transfer-${transferId}`,
                type: 'TRANSFER_INSIGHT',
                symbol: transfer.asset || transfer.symbol || 'Unknown',
                title: isWithdraw ? 'Withdrawal Complete' : 'Deposit Received',
                description: isWithdraw 
                    ? `Transferred ${transfer.amount} ${transfer.asset} to your hardware wallet.`
                    : `Received ${transfer.amount} ${transfer.asset} from exchange.`,
                timestamp: transfer.timestamp || now - 900000,
                priority: 'low',
                data: {
                    from: isWithdraw ? (conn?.name || 'Exchange') : 'External',
                    to: isWithdraw ? 'Hardware Wallet' : (conn?.name || 'Your Wallet'),
                    amount: transfer.amount,
                    amountUsd,
                    chain: conn?.chain,
                    exchange: conn?.name
                }
            });
        });
        
        // 3. Analyze open orders with enhanced details (SPOT ONLY - filter out futures/perps)
        const isSpotOrder = (order: any) => {
            // If order has explicit isPerp flag (from Hyperliquid), use it
            if (order.isPerp === true) return false;
            if (order.isPerp === false) return true;
            
            // Hyperliquid spot symbols start with @ (token indices)
            const symbol = order.symbol || '';
            if (symbol.startsWith('@')) return true;
            
            // Check for common futures/perp patterns
            const s = symbol.toUpperCase();
            if (s.includes('PERP') || s.includes('-SWAP') || s.includes('_PERP')) return false;
            if (s.startsWith('1000')) return false; // Multiplied tokens like 1000PEPE
            if (/^U[A-Z]{2,4}$/.test(s)) return false; // UBTC, UETH, USOL etc.
            if (s.includes('_')) return false; // Futures often use underscores
            
            // Check exchange type
            const exchange = (order.exchange || '').toLowerCase();
            if (exchange === 'hyperliquid' && !symbol.startsWith('@')) {
                // On Hyperliquid, non-@ symbols are perps
                return false;
            }
            
            return true; // Default to spot
        };
        
        const spotOnlyOrders = snapshot.spotOrders.filter(isSpotOrder);
        
        spotOnlyOrders.slice(0, 5).forEach((order, i) => {
            // Normalize symbol - strip quote currencies and handle wrapped tokens
            const baseSymbol = order.symbol?.replace(/USDT$|USDC$|BUSD$|USD$/i, '') || '';
            // Handle wrapped token prefixes (UBTC -> BTC, WETH -> ETH, etc.)
            const unwrappedSymbol = baseSymbol.replace(/^[UW]/, '');
            
            // Try to find asset by exact match first, then unwrapped, then case-insensitive
            let asset = snapshot.assets.find((a) => a.symbol === baseSymbol);
            if (!asset && unwrappedSymbol !== baseSymbol) {
                asset = snapshot.assets.find((a) => a.symbol === unwrappedSymbol);
            }
            if (!asset) {
                asset = snapshot.assets.find((a) => a.symbol.toUpperCase() === baseSymbol.toUpperCase());
            }
            
            const orderId = order.id || `o-${i}`;
            const conn = snapshot.connections.find((c) => c.id === order.connectionId);
            const amountUsd = order.amount * order.price;
            
            // Get current price from asset, must be different from order price to calculate deviation
            const assetPrice = asset?.price || 0;
            const currentPrice = assetPrice > 0 ? assetPrice : order.price;
            
            // Calculate price deviation - only if we have a real current price
            let priceDeviation = 0;
            let hasValidDeviation = false;
            if (assetPrice > 0 && order.price > 0 && assetPrice !== order.price) {
                // For buy orders: positive = order is below market (good), negative = above market
                // For sell orders: positive = order is above market (profit target)
                priceDeviation = ((currentPrice - order.price) / currentPrice) * 100;
                hasValidDeviation = true;
            }
            
            // Build description based on whether we have valid deviation
            let description = '';
            if (order.side === 'buy') {
                if (hasValidDeviation) {
                    const absDeviation = Math.abs(priceDeviation);
                    description = priceDeviation > 0 
                        ? `Your limit buy at ${formatCurrency(order.price)} is ${absDeviation.toFixed(1)}% below market.`
                        : `Your limit buy at ${formatCurrency(order.price)} is ${absDeviation.toFixed(1)}% above market.`;
                } else {
                    description = `Limit buy order at ${formatCurrency(order.price)} awaiting fill.`;
                }
            } else {
                if (hasValidDeviation) {
                    const absDeviation = Math.abs(priceDeviation);
                    description = priceDeviation < 0 
                        ? `Your limit sell at ${formatCurrency(order.price)} targets ${absDeviation.toFixed(1)}% profit.`
                        : `Your limit sell at ${formatCurrency(order.price)} is ${absDeviation.toFixed(1)}% below market.`;
                } else {
                    description = `Limit sell order at ${formatCurrency(order.price)} awaiting fill.`;
                }
            }
            
            addSignal({
                id: `order-${orderId}`,
                type: 'ORDER_RECOMMENDATION',
                symbol: order.symbol || 'Unknown',
                title: 'Spot Order',
                description,
                timestamp: order.timestamp || now - 1200000,
                priority: 'low',
                data: {
                    price: currentPrice,
                    limitPrice: order.price,
                    amount: order.amount,
                    amountUsd,
                    exchange: conn?.name || order.exchange || 'Exchange',
                    orderSide: order.side as 'buy' | 'sell',
                    stablecoinAlloc: stablecoinStats.stablecoinAlloc,
                    stablecoinValue: stablecoinStats.stablecoinValue,
                    priceDeviation: hasValidDeviation ? priceDeviation : undefined
                }
            });
        });
        
        // 4. Demo AI insights (only if we have few real signals) – exclude stablecoins so feed isn’t cluttered with USDT/USDC
        if (newSignals.length < 3) {
            addSignal({
                id: 'structure-apt',
                type: 'STRUCTURE_BREAK',
                symbol: 'APT',
                title: 'Structure Break',
                description: 'Major resistance flipped to support on the 4H timeframe.',
                timestamp: now - 1740000,
                priority: 'low',
                data: {}
            });
        }
        
        // Sort by timestamp
        return newSignals.sort((a, b) => b.timestamp - a.timestamp);
    }, [snapshot, refreshKey, stablecoinStats, tpThresholdPct, dcaThresholdPct]);

    // Playbook plan summary cards (active spot/perp plans)
    const planSummarySignals = useMemo((): AlphaSignal[] => {
        const out: AlphaSignal[] = [];
        const now = Date.now();
        const priceForSymbol = (symbol: string) => {
            const key = symbol.toUpperCase();
            return assetPriceBySymbol.get(key) || screenerBySymbol.get(key)?.price || 0;
        };

        const getOiTrades = (symbol: string) => {
            const key = normalizeSymbol(symbol);
            const data = screenerBySymbol.get(key);
            return {
                openInterest: data?.openInterest,
                trades15m: data?.trades15m,
            };
        };

        const getSocial = (symbol: string) => {
            const key = normalizeSymbol(symbol);
            return socialBySymbol.get(key);
        };

        spotPlans.filter((p) => p.isActive).forEach((plan) => {
            const price = priceForSymbol(plan.symbol);
            const oiTrades = getOiTrades(plan.symbol);
            const social = getSocial(plan.symbol);
            const plannedSize = plan.plannedOrderSizes?.entry_low
                ?? plan.plannedOrderSizes?.entry_high
                ?? plan.plannedOrderSizes?.target
                ?? 0;
            const filledSize = plan.filledOrderSizes?.entry_low
                ?? plan.filledOrderSizes?.entry_high
                ?? plan.filledOrderSizes?.target
                ?? 0;
            const levelDistances = (() => {
                if (!price) return '';
                const levels = plan.keyLevels || {};
                const entries: Array<{ label: string; value: number }> = [];
                ([
                    ['D_VAH', 'D VAH'], ['D_VAL', 'D VAL'], ['D_POC', 'D POC'],
                    ['W_VAH', 'W VAH'], ['W_VAL', 'W VAL'], ['W_POC', 'W POC'],
                    ['M_VAH', 'M VAH'], ['M_VAL', 'M VAL'], ['M_POC', 'M POC'],
                    ['S_VAH', 'S VAH'], ['S_VAL', 'S VAL'], ['S_POC', 'S POC'],
                ] as Array<[KeyLevel, string]>).forEach(([k, label]) => {
                    const v = levels[k];
                    if (v && v > 0) entries.push({ label, value: v });
                });
                return entries
                    .slice(0, 4)
                    .map((e) => {
                        const pct = ((e.value - price) / price) * 100;
                        return `${e.label} ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
                    })
                    .join(' · ');
            })();
            out.push({
                id: `playbook-plan-spot-${plan.id}`,
                type: "PLAYBOOK_PLAN_LEVELS",
                symbol: plan.symbol,
                title: `Spot plan: ${plan.symbol}`,
                description: `${plan.valueAcceptance && plan.valueAcceptance !== "in_progress" ? `Value ${plan.valueAcceptance.replace("_", " ")}.` : "Entry zone, targets, and stop from your playbook."}${levelDistances ? ` Next comps: ${levelDistances}.` : ''}`,
                timestamp: plan.updatedAt ?? plan.createdAt ?? now,
                priority: "medium",
                data: {
                    planType: "spot",
                    entryZone: plan.entryZone,
                    targets: plan.targets?.length ? plan.targets : undefined,
                    stopLoss: plan.stopLoss,
                    buyLimits: plan.buyLimits?.length ? plan.buyLimits : undefined,
                    sellLimits: plan.sellLimits?.length ? plan.sellLimits : undefined,
                    compositeType: plan.compositeTag,
                    valueRotationCount: plan.valueRotationCount,
                    valueTestCount: plan.valueTestCount,
                    valueAcceptance: plan.valueAcceptance,
                    profileContext: plan.profileContext,
                    openInterest: oiTrades.openInterest,
                    trades15m: oiTrades.trades15m,
                    socialMentions: social?.count,
                    socialTop: social?.top,
                    econEvents: econEvents.length ? econEvents : undefined,
                    plannedSize: plannedSize || undefined,
                    filledSize: filledSize || undefined,
                },
            });
        });
        perpPlans.filter((p) => p.isActive).forEach((plan) => {
            const oiTrades = getOiTrades(plan.symbol);
            const social = getSocial(plan.symbol);
            const plannedSize = plan.plannedOrderSizes?.entry_low
                ?? plan.plannedOrderSizes?.entry_high
                ?? plan.plannedOrderSizes?.target
                ?? 0;
            const filledSize = plan.filledOrderSizes?.entry_low
                ?? plan.filledOrderSizes?.entry_high
                ?? plan.filledOrderSizes?.target
                ?? 0;
            const price = priceForSymbol(plan.symbol);
            const levelDistances = (() => {
                if (!price) return '';
                const levels = plan.keyLevels || {};
                const entries: Array<{ label: string; value: number }> = [];
                ([
                    ['D_VAH', 'D VAH'], ['D_VAL', 'D VAL'], ['D_POC', 'D POC'],
                    ['W_VAH', 'W VAH'], ['W_VAL', 'W VAL'], ['W_POC', 'W POC'],
                    ['M_VAH', 'M VAH'], ['M_VAL', 'M VAL'], ['M_POC', 'M POC'],
                    ['S_VAH', 'S VAH'], ['S_VAL', 'S VAL'], ['S_POC', 'S POC'],
                ] as Array<[KeyLevel, string]>).forEach(([k, label]) => {
                    const v = levels[k];
                    if (v && v > 0) entries.push({ label, value: v });
                });
                return entries
                    .slice(0, 4)
                    .map((e) => {
                        const pct = ((e.value - price) / price) * 100;
                        return `${e.label} ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
                    })
                    .join(' · ');
            })();
            out.push({
                id: `playbook-plan-perp-${plan.id}`,
                type: "PLAYBOOK_PLAN_LEVELS",
                symbol: plan.symbol,
                title: `Perp plan: ${plan.symbol}`,
                description: `${plan.valueAcceptance && plan.valueAcceptance !== "in_progress" ? `Value ${plan.valueAcceptance.replace("_", " ")}.` : "Entry zone, targets, and stop from your playbook."}${levelDistances ? ` Next comps: ${levelDistances}.` : ''}`,
                timestamp: plan.updatedAt ?? plan.createdAt ?? now,
                priority: "medium",
                data: {
                    planType: "perp",
                    entryZone: plan.entryZone,
                    targets: plan.targets?.length ? plan.targets : undefined,
                    stopLoss: plan.stopLoss,
                    compositeType: plan.compositeTag,
                    valueRotationCount: plan.valueRotationCount,
                    valueTestCount: plan.valueTestCount,
                    valueAcceptance: plan.valueAcceptance,
                    profileContext: plan.profileContext,
                    openInterest: oiTrades.openInterest,
                    trades15m: oiTrades.trades15m,
                    socialMentions: social?.count,
                    socialTop: social?.top,
                    econEvents: econEvents.length ? econEvents : undefined,
                    plannedSize: plannedSize || undefined,
                    filledSize: filledSize || undefined,
                },
            });
        });
        return out.sort((a, b) => b.timestamp - a.timestamp);
    }, [spotPlans, perpPlans, assetPriceBySymbol, screenerBySymbol, socialBySymbol, econEvents]);

    const compositeTriggerSignals = useMemo((): AlphaSignal[] => {
        const out: AlphaSignal[] = [];
        const now = Date.now();
        const tolerancePct = compositeTolerance || DEFAULT_COMPOSITE_TOLERANCE;
        const recent = compositeTriggeredRef.current || {};

        const compositeLevels = [
            { type: "session", levels: ["S_VAH", "S_VAL", "S_POC"], enabled: (plan: SpotPlan | PerpPlan) => plan.sessionCompositeEnabled ?? true },
            { type: "daily", levels: ["D_VAH", "D_VAL", "D_POC"], enabled: () => true },
            { type: "weekly", levels: ["W_VAH", "W_VAL", "W_POC"], enabled: () => true },
            { type: "monthly", levels: ["M_VAH", "M_VAL", "M_POC"], enabled: () => true },
        ] as const;

        const priceForSymbol = (symbol: string) => {
            const key = symbol.toUpperCase();
            return assetPriceBySymbol.get(key) || screenerBySymbol.get(key)?.price || 0;
        };

        const processPlan = (plan: SpotPlan | PerpPlan, planType: "spot" | "perp") => {
            const lastTrigger = recent[plan.symbol] || 0;
            if (now - lastTrigger < 12 * 60 * 60 * 1000) return;
            const price = priceForSymbol(plan.symbol);
            if (!price) return;

            const keyLevels = plan.keyLevels || {};
            const hits: Array<{ type: "session" | "daily" | "weekly" | "monthly"; levelType: string; levelValue: number }> = [];
            compositeLevels.forEach((group) => {
                if (!group.enabled(plan)) return;
                group.levels.forEach((lvl) => {
                    const value = (keyLevels as Record<string, number>)[lvl];
                    if (!value || value <= 0) return;
                    const diff = Math.abs((price - value) / value);
                    if (diff <= tolerancePct) {
                        hits.push({ type: group.type, levelType: lvl, levelValue: value });
                    }
                });
            });

            if (!hits.length) return;
            const stacked = hits.length > 1;
            const primary = hits[0];
            const compositeType = stacked ? "stacked" : primary.type;
            const rotation = plan.valueRotationCount ?? 0;
            const tests = plan.valueTestCount ?? 0;
            const acceptance = plan.valueAcceptance ?? "in_progress";
            const reactionKey = `${plan.symbol}-${primary.type}`;
            const reaction = compositeReactionRef.current[reactionKey];
            const qualityScore = (() => {
                if (!reaction || reaction.maxDrawdownPct == null || reaction.timeToReturnMinutes == null) return undefined;
                const dd = Math.min(10, Math.abs(reaction.maxDrawdownPct));
                const time = Math.min(120, Math.abs(reaction.timeToReturnMinutes));
                const score = Math.max(0, 100 - (dd * 6 + time * 0.5));
                return Math.round(score);
            })();

            out.push({
                id: `playbook-composite-${plan.id}-${primary.levelType}`,
                type: "PLAYBOOK_COMPOSITE_TRIGGER",
                symbol: plan.symbol,
                title: `${plan.symbol} ${compositeType.toUpperCase()} composite hit${stacked ? " (stacked)" : ""}`,
                description: `Touched ${KEY_LEVEL_LABELS[primary.levelType as keyof typeof KEY_LEVEL_LABELS] || primary.levelType} · ${rotation} rotations · ${tests} tests${reaction?.maxDrawdownPct != null ? ` · max DD ${reaction.maxDrawdownPct.toFixed(2)}%` : ''}${reaction?.timeToReturnMinutes != null ? ` · return ${Math.round(reaction.timeToReturnMinutes)}m` : ''}${reaction?.timeOutsideValueMinutes != null ? ` · outside ${Math.round(reaction.timeOutsideValueMinutes)}m` : ''}${qualityScore != null ? ` · quality ${qualityScore}` : ''}`,
                timestamp: now,
                priority: stacked || acceptance === "accepted" ? "high" : "medium",
                data: {
                    planType,
                    price,
                    compositeType,
                    compositeLevelType: primary.levelType,
                    compositeLevelValue: primary.levelValue,
                    valueRotationCount: rotation,
                    valueTestCount: tests,
                    valueAcceptance: acceptance,
                    profileContext: plan.profileContext,
                    lastProfit: qualityScore,
                },
            });
        };

        spotPlans.filter((p) => p.isActive).forEach((p) => processPlan(p, "spot"));
        perpPlans.filter((p) => p.isActive).forEach((p) => processPlan(p, "perp"));
        return out;
    }, [spotPlans, perpPlans, assetPriceBySymbol, screenerBySymbol, compositeTolerance]);

    useEffect(() => {
        const now = Date.now();
        const updateReaction = (plan: SpotPlan | PerpPlan) => {
            const price = assetPriceBySymbol.get(plan.symbol.toUpperCase()) || screenerBySymbol.get(normalizeSymbol(plan.symbol))?.price || 0;
            if (!price) return;
            const levels = plan.keyLevels || {};
            const composites = [
                { type: "session", vah: levels.S_VAH, val: levels.S_VAL, poc: levels.S_POC },
                { type: "daily", vah: levels.D_VAH, val: levels.D_VAL, poc: levels.D_POC },
                { type: "weekly", vah: levels.W_VAH, val: levels.W_VAL, poc: levels.W_POC },
                { type: "monthly", vah: levels.M_VAH, val: levels.M_VAL, poc: levels.M_POC },
            ] as const;

            composites.forEach((c) => {
                if (c.type === "session" && (plan.sessionCompositeEnabled ?? true) === false) return;
                if (!c.vah || !c.val) return;
                const key = `${plan.symbol}-${c.type}`;
                const state = compositeReactionRef.current[key] || {};

                if (state.lastTouchAt) {
                    const drawdownPct = ((price - (state.levelValue || c.vah)) / (state.levelValue || c.vah)) * 100;
                    const maxDD = state.maxDrawdownPct == null ? drawdownPct : Math.min(state.maxDrawdownPct, drawdownPct);
                    state.maxDrawdownPct = maxDD;

                    const insideValue = price <= c.vah && price >= c.val;
                    if (!insideValue && !state.outsideStartAt) {
                        state.outsideStartAt = now;
                    }
                    if (insideValue && state.outsideStartAt) {
                        state.timeOutsideValueMinutes = (now - state.outsideStartAt) / 60000;
                        state.timeToReturnMinutes = (now - state.lastTouchAt) / 60000;
                        state.outsideStartAt = undefined;
                    }
                    compositeReactionRef.current[key] = state;
                }
            });
        };

        spotPlans.filter(p => p.isActive).forEach((p) => updateReaction(p));
        perpPlans.filter(p => p.isActive).forEach((p) => updateReaction(p));

        try {
            localStorage.setItem(AI_FEED_COMPOSITE_REACTION_KEY, JSON.stringify(compositeReactionRef.current));
        } catch {}
    }, [spotPlans, perpPlans, assetPriceBySymbol, screenerBySymbol]);

    const valueAcceptanceSignals = useMemo((): AlphaSignal[] => {
        const out: AlphaSignal[] = [];
        const now = Date.now();
        const addIfAccepted = (plan: SpotPlan | PerpPlan, planType: "spot" | "perp") => {
            if (!plan.valueAcceptance || plan.valueAcceptance === "in_progress") return;
            out.push({
                id: `playbook-acceptance-${plan.id}`,
                type: "PLAYBOOK_VALUE_ACCEPTANCE",
                symbol: plan.symbol,
                title: `${plan.symbol} value ${plan.valueAcceptance.replace("_", " ")}`,
                description: `Value ${plan.valueAcceptance.replace("_", " ")} · ${plan.valueRotationCount ?? 0} rotations · ${plan.valueTestCount ?? 0} tests.`,
                timestamp: plan.updatedAt ?? plan.createdAt ?? now,
                priority: plan.valueAcceptance === "accepted" ? "high" : "medium",
                data: {
                    planType,
                    valueRotationCount: plan.valueRotationCount,
                    valueTestCount: plan.valueTestCount,
                    valueAcceptance: plan.valueAcceptance,
                    compositeType: plan.compositeTag,
                    profileContext: plan.profileContext,
                },
            });
        };
        spotPlans.filter((p) => p.isActive).forEach((p) => addIfAccepted(p, "spot"));
        perpPlans.filter((p) => p.isActive).forEach((p) => addIfAccepted(p, "perp"));
        return out;
    }, [spotPlans, perpPlans]);

    const journalInsightSignals = useMemo((): AlphaSignal[] => {
        const out: AlphaSignal[] = [];
        const now = Date.now();
        const tokenSet = (text: string) => new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2));
        const similarity = (a: string, b: string) => {
            const as = tokenSet(a);
            const bs = tokenSet(b);
            if (!as.size || !bs.size) return 0;
            let inter = 0;
            as.forEach((t) => { if (bs.has(t)) inter++; });
            return inter / Math.max(as.size, bs.size);
        };

        const getPrice = (symbol: string) => assetPriceBySymbol.get(symbol.toUpperCase()) || screenerBySymbol.get(normalizeSymbol(symbol))?.price || 0;

        const activeSymbols = new Set<string>([
            ...spotPlans.filter(p => p.isActive).map(p => normalizeSymbol(p.symbol)),
            ...perpPlans.filter(p => p.isActive).map(p => normalizeSymbol(p.symbol)),
        ]);

        activeSymbols.forEach((symbol) => {
            const annList = (annotationsBySymbol.get(symbol) || []).slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
            if (annList.length < 2) return;
            const latest = annList[0];
            const prev = annList.find((a) => a.strategyTag === latest.strategyTag && a.marketProfile?.profileType === latest.marketProfile?.profileType);
            if (!prev || prev.id === latest.id) return;

            const notesA = `${latest.notes || ''} ${latest.marketProfile?.context || ''}`.trim();
            const notesB = `${prev.notes || ''} ${prev.marketProfile?.context || ''}`.trim();
            const sim = similarity(notesA, notesB);
            if (sim >= 0.4) {
                const latestTrade = journalTradesById.get(latest.tradeId);
                const prevTrade = journalTradesById.get(prev.tradeId);
                const latestPnl = latestTrade?.pnl ?? 0;
                const prevPnl = prevTrade?.pnl ?? 0;
                const improved = latest.executionQuality > prev.executionQuality;

                if (prevPnl < 0 && latestPnl <= 0) {
                    out.push({
                        id: `journal-mistake-${symbol}-${latest.id}`,
                        type: "JOURNAL_REMINDER",
                        symbol,
                        title: `${symbol} similar mistake`,
                        description: `Similar setup to ${prevTrade?.timestamp ? new Date(prevTrade.timestamp).toLocaleDateString() : 'previous trade'} with negative result. Avoid repeating mistakes.`,
                        timestamp: now,
                        priority: "high",
                        data: {},
                    });
                } else if (improved) {
                    out.push({
                        id: `journal-improve-${symbol}-${latest.id}`,
                        type: "JOURNAL_REMINDER",
                        symbol,
                        title: `${symbol} improvement`,
                        description: `Execution quality improved vs last similar setup. Keep the same discipline.`,
                        timestamp: now,
                        priority: "medium",
                        data: {},
                    });
                }
            }

            const price = getPrice(symbol);
            const keyLevels = latest.marketProfile?.keyLevels || '';
            const levels = keyLevels.match(/[\d]+(?:\.\d+)?/g)?.map(Number) || [];
            const tol = 0.0025;
            const near = levels.find((lvl) => price && Math.abs((price - lvl) / lvl) <= tol);
            if (near) {
                const excerpt = (latest.notes || '').slice(0, 80);
                out.push({
                    id: `journal-level-${symbol}-${latest.id}`,
                    type: "JOURNAL_REMINDER",
                    symbol,
                    title: `${symbol} back at journal level`,
                    description: `Price near ${formatCurrency(near)}. Notes: ${excerpt || 'Review your last journal context.'}`,
                    timestamp: now,
                    priority: "medium",
                    data: {},
                });
            }
        });

        return out.slice(0, 6);
    }, [annotationsBySymbol, journalTradesById, assetPriceBySymbol, screenerBySymbol, spotPlans, perpPlans]);

    const planOrderInsights = useMemo(() => {
        const ORDER_TOL = compositeTolerance || DEFAULT_COMPOSITE_TOLERANCE;
        const byPlan = new Map<string, { planned: Record<string, number>; filled: Record<string, number>; lastProfit: Record<string, number> }>();
        const warnings: AlphaSignal[] = [];

        const isSpotOrder = (order: any) => {
            if (order?.isPerp === true) return false;
            if (order?.isPerp === false) return true;
            const symbol = order?.symbol || '';
            if (symbol.startsWith('@')) return true;
            const s = symbol.toUpperCase();
            if (s.includes('PERP') || s.includes('-SWAP') || s.includes('_PERP')) return false;
            if (s.startsWith('1000')) return false;
            if (/^U[A-Z]{2,4}$/.test(s)) return false;
            if (s.includes('_')) return false;
            const exchange = (order?.exchange || '').toLowerCase();
            if (exchange === 'hyperliquid' && !symbol.startsWith('@')) return false;
            return true;
        };

        const openOrders = (snapshot.spotOrders || []).filter(isSpotOrder);
        const txs = snapshot.transactions || [];

        const levelEntries = (plan: SpotPlan | PerpPlan) => {
            const entries: Array<{ key: string; value: number }> = [];
            Object.entries(plan.keyLevels || {}).forEach(([k, v]) => {
                if (v && v > 0) entries.push({ key: k, value: v });
            });
            if (plan.entryZone?.low) entries.push({ key: 'entry_low', value: plan.entryZone.low });
            if (plan.entryZone?.high) entries.push({ key: 'entry_high', value: plan.entryZone.high });
            if (plan.stopLoss) entries.push({ key: 'stop', value: plan.stopLoss });
            if (plan.targets?.length) entries.push({ key: 'target', value: plan.targets[0] });
            return entries;
        };

        const matchQty = (items: any[], symbol: string, price: number) => {
            const sym = normalizeSymbol(symbol);
            return items
                .filter((o) => !!o)
                .filter((o) => normalizeSymbol(o.symbol || o.asset || '') === sym)
                .filter((o) => {
                    const p = o.price || o.limitPrice || o.avgPrice || o.fillPrice || 0;
                    if (!p || !price) return false;
                    return Math.abs((p - price) / price) <= ORDER_TOL;
                })
                .reduce((sum, o) => {
                    const amt = o.amount ?? o.qty ?? o.size ?? o.quantity ?? 0;
                    return sum + (typeof amt === 'number' ? amt : parseFloat(amt) || 0);
                }, 0);
        };

        const lastTradeProfit = (symbol: string, price: number, current: number) => {
            const sym = normalizeSymbol(symbol);
            const matches = txs
                .filter((o) => !!o)
                .filter((o) => normalizeSymbol(o.symbol || o.asset || '') === sym)
                .filter((o) => {
                    const p = o.price || o.avgPrice || 0;
                    if (!p || !price) return false;
                    return Math.abs((p - price) / price) <= ORDER_TOL;
                })
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            if (!matches.length || !current) return undefined;
            const last = matches[0];
            const tradePrice = last.price || last.avgPrice || 0;
            if (!tradePrice) return undefined;
            const side = (last.side || last.type || '').toLowerCase();
            const isBuy = side === 'buy' || side === 'long' || last.type === 'Buy';
            const pnlPct = isBuy ? ((current - tradePrice) / tradePrice) * 100 : ((tradePrice - current) / tradePrice) * 100;
            return pnlPct;
        };

        const processPlan = (plan: SpotPlan | PerpPlan) => {
            const entries = levelEntries(plan);
            const planned = plan.plannedOrderSizes || {};
            const filled: Record<string, number> = {};
            const lastProfit: Record<string, number> = {};
            entries.forEach((entry) => {
                const plannedSize = planned[entry.key as keyof typeof planned] || 0;
                if (!plannedSize) return;
                const filledQty = matchQty(txs, plan.symbol, entry.value);
                filled[entry.key] = filledQty;
                const openQty = matchQty(openOrders, plan.symbol, entry.value);
                const price = assetPriceBySymbol.get(plan.symbol.toUpperCase()) || screenerBySymbol.get(normalizeSymbol(plan.symbol))?.price || 0;
                const profitPct = price ? lastTradeProfit(plan.symbol, entry.value, price) : undefined;
                if (profitPct != null) lastProfit[entry.key] = profitPct;
                if (price && Math.abs((price - entry.value) / entry.value) <= ORDER_TOL && openQty <= 0 && filledQty <= 0) {
                    const profitNote = profitPct != null ? ` Last time: ${profitPct >= 0 ? '+' : ''}${profitPct.toFixed(1)}%.` : '';
                    warnings.push({
                        id: `no-order-${plan.id}-${entry.key}`,
                        type: "LEVEL_NO_ORDER_WARNING",
                        symbol: plan.symbol,
                        title: `${plan.symbol} level has no order`,
                        description: `Price near ${KEY_LEVEL_LABELS[entry.key as keyof typeof KEY_LEVEL_LABELS] || entry.key} @ ${formatCurrency(entry.value)} but no open order. Planned size: ${plannedSize}.${profitNote}`,
                        timestamp: Date.now(),
                        priority: "high",
                        data: { plannedSize, price, levelType: entry.key, levelValue: entry.value, lastProfit: profitPct },
                    });
                }
            });
            byPlan.set(plan.id, { planned: planned as Record<string, number>, filled, lastProfit });
        };

        spotPlans.filter(p => p.isActive).forEach(processPlan);
        perpPlans.filter(p => p.isActive).forEach(processPlan);

        return { byPlan, warnings };
    }, [spotPlans, perpPlans, snapshot.spotOrders, snapshot.transactions, assetPriceBySymbol, screenerBySymbol, compositeTolerance]);

    const handbookRuleWarnings = useMemo((): AlphaSignal[] => {
        if (!perpPlans.length) return [];
        return evaluatePerpHandbookWarnings({
            perpPlans,
            screenerBySymbol,
            priceBySymbol: assetPriceBySymbol,
            now: Date.now(),
            touchTolerancePct: compositeTolerance || DEFAULT_COMPOSITE_TOLERANCE,
        }) as AlphaSignal[];
    }, [perpPlans, screenerBySymbol, assetPriceBySymbol, compositeTolerance]);

    useEffect(() => {
        const sameMap = (a?: Record<string, number>, b?: Record<string, number>) => {
            const aKeys = Object.keys(a || {});
            const bKeys = Object.keys(b || {});
            if (aKeys.length !== bKeys.length) return false;
            for (const k of aKeys) {
                if ((a as any)[k] !== (b as any)[k]) return false;
            }
            return true;
        };

        if (planOrderInsights.byPlan.size === 0) return;

        let spotChanged = false;
        const nextSpot = spotPlans.map((p) => {
            const info = planOrderInsights.byPlan.get(p.id);
            if (!info) return p;
            const sameFilled = sameMap(p.filledOrderSizes, info.filled);
            const sameProfit = sameMap(p.lastLevelProfit, info.lastProfit);
            if (sameFilled && sameProfit) return p;
            spotChanged = true;
            return { ...p, filledOrderSizes: info.filled, lastLevelProfit: info.lastProfit };
        });
        if (spotChanged) saveSpotPlans(nextSpot);

        let perpChanged = false;
        const nextPerp = perpPlans.map((p) => {
            const info = planOrderInsights.byPlan.get(p.id);
            if (!info) return p;
            const sameFilled = sameMap(p.filledOrderSizes, info.filled);
            const sameProfit = sameMap(p.lastLevelProfit, info.lastProfit);
            if (sameFilled && sameProfit) return p;
            perpChanged = true;
            return { ...p, filledOrderSizes: info.filled, lastLevelProfit: info.lastProfit };
        });
        if (perpChanged) savePerpPlans(nextPerp);
    }, [planOrderInsights, spotPlans, perpPlans]);

    // Journal reminder: recent portfolio transactions not in journal
    const journalReminderSignals = useMemo((): AlphaSignal[] => {
        const journalIds = new Set(journalTrades.map((t) => t.id));
        const cutoff = Date.now() - UNJOURNALED_DAYS * 24 * 60 * 60 * 1000;
        const recent = (snapshot.transactions ?? []).filter((tx) => tx.timestamp >= cutoff);
        const unjournaled = recent.filter((tx) => !journalIds.has(tx.id));
        if (unjournaled.length === 0) return [];
        const latest = Math.max(...unjournaled.map((t) => t.timestamp));
        return [{
            id: "journal-reminder-unjournaled",
            type: "JOURNAL_REMINDER",
            symbol: "Journal",
            title: "Journal reminder",
            description: `You have ${unjournaled.length} trade(s) not yet in your journal – add notes in Journal.`,
            timestamp: latest,
            priority: "medium",
            data: { unjournaledCount: unjournaled.length },
        }];
    }, [snapshot.transactions, journalTrades]);

    // Perp stop-loss reminder: 10x+ leverage, 2%+ drawdown (no stop-order check when orders not available)
    const perpStoplossSignals = useMemo((): AlphaSignal[] => {
        const posList = snapshot.positions ?? [];
        const out: AlphaSignal[] = [];
        const now = Date.now();
        posList.forEach((pos: { symbol: string; entryPrice: number; markPrice?: number; side?: string; leverage?: number; pnl?: number; size?: number }) => {
            const lev = pos.leverage ?? 0;
            if (lev <= 10) return;
            const entry = pos.entryPrice || 0;
            const mark = pos.markPrice ?? entry;
            if (entry <= 0) return;
            const side = (pos.side ?? "long") as "long" | "short";
            const pnlPercent = side === "long"
                ? ((mark - entry) / entry) * 100
                : ((entry - mark) / entry) * 100;
            if (pnlPercent > -2) return;
            out.push({
                id: `perp-stoploss-reminder-${pos.symbol}`,
                type: "PERP_STOPLOSS_REMINDER",
                symbol: pos.symbol,
                title: `Set stop loss – ${pos.symbol} (${lev}x) in drawdown`,
                description: `${pos.symbol} perp (${lev}x) is ${pnlPercent.toFixed(1)}% – set a stop loss to limit risk.`,
                timestamp: now,
                priority: pnlPercent <= -5 ? "high" : "medium",
                data: {
                    pnlPercent,
                    entryPrice: entry,
                    markPrice: mark,
                    side,
                    leverage: lev,
                },
            });
        });
        return out.sort((a, b) => (a.data?.pnlPercent ?? 0) - (b.data?.pnlPercent ?? 0));
    }, [snapshot.positions]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!compositeTriggerSignals.length) return;
        const now = Date.now();
        const current = compositeTriggeredRef.current || {};
        compositeTriggerSignals.forEach((s) => {
            current[s.symbol] = now;
            const type = (s.data?.compositeType && s.data.compositeType !== "stacked") ? s.data.compositeType : undefined;
            if (type) {
                const key = `${s.symbol}-${type}`;
                const existing = compositeReactionRef.current[key] || {};
                compositeReactionRef.current[key] = {
                    ...existing,
                    lastTouchAt: now,
                    levelValue: s.data?.compositeLevelValue,
                };
            }
        });
        compositeTriggeredRef.current = current;
        try {
            localStorage.setItem(AI_FEED_COMPOSITE_TRIGGER_KEY, JSON.stringify(current));
        } catch {}
        try {
            localStorage.setItem(AI_FEED_COMPOSITE_REACTION_KEY, JSON.stringify(compositeReactionRef.current));
        } catch {}
    }, [compositeTriggerSignals]);

    const allSignals = useMemo(() => {
        const merged = [
            ...playbookSignals,
            ...planSummarySignals,
            ...compositeTriggerSignals,
            ...valueAcceptanceSignals,
            ...planOrderInsights.warnings,
            ...handbookRuleWarnings,
            ...journalInsightSignals,
            ...journalReminderSignals,
            ...perpStoplossSignals,
            ...signals,
            ...additionalItems
        ];
        // Deduplicate PRICE_MEMORY per symbol - keep only the one with smallest priceDeviation
        const prMemBySymbol = new Map<string, AlphaSignal>();
        merged.forEach((s) => {
            if (s.type === 'PRICE_MEMORY') {
                const existing = prMemBySymbol.get(s.symbol);
                const dev = (s.data?.priceDeviation ?? 100) as number;
                const existingDev = existing ? ((existing.data?.priceDeviation ?? 100) as number) : 100;
                if (!existing || dev < existingDev) prMemBySymbol.set(s.symbol, s);
            }
        });
        const deduped = merged.filter((s) =>
            s.type !== 'PRICE_MEMORY' || prMemBySymbol.get(s.symbol)?.id === s.id
        );
        const filtered = allowedTypes?.length ? deduped.filter((s) => allowedTypes.includes(s.type)) : deduped;

        const ctx = buildScoreContext(snapshot.assets, snapshot.positions);
        const normalized: ScoredSignal[] = filtered.map((s) => {
            const kind: AIKind =
                s.type === "PLAYBOOK_PLAN_LEVELS" ? "PLAYBOOK" :
                s.type === "JOURNAL_REMINDER" ? "JOURNAL" :
                s.type === "PERP_STOPLOSS_REMINDER" ? "STOPLOSS" :
                s.type === "PLAYBOOK_COMPOSITE_TRIGGER" ? "PLAYBOOK" :
                s.type === "PLAYBOOK_VALUE_ACCEPTANCE" ? "PLAYBOOK" :
                s.type === "LEVEL_NO_ORDER_WARNING" ? "PLAYBOOK" :
                s.type === "PLAYBOOK_RULE_WARNING" ? "PLAYBOOK" :
                s.type === "ECONOMIC_EVENT" ? "ECONOMIC" :
                s.type === "FUTURES_INSIGHT" ? "POSITION" :
                s.type === "TRX_ACTIVITY" ? "ACTIVITY" :
                s.type === "SOCIAL_MENTION" ? "SOCIAL" :
                "INFO";
            const source: AISource =
                s.data?.source === "SCREENER" ? "screener" :
                s.data?.source === "x" ? "x" :
                variant === "global" ? "global" : "global";
            return {
                ...s,
                kind,
                source,
                score: 0,
            } as ScoredSignal;
        });

        const scored = normalized.map((s) => ({ ...s, score: scoreSignal(s, ctx) }));
        const dedupedScored = dedupeSignals(scored);
        const sorted = dedupedScored.sort((a, b) => b.score - a.score || b.timestamp - a.timestamp);

        return sorted.map((s) => ({ ...s, kind: s.kind, source: s.source, score: s.score })) as AlphaSignal[];
    }, [playbookSignals, planSummarySignals, compositeTriggerSignals, valueAcceptanceSignals, planOrderInsights, handbookRuleWarnings, journalInsightSignals, journalReminderSignals, perpStoplossSignals, signals, additionalItems, allowedTypes, snapshot.assets, snapshot.positions, variant]);

    // Process signals for external alerts (Discord, Telegram, etc.)
    useEffect(() => {
        if (!alertsEnabled || allSignals.length === 0) return;
        
        // Only process new high-priority signals that haven't been processed
        const newSignalsToAlert = allSignals.filter(signal => {
            // Skip if already processed
            if (lastProcessedSignalsRef.current.has(signal.id)) return false;
            
            // Only alert for high and medium priority signals
            if (signal.priority === 'low') return false;
            
            // Mark as processed
            lastProcessedSignalsRef.current.add(signal.id);
            return true;
        });
        
        if (newSignalsToAlert.length > 0) {
            processAISignals(newSignalsToAlert.map(s => ({
                id: s.id,
                type: s.type as any,
                symbol: s.symbol,
                title: s.title,
                description: s.description,
                priority: s.priority,
                data: s.data,
            })));
        }
        
        // Cleanup old processed signals (keep last 100)
        if (lastProcessedSignalsRef.current.size > 100) {
            const entries = Array.from(lastProcessedSignalsRef.current);
            lastProcessedSignalsRef.current = new Set(entries.slice(-50));
        }
    }, [allSignals, alertsEnabled, processAISignals]);
    
    // Manual refresh handler - update snapshot immediately so feed recomputes
    const handleRefresh = useCallback(() => {
        baseTimeRef.current = Date.now();
        lastSnapshotRef.current = 0;
        setSnapshot({
            assets,
            transactions: transactions ?? [],
            transfers: transfers ?? [],
            spotOrders: spotOrders ?? [],
            connections: connections ?? [],
            positions: positions ?? [],
        });
        setRefreshKey((k) => k + 1);
    }, [assets, transactions, transfers, spotOrders, connections, positions]);
    
    const visibleSignals = allSignals.filter((s) => !isSuppressed(memoryRef.current, s.id));
    const displaySignals = showAll ? visibleSignals : visibleSignals.slice(0, compact ? 6 : 10);
    const loading = assets.length === 0;
    const emptyCopy = useMemo(() => {
        if (allowedTypes?.length === 1 && allowedTypes[0] === "SOCIAL_MENTION") {
            return {
                title: "No social posts",
                subtitle: "No recent X posts matched your symbols.",
            };
        }
        return {
            title: "No active signals",
            subtitle: "No active plans or reminders for this view.",
        };
    }, [allowedTypes]);
    const highPriorityCount = visibleSignals.filter((s) => s.priority === "high").length;
    const newSignalsCount = user && cloudSyncEnabled && lastSeenTimestamp > 0
        ? visibleSignals.filter((s) => s.timestamp > lastSeenTimestamp).length
        : 0;

    return (
        <div
            className={cn(
                "tm-premium-card relative isolate flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border bg-zinc-950/85 transition-all duration-300",
                variant === "global"
                    ? "border-white/12 hover:border-white/20 bg-gradient-to-br from-zinc-950/95 via-zinc-950/82 to-zinc-900/90"
                    : "border-white/[0.1] bg-gradient-to-br from-zinc-950/92 via-zinc-950/78 to-zinc-900/84",
                className
            )}
        >
            <motion.div
                className="pointer-events-none absolute -left-14 -top-10 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl"
                animate={{ opacity: [0.14, 0.34, 0.14], x: [0, 16, 0], y: [0, 10, 0] }}
                transition={{ duration: 8.5, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
                className="pointer-events-none absolute right-[-3rem] top-[-2rem] h-44 w-44 rounded-full bg-cyan-500/10 blur-3xl"
                animate={{ opacity: [0.1, 0.3, 0.1], x: [0, -12, 0], y: [0, 8, 0] }}
                transition={{ duration: 9.5, repeat: Infinity, ease: "easeInOut" }}
            />
            {/* Header */}
            <div className={cn(
                "relative z-10 flex items-center justify-between border-b border-white/[0.08] bg-gradient-to-r from-indigo-500/[0.08] via-cyan-500/[0.03] to-transparent",
                compact ? "px-3 py-3" : "p-4"
            )}>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/25">
                            <Sparkles className="w-4 h-4 text-indigo-400" />
                        </div>
                        <motion.div
                            className="absolute inset-0 rounded-lg bg-indigo-300/15"
                            animate={{ opacity: [0.1, 0.35, 0.1] }}
                            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                        />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">
                            {variant === "global" ? "Global AI Feed" : "Neural Alpha Feed"}
                        </h3>
                        {!compact && (
                            <p className="text-[9px] text-zinc-500 uppercase tracking-widest">
                                {variant === "global" ? "Spot · Balances · Playbooks · Calendar · Futures · Trx" : "Real-Time Intelligence"}
                            </p>
                        )}
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    {!compact && (
                        <div className="hidden lg:flex items-center gap-1.5">
                            <span className="inline-flex items-center rounded-full border border-rose-400/25 bg-rose-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-rose-300">
                                {highPriorityCount} high
                            </span>
                            {newSignalsCount > 0 && (
                                <span className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-300">
                                    {newSignalsCount} new
                                </span>
                            )}
                        </div>
                    )}
                    <button 
                        onClick={handleRefresh}
                        className="p-1.5 rounded-lg bg-zinc-800/50 border border-white/5 hover:bg-white/5 transition-colors"
                        title="Refresh signals"
                    >
                        <RefreshCw className="w-3 h-3 text-zinc-400 hover:text-white transition-colors" />
                    </button>
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[9px] font-black text-emerald-400 uppercase">Live</span>
                    </div>
                </div>
            </div>

            {/* Signals List */}
            <div className="relative z-10 flex-1 min-h-0 overflow-y-auto optimize-scroll py-2">
                <div className="pointer-events-none sticky top-0 z-10 h-4 bg-gradient-to-b from-zinc-950/95 to-transparent" />
                {loading ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-12">
                        <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                        <ShiningText
                            text={variant === "global" ? "Global AI is thinking..." : "Neural Alpha is thinking..."}
                            className="text-xs tracking-wide"
                        />
                    </div>
                ) : displaySignals.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Eye className="w-8 h-8 text-zinc-600 mb-2" />
                        <p className="text-xs text-zinc-500">{emptyCopy.title}</p>
                        <p className="text-[10px] text-zinc-600">{emptyCopy.subtitle}</p>
                    </div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {displaySignals.map((signal, idx) => (
                            <SignalCard
                                key={signal.id}
                                signal={signal}
                                onDismiss={() => handleDismiss(signal.id, { type: signal.type, symbol: signal.symbol })}
                                onSnooze={
                                    signal.type === "PERP_STOPLOSS_REMINDER" || signal.type === "FUTURES_INSIGHT"
                                        ? () => handleSnooze(signal.id, { type: signal.type, symbol: signal.symbol })
                                        : undefined
                                }
                                isNew={!!(user && cloudSyncEnabled && lastSeenTimestamp > 0 && signal.timestamp > lastSeenTimestamp)}
                                isTop={idx === 0}
                                compact={compact}
                            />
                        ))}
                    </AnimatePresence>
                )}
                <div className="pointer-events-none sticky bottom-0 z-10 h-5 bg-gradient-to-t from-zinc-950/95 to-transparent" />
            </div>
            
            {/* Load More */}
            {visibleSignals.length > (compact ? 6 : 10) && (
                <button
                    onClick={() => setShowAll(!showAll)}
                    className="flex items-center justify-center gap-2 p-3 border-t border-white/[0.03] text-[10px] font-bold text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02] transition-colors uppercase tracking-wider"
                >
                    <ChevronDown className={cn("w-3 h-3 transition-transform", showAll && "rotate-180")} />
                    {showAll ? "Show Less" : `Load Historical Alpha (${visibleSignals.length - (compact ? 6 : 10)} more)`}
                </button>
            )}
        </div>
    );
});

export default NeuralAlphaFeed;
