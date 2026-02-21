"use client";

import { PortfolioAsset, Transaction } from "@/lib/api/types";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { formatCurrency, cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Activity, Sparkles, BarChart3, ArrowDownUp, Wallet } from "lucide-react";
import { useMemo, useEffect, useState, useRef, memo } from "react";
import { normalizeSymbol } from "@/lib/utils/normalization";
import { calculateAssetAnalytics } from "@/lib/utils/analytics";

interface SpotAssetCardsProps {
    assets: PortfolioAsset[];
    onSelectAsset?: (symbol: string) => void;
    highlightedSymbol?: string | null;
}

// Mini Sparkline Chart Component
const MiniSparkline = memo(function MiniSparkline({ 
    symbol, 
    color = "#67e8f9",
    height = 50 
}: { 
    symbol: string; 
    color?: string;
    height?: number;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [priceHistory, setPriceHistory] = useState<number[]>([]);
    
    // Fetch 24h price history
    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const symbolLower = symbol.toLowerCase();
                const coinId = symbolLower === 'btc' ? 'bitcoin' : 
                              symbolLower === 'eth' ? 'ethereum' :
                              symbolLower === 'usdt' ? 'tether' :
                              symbolLower === 'usdc' ? 'usd-coin' :
                              symbolLower === 'bnb' ? 'binancecoin' :
                              symbolLower === 'sol' ? 'solana' :
                              symbolLower === 'xrp' ? 'ripple' :
                              symbolLower === 'apt' ? 'aptos' :
                              symbolLower === 'pepe' ? 'pepe' :
                              symbolLower === 'shib' ? 'shiba-inu' :
                              symbolLower;
                              
                const res = await fetch(
                    `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=1`,
                    { next: { revalidate: 300 } }
                );
                
                if (res.ok) {
                    const data = await res.json();
                    if (data.prices && data.prices.length > 0) {
                        const prices = data.prices.map((p: number[]) => p[1]);
                        const step = Math.max(1, Math.floor(prices.length / 50));
                        const sampled = prices.filter((_: number, i: number) => i % step === 0);
                        setPriceHistory(sampled);
                    }
                }
            } catch {
                const placeholder = Array.from({ length: 24 }, (_, i) => 
                    100 + Math.sin(i * 0.3) * 5 + Math.random() * 2
                );
                setPriceHistory(placeholder);
            }
        };
        
        fetchHistory();
    }, [symbol]);
    
    // Draw the sparkline
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || priceHistory.length < 2) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const dpr = window.devicePixelRatio || 1;
        const width = canvas.offsetWidth;
        const canvasHeight = height;
        
        canvas.width = width * dpr;
        canvas.height = canvasHeight * dpr;
        ctx.scale(dpr, dpr);
        
        ctx.clearRect(0, 0, width, canvasHeight);
        
        const min = Math.min(...priceHistory);
        const max = Math.max(...priceHistory);
        const range = max - min || 1;
        const padding = 4;
        
        const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
        gradient.addColorStop(0, `${color}20`);
        gradient.addColorStop(1, `${color}00`);
        
        ctx.beginPath();
        ctx.moveTo(0, canvasHeight);
        
        priceHistory.forEach((price, i) => {
            const x = (i / (priceHistory.length - 1)) * width;
            const y = canvasHeight - padding - ((price - min) / range) * (canvasHeight - padding * 2);
            if (i === 0) ctx.lineTo(x, y);
            else ctx.lineTo(x, y);
        });
        
        ctx.lineTo(width, canvasHeight);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
        
        ctx.beginPath();
        priceHistory.forEach((price, i) => {
            const x = (i / (priceHistory.length - 1)) * width;
            const y = canvasHeight - padding - ((price - min) / range) * (canvasHeight - padding * 2);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        
    }, [priceHistory, color, height]);
    
    return (
        <canvas 
            ref={canvasRef} 
            className="w-full"
            style={{ height: `${height}px` }}
        />
    );
});

// Enhanced Asset Card with Cost Basis Tracking
interface AssetAnalyticsData {
    avgBuyPrice: number;
    avgSellPrice: number;
    totalBought: number;
    totalSold: number;
    buyCount: number;
    sellCount: number;
    realizedPnl: number;
    unrealizedPnl: number;
    unrealizedPnlPercent: number;
    costBasis: number;
    dcaSignal: { signal: string; color: string; text: string };
}

