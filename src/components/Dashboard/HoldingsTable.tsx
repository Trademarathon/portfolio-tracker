import { usePortfolioData } from "@/hooks/usePortfolioData";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ArrowUp, ArrowDown, List as ListIcon, Clock } from "lucide-react";
import { useEffect, useState, CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { List } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';
import { PortfolioAsset } from "@/lib/api/types";
import { SpotOrdersTable } from "./SpotOrdersTable";

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
            "transition-colors duration-300 px-2 py-1 rounded",
            flash === 'up' && "bg-emerald-500/20 text-emerald-500",
            flash === 'down' && "bg-red-500/20 text-red-500"
        )}>
            ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
    );
};

export default function HoldingsTable({ assets: propAssets }: { assets?: PortfolioAsset[] }) {
    const { assets: hookAssets, spotOrders, loading } = usePortfolioData();
    const assets = (propAssets || hookAssets).sort((a, b) => b.valueUsd - a.valueUsd);
    const [activeTab, setActiveTab] = useState<'holdings' | 'orders'>('holdings');

    if (loading) {
        return (
            <div className="w-full h-40 flex items-center justify-center text-muted-foreground animate-pulse">
                Loading portfolio data...
            </div>
        );
    }

    if (assets.length === 0 && spotOrders.length === 0 && !loading) {
        return (
            <Card className="border-white/10 bg-card/50 backdrop-blur-sm mt-6">
                <CardHeader>
                    <CardTitle>Spot Ecosystem</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground space-y-4">
                    <p>No assets or orders found.</p>
                    <p className="text-sm">Go to <a href="/settings" className="text-primary hover:underline">Settings</a> to connect your wallets and exchanges.</p>
                </CardContent>
            </Card>
        );
    }

    const Row = ({ index, style }: { index: number, style: CSSProperties }) => {
        const asset = assets[index];
        return (
            <div style={style}>
                <div className="flex items-center h-full border-b border-white/5 hover:bg-muted/50 transition-colors px-2">
                    <div className="flex-[2] flex items-center gap-2 min-w-[140px]">
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">
                            {asset.symbol.substring(0, 1)}
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold flex items-center gap-2 text-sm">{asset.name || asset.symbol}</span>
                            <span className="text-[10px] text-muted-foreground">{asset.symbol}</span>
                        </div>
                    </div>

                    <div className="flex-1 text-right text-sm">
                        <PriceCell price={asset.price || 0} prevPrice={0} />
                    </div>

                    <div className="flex-1 text-right text-sm">
                        <div className="flex flex-col items-end">
                            <span>{asset.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                            {Object.keys(asset.breakdown || {}).length > 1 && (
                                <span className="text-[9px] text-muted-foreground">multiple</span>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 text-right text-sm font-medium">
                        ${asset.valueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>

                    <div className="flex-1 text-right text-sm">
                        <span className={cn(
                            "flex items-center justify-end gap-1",
                            (asset.priceChange24h || 0) >= 0 ? "text-emerald-500" : "text-red-500"
                        )}>
                            {(asset.priceChange24h || 0) >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                            {Math.abs(asset.priceChange24h || 0).toFixed(2)}%
                        </span>
                    </div>

                    <div className="w-[80px] text-right text-sm text-muted-foreground px-2">
                        {asset.allocations?.toFixed(1)}%
                    </div>
                </div>
            </div>
        );
    };

    return (
        <Card className="border-white/10 bg-card/50 backdrop-blur-sm mt-6">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>Spot Ecosystem</CardTitle>
                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('holdings')}
                        className={cn(
                            "flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                            activeTab === 'holdings' ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:bg-white/5"
                        )}
                    >
                        <ListIcon className="w-3.5 h-3.5" />
                        Holdings
                    </button>
                    <button
                        onClick={() => setActiveTab('orders')}
                        className={cn(
                            "flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                            activeTab === 'orders' ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:bg-white/5"
                        )}
                    >
                        <Clock className="w-3.5 h-3.5" />
                        Open Orders
                        {spotOrders.length > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 bg-black/20 rounded-full text-[10px]">
                                {spotOrders.length}
                            </span>
                        )}
                    </button>
                </div>
            </CardHeader>
            <CardContent className="h-[500px] flex flex-col p-2">
                {activeTab === 'holdings' ? (
                    <>
                        <div className="flex items-center h-10 border-b border-white/5 text-muted-foreground text-xs font-medium uppercase tracking-wider px-2">
                            <div className="flex-[2] min-w-[140px]">Asset</div>
                            <div className="flex-1 text-right">Price</div>
                            <div className="flex-1 text-right">Balance</div>
                            <div className="flex-1 text-right">Value (USD)</div>
                            <div className="flex-1 text-right">24h</div>
                            <div className="w-[80px] text-right px-2">Allocation</div>
                        </div>

                        <div className="flex-1">
                            <AutoSizer renderProp={({ height, width }: { height: number | undefined; width: number | undefined }) => (
                                <List<{}>
                                    rowCount={assets.length}
                                    rowHeight={60}
                                    rowComponent={Row}
                                    rowProps={{}}
                                    style={{ height, width }}
                                    className="custom-scrollbar"
                                />
                            )} />
                        </div>
                    </>
                ) : (
                    <div className="flex-1 mt-2">
                        <SpotOrdersTable orders={spotOrders} />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
