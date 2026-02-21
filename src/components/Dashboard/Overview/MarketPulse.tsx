"use client";

import { useScreenerData, type EnhancedTickerData } from "@/hooks/useScreenerData";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { Zap, Flame, Activity, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, memo } from "react";
import { cn } from "@/lib/utils";

const PREFERRED_PULSE_SYMBOLS = [
    "BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "LINK", "AVAX", "DOT", "MATIC",
    "UNI", "ATOM", "LTC", "BCH", "NEAR", "FIL", "INJ", "TIA", "ARB", "OP",
    "SUI", "SEI", "PEPE", "WIF", "APT", "STX", "JUP", "WLD", "STRK", "HYPE",
];
const PREFERRED_PULSE_SET = new Set(PREFERRED_PULSE_SYMBOLS);
const PULSE_SYMBOL_PATTERN = /^[A-Z0-9]{2,14}$/;
const MIN_LIQUIDITY_USD_24H = 5_000_000;
const MIN_RELAXED_LIQUIDITY_USD_24H = 1_500_000;
const MAX_MOVE_FOR_LIQUIDITY_FALLBACK = 40;
const MAX_RELAXED_MOVE = 80;

type PulseTicker = Pick<EnhancedTickerData, "symbol" | "price" | "change24h" | "volume24h" | "fundingRate" | "exchange">;

function sanitizeTicker(item: EnhancedTickerData): PulseTicker | null {
    const symbol = String(item?.symbol || "").toUpperCase().trim();
    if (!symbol || !PULSE_SYMBOL_PATTERN.test(symbol)) return null;
    if (!Number.isFinite(item.price) || item.price <= 0) return null;
    if (!Number.isFinite(item.change24h)) return null;
    if (!Number.isFinite(item.volume24h) || item.volume24h < 0) return null;
    return {
        symbol,
        price: item.price,
        change24h: item.change24h,
        volume24h: item.volume24h || 0,
        fundingRate: item.fundingRate || 0,
        exchange: item.exchange,
    };
}

