"use client";

import { useEffect, useRef, useCallback } from 'react';
import { PortfolioConnection } from '@/lib/api/types';

// Rate limit tracking per exchange
interface RateLimitState {
    used: number;
    max: number;
    resetAt: number;
}

interface RateLimits {
    binance: RateLimitState;
    bybit: RateLimitState;
    hyperliquid: RateLimitState;
}

// Polling intervals in milliseconds - AGGRESSIVE MODE
export const POLL_INTERVALS = {
    POSITIONS: 2000,    // 2s - Most critical for traders
    BALANCES: 3000,     // 3s - Important for portfolio value
    ORDERS: 5000,       // 5s - Medium priority
    TRADES: 15000,      // 15s - Lower priority (WebSocket preferred)
    WALLET: 30000,      // 30s - On-chain is slower anyway
    HISTORY: 60000,     // 1min - Historical data less urgent
};

// API weights for rate limit tracking
const API_WEIGHTS: Record<string, { balance: number; positions: number; openOrders: number; fills: number }> = {
    binance: {
        balance: 10,
        positions: 5,
        openOrders: 3,
        fills: 10,
    },
    bybit: {
        balance: 1,
        positions: 1,
        openOrders: 1,
        fills: 5,
    },
    hyperliquid: {
        balance: 1,
        positions: 1,
        openOrders: 1,
        fills: 20,
    },
};

// Initial rate limits
const INITIAL_RATE_LIMITS: RateLimits = {
    binance: { used: 0, max: 6000, resetAt: 0 },
    bybit: { used: 0, max: 1200, resetAt: 0 },
    hyperliquid: { used: 0, max: 1200, resetAt: 0 },
};

interface UseRealTimeDataOptions {
    connections: PortfolioConnection[];
    onBalanceUpdate: (connectionId: string, balances: any[]) => void;
    onPositionUpdate: (connectionId: string, positions: any[]) => void;
    onOrderUpdate: (connectionId: string, orders: any[]) => void;
    onTradeUpdate: (connectionId: string, trades: any[]) => void;
    enabled?: boolean;
}

