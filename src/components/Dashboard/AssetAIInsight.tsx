"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Info, Calendar, Newspaper, AlertCircle, CheckCircle2, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface AssetAIInsightProps {
    symbol: string;
    isOpen: boolean;
    onClose: () => void;
}

export function AssetAIInsight({ symbol, isOpen, onClose }: AssetAIInsightProps) {
    const [loading, setLoading] = useState(true);
    const [typedText, setTypedText] = useState("");
    const [activeSection, setActiveSection] = useState<'fundamentals' | 'unlocks' | 'news'>('fundamentals');

    // Mock realistic data for major coins
    const mockData: Record<string, any> = {
        'BTC': {
            fundamentals: "Digital gold. Finite supply (21M). Network security via Proof of Work. Institutional adoption rising.",
            unlocks: "No unlocks - fully decentralized distribution since 2009.",
            news: "ETF inflows hit record highs; Hashrate reaches new All-Time High."
        },
        'ETH': {
            fundamentals: "World computer. Proof of Stake. L2 ecosystem dominates DeFi. Ultra-sound money (burn mechanism).",
            unlocks: "Staking withdrawals live; steady supply flow.",
            news: "Pectra upgrade development remains on track; L3 scaling gains traction."
        },
        'SOL': {
            fundamentals: "High throughput L1. Monolithic architecture. Firedancer local testnet live. Strong retail base.",
            unlocks: "Managed through validator inflation schedules; no major VC cliffs pending.",
            news: "Daily active addresses surpass main competitors; Saga 2 pre-orders skyrocket."
        }
    };

    const assetData = mockData[symbol] || {
        fundamentals: "Promising Layer-1/DeFi protocol with growing ecosystem and unique scaling properties.",
        unlocks: "Next major unlock in Q3 (approx. 2.5% of circulating supply).",
        news: "Recent technical partnership announced; Social sentiment remains bullish."
    };

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            setTypedText("");
            const timer = setTimeout(() => {
                setLoading(false);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [isOpen, symbol]);

    // Typing effect for the selected section
    useEffect(() => {
        if (!loading) {
            const fullText = assetData[activeSection];
            let i = 0;
            const interval = setInterval(() => {
                setTypedText(fullText.slice(0, i));
                i++;
                if (i > fullText.length) clearInterval(interval);
            }, 15);
            return () => clearInterval(interval);
        }
    }, [loading, activeSection, symbol]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />

                    {/* Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative w-full max-w-md bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-primary/10 to-transparent">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-primary/20">
                                    <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-white uppercase tracking-wider">{symbol} AI INSIGHT</h3>
                                    <p className="text-[9px] text-zinc-500 font-bold">Neural Analysis Engine v2.1</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded-lg transition-colors">
                                <X className="w-4 h-4 text-zinc-400" />
                            </button>
                        </div>

                        {/* Navigation */}
                        <div className="flex p-2 bg-black/40 gap-1">
                            {[
                                { id: 'fundamentals', icon: Info, label: 'Fundamentals' },
                                { id: 'unlocks', icon: Calendar, label: 'Unlocks' },
                                { id: 'news', icon: Newspaper, label: 'Alpha' }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => {
                                        setActiveSection(tab.id as any);
                                        setTypedText("");
                                    }}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all duration-300",
                                        activeSection === tab.id ? "bg-primary/20 text-primary border border-primary/20" : "text-zinc-500 hover:text-zinc-300 border border-transparent"
                                    )}
                                >
                                    <tab.icon className="w-3 h-3" />
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Body */}
                        <div className="p-6 min-h-[160px] relative">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center h-full gap-4 py-8">
                                    <div className="flex gap-1">
                                        {[0, 1, 2].map(i => (
                                            <motion.div
                                                key={i}
                                                animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                                                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                                                className="w-1.5 h-1.5 rounded-full bg-primary"
                                            />
                                        ))}
                                    </div>
                                    <span className="text-[10px] font-black text-primary/60 uppercase tracking-widest">Scanning Blockchain...</span>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="text-zinc-300 text-sm leading-relaxed font-medium font-mono min-h-[4.5rem]">
                                        {typedText}
                                        <motion.span
                                            animate={{ opacity: [0, 1, 0] }}
                                            transition={{ duration: 0.8, repeat: Infinity }}
                                            className="inline-block w-1 h-4 ml-1 bg-primary align-middle"
                                        />
                                    </div>

                                    {/* Action Chips */}
                                    <div className="flex flex-wrap gap-2 pt-4">
                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black text-emerald-500">
                                            <CheckCircle2 size={10} /> BULLISH SENTIMENT
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[9px] font-black text-indigo-400">
                                            <Zap size={10} /> HIGH VOLATILITY
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Overlay */}
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
