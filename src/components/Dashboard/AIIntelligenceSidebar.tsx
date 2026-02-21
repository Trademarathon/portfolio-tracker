"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { Sparkles, Activity, Clock, ChevronRight, Zap, Target, TrendingUp } from "lucide-react";
import { PortfolioAsset } from "@/lib/api/types";
import { useMemo, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface AIIntelligenceSidebarProps {
    assets: PortfolioAsset[];
    onSelectAsset?: (symbol: string) => void;
}

export function AIIntelligenceSidebar({ assets, onSelectAsset }: AIIntelligenceSidebarProps) {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Filter to top assets to generate "Alpha" for
    const topAssets = useMemo(() => {
        return assets
            .filter(a => a.valueUsd > 10)
            .sort((a, b) => b.valueUsd - a.valueUsd)
            .slice(0, 6);
    }, [assets]);

    const feedItems = useMemo(() => {
        // Mocking high-end alpha feed items based on holding assets
        const mockTemplates = [
            { type: 'bullish', icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10', title: 'Whale Accumulation', suffix: 'Large volume buy walls detected at technical support.' },
            { type: 'volatility', icon: Zap, color: 'text-indigo-400', bg: 'bg-indigo-500/10', title: 'Volatility Alert', suffix: 'Liquidations increasing on perp markets. Brace for a squeeze.' },
            { type: 'technical', icon: Target, color: 'text-primary', bg: 'bg-primary/10', title: 'Structure Break', suffix: 'Major resistance flipped to support on the 4H timeframe.' },
            { type: 'news', icon: Sparkles, color: 'text-amber-400', bg: 'bg-amber-500/10', title: 'Ecosystem Growth', suffix: 'Institutional partnership rumors surfacing on social layers.' }
        ];

        return topAssets.map((asset, i) => {
            const template = mockTemplates[i % mockTemplates.length];
            const timeOffset = (i * 12) + 5; // offset in minutes
            return {
                ...template,
                symbol: asset.symbol,
                time: new Date(currentTime.getTime() - timeOffset * 60000),
                id: `${asset.symbol}-${i}`
            };
        });
    }, [topAssets, currentTime]);

    if (topAssets.length === 0) return null;

    return (
        <Card className="border-white/10 bg-zinc-950/20 backdrop-blur-3xl overflow-hidden h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-6 border-b border-white/[0.03]">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-primary/20 border border-primary/30">
                        <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                    </div>
                    <div>
                        <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-white">
                            Neural Alpha Feed
                        </CardTitle>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Real-time Intelligence</p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[8px] font-black text-emerald-500 uppercase">Live</span>
                </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-0 scrollbar-hide">
                <div className="divide-y divide-white/[0.03]">
                    <AnimatePresence mode="popLayout">
                        {feedItems.map((item, index) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="group relative p-4 hover:bg-white/[0.02] transition-all cursor-pointer border-l-2 border-transparent hover:border-primary/40"
                                onClick={() => onSelectAsset?.(item.symbol)}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="shrink-0 mt-1">
                                        <TokenIcon symbol={item.symbol} size={24} className="grayscale group-hover:grayscale-0 transition-all duration-500" />
                                    </div>
                                    <div className="flex-1 min-w-0 space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black text-white uppercase tracking-tight">{item.symbol}</span>
                                            <div className="flex items-center gap-1 text-[9px] font-bold text-zinc-600 group-hover:text-zinc-400 transition-colors">
                                                <Clock className="w-2.5 h-2.5" />
                                                {Math.floor((currentTime.getTime() - item.time.getTime()) / 60000)}m ago
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            <div className={cn("p-0.5 rounded-sm", item.bg)}>
                                                <item.icon className={cn("w-2.5 h-2.5", item.color)} />
                                            </div>
                                            <span className={cn("text-[10px] font-black uppercase tracking-wider", item.color)}>
                                                {item.title}
                                            </span>
                                        </div>

                                        <p className="text-[11px] text-zinc-500 font-medium leading-relaxed group-hover:text-zinc-300 transition-colors line-clamp-2">
                                            {item.suffix}
                                        </p>

                                        <div className="pt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-y-1 group-hover:translate-y-0 text-[9px] font-black text-primary uppercase">
                                            Launch Deep Dive
                                            <ChevronRight className="w-2.5 h-2.5" />
                                        </div>
                                    </div>
                                </div>

                                {/* Dynamic Glow on hover */}
                                <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </CardContent>

            <div className="p-4 bg-zinc-900/40 border-t border-white/[0.03]">
                <button className="w-full py-2.5 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/5 transition-all text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center justify-center gap-2 group">
                    <Activity className="w-3 h-3 group-hover:text-primary transition-colors" />
                    Load Historical Alpha
                </button>
            </div>
        </Card>
    );
}
