"use client";

import { useMemo } from 'react';
import { use } from 'react';
import { usePortfolio } from "@/contexts/PortfolioContext";
import { useRealtimeMarket } from "@/hooks/useRealtimeMarket";
import { AssetHeader } from "@/components/Asset/AssetHeader";
import { TradingViewChart } from "@/components/Asset/TradingViewChart";
import { OrderManagement } from "@/components/Asset/OrderManagement";
import { Position } from '@/lib/api/types';

export function AssetPageClient({ params }: { params: Promise<{ symbol: string }> }) {
    const { symbol: symbolParam } = use(params);
    const symbol = symbolParam.toUpperCase();

    const {
        positions,
        spotOrders,
        activities,
        prices,
        loading: _loading
    } = usePortfolio();

    const { stats, prices: realtimePrices } = useRealtimeMarket([symbol]);

    const currentPrice = realtimePrices[symbol] || prices[symbol] || 0;
    const assetStats = stats[symbol] || {
        symbol,
        price: currentPrice,
        change24h: 0,
        change1h: 0,
        volume24h: 0,
        fundingRate: 0,
        openInterest: 0
    };

    const assetPositions = useMemo(() => {
        return (positions || []).filter((p: Position) => (p?.symbol || '').includes(symbol));
    }, [positions, symbol]);

    const assetOrders = useMemo(() => {
        return (spotOrders || []).filter((o: any) => (o?.symbol || '').includes(symbol));
    }, [spotOrders, symbol]);

    if (!symbol) return null;

    return (
        <div className="min-h-screen flex flex-col bg-background overflow-hidden">
            <AssetHeader
                symbol={symbol}
                price={currentPrice}
                change24h={assetStats.change24h}
                volume24h={assetStats.volume24h}
                high24h={undefined}
                low24h={undefined}
            />
            <div className="flex-1 p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
                <div className="lg:col-span-8 flex flex-col gap-4 h-[600px] lg:h-auto">
                    <div className="flex-1 bg-card border border-border rounded-xl overflow-hidden">
                        <TradingViewChart
                            symbol={symbol}
                            positions={assetPositions}
                            orders={assetOrders}
                            currentPrice={currentPrice}
                        />
                    </div>
                </div>
                <div className="lg:col-span-4 flex flex-col gap-4 h-full overflow-hidden">
                    <OrderManagement
                        symbol={symbol}
                        orders={assetOrders}
                        history={activities ?? []}
                        positions={assetPositions}
                        currentPrice={currentPrice}
                    />
                </div>
            </div>
        </div>
    );
}
