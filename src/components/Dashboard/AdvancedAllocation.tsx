"use client";

import { memo, useMemo, useRef, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { PortfolioAsset } from "@/lib/api/types";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Shield, AlertTriangle, PieChart } from "lucide-react";

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
    '#84cc16', // Lime
    '#14b8a6', // Teal
];

// Mini Donut Chart
const DonutChart = memo(function DonutChart({ 
    data, 
    size = 120 
}: { 
    data: { symbol: string; percent: number; color: string }[];
    size?: number;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || data.length === 0) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const dpr = window.devicePixelRatio || 1;
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        ctx.scale(dpr, dpr);
        
        const centerX = size / 2;
        const centerY = size / 2;
        const radius = size / 2 - 8;
        const innerRadius = radius * 0.65;
        
        let startAngle = -Math.PI / 2;
        
        data.forEach((item) => {
            const sliceAngle = (item.percent / 100) * 2 * Math.PI;
            const endAngle = startAngle + sliceAngle;
            
            // Draw slice
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
            ctx.closePath();
            ctx.fillStyle = item.color;
            ctx.fill();
            
            // Add subtle shadow
            ctx.shadowColor = item.color;
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.shadowBlur = 0;
            
            startAngle = endAngle;
        });
        
        // Inner circle (dark center)
        ctx.beginPath();
        ctx.arc(centerX, centerY, innerRadius - 2, 0, 2 * Math.PI);
        ctx.fillStyle = '#09090b';
        ctx.fill();
    }, [data, size]);
    
    const totalAssets = data.length;
    
    return (
        <div className="relative" style={{ width: size, height: size }}>
            <canvas ref={canvasRef} style={{ width: size, height: size }} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-black text-white">{totalAssets}</span>
                <span className="text-[8px] text-zinc-500 uppercase tracking-wider">Assets</span>
            </div>
        </div>
    );
});

