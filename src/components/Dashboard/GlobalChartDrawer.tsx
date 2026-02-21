"use client";

import { useRouter } from "next/navigation";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { ScreenerLightweightChart } from "@/components/Screener/ScreenerLightweightChart";
import { TradingViewChart } from "@/components/Screener/TradingViewChart";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export function GlobalChartDrawer() {
    const { selectedChart, setSelectedChart } = usePortfolio();
    const router = useRouter();
    const [fallbackToTv, setFallbackToTv] = useState(false);
    const [showAvgBuy, setShowAvgBuy] = useState(true);
    const [showAvgSell, setShowAvgSell] = useState(true);
    const [showEntry, setShowEntry] = useState(true);

    useEffect(() => {
        if (!selectedChart) return;
        setFallbackToTv(false);
        setShowAvgBuy(true);
        setShowAvgSell(true);
        setShowEntry(true);
    }, [selectedChart]);

    if (!selectedChart) return null;

    const normalizeForTv = (rawSymbol: string): { tvSymbol: string; display: string; base: string } => {
        const raw = String(rawSymbol || "").trim().toUpperCase();
        if (!raw) return { tvSymbol: "", display: "", base: "" };

        if (raw.includes(":")) {
            const [exchange, pair] = raw.split(":");
            const base = pair.replace(/USDT$|USD$|USDC$/i, "");
            const display = `${base}/${pair.endsWith("USDC") ? "USDC" : pair.endsWith("USD") ? "USD" : "USDT"}`;
            return { tvSymbol: `${exchange}:${pair}`, display, base };
        }

        // Accept optional "SYMBOL-EXCHANGE" format
        const [symbolPart, exchangePart] = raw.split("-");
        const symbol = symbolPart || raw;
        const exchange = (exchangePart || "BINANCE").toUpperCase();

        const normalizedPair =
            symbol.includes("/") ? symbol.replace("/", "") :
                /(USDT|USD|USDC)$/i.test(symbol) ? symbol :
                    `${symbol}USDT`;

        // Hyperliquid TV symbols usually use perp style "...PERP"
        const tvExchange = exchange === "HYPERLIQUID" ? "HYPERLIQUID" : exchange;
        const tvPair = tvExchange === "HYPERLIQUID"
            ? normalizedPair.replace(/USDT$/i, "PERP")
            : normalizedPair;

        const base = normalizedPair.replace(/USDT$|USD$|USDC$/i, "");
        const quote = normalizedPair.endsWith("USDC") ? "USDC" : normalizedPair.endsWith("USD") ? "USD" : "USDT";
        return {
            tvSymbol: `${tvExchange}:${tvPair}`,
            display: `${base}/${quote}`,
            base,
        };
    };

    const resolved = normalizeForTv(selectedChart.symbol);
    const isPositive = selectedChart.side?.toLowerCase() === 'long' || selectedChart.side?.toLowerCase() === 'buy';
    const chartTf = selectedChart.timeframe || "5m";
    const tvInterval = chartTf === "5m" ? "5" : chartTf === "15m" ? "15" : chartTf === "1h" ? "60" : chartTf === "4h" ? "240" : "D";

    return (
        <AnimatePresence>
            {selectedChart && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedChart(null)}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 w-full md:w-[600px] lg:w-[800px] bg-[#050505] border-l border-white/10 z-[101] shadow-2xl flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-zinc-900/50">
                            <div className="flex items-center gap-4">
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-xl font-black text-white tracking-tighter uppercase">
                                            {resolved.display || `${selectedChart.symbol}/USDT`}
                                        </h2>
                                        {selectedChart.side && (
                                            <span className={cn(
                                                "text-[10px] font-black uppercase px-2 py-0.5 rounded leading-none",
                                                isPositive ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                                            )}>
                                                {selectedChart.side}
                                            </span>
                                        )}
                                    </div>
                                    {selectedChart.entryPrice && (
                                        <div className="flex items-center gap-2 mt-1">
                                            <Target className="h-3 w-3 text-zinc-500" />
                                            <span className="text-sm text-zinc-400 font-mono">
                                                Entry: <span className="text-white font-bold">${selectedChart.entryPrice.toLocaleString()}</span>
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1.5 mt-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowAvgBuy((v) => !v)}
                                            className={cn(
                                                "text-[10px] font-black uppercase px-2 py-1 rounded border transition-colors",
                                                showAvgBuy ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/10" : "text-zinc-500 border-white/10 bg-transparent"
                                            )}
                                        >
                                            Avg Buy
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowAvgSell((v) => !v)}
                                            className={cn(
                                                "text-[10px] font-black uppercase px-2 py-1 rounded border transition-colors",
                                                showAvgSell ? "text-rose-300 border-rose-500/40 bg-rose-500/10" : "text-zinc-500 border-white/10 bg-transparent"
                                            )}
                                        >
                                            Avg Sell
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowEntry((v) => !v)}
                                            className={cn(
                                                "text-[10px] font-black uppercase px-2 py-1 rounded border transition-colors",
                                                showEntry ? "text-amber-300 border-amber-500/40 bg-amber-500/10" : "text-zinc-500 border-white/10 bg-transparent"
                                            )}
                                        >
                                            Entry
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-10 w-10 text-zinc-400 hover:text-white"
                                        onClick={() => window.open(
                                            resolved.tvSymbol
                                                ? `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(resolved.tvSymbol)}`
                                                : `https://www.tradingview.com/symbols/${encodeURIComponent(selectedChart.symbol)}USDT`,
                                            '_blank'
                                        )}
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                    </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10 text-zinc-400 hover:text-white"
                                    onClick={() => setSelectedChart(null)}
                                >
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>

                        {/* Chart Container */}
                        <div className="flex-1 relative bg-black">
                            {!fallbackToTv ? (
                                <ScreenerLightweightChart
                                    symbol={resolved.tvSymbol}
                                    interval={chartTf}
                                    entryPrice={selectedChart.entryPrice}
                                    avgBuyPrice={selectedChart.avgBuyPrice}
                                    avgSellPrice={selectedChart.avgSellPrice}
                                    showAvgBuy={showAvgBuy}
                                    showAvgSell={showAvgSell}
                                    showEntry={showEntry}
                                    side={selectedChart.side}
                                    onLoadError={() => setFallbackToTv(true)}
                                />
                            ) : (
                                <TradingViewChart symbol={resolved.tvSymbol} interval={tvInterval} />
                            )}

                        </div>

                        {/* Footer / Actions */}
                        <div className="p-4 bg-zinc-900/30 border-t border-white/5 flex items-center justify-between">
                            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                                Advanced Chart Engine
                            </div>
                            <Button
                                className="bg-trade-purple hover:bg-indigo-600 text-white font-bold text-xs uppercase"
                                onClick={() => router.push(`/watchlist?symbol=${encodeURIComponent(selectedChart.symbol)}`)}
                            >
                                Full chart view
                            </Button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
