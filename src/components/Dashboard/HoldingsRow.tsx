import { useState, useMemo, memo } from 'react';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { PortfolioAsset, Transaction, Transfer } from '@/lib/api/types';
import { Signal } from '@/hooks/useAlerts';
import { TokenIcon } from "@/components/ui/TokenIcon";
import { ExchangeIcon } from "@/components/ui/ExchangeIcon";
import { getTokenName } from "@/lib/token-metadata";
import { cn } from "@/lib/utils";
import { ChevronRight, PlusCircle, History, Zap, BarChart3 } from "lucide-react";
import { calculateAssetAnalytics, getSession } from "@/lib/utils/analytics";
import moment from "moment";
import { Button } from "@/components/ui/button";

interface HoldingsRowProps {
    asset: PortfolioAsset;
    style: React.CSSProperties;
    transactions: Transaction[];
    transfers?: Transfer[];
    signals?: Signal[];
    onAddTransaction: (symbol: string) => void;
    /** Controlled expand (for variable row height in virtual list) */
    isExpanded?: boolean;
    onExpand?: () => void;
    /** Volume-weighted avg price from spot orders in Settings date range (when set) */
    customRangeAvgPrice?: number | null;
}

export const HoldingsRow = memo(({ asset, style, transactions, transfers = [], signals = [], onAddTransaction, isExpanded: controlledExpanded, onExpand, customRangeAvgPrice }: HoldingsRowProps) => {
    const { setSelectedChart, connections } = usePortfolio();
    const [internalExpanded, setInternalExpanded] = useState(false);
    const expanded = controlledExpanded ?? internalExpanded;
    const handleExpand = onExpand ?? (() => setInternalExpanded((p) => !p));
    const analytics = useMemo(() => calculateAssetAnalytics(asset, transactions, { transfers }), [asset, transactions, transfers]);
    const isPositive = (asset.priceChange24h || 0) >= 0;

    // When no trade-history avg, use range VWAP from spot orders (Settings date range) for display and PnL
    const effectiveAvg = (customRangeAvgPrice != null && customRangeAvgPrice > 0)
        ? customRangeAvgPrice
        : analytics.avgBuyPrice;
    const unrealizedPnlDisplay = effectiveAvg > 0 && asset.price != null && asset.balance != null
        ? (asset.price - effectiveAvg) * asset.balance
        : analytics.unrealizedPnl;
    const unrealizedPnlPercentDisplay = effectiveAvg > 0 && asset.price != null
        ? ((asset.price - effectiveAvg) / effectiveAvg) * 100
        : analytics.unrealizedPnlPercent;

    // Filter transactions for this asset
    const assetTx = transactions.filter(t =>
        (t.symbol === asset.symbol || t.asset === asset.symbol)
    ).sort((a, b) => b.timestamp - a.timestamp);
    
    // Get sources from breakdown
    const sources = useMemo(() => {
        if (!asset.breakdown) return [];
        const connMap = new Map((connections || []).map(c => [c.id, c]));
        return Object.keys(asset.breakdown)
            .filter(key => asset.breakdown![key] > 0.0001)
            .map(key => {
                const [connId] = key.split('::');
                const conn = connMap.get(connId);
                return conn?.name || conn?.type || connId.slice(0, 8);
            })
            .filter((v, i, a) => a.indexOf(v) === i) // unique
            .slice(0, 3); // max 3 sources
    }, [asset.breakdown, connections]);

    return (
        <div style={style} className="px-2">
            <div className="flex flex-col bg-zinc-950/20 rounded-lg overflow-hidden border border-transparent hover:border-white/5 transition-all">
                {/* MAIN ROW */}
                <div
                    className="flex items-center h-[64px] px-2 cursor-pointer hover:bg-white/5 transition-colors relative"
                    onClick={handleExpand}
                >
                    {/* Allocation Bar Background */}
                    <div
                        className="absolute bottom-0 left-0 top-0 bg-indigo-500/5 transition-all duration-500 pointer-events-none"
                        style={{ width: `${Math.min(asset.allocations || 0, 100)}%` }}
                    />

                    {/* Expand Icon - single icon with rotation to avoid flicker */}
                    <div className="w-8 flex items-center justify-center text-zinc-500 shrink-0">
                        <ChevronRight className={cn("h-4 w-4 transition-transform duration-150", expanded && "rotate-90")} />
                    </div>

                    {/* Asset Info */}
                    <div className="flex-[2] flex items-center gap-3 min-w-[180px] relative z-10">
                        <div className="relative">
                            <TokenIcon symbol={asset.symbol} size={32} />
                            {sources.length > 0 && (
                                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center">
                                    <ExchangeIcon exchange={sources[0]} size={10} />
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-sm text-zinc-100 group-hover:text-indigo-400 transition-colors">
                                {asset.name && asset.name !== asset.symbol ? asset.name : getTokenName(asset.symbol)}
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] text-zinc-500 font-medium font-mono uppercase tracking-wider">{asset.symbol}</span>
                                {sources.length > 0 && (
                                    <div className="flex items-center gap-1">
                                        {sources.map((src, i) => (
                                            <span key={i} className="text-[8px] bg-zinc-800/80 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-700/50">
                                                {src}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedChart({
                                            symbol: asset.symbol,
                                            entryPrice: analytics.avgBuyPrice > 0 ? analytics.avgBuyPrice : undefined,
                                            avgBuyPrice: analytics.avgBuyPrice > 0 ? analytics.avgBuyPrice : undefined,
                                            avgSellPrice: analytics.avgSellPrice > 0 ? analytics.avgSellPrice : undefined,
                                        });
                                    }}
                                    className="p-1 hover:bg-white/10 rounded-md transition-colors text-zinc-600 hover:text-trade-purple"
                                >
                                    <BarChart3 className="h-3 w-3" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Avg Buy / Signal Detail - Clean Layout */}
                    <div className="flex-[1.2] text-right relative z-10 hidden md:block px-2">
                        <div className="flex flex-col items-end gap-0.5">
                            {/* Avg Price Row: trade-history avg, or range VWAP when set */}
                            <div className="flex items-center gap-1.5">
                                <span className="text-zinc-200 font-mono font-bold text-sm">
                                    {effectiveAvg > 0
                                        ? `$${effectiveAvg.toLocaleString(undefined, {
                                            maximumFractionDigits: effectiveAvg < 1 ? 4 : 2
                                        })}`
                                        : '—'
                                    }
                                </span>
                                {effectiveAvg > 0 && asset.price != null && (
                                    <span className={cn(
                                        "text-[10px] font-mono font-bold px-1 py-0.5 rounded",
                                        unrealizedPnlPercentDisplay >= 0
                                            ? "text-emerald-400 bg-emerald-500/10"
                                            : "text-rose-400 bg-rose-500/10"
                                    )}>
                                        {unrealizedPnlPercentDisplay >= 0 ? '+' : ''}{unrealizedPnlPercentDisplay.toFixed(1)}%
                                    </span>
                                )}
                            </div>
                            {/* Label when showing range VWAP (no trade-history avg) */}
                            {customRangeAvgPrice != null && customRangeAvgPrice > 0 && analytics.avgBuyPrice === 0 && (
                                <div className="text-[10px] text-indigo-400 font-mono">
                                    Range: ${customRangeAvgPrice.toLocaleString(undefined, { maximumFractionDigits: customRangeAvgPrice < 1 ? 4 : 2 })}
                                </div>
                            )}

                            {/* Signal or Strategy Badge */}
                            <div className="flex items-center gap-1">
                                {(() => {
                                    const latestSignal = signals.find(s => s.symbol === asset.symbol);
                                    if (latestSignal) {
                                        const isPositiveSignal = latestSignal.type.includes('up') || latestSignal.type.includes('buy');
                                        return (
                                            <div className={cn(
                                                "flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase",
                                                isPositiveSignal
                                                    ? "bg-emerald-500/15 text-emerald-400"
                                                    : "bg-rose-500/15 text-rose-400"
                                            )}>
                                                <Zap className="h-2.5 w-2.5" />
                                                <span>{latestSignal.type.replace(/_/g, ' ')}</span>
                                            </div>
                                        );
                                    }
                                    return (
                                        <span className={cn(
                                            "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase",
                                            analytics.dcaSignal.color.includes('emerald')
                                                ? "bg-emerald-500/10 text-emerald-400"
                                                : analytics.dcaSignal.color.includes('rose')
                                                    ? "bg-rose-500/10 text-rose-400"
                                                    : analytics.dcaSignal.color.includes('amber')
                                                        ? "bg-amber-500/10 text-amber-400"
                                                        : "bg-zinc-700/50 text-zinc-400"
                                        )}>
                                            {analytics.dcaSignal.text}
                                        </span>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>

                    {/* Unrealized PnL: from trade-history cost basis, or from range avg when no history */}
                    <div className="flex-1 text-right text-sm relative z-10 hidden md:block">
                        <div className="flex flex-col items-end">
                            <span className={cn("font-mono font-bold", unrealizedPnlDisplay >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                {unrealizedPnlDisplay >= 0 ? '+' : ''}${Math.abs(unrealizedPnlDisplay).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                            <span className={cn("text-[10px]", unrealizedPnlPercentDisplay >= 0 ? "text-emerald-500/70" : "text-rose-500/70")}>
                                {unrealizedPnlPercentDisplay.toFixed(2)}%
                            </span>
                        </div>
                    </div>

                    {/* Price */}
                    <div className="flex-1 text-right text-sm relative z-10 text-zinc-300 font-mono">
                        ${(asset.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </div>

                    {/* Balance & Value */}
                    <div className="flex-1 text-right relative z-10 min-w-[100px]">
                        <div className="flex flex-col items-end">
                            <span className="text-white font-bold font-mono text-sm">${asset.valueUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            <span className="text-zinc-500 text-[10px] font-mono">{asset.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })} {asset.symbol}</span>
                        </div>
                    </div>

                    {/* 24h Change */}
                    <div className="w-[80px] text-right text-sm relative z-10 ml-4">
                        <span className={cn(
                            "inline-flex items-center justify-end px-2 py-1 rounded-md text-xs font-bold bg-opacity-10 w-full",
                            isPositive ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                        )}>
                            {isPositive ? '+' : ''}{asset.priceChange24h?.toFixed(2)}%
                        </span>
                    </div>
                </div>

                {/* EXPANDED CONTENT */}
                {expanded && (
                    <div className="bg-black/20 border-t border-white/5 p-4 animate-in slide-in-from-top-2 duration-200">
                        {/* Summary Stats - Enhanced */}
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
                            {/* Avg Buy */}
                            <div className="bg-white/5 rounded-lg p-3">
                                <span className="text-[10px] uppercase text-zinc-500 font-bold block mb-1">Avg Buy Price</span>
                                <span className="text-emerald-400 font-mono text-sm font-bold">
                                    ${analytics.avgBuyPrice > 0 ? analytics.avgBuyPrice.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '—'}
                                </span>
                                <div className="text-[10px] text-zinc-500 mt-1">{analytics.buyCount} buys</div>
                                {customRangeAvgPrice != null && customRangeAvgPrice > 0 && (
                                    <div className="text-[10px] text-indigo-400 font-mono mt-1.5">Range (Settings): ${customRangeAvgPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
                                )}
                            </div>
                            
                            {/* Avg Sell */}
                            <div className="bg-white/5 rounded-lg p-3">
                                <span className="text-[10px] uppercase text-zinc-500 font-bold block mb-1">Avg Sell Price</span>
                                <span className="text-rose-400 font-mono text-sm font-bold">
                                    ${analytics.avgSellPrice > 0 ? analytics.avgSellPrice.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '—'}
                                </span>
                                <div className="text-[10px] text-zinc-500 mt-1">{analytics.sellCount} sells</div>
                            </div>
                            
                            {/* Total Bought */}
                            <div className="bg-white/5 rounded-lg p-3">
                                <span className="text-[10px] uppercase text-zinc-500 font-bold block mb-1">Total Bought</span>
                                <span className="text-white font-mono text-sm">{analytics.totalBought.toLocaleString(undefined, { maximumFractionDigits: 4 })} {asset.symbol}</span>
                                <div className="text-[10px] text-zinc-500 mt-1">Cost: ${analytics.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            </div>
                            
                            {/* Total Sold */}
                            <div className="bg-white/5 rounded-lg p-3">
                                <span className="text-[10px] uppercase text-zinc-500 font-bold block mb-1">Total Sold</span>
                                <span className="text-white font-mono text-sm">{analytics.totalSold.toLocaleString(undefined, { maximumFractionDigits: 4 })} {asset.symbol}</span>
                                <div className="text-[10px] text-zinc-500 mt-1">Proceeds: ${analytics.totalProceeds.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            </div>
                            
                            {/* Cost Basis */}
                            <div className="bg-white/5 rounded-lg p-3">
                                <span className="text-[10px] uppercase text-zinc-500 font-bold block mb-1">Cost Basis</span>
                                <span className="text-cyan-400 font-mono text-sm font-bold">${analytics.costBasis.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                <div className="text-[10px] text-zinc-500 mt-1">
                                    Net: {analytics.netPosition.toLocaleString(undefined, { maximumFractionDigits: 4 })} {asset.symbol}
                                </div>
                            </div>
                            
                            {/* PnL Summary */}
                            <div className="bg-white/5 rounded-lg p-3">
                                <span className="text-[10px] uppercase text-zinc-500 font-bold block mb-1">PnL Summary</span>
                                <div className="flex flex-col gap-0.5">
                                    <div className={cn("font-mono text-sm", analytics.unrealizedPnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                        Unreal: {analytics.unrealizedPnl >= 0 ? '+' : ''}${analytics.unrealizedPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </div>
                                    <div className={cn("font-mono text-[10px]", analytics.realizedPnl >= 0 ? "text-emerald-500/70" : "text-rose-500/70")}>
                                        Real: {analytics.realizedPnl >= 0 ? '+' : ''}${analytics.realizedPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* Add Transaction Button */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-4">
                                <span className="text-[10px] text-zinc-500">Held for {analytics.daysHeld} days</span>
                                {analytics.lastBuyDate > 0 && (
                                    <span className="text-[10px] text-zinc-500">
                                        Last buy: {moment(analytics.lastBuyDate).fromNow()}
                                    </span>
                                )}
                                {analytics.lastSellDate > 0 && (
                                    <span className="text-[10px] text-zinc-500">
                                        Last sell: {moment(analytics.lastSellDate).fromNow()}
                                    </span>
                                )}
                            </div>
                            <Button size="sm" variant="outline" className="h-8 text-xs border-white/10 hover:bg-white/5" onClick={(e) => {
                                e.stopPropagation();
                                onAddTransaction(asset.symbol);
                            }}>
                                <PlusCircle className="h-3 w-3 mr-1" /> Add Transaction
                            </Button>
                        </div>

                        {/* Transaction History Sub-table */}
                        <div className="rounded-lg border border-white/5 overflow-hidden">
                            <div className="bg-white/5 px-4 py-2 flex items-center gap-2">
                                <History className="h-3 w-3 text-zinc-400" />
                                <span className="text-xs font-bold text-zinc-300 uppercase">Recent Transactions</span>
                            </div>
                            {assetTx.length > 0 ? (
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-black/20 text-zinc-500 font-medium">
                                        <tr>
                                            <th className="px-4 py-2">Date/Time</th>
                                            <th className="px-4 py-2">Session</th>
                                            <th className="px-4 py-2">Type</th>
                                            <th className="px-4 py-2 text-right">Price</th>
                                            <th className="px-4 py-2 text-right">Amount</th>
                                            <th className="px-4 py-2 text-right">Value</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {assetTx.slice(0, 10).map((tx, i) => (
                                            <tr key={tx.id || i} className="hover:bg-white/5 transition-colors">
                                                <td className="px-4 py-2 text-zinc-400 font-mono">
                                                    {moment(tx.timestamp).format('MMM D, HH:mm')}
                                                </td>
                                                <td className="px-4 py-2 text-zinc-500">
                                                    {getSession(tx.timestamp)}
                                                </td>
                                                <td className={cn(
                                                    "px-4 py-2 font-bold uppercase",
                                                    (tx.side === 'buy' || tx.type === 'Buy') ? "text-emerald-500" : "text-rose-500"
                                                )}>
                                                    {tx.side || tx.type}
                                                </td>
                                                <td className="px-4 py-2 text-right font-mono text-zinc-300">
                                                    ${tx.price.toLocaleString()}
                                                </td>
                                                <td className="px-4 py-2 text-right font-mono text-zinc-300">
                                                    {tx.amount}
                                                </td>
                                                <td className="px-4 py-2 text-right font-mono text-zinc-300">
                                                    ${(tx.amount * tx.price).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="p-8 text-center text-zinc-500 text-xs italic">
                                    No transaction history found for {asset.symbol}.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
});
