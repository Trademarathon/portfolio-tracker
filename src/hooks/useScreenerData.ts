"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { apiFetch } from '@/lib/api/client';
import { ScreenerTickerData, acquireSharedScreenerWebSocketManager } from '@/lib/api/screener-websocket';
import { normalizeSymbol } from '@/lib/utils/normalization';

export interface Market {
    id: string;
    symbol: string;
    base: string;
    quote: string;
    exchange: string;
    active: boolean;
}

/** Base symbols for screener rows; aligned with WS subscriptions so WS/REST data has a row to fill */
const SCREENER_BASE_SYMBOLS = [
    'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'LINK', 'AVAX', 'DOT', 'MATIC',
    'UNI', 'ATOM', 'LTC', 'BCH', 'NEAR', 'FIL', 'INJ', 'TIA', 'ARB', 'OP',
    'SUI', 'SEI', 'PEPE', 'WIF', 'APT', 'STX', 'JUP', 'WLD', 'STRK',
];

function buildMarketsForExchanges(): Market[] {
    const exchanges: Array<'binance' | 'bybit' | 'hyperliquid'> = ['binance', 'bybit', 'hyperliquid'];
    const markets: Market[] = [];
    for (const base of SCREENER_BASE_SYMBOLS) {
        const symbol = `${base}/USDT`;
        for (const exchange of exchanges) {
            const id = exchange === 'hyperliquid' ? `${base}-${exchange}` : `${base}USDT-${exchange}`;
            markets.push({ id, symbol, base, quote: 'USDT', exchange, active: true });
        }
    }
    return markets;
}

/** Fallback when markets API fails so each exchange has placeholder rows for all screener symbols */
const DEFAULT_MARKETS: Market[] = buildMarketsForExchanges();

export interface EnhancedTickerData extends ScreenerTickerData {
    // Market data
    id?: string;
    base?: string;
    quote?: string;
    active?: boolean;
    placeholder?: boolean;
    metricsReady?: boolean;
    hasVolume24h?: boolean;
    hasVolume1h?: boolean;
    hasFundingRate?: boolean;
    hasOpenInterest?: boolean;
    // Additional metrics
    momentumScore?: number;
    change4h?: number;
    change8h?: number;
    change12h?: number;
    change1d?: number;
    rvol?: number;
}

// Price tracking for computing short-term changes
const priceHistory: Map<string, { prices: number[], timestamps: number[] }> = new Map();
const volumeHistory: Map<string, { volumes: number[], timestamps: number[] }> = new Map();
const UI_FLUSH_MS = 180;
const MAX_TICKER_KEYS = 6000;
const REST_FALLBACK_POLL_MS = 15000;
const SCREENER_CACHE_KEY = "screener_cache_v1";

function trackPrice(symbol: string, exchange: string, price: number) {
    const key = `${symbol}-${exchange}`;
    if (!priceHistory.has(key)) {
        priceHistory.set(key, { prices: [], timestamps: [] });
    }

    const history = priceHistory.get(key)!;
    const now = Date.now();

    // Optimization: Limit history resolution to ~5s to save memory directly in the browser
    const lastTime = history.timestamps.length > 0 ? history.timestamps[history.timestamps.length - 1] : 0;
    if (now - lastTime! < 5000) {
        // Update last point instead of appending
        if (history.prices.length > 0) {
            history.prices[history.prices.length - 1] = price;
            history.timestamps[history.timestamps.length - 1] = now;
        } else {
            history.prices.push(price);
            history.timestamps.push(now);
        }
    } else {
        history.prices.push(price);
        history.timestamps.push(now);
    }

    // Keep last 65 minutes of data for 1h calculations
    const cutoff = now - 65 * 60 * 1000;
    while (history.timestamps.length > 0 && history.timestamps[0]! < cutoff) {
        history.timestamps.shift();
        history.prices.shift();
    }
}