const AssetCard = memo(function AssetCard({
    asset,
    analytics,
    onSelectAsset,
    setSelectedChart,
    isHighlighted
}: {
    asset: PortfolioAsset;
    analytics: AssetAnalyticsData;
    onSelectAsset?: (symbol: string) => void;
    setSelectedChart: (chart: { symbol: string; entryPrice?: number; avgBuyPrice?: number; avgSellPrice?: number }) => void;
    isHighlighted?: boolean;
}) {
    const pnlPercent = analytics.unrealizedPnlPercent;
    const isPositive = pnlPercent >= 0;
    const chartColor = isPositive ? "#34d399" : "#f87171";
    const hasTrades = analytics.buyCount > 0;
    
    return (
        <div 
            id={`asset-card-${asset.symbol}`}
            className={cn(
                "group relative rounded-2xl border transition-all duration-300 overflow-hidden cursor-pointer clone-wallet-card clone-noise",
                isHighlighted 
                    ? "border-cyan-500 ring-2 ring-cyan-500/50 shadow-lg shadow-cyan-500/20 animate-pulse" 
                    : "border-white/[0.04] hover:border-cyan-500/30"
            )}
            onClick={() => setSelectedChart({
                symbol: asset.symbol,
                entryPrice: analytics.avgBuyPrice > 0 ? analytics.avgBuyPrice : undefined,
                avgBuyPrice: analytics.avgBuyPrice > 0 ? analytics.avgBuyPrice : undefined,
                avgSellPrice: analytics.avgSellPrice > 0 ? analytics.avgSellPrice : undefined,
            })}
        >
            {/* Highlight Overlay */}
            {isHighlighted && (
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-cyan-500/5 to-transparent pointer-events-none z-10 animate-shimmer" />
            )}
            {/* Header - Icon, Symbol, Signal */}
            <div className="flex items-center justify-between p-3 pb-2">
                <div className="flex items-center gap-2.5">
                    <div className="relative">
                        <TokenIcon symbol={asset.symbol} size={32} className="relative z-10" />
                        {/* Status indicator */}
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center">
                            <div className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                isPositive ? "bg-emerald-400" : pnlPercent < 0 ? "bg-rose-400" : "bg-zinc-500"
                            )} />
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-black text-white leading-none tracking-tight">{asset.symbol}</span>
                        <div className="flex items-center gap-1 mt-0.5">
                            <Wallet className="w-2.5 h-2.5 text-zinc-600" />
                            <span className="text-[9px] text-zinc-500 font-mono">
                                {asset.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                            </span>
                        </div>
                    </div>
                </div>
                
                {/* DCA Signal Badge */}
                {hasTrades && analytics.dcaSignal.signal !== 'HOLD' && (
                    <span className={cn(
                        "text-[8px] font-black px-1.5 py-0.5 rounded-md border",
                        analytics.dcaSignal.signal === "BUY" || analytics.dcaSignal.signal === "STRONG_BUY"
                            ? "clone-chip-green border-emerald-500/30"
                            : analytics.dcaSignal.signal === "SELL"
                                ? "clone-chip-red border-rose-500/30"
                                : "clone-chip-amber border-amber-500/30"
                    )}>
                        {analytics.dcaSignal.text}
                    </span>
                )}
                
                {/* Quick Actions (on hover) */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); onSelectAsset?.(asset.symbol); }}
                        className="p-1.5 rounded-lg clone-button-soft border border-cyan-500/25 text-cyan-300 hover:bg-cyan-500/20 transition-all"
                        title="AI Analysis"
                    >
                        <Sparkles size={10} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); setSelectedChart({ symbol: asset.symbol }); }}
                        className="p-1.5 rounded-lg clone-button-soft border border-indigo-500/25 text-indigo-300 hover:bg-indigo-500/20 transition-all"
                        title="Full Chart"
                    >
                        <BarChart3 size={10} />
                    </button>
                </div>
            </div>
            
            {/* Value & PnL Row */}
            <div className="px-3 flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-lg font-black text-white leading-none">{formatCurrency(asset.valueUsd)}</span>
                    <span className="text-[9px] text-zinc-500 mt-0.5">@ {formatCurrency(asset.price || 0)}</span>
                </div>
                {hasTrades ? (
                    <div className={cn(
                        "flex flex-col items-end",
                        isPositive ? "text-emerald-400" : "text-rose-400"
                    )}>
                        <div className="flex items-center gap-0.5 text-[11px] font-black">
                            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {isPositive ? '+' : ''}{pnlPercent.toFixed(1)}%
                        </div>
                        <span className="text-[9px] font-mono opacity-70">
                            {isPositive ? '+' : ''}{formatCurrency(analytics.unrealizedPnl)}
                        </span>
                    </div>
                ) : (
                    <span className="text-[9px] text-zinc-600">No trades</span>
                )}
            </div>
            
            {/* Sparkline Chart */}
            <div className="mt-2 px-1 rounded-md bg-black/20 border border-white/[0.04]">
                <MiniSparkline symbol={asset.symbol} color={chartColor} height={40} />
            </div>
            
            {/* Cost Basis Stats */}
            <div className="flex items-stretch border-t border-white/[0.06] bg-black/25">
                {/* Avg Buy */}
                <div className="flex-1 flex flex-col px-2 py-1.5 border-r border-white/[0.03]">
                    <span className="text-[7px] text-zinc-600 uppercase tracking-wider">Avg Buy</span>
                    <span className="text-[10px] font-mono font-bold text-zinc-300">
                        {analytics.avgBuyPrice > 0 ? formatCurrency(analytics.avgBuyPrice) : '—'}
                    </span>
                    {analytics.buyCount > 0 && (
                        <span className="text-[8px] text-zinc-600">{analytics.buyCount} trades</span>
                    )}
                </div>
                
                {/* Avg Sell */}
                <div className="flex-1 flex flex-col px-2 py-1.5 border-r border-white/[0.03]">
                    <span className="text-[7px] text-zinc-600 uppercase tracking-wider">Avg Sell</span>
                    <span className="text-[10px] font-mono font-bold text-zinc-300">
                        {analytics.avgSellPrice > 0 ? formatCurrency(analytics.avgSellPrice) : '—'}
                    </span>
                    {analytics.sellCount > 0 && (
                        <span className="text-[8px] text-zinc-600">{analytics.sellCount} trades</span>
                    )}
                </div>
                
                {/* Cost Basis */}
                <div className="flex-1 flex flex-col px-2 py-1.5">
                    <span className="text-[7px] text-zinc-600 uppercase tracking-wider">Cost Basis</span>
                    <span className="text-[10px] font-mono font-bold text-cyan-400">
                        {analytics.costBasis > 0 ? formatCurrency(analytics.costBasis) : '—'}
                    </span>
                    {analytics.realizedPnl !== 0 && (
                        <span className={cn(
                            "text-[8px]",
                            analytics.realizedPnl > 0 ? "text-emerald-500" : "text-rose-500"
                        )}>
                            Real: {analytics.realizedPnl > 0 ? '+' : ''}{formatCurrency(analytics.realizedPnl)}
                        </span>
                    )}
                </div>
            </div>
            
            {/* Trade Activity Indicator */}
            {hasTrades && (
                <div className="flex items-center justify-center gap-2 py-1 bg-zinc-950/50">
                    <div className="flex items-center gap-1 text-[8px] text-emerald-500">
                        <TrendingUp className="w-2.5 h-2.5" />
                        <span>{analytics.totalBought.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                    <ArrowDownUp className="w-2.5 h-2.5 text-zinc-600" />
                    <div className="flex items-center gap-1 text-[8px] text-rose-500">
                        <TrendingDown className="w-2.5 h-2.5" />
                        <span>{analytics.totalSold.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                </div>
            )}
        </div>
    );
});

