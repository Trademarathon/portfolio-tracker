"use client";

import { usePortfolioData } from "@/hooks/usePortfolioData";
import OpenPositionsTable from "@/components/Dashboard/OpenPositionsTable";
import AnalyticsCharts from "@/components/Dashboard/AnalyticsCharts";
import AdvancedMetrics from "@/components/Dashboard/AdvancedMetrics";
import SessionAnalysis from "@/components/Dashboard/SessionAnalysis";
import { motion } from "framer-motion";
import { Shield, Zap, TrendingUp, AlertTriangle } from "lucide-react";

export default function FuturesPage() {
    const { positions, futuresAnalytics, loading } = usePortfolioData();

    if (loading && !futuresAnalytics) {
        return (
            <div className="flex flex-col gap-6 animate-pulse">
                <div className="h-20 bg-zinc-900 rounded-xl border border-white/5" />
                <div className="h-[400px] bg-zinc-900 rounded-xl border border-white/5" />
                <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-zinc-900 rounded-xl border border-white/5" />)}
                </div>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-6 pb-12"
        >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
                        <Zap className="text-emerald-400" size={24} />
                        Futures Analytics
                    </h1>
                    <p className="text-sm text-muted-foreground italic">Professional-grade performance tracking and risk metrics.</p>
                </div>

                {positions.length > 0 && (
                    <div className="flex items-center gap-3 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                        <Shield size={14} className="text-emerald-400" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                            {positions.length} Active Positions
                        </span>
                    </div>
                )}
            </div>

            {/* Performance Metrics Bar */}
            {futuresAnalytics?.metrics && (
                <div className="bg-zinc-900/30 border border-white/5 rounded-2xl p-6 backdrop-blur-sm">
                    <AdvancedMetrics metrics={futuresAnalytics.metrics} />
                </div>
            )}

            {/* Charts Section */}
            {futuresAnalytics && (
                <div className="grid gap-6 lg:grid-cols-12">
                    <div className="lg:col-span-8">
                        <AnalyticsCharts
                            pnlData={futuresAnalytics.pnlSeries}
                            drawdownData={futuresAnalytics.drawdownSeries}
                        />
                    </div>

                    <div className="lg:col-span-4 space-y-4">
                        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-white/10 rounded-xl p-5 h-full flex flex-col justify-between">
                            <div>
                                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-4 flex items-center gap-2">
                                    <AlertTriangle size={14} className="text-orange-400" />
                                    Risk Summary
                                </h3>

                                <div className="space-y-6">
                                    <div className="flex justify-between items-center group">
                                        <span className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors">Max Drawdown</span>
                                        <span className="text-lg font-mono font-bold text-red-400/80">
                                            ${Math.abs(futuresAnalytics.metrics.maxDrawdown).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center group">
                                        <span className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors">Win/Loss Ratio</span>
                                        <span className="text-lg font-mono font-bold text-zinc-100">
                                            {(futuresAnalytics.metrics.winCount / (futuresAnalytics.metrics.lossCount || 1)).toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center group">
                                        <span className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors">Avg Risk/Reward</span>
                                        <span className="text-lg font-mono font-bold text-emerald-400/80">
                                            {(futuresAnalytics.metrics.avgWin / (futuresAnalytics.metrics.avgLoss || 1)).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 pt-6 border-t border-white/5">
                                <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg border border-white/5 italic text-[11px] text-zinc-400">
                                    <TrendingUp size={16} className="text-zinc-500 shrink-0" />
                                    Your profit factor of {futuresAnalytics.metrics.profitFactor.toFixed(2)} indicates a {futuresAnalytics.metrics.profitFactor > 1.5 ? 'highly profitable' : 'steady'} strategy.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Session Analysis Section */}
            {futuresAnalytics?.session && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-1 h-5 bg-blue-500 rounded-full" />
                        <h2 className="text-lg font-bold text-zinc-100 italic uppercase tracking-wider">Session Analysis</h2>
                    </div>
                    <SessionAnalysis
                        dayOfWeek={futuresAnalytics.session.dayOfWeek}
                        timeOfDay={futuresAnalytics.session.timeOfDay}
                    />
                </div>
            )}

            {/* Active Positions Section */}
            <div className="pt-4">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-5 bg-emerald-500 rounded-full" />
                    <h2 className="text-lg font-bold text-zinc-100 italic">Open Positions</h2>
                </div>

                {positions.length === 0 ? (
                    <div className="p-12 border border-white/5 border-dashed rounded-2xl bg-zinc-900/20 text-center text-zinc-500">
                        <AlertTriangle className="mx-auto mb-3 opacity-20" size={32} />
                        No active futures positions detected.
                    </div>
                ) : (
                    <OpenPositionsTable positions={positions} />
                )}
            </div>
        </motion.div>
    );
}
