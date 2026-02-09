import { usePortfolioData } from "@/hooks/usePortfolioData";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ArrowUp, ArrowDown, List as ListIcon, Clock, PieChart, ExternalLink } from "lucide-react";
import { useEffect, useState, CSSProperties } from "react";
import { cn } from "@/lib/utils";
// @ts-ignore
import * as ReactWindow from 'react-window';
// @ts-ignore
const FixedSizeList = ReactWindow.FixedSizeList || ReactWindow.default?.FixedSizeList || ReactWindow;
import { AutoSizer } from 'react-virtualized-auto-sizer';
import { PortfolioAsset } from "@/lib/api/types";
import { SpotOrdersTable } from "./SpotOrdersTable";
import { useRouter } from "next/navigation";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { getTokenName } from "@/lib/token-metadata";

const PriceCell = ({ price, prevPrice }: { price: number, prevPrice: number }) => {
    const [flash, setFlash] = useState<'up' | 'down' | null>(null);

    useEffect(() => {
        if (prevPrice && price > prevPrice) {
            setFlash('up');
            const timer = setTimeout(() => setFlash(null), 1000);
            return () => clearTimeout(timer);
        } else if (prevPrice && price < prevPrice) {
            setFlash('down');
            const timer = setTimeout(() => setFlash(null), 1000);
            return () => clearTimeout(timer);
        }
    }, [price, prevPrice]);

    return (
        <span className={cn(
            "transition-colors duration-300 font-mono",
            flash === 'up' && "text-emerald-400",
            flash === 'down' && "text-red-400"
        )}>
            ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
    );
};

