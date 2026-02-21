"use client";

import { useMemo } from "react";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { useSpotAvgPriceRange } from "@/hooks/useSpotAvgPriceRange";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart3, CalendarDays, Clock3 } from "lucide-react";
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
        <Card className="tm-pref-card border-white/12 bg-transparent shadow-none">
            <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2.5 text-base text-zinc-100">
                    <span className="tm-pref-title-icon">
                        <BarChart3 className="h-4 w-4 text-sky-300" />
                    </span>
                    Spot orders – average price
                </CardTitle>
                <p className="text-xs text-zinc-400">
                    Set a custom date and time range to compute the volume-weighted average price (VWAP) of your spot orders in that period.
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <label className="tm-pref-label">From (date & time)</label>
                        <div className="relative">
                            <input
                                type="date"
                                value={fromDate}
                                onChange={(e) => setRange({ fromDate: e.target.value, fromTime, toDate, toTime })}
                                className="tm-pref-input tm-pref-input--tight pr-10"
                            />
                            <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                        </div>
                        <div className="relative">
                            <input
                                type="time"
                                value={fromTime}
                                onChange={(e) => setRange({ fromDate, fromTime: e.target.value, toDate, toTime })}
                                className="tm-pref-input tm-pref-input--tight pr-10"
                            />
                            <Clock3 className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="tm-pref-label">To (date & time)</label>
                        <div className="relative">
                            <input
                                type="date"
                                value={toDate}
                                onChange={(e) => setRange({ fromDate, fromTime, toDate: e.target.value, toTime })}
                                className="tm-pref-input tm-pref-input--tight pr-10"
                            />
                            <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                        </div>
                        <div className="relative">
                            <input
                                type="time"
                                value={toTime}
                                onChange={(e) => setRange({ fromDate, fromTime, toDate, toTime: e.target.value })}
                                className="tm-pref-input tm-pref-input--tight pr-10"
                            />
                            <Clock3 className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                        </div>
                    </div>
                </div>
                {(Array.isArray(transactions) ? transactions.length : 0) === 0 ? (
                    <p className="text-xs text-zinc-500">
                        No trade history available yet. Connect exchanges/wallets to compute unified average price.
                    </p>
                ) : count === 0 ? (
                    <p className="text-xs text-zinc-500">No buys found in the selected date/time range. Adjust From/To.</p>
                ) : rangeAvgPrice != null ? (
                    <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/6 p-3.5">
                        <p className="tm-pref-label mb-1">Range average buy price (ledger)</p>
                        <p className="text-lg font-semibold text-cyan-200">{formatCurrency(rangeAvgPrice)}</p>
                        <p className="mt-1 text-[11px] text-zinc-400">
                            {count} buy trade{count !== 1 ? "s" : ""} · Total value {formatCurrency(totalValue)} · Total qty {totalQty.toFixed(6)}
                        </p>
                        <p className="mt-1 text-[11px] text-zinc-400">
                            Lifetime average buy: {lifetimeAvgPrice != null ? formatCurrency(lifetimeAvgPrice) : "—"}
                        </p>
                    </div>
                ) : null}
            </CardContent>
        </Card>
    );
}
