"use client";

import { memo, useState, useMemo, useCallback, useRef, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";
import { calculateIndianAssetAnalytics } from "@/lib/utils/indian-markets-analytics";
import { getLatestNav } from "@/lib/api/indian-mf";
import { getBatchPrices } from "@/lib/api/indian-stocks";
import type { IndianTransaction } from "@/lib/api/indian-markets-types";
import {
    Sparkles,
    TrendingUp,
    TrendingDown,
    Clock,
    Target,
    ChevronDown,
    RefreshCw,
    Bell,
    ShieldAlert,
    Layers,
    Eye,
    Landmark,
    BarChart2,
} from "lucide-react";

// Signal types for Indian Markets feed
type SignalType =
    | "SELL_SIGNAL"
    | "BUY_SIGNAL"
    | "TAKE_PROFIT"
    | "SET_TP_ALERT"
    | "SET_SL_ALERT"
    | "DCA_LEVELS"
    | "PRICE_MEMORY"
    | "VOLATILITY_ALERT";

interface IndianAlphaSignal {
    id: string;
    type: SignalType;
    symbol: string;
    name: string;
    assetType: "mf" | "stock";
    title: string;
    description: string;
    timestamp: number;
    priority: "high" | "medium" | "low";
    data?: {
        price?: number;
        targetPrice?: number;
        avgBuyPrice?: number;
        pnlPercent?: number;
        pnlInr?: number;
        holdingValue?: number;
        hasNoOrder?: boolean;
        tpLevels?: { price: number; percent: number }[];
        slLevels?: { price: number; percent: number }[];
        memoryPrice?: number;
        memoryType?: "buy" | "sell";
        memoryDate?: number;
        holdingBalance?: number;
        holdingEmpty?: boolean;
        aiRecommendation?: string;
        daysSinceTrade?: number;
    };
}

const SIGNAL_CONFIGS: Record<
    SignalType,
    { icon: React.ElementType; color: string; bgColor: string }
> = {
    SELL_SIGNAL: {
        icon: TrendingDown,
        color: "text-rose-400",
        bgColor: "bg-rose-500/10",
    },
    BUY_SIGNAL: {
        icon: TrendingUp,
        color: "text-emerald-400",
        bgColor: "bg-emerald-500/10",
    },
    TAKE_PROFIT: {
        icon: Target,
        color: "text-emerald-400",
        bgColor: "bg-emerald-500/10",
    },
    SET_TP_ALERT: {
        icon: Bell,
        color: "text-emerald-400",
        bgColor: "bg-emerald-500/10",
    },
    SET_SL_ALERT: {
        icon: ShieldAlert,
        color: "text-rose-400",
        bgColor: "bg-rose-500/10",
    },
    DCA_LEVELS: {
        icon: Layers,
        color: "text-cyan-400",
        bgColor: "bg-cyan-500/10",
    },
    PRICE_MEMORY: {
        icon: Clock,
        color: "text-amber-400",
        bgColor: "bg-amber-500/10",
    },
    VOLATILITY_ALERT: {
        icon: ShieldAlert,
        color: "text-amber-400",
        bgColor: "bg-amber-500/10",
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

function formatInr(value: number): string {
    return formatCurrency(value, "INR");
}

const IndianSignalCard = memo(function IndianSignalCard({
    signal,
}: {
    signal: IndianAlphaSignal;
}) {
    const config = SIGNAL_CONFIGS[signal.type];
    const Icon = config.icon;
    const AssetIcon =
        signal.assetType === "mf" ? (
            <Landmark className="w-5 h-5 text-amber-400" />
        ) : (
            <BarChart2 className="w-5 h-5 text-indigo-400" />
        );

    return (
        <div
            className={`group relative p-4 border-b border-white/[0.03] hover:bg-white/[0.02] transition-all cursor-pointer ${signal.priority === "high" ? "bg-gradient-to-r from-rose-500/5 to-transparent" : ""}`}
        >
            {signal.priority === "high" && (
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-rose-500" />
            )}
            <div className="flex items-start gap-3">
                <div className="relative">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center bg-zinc-800/80 border border-white/10">
                        {AssetIcon}
                    </div>
                    <div
                        className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border border-zinc-800 ${config.bgColor}`}
                    >
                        <Icon className={`w-2.5 h-2.5 ${config.color}`} />
                    </div>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-black text-white truncate">
                            {signal.name || signal.symbol}
                        </span>
                        <div className="flex items-center gap-1 text-[10px] text-zinc-500 shrink-0">
                            <Clock className="w-2.5 h-2.5" />
                            {formatTimeAgo(signal.timestamp)}
                        </div>
                    </div>
                    <div
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider mt-1 ${config.bgColor} ${config.color}`}
                    >
                        <Icon className="w-2.5 h-2.5" />
                        {signal.title}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1.5 leading-relaxed">
                        {signal.description}
                    </p>
                    {signal.data && (
                        <div className="mt-2 space-y-1.5">
                            {(signal.data.price ?? signal.data.targetPrice) && (
                                <div className="flex items-center gap-3 text-[10px]">
                                    {signal.data.price !== undefined && (
                                        <div className="flex items-center gap-1">
                                            <span className="text-zinc-500">Current:</span>
                                            <span className="font-mono font-bold text-zinc-300">
                                                {formatInr(signal.data.price)}
                                            </span>
                                        </div>
                                    )}
                                    {signal.data.targetPrice !== undefined && (
                                        <div className="flex items-center gap-1">
                                            <Target className="w-2.5 h-2.5 text-emerald-400" />
                                            <span className="text-zinc-500">Target:</span>
                                            <span className="font-mono font-bold text-emerald-400">
                                                {formatInr(signal.data.targetPrice)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                            {signal.data.pnlPercent !== undefined && (
                                <div className="flex items-center gap-2 text-[10px]">
                                    <span className="text-zinc-500">PnL:</span>
                                    <span
                                        className={
                                            signal.data.pnlPercent >= 0
                                                ? "font-mono font-bold text-emerald-400"
                                                : "font-mono font-bold text-rose-400"
                                        }
                                    >
                                        {signal.data.pnlPercent >= 0 ? "+" : ""}
                                        {signal.data.pnlPercent.toFixed(2)}%
                                    </span>
                                    {signal.data.pnlInr !== undefined && (
                                        <span
                                            className={
                                                signal.data.pnlInr >= 0
                                                    ? "font-mono font-bold px-1.5 py-0.5 rounded text-emerald-400 bg-emerald-500/10"
                                                    : "font-mono font-bold px-1.5 py-0.5 rounded text-rose-400 bg-rose-500/10"
                                            }
                                        >
                                            {signal.data.pnlInr >= 0 ? "+" : ""}
                                            {formatInr(signal.data.pnlInr)}
                                        </span>
                                    )}
                                </div>
                            )}
                            {signal.type === "SET_TP_ALERT" && signal.data.tpLevels && (
                                <div className="mt-2 space-y-1.5">
                                    <div className="flex items-center gap-1 text-[9px] text-zinc-500 uppercase font-bold">
                                        <Target className="w-3 h-3 text-emerald-400" />
                                        Suggested Take Profit Levels
                                    </div>
                                    <div className="grid grid-cols-3 gap-1">
                                        {signal.data.tpLevels.map((tp, i) => (
                                            <div
                                                key={i}
                                                className="flex flex-col items-center p-2 rounded bg-emerald-500/10 border border-emerald-500/20"
                                            >
                                                <span className="text-[10px] font-mono font-bold text-emerald-400">
                                                    {formatInr(tp.price)}
                                                </span>
                                                <span className="text-[8px] text-emerald-400/70">
                                                    +{tp.percent.toFixed(0)}%
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {signal.type === "SET_SL_ALERT" && signal.data.slLevels && (
                                <div className="mt-2 space-y-1.5">
                                    <div className="flex items-center gap-1 text-[9px] text-zinc-500 uppercase font-bold">
                                        <ShieldAlert className="w-3 h-3 text-rose-400" />
                                        Suggested Stop Loss Levels
                                    </div>
                                    <div className="grid grid-cols-3 gap-1">
                                        {signal.data.slLevels.map((sl, i) => (
                                            <div
                                                key={i}
                                                className="flex flex-col items-center p-2 rounded bg-rose-500/10 border border-rose-500/20"
                                            >
                                                <span className="text-[10px] font-mono font-bold text-rose-400">
                                                    {formatInr(sl.price)}
                                                </span>
                                                <span className="text-[8px] text-rose-400/70">
                                                    {sl.percent.toFixed(0)}%
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {signal.type === "PRICE_MEMORY" && signal.data.aiRecommendation && (
                                <div className="flex items-start gap-2 p-2 rounded bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                                    <p className="text-[10px] text-amber-200 leading-relaxed">
                                        {signal.data.aiRecommendation}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

interface IndianMarketsAlphaFeedProps {
    mfTransactions: IndianTransaction[];
    stockTransactions: IndianTransaction[];
    className?: string;
    compact?: boolean;
}

export const IndianMarketsAlphaFeed = memo(function IndianMarketsAlphaFeed({
    mfTransactions,
    stockTransactions,
    className,
    compact = false,
}: IndianMarketsAlphaFeedProps) {
    const [showAll, setShowAll] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [mfNavCache, setMfNavCache] = useState<
        Record<string, { nav: number; name?: string }>
    >({});
    const [stockPriceCache, setStockPriceCache] = useState<
        Record<string, { price: number; name?: string }>
    >({});
    const baseTimeRef = useRef(Date.now());

    const mfTx = useMemo(
        () => mfTransactions.filter((t) => t.type === "mf"),
        [mfTransactions]
    );
    const stockTx = useMemo(
        () => stockTransactions.filter((t) => t.type === "stock"),
        [stockTransactions]
    );

    const mfPositions = useMemo(() => {
        const map = new Map<
            string,
            { name: string; schemeCode?: number; balance: number }
        >();
        mfTx.forEach((t) => {
            const cur = map.get(t.symbol) || {
                name: t.name,
                schemeCode: t.schemeCode,
                balance: 0,
            };
            cur.balance += t.side === "buy" ? t.amount : -t.amount;
            map.set(t.symbol, cur);
        });
        return Array.from(map.entries())
            .filter(([, p]) => p.balance > 0)
            .map(([symbol, p]) => ({ symbol, ...p }));
    }, [mfTx]);

    const stockPositions = useMemo(() => {
        const map = new Map<string, { name: string; balance: number }>();
        stockTx.forEach((t) => {
            const cur = map.get(t.symbol) || { name: t.name, balance: 0 };
            cur.balance += t.side === "buy" ? t.amount : -t.amount;
            map.set(t.symbol, cur);
        });
        return Array.from(map.entries())
            .filter(([, p]) => p.balance > 0)
            .map(([symbol, p]) => ({ symbol, ...p }));
    }, [stockTx]);

    useEffect(() => {
        if (mfPositions.length === 0) return;
        const cache: Record<string, { nav: number; name?: string }> = {};
        Promise.all(
            mfPositions.map(async (p) => {
                const res = await getLatestNav(parseInt(p.symbol, 10));
                const nav = res?.data?.[0]?.nav
                    ? parseFloat(res.data[0].nav)
                    : 0;
                if (nav > 0) cache[p.symbol] = { nav, name: p.name };
            })
        ).then(() => setMfNavCache(cache));
    }, [mfPositions]);

    useEffect(() => {
        if (stockPositions.length === 0) return;
        getBatchPrices(stockPositions.map((p) => p.symbol)).then((res) => {
            const cache: Record<string, { price: number; name?: string }> = {};
            (res?.stocks || []).forEach((s) => {
                cache[s.ticker] = {
                    price: s.last_price,
                    name: stockPositions.find((p) => p.symbol === s.ticker)
                        ?.name,
                };
            });
            setStockPriceCache(cache);
        });
    }, [stockPositions]);

    const signals = useMemo(() => {
        void refreshKey;
        const newSignals: IndianAlphaSignal[] = [];
        const seenIds = new Set<string>();
        const now = baseTimeRef.current;

        const addSignal = (signal: IndianAlphaSignal) => {
            if (!seenIds.has(signal.id)) {
                seenIds.add(signal.id);
                newSignals.push(signal);
            }
        };

        const MIN_HOLDING_VALUE_INR = 1000;

        mfPositions.forEach((pos) => {
            const navData = mfNavCache[pos.symbol];
            const nav = navData?.nav ?? 0;
            if (nav <= 0) return;

            const analytics = calculateIndianAssetAnalytics(
                pos.symbol,
                pos.balance,
                nav,
                mfTx
            );
            const value = nav * pos.balance;
            const pnlPercent = analytics.unrealizedPnlPercent;
            const pnlInr = analytics.unrealizedPnl;

            if (value < MIN_HOLDING_VALUE_INR) return;

            if (analytics.avgBuyPrice > 0) {
                if (pnlPercent > 30) {
                    addSignal({
                        id: `tp-alert-mf-${pos.symbol}`,
                        type: "SET_TP_ALERT",
                        symbol: pos.symbol,
                        name: pos.name || pos.symbol,
                        assetType: "mf",
                        title: "Set Take Profit",
                        description: `${pos.name || pos.symbol} is +${pnlPercent.toFixed(0)}% in profit (${formatInr(pnlInr)}). Consider booking partial gains.`,
                        timestamp: now - 60000,
                        priority: pnlPercent > 75 ? "high" : "medium",
                        data: {
                            price: nav,
                            avgBuyPrice: analytics.avgBuyPrice,
                            pnlPercent,
                            pnlInr,
                            holdingValue: value,
                            hasNoOrder: true,
                            tpLevels: [
                                { price: nav * 1.1, percent: 10 + pnlPercent },
                                { price: nav * 1.25, percent: 25 + pnlPercent },
                                { price: nav * 1.5, percent: 50 + pnlPercent },
                            ],
                        },
                    });
                }
                if (pnlPercent > 50) {
                    addSignal({
                        id: `sell-mf-${pos.symbol}`,
                        type: "SELL_SIGNAL",
                        symbol: pos.symbol,
                        name: pos.name || pos.symbol,
                        assetType: "mf",
                        title: "Take Profit Zone",
                        description: `${pos.name || pos.symbol} is ${pnlPercent.toFixed(0)}% above your average buy. Consider redeeming some units.`,
                        timestamp: now - 180000,
                        priority: pnlPercent > 100 ? "high" : "medium",
                        data: {
                            price: nav,
                            avgBuyPrice: analytics.avgBuyPrice,
                            pnlPercent,
                            pnlInr,
                            targetPrice: analytics.avgBuyPrice * 1.25,
                        },
                    });
                }
                if (pnlPercent < -25) {
                    addSignal({
                        id: `sl-alert-mf-${pos.symbol}`,
                        type: "SET_SL_ALERT",
                        symbol: pos.symbol,
                        name: pos.name || pos.symbol,
                        assetType: "mf",
                        title: "Set Stop Loss",
                        description: `${pos.name || pos.symbol} is ${pnlPercent.toFixed(0)}% in loss (${formatInr(pnlInr)}). Consider partial exit or STP.`,
                        timestamp: now - 90000,
                        priority: pnlPercent < -40 ? "high" : "medium",
                        data: {
                            price: nav,
                            avgBuyPrice: analytics.avgBuyPrice,
                            pnlPercent,
                            pnlInr,
                            holdingValue: value,
                            slLevels: [
                                { price: nav * 0.95, percent: pnlPercent - 5 },
                                { price: nav * 0.9, percent: pnlPercent - 10 },
                                { price: nav * 0.85, percent: pnlPercent - 15 },
                            ],
                        },
                    });
                }
                if (pnlPercent < -20) {
                    addSignal({
                        id: `buy-mf-${pos.symbol}`,
                        type: "BUY_SIGNAL",
                        symbol: pos.symbol,
                        name: pos.name || pos.symbol,
                        assetType: "mf",
                        title: "DCA Opportunity",
                        description: `${pos.name || pos.symbol} is ${Math.abs(pnlPercent).toFixed(0)}% below your average. Good SIP/top-up zone.`,
                        timestamp: now - 420000,
                        priority: pnlPercent < -40 ? "high" : "medium",
                        data: {
                            price: nav,
                            avgBuyPrice: analytics.avgBuyPrice,
                            pnlPercent,
                            pnlInr,
                        },
                    });
                }
            }
        });

        stockPositions.forEach((pos) => {
            const p = stockPriceCache[pos.symbol];
            const price = p?.price ?? 0;
            if (price <= 0) return;

            const analytics = calculateIndianAssetAnalytics(
                pos.symbol,
                pos.balance,
                price,
                stockTx
            );
            const value = price * pos.balance;
            const pnlPercent = analytics.unrealizedPnlPercent;
            const pnlInr = analytics.unrealizedPnl;

            if (value < MIN_HOLDING_VALUE_INR) return;

            if (analytics.avgBuyPrice > 0) {
                if (pnlPercent > 30) {
                    addSignal({
                        id: `tp-alert-stock-${pos.symbol}`,
                        type: "SET_TP_ALERT",
                        symbol: pos.symbol,
                        name: pos.name || pos.symbol,
                        assetType: "stock",
                        title: "Set Take Profit",
                        description: `${pos.name || pos.symbol} is +${pnlPercent.toFixed(0)}% in profit (${formatInr(pnlInr)}). Consider booking partial gains.`,
                        timestamp: now - 60000,
                        priority: pnlPercent > 75 ? "high" : "medium",
                        data: {
                            price,
                            avgBuyPrice: analytics.avgBuyPrice,
                            pnlPercent,
                            pnlInr,
                            holdingValue: value,
                            tpLevels: [
                                { price: price * 1.1, percent: 10 + pnlPercent },
                                { price: price * 1.25, percent: 25 + pnlPercent },
                                { price: price * 1.5, percent: 50 + pnlPercent },
                            ],
                        },
                    });
                }
                if (pnlPercent > 50) {
                    addSignal({
                        id: `sell-stock-${pos.symbol}`,
                        type: "SELL_SIGNAL",
                        symbol: pos.symbol,
                        name: pos.name || pos.symbol,
                        assetType: "stock",
                        title: "Take Profit Zone",
                        description: `${pos.name || pos.symbol} is ${pnlPercent.toFixed(0)}% above your average buy. Consider selling partial.`,
                        timestamp: now - 180000,
                        priority: pnlPercent > 100 ? "high" : "medium",
                        data: {
                            price,
                            avgBuyPrice: analytics.avgBuyPrice,
                            pnlPercent,
                            pnlInr,
                            targetPrice: analytics.avgBuyPrice * 1.25,
                        },
                    });
                }
                if (pnlPercent < -25) {
                    addSignal({
                        id: `sl-alert-stock-${pos.symbol}`,
                        type: "SET_SL_ALERT",
                        symbol: pos.symbol,
                        name: pos.name || pos.symbol,
                        assetType: "stock",
                        title: "Set Stop Loss",
                        description: `${pos.name || pos.symbol} is ${pnlPercent.toFixed(0)}% in loss (${formatInr(pnlInr)}). Consider setting a stop loss.`,
                        timestamp: now - 90000,
                        priority: pnlPercent < -40 ? "high" : "medium",
                        data: {
                            price,
                            avgBuyPrice: analytics.avgBuyPrice,
                            pnlPercent,
                            pnlInr,
                            holdingValue: value,
                            slLevels: [
                                { price: price * 0.95, percent: pnlPercent - 5 },
                                { price: price * 0.9, percent: pnlPercent - 10 },
                                { price: price * 0.85, percent: pnlPercent - 15 },
                            ],
                        },
                    });
                }
                if (pnlPercent < -20) {
                    addSignal({
                        id: `buy-stock-${pos.symbol}`,
                        type: "BUY_SIGNAL",
                        symbol: pos.symbol,
                        name: pos.name || pos.symbol,
                        assetType: "stock",
                        title: "DCA Opportunity",
                        description: `${pos.name || pos.symbol} is ${Math.abs(pnlPercent).toFixed(0)}% below your average. Good accumulation zone.`,
                        timestamp: now - 420000,
                        priority: pnlPercent < -40 ? "high" : "medium",
                        data: {
                            price,
                            avgBuyPrice: analytics.avgBuyPrice,
                            pnlPercent,
                            pnlInr,
                        },
                    });
                }
            }
        });

        const totalMfValue = mfPositions.reduce(
            (s, p) => s + (mfNavCache[p.symbol]?.nav ?? 0) * p.balance,
            0
        );
        const totalStockValue = stockPositions.reduce(
            (s, p) => s + (stockPriceCache[p.symbol]?.price ?? 0) * p.balance,
            0
        );
        const totalValue = totalMfValue + totalStockValue;

        const allPositions: { symbol: string; name: string; balance: number; type: "mf" | "stock" }[] = [
            ...mfPositions.map((p) => ({ ...p, type: "mf" as const })),
            ...stockPositions.map((p) => ({ ...p, type: "stock" as const })),
        ];
        allPositions.forEach((pos) => {
            const price =
                pos.type === "mf"
                    ? mfNavCache[pos.symbol]?.nav ?? 0
                    : stockPriceCache[pos.symbol]?.price ?? 0;
            const value = price * pos.balance;
            if (totalValue <= 0 || value < MIN_HOLDING_VALUE_INR) return;
            const alloc = (value / totalValue) * 100;
            if (alloc > 30) {
                addSignal({
                    id: `concentration-${pos.symbol}`,
                    type: "VOLATILITY_ALERT",
                    symbol: pos.symbol,
                    name: pos.name || pos.symbol,
                    assetType: pos.type,
                    title: "Concentration Risk",
                    description: `${pos.name || pos.symbol} represents ${alloc.toFixed(1)}% of your Indian portfolio. Consider diversifying.`,
                    timestamp: now - 660000,
                    priority: alloc > 50 ? "high" : "medium",
                    data: { price },
                });
            }
        });

        const allTx = [...mfTx, ...stockTx];
        const nowMs = Date.now();
        const MIN_DAYS_AGO = 3;
        const PRICE_THRESHOLD = 15;

        const symbolTxMap = new Map<string, IndianTransaction[]>();
        allTx.forEach((tx) => {
            if (!symbolTxMap.has(tx.symbol)) symbolTxMap.set(tx.symbol, []);
            symbolTxMap.get(tx.symbol)!.push(tx);
        });

        symbolTxMap.forEach((txs, symbol) => {
            const isMf = txs[0]?.type === "mf";
            const currentPrice = isMf
                ? mfNavCache[symbol]?.nav ?? 0
                : stockPriceCache[symbol]?.price ?? 0;
            const pos = isMf
                ? mfPositions.find((p) => p.symbol === symbol)
                : stockPositions.find((p) => p.symbol === symbol);
            const holdingBalance = pos?.balance ?? 0;
            const holdingValue = currentPrice * holdingBalance;
            const holdingEmpty = holdingValue < 100;

            const sortedTxs = [...txs].sort((a, b) => a.timestamp - b.timestamp);

            sortedTxs.forEach((tx) => {
                const txPrice = tx.price || 0;
                const txTimestamp = tx.timestamp || 0;
                const daysSinceTrade = Math.floor(
                    (nowMs - txTimestamp) / (1000 * 60 * 60 * 24)
                );
                if (daysSinceTrade < MIN_DAYS_AGO || txPrice <= 0) return;

                const priceDistance =
                    currentPrice > 0
                        ? Math.abs((currentPrice - txPrice) / txPrice) * 100
                        : 100;
                const isPriceNear = priceDistance <= PRICE_THRESHOLD;

                if (isPriceNear) {
                    const isBuy = tx.side === "buy";
                    let aiRecommendation = "";
                    let title = "";
                    let description = "";
                    let priority: "high" | "medium" | "low" = "medium";

                    if (isBuy) {
                        title = "Price at Buy Level";
                        description = `${symbol} price (${formatInr(currentPrice)}) is near your buy price from ${daysSinceTrade} days ago.`;
                        if (holdingEmpty) {
                            aiRecommendation = `You bought at ${formatInr(txPrice)} ${daysSinceTrade} days ago and sold it all. Price is back! Consider re-entering if still bullish.`;
                            priority = "high";
                        } else {
                            aiRecommendation = `Price returned to your entry from ${daysSinceTrade} days ago. You hold ${holdingBalance.toLocaleString()} units (${formatInr(holdingValue)}). Good opportunity to DCA or hold.`;
                        }
                    } else {
                        title = "Price at Sell Level";
                        description = `${symbol} price (${formatInr(currentPrice)}) is near your sell price from ${daysSinceTrade} days ago.`;
                        if (holdingEmpty) {
                            aiRecommendation = `You sold at ${formatInr(txPrice)} ${daysSinceTrade} days ago. Price is back! Consider if you want to re-buy.`;
                            priority = "medium";
                        } else {
                            aiRecommendation = `Price returned to your sell level from ${daysSinceTrade} days ago. You hold ${holdingBalance.toLocaleString()} units (${formatInr(holdingValue)}). Consider taking profits again.`;
                            priority = "high";
                        }
                    }

                    if (aiRecommendation) {
                        addSignal({
                            id: `price-memory-${symbol}-${tx.id || txTimestamp}`,
                            type: "PRICE_MEMORY",
                            symbol,
                            name: pos?.name || symbol,
                            assetType: isMf ? "mf" : "stock",
                            title,
                            description,
                            timestamp: now - 30000,
                            priority,
                            data: {
                                price: currentPrice,
                                memoryPrice: txPrice,
                                memoryType: isBuy ? "buy" : "sell",
                                memoryDate: txTimestamp,
                                holdingBalance,
                                holdingValue,
                                holdingEmpty,
                                aiRecommendation,
                                daysSinceTrade,
                            },
                        });
                    }
                }
            });
        });

        return newSignals.sort((a, b) => b.timestamp - a.timestamp);
    }, [
        mfPositions,
        stockPositions,
        mfNavCache,
        stockPriceCache,
        mfTx,
        stockTx,
        refreshKey,
    ]);

    const handleRefresh = useCallback(() => {
        baseTimeRef.current = Date.now();
        setRefreshKey((k) => k + 1);
    }, []);

    const displaySignals = showAll ? signals : signals.slice(0, compact ? 8 : 12);
    const loading =
        (mfPositions.length > 0 || stockPositions.length > 0) &&
        (Object.keys(mfNavCache).length < mfPositions.length ||
            Object.keys(stockPriceCache).length < stockPositions.length);

    return (
        <div
            className={`flex flex-col rounded-xl bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 border border-white/[0.04] overflow-hidden ${className ?? ""}`}
        >
            <div className="flex items-center justify-between p-4 border-b border-white/[0.03]">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20">
                            <Landmark className="w-4 h-4 text-amber-400" />
                        </div>
                        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">
                            Indian Markets Alpha
                        </h3>
                        <p className="text-[9px] text-zinc-500 uppercase tracking-widest">
                            MF & Stock Intelligence
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleRefresh}
                        className="p-1.5 rounded-lg bg-zinc-800/50 border border-white/5 hover:bg-white/5 transition-colors"
                        title="Refresh signals"
                    >
                        <RefreshCw className="w-3 h-3 text-zinc-400 hover:text-white transition-colors" />
                    </button>
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[9px] font-black text-emerald-400 uppercase">
                            Live
                        </span>
                    </div>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[850px]">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : displaySignals.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Eye className="w-8 h-8 text-zinc-600 mb-2" />
                        <p className="text-xs text-zinc-500">No signals yet</p>
                        <p className="text-[10px] text-zinc-600">
                            Add MF or stock holdings to get AI insights
                        </p>
                    </div>
                ) : (
                    displaySignals.map((signal) => (
                        <IndianSignalCard key={signal.id} signal={signal} />
                    ))
                )}
            </div>
            {signals.length > (compact ? 8 : 12) && (
                <button
                    onClick={() => setShowAll(!showAll)}
                    className="flex items-center justify-center gap-2 p-3 border-t border-white/[0.03] text-[10px] font-bold text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02] transition-colors uppercase tracking-wider"
                >
                    <ChevronDown
                        className={`w-3 h-3 transition-transform ${showAll ? "rotate-180" : ""}`}
                    />
                    {showAll
                        ? "Show Less"
                        : `Load Historical Alpha (${signals.length - (compact ? 8 : 12)} more)`}
                </button>
            )}
        </div>
    );
});

export default IndianMarketsAlphaFeed;