export function useRealTimeData(options: UseRealTimeDataOptions) {
    const {
        connections,
        onBalanceUpdate,
        onPositionUpdate,
        onOrderUpdate,
        onTradeUpdate,
        enabled = true,
    } = options;

    const rateLimitsRef = useRef<RateLimits>({ ...INITIAL_RATE_LIMITS });
    const intervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

    // USE REFS for callbacks to avoid dependency issues
    const onBalanceUpdateRef = useRef(onBalanceUpdate);
    const onPositionUpdateRef = useRef(onPositionUpdate);
    const onOrderUpdateRef = useRef(onOrderUpdate);
    const onTradeUpdateRef = useRef(onTradeUpdate);

    // Keep refs updated
    useEffect(() => {
        onBalanceUpdateRef.current = onBalanceUpdate;
        onPositionUpdateRef.current = onPositionUpdate;
        onOrderUpdateRef.current = onOrderUpdate;
        onTradeUpdateRef.current = onTradeUpdate;
    }, [onBalanceUpdate, onPositionUpdate, onOrderUpdate, onTradeUpdate]);

    // Reset rate limits every minute
    useEffect(() => {
        const resetInterval = setInterval(() => {
            const now = Date.now();
            Object.keys(rateLimitsRef.current).forEach((exchange) => {
                const key = exchange as keyof RateLimits;
                if (now >= rateLimitsRef.current[key].resetAt) {
                    rateLimitsRef.current[key].used = 0;
                    rateLimitsRef.current[key].resetAt = now + 60000;
                }
            });
        }, 5000);

        return () => clearInterval(resetInterval);
    }, []);

    // Check if we can make a request (rate limit check)
    const canMakeRequest = (exchange: keyof RateLimits, weight: number): boolean => {
        const limit = rateLimitsRef.current[exchange];
        const remaining = limit.max - limit.used;
        if (remaining >= weight) {
            rateLimitsRef.current[exchange].used += weight;
            return true;
        }
        console.warn(`[RealTime] Rate limit approaching for ${exchange}: ${limit.used}/${limit.max}`);
        return false;
    };

    // Start polling for all connections
    useEffect(() => {
        if (!enabled || connections.length === 0) {
            console.log('[RealTime] Polling disabled or no connections');
            return;
        }

        console.log('[RealTime] 🚀 Starting aggressive polling for', connections.length, 'connections');

        // Clear existing intervals
        intervalsRef.current.forEach((interval) => clearInterval(interval));
        intervalsRef.current.clear();

        // Fetch functions (inline to avoid dependency issues)
        const fetchBalances = async (conn: PortfolioConnection) => {
            if (!conn.enabled) return;
            const exchange = conn.type as keyof RateLimits;
            if (!API_WEIGHTS[exchange]) return;

            const weight = API_WEIGHTS[exchange].balance;
            if (!canMakeRequest(exchange, weight)) return;

            try {
                let balances: any[] = [];

                if (conn.type === 'binance' && conn.apiKey && conn.secret) {
                    const res = await fetch('/api/cex/balance', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ exchangeId: 'binance', apiKey: conn.apiKey, secret: conn.secret }),
                    });
                    if (res.ok) balances = await res.json();
                } else if (conn.type === 'bybit' && conn.apiKey && conn.secret) {
                    const res = await fetch('/api/cex/balance', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ exchangeId: 'bybit', apiKey: conn.apiKey, secret: conn.secret }),
                    });
                    if (res.ok) balances = await res.json();
                } else if (conn.type === 'hyperliquid' && conn.walletAddress) {
                    const res = await fetch('https://api.hyperliquid.xyz/info', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'spotClearinghouseState', user: conn.walletAddress }),
                    });
                    if (res.ok) {
                        const data = await res.json();
                        balances = (data.balances || []).map((b: any) => ({
                            symbol: b.coin,
                            balance: parseFloat(b.total),
                        }));
                    }
                }

                if (balances.length > 0) {
                    onBalanceUpdateRef.current(conn.id, balances);
                    console.log(`[RealTime] 💰 Balance: ${conn.name} - ${balances.length} assets`);
                }
            } catch (e) {
                console.warn(`[RealTime] Balance failed for ${conn.name}:`, e);
            }
        };

        const fetchPositions = async (conn: PortfolioConnection) => {
            if (!conn.enabled) return;
            const exchange = conn.type as keyof RateLimits;
            if (!API_WEIGHTS[exchange]) return;

            const weight = API_WEIGHTS[exchange].positions;
            if (!canMakeRequest(exchange, weight)) return;

            try {
                let positions: any[] = [];

                if (conn.type === 'hyperliquid' && conn.walletAddress) {
                    const res = await fetch('https://api.hyperliquid.xyz/info', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'clearinghouseState', user: conn.walletAddress }),
                    });
                    if (res.ok) {
                        const data = await res.json();
                        positions = (data.assetPositions || [])
                            .filter((ap: any) => parseFloat(ap.position?.szi || '0') !== 0)
                            .map((ap: any) => ({
                                symbol: ap.position.coin,
                                size: parseFloat(ap.position.szi),
                                entryPrice: parseFloat(ap.position.entryPx),
                                markPrice: parseFloat(ap.position.positionValue) / Math.abs(parseFloat(ap.position.szi)) || 0,
                                pnl: parseFloat(ap.position.unrealizedPnl),
                                side: parseFloat(ap.position.szi) > 0 ? 'long' : 'short',
                                leverage: ap.position.leverage?.value || 1,
                                liquidationPrice: parseFloat(ap.position.liquidationPx) || 0,
                            }));
                    }
                }

                if (positions.length > 0) {
                    onPositionUpdateRef.current(conn.id, positions);
                    console.log(`[RealTime] 📊 Positions: ${conn.name} - ${positions.length} positions`);
                }
            } catch (e) {
                console.warn(`[RealTime] Position failed for ${conn.name}:`, e);
            }
        };

        const fetchOrders = async (conn: PortfolioConnection) => {
            if (!conn.enabled) return;
            const exchange = conn.type as keyof RateLimits;
            if (!API_WEIGHTS[exchange]) return;

            const weight = API_WEIGHTS[exchange].openOrders;
            if (!canMakeRequest(exchange, weight)) return;

            try {
                let orders: any[] = [];

                if ((conn.type === 'binance' || conn.type === 'bybit') && conn.apiKey && conn.secret) {
                    const res = await fetch('/api/cex/open-orders', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ exchangeId: conn.type, apiKey: conn.apiKey, secret: conn.secret }),
                    });
                    if (res.ok) {
                        const data = await res.json();
                        orders = data.orders || [];
                    }
                } else if (conn.type === 'hyperliquid' && conn.walletAddress) {
                    const res = await fetch('https://api.hyperliquid.xyz/info', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'openOrders', user: conn.walletAddress }),
                    });
                    if (res.ok) orders = await res.json();
                }

                onOrderUpdateRef.current(conn.id, orders);
                console.log(`[RealTime] 📋 Orders: ${conn.name} - ${orders.length} orders`);
            } catch (e) {
                console.warn(`[RealTime] Order failed for ${conn.name}:`, e);
            }
        };

        const fetchTrades = async (conn: PortfolioConnection) => {
            if (!conn.enabled) return;
            const exchange = conn.type as keyof RateLimits;
            if (!API_WEIGHTS[exchange]) return;

            const weight = API_WEIGHTS[exchange].fills;
            if (!canMakeRequest(exchange, weight)) return;

            try {
                let trades: any[] = [];

                if ((conn.type === 'binance' || conn.type === 'bybit') && conn.apiKey && conn.secret) {
                    const res = await fetch('/api/cex/trades', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ exchange: conn.type, apiKey: conn.apiKey, secret: conn.secret }),
                    });
                    if (res.ok) {
                        const data = await res.json();
                        trades = data.trades || [];
                    }
                } else if (conn.type === 'hyperliquid' && conn.walletAddress) {
                    const res = await fetch('https://api.hyperliquid.xyz/info', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'userFills', user: conn.walletAddress }),
                    });
                    if (res.ok) {
                        const fills = await res.json();
                        trades = fills.slice(0, 100);
                    }
                }

                if (trades.length > 0) {
                    onTradeUpdateRef.current(conn.id, trades);
                    console.log(`[RealTime] 🔄 Trades: ${conn.name} - ${trades.length} trades`);
                }
            } catch (e) {
                console.warn(`[RealTime] Trades failed for ${conn.name}:`, e);
            }
        };

        // Setup polling for each connection
        connections.forEach((conn) => {
            if (!conn.enabled) return;

            const isExchange = ['binance', 'bybit', 'hyperliquid'].includes(conn.type);
            if (!isExchange) return;

            console.log(`[RealTime] Setting up polling for ${conn.name} (${conn.type})`);

            // Positions - every 2s
            const posInterval = setInterval(() => fetchPositions(conn), POLL_INTERVALS.POSITIONS);
            intervalsRef.current.set(`${conn.id}-positions`, posInterval);

            // Balances - every 3s
            const balInterval = setInterval(() => fetchBalances(conn), POLL_INTERVALS.BALANCES);
            intervalsRef.current.set(`${conn.id}-balances`, balInterval);

            // Orders - every 5s
            const orderInterval = setInterval(() => fetchOrders(conn), POLL_INTERVALS.ORDERS);
            intervalsRef.current.set(`${conn.id}-orders`, orderInterval);

            // Trades - every 15s
            const tradeInterval = setInterval(() => fetchTrades(conn), POLL_INTERVALS.TRADES);
            intervalsRef.current.set(`${conn.id}-trades`, tradeInterval);

            // Initial fetch (staggered to avoid rate limit spike)
            setTimeout(() => fetchPositions(conn), 100);
            setTimeout(() => fetchBalances(conn), 500);
            setTimeout(() => fetchOrders(conn), 1000);
            setTimeout(() => fetchTrades(conn), 2000);
        });

        return () => {
            console.log('[RealTime] Stopping polling');
            intervalsRef.current.forEach((interval) => clearInterval(interval));
            intervalsRef.current.clear();
        };
    }, [enabled, connections]); // Removed callback dependencies - using refs instead

    // Get current rate limit status
    const getRateLimitStatus = useCallback(() => {
        return { ...rateLimitsRef.current };
    }, []);

    return {
        getRateLimitStatus,
        POLL_INTERVALS,
    };
}

// Utility hook for interval-based polling
export function useInterval(callback: () => void, delay: number | null) {
    const savedCallback = useRef(callback);

    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);

    useEffect(() => {
        if (delay === null) return;

        const id = setInterval(() => savedCallback.current(), delay);
        return () => clearInterval(id);
    }, [delay]);
}