export default function HoldingsTable({ assets: propAssets }: { assets?: PortfolioAsset[] }) {
    const { assets: hookAssets, spotOrders, loading, prices } = usePortfolioData();
    const assets = (propAssets || hookAssets).sort((a, b) => b.valueUsd - a.valueUsd);
    const [activeTab, setActiveTab] = useState<'holdings' | 'orders'>('holdings');
    const router = useRouter();

    if (loading) {
        return (
            <div className="w-full h-[500px] flex items-center justify-center bg-zinc-900/20 rounded-xl border border-white/5 animate-pulse">
                <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-zinc-500 text-xs uppercase tracking-wider">Loading Assets...</span>
                </div>
            </div>
        );
    }

    if (assets.length === 0 && spotOrders.length === 0 && !loading) {
        return (
            <Card className="border-white/10 bg-zinc-950/50 backdrop-blur-md mt-6 h-[500px] flex flex-col justify-center items-center">
                <div className="p-4 rounded-full bg-zinc-900 mb-4">
                    <ListIcon className="w-8 h-8 text-zinc-600" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">No Spot Assets</h3>
                <p className="text-zinc-500 text-sm max-w-[300px] text-center mb-6">
                    Your spot portfolio is empty. Connect a wallet or exchange to get started.
                </p>
                <a href="/settings" className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-bold transition-all">
                    Connect Wallet
                </a>
            </Card>
        );
    }

    const Row = ({ index, style }: { index: number, style: CSSProperties }) => {
        const asset = assets[index];
        const isPositive = (asset.priceChange24h || 0) >= 0;

        return (
            <div style={style} className="px-2">
                <div
                    onClick={() => router.push(`/asset/${asset.symbol}`)}
                    className="group flex items-center h-[54px] border-b border-white/5 hover:bg-white/5 transition-all cursor-pointer rounded-lg px-2 relative overflow-hidden"
                >
                    {/* Allocation Bar Background (Subtle) */}
                    <div
                        className="absolute bottom-0 left-0 top-0 bg-indigo-500/5 transition-all duration-500"
                        style={{ width: `${Math.min(asset.allocations || 0, 100)}%` }}
                    />

                    {/* Asset Info */}
                    <div className="flex-[2] flex items-center gap-4 min-w-[180px] relative z-10">
                        <TokenIcon symbol={asset.symbol} size={32} />
                        <div className="flex flex-col">
                            <span className="font-bold text-sm text-zinc-100 group-hover:text-indigo-400 transition-colors">
                                {asset.name && asset.name !== asset.symbol ? asset.name : getTokenName(asset.symbol)}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-medium font-mono uppercase tracking-wider">{asset.symbol}</span>
                        </div>
                    </div>

                    {/* Price */}
                    <div className="flex-1 text-right text-sm relative z-10 text-zinc-400 font-mono">
                        <PriceCell price={asset.price || 0} prevPrice={0} />
                    </div>

                    {/* Balance */}
                    <div className="flex-1 text-right relative z-10">
                        <div className="flex flex-col items-end">
                            <span className="text-zinc-200 font-mono font-medium">{asset.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                        </div>
                    </div>

                    {/* Value */}
                    <div className="flex-1 text-right text-sm font-bold text-white relative z-10 font-mono">
                        ${asset.valueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>

                    {/* 24h Change */}
                    <div className="flex-1 text-right text-sm relative z-10">
                        <span className={cn(
                            "inline-flex items-center justify-end px-2 py-1 rounded-md text-xs font-bold bg-opacity-10 w-[70px]",
                            isPositive ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                        )}>
                            {isPositive ? '+' : ''}{asset.priceChange24h?.toFixed(2)}%
                        </span>
                    </div>

                    {/* Allocation (Visual) */}
                    <div className="w-[120px] text-right text-sm relative z-10 pl-6">
                        <div className="flex items-center gap-3">
                            <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                    className={cn("h-full rounded-full opacity-80", isPositive ? "bg-indigo-500" : "bg-indigo-500")}
                                    style={{ width: `${Math.min(asset.allocations || 0, 100)}%` }}
                                />
                            </div>
                            <span className="text-xs font-mono text-zinc-500 w-[36px] text-right">{(asset.allocations || 0).toFixed(1)}%</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <Card className="border-white/10 bg-zinc-950/50 backdrop-blur-xl mt-6">
            <CardHeader className="flex flex-row items-center justify-between py-4 border-b border-white/5">
                <div className="flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-indigo-500" />
                    <CardTitle className="text-base uppercase tracking-widest font-black text-zinc-300">Spot Holdings</CardTitle>
                </div>
                <div className="flex items-center gap-1 bg-zinc-900/50 p-1 rounded-lg border border-white/5">
                    <button
                        onClick={() => setActiveTab('holdings')}
                        className={cn(
                            "flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                            activeTab === 'holdings' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-zinc-500 hover:text-white hover:bg-white/5"
                        )}
                    >
                        <ListIcon className="w-3.5 h-3.5" />
                        Assets
                    </button>
                    <button
                        onClick={() => setActiveTab('orders')}
                        className={cn(
                            "flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                            activeTab === 'orders' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-zinc-500 hover:text-white hover:bg-white/5"
                        )}
                    >
                        <Clock className="w-3.5 h-3.5" />
                        Orders
                        {spotOrders.length > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 bg-black/40 rounded-full text-[9px] text-indigo-200">
                                {spotOrders.length}
                            </span>
                        )}
                    </button>
                </div>
            </CardHeader>
            <CardContent className="h-[500px] flex flex-col p-0">
                {activeTab === 'holdings' ? (
                    <>
                        <div className="flex items-center h-10 border-b border-white/5 bg-white/5 text-zinc-500 text-[10px] font-bold uppercase tracking-widest px-4">
                            <div className="flex-[2] min-w-[180px]">Asset</div>
                            <div className="flex-1 text-right">Price</div>
                            <div className="flex-1 text-right">Balance</div>
                            <div className="flex-1 text-right">Value</div>
                            <div className="flex-1 text-right pr-2">24h Change</div>
                            <div className="w-[120px] text-right">Allocation</div>
                        </div>

                        <div className="flex-1 min-h-0">
                            {/* @ts-ignore */}
                            <AutoSizer>
                                {({ height, width }: { height: number; width: number }) => (
                                    <FixedSizeList
                                        height={height}
                                        itemCount={assets.length}
                                        itemSize={64}
                                        width={width}
                                        className="custom-scrollbar"
                                    >
                                        {Row as any}
                                    </FixedSizeList>
                                )}
                            </AutoSizer>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 p-2">
                        <SpotOrdersTable orders={spotOrders} prices={prices || {}} />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
