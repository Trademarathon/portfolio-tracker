"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { PortfolioConnection } from '@/lib/api/types';
import { apiUrl } from '@/lib/api/client';
import { normalizeSymbol } from '@/lib/utils/normalization';
import { ENDPOINTS } from '@/lib/api/websocket-endpoints';

// ========== ULTRA-LOW LATENCY CONFIGURATION ==========
const CONFIG = {
    // Polling intervals (ms) - hyper-aggressive for trading terminal
    POSITION_POLL_MS: 150,      // ~7x per second for positions
    ORDER_POLL_MS: 200,        // 5x per second for orders  
    TICKER_POLL_MS: 50,        // 20x per second for price

    // WebSocket settings
    WS_HEARTBEAT_MS: 15000,     // Keep-alive ping
    WS_RECONNECT_MS: 300,       // Ultra-fast reconnect
    WS_MAX_RECONNECTS: 10,

    // Request optimization
    REQUEST_TIMEOUT_MS: 3000,   // Aggressive timeout
    BATCH_DELAY_MS: 10,         // Micro-batch delay

    // Connection pooling
    MAX_CONCURRENT_REQUESTS: 6,

    // Latency tracking
    LATENCY_WINDOW_SIZE: 20,    // Rolling average window
};

// ========== TYPES ==========
export interface UltraFastOrder {
    id: string;
    symbol: string;
    side: 'buy' | 'sell';
    type: string;
    price: number;
    size: number;
    filled: number;
    status: string;
    timestamp: number;
    exchange: string;
    connectionId: string;
}

export interface UltraFastPosition {
    id: string;
    symbol: string;
    side: 'long' | 'short';
    size: number;
    entryPrice: number;
    markPrice: number;
    pnl: number;
    pnlPercent: number;
    leverage: number;
    liquidationPrice: number;
    exchange: string;
    connectionId: string;
}

export interface ExchangeLatency {
    exchange: string;
    latency: number;
    lastUpdate: number;
    status: 'connected' | 'degraded' | 'disconnected';
    wsConnected: boolean;
    requestsPerSec: number;
}

interface UseUltraFastSyncOptions {
    connections: PortfolioConnection[];
    enabled?: boolean;
    symbols?: string[];
}

// ========== LATENCY TRACKER ==========
class LatencyTracker {
    private samples: number[] = [];
    private maxSamples = CONFIG.LATENCY_WINDOW_SIZE;

    add(latency: number) {
        this.samples.push(latency);
        if (this.samples.length > this.maxSamples) {
            this.samples.shift();
        }
    }

    get average(): number {
        if (this.samples.length === 0) return 0;
        return Math.round(this.samples.reduce((a, b) => a + b, 0) / this.samples.length);
    }

    get min(): number {
        return this.samples.length > 0 ? Math.min(...this.samples) : 0;
    }

    get max(): number {
        return this.samples.length > 0 ? Math.max(...this.samples) : 0;
    }

    get p99(): number {
        if (this.samples.length === 0) return 0;
        const sorted = [...this.samples].sort((a, b) => a - b);
        const idx = Math.floor(sorted.length * 0.99);
        return sorted[idx] || sorted[sorted.length - 1];
    }
}

// ========== REQUEST QUEUE FOR THROTTLING ==========
class RequestQueue {
    private queue: (() => Promise<void>)[] = [];
    private running = 0;
    private maxConcurrent = CONFIG.MAX_CONCURRENT_REQUESTS;

    async add(fn: () => Promise<void>) {
        if (this.running < this.maxConcurrent) {
            this.running++;
            try {
                await fn();
            } finally {
                this.running--;
                this.processNext();
            }
        } else {
            this.queue.push(fn);
        }
    }

    private processNext() {
        if (this.queue.length > 0 && this.running < this.maxConcurrent) {
            const next = this.queue.shift();
            if (next) {
                this.running++;
                next().finally(() => {
                    this.running--;
                    this.processNext();
                });
            }
        }
    }
}