function trackVolume(symbol: string, exchange: string, volume24h: number) {
    if (!Number.isFinite(volume24h) || volume24h <= 0) return;
    const key = `${symbol}-${exchange}`;
    if (!volumeHistory.has(key)) {
        volumeHistory.set(key, { volumes: [], timestamps: [] });
    }

    const history = volumeHistory.get(key)!;
    const now = Date.now();
    const lastTime = history.timestamps.length > 0 ? history.timestamps[history.timestamps.length - 1] : 0;
    if (now - lastTime < 5000) {
        if (history.volumes.length > 0) {
            history.volumes[history.volumes.length - 1] = volume24h;
            history.timestamps[history.timestamps.length - 1] = now;
        } else {
            history.volumes.push(volume24h);
            history.timestamps.push(now);
        }
    } else {
        history.volumes.push(volume24h);
        history.timestamps.push(now);
    }

    const cutoff = now - 65 * 60 * 1000;
    while (history.timestamps.length > 0 && history.timestamps[0]! < cutoff) {
        history.timestamps.shift();
        history.volumes.shift();
    }
}

function estimateVolume1h(symbol: string, exchange: string): number {
    const key = `${symbol}-${exchange}`;
    const history = volumeHistory.get(key);
    if (!history || history.volumes.length < 2) return 0;

    const cutoff = Date.now() - 60 * 60 * 1000;
    let rolling = 0;
    for (let i = 1; i < history.volumes.length; i++) {
        if (history.timestamps[i]! < cutoff) continue;
        const prev = history.volumes[i - 1]!;
        const curr = history.volumes[i]!;
        const delta = curr >= prev ? curr - prev : curr; // 24h rolling window reset
        if (delta > 0) rolling += delta;
    }
    return rolling;
}

function estimateVolume5m(symbol: string, exchange: string): number {
    const key = `${symbol}-${exchange}`;
    const history = volumeHistory.get(key);
    if (!history || history.volumes.length < 2) return 0;

    const cutoff = Date.now() - 5 * 60 * 1000;
    let rolling = 0;
    for (let i = 1; i < history.volumes.length; i++) {
        if (history.timestamps[i]! < cutoff) continue;
        const prev = history.volumes[i - 1]!;
        const curr = history.volumes[i]!;
        const delta = curr >= prev ? curr - prev : curr;
        if (delta > 0) rolling += delta;
    }
    return rolling;
}

function deriveRvol(volume5m: number, volume24h: number): number {
    if (!Number.isFinite(volume24h) || volume24h <= 0) return 0;
    const avg5m = Math.max(volume24h / 288, 1);
    const value = volume5m / avg5m;
    if (!Number.isFinite(value) || value < 0) return 0;
    return Math.min(value, 99.99);
}

function resolveVolume1h(symbol: string, exchange: string, rawVolume1h: number | undefined, volume24h: number): number {
    const explicit = Number(rawVolume1h);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;

    const tracked = estimateVolume1h(symbol, exchange);
    if (tracked > 0) return tracked;

    if (Number.isFinite(volume24h) && volume24h > 0) {
        return volume24h / 24;
    }

    return 0;
}

function resolveRvol(symbol: string, exchange: string, rawRvol: number | undefined, volume1h: number, volume24h: number): number {
    const tracked5m = estimateVolume5m(symbol, exchange);
    const fallback5m = tracked5m > 0 ? tracked5m : (volume1h > 0 ? volume1h / 12 : 0);
    const derived = deriveRvol(fallback5m, volume24h);

    const incoming = Number(rawRvol);
    if (!Number.isFinite(incoming) || incoming <= 0) return derived;

    const clampedIncoming = Math.min(incoming, 99.99);
    // Ignore obviously inflated feed values and prefer local-derived RVOL.
    if (derived > 0 && clampedIncoming > derived * 12) {
        return derived;
    }
    return clampedIncoming;
}

