"use client";

import { useMemo } from "react";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { useSpotAvgPriceRange } from "@/hooks/useSpotAvgPriceRange";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { calculateAssetAnalytics } from "@/lib/utils/analytics";

export function SpotAvgPriceSettings() {
    const { assets, transactions, transfers } = usePortfolio();
    const { fromDate, fromTime, toDate, toTime, setRange } = useSpotAvgPriceRange();

    const { rangeAvgPrice, lifetimeAvgPrice, totalQty, totalValue, count } = useMemo(() => {
        const fromMs = new Date(fromDate + "T" + fromTime).getTime();
        const toMs = new Date(toDate + "T" + toTime).getTime();
        const assetList = Array.isArray(assets) ? assets : [];
        const txs = Array.isArray(transactions) ? transactions : [];
        const trfs = Array.isArray(transfers) ? transfers : [];
        if (assetList.length === 0 || txs.length === 0) {
            return { rangeAvgPrice: null, lifetimeAvgPrice: null, totalQty: 0, totalValue: 0, count: 0 };
        }
        let rangeTotalValue = 0;
        let rangeTotalQty = 0;
        let lifetimeTotalValue = 0;
        let lifetimeTotalQty = 0;
        let tradeCount = 0;

        assetList.forEach((asset) => {
            const range = calculateAssetAnalytics(asset, txs, {
                transfers: trfs,
                fromMs,
                toMs,
                depositBasisPrice: asset.price || 0,
            });
            if (range.totalBought > 0 && range.avgBuyPrice > 0) {
                rangeTotalValue += range.avgBuyPrice * range.totalBought;
                rangeTotalQty += range.totalBought;
                tradeCount += range.buyCount;
            }

            const lifetime = calculateAssetAnalytics(asset, txs, {
                transfers: trfs,
                depositBasisPrice: asset.price || 0,
            });
            const lifetimeAvg = lifetime.avgBuyPriceLifetime ?? lifetime.avgBuyPrice;
            if (lifetime.totalBought > 0 && lifetimeAvg > 0) {
                lifetimeTotalValue += lifetimeAvg * lifetime.totalBought;
                lifetimeTotalQty += lifetime.totalBought;
            }
        });
        return {
            rangeAvgPrice: rangeTotalQty > 0 ? rangeTotalValue / rangeTotalQty : null,
            lifetimeAvgPrice: lifetimeTotalQty > 0 ? lifetimeTotalValue / lifetimeTotalQty : null,
            totalQty: rangeTotalQty,
            totalValue: rangeTotalValue,
            count: tradeCount,
        };
    }, [assets, transactions, transfers, fromDate, fromTime, toDate, toTime]);

    return (
        <Card className="bg-card/50 backdrop-blur-xl border-border">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="h-4 w-4 text-indigo-400" />
                    Spot orders – average price
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                    Set a custom date and time range to compute the volume-weighted average price (VWAP) of your spot orders in that period.
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">From (date & time)</label>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setRange({ fromDate: e.target.value, fromTime, toDate, toTime })}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500/50 outline-none"
                        />
                        <input
                            type="time"
                            value={fromTime}
                            onChange={(e) => setRange({ fromDate, fromTime: e.target.value, toDate, toTime })}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500/50 outline-none"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">To (date & time)</label>
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setRange({ fromDate, fromTime, toDate: e.target.value, toTime })}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500/50 outline-none"
                        />
                        <input
                            type="time"
                            value={toTime}
                            onChange={(e) => setRange({ fromDate, fromTime, toDate, toTime: e.target.value })}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500/50 outline-none"
                        />
                    </div>
                </div>
                {(Array.isArray(transactions) ? transactions.length : 0) === 0 ? (
                    <p className="text-xs text-zinc-500">No trade history available yet. Connect exchanges/wallets to compute unified average price.</p>
                ) : count === 0 ? (
                    <p className="text-xs text-zinc-500">No buys found in the selected date/time range. Adjust From/To.</p>
                ) : rangeAvgPrice != null ? (
                    <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                        <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1">Range average buy price (ledger)</p>
                        <p className="text-xl font-bold text-indigo-300">{formatCurrency(rangeAvgPrice)}</p>
                        <p className="text-[10px] text-zinc-500 mt-1">
                            {count} buy trade{count !== 1 ? "s" : ""} · Total value {formatCurrency(totalValue)} · Total qty {totalQty.toFixed(6)}
                        </p>
                        <p className="text-[10px] text-zinc-500 mt-1">
                            Lifetime average buy: {lifetimeAvgPrice != null ? formatCurrency(lifetimeAvgPrice) : "—"}
                        </p>
                    </div>
                ) : null}
            </CardContent>
        </Card>
    );
}
