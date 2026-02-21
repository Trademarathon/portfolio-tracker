"use client";

import { useState, useEffect, useCallback } from 'react';
import { ultraFetch } from '@/lib/ultraFast';

export interface FootprintCandle {
    open: number;
    high: number;
    low: number;
    close: number;
    totalVol: number;
    time: number;
}

const toBinanceSymbol = (s: string) =>
    (s.replace(/USDT|USDC|\/|-/gi, '').toUpperCase() || 'BTC') + 'USDT';

const INTERVAL_MAP: Record<string, string> = {
    '1m': '1m',
    '5m': '5m',
    '15m': '15m',
    '1h': '1h',
};

async function fetchBinanceKlines(
    symbol: string,
    interval: string,
    limit: number = 200
): Promise<FootprintCandle[]> {
    try {
        const binanceSymbol = toBinanceSymbol(symbol);
        const res = await ultraFetch(
            `https://fapi.binance.com/fapi/v1/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${limit}`
        );
        if (!res.ok) return [];
        const data = await res.json();
        if (!Array.isArray(data)) return [];
        return data.map((k: (string | number)[]) => {
            const open = parseFloat(String(k[1]));
            const high = parseFloat(String(k[2]));
            const low = parseFloat(String(k[3]));
            const close = parseFloat(String(k[4]));
            const vol = parseFloat(String(k[5]));
            return {
                time: Number(k[0]),
                open,
                high,
                low,
                close,
                totalVol: vol * close,
            };
        });
    } catch {
        return [];
    }
}

export function useFootprintData(
    symbol: string,
    interval: '1m' | '5m' | '15m' | '1h'
): {
    candles: FootprintCandle[];
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
} {
    const [candles, setCandles] = useState<FootprintCandle[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const klines = await fetchBinanceKlines(symbol, INTERVAL_MAP[interval] || '5m');
            setCandles(klines);
        } catch (e) {
            setError(String(e));
        } finally {
            setIsLoading(false);
        }
    }, [symbol, interval]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { candles, isLoading, error, refresh: fetchData };
}