export const AdvancedAllocation = memo(function AdvancedAllocation({ assets, loading }: AdvancedAllocationProps) {
    const router = useRouter();
    
    // Filter and sort assets
    const data = useMemo(() => {
        return assets
            .filter(a => a.valueUsd > 0 && a.allocations > 0.1)
            .sort((a, b) => b.valueUsd - a.valueUsd);
    }, [assets]);
    
    // Chart data
    const chartData = useMemo(() => {
        return data.map((asset, i) => ({
            symbol: asset.symbol,
            percent: asset.allocations,
            color: COLORS[i % COLORS.length]
        }));
    }, [data]);
    
    // Calculate stats
    const stats = useMemo(() => {
        const stablecoins = ['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'FRAX'];
        const stablecoinAlloc = data
            .filter(a => stablecoins.includes(a.symbol.toUpperCase()))
            .reduce((sum, a) => sum + a.allocations, 0);
        
        const topHolding = data[0];
        const topHoldingRisk = topHolding && topHolding.allocations > 40;
        
        // Diversity score (0-100): more assets + better distribution = higher score
        const effectiveAssets = data.filter(a => a.allocations > 1).length;
        const herfindahl = data.reduce((sum, a) => sum + Math.pow(a.allocations / 100, 2), 0);
        const diversityScore = Math.min(100, (1 - herfindahl) * 100 + effectiveAssets * 5);
        
        return {
            stablecoinAlloc,
            topHolding,
            topHoldingRisk,
            diversityScore,
            effectiveAssets
        };
    }, [data]);

    if (loading) {
        return <div className="animate-pulse h-[300px] bg-zinc-900 rounded-xl border border-white/5" />;
    }

    if (data.length === 0) {
        return (
            <Card className="border-white/10 bg-zinc-900/50 backdrop-blur-xl h-[200px] flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <PieChart className="w-8 h-8 text-zinc-700" />
                    <p className="text-zinc-500 text-xs font-medium">No allocations</p>
                </div>
            </Card>
        );
    }

    return (
        <Card className="border-white/10 bg-zinc-950/50 backdrop-blur-xl overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-zinc-400">
                    Portfolio Allocation
                </CardTitle>
                <div className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-bold text-zinc-500">
                    {data.length} ASSETS
                </div>
            </CardHeader>
            
            <CardContent className="px-4 pb-4 space-y-4">
                {/* Donut Chart + Top Holdings */}
                <div className="flex items-center gap-4">
                    <DonutChart data={chartData} size={100} />
                    
                    <div className="flex-1 space-y-1.5">
                        {data.slice(0, 4).map((asset, index) => (
                            <div 
                                key={asset.symbol}
                                className="flex items-center justify-between p-1.5 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
                                onClick={() => router.push('/asset/' + asset.symbol)}
                            >
                                <div className="flex items-center gap-2">
                                    <div 
                                        className="w-2 h-2 rounded-full" 
                                        style={{ backgroundColor: COLORS[index % COLORS.length] }} 
                                    />
                                    <TokenIcon symbol={asset.symbol} size={18} />
                                    <span className="text-[10px] font-bold text-white">{asset.symbol}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-black text-white">{asset.allocations.toFixed(1)}%</span>
                                </div>
                            </div>
                        ))}
                        {data.length > 4 && (
                            <div className="text-[9px] text-zinc-600 text-center pt-1">
                                +{data.length - 4} more assets
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/5">
                    {/* Diversity Score */}
                    <div className="p-2.5 rounded-lg bg-zinc-900/50 border border-white/5">
                        <div className="flex items-center gap-1.5 mb-1">
                            <Shield className={cn(
                                "w-3 h-3",
                                stats.diversityScore > 60 ? "text-emerald-400" : 
                                stats.diversityScore > 30 ? "text-amber-400" : "text-rose-400"
                            )} />
                            <span className="text-[8px] text-zinc-500 uppercase tracking-wider">Diversity</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className={cn(
                                "text-sm font-black",
                                stats.diversityScore > 60 ? "text-emerald-400" : 
                                stats.diversityScore > 30 ? "text-amber-400" : "text-rose-400"
                            )}>
                                {stats.diversityScore.toFixed(0)}
                            </span>
                            <span className="text-[9px] text-zinc-600">/100</span>
                        </div>
                        <div className="h-1 w-full bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                            <div 
                                className={cn(
                                    "h-full rounded-full transition-all",
                                    stats.diversityScore > 60 ? "bg-emerald-500" : 
                                    stats.diversityScore > 30 ? "bg-amber-500" : "bg-rose-500"
                                )}
                                style={{ width: `${stats.diversityScore}%` }}
                            />
                        </div>
                    </div>
                    
                    {/* Stablecoin Buffer */}
                    <div className="p-2.5 rounded-lg bg-zinc-900/50 border border-white/5">
                        <div className="flex items-center gap-1.5 mb-1">
                            <TrendingUp className={cn(
                                "w-3 h-3",
                                stats.stablecoinAlloc > 20 ? "text-emerald-400" : 
                                stats.stablecoinAlloc > 10 ? "text-amber-400" : "text-rose-400"
                            )} />
                            <span className="text-[8px] text-zinc-500 uppercase tracking-wider">Stables</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className={cn(
                                "text-sm font-black",
                                stats.stablecoinAlloc > 20 ? "text-emerald-400" : 
                                stats.stablecoinAlloc > 10 ? "text-amber-400" : "text-cyan-400"
                            )}>
                                {stats.stablecoinAlloc.toFixed(1)}%
                            </span>
                        </div>
                        <div className="h-1 w-full bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                            <div 
                                className="h-full bg-cyan-500 rounded-full transition-all"
                                style={{ width: `${Math.min(stats.stablecoinAlloc, 100)}%` }}
                            />
                        </div>
                    </div>
                </div>
                
                {/* Risk Alert */}
                {stats.topHoldingRisk && stats.topHolding && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-amber-400 font-bold">Concentration Risk</p>
                            <p className="text-[9px] text-amber-400/70">
                                {stats.topHolding.symbol} is {stats.topHolding.allocations.toFixed(0)}% of portfolio
                            </p>
                        </div>
                    </div>
                )}
                
                {/* Legend */}
                <div className="flex flex-wrap gap-1.5 pt-2">
                    {data.slice(0, 6).map((asset, index) => (
                        <div 
                            key={asset.symbol} 
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/5"
                        >
                            <div 
                                className="w-1.5 h-1.5 rounded-full" 
                                style={{ backgroundColor: COLORS[index % COLORS.length] }} 
                            />
                            <span className="text-[8px] font-bold text-zinc-500">{asset.symbol}</span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
});

export default AdvancedAllocation;