const Item = memo(({
    item,
    onOpenChart,
    index,
    maxAbsMove
}: {
    item: PulseTicker;
    onOpenChart: (symbol: string, price?: number) => void;
    index: number;
    maxAbsMove: number;
}) => {
    const isUp = item.change24h >= 0;
    const intensity = maxAbsMove > 0 ? Math.min(100, (Math.abs(item.change24h) / maxAbsMove) * 100) : 0;

    return (
        <motion.button
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ delay: index * 0.04, duration: 0.28 }}
            whileHover={{ y: -3, scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className={cn(
                "group relative flex min-w-[148px] flex-col rounded-xl border p-3 text-left transition-all",
                "bg-[linear-gradient(165deg,rgba(16,17,23,0.76),rgba(9,10,14,0.86))] border-white/10 hover:border-white/20",
                isUp ? "shadow-[0_0_0_1px_rgba(16,185,129,0.14)]" : "shadow-[0_0_0_1px_rgba(244,63,94,0.14)]"
            )}
            style={{ willChange: "transform" }}
            onClick={() => onOpenChart(item.symbol, item.price)}
            title={`Open ${item.symbol} chart`}
        >
            <div className="absolute inset-0 pointer-events-none rounded-xl bg-gradient-to-br from-white/[0.04] via-transparent to-transparent opacity-60" />

            <div className="relative flex justify-between items-start mb-1.5">
                <span className="font-black text-white text-sm group-hover:text-indigo-300 transition-colors">{item.symbol}</span>
                <span className={cn(
                    "inline-flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded-md border",
                    isUp ? "text-emerald-300 border-emerald-500/25 bg-emerald-500/10" : "text-rose-300 border-rose-500/25 bg-rose-500/10"
                )}>
                    {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {item.change24h > 0 ? '+' : ''}{item.change24h.toFixed(2)}%
                </span>
            </div>

            <div className="relative text-zinc-300 font-mono text-xs mb-2">
                ${item.price.toLocaleString(undefined, { maximumSignificantDigits: 6 })}
            </div>

            <div className="relative mt-auto space-y-2">
                <div className="h-1.5 w-full rounded-full bg-zinc-900/80 overflow-hidden">
                    <motion.div
                        className={cn("h-full rounded-full", isUp ? "bg-emerald-500/80" : "bg-rose-500/80")}
                        initial={{ width: 0 }}
                        animate={{ width: `${intensity}%` }}
                        transition={{ duration: 0.7, delay: 0.18 + index * 0.03, ease: "easeOut" }}
                    />
                </div>

                <div className="flex items-center justify-between text-[10px]">
                    {item.fundingRate !== 0 ? (
                        <div className="flex items-center gap-1" title="Funding Rate">
                            <Flame className="w-3 h-3 text-amber-400" />
                            <span className={cn(
                                "font-mono",
                                item.fundingRate > 0.01 ? 'text-amber-300' : 'text-zinc-500'
                            )}>
                                {(item.fundingRate * 100).toFixed(4)}%
                            </span>
                        </div>
                    ) : <span className="text-zinc-600">funding n/a</span>}
                    <span className="text-zinc-500">{intensity.toFixed(0)}% pulse</span>
                </div>
            </div>
        </motion.button>
    );
});

Item.displayName = "MarketPulseItem";

export const MarketPulse = memo(() => {
    const { tickersList } = useScreenerData({ live: true, enableRestFallback: true, fetchMarkets: true });
    const { setSelectedChart } = usePortfolio();

    const movers = useMemo(() => {
        const rows = (tickersList || []).filter((row) => !row.placeholder && (row.price || 0) > 0);
        if (rows.length === 0) return [];

        const uniqueBySymbol = new Map<string, PulseTicker>();
        rows.forEach((raw) => {
            const item = sanitizeTicker(raw);
            if (!item) return;

            const prev = uniqueBySymbol.get(item.symbol);
            if (!prev || (item.volume24h > prev.volume24h) || (item.volume24h === prev.volume24h && Math.abs(item.change24h) > Math.abs(prev.change24h))) {
                uniqueBySymbol.set(item.symbol, item);
            }
        });

        const deduped = Array.from(uniqueBySymbol.values());
        if (deduped.length === 0) return [];

        const preferred = deduped.filter((item) => PREFERRED_PULSE_SET.has(item.symbol));
        const liquidFallback = deduped.filter(
            (item) =>
                !PREFERRED_PULSE_SET.has(item.symbol) &&
                (item.volume24h || 0) >= MIN_LIQUIDITY_USD_24H &&
                Math.abs(item.change24h) <= MAX_MOVE_FOR_LIQUIDITY_FALLBACK
        );

        const primary = [...preferred, ...liquidFallback]
            .sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))
            .slice(0, 12);

        if (primary.length >= 8) return primary;

        const relaxedFallback = deduped
            .filter(
                (item) =>
                    (item.volume24h || 0) >= MIN_RELAXED_LIQUIDITY_USD_24H &&
                    Math.abs(item.change24h) <= MAX_RELAXED_MOVE
            )
            .sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))
            .slice(0, 12);

        const merged = new Map<string, PulseTicker>();
        [...primary, ...relaxedFallback].forEach((item) => {
            if (!merged.has(item.symbol)) merged.set(item.symbol, item);
        });

        return Array.from(merged.values())
            .sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))
            .slice(0, 12);
    }, [tickersList]);

    const marketMeta = useMemo(() => {
        if (movers.length === 0) return { up: 0, down: 0, avgAbs: 0, maxAbs: 0 };
        const up = movers.filter((m) => m.change24h >= 0).length;
        const down = movers.length - up;
        const avgAbs = movers.reduce((sum, m) => sum + Math.abs(m.change24h), 0) / movers.length;
        const maxAbs = movers.reduce((max, m) => Math.max(max, Math.abs(m.change24h)), 0);
        return { up, down, avgAbs, maxAbs };
    }, [movers]);

    if (movers.length === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="relative mx-4 md:mx-6 lg:mx-8 mt-3 w-auto overflow-hidden border border-white/10 rounded-2xl py-3 bg-[linear-gradient(165deg,rgba(20,19,16,0.92),rgba(9,11,16,0.9))] clone-divider clone-noise"
        >
            <motion.div
                className="pointer-events-none absolute left-[-35%] top-0 h-full w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                animate={{ x: ["0%", "340%"] }}
                transition={{ duration: 4.8, repeat: Infinity, ease: "linear", repeatDelay: 0.8 }}
            />

            <div className="px-4 md:px-5 flex items-center justify-between mb-2 gap-3">
                <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400 fill-amber-500/20" />
                    <h3 className="tm-topbar-title text-zinc-200">Market Pulse</h3>
                    <div className="hidden md:flex h-px bg-white/10 w-24 ml-2" />
                </div>

                <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 border border-emerald-500/25 bg-emerald-500/10 text-[10px] font-black text-emerald-300">
                        <Activity className="w-3 h-3" />
                        {marketMeta.up} up
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 border border-rose-500/25 bg-rose-500/10 text-[10px] font-black text-rose-300">
                        {marketMeta.down} down
                    </span>
                    <span className="hidden md:inline-flex rounded-full px-2 py-1 border border-white/10 bg-white/[0.03] text-[10px] font-black text-zinc-400">
                        avg move {marketMeta.avgAbs.toFixed(2)}%
                    </span>
                </div>
            </div>

            <div className="flex overflow-x-auto gap-3 px-4 md:px-5 pb-2 custom-scrollbar snap-x">
                <AnimatePresence initial={false}>
                    {movers.map((item, index) => (
                        <Item
                            key={item.symbol}
                            item={item}
                            index={index}
                            maxAbsMove={marketMeta.maxAbs}
                            onOpenChart={(symbol, price) => {
                                setSelectedChart({
                                    symbol,
                                    entryPrice: typeof price === "number" && price > 0 ? price : undefined,
                                    timeframe: "5m",
                                });
                            }}
                        />
                    ))}
                </AnimatePresence>
            </div>
        </motion.div>
    );
});

MarketPulse.displayName = "MarketPulse";
