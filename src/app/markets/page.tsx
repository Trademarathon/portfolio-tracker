"use client";

import { MarketTable } from "@/components/Screener/MarketTable";
import { TradingViewChart } from "@/components/Screener/TradingViewChart";
import { useMarketsData } from "@/hooks/useMarketsData";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
    Globe,
    Zap,
    Activity,
    LineChart,
    BarChart3
} from "lucide-react";
import { PageWrapper } from "@/components/Layout/PageWrapper";
import { ComponentSettingsLink } from "@/components/ui/ComponentSettingsLink";

export default function MarketsPage() {
    const { data: marketItems } = useMarketsData();
    const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

    // Calculate counts
    const allSymbolsCount = marketItems?.length || 0;
    const perpCount = useMemo(() => marketItems?.filter(m => m.types.includes('perp')).length || 0, [marketItems]);
    const spotCount = useMemo(() => marketItems?.filter(m => m.types.includes('spot')).length || 0, [marketItems]);

    return (
        <PageWrapper className="flex flex-col gap-6 px-4 md:px-12 pt-6 pb-24 max-w-none">
            {/* Header / Hero Section */}
            <div className="relative rounded-3xl overflow-hidden bg-zinc-900/50 border border-white/5 p-8">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent backdrop-blur-3xl" />

                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                                <Globe className="h-6 w-6" />
                            </div>
                            <h1 className="text-3xl font-serif font-black tracking-tight text-white">
                                Global Markets
                            </h1>
                            <ComponentSettingsLink tab="general" size="xs" title="Chart settings" />
                        </div>
                        <p className="text-zinc-400 max-w-lg">
                            Explore <span className="italic font-serif text-zinc-400">real-time data</span> for <span className="text-white font-bold">{allSymbolsCount}</span> active markets.
                            Including Hyperliquid HIP-3 deployments.
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex flex-col items-center p-3 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-md">
                            <Zap className="h-5 w-5 text-amber-400 mb-1" />
                            <span className="text-2xl font-bold text-white leading-none">
                                {perpCount}
                            </span>
                            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Perps</span>
                        </div>
                        <div className="flex flex-col items-center p-3 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-md">
                            <Activity className="h-5 w-5 text-emerald-400 mb-1" />
                            <span className="text-2xl font-bold text-white leading-none">
                                {spotCount}
                            </span>
                            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Spot</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Split View: Chart + Table */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Table Area */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="rounded-2xl border border-white/10 overflow-hidden bg-black/20 backdrop-blur-sm h-[800px]">
                        <MarketTable
                            selectedSymbol={selectedSymbol || ""}
                            onSelect={setSelectedSymbol}
                        />
                    </div>
                </div>

                {/* Right Panel: Chart Preview */}
                <div className="hidden lg:block space-y-4">
                    {selectedSymbol ? (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="sticky top-6 rounded-2xl overflow-hidden border border-white/10 bg-black/40 h-[800px] flex flex-col"
                        >
                            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-zinc-900/50">
                                <div className="flex items-center gap-2">
                                    <div className="p-1 rounded-md bg-primary/10 text-primary">
                                        <LineChart className="h-4 w-4" />
                                    </div>
                                    <span className="font-bold text-white">{selectedSymbol.split('-')[0]}/USD</span>
                                </div>
                            </div>
                            <div className="flex-1 relative">
                                <TradingViewChart symbol={(() => {
                                    const parts = selectedSymbol.split('-');
                                    const sym = parts[0];
                                    const ex = parts[1]?.toUpperCase();
                                    if (ex === 'BINANCE') return `BINANCE:${sym}USDT`;
                                    if (ex === 'BYBIT') return `BYBIT:${sym}USDT`;
                                    if (ex === 'HYPERLIQUID') return `HYPERLIQUID:${sym}`;
                                    return sym;
                                })()} />
                            </div>
                        </motion.div>
                    ) : (
                        <div className="sticky top-6 rounded-2xl border border-dashed border-white/10 bg-white/5 h-[400px] flex flex-col items-center justify-center text-center p-6">
                            <div className="h-16 w-16 rounded-full bg-indigo-500/10 flex items-center justify-center mb-4">
                                <BarChart3 className="h-8 w-8 text-indigo-400" />
                            </div>
                            <h3 className="text-white font-bold mb-2">Market Analysis</h3>
                            <p className="text-sm text-zinc-500">
                                Select a market from the list to view advanced charting and real-time metrics.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </PageWrapper>
    );
}
