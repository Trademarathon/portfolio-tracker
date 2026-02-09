"use client";

import { useParams, useRouter } from 'next/navigation';
import { usePortfolioData } from '@/hooks/usePortfolioData';
import { useMemo, useState, useEffect } from 'react';
import { TokenIcon } from '@/components/ui/TokenIcon';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ArrowUpRight, ArrowDownLeft, TrendingUp, TrendingDown, Activity, Wallet, Layers } from 'lucide-react';
import { TradeHistoryChart } from '@/components/Asset/TradeHistoryChart';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { getTopCoins } from '@/lib/api/prices';

// Helper for 'Airbus' style cards
const StatCard = ({ label, value, subValue, icon: Icon, trend }: any) => (
    <div className="relative overflow-hidden bg-zinc-900/40 border border-white/5 rounded-xl p-4 group hover:border-white/10 transition-all">
        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <Icon className="w-16 h-16" />
        </div>
        <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2 text-zinc-500 text-xs font-bold uppercase tracking-wider">
                <Icon className="w-3.5 h-3.5" />
                {label}
            </div>
            <div className="text-2xl font-black text-white font-mono tracking-tight">
                {value}
            </div>
            {subValue && (
                <div className={cn("text-xs font-bold mt-1", trend === 'up' ? "text-emerald-500" : trend === 'down' ? "text-red-500" : "text-zinc-500")}>
                    {subValue}
                </div>
            )}
        </div>
        {/* Decorative corner accent */}
        <div className="absolute bottom-0 left-0 w-8 h-8 border-l-2 border-b-2 border-white/5 rounded-bl-xl" />
    </div>
);