export function SpotAssetCards({ assets, onSelectAsset, highlightedSymbol }: SpotAssetCardsProps) {
    const { transactions, transfers, setSelectedChart } = usePortfolio();

    // Calculate comprehensive analytics for each asset
    const assetAnalytics = useMemo(() => {
        const analyticsMap: Record<string, AssetAnalyticsData> = {};
        
        assets.forEach(asset => {
            const analytics = calculateAssetAnalytics(asset, transactions || [], {
                transfers: transfers || [],
            });
            analyticsMap[normalizeSymbol(asset.symbol)] = {
                avgBuyPrice: analytics.avgBuyPrice,
                avgSellPrice: analytics.avgSellPrice,
                totalBought: analytics.totalBought,
                totalSold: analytics.totalSold,
                buyCount: analytics.buyCount,
                sellCount: analytics.sellCount,
                realizedPnl: analytics.realizedPnl,
                unrealizedPnl: analytics.unrealizedPnl,
                unrealizedPnlPercent: analytics.unrealizedPnlPercent,
                costBasis: analytics.costBasis,
                dcaSignal: analytics.dcaSignal
            };
        });
        
        return analyticsMap;
    }, [assets, transactions, transfers]);

    // Portfolio summary stats
    const portfolioStats = useMemo(() => {
        let totalCostBasis = 0;
        let totalValue = 0;
        let totalUnrealizedPnl = 0;
        let totalRealizedPnl = 0;
        
        assets.forEach(asset => {
            const analytics = assetAnalytics[normalizeSymbol(asset.symbol)];
            if (analytics) {
                totalCostBasis += analytics.costBasis;
                totalUnrealizedPnl += analytics.unrealizedPnl;
                totalRealizedPnl += analytics.realizedPnl;
            }
            totalValue += asset.valueUsd;
        });
        
        return {
            totalValue,
            totalCostBasis,
            totalUnrealizedPnl,
            totalRealizedPnl,
            overallPnlPercent: totalCostBasis > 0 ? (totalUnrealizedPnl / totalCostBasis) * 100 : 0
        };
    }, [assets, assetAnalytics]);

    // Show significant assets
    const displayAssets = useMemo(() => {
        return [...assets]
            .filter(a => a.balance > 0 && a.valueUsd > 1)
            .sort((a, b) => b.valueUsd - a.valueUsd)
            .slice(0, 16);
    }, [assets]);

    if (displayAssets.length === 0) return null;

    return (
        <div className="space-y-4">
            {/* Header with Portfolio Summary */}
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-cyan-400" />
                    <h2 className="text-sm font-black text-white uppercase tracking-wider">Holdings</h2>
                    <span className="text-[9px] text-zinc-600 font-mono">{displayAssets.length} ASSETS</span>
                </div>
                
                {/* Portfolio Summary */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-zinc-500">Cost Basis</span>
                        <span className="text-xs font-mono font-bold text-zinc-300">
                            {formatCurrency(portfolioStats.totalCostBasis)}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-zinc-500">Unrealized</span>
                        <span className={cn(
                            "text-xs font-mono font-bold",
                            portfolioStats.totalUnrealizedPnl >= 0 ? "text-emerald-400" : "text-rose-400"
                        )}>
                            {portfolioStats.totalUnrealizedPnl >= 0 ? '+' : ''}{formatCurrency(portfolioStats.totalUnrealizedPnl)}
                            <span className="text-[9px] ml-0.5 opacity-70">
                                ({portfolioStats.overallPnlPercent >= 0 ? '+' : ''}{portfolioStats.overallPnlPercent.toFixed(1)}%)
                            </span>
                        </span>
                    </div>
                    {portfolioStats.totalRealizedPnl !== 0 && (
                        <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-zinc-500">Realized</span>
                            <span className={cn(
                                "text-xs font-mono font-bold",
                                portfolioStats.totalRealizedPnl >= 0 ? "text-emerald-400" : "text-rose-400"
                            )}>
                                {portfolioStats.totalRealizedPnl >= 0 ? '+' : ''}{formatCurrency(portfolioStats.totalRealizedPnl)}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Asset Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
                {displayAssets.map((asset) => {
                    const analytics = assetAnalytics[normalizeSymbol(asset.symbol)] || {
                        avgBuyPrice: 0,
                        avgSellPrice: 0,
                        totalBought: 0,
                        totalSold: 0,
                        buyCount: 0,
                        sellCount: 0,
                        realizedPnl: 0,
                        unrealizedPnl: 0,
                        unrealizedPnlPercent: 0,
                        costBasis: 0,
                        dcaSignal: { signal: 'HOLD', color: 'text-zinc-500', text: 'Hold' }
                    };

                    return (
                        <AssetCard
                            key={asset.symbol}
                            asset={asset}
                            analytics={analytics}
                            onSelectAsset={onSelectAsset}
                            setSelectedChart={setSelectedChart}
                            isHighlighted={highlightedSymbol === asset.symbol}
                        />
                    );
                })}
            </div>
        </div>
    );
}
