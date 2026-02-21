"use client";

import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PortfolioAsset } from "@/lib/api/types";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { PieChart, Activity, Layers } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

ChartJS.register(ArcElement, Tooltip, Legend);

interface PortfolioAllocationProps {
    assets: PortfolioAsset[];
    compact?: boolean;
}

export function PortfolioAllocation({ assets: assetsProp, compact = false }: PortfolioAllocationProps) {
    const assets = Array.isArray(assetsProp) ? assetsProp : [];
    const topAssets = [...assets]
        .filter(a => (a.valueUsd || 0) > 0)
        .sort((a, b) => (b.valueUsd || 0) - (a.valueUsd || 0))
        .slice(0, compact ? 4 : 5);

    const totalValue = assets.reduce((sum, a) => sum + (a.valueUsd || 0), 0);
    const topValue = topAssets.reduce((sum, a) => sum + (a.valueUsd || 0), 0);
    const otherValue = totalValue - topValue;
    const leaderPct = totalValue > 0 ? ((topAssets[0]?.valueUsd || 0) / totalValue) * 100 : 0;
    const concentration = topAssets.reduce((sum, a) => {
        const w = totalValue > 0 ? (a.valueUsd / totalValue) : 0;
        return sum + w * w;
    }, 0);
    const diversificationScore = Math.max(0, Math.min(100, Math.round((1 - concentration) * 100)));

    const data = {
        labels: [...topAssets.map(a => a.symbol), 'Others'],
        datasets: [
            {
                data: [...topAssets.map(a => a.valueUsd), otherValue],
                backgroundColor: [
                    '#6366f1',
                    '#8b5cf6',
                    '#ec4899',
                    '#f43f5e',
                    '#f59e0b',
                    '#3f3f46',
                ],
                borderWidth: 0,
                hoverOffset: 6
            },
        ],
    };

    const options = useMemo(() => ({
        cutout: '74%',
        animation: {
            animateRotate: true,
            animateScale: true,
            duration: 1300,
            easing: 'easeOutQuart' as const,
            delay: (ctx: { dataIndex?: number; type?: string }) =>
                ctx.type === "data" ? (ctx.dataIndex ?? 0) * 70 : 0,
        },
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                enabled: true,
                backgroundColor: '#18181b',
                titleFont: { size: 12 },
                bodyFont: { size: 11 },
                padding: 10,
                cornerRadius: 8,
            }
        },
        maintainAspectRatio: false
    }), []);

    return (
        <Card className={cn(
            "w-full rounded-xl bg-gradient-to-br from-zinc-950/90 to-zinc-900/90 border-white/10 overflow-hidden transition-all duration-300 hover:border-white/15 flex flex-col clone-card",
            compact ? "min-h-[300px]" : "min-h-[360px]"
        )}>
            <CardHeader className={cn(
                "border-b border-white/5 bg-white/[0.02]",
                compact ? "py-2.5 px-3.5" : "py-3 px-4"
            )}>
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-indigo-500/20",
                            compact ? "p-1.5" : "p-2"
                        )}>
                            <PieChart className="w-4 h-4 text-indigo-400" />
                        </div>
                        <CardTitle className={cn(
                            "font-bold text-zinc-500 uppercase tracking-[0.2em]",
                            compact ? "text-[9px]" : "text-[10px]"
                        )}>
                            Asset Allocation
                        </CardTitle>
                    </div>
                    <div className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] font-black text-zinc-400",
                        compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[10px]"
                    )}>
                        <Activity className="h-3 w-3 text-cyan-300" />
                        Diversification {diversificationScore}
                    </div>
                </div>
            </CardHeader>
            <CardContent className={cn(
                "flex-1 flex flex-col min-h-0",
                compact ? "p-3" : "p-4"
            )}>
                <div className={cn("relative", compact ? "h-32" : "h-40")}>
                    <motion.div
                        className={cn(
                            "pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/12 blur-2xl",
                            compact ? "h-24 w-24" : "h-28 w-28"
                        )}
                        animate={{ scale: [1, 1.08, 1], opacity: [0.35, 0.62, 0.35] }}
                        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <Doughnut data={data} options={options} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Total</span>
                        <span className={cn(
                            "font-black text-white font-mono font-balance-digital",
                            compact ? "text-base" : "text-lg"
                        )}>
                            ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                    </div>
                </div>

                <div className={cn("space-y-2", compact ? "mt-3" : "mt-4")}>
                    {topAssets.map((asset, i) => (
                        <motion.div
                            key={asset.symbol}
                            initial={{ opacity: 0, x: 8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.08 + i * 0.05, duration: 0.3 }}
                            className={cn(
                                "flex items-center justify-between",
                                compact ? "text-[10px]" : "text-[11px]"
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: data.datasets[0].backgroundColor[i] }} />
                                <span className="font-bold text-zinc-300">{asset.symbol}</span>
                            </div>
                            <span className="text-zinc-500 font-mono">{((asset.valueUsd / (otherValue + topAssets.reduce((s, a) => s + a.valueUsd, 0))) * 100).toFixed(1)}%</span>
                        </motion.div>
                    ))}
                </div>

                <div className={cn(
                    "border-t border-white/10 grid grid-cols-2 gap-2",
                    compact ? "mt-2.5 pt-2.5" : "mt-3 pt-3"
                )}>
                    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2">
                        <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Leader Weight</div>
                        <div className={cn(
                            "mt-1 font-black",
                            compact ? "text-xs" : "text-sm",
                            leaderPct > 45 ? "text-rose-300" : "text-emerald-300"
                        )}>
                            {leaderPct.toFixed(1)}%
                        </div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2">
                        <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest inline-flex items-center gap-1">
                            <Layers className="h-3 w-3 text-indigo-300" />
                            Other Bucket
                        </div>
                        <div className={cn(
                            "mt-1 font-black text-zinc-200",
                            compact ? "text-xs" : "text-sm"
                        )}>
                            ${Math.max(0, otherValue).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