export default function AssetPage() {
    const params = useParams();
    const router = useRouter();
    const symbol = params.symbol as string;
    const cleanSymbol = symbol ? symbol.toUpperCase() : '';

    const { assets, transactions, loading } = usePortfolioData();
    const [historyData, setHistoryData] = useState<{ date: number; price: number }[]>([]);

    // Find Asset Data
    const asset = useMemo(() => {
        return assets.find(a => a.symbol === cleanSymbol);
    }, [assets, cleanSymbol]);

    // Find Transactions for this asset
    const assetTrades = useMemo(() => {
        return transactions.filter(t =>
            (t.symbol && t.symbol.toUpperCase() === cleanSymbol) ||
            (t.asset && t.asset.toUpperCase() === cleanSymbol)
        ).sort((a, b) => b.timestamp - a.timestamp); // Newest first for list
    }, [transactions, cleanSymbol]);

    // Chart Data Generation (Mock history if API fails or limited, but try to fetch)
    // In a real app, we'd fetch historical OHLCV. Here we'll try to get data or generate a stub.
    useEffect(() => {
        const fetchHistory = async () => {
            // Since we don't have a reliable full history API in this demo context without an ID,
            // we will simulate a price curve that connects the trade points or use the existing price API if extended.
            // For now, let's mocked "Sparkline" data from CoinGecko if available in the asset object, 
            // or generate a synthetic one around the current price.

            // Note: `getTopCoins` uses `sparkline=false`.
            // We will generate a synthetic chart that varies slightly around the current price
            // but ensures it covers the range of the trades if they are recent.

            const currentPrice = asset?.price || 0;
            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;
            const dataPoints = [];

            // Generate 30 days of hourly data (simulated)
            // In production, fetch this from: https://api.coingecko.com/api/v3/coins/{id}/market_chart?vs_currency=usd&days=30
            for (let i = 30 * 24; i >= 0; i--) {
                const time = now - (i * 60 * 60 * 1000);
                // Random walk
                const randomChange = (Math.random() - 0.5) * (currentPrice * 0.02);
                dataPoints.push({
                    date: time,
                    price: currentPrice + (randomChange * (i / 10)) // More variance further back
                });
            }
            setHistoryData(dataPoints);
        };

        if (asset) fetchHistory();
    }, [asset]);

    // Derived Stats
    const stats = useMemo(() => {
        const buys = assetTrades.filter(t => t.side === 'buy' || t.type === 'Buy');
        const sells = assetTrades.filter(t => t.side === 'sell' || t.type === 'Sell');

        const totalBought = buys.reduce((acc, t) => acc + t.amount, 0);
        const totalBuyCost = buys.reduce((acc, t) => acc + (t.amount * t.price), 0);
        const avgBuyPrice = totalBought > 0 ? totalBuyCost / totalBought : 0;

        const totalSold = sells.reduce((acc, t) => acc + t.amount, 0);
        const totalSoldValue = sells.reduce((acc, t) => acc + (t.amount * t.price), 0);
        const avgSellPrice = totalSold > 0 ? totalSoldValue / totalSold : 0;

        return {
            avgBuyPrice,
            avgSellPrice,
            totalBought,
            totalSold,
            tradeCount: assetTrades.length
        };
    }, [assetTrades]);

    if (loading) return <div className="p-10 text-center animate-pulse">Loading Mission Data...</div>;

    if (!asset && !loading && assetTrades.length === 0) {
        return (
            <div className="p-10 text-center">
                <h1 className="text-2xl font-bold mb-4">Asset Not Found</h1>
                <Button onClick={() => router.back()}>Return to Base</Button>
            </div>
        );
    }

    // Default values if asset is active but not checking balances (e.g. only history)
    const currentPrice = asset?.price || 0;
    const balance = asset?.balance || 0;
    const valueUsd = asset?.valueUsd || 0;
    const priceChange = asset?.priceChange24h || 0;

    return (
        <div className="min-h-screen bg-black text-white p-4 md:p-8 space-y-6 font-sans selection:bg-indigo-500/30">
            {/* Header / Navigation */}
            <div className="flex items-center gap-4 mb-8">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.back()}
                    className="rounded-full bg-zinc-900 border border-white/10 hover:bg-white/10 text-zinc-400 hover:text-white"
                >
                    <ChevronLeft className="w-5 h-5" />
                </Button>
                <div className="flex items-center gap-3">
                    <TokenIcon symbol={cleanSymbol} size={40} />
                    <div>
                        <h1 className="text-3xl font-black tracking-tighter uppercase">{cleanSymbol}</h1>
                        <div className="flex items-center gap-2 text-zinc-500 text-sm font-bold">
                            <span>{asset?.name || 'Unknown Asset'}</span>
                            <span className="w-1 h-1 rounded-full bg-zinc-600" />
                            <span>{asset?.sector || 'Crypto'}</span>
                        </div>
                    </div>
                </div>
                <div className="ml-auto text-right">
                    <div className="text-3xl font-mono font-bold">
                        ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <div className={cn("inline-flex items-center gap-1 text-sm font-bold px-2 py-0.5 rounded-full bg-white/5", priceChange >= 0 ? "text-emerald-400" : "text-red-400")}>
                        {priceChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(priceChange).toFixed(2)}% (24h)
                    </div>
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column: Stats & Overview */}
                <div className="lg:col-span-1 space-y-4">
                    <StatCard
                        label="Total Holdings"
                        value={`${balance.toLocaleString()} ${cleanSymbol}`}
                        subValue={`$${valueUsd.toLocaleString()}`}
                        icon={Wallet}
                    />
                    <StatCard
                        label="Avg Buy Price"
                        value={`$${stats.avgBuyPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                        subValue={stats.avgBuyPrice > 0
                            ? `${((currentPrice - stats.avgBuyPrice) / stats.avgBuyPrice * 100).toFixed(2)}% vs Current`
                            : 'No Buys'
                        }
                        trend={(currentPrice - stats.avgBuyPrice) >= 0 ? 'up' : 'down'}
                        icon={ArrowDownLeft}
                    />
                    <StatCard
                        label="Realized Sales"
                        value={`$${(stats.totalSold * stats.avgSellPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                        subValue={`${stats.totalSold.toLocaleString()} ${cleanSymbol} Sold`}
                        icon={ArrowUpRight}
                    />

                    {/* Allocation / Sector (Mini Panel) */}
                    <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-xl p-4">
                        <h4 className="text-indigo-300 font-bold text-xs uppercase mb-3">Asset Classification</h4>
                        <div className="flex flex-wrap gap-2">
                            <span className="px-2 py-1 bg-indigo-500/20 text-indigo-300 text-xs rounded border border-indigo-500/30">
                                {asset?.sector || 'Unclassified'}
                            </span>
                            <span className="px-2 py-1 bg-zinc-800 text-zinc-400 text-xs rounded border border-white/5">
                                Spot
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right Column: Chart & History (Span 2) */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Main Chart Section */}
                    <section>
                        <TradeHistoryChart
                            data={historyData}
                            trades={assetTrades}
                            symbol={cleanSymbol}
                        />
                    </section>

                    {/* Transaction History List */}
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <Layers className="w-5 h-5 text-zinc-500" />
                                Trade Log
                            </h3>
                            <span className="text-xs font-mono text-zinc-500 bg-zinc-900 px-2 py-1 rounded border border-white/5">
                                {stats.tradeCount} RECORDS
                            </span>
                        </div>

                        <div className="bg-zinc-900/30 border border-white/5 rounded-xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-white/5 text-zinc-500 text-xs uppercase font-bold">
                                        <tr>
                                            <th className="px-4 py-3 text-left">Date</th>
                                            <th className="px-4 py-3 text-left">Type</th>
                                            <th className="px-4 py-3 text-right">Price</th>
                                            <th className="px-4 py-3 text-right">Amount</th>
                                            <th className="px-4 py-3 text-right">Value</th>
                                            <th className="px-4 py-3 text-right hidden md:table-cell">Exchange</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {assetTrades.map((tx) => (
                                            <tr key={tx.id} className="hover:bg-white/5 transition-colors group">
                                                <td className="px-4 py-3 text-zinc-400 font-mono text-xs">
                                                    {format(tx.timestamp, 'yyyy-MM-dd HH:mm')}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={cn(
                                                        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-black uppercase text-[10px]",
                                                        (tx.side === 'buy' || tx.type === 'Buy')
                                                            ? "bg-emerald-500/10 text-emerald-500"
                                                            : "bg-fuchsia-500/10 text-fuchsia-500"
                                                    )}>
                                                        {(tx.side === 'buy' || tx.type === 'Buy') ? (
                                                            <>
                                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                                BUY
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className="w-1.5 h-1.5 rounded-full bg-fuchsia-500" />
                                                                SELL
                                                            </>
                                                        )}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-zinc-300">
                                                    ${(tx.price || 0).toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-zinc-300">
                                                    {tx.amount}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono font-bold text-white">
                                                    ${((tx.price || 0) * tx.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-4 py-3 text-right text-zinc-600 text-xs hidden md:table-cell group-hover:text-zinc-400 transition-colors">
                                                    {tx.exchange}
                                                </td>
                                            </tr>
                                        ))}
                                        {assetTrades.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                                                    No recorded trades for this asset.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