// ========== FAST FETCH WITH TIMEOUT ==========
async function fastFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            // Keep-alive for connection reuse
            keepalive: true,
        });
        return response;
    } finally {
        clearTimeout(timeout);
    }
}

// ========== MAIN HOOK ==========
export function useUltraFastSync(options: UseUltraFastSyncOptions) {
    const { connections, enabled = true, symbols = ['BTC'] } = options;

    // State
    const [orders, setOrders] = useState<UltraFastOrder[]>([]);
    const [positions, setPositions] = useState<UltraFastPosition[]>([]);
    const [latencies, setLatencies] = useState<Map<string, ExchangeLatency>>(new Map());
    const [globalLatency, setGlobalLatency] = useState(0);
    const [isConnected, setIsConnected] = useState(false);
    const [tickerPrice, setTickerPrice] = useState<Record<string, number>>({});

    // Refs
    const wsConnections = useRef<Map<string, WebSocket>>(new Map());
    const tickerWsRef = useRef<WebSocket | null>(null);
    const enabledRef = useRef(false);
    const latencyTrackers = useRef<Map<string, LatencyTracker>>(new Map());
    const requestQueue = useRef(new RequestQueue());
    const intervalsRef = useRef<NodeJS.Timeout[]>([]);
    const ordersCache = useRef<Map<string, UltraFastOrder[]>>(new Map());
    const positionsCache = useRef<Map<string, UltraFastPosition[]>>(new Map());
    const requestCounters = useRef<Map<string, number>>(new Map());
    const lastRequestTime = useRef<Map<string, number>>(new Map());

    // Get active connections (all CEX + Hyperliquid)
    const activeConnections = useMemo(() =>
        connections.filter(c => c.enabled !== false && ['hyperliquid', 'binance', 'bybit', 'okx'].includes(c.type)),
        [connections]
    );

    // Initialize latency tracker for exchange
    const getLatencyTracker = useCallback((exchange: string) => {
        if (!latencyTrackers.current.has(exchange)) {
            latencyTrackers.current.set(exchange, new LatencyTracker());
        }
        return latencyTrackers.current.get(exchange)!;
    }, []);

    // Update latency state
    const updateLatency = useCallback((exchange: string, latency: number, wsConnected = false) => {
        const tracker = getLatencyTracker(exchange);
        tracker.add(latency);

        // Track requests per second
        const now = Date.now();
        const counter = (requestCounters.current.get(exchange) || 0) + 1;
        const lastTime = lastRequestTime.current.get(exchange) || now;
        const elapsed = (now - lastTime) / 1000;
        const rps = elapsed > 0 ? counter / elapsed : 0;

        if (elapsed > 1) {
            requestCounters.current.set(exchange, 0);
            lastRequestTime.current.set(exchange, now);
        } else {
            requestCounters.current.set(exchange, counter);
        }

        setLatencies(prev => {
            const newMap = new Map(prev);
            newMap.set(exchange, {
                exchange,
                latency: tracker.average,
                lastUpdate: now,
                status: latency < 100 ? 'connected' : latency < 500 ? 'degraded' : 'disconnected',
                wsConnected,
                requestsPerSec: Math.round(rps * 10) / 10,
            });
            return newMap;
        });

        // Update global latency
        const allLatencies = Array.from(latencyTrackers.current.values()).map(t => t.average).filter(l => l > 0);
        if (allLatencies.length > 0) {
            setGlobalLatency(Math.round(allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length));
        }
    }, [getLatencyTracker]);

    // ========== HYPERLIQUID ULTRA-FAST FETCHERS ==========
    const fetchHyperliquidOrders = useCallback(async (conn: PortfolioConnection) => {
        if (!conn.walletAddress) return;

        const start = performance.now();
        try {
            const res = await fastFetch(ENDPOINTS.hyperliquid.api, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'openOrders', user: conn.walletAddress }),
            });

            if (!res.ok) return;
            const data = await res.json();
            const latency = Math.round(performance.now() - start);
            updateLatency('hyperliquid', latency, wsConnections.current.has(conn.id));

            const normalized: UltraFastOrder[] = data.map((o: any) => ({
                id: o.oid?.toString() || `hl-${Date.now()}`,
                symbol: normalizeSymbol(o.coin),
                side: o.side === 'B' ? 'buy' : 'sell',
                type: o.orderType || 'limit',
                price: parseFloat(o.limitPx || o.triggerPx || '0'),
                size: parseFloat(o.sz || '0'),
                filled: parseFloat(o.origSz || '0') - parseFloat(o.sz || '0'),
                status: 'open',
                timestamp: o.timestamp || Date.now(),
                exchange: 'hyperliquid',
                connectionId: conn.id,
            }));

            ordersCache.current.set(conn.id, normalized);
            aggregateData();
        } catch (_e) {
            // Silent fail for speed
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [updateLatency]);

    const fetchHyperliquidPositions = useCallback(async (conn: PortfolioConnection) => {
        if (!conn.walletAddress) return;

        const start = performance.now();
        try {
            const res = await fastFetch(ENDPOINTS.hyperliquid.api, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'clearinghouseState', user: conn.walletAddress }),
            });

            if (!res.ok) return;
            const data = await res.json();
            const latency = Math.round(performance.now() - start);
            updateLatency('hyperliquid', latency, wsConnections.current.has(conn.id));

            const normalized: UltraFastPosition[] = (data.assetPositions || [])
                .filter((ap: any) => parseFloat(ap.position?.szi || '0') !== 0)
                .map((ap: any) => {
                    const size = parseFloat(ap.position.szi);
                    const entry = parseFloat(ap.position.entryPx);
                    const value = parseFloat(ap.position.positionValue);
                    const mark = Math.abs(size) > 0 ? value / Math.abs(size) : 0;
                    const pnl = parseFloat(ap.position.unrealizedPnl);

                    return {
                        id: `${conn.id}-${ap.position.coin}`,
                        symbol: normalizeSymbol(ap.position.coin),
                        side: size > 0 ? 'long' : 'short',
                        size: Math.abs(size),
                        entryPrice: entry,
                        markPrice: mark,
                        pnl,
                        pnlPercent: entry > 0 ? ((mark - entry) / entry) * 100 * (size > 0 ? 1 : -1) : 0,
                        leverage: ap.position.leverage?.value || 1,
                        liquidationPrice: parseFloat(ap.position.liquidationPx || '0'),
                        exchange: 'hyperliquid',
                        connectionId: conn.id,
                    } as UltraFastPosition;
                });

            positionsCache.current.set(conn.id, normalized);
            aggregateData();
        } catch (_e) {
            // Silent fail
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [updateLatency]);

    // ========== WEBSOCKET SETUP FOR REAL-TIME UPDATES ==========
    const setupHyperliquidWS = useCallback((conn: PortfolioConnection) => {
        if (!conn.walletAddress) return;

        const existing = wsConnections.current.get(conn.id);
        if (existing?.readyState === WebSocket.OPEN) return;

        try {
            const ws = new WebSocket(ENDPOINTS.hyperliquid.ws);

            ws.onopen = () => {
                console.log(`[UltraFast] WS connected: ${conn.name}`);
                ws.send(JSON.stringify({
                    method: 'subscribe',
                    subscription: { type: 'userEvents', user: conn.walletAddress },
                }));
                updateLatency('hyperliquid', 10, true); // WS = low latency
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.channel === 'userEvents') {
                        // Instant refresh on any user event
                        requestQueue.current.add(() => fetchHyperliquidOrders(conn));
                        requestQueue.current.add(() => fetchHyperliquidPositions(conn));
                    }
                } catch { }
            };

            ws.onerror = () => {
                updateLatency('hyperliquid', 999, false);
            };

            ws.onclose = () => {
                wsConnections.current.delete(conn.id);
                // Fast reconnect
                setTimeout(() => {
                    if (enabled) setupHyperliquidWS(conn);
                }, CONFIG.WS_RECONNECT_MS);
            };

            wsConnections.current.set(conn.id, ws);
        } catch { }
    }, [enabled, fetchHyperliquidOrders, fetchHyperliquidPositions, updateLatency]);

    // ========== BINANCE ULTRA-FAST ==========
    const fetchBinanceData = useCallback(async (conn: PortfolioConnection) => {
        if (!conn.apiKey) return;

        const start = performance.now();
        try {
            const res = await fastFetch(apiUrl('/api/cex/open-orders'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    exchangeId: 'binance',
                    apiKey: conn.apiKey,
                    secret: conn.secret,
                }),
            });

            if (!res.ok) return;
            const data = await res.json();
            const latency = Math.round(performance.now() - start);
            updateLatency('binance', latency);

            const normalized: UltraFastOrder[] = (data.orders || []).map((o: any) => ({
                id: o.id?.toString() || `bin-${Date.now()}`,
                symbol: normalizeSymbol(o.symbol),
                side: o.side?.toLowerCase() || 'buy',
                type: o.type?.toLowerCase() || 'limit',
                price: parseFloat(o.price || '0'),
                size: parseFloat(o.amount || '0'),
                filled: parseFloat(o.filled || '0'),
                status: o.status || 'open',
                timestamp: o.timestamp || Date.now(),
                exchange: 'binance',
                connectionId: conn.id,
            }));

            ordersCache.current.set(conn.id, normalized);
            aggregateData();
        } catch { }
    }, [updateLatency]);

    // ========== BYBIT ULTRA-FAST ==========
    const fetchBybitData = useCallback(async (conn: PortfolioConnection) => {
        if (!conn.apiKey) return;

        const start = performance.now();
        try {
            const res = await fastFetch(apiUrl('/api/cex/open-orders'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    exchangeId: 'bybit',
                    apiKey: conn.apiKey,
                    secret: conn.secret,
                }),
            });

            if (!res.ok) return;
            const data = await res.json();
            const latency = Math.round(performance.now() - start);
            updateLatency('bybit', latency);

            const normalized: UltraFastOrder[] = (data.orders || []).map((o: any) => ({
                id: o.id?.toString() || `byb-${Date.now()}`,
                symbol: normalizeSymbol(o.symbol),
                side: o.side?.toLowerCase() || 'buy',
                type: o.type?.toLowerCase() || 'limit',
                price: parseFloat(o.price || '0'),
                size: parseFloat(o.amount || '0'),
                filled: parseFloat(o.filled || '0'),
                status: o.status || 'open',
                timestamp: o.timestamp || Date.now(),
                exchange: 'bybit',
                connectionId: conn.id,
            }));

            ordersCache.current.set(conn.id, normalized);
            aggregateData();
        } catch { }
    }, [updateLatency]);

    // ========== OKX ULTRA-FAST ==========
    const fetchOKXData = useCallback(async (conn: PortfolioConnection) => {
        if (!conn.apiKey) return;

        const start = performance.now();
        try {
            const res = await fastFetch(apiUrl('/api/cex/open-orders'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    exchangeId: 'okx',
                    apiKey: conn.apiKey,
                    secret: conn.secret,
                }),
            });

            if (!res.ok) return;
            const data = await res.json();
            const latency = Math.round(performance.now() - start);
            updateLatency('okx', latency);

            const normalized: UltraFastOrder[] = (data.orders || []).map((o: any) => ({
                id: o.id?.toString() || `okx-${Date.now()}`,
                symbol: normalizeSymbol(o.symbol),
                side: o.side?.toLowerCase() || 'buy',
                type: o.type?.toLowerCase() || 'limit',
                price: parseFloat(o.price || '0'),
                size: parseFloat(o.amount || '0'),
                filled: parseFloat(o.filled || '0'),
                status: o.status || 'open',
                timestamp: o.timestamp || Date.now(),
                exchange: 'okx',
                connectionId: conn.id,
            }));

            ordersCache.current.set(conn.id, normalized);
            aggregateData();
        } catch { }
    }, [updateLatency]);

    // ========== TICKER PRICE STREAM ==========
    const setupTickerStream = useCallback(() => {
        const symbol = symbols[0] || 'BTC';
        const binanceSymbol = `${symbol.toLowerCase()}usdt`;
        if (tickerWsRef.current?.readyState === WebSocket.OPEN) return tickerWsRef.current;
        try {
            const ws = new WebSocket(`${ENDPOINTS.binance.ws}/${binanceSymbol}@aggTrade`);
            tickerWsRef.current = ws;
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.p) {
                        setTickerPrice(prev => ({ ...prev, [symbol]: parseFloat(data.p) }));
                    }
                } catch { }
            };
            ws.onerror = () => {
                if (process.env.NODE_ENV !== 'production') console.warn('[UltraFast] Ticker WS error');
            };
            ws.onclose = () => {
                tickerWsRef.current = null;
                if (!enabledRef.current) return;
                setTimeout(() => {
                    if (!enabledRef.current) return;
                    setupTickerStream();
                }, CONFIG.WS_RECONNECT_MS);
            };
            return ws;
        } catch {
            tickerWsRef.current = null;
            return null;
        }
    }, [symbols]);

    // ========== AGGREGATE DATA ==========
    const aggregateData = useCallback(() => {
        // Aggregate orders
        const allOrders: UltraFastOrder[] = [];
        ordersCache.current.forEach(orders => allOrders.push(...orders));
        allOrders.sort((a, b) => b.timestamp - a.timestamp);
        setOrders(allOrders);

        // Aggregate positions
        const allPositions: UltraFastPosition[] = [];
        positionsCache.current.forEach(positions => allPositions.push(...positions));
        allPositions.sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
        setPositions(allPositions);

        // Dispatch events for global state
        window.dispatchEvent(new CustomEvent('ultra-orders-updated', { detail: allOrders }));
        window.dispatchEvent(new CustomEvent('ultra-positions-updated', { detail: allPositions }));
    }, []);

    // ========== MAIN EFFECT ==========
    useEffect(() => {
        if (!enabled || activeConnections.length === 0) {
            enabledRef.current = false;
            setIsConnected(false);
            return;
        }
        enabledRef.current = true;
        console.log(`[UltraFast] Starting with ${activeConnections.length} connections`);

        // Clear existing
        intervalsRef.current.forEach(clearInterval);
        intervalsRef.current = [];

        // Setup each connection
        activeConnections.forEach((conn, idx) => {
            if (conn.type === 'hyperliquid') {
                // WebSocket for real-time
                setupHyperliquidWS(conn);

                // Ultra-fast polling backup
                const posInterval = setInterval(
                    () => requestQueue.current.add(() => fetchHyperliquidPositions(conn)),
                    CONFIG.POSITION_POLL_MS
                );
                const ordInterval = setInterval(
                    () => requestQueue.current.add(() => fetchHyperliquidOrders(conn)),
                    CONFIG.ORDER_POLL_MS
                );

                intervalsRef.current.push(posInterval, ordInterval);

                // Initial fetch
                setTimeout(() => {
                    fetchHyperliquidPositions(conn);
                    fetchHyperliquidOrders(conn);
                }, idx * 50);

            } else if (conn.type === 'binance') {
                const interval = setInterval(
                    () => requestQueue.current.add(() => fetchBinanceData(conn)),
                    CONFIG.ORDER_POLL_MS * 2
                );
                intervalsRef.current.push(interval);
                setTimeout(() => fetchBinanceData(conn), idx * 100);

            } else if (conn.type === 'bybit') {
                const interval = setInterval(
                    () => requestQueue.current.add(() => fetchBybitData(conn)),
                    CONFIG.ORDER_POLL_MS * 2
                );
                intervalsRef.current.push(interval);
                setTimeout(() => fetchBybitData(conn), idx * 100);

            } else if (conn.type === 'okx') {
                const interval = setInterval(
                    () => requestQueue.current.add(() => fetchOKXData(conn)),
                    CONFIG.ORDER_POLL_MS * 2
                );
                intervalsRef.current.push(interval);
                setTimeout(() => fetchOKXData(conn), idx * 100);
            }
        });

        // Setup ticker stream (stored in tickerWsRef for cleanup and reconnect)
        setupTickerStream();

        setIsConnected(true);

        return () => {
            console.log('[UltraFast] Cleanup');
            enabledRef.current = false;
            intervalsRef.current.forEach(clearInterval);
            wsConnections.current.forEach(ws => ws.close());
            wsConnections.current.clear();
            if (tickerWsRef.current) {
                tickerWsRef.current.close();
                tickerWsRef.current = null;
            }
        };
    }, [enabled, activeConnections, setupHyperliquidWS, fetchHyperliquidPositions, fetchHyperliquidOrders, fetchBinanceData, fetchBybitData, fetchOKXData, setupTickerStream]);

    // ========== PUBLIC API ==========
    const getOrdersBySymbol = useCallback((symbol: string) => {
        const normalized = normalizeSymbol(symbol);
        return orders.filter(o => o.symbol === normalized || o.symbol.includes(normalized));
    }, [orders]);

    const getPositionsBySymbol = useCallback((symbol: string) => {
        const normalized = normalizeSymbol(symbol);
        return positions.filter(p => p.symbol === normalized || p.symbol.includes(normalized));
    }, [positions]);

    const forceRefresh = useCallback(() => {
        activeConnections.forEach(conn => {
            if (conn.type === 'hyperliquid') {
                fetchHyperliquidPositions(conn);
                fetchHyperliquidOrders(conn);
            } else if (conn.type === 'binance') {
                fetchBinanceData(conn);
            } else if (conn.type === 'bybit') {
                fetchBybitData(conn);
            } else if (conn.type === 'okx') {
                fetchOKXData(conn);
            }
        });
    }, [activeConnections, fetchHyperliquidPositions, fetchHyperliquidOrders, fetchBinanceData, fetchBybitData, fetchOKXData]);

    const latencyStats = useMemo(() => {
        const stats: Record<string, { avg: number; min: number; max: number; p99: number }> = {};
        latencyTrackers.current.forEach((tracker, exchange) => {
            stats[exchange] = {
                avg: tracker.average,
                min: tracker.min,
                max: tracker.max,
                p99: tracker.p99,
            };
        });
        return stats;
    }, [latencies]);

    const syncStatuses = useMemo(() => Array.from(latencies.values()).map(l => ({
        connectionId: l.exchange,
        connectionName: l.exchange,
        exchange: l.exchange,
        lastSync: l.lastUpdate,
        latency: l.latency,
        status: l.status as 'connected' | 'syncing' | 'error' | 'disconnected',
        ordersCount: orders.filter(o => o.exchange === l.exchange).length,
        positionsCount: positions.filter(p => p.exchange === l.exchange).length,
        isWebSocket: l.wsConnected,
    })), [latencies, orders, positions]);

    const stats = useMemo(() => ({
        totalOrders: orders.length,
        totalPositions: positions.length,
        totalPnl: positions.reduce((sum, p) => sum + p.pnl, 0),
        avgLatency: globalLatency,
        connectedExchanges: Array.from(latencies.values()).filter(l => l.status === 'connected').length,
        totalExchanges: latencies.size,
    }), [orders, positions, globalLatency, latencies]);

    return {
        orders,
        positions,
        getOrdersBySymbol,
        getPositionsBySymbol,
        isConnected,
        globalLatency,
        latencies: Array.from(latencies.values()),
        latencyStats,
        syncStatuses,
        stats,
        tickerPrice,
        forceRefresh,
    };
}