function getMetrics(symbol: string, exchange: string, currentPrice: number, volume24h: number) {
    const key = `${symbol}-${exchange}`;
    const history = priceHistory.get(key);

    if (!history || history.prices.length < 2) {
        const volume1h = estimateVolume1h(symbol, exchange);
        const volume5m = estimateVolume5m(symbol, exchange);
        return {
            change5m: 0,
            change15m: 0,
            change1h: 0,
            volatility15m: 0,
            trades15m: 0,
            volume1h,
            rvol: deriveRvol(volume5m, volume24h),
            liquidations5m: 0,
            liquidations1h: 0,
            metricsReady: false
        };
    }

    const now = Date.now();
    const findPriceAtTime = (msAgo: number) => {
        const targetTime = now - msAgo;
        // Find closest timestamp
        for (let i = history.timestamps.length - 1; i >= 0; i--) {
            if (history.timestamps[i]! <= targetTime) {
                return history.prices[i];
            }
        }
        return history.prices[0]; // fallback to oldest
    };

    const price5m = findPriceAtTime(5 * 60 * 1000);
    const price15m = findPriceAtTime(15 * 60 * 1000);
    const price1h = findPriceAtTime(60 * 60 * 1000);

    const change5m = price5m ? ((currentPrice - price5m) / price5m) * 100 : 0;
    const change15m = price15m ? ((currentPrice - price15m) / price15m) * 100 : 0;
    const change1h = price1h ? ((currentPrice - price1h) / price1h) * 100 : 0;

    // Calculate volatility (std dev of returns in last 15m)
    let volatility15m = 0;
    const prices15m = [];
    for (let i = 0; i < history.timestamps.length; i++) {
        if (history.timestamps[i]! > now - 15 * 60 * 1000) {
            prices15m.push(history.prices[i]!);
        }
    }

    if (prices15m.length > 1) {
        const mean = prices15m.reduce((a, b) => a + b, 0) / prices15m.length;
        const variance = prices15m.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices15m.length;
        volatility15m = (Math.sqrt(variance) / mean) * 100;
    }

    // Simulate trades count based on volume
    const trades15m = Math.round((volume24h / 96) / 500);
    const volume1h = estimateVolume1h(symbol, exchange);
    const volume5m = estimateVolume5m(symbol, exchange);
    const rvol = deriveRvol(volume5m, volume24h);

    // Simulate liquidations based on volatility spikes
    const baseLiq = volume24h * 0.0001; // Base liquidation factor
    const volFactor = volatility15m > 0.5 ? volatility15m : 0;

    const liquidations5m = Math.round(baseLiq * volFactor);
    const liquidations1h = Math.round(baseLiq * volFactor * 12);

    return {
        change5m,
        change15m,
        change1h,
        volatility15m,
        trades15m,
        volume1h,
        rvol,
        liquidations5m,
        liquidations1h,
        metricsReady: true
    };
}

function calculateMomentumScore(ticker: ScreenerTickerData & { momentumScore?: number; volume24h?: number; change24h?: number }) {
    // Simple momentum score based on volume and price change
    const volScore = Math.min((ticker.volume24h || 0) / 10000000, 10); // Cap at 10
    const priceScore = Math.abs(ticker.change24h || 0) / 10; // Scale down
    return Math.min(volScore + priceScore, 10);
}

interface TickerUpdateData {
    price?: number;
    change24h?: number;
    volume24h?: number;
    volume1h?: number;
    timestamp?: number;
    fundingRate?: number;
    openInterest?: number;
    oiChange1h?: number;
    change5m?: number;
    change15m?: number;
    change1h?: number;
    volatility15m?: number;
    trades15m?: number;
    rvol?: number;
    liquidations5m?: number;
    liquidations1h?: number;
}

export interface UseScreenerDataOptions {
    live?: boolean;
    enableRestFallback?: boolean;
}

