"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gauge, TrendingUp, Zap } from "lucide-react";

interface SentimentWidgetProps {
    fearGreedIndex?: number; // 0-100
    altcoinSeasonIndex?: number; // 0-100
    btcDominance?: number;
}

export function SentimentWidget({ fearGreedIndex = 60, altcoinSeasonIndex = 26, btcDominance = 52.4 }: SentimentWidgetProps) {

    // Fear & Greed Color
    const getFearColor = (val: number) => {
        if (val < 25) return "text-rose-500";
        if (val < 45) return "text-orange-500";
        if (val < 55) return "text-yellow-500";
        if (val < 75) return "text-lime-500";
        return "text-emerald-500";
    };

    return (
        <Card className="h-full bg-[#141318]/60 backdrop-blur-xl border-white/5 overflow-hidden">
            <CardHeader className="py-3 px-4 border-b border-white/5 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold text-zinc-400 flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-purple-500" />
                    Market Sentiment
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-6">

                {/* Fear & Greed */}
                <div>
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-xs text-zinc-500">Fear & Greed</span>
                        <span className={`text-lg font-bold ${getFearColor(fearGreedIndex)}`}>
                            {fearGreedIndex} <span className="text-[10px] opacity-70 uppercase">{fearGreedIndex > 50 ? 'Greed' : 'Fear'}</span>
                        </span>
                    </div>
                    {/* Gauge/Progress */}
                    <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden relative">
                        <motion.div
                            className={`h-full rounded-full ${fearGreedIndex > 50 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${fearGreedIndex}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                        />
                        {/* Tick Marks */}
                        <div className="absolute top-0 left-1/4 h-full w-[1px] bg-black/20" />
                        <div className="absolute top-0 left-1/2 h-full w-[1px] bg-black/20" />
                        <div className="absolute top-0 left-3/4 h-full w-[1px] bg-black/20" />
                    </div>
                    <div className="flex justify-between text-[9px] text-zinc-600 mt-1 uppercase font-bold">
                        <span>Extreme Fear</span>
                        <span>Neutral</span>
                        <span>Extreme Greed</span>
                    </div>
                </div>

                {/* Altcoin Season */}
                <div>
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-xs text-zinc-500 flex items-center gap-1">
                            <Zap className="w-3 h-3 text-amber-500" /> Altcoin Season
                        </span>
                        <div className="flex flex-col items-end">
                            <span className="text-lg font-bold text-white">{altcoinSeasonIndex} <span className="text-zinc-500 text-xs">/ 100</span></span>
                        </div>
                    </div>

                    {/* Slider Visualization */}
                    <div className="relative h-8 w-full bg-zinc-800/50 rounded-lg flex items-center px-2">
                        {/* Track */}
                        <div className="absolute top-1/2 left-2 right-2 h-1 bg-gradient-to-r from-orange-500 via-purple-500 to-blue-500 rounded-full opacity-30" />

                        {/* Thumb */}
                        <motion.div
                            className="absolute top-1/2 w-4 h-4 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)] z-10 border-2 border-zinc-900 cursor-help"
                            initial={{ left: "0%" }}
                            animate={{ left: `${altcoinSeasonIndex}%` }}
                            transition={{ type: "spring", stiffness: 100 }}
                            style={{ translateY: "-50%" }}
                        />

                        <div className="absolute top-8 left-0 text-[9px] text-orange-500 font-bold uppercase">Bitcoin Season</div>
                        <div className="absolute top-8 right-0 text-[9px] text-blue-500 font-bold uppercase">Altcoin Season</div>
                    </div>
                </div>

                {/* Dominance */}
                <div className="pt-4 border-t border-white/5">
                    <div className="flex justify-between items-center bg-zinc-900/50 p-2 rounded-lg">
                        <span className="text-xs text-zinc-500">BTC Dominance</span>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-orange-400">{btcDominance}%</span>
                            <TrendingUp className="w-3 h-3 text-emerald-500" />
                        </div>
                    </div>
                </div>

            </CardContent>
        </Card>
    );
}
