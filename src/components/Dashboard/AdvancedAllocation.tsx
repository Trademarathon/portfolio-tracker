"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { PortfolioAsset } from "@/lib/api/types";
import { useRouter } from "next/navigation";

interface AdvancedAllocationProps {
    assets: PortfolioAsset[];
    loading?: boolean;
}

const COLORS = [
    '#8b5cf6', // Violet
    '#10b981', // Emerald
    '#3b82f6', // Blue
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#f97316', // Orange
];

export function AdvancedAllocation({ assets, loading }: AdvancedAllocationProps) {
    const router = useRouter();
    // Filter assets with balance and sort by value
    const data = assets
        .filter(a => a.valueUsd > 0 && a.allocations > 0.1) // Filter small dust (<0.1%)
        .sort((a, b) => b.valueUsd - a.valueUsd);

    if (loading) {
        return <div className="animate-pulse h-[400px] bg-zinc-900 rounded-xl border border-white/5" />;
    }

    if (data.length === 0) {
        return (
            <Card className="border-white/10 bg-zinc-900/50 backdrop-blur-xl h-[400px] flex items-center justify-center">
                <p className="text-zinc-500 text-sm font-medium">No active allocations found.</p>
            </Card>
        );
    }

    return (
        <Card className="border-white/10 bg-zinc-950/50 backdrop-blur-xl overflow-hidden h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-zinc-400">
                    Portfolio Allocation
                </CardTitle>
                <div className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-bold text-zinc-400">
                    {data.length} ASSETS
                </div>
            </CardHeader>
            <CardContent className="space-y-5 px-4 pb-6">
                <div className="flex flex-col gap-4">
                    <AnimatePresence mode="popLayout">
                        {data.map((asset, index) => (
                            <motion.div
                                key={asset.symbol}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ delay: index * 0.05 }}
                                className="group relative cursor-pointer"
                                onClick={() => router.push('/watchlist?symbol=' + asset.symbol)}
                            >
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <TokenIcon symbol={asset.symbol} size={24} />
                                            <div
                                                className="absolute -inset-1 blur-md rounded-full opacity-0 group-hover:opacity-20 transition-opacity"
                                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                            />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-white leading-none">
                                                {asset.symbol}
                                            </span>
                                            <span className="text-[10px] text-zinc-500 font-medium">
                                                {asset.name || asset.symbol}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-black text-white leading-none">
                                            {asset.allocations.toFixed(1)}%
                                        </div>
                                        <div className="text-[10px] text-zinc-500 font-mono">
                                            ${asset.valueUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </div>
                                    </div>
                                </div>

                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden relative">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${asset.allocations}%` }}
                                        transition={{ duration: 1, ease: "easeOut", delay: index * 0.05 }}
                                        className="h-full rounded-full"
                                        style={{
                                            backgroundColor: COLORS[index % COLORS.length],
                                            boxShadow: `0 0 10px ${COLORS[index % COLORS.length]}40`
                                        }}
                                    />
                                    {/* Subtle highlight */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent pointer-events-none" />
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {/* Simplified Radial Summary at Bottom */}
                <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                    <div className="flex flex-wrap gap-2">
                        {data.slice(0, 4).map((asset, index) => (
                            <div key={asset.symbol} className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-md border border-white/5">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                <span className="text-[10px] font-bold text-zinc-400">{asset.symbol}</span>
                            </div>
                        ))}
                        {data.length > 4 && (
                            <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-md border border-white/5">
                                <span className="text-[10px] font-bold text-zinc-500">+{data.length - 4} MORE</span>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
