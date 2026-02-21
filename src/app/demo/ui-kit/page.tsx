"use client";

import React, { useState, useEffect } from "react";
import { NeoCard } from "@/components/ui/glass/NeoCard";
import { GlassPanel } from "@/components/ui/glass/GlassPanel";
import { PulseIndicator } from "@/components/ui/glass/PulseIndicator";
import { AnimatedValue } from "@/components/ui/glass/AnimatedValue";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, Shield, TrendingUp, Cpu } from "lucide-react";
import { motion } from "framer-motion";

export default function UIKitDemo() {
    const [mockValue, setMockValue] = useState(12450.75);

    useEffect(() => {
        const interval = setInterval(() => {
            setMockValue(prev => prev + (Math.random() * 10 - 5));
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="min-h-screen bg-black text-white p-8 space-y-12">
            <header className="max-w-4xl mx-auto space-y-4">
                <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl">UI Kit</h1>
                <p className="text-zinc-400 text-lg">Advanced, animated glassmorphic components for high-performance trading interfaces.</p>
            </header>

            <section className="max-w-6xl mx-auto space-y-8">
                <h2 className="text-xl font-bold uppercase tracking-widest text-indigo-500">NeoCard Variations</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <NeoCard glowColor="indigo">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Zap className="h-6 w-6 text-indigo-400" />
                                <PulseIndicator color="indigo" />
                            </div>
                            <h3 className="text-lg font-bold">Fast Execution</h3>
                            <p className="text-sm text-zinc-400">Optimized for low-latency market interactions with real-time feedback.</p>
                        </div>
                    </NeoCard>

                    <NeoCard glowColor="emerald">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Shield className="h-6 w-6 text-emerald-400" />
                                <PulseIndicator color="emerald" />
                            </div>
                            <h3 className="text-lg font-bold">Secure Vault</h3>
                            <p className="text-sm text-zinc-400">Military-grade encryption for all your on-chain assets and private keys.</p>
                        </div>
                    </NeoCard>

                    <NeoCard glowColor="rose">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <TrendingUp className="h-6 w-6 text-rose-400" />
                                <PulseIndicator color="rose" />
                            </div>
                            <h3 className="text-lg font-bold">Advanced Alpha</h3>
                            <p className="text-sm text-zinc-400">Proprietary logic identifies market trends before they become obvious.</p>
                        </div>
                    </NeoCard>
                </div>
            </section>

            <section className="max-w-6xl mx-auto space-y-8">
                <h2 className="text-xl font-bold uppercase tracking-widest text-indigo-500">GlassPanel & Animated Values</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <GlassPanel intensity="high" border className="p-8 flex flex-col items-center justify-center space-y-6">
                        <p className="text-zinc-500 uppercase font-bold tracking-widest text-xs">Total Portfolio Value</p>
                        <div className="text-5xl font-bold font-mono">
                            <AnimatedValue value={mockValue} prefix="$" decimals={2} />
                        </div>
                        <Button className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-full px-8">
                            Deposit Assets <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </GlassPanel>

                    <div className="grid grid-cols-2 gap-4">
                        <NeoCard glowColor="orange" className="flex flex-col items-center justify-center text-center py-8">
                            <p className="text-[10px] text-zinc-500 uppercase font-bold mb-2">Active Trades</p>
                            <span className="text-3xl font-bold"><AnimatedValue value={12} decimals={0} /></span>
                        </NeoCard>
                        <NeoCard glowColor="purple" className="flex flex-col items-center justify-center text-center py-8">
                            <p className="text-[10px] text-zinc-500 uppercase font-bold mb-2">Win Rate</p>
                            <span className="text-3xl font-bold text-emerald-400"><AnimatedValue value={68.4} decimals={1} currency="%" /></span>
                        </NeoCard>
                        <div className="col-span-2">
                            <GlassPanel intensity="low" className="p-4 flex items-center gap-4">
                                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                                    <Cpu className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-bold">Engine Status</p>
                                    <p className="text-[10px] text-zinc-500">Latency: 14ms | Uptime: 99.99%</p>
                                </div>
                                <PulseIndicator color="indigo" />
                            </GlassPanel>
                        </div>
                    </div>
                </div>
            </section>

            <footer className="max-w-4xl mx-auto pt-12 text-center text-zinc-600 text-sm">
                Built with Antigravity. 2026.
            </footer>
        </div>
    );
}
