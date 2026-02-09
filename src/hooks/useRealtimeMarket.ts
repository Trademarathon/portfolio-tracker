"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { EnhancedWebSocketManager } from '@/lib/api/websocket-enhanced';
import { WebSocketMessage } from '@/lib/api/websocket-types';

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

export function useRealtimeMarket(symbols?: string[]) {
    // State for UI
    const [prices, setPrices] = useState<Record<string, number>>({});
    const [stats, setStats] = useState<Record<string, TickerData>>({});

    // Refs for buffering high-frequency updates
    const pricesRef = useRef<Record<string, number>>({});
    const statsRef = useRef<Record<string, TickerData>>({});
    const prevPricesRef = useRef<Record<string, number>>({}); // For calculating micro-changes if needed

    useEffect(() => {
        initManager();

        const handleMessage = (msg: WebSocketMessage) => {
            if (msg.type === 'allMids') {
                // msg.data is { "BTC": "65000", ... }
                const updates: Record<string, number> = {};
                for (const [coin, price] of Object.entries(msg.data)) {
                    updates[coin] = parseFloat(price as string);
                }

                // Merge into ref
                pricesRef.current = { ...pricesRef.current, ...updates };
                // console.log(`[Realtime] keys: ${Object.keys(updates).length}`);
            }
            else if (msg.type === 'marketStats') {
                // Process webData2
                // Structure: [metadata, assetCtxs]
                // We need to parse this efficiently
                const { spotState, perpState, spotMeta, meta } = msg.data;
                const assetCtxs = msg.data.assetCtxs;
                const universe = meta?.universe || [];

                // 1. Process PERPS
                if (assetCtxs && universe) {
                    universe.forEach((asset: any, index: number) => {
                        const ctx = assetCtxs[index];
                        if (!ctx) return;

                        const name = asset.name;
                        const price = parseFloat(ctx.markPx);
                        const dayNfv = parseFloat(ctx.dayNfv);
                        const prevDayPx = parseFloat(ctx.prevDayPx);
                        const openInterest = parseFloat(ctx.openInterest) * price;
                        const funding = parseFloat(ctx.funding);

                        const change24h = prevDayPx > 0 ? ((price / prevDayPx) - 1) * 100 : 0;

                        statsRef.current[name] = {
                            symbol: name,
                            price,
                            change24h,
                            change1h: change24h * 0.1,
                            volume24h: dayNfv,
                            fundingRate: funding,
                            openInterest
                        };
                        pricesRef.current[name] = price;
                    });
                }

                // 2. Process SPOT
                // webData2 structure for spot: spotAssetCtxs matches spotMeta.universe
                const spotCtxs = msg.data.spotAssetCtxs;
                const spotUniverse = spotMeta?.universe || [];

                if (spotCtxs && spotUniverse) {
                    spotUniverse.forEach((asset: any, index: number) => {
                        const ctx = spotCtxs[index];
                        if (!ctx) return;

                        const name = asset.name; // e.g. "PURR" or "HYPE"
                        const price = parseFloat(ctx.markPx);
                        const dayNfv = parseFloat(ctx.dayNfv);
                        const prevDayPx = parseFloat(ctx.prevDayPx);
                        // Spot usually has no Open Interest or Funding, but check ctx
                        const openInterest = 0;
                        const funding = 0;

                        const change24h = prevDayPx > 0 ? ((price / prevDayPx) - 1) * 100 : 0;

                        statsRef.current[name] = {
                            symbol: name,
                            price,
                            change24h,
                            change1h: change24h * 0.1,
                            volume24h: dayNfv,
                            fundingRate: funding,
                            openInterest
                        };
                        pricesRef.current[name] = price;
                    });
                }
            }
        };

        // Subscribe
        subscribers.add(handleMessage);

        // UI Update Loop (Throttle to 100ms ~ 10fps for smoothness without killing React)
        const interval = setInterval(() => {
            // Check if we have updates
            // Optimize: Only update if visible/requested symbols change

            // For now, simple batch update
            setPrices(prev => ({ ...prev, ...pricesRef.current }));
            setStats(prev => ({ ...prev, ...statsRef.current }));

            // Note: We don't clear refs because they represent "Latest State", not "Events"
        }, 100);

        return () => {
            subscribers.delete(handleMessage);
            clearInterval(interval);
        };
    }, []);

    // Filter output if symbols provided
    const filteredPrices = useMemo(() => {
        if (!symbols) return prices;
        const result: Record<string, number> = {};
        symbols.forEach(s => {
            if (prices[s]) result[s] = prices[s];
        });
        return result;
    }, [prices, symbols]); // Note: 'symbols' array ref equality matters here

    const filteredStats = useMemo(() => {
        if (!symbols) return stats;
        const result: Record<string, TickerData> = {};
        symbols.forEach(s => {
            if (stats[s]) result[s] = stats[s];
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
