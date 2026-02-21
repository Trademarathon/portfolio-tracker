"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { EnhancedWebSocketManager } from '@/lib/api/websocket-enhanced';
import { WebSocketMessage } from '@/lib/api/websocket-types';
import { normalizeSymbol } from '@/lib/utils/normalization';

export interface TickerData {
    symbol: string;
    price: number;
    change24h: number;
    change1h: number; // Approximate from stream
    volume24h: number;
    fundingRate: number;
    openInterest: number; // USD
}

// Singleton manager instance for universal data
let universalManager: EnhancedWebSocketManager | null = null;
const subscribers = new Set<(data: any) => void>();

// Initialize singleton if needed
function initManager() {
    if (!universalManager && typeof window !== 'undefined') {
        console.log('[useRealtimeMarket] Creating Universal Manager instance...');
        // Create a manager that just handles universal data
        universalManager = new EnhancedWebSocketManager(
            [], // No user connections needed for universal data
            (msg: WebSocketMessage) => {
                // Broadcast to all subscribers
                subscribers.forEach(cb => cb(msg));
            },
            undefined, // onStatusChange
            undefined, // reconnectConfig
            true // Enable Universal Mode
        );
        universalManager.initialize();
    }
}

export function getUniversalManager() {
    initManager();
    return universalManager;
}

export function subscribeToUniversalMessages(cb: (msg: WebSocketMessage) => void) {
    initManager();
    subscribers.add(cb);
    return () => subscribers.delete(cb);
}

