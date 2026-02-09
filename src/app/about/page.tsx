"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Star, Globe, Zap, Shield, Key, Rocket, Users, Target } from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";

export default function AboutPage() {
    return (
        <div className="flex flex-col gap-8 pb-12 max-w-5xl mx-auto w-full">
            <div className="flex flex-col gap-4 px-1">
                <div className="flex items-center gap-4">
                    <div className="relative h-12 w-52 overflow-hidden">
                        <Image
                            src="/logo.png"
                            alt="Trade Marathon"
                            fill
                            className="object-contain filter dark:brightness-110"
                        />
                    </div>
                </div>
                <p className="text-xl text-muted-foreground font-serif italic opacity-80">Empowering traders with premium cross-chain analytics.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* MISSION CARD */}
                <Card className="md:col-span-2 bg-card/50 backdrop-blur-xl border-border overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Target className="h-32 w-32" />
                    </div>
                    <CardHeader>
                        <CardTitle className="text-xl flex items-center gap-2">
                            <Rocket className="h-5 w-5 text-trade-purple" />
                            The Mission
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-muted-foreground leading-relaxed">
                        <p>
                            Trade Marathon was born out of a necessity for clarity in the fast-paced world of decentralized finance and centralized exchanges. We believe that every trader deserves professional-grade tools to track, analyze, and optimize their portfolio.
                        </p>
                        <p>
                            Our platform provides a unified dashboard that bridges the gap between CEXs like Binance and Bybit, and on-chain wallets across Ethereum, Solana, Bitcoin, and dozens of other networks.
                        </p>
                    </CardContent>
                </Card>

                {/* FOUNDER CARD */}
                <Card className="bg-trade-purple/5 border-trade-purple/20 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-trade-purple" />
                    <CardHeader>
                        <CardTitle className="text-xl flex items-center gap-2">
                            <Users className="h-5 w-5 text-trade-purple" />
                            The Visionaries
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-1">
                            <h3 className="text-lg font-bold text-foreground">Ravi</h3>
                            <p className="text-xs font-mono uppercase tracking-widest text-trade-purple font-bold">Founder & Lead Architect</p>
                        </div>
                        <p className="text-sm text-muted-foreground italic">
                            "Transparency and execution are the twin pillars of successful trading. We build for the marathon, not the sprint."
                        </p>
                        <div className="pt-4 border-t border-trade-purple/10">
                            <p className="text-sm text-foreground font-bold">Trade Marathon Team</p>
                            <p className="text-xs text-muted-foreground">Global Collective of DeFi Enthusiasts</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* HOW TO USE SECTION */}
            <div className="space-y-6">
                <h2 className="text-2xl font-serif font-bold px-1">How to Use</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[
                        { title: "Connect", icon: Key, desc: "Add your CEX API keys or Wallet addresses in Settings." },
                        { title: "Sync", icon: Zap, desc: "Our engine fetches real-time balances and trade history." },
                        { title: "Analyze", icon: Star, desc: "View performance metrics and cross-chain holdings." },
                        { title: "Optimize", icon: Shield, desc: "Journal your trades and refine your strategy." }
                    ].map((step, i) => (
                        <Card key={i} className="bg-card/30 border-border hover:border-trade-purple/30 transition-colors">
                            <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                                <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center text-trade-purple">
                                    <step.icon className="h-6 w-6" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-foreground mb-1">{step.title}</h4>
                                    <p className="text-xs text-muted-foreground">{step.desc}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* PRODUCT SHOWCASE */}
            <Card className="bg-gradient-to-br from-trade-purple/10 to-transparent border-border">
                <CardContent className="p-8">
                    <div className="flex flex-col md:flex-row items-center gap-8">
                        <div className="flex-1 space-y-4">
                            <h3 className="text-2xl font-bold font-serif">A Unified Experience</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                Whether you're tracking spot holdings on Binance or LP positions on Uniswap, Trade Marathon provides a singular, high-performance interface. Our "TM Screener" and "Wallet Tracker" are built with speed and precision in mind.
                            </p>
                            <div className="flex gap-4">
                                <Card className="bg-background/50 border-border p-3 flex-1">
                                    <p className="text-[10px] font-bold uppercase text-zinc-500 mb-1">Chains</p>
                                    <p className="text-xl font-bold">50+</p>
                                </Card>
                                <Card className="bg-background/50 border-border p-3 flex-1">
                                    <p className="text-[10px] font-bold uppercase text-zinc-500 mb-1">Exchanges</p>
                                    <p className="text-xl font-bold">10+</p>
                                </Card>
                                <Card className="bg-background/50 border-border p-3 flex-1">
                                    <p className="text-[10px] font-bold uppercase text-zinc-500 mb-1">Accuracy</p>
                                    <p className="text-xl font-bold">100%</p>
                                </Card>
                            </div>
                        </div>
                        <div className="w-full md:w-1/3 flex justify-center">
                            <div className="relative">
                                <div className="absolute -inset-4 bg-trade-purple/20 blur-2xl rounded-full" />
                                <div className="relative bg-card border border-border h-48 w-48 rounded-3xl flex items-center justify-center rotate-3 shadow-2xl overflow-hidden p-6">
                                    <Image
                                        src="/logo.png"
                                        alt="Trade Marathon Logo"
                                        width={160}
                                        height={160}
                                        className="object-contain"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