export function useScreenerData(options: UseScreenerDataOptions = {}) {
    const live = options.live ?? true;
    const enableRestFallback = options.enableRestFallback ?? live;
    const [markets, setMarkets] = useState<Market[]>([]);
    const [tickers, setTickers] = useState<Map<string, EnhancedTickerData>>(new Map());
    const [loading, setLoading] = useState(true);
    const [connectionStatus, setConnectionStatus] = useState<Record<string, boolean>>({
        binance: false,
        bybit: false,
        hyperliquid: false
    });

    const uiUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastUiFlushAtRef = useRef(0);
    const tickersRef = useRef<Map<string, EnhancedTickerData>>(new Map());
    const wsReleaseRef = useRef<(() => void) | null>(null);
    const isHiddenRef = useRef(false);
    const marketsRef = useRef<Market[]>([]);

    useEffect(() => {
        marketsRef.current = markets;
    }, [markets]);

    useEffect(() => {
        if (typeof document === 'undefined') return;
        const onVisibility = () => {
            isHiddenRef.current = document.visibilityState === 'hidden';
            if (!isHiddenRef.current) {
                setTickers(new Map(tickersRef.current));
            }
        };
        onVisibility();
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const raw = localStorage.getItem(SCREENER_CACHE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw) as {
                markets?: Market[];
                tickers?: Array<[string, EnhancedTickerData]>;
            };
            if (Array.isArray(parsed.markets) && parsed.markets.length > 0) {
                setMarkets(parsed.markets);
            }
            if (Array.isArray(parsed.tickers) && parsed.tickers.length > 0) {
                const restored = new Map<string, EnhancedTickerData>(parsed.tickers);
                tickersRef.current = restored;
                setTickers(new Map(restored));
            }
        } catch {
            // ignore cache parse issues
        }
    }, []);

    // Fetch markets list (with fallback - WebSocket provides live data even if API fails)
    useEffect(() => {
        const fetchMarkets = async () => {
            try {
                const ctrl = new AbortController();
                const t = setTimeout(() => ctrl.abort(), 5000);
                const response = await apiFetch('/api/screener/markets', { signal: ctrl.signal }, 6000);
                clearTimeout(t);
                if (!response.ok) throw new Error('Failed to fetch markets');

                const data = await response.json();
                const resolvedMarkets = Array.isArray(data.markets) && data.markets.length > 0
                    ? data.markets
                    : DEFAULT_MARKETS;
                setMarkets(resolvedMarkets);
            } catch (_error) {
                setMarkets(DEFAULT_MARKETS);
            } finally {
                setLoading(false);
            }
        };

        fetchMarkets();
    }, []);

    // Initialize data watching
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!live) return;

        const handleTickerUpdate = (exchange: string, symbol: string, data: TickerUpdateData) => {
            const normalizedSymbol = normalizeSymbol(symbol);
            const key = `${normalizedSymbol}-${exchange}`;

            // Update price history for metrics
            if (data.price) {
                trackPrice(normalizedSymbol, exchange, data.price);
            }
            if (data.volume24h !== undefined) {
                trackVolume(normalizedSymbol, exchange, data.volume24h);
            }

            const localMetrics = getMetrics(normalizedSymbol, exchange, data.price || 0, data.volume24h || 0);
            // Prefer WS-supplied metrics when present; fall back to local getMetrics() for missing only
            const volume24h = data.volume24h || 0;
            const change5m = data.change5m ?? localMetrics.change5m;
            const change15m = data.change15m ?? localMetrics.change15m;
            const change1h = data.change1h ?? localMetrics.change1h;
            const volatility15m = data.volatility15m ?? localMetrics.volatility15m;
            const trades15m = data.trades15m ?? localMetrics.trades15m;
            const volume1h = resolveVolume1h(normalizedSymbol, exchange, data.volume1h ?? localMetrics.volume1h, volume24h);
            const rvol = resolveRvol(normalizedSymbol, exchange, data.rvol ?? localMetrics.rvol, volume1h, volume24h);
            const liquidations5m = data.liquidations5m ?? localMetrics.liquidations5m;
            const liquidations1h = data.liquidations1h ?? localMetrics.liquidations1h;
            const metricsReady = localMetrics.metricsReady ?? false;

            const enhanced: EnhancedTickerData = {
                symbol: normalizedSymbol,
                exchange: exchange as 'binance' | 'bybit' | 'hyperliquid',
                price: data.price || 0,
                change24h: data.change24h || 0,
                volume24h,
                volume1h,
                rvol,
                timestamp: data.timestamp || Date.now(),
                fundingRate: data.fundingRate,
                openInterest: data.openInterest,
                oiChange1h: data.oiChange1h,
                change5m,
                change15m,
                change1h,
                volatility15m,
                trades15m,
                liquidations5m,
                liquidations1h,
                placeholder: false,
                metricsReady,
                hasVolume24h: data.volume24h !== undefined,
                hasVolume1h: data.volume1h !== undefined || volume1h > 0,
                hasFundingRate: data.fundingRate !== undefined,
                hasOpenInterest: data.openInterest !== undefined,
                momentumScore: calculateMomentumScore({
                    symbol: normalizedSymbol,
                    exchange: exchange as 'binance' | 'bybit' | 'hyperliquid',
                    price: data.price || 0,
                    change24h: data.change24h || 0,
                    volume24h: data.volume24h || 0,
                    timestamp: data.timestamp || Date.now(),
                    change5m,
                    change15m,
                    change1h,
                    volatility15m,
                    trades15m,
                    liquidations5m,
                    liquidations1h
                }),
            };

            // Check for newer data
            const existing = tickersRef.current.get(key);
            if (existing && existing.timestamp >= enhanced.timestamp) {
                return;
            }

            tickersRef.current.set(key, enhanced);
            if (tickersRef.current.size > MAX_TICKER_KEYS) {
                // Keep map bounded in long-running desktop sessions.
                const sorted = Array.from(tickersRef.current.entries()).sort(
                    (a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0)
                );
                tickersRef.current = new Map(sorted.slice(0, MAX_TICKER_KEYS));
            }

            // Debounce UI update
            if (uiUpdateTimeoutRef.current) {
                clearTimeout(uiUpdateTimeoutRef.current);
            }
            // Desktop-safe batching to avoid webview overload.
            uiUpdateTimeoutRef.current = setTimeout(() => {
                const now = Date.now();
                if (now - lastUiFlushAtRef.current < UI_FLUSH_MS) return;
                lastUiFlushAtRef.current = now;
                if (isHiddenRef.current) return;
                setTickers(new Map(tickersRef.current));
            }, UI_FLUSH_MS);
        };

        // Use a shared singleton WS manager (prevents multiple instances during navigation/HMR)
        const { release } = acquireSharedScreenerWebSocketManager(
            (ticker: ScreenerTickerData) => {
                handleTickerUpdate(ticker.exchange, ticker.symbol, {
                    price: ticker.price,
                    change24h: ticker.change24h,
                    volume24h: ticker.volume24h,
                    volume1h: ticker.volume1h,
                    timestamp: ticker.timestamp,
                    fundingRate: ticker.fundingRate,
                    openInterest: ticker.openInterest,
                    oiChange1h: (ticker as any).oiChange1h,
                    change5m: ticker.change5m,
                    change15m: ticker.change15m,
                    change1h: ticker.change1h,
                    volatility15m: ticker.volatility15m,
                    trades15m: ticker.trades15m,
                    rvol: ticker.rvol,
                    liquidations5m: ticker.liquidations5m,
                    liquidations1h: ticker.liquidations1h,
                });
            },
            (status) => {
                setConnectionStatus(prev => ({ ...prev, [status.exchange]: status.connected }));
            }
        );
        wsReleaseRef.current = release;

        let restFallbackTimer: ReturnType<typeof setInterval> | null = null;
        const refreshFromRestFallback = async () => {
            try {
                // Binance 24h futures ticker snapshot
                const bRes = await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr');
                if (bRes.ok) {
                    const rows = await bRes.json() as Array<{ symbol?: string; lastPrice?: string; priceChangePercent?: string; quoteVolume?: string }>;
                    if (Array.isArray(rows)) {
                        const now = Date.now();
                        for (const r of rows) {
                            const sym = (r.symbol || '').toUpperCase();
                            if (!sym.endsWith('USDT')) continue;
                            const normalizedSymbol = normalizeSymbol(sym);
                            const key = `${normalizedSymbol}-binance`;
                            const existing = tickersRef.current.get(key);
                            // Do not override fresh WS data; only backfill missing/stale.
                            if (existing && now - (existing.timestamp || 0) < REST_FALLBACK_POLL_MS * 2) continue;
                            const price = parseFloat(r.lastPrice || '0') || 0;
                            const change24h = parseFloat(r.priceChangePercent || '0') || 0;
                            const volume24h = parseFloat(r.quoteVolume || '0') || 0;
                            if (!price) continue;
                            trackVolume(normalizedSymbol, 'binance', volume24h);
                            const est1h = estimateVolume1h(normalizedSymbol, 'binance');
                            tickersRef.current.set(key, {
                                symbol: normalizedSymbol,
                                exchange: 'binance',
                                price,
                                change24h,
                                volume24h,
                                volume1h: est1h || (volume24h / 24),
            rvol: deriveRvol((est1h || (volume24h / 24)) / 12, volume24h),
                                timestamp: now,
                                placeholder: false,
                                metricsReady: existing?.metricsReady ?? false,
                                hasVolume24h: true,
                                hasVolume1h: true,
                                hasFundingRate: existing?.hasFundingRate ?? false,
                                hasOpenInterest: existing?.hasOpenInterest ?? false,
                                momentumScore: calculateMomentumScore({
                                    symbol: normalizedSymbol,
                                    exchange: 'binance',
                                    price,
                                    change24h,
                                    volume24h,
                                    timestamp: now,
                                }),
                                change5m: existing?.change5m || 0,
                                change15m: existing?.change15m || 0,
                                change1h: existing?.change1h || 0,
                                volatility15m: existing?.volatility15m || 0,
                                trades15m: existing?.trades15m || 0,
                                liquidations5m: existing?.liquidations5m || 0,
                                liquidations1h: existing?.liquidations1h || 0,
                                openInterest: existing?.openInterest || 0,
                                fundingRate: existing?.fundingRate || 0,
                                oiChange1h: (existing as any)?.oiChange1h,
                            });
                        }
                    }
                }
            } catch {
                // Ignore REST fallback failures
            }

            try {
                // Bybit 24h linear ticker snapshot
                const yRes = await fetch('https://api.bybit.com/v5/market/tickers?category=linear');
                if (yRes.ok) {
                    const data = await yRes.json() as { result?: { list?: Array<{ symbol?: string; lastPrice?: string; price24hPcnt?: string; turnover24h?: string; openInterest?: string; fundingRate?: string }> } };
                    const list = data?.result?.list || [];
                    const now = Date.now();
                    for (const r of list) {
                        const sym = (r.symbol || '').toUpperCase();
                        if (!sym.endsWith('USDT')) continue;
                        const normalizedSymbol = normalizeSymbol(sym);
                        const key = `${normalizedSymbol}-bybit`;
                        const existing = tickersRef.current.get(key);
                        if (existing && now - (existing.timestamp || 0) < REST_FALLBACK_POLL_MS * 2) continue;
                        const price = parseFloat(r.lastPrice || '0') || 0;
                        const change24h = (parseFloat(r.price24hPcnt || '0') || 0) * 100;
                        const volume24h = parseFloat(r.turnover24h || '0') || 0;
                        if (!price) continue;
                        trackVolume(normalizedSymbol, 'bybit', volume24h);
                        const est1h = estimateVolume1h(normalizedSymbol, 'bybit');
                            tickersRef.current.set(key, {
                                symbol: normalizedSymbol,
                                exchange: 'bybit',
                                price,
                                change24h,
                                volume24h,
                                volume1h: est1h || (volume24h / 24),
                                rvol: deriveRvol((est1h || (volume24h / 24)) / 12, volume24h),
                                timestamp: now,
                                placeholder: false,
                                metricsReady: existing?.metricsReady ?? false,
                                hasVolume24h: true,
                                hasVolume1h: true,
                                hasFundingRate: r.fundingRate !== undefined || existing?.hasFundingRate || false,
                                hasOpenInterest: r.openInterest !== undefined || existing?.hasOpenInterest || false,
                                momentumScore: calculateMomentumScore({
                                    symbol: normalizedSymbol,
                                    exchange: 'bybit',
                                    price,
                                    change24h,
                                volume24h,
                                timestamp: now,
                            }),
                            change5m: existing?.change5m || 0,
                            change15m: existing?.change15m || 0,
                            change1h: existing?.change1h || 0,
                            volatility15m: existing?.volatility15m || 0,
                            trades15m: existing?.trades15m || 0,
                            liquidations5m: existing?.liquidations5m || 0,
                            liquidations1h: existing?.liquidations1h || 0,
                            openInterest: parseFloat(r.openInterest || '0') || existing?.openInterest || 0,
                            fundingRate: parseFloat(r.fundingRate || '0') || existing?.fundingRate || 0,
                            oiChange1h: (existing as any)?.oiChange1h,
                        });
                    }
                }
            } catch {
                // Ignore REST fallback failures
            }

            if (!isHiddenRef.current) {
                setTickers(new Map(tickersRef.current));
            }
            if (typeof window !== 'undefined') {
                try {
                    localStorage.setItem(
                        SCREENER_CACHE_KEY,
                        JSON.stringify({
                            markets: (marketsRef.current && marketsRef.current.length > 0) ? marketsRef.current : DEFAULT_MARKETS,
                            tickers: Array.from(tickersRef.current.entries()).slice(0, 1200),
                        })
                    );
                } catch {
                    // ignore cache write issues
                }
            }
        };

        if (enableRestFallback) {
            refreshFromRestFallback();
            restFallbackTimer = setInterval(refreshFromRestFallback, REST_FALLBACK_POLL_MS);
        }

        return () => {
            if (uiUpdateTimeoutRef.current) {
                clearTimeout(uiUpdateTimeoutRef.current);
            }
            if (restFallbackTimer) {
                clearInterval(restFallbackTimer);
            }
            wsReleaseRef.current?.();
            wsReleaseRef.current = null;
        };
    }, [live, enableRestFallback]);

    // Compute derived data - handle data merging with proper defaults for all table columns
    const tickersList = useMemo(() => {
        const effectiveMarkets = markets && markets.length > 0 ? markets : DEFAULT_MARKETS;

        // Create a map for deduplication: key = symbol-exchange
        const resultMap = new Map<string, EnhancedTickerData>();

        // First, add WebSocket tickers (with defaults)
        Array.from(tickers.values()).forEach(ticker => {
            const key = `${ticker.symbol}-${ticker.exchange}`;
            if (!resultMap.has(key)) {
                resultMap.set(key, {
                    ...ticker,
                    id: ticker.id || key,
                    base: ticker.base || ticker.symbol?.replace(/USDT|USDC|USD/gi, '') || '',
                    quote: ticker.quote || 'USDT',
                    active: true,
                    // Ensure all optional fields
                    momentumScore: ticker.momentumScore || 0,
                    change5m: ticker.change5m || 0,
                    change15m: ticker.change15m || 0,
                    change1h: ticker.change1h || 0,
                    change24h: ticker.change24h || 0,
                    change4h: ticker.change4h || 0,
                    change8h: ticker.change8h || 0,
                    change12h: ticker.change12h || 0,
                    change1d: ticker.change1d || 0,
                    openInterest: ticker.openInterest || 0,
                    fundingRate: ticker.fundingRate || 0,
                    trades15m: ticker.trades15m || 0,
                    volatility15m: ticker.volatility15m || 0,
                    liquidations5m: ticker.liquidations5m || 0,
                    liquidations1h: ticker.liquidations1h || 0,
                    volume1h: resolveVolume1h(ticker.symbol, ticker.exchange, ticker.volume1h, ticker.volume24h || 0),
                    rvol: resolveRvol(
                        ticker.symbol,
                        ticker.exchange,
                        ticker.rvol,
                        resolveVolume1h(ticker.symbol, ticker.exchange, ticker.volume1h, ticker.volume24h || 0),
                        ticker.volume24h || 0
                    ),
                    oiChange1h: (ticker as any).oiChange1h,
                    placeholder: ticker.placeholder ?? false,
                    metricsReady: ticker.metricsReady ?? false,
                    hasVolume24h: ticker.hasVolume24h ?? (ticker.volume24h || 0) > 0,
                    hasVolume1h: ticker.hasVolume1h ?? (ticker.volume1h || 0) > 0,
                    hasFundingRate: ticker.hasFundingRate ?? ticker.fundingRate !== undefined,
                    hasOpenInterest: ticker.hasOpenInterest ?? ticker.openInterest !== undefined,
                });
            }
        });

        // Then, add static/fallback markets (will not override WebSocket data)
        effectiveMarkets.forEach(market => {
            const key = `${normalizeSymbol(market.symbol)}-${market.exchange}`;
            if (resultMap.has(key)) {
                // Already have WebSocket data for this market, update with market data (like id, base, quote)
                const existing = resultMap.get(key)!;
                resultMap.set(key, {
                    ...existing,
                    id: market.id || existing.id,
                    base: market.base || existing.base,
                    quote: market.quote || existing.quote,
                    active: market.active !== false,
                });
            } else {
                // No WebSocket data, create a minimal ticker from the market
                const minimalTicker: EnhancedTickerData = {
                    symbol: normalizeSymbol(market.symbol),
                    exchange: market.exchange as 'binance' | 'bybit' | 'hyperliquid',
                    price: 0,
                    change24h: 0,
                    volume24h: 0,
                    timestamp: Date.now(),
                    id: market.id,
                    base: market.base,
                    quote: market.quote,
                    active: market.active !== false,
                    placeholder: true,
                    metricsReady: false,
                    hasVolume24h: false,
                    hasVolume1h: false,
                    hasFundingRate: false,
                    hasOpenInterest: false,
                    // Defaults for optional fields
                    momentumScore: 0,
                    change5m: 0,
                    change15m: 0,
                    change1h: 0,
                    change4h: 0,
                    change8h: 0,
                    change12h: 0,
                    change1d: 0,
                    openInterest: 0,
                    fundingRate: 0,
                    trades15m: 0,
                    volatility15m: 0,
                    liquidations5m: 0,
                    liquidations1h: 0,
                    volume1h: 0,
                    rvol: 0,
                    oiChange1h: undefined,
                };
                resultMap.set(key, minimalTicker);
            }
        });

        return Array.from(resultMap.values());
    }, [markets, tickers]);

    const topGainers = useMemo(() => {
        return tickersList
            .filter(t => t.volume24h > 1000000) // Min $1M volume
            .sort((a, b) => (b.change24h || 0) - (a.change24h || 0))
            .slice(0, 10);
    }, [tickersList]);

    const topLosers = useMemo(() => {
        return tickersList
            .filter(t => t.volume24h > 1000000)
            .sort((a, b) => (a.change24h || 0) - (b.change24h || 0))
            .slice(0, 10);
    }, [tickersList]);

    const fundingExtremes = useMemo(() => {
        const withFunding = tickersList.filter(t => t.fundingRate !== undefined);
        return {
            highestLong: withFunding.sort((a, b) => (b.fundingRate || 0) - (a.fundingRate || 0)).slice(0, 5),
            highestShort: withFunding.sort((a, b) => (a.fundingRate || 0) - (b.fundingRate || 0)).slice(0, 5)
        };
    }, [tickersList]);


    const isConnected = useMemo(() => {
        if (!connectionStatus || typeof connectionStatus !== 'object') return false;
        try {
            const vals = Object.values(connectionStatus || {});
            return vals.length > 0 && vals.some(v => !!v);
        } catch (_err) {
            return false;
        }
    }, [connectionStatus]);

    return {
        markets,
        tickers,
        tickersList,
        topGainers,
        topLosers,
        fundingExtremes,
        loading,
        connectionStatus,
        isConnected
    };
}