export function useRealtimeMarket(symbols?: string[]) {
    // State for UI
    const [prices, setPrices] = useState<Record<string, number>>({});
    const [stats, setStats] = useState<Record<string, TickerData>>({});

    // Refs for buffering updates
    const pricesRef = useRef<Record<string, number>>({});
    const statsRef = useRef<Record<string, TickerData>>({});
    const dirtyRef = useRef(false);

    useEffect(() => {
        initManager();

        const handleMessage = (msg: WebSocketMessage) => {
            if (msg.type === 'allMids') {
                // msg.data is { "BTC": "65000", ... }
                const updates: Record<string, number> = {};
                if (!msg.data) return;
                for (const [coin, price] of Object.entries(msg.data)) {
                    const n = parseFloat(price as string);
                    if (!Number.isFinite(n)) continue;
                    updates[coin] = n;
                }

                // Merge into ref
                pricesRef.current = { ...pricesRef.current, ...updates };
                dirtyRef.current = true;
                // console.log(`[Realtime] keys: ${Object.keys(updates).length}`);
            }
            else if (msg.type === 'marketStats') {
                // Process webData2
                // Structure: [metadata, assetCtxs]
                // We need to parse this efficiently
                const data = msg.data as any;
                const { spotState: _spotState, perpState: _perpState, spotMeta, meta } = data;
                const assetCtxs = data.assetCtxs;
                const universe = meta?.universe || [];

                // 1. Process PERPS
                if (assetCtxs && universe) {
                    universe.forEach((asset: any, index: number) => {
                        const ctx = assetCtxs[index];
                        if (!ctx) return;

                        const name = asset.name;
                        const normalized = normalizeSymbol(name);
                        const price = parseFloat(ctx.markPx);
                        const dayNfv = parseFloat(ctx.dayNfv);
                        const prevDayPx = parseFloat(ctx.prevDayPx);
                        const openInterest = parseFloat(ctx.openInterest) * price;
                        const funding = parseFloat(ctx.funding);

                        const change24h = prevDayPx > 0 ? ((price / prevDayPx) - 1) * 100 : 0;

                        const ticker: TickerData = {
                            symbol: name,
                            price,
                            change24h,
                            change1h: change24h * 0.1,
                            volume24h: dayNfv,
                            fundingRate: funding,
                            openInterest
                        };

                        // Store under original Hyperliquid name
                        statsRef.current[name] = ticker;
                        pricesRef.current[name] = price;

                        // Also store under a normalized key so other parts of the app
                        // (e.g. portfolio + orders, which use normalized symbols like BTC)
                        // can correctly resolve PRICE / DIST / QTY for HL tickers.
                        if (normalized && normalized !== name) {
                            statsRef.current[normalized] = {
                                ...ticker,
                                symbol: normalized
                            };
                            pricesRef.current[normalized] = price;
                        }
                        dirtyRef.current = true;
                    });
                }

                // 2. Process SPOT
                // webData2 structure for spot: spotAssetCtxs matches spotMeta.universe
                const spotCtxs = (msg.data as any).spotAssetCtxs;
                const spotUniverse = spotMeta?.universe || [];

                if (spotCtxs && spotUniverse) {
                    spotUniverse.forEach((asset: any, index: number) => {
                        const ctx = spotCtxs[index];
                        if (!ctx) return;

                        const name = asset.name; // e.g. "PURR" or "HYPE"
                        const normalized = normalizeSymbol(name);
                        const price = parseFloat(ctx.markPx);
                        const dayNfv = parseFloat(ctx.dayNfv);
                        const prevDayPx = parseFloat(ctx.prevDayPx);
                        // Spot usually has no Open Interest or Funding, but check ctx
                        const openInterest = 0;
                        const funding = 0;

                        const change24h = prevDayPx > 0 ? ((price / prevDayPx) - 1) * 100 : 0;

                        const ticker: TickerData = {
                            symbol: name,
                            price,
                            change24h,
                            change1h: change24h * 0.1,
                            volume24h: dayNfv,
                            fundingRate: funding,
                            openInterest
                        };

                        // Store under original Hyperliquid name
                        statsRef.current[name] = ticker;
                        pricesRef.current[name] = price;

                        // Also store under a normalized key (e.g. strip quotes/suffixes)
                        if (normalized && normalized !== name) {
                            statsRef.current[normalized] = {
                                ...ticker,
                                symbol: normalized
                            };
                            pricesRef.current[normalized] = price;
                        }
                        dirtyRef.current = true;
                    });
                }
            }
        };

        // Subscribe
        subscribers.add(handleMessage);

        // Stable UI flush loop. Avoid 60fps state churn that can crash desktop renderer.
        let timer: ReturnType<typeof setTimeout> | null = null;
        const scheduleFlush = () => {
            const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
            const flushMs = hidden ? 1200 : 350;
            timer = setTimeout(() => {
                if (dirtyRef.current) {
                    dirtyRef.current = false;
                    setPrices({ ...pricesRef.current });
                    setStats({ ...statsRef.current });
                }
                scheduleFlush();
            }, flushMs);
        };
        scheduleFlush();

        return () => {
            subscribers.delete(handleMessage);
            if (timer) clearTimeout(timer);
        };
    }, []);

    // Filter output if symbols provided
    const filteredPrices = useMemo(() => {
        if (!symbols) return prices;
        const result: Record<string, number> = {};
        symbols.forEach(s => {
            const n = normalizeSymbol(s || "");
            const direct = prices[s];
            const normalized = n ? prices[n] : undefined;
            const value = direct ?? normalized;
            if (typeof value === "number") result[s] = value;
        });
        return result;
    }, [prices, symbols]); // Note: 'symbols' array ref equality matters here

    const filteredStats = useMemo(() => {
        if (!symbols) return stats;
        const result: Record<string, TickerData> = {};
        symbols.forEach(s => {
            const n = normalizeSymbol(s || "");
            const direct = stats[s];
            const normalized = n ? stats[n] : undefined;
            const value = direct ?? normalized;
            if (value) result[s] = value;
        });
        return result;
    }, [stats, symbols]);

    return {
        prices: filteredPrices,
        stats: filteredStats,
        allPrices: prices,
        allStats: stats,
        isConnected: !!universalManager
    };
}
