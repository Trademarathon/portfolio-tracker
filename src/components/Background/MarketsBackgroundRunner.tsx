"use client";

import { useEffect, useRef } from "react";
import { useAlerts } from "@/hooks/useAlerts";
import {
    ScreenerTickerData,
    acquireSharedScreenerWebSocketManager,
} from "@/lib/api/screener-websocket";

const STARTUP_GRACE_MS = 2000;
const ALERT_SCAN_INTERVAL_MS = 5000;
const MAX_TICKERS = 6000;

type AlertMetricsSnapshot = {
    change24h?: number;
    change15m?: number;
    change5m?: number;
    volume24h?: number;
    fundingRate?: number;
    momentumScore?: number;
    oiChange1h?: number;
    rvol?: number;
    trades15m?: number;
    volatility15m?: number;
    openInterest?: number;
};

function calculateMomentumScore(ticker: ScreenerTickerData): number {
    const volScore = Math.min((ticker.volume24h || 0) / 10_000_000, 10);
    const priceScore = Math.abs(ticker.change24h || 0) / 10;
    return Math.min(volScore + priceScore, 10);
}

export function MarketsBackgroundRunner() {
    const { checkAlerts, detectSignals } = useAlerts();
    const tickersRef = useRef<Map<string, ScreenerTickerData>>(new Map());
    const connectionRef = useRef<Record<string, boolean>>({
        binance: false,
        bybit: false,
        hyperliquid: false,
    });
    const alertsEnabledRef = useRef(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            alertsEnabledRef.current = true;
        }, STARTUP_GRACE_MS);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const { release } = acquireSharedScreenerWebSocketManager(
            (ticker) => {
                const key = `${ticker.symbol}-${ticker.exchange}`;
                const next = tickersRef.current;
                next.set(key, ticker);

                if (next.size <= MAX_TICKERS) return;

                const trimmed = Array.from(next.entries())
                    .sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0))
                    .slice(0, MAX_TICKERS);

                tickersRef.current = new Map(trimmed);
            },
            (status) => {
                connectionRef.current[status.exchange] = status.connected;
            }
        );

        return () => release();
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            if (!alertsEnabledRef.current) return;
            if (tickersRef.current.size === 0) return;

            const hasLiveConnection = Object.values(connectionRef.current).some(Boolean);
            if (!hasLiveConnection) return;

            const latestBySymbol = new Map<string, ScreenerTickerData>();
            tickersRef.current.forEach((ticker) => {
                const existing = latestBySymbol.get(ticker.symbol);
                if (!existing || (ticker.timestamp || 0) >= (existing.timestamp || 0)) {
                    latestBySymbol.set(ticker.symbol, ticker);
                }
            });

            if (latestBySymbol.size === 0) return;

            const prices: Record<string, number> = {};
            const metrics: Record<string, AlertMetricsSnapshot> = {};

            latestBySymbol.forEach((ticker, symbol) => {
                prices[symbol] = ticker.price || 0;
                metrics[symbol] = {
                    change24h: ticker.change24h,
                    change15m: ticker.change15m,
                    change5m: ticker.change5m,
                    volume24h: ticker.volume24h,
                    fundingRate: ticker.fundingRate,
                    momentumScore: calculateMomentumScore(ticker),
                    oiChange1h: ticker.oiChange1h,
                    rvol: ticker.rvol,
                    trades15m: ticker.trades15m,
                    volatility15m: ticker.volatility15m,
                    openInterest: ticker.openInterest,
                };
            });

            checkAlerts(prices, metrics);
            detectSignals(prices, metrics);
        }, ALERT_SCAN_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [checkAlerts, detectSignals]);

    return null;
}
