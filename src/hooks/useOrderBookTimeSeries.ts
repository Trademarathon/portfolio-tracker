"use client";

import { useState, useEffect, useRef } from 'react';
import { useFuturesWebSocket } from '@/hooks/useFuturesAggregator';
import type { OrderBookLevel } from '@/lib/api/futures-aggregator';

export interface OrderBookSnapshot {
    timestamp: number;
    bids: OrderBookLevel[];
    asks: OrderBookLevel[];
    midPrice: number;
}

const SAMPLE_MS = 200;
const MAX_SNAPSHOTS = 300; // ~1 min at 200ms, ~5 min at 1s
const PRICE_LEVELS = 50;

export function useOrderBookTimeSeries(symbol: string, exchange: 'binance' | 'bybit' = 'binance') {
    const { realtimeBook } = useFuturesWebSocket(symbol, [exchange]);
    const [snapshots, setSnapshots] = useState<OrderBookSnapshot[]>([]);
    const bookRef = useRef(realtimeBook[exchange]);
    bookRef.current = realtimeBook[exchange];

    useEffect(() => {
        const iv = setInterval(() => {
            const book = bookRef.current;
            if (!book?.bids?.length || !book?.asks?.length) return;

            const snapshot: OrderBookSnapshot = {
                timestamp: Date.now(),
                bids: book.bids.slice(0, PRICE_LEVELS),
                asks: book.asks.slice(0, PRICE_LEVELS),
                midPrice: book.midPrice,
            };

            setSnapshots((prev) => [...prev, snapshot].slice(-MAX_SNAPSHOTS));
        }, SAMPLE_MS);
        return () => clearInterval(iv);
    }, [symbol, exchange]);

    return { snapshots, currentBook: realtimeBook[exchange] };
}
