"use client";

import { useState, useEffect, useCallback } from 'react';
import { ultraFetch } from '@/lib/ultraFast';
import {
    bucketByPrice,
    bucketByPriceAndTime,
    bucketOrderBookByPrice,
    filterTradesByTimeRange,
    type Trade,
    type PriceBin,
    type ClusterBin,
    type BucketerSettings,
    type OrderBookLevel,
} from '@/lib/orderflow/bucketer';

const toBybitSymbol = (s: string) =>
    (s.replace(/USDT|USDC|\/|-/gi, '').toUpperCase() || 'BTC') + 'USDT';

async function fetchBybitTrades(symbol: string, limit: number = 500): Promise<Trade[]> {
    try {
        const bybitSymbol = toBybitSymbol(symbol);
        const res = await ultraFetch(
            `https://api.bybit.com/v5/market/recent-trade?category=linear&symbol=${bybitSymbol}&limit=${limit}`
        );
        if (!res.ok) return [];
        const data = await res.json();
        if (data.retCode !== 0 || !data.result?.list) return [];
        return data.result.list.map((t: any) => {
            const price = parseFloat(t.price);
            const qty = parseFloat(t.size);
            return {
                time: parseInt(t.time),
                price,
                qty,
                value: price * qty,
                side: (t.side === 'Buy' ? 'buy' : 'sell') as 'buy' | 'sell',
            };
        });
    } catch {
        return [];
    }
}

async function fetchBinanceTrades(symbol: string, limit: number = 500): Promise<Trade[]> {
    try {
        const binanceSymbol = toBybitSymbol(symbol);
        const res = await ultraFetch(
            `https://fapi.binance.com/fapi/v1/aggTrades?symbol=${binanceSymbol}&limit=${limit}`
        );
        if (!res.ok) return [];
        const data = await res.json();
        if (!Array.isArray(data)) return [];
        return data.map((t: any) => {
            const price = parseFloat(t.p);
            const qty = parseFloat(t.q);
            return {
                time: t.T,
                price,
                qty,
                value: price * qty,
                side: (t.m ? 'sell' : 'buy') as 'buy' | 'sell',
            };
        });
    } catch {
        return [];
    }
}

export interface OiDataPoint {
    timestamp: number;
    value: number; // USD
}

async function fetchBinanceOiHistory(symbol: string, limit: number = 96): Promise<OiDataPoint[]> {
    try {
        const binanceSymbol = toBybitSymbol(symbol);
        const res = await ultraFetch(
            `https://fapi.binance.com/futures/data/openInterestHist?symbol=${binanceSymbol}&period=15m&limit=${limit}`
        );
        if (!res.ok) return [];
        const data = await res.json();
        if (!Array.isArray(data)) return [];
        return data.map((d: any) => ({
            timestamp: d.timestamp,
            value: parseFloat(d.sumOpenInterestValue || '0'),
        })).filter((p: OiDataPoint) => p.value >= 0);
    } catch {
        return [];
    }
}

export type ClusterType =
    | 'void'
    | 'oi_based'
    | 'volume_profile'
    | 'delta_profile'
    | 'volume_cluster'
    | 'delta_cluster'
    | 'bid_ask_profile'
    | 'delta_ladder_cluster'
    | 'delta_ladder_profile'
    | 'market_profile'
    | 'heatmap';

export interface OrderFlowDataResult {
    priceBins: PriceBin[];
    clusterBins: ClusterBin[];
    trades: Trade[];
    oiHistory: OiDataPoint[];
    isLoading: boolean;
    lastUpdate: Date | null;
    error: string | null;
    refresh: () => Promise<void>;
}

const DEFAULT_SETTINGS: BucketerSettings = {
    binSize: 10,
    timeRange: '15m',
    aggregation: 'price',
    clusterShadeMode: 'volume',
};

const STORAGE_KEY = 'orderflow_cluster_settings';

function loadSettings(): BucketerSettings {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            return { ...DEFAULT_SETTINGS, ...parsed };
        }
    } catch {}
    return DEFAULT_SETTINGS;
}

export interface OrderBookInput {
    bids: OrderBookLevel[];
    asks: OrderBookLevel[];
}

export function useOrderFlowData(
    symbol: string,
    clusterType: ClusterType,
    settings: BucketerSettings,
    orderBook?: OrderBookInput | null
): OrderFlowDataResult {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [oiHistory, setOiHistory] = useState<OiDataPoint[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);

    const needsTrades =
        clusterType === 'volume_profile' ||
        clusterType === 'delta_profile' ||
        clusterType === 'volume_cluster' ||
        clusterType === 'delta_cluster' ||
        clusterType === 'delta_ladder_cluster' ||
        clusterType === 'delta_ladder_profile';

    const needsOrderBook = clusterType === 'bid_ask_profile';
    const needsOi = clusterType === 'oi_based';

    const fetchOi = useCallback(async () => {
        if (!needsOi) return;
        setIsLoading(true);
        setError(null);
        try {
            const data = await fetchBinanceOiHistory(symbol, 96);
            setOiHistory(data);
            setLastUpdate(new Date());
        } catch (e) {
            setError(String(e));
        } finally {
            setIsLoading(false);
        }
    }, [symbol, needsOi]);

    const fetchTrades = useCallback(async () => {
        if (!needsTrades) return;
        setIsLoading(true);
        setError(null);
        try {
            const [bybit, binance] = await Promise.all([
                fetchBybitTrades(symbol, 500),
                fetchBinanceTrades(symbol, 500),
            ]);
            const combined = [...bybit, ...binance].sort((a, b) => a.time - b.time);
            setTrades(combined);
            setLastUpdate(new Date());
        } catch (e) {
            setError(String(e));
        } finally {
            setIsLoading(false);
        }
    }, [symbol, needsTrades]);

    useEffect(() => {
        fetchTrades();
    }, [fetchTrades]);

    useEffect(() => {
        fetchOi();
    }, [fetchOi]);

    const filteredTrades = filterTradesByTimeRange(trades, settings.timeRange);

    const priceBins =
        clusterType === 'bid_ask_profile' && orderBook?.bids && orderBook?.asks
            ? bucketOrderBookByPrice(orderBook.bids, orderBook.asks, settings.binSize)
            : bucketByPrice(filteredTrades, settings.binSize);

    const clusterBins = bucketByPriceAndTime(
        filteredTrades,
        settings.binSize,
        settings.timeRange
    );

    const effectiveLoading = clusterType === 'void' || needsOrderBook ? false : isLoading;

    return {
        priceBins,
        clusterBins,
        trades: filteredTrades,
        oiHistory: needsOi ? oiHistory : [],
        isLoading: effectiveLoading,
        lastUpdate,
        error,
        refresh: needsOi ? fetchOi : fetchTrades,
    };
}

export { loadSettings, DEFAULT_SETTINGS, STORAGE_KEY };
export type { BucketerSettings };
