"use client";

import { MarketTable } from "@/components/Screener/MarketTable";
import { TradingViewChart } from "@/components/Screener/TradingViewChart";
import { useMarketsData } from "@/hooks/useMarketsData";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
    Search,
    Globe,
    Zap,
    Activity,
    LineChart,
    BarChart3
} from "lucide-react";
import { Input } from "@/components/ui/input";

export default function MarketsPage() {
    const { data: marketItems, isLoading } = useMarketsData();
    const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
    const [search, setSearch] = useState("");

    const allSymbols = useMemo(() => {
        if (!marketItems) return [];
        return marketItems.map(m => m.symbol);
    }, [marketItems]);

    const filteredSymbols = useMemo(() => {
        if (!search) return allSymbols;
        return allSymbols.filter(s => s.toLowerCase().includes(search.toLowerCase()));
    }, [allSymbols, search]);

    // Limit to first 100 to avoid performance kill on initial load
    // A virtualized table would be better for 500+, but for now Slice is safer.
    const displaySymbols = useMemo(() => filteredSymbols.slice(0, 50), [filteredSymbols]);

    // Calculate counts
    const perpCount = useMemo(() => marketItems?.filter(m => m.types.includes('perp')).length || 0, [marketItems]);
    const spotCount = useMemo(() => marketItems?.filter(m => m.types.includes('spot')).length || 0, [marketItems]);

    return (
        <div className="space-y-6">
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
                        </div>
                        <p className="text-zinc-400 max-w-lg">
                            Explore <span className="italic font-serif text-zinc-400">real-time data</span> for <span className="text-white font-bold">{allSymbols.length}</span> active markets.
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
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-black/40 border border-white/5">
                        <Search className="h-4 w-4 text-zinc-500" />
                        <Input
                            placeholder="Search by symbol..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="bg-transparent border-none focus-visible:ring-0 text-sm h-auto p-0 placeholder:text-zinc-600"
                        />
                        <div className="text-xs text-zinc-600 font-mono">
                            Showing {displaySymbols.length} of {filteredSymbols.length}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 overflow-hidden bg-black/20 backdrop-blur-sm">
                        <MarketTable
                            symbols={displaySymbols}
                            selectedSymbol={selectedSymbol || ""}
                            onSelect={setSelectedSymbol}
                        />
                        {filteredSymbols.length > 50 && (
                            <div className="p-4 text-center border-t border-white/5">
                                <span className="text-xs text-zinc-500 italic">
                                    Search to see more specific results...
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Chart Preview */}
                <div className="hidden lg:block space-y-4">
                    {selectedSymbol ? (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="sticky top-6 rounded-2xl overflow-hidden border border-white/10 bg-black/40 h-[600px] flex flex-col"
                        >
                            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-zinc-900/50">
                                <div className="flex items-center gap-2">
                                    <LineChart className="h-4 w-4 text-primary" />
                                    <span className="font-bold text-white">{selectedSymbol}/USD</span>
                                </div>
                            </div>
                            <div className="flex-1 relative">
                                <TradingViewChart symbol={selectedSymbol} />
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
        </div>
    );
}
