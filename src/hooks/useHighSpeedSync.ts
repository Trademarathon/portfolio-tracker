"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { apiUrl } from '@/lib/api/client';
import { PortfolioConnection, Position as _Position } from '@/lib/api/types';
import { normalizeSymbol } from '@/lib/utils/normalization';
import { WS_ENDPOINTS } from '@/lib/api/websocket-endpoints';

// ========== TYPES ==========
export interface SyncedOrder {
    id: string;
    symbol: string;
    side: 'buy' | 'sell';
    type: string;
    price: number;
    amount: number;
    filled: number;
    remaining: number;
    status: string;
    timestamp: number;
    exchange: string;
    connectionId: string;
    connectionName: string;
    reduceOnly?: boolean;
    postOnly?: boolean;
    triggerPrice?: number;
}

export interface SyncedPosition {
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
    margin: number;
    exchange: string;
    connectionId: string;
    connectionName: string;
    timestamp: number;
}

export interface SyncStatus {
    connectionId: string;
    connectionName: string;
    exchange: string;
    lastSync: number;
    latency: number;
    status: 'connected' | 'syncing' | 'error' | 'disconnected';
    ordersCount: number;
    positionsCount: number;
    isWebSocket: boolean;
}

interface UseHighSpeedSyncOptions {
    connections: PortfolioConnection[];
    enabled?: boolean;
    // Ultra-fast polling intervals (ms)
    positionInterval?: number;
    orderInterval?: number;
}

// ========== CONSTANTS ==========
const HYPERLIQUID_API = WS_ENDPOINTS.hyperliquid.api;
const HYPERLIQUID_WS = WS_ENDPOINTS.hyperliquid.ws;

const DEFAULT_POSITION_INTERVAL = 1000; // 1s - positions are critical
const DEFAULT_ORDER_INTERVAL = 1500;    // 1.5s - orders update frequently

// ========== MAIN HOOK ==========
export function useHighSpeedSync(options: UseHighSpeedSyncOptions) {
    const {
        connections,
        enabled = true,
        positionInterval = DEFAULT_POSITION_INTERVAL,
        orderInterval = DEFAULT_ORDER_INTERVAL,
    } = options;

    const [orders, setOrders] = useState<SyncedOrder[]>([]);
    const [positions, setPositions] = useState<SyncedPosition[]>([]);
    const [syncStatus, setSyncStatus] = useState<Map<string, SyncStatus>>(new Map());
    const [isConnected, setIsConnected] = useState(false);
    const [globalLatency, setGlobalLatency] = useState(0);

    // Refs for WebSocket connections and intervals
    const wsConnectionsRef = useRef<Map<string, WebSocket>>(new Map());
    const wsReconnectTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
    const intervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
    const ordersMapRef = useRef<Map<string, SyncedOrder[]>>(new Map());
    const positionsMapRef = useRef<Map<string, SyncedPosition[]>>(new Map());
    const lastSyncRef = useRef<Map<string, number>>(new Map());
    const syncStatusRef = useRef<Map<string, SyncStatus>>(new Map());

    // Get enabled exchange connections
    const exchangeConnections = useMemo(() => {
        return connections.filter(c =>
            c.enabled !== false &&
            ['hyperliquid', 'binance', 'bybit', 'okx'].includes(c.type)
        );
    }, [connections]);

    // Update sync status helper
    const updateSyncStatus = useCallback((
        connectionId: string,
        updates: Partial<SyncStatus>
    ) => {
        setSyncStatus(prev => {
            const newMap = new Map(prev);
            const existing = newMap.get(connectionId) || {
                connectionId,
                connectionName: '',
                exchange: '',
                lastSync: 0,
                latency: 0,
                status: 'disconnected' as const,
                ordersCount: 0,
                positionsCount: 0,
                isWebSocket: false,
            };
            const updated = { ...existing, ...updates };
            newMap.set(connectionId, updated);

            // Also update ref for real-time access
            syncStatusRef.current.set(connectionId, updated);

            // Update global latency immediately when latency changes
            if (updates.latency !== undefined) {
                const statuses = Array.from(syncStatusRef.current.values());
                if (statuses.length > 0) {
                    const connectedStatuses = statuses.filter(s => s.status === 'connected' && s.latency > 0);
                    if (connectedStatuses.length > 0) {
                        const avgLatency = connectedStatuses.reduce((sum, s) => sum + s.latency, 0) / connectedStatuses.length;
                        setGlobalLatency(Math.round(avgLatency));
                    }
                }
            }

            return newMap;
        });
    }, []);

    // Aggregate orders from all connections
    const aggregateOrders = useCallback(() => {
        const allOrders: SyncedOrder[] = [];
        ordersMapRef.current.forEach((orderList, connectionId) => {
            allOrders.push(...orderList);
            // Dispatch event for global context
            window.dispatchEvent(new CustomEvent('orders-updated', {
                detail: { connectionId, orders: orderList }
            }));
        });
        // Sort by timestamp descending
        allOrders.sort((a, b) => b.timestamp - a.timestamp);
        setOrders(allOrders);
        // Dispatch global orders updated event
        window.dispatchEvent(new CustomEvent('all-orders-updated', { detail: { orders: allOrders } }));
    }, []);

    // Aggregate positions from all connections
    const aggregatePositions = useCallback(() => {
        const allPositions: SyncedPosition[] = [];
        positionsMapRef.current.forEach((posList, connectionId) => {
            allPositions.push(...posList);
            // Dispatch event for global context
            window.dispatchEvent(new CustomEvent('positions-updated', {
                detail: { connectionId, positions: posList }
            }));
        });
        // Sort by absolute PnL descending
        allPositions.sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
        setPositions(allPositions);
        // Dispatch global positions updated event
        window.dispatchEvent(new CustomEvent('all-positions-updated', { detail: { positions: allPositions } }));
    }, []);

    // ========== HYPERLIQUID FETCHERS ==========
    const fetchHyperliquidOrders = useCallback(async (conn: PortfolioConnection) => {
        if (!conn.walletAddress) return;

        const startTime = performance.now();

        try {
            const res = await fetch(HYPERLIQUID_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'openOrders', user: conn.walletAddress }),
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const rawOrders = await res.json();
            const latency = Math.round(performance.now() - startTime);

            const normalizedOrders: SyncedOrder[] = rawOrders.map((o: any) => ({
                id: o.oid?.toString() || `${conn.id}-${Date.now()}`,
                symbol: normalizeSymbol(o.coin),
                side: o.side === 'B' ? 'buy' : 'sell',
                type: o.orderType || 'limit',
                price: parseFloat(o.limitPx || o.triggerPx || '0'),
                amount: parseFloat(o.sz || o.origSz || '0'),
                filled: parseFloat(o.origSz || '0') - parseFloat(o.sz || '0'),
                remaining: parseFloat(o.sz || '0'),
                status: 'open',
                timestamp: o.timestamp || Date.now(),
                exchange: 'Hyperliquid',
                connectionId: conn.id,
                connectionName: conn.name,
                reduceOnly: o.reduceOnly || false,
                triggerPrice: o.triggerPx ? parseFloat(o.triggerPx) : undefined,
            }));

            ordersMapRef.current.set(conn.id, normalizedOrders);
            lastSyncRef.current.set(`${conn.id}-orders`, Date.now());

            updateSyncStatus(conn.id, {
                lastSync: Date.now(),
                latency,
                status: 'connected',
                ordersCount: normalizedOrders.length,
                connectionName: conn.name,
                exchange: 'Hyperliquid',
            });

            aggregateOrders();

        } catch (error) {
            console.warn(`[HighSpeed] Order fetch failed for ${conn.name}:`, error);
            updateSyncStatus(conn.id, { status: 'error' });
        }
    }, [updateSyncStatus, aggregateOrders]);

    const fetchHyperliquidPositions = useCallback(async (conn: PortfolioConnection) => {
        if (!conn.walletAddress) return;

        const startTime = performance.now();

        try {
            const res = await fetch(HYPERLIQUID_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'clearinghouseState', user: conn.walletAddress }),
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();
            const latency = Math.round(performance.now() - startTime);

            const normalizedPositions: SyncedPosition[] = (data.assetPositions || [])
                .filter((ap: any) => parseFloat(ap.position?.szi || '0') !== 0)
                .map((ap: any) => {
                    const size = parseFloat(ap.position.szi);
                    const entryPrice = parseFloat(ap.position.entryPx);
                    const posValue = parseFloat(ap.position.positionValue);
                    const markPrice = Math.abs(size) > 0 ? posValue / Math.abs(size) : 0;
                    const pnl = parseFloat(ap.position.unrealizedPnl);
                    const margin = parseFloat(ap.position.marginUsed || '0');

                    return {
                        id: `${conn.id}-${ap.position.coin}`,
                        symbol: normalizeSymbol(ap.position.coin),
                        side: size > 0 ? 'long' : 'short',
                        size: Math.abs(size),
                        entryPrice,
                        markPrice,
                        pnl,
                        pnlPercent: entryPrice > 0 ? ((markPrice - entryPrice) / entryPrice) * 100 * (size > 0 ? 1 : -1) : 0,
                        leverage: ap.position.leverage?.value || 1,
                        liquidationPrice: parseFloat(ap.position.liquidationPx || '0'),
                        margin,
                        exchange: 'Hyperliquid',
                        connectionId: conn.id,
                        connectionName: conn.name,
                        timestamp: Date.now(),
                    } as SyncedPosition;
                });

            positionsMapRef.current.set(conn.id, normalizedPositions);
            lastSyncRef.current.set(`${conn.id}-positions`, Date.now());

            updateSyncStatus(conn.id, {
                lastSync: Date.now(),
                latency,
                status: 'connected',
                positionsCount: normalizedPositions.length,
                connectionName: conn.name,
                exchange: 'Hyperliquid',
            });

            aggregatePositions();

        } catch (error) {
            console.warn(`[HighSpeed] Position fetch failed for ${conn.name}:`, error);
            updateSyncStatus(conn.id, { status: 'error' });
        }
    }, [updateSyncStatus, aggregatePositions]);

    // ========== CEX FETCHERS (Binance/Bybit) ==========
    const fetchCexOrders = useCallback(async (conn: PortfolioConnection) => {
        if (!conn.apiKey || !conn.secret) return;

        const startTime = performance.now();

        try {
            const res = await fetch(apiUrl('/api/cex/open-orders'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    exchangeId: conn.type,
                    apiKey: conn.apiKey,
                    secret: conn.secret
                }),
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();
            const latency = Math.round(performance.now() - startTime);
            const rawOrders = data.orders || [];

            const normalizedOrders: SyncedOrder[] = rawOrders.map((o: any) => ({
                id: o.id?.toString() || `${conn.id}-${Date.now()}`,
                symbol: normalizeSymbol(o.symbol),
                side: o.side?.toLowerCase() || 'buy',
                type: o.type?.toLowerCase() || 'limit',
                price: parseFloat(o.price || '0'),
                amount: parseFloat(o.amount || o.origQty || '0'),
                filled: parseFloat(o.filled || o.executedQty || '0'),
                remaining: parseFloat(o.remaining || '0'),
                status: o.status?.toLowerCase() || 'open',
                timestamp: o.timestamp || Date.now(),
                exchange: conn.type.charAt(0).toUpperCase() + conn.type.slice(1),
                connectionId: conn.id,
                connectionName: conn.name,
            }));

            ordersMapRef.current.set(conn.id, normalizedOrders);

            updateSyncStatus(conn.id, {
                lastSync: Date.now(),
                latency,
                status: 'connected',
                ordersCount: normalizedOrders.length,
                connectionName: conn.name,
                exchange: conn.type,
            });

            aggregateOrders();

        } catch (error) {
            console.warn(`[HighSpeed] CEX order fetch failed for ${conn.name}:`, error);
            updateSyncStatus(conn.id, { status: 'error' });
        }
    }, [updateSyncStatus, aggregateOrders]);

    const fetchCexPositions = useCallback(async (conn: PortfolioConnection) => {
        if (!conn.apiKey || !conn.secret) return;

        const startTime = performance.now();

        try {
            // For CEX futures positions
            const res = await fetch(apiUrl('/api/cex/positions'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    exchangeId: conn.type,
                    apiKey: conn.apiKey,
                    secret: conn.secret
                }),
            });

            if (!res.ok) {
                // Some CEXs might not support positions endpoint, just skip
                return;
            }

            const data = await res.json();
            const latency = Math.round(performance.now() - startTime);
            const rawPositions = data.positions || [];

            const normalizedPositions: SyncedPosition[] = rawPositions
                .filter((p: any) => parseFloat(p.positionAmt || p.size || '0') !== 0)
                .map((p: any) => {
                    const size = parseFloat(p.positionAmt || p.size || '0');
                    return {
                        id: `${conn.id}-${p.symbol}`,
                        symbol: normalizeSymbol(p.symbol),
                        side: size > 0 ? 'long' : 'short',
                        size: Math.abs(size),
                        entryPrice: parseFloat(p.entryPrice || '0'),
                        markPrice: parseFloat(p.markPrice || '0'),
                        pnl: parseFloat(p.unrealizedProfit || p.unRealizedProfit || '0'),
                        pnlPercent: parseFloat(p.unrealizedProfitPercent || '0') * 100,
                        leverage: parseInt(p.leverage || '1'),
                        liquidationPrice: parseFloat(p.liquidationPrice || '0'),
                        margin: parseFloat(p.isolatedMargin || p.margin || '0'),
                        exchange: conn.type.charAt(0).toUpperCase() + conn.type.slice(1),
                        connectionId: conn.id,
                        connectionName: conn.name,
                        timestamp: Date.now(),
                    } as SyncedPosition;
                });

            positionsMapRef.current.set(conn.id, normalizedPositions);

            updateSyncStatus(conn.id, {
                lastSync: Date.now(),
                latency,
                status: 'connected',
                positionsCount: normalizedPositions.length,
            });

            aggregatePositions();

        } catch (_error) {
            // Silently fail for CEXs without position support
        }
    }, [updateSyncStatus, aggregatePositions]);

    // ========== SETUP HYPERLIQUID WEBSOCKET ==========
    const setupHyperliquidWebSocket = useCallback((conn: PortfolioConnection) => {
        if (!conn.walletAddress) return;

        // Close existing connection
        const existingWs = wsConnectionsRef.current.get(conn.id);
        if (existingWs) {
            existingWs.close();
        }

        try {
            const ws = new WebSocket(HYPERLIQUID_WS);

            ws.onopen = () => {
                console.log(`[HighSpeed WS] Connected: ${conn.name}`);

                // Subscribe to user events
                ws.send(JSON.stringify({
                    method: 'subscribe',
                    subscription: {
                        type: 'userEvents',
                        user: conn.walletAddress,
                    },
                }));

                updateSyncStatus(conn.id, {
                    status: 'connected',
                    isWebSocket: true,
                    connectionName: conn.name,
                    exchange: 'Hyperliquid',
                });

                setIsConnected(true);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    if (data.channel === 'userEvents' && data.data) {
                        // Handle fills, order updates, etc.
                        if (data.data.fills) {
                            // Order was filled - refresh orders
                            fetchHyperliquidOrders(conn);
                        }
                        if (data.data.orders) {
                            // Order update
                            fetchHyperliquidOrders(conn);
                        }
                        if (data.data.positions) {
                            // Position update
                            fetchHyperliquidPositions(conn);
                        }
                    }
                } catch (_e) {
                    // Ignore parse errors
                }
            };

            ws.onerror = (error) => {
                console.warn(`[HighSpeed WS] Error for ${conn.name}:`, error);
                updateSyncStatus(conn.id, { status: 'error', isWebSocket: false });
            };

            ws.onclose = () => {
                console.log(`[HighSpeed WS] Closed: ${conn.name}`);
                updateSyncStatus(conn.id, { status: 'disconnected', isWebSocket: false });

                // Clear any existing reconnect timeout for this connection
                const existingTimeout = wsReconnectTimeoutsRef.current.get(conn.id);
                if (existingTimeout) clearTimeout(existingTimeout);

                // Attempt reconnect after 5s, tracking the timeout ID
                const timeoutId = setTimeout(() => {
                    wsReconnectTimeoutsRef.current.delete(conn.id);
                    if (enabled) {
                        setupHyperliquidWebSocket(conn);
                    }
                }, 5000);
                wsReconnectTimeoutsRef.current.set(conn.id, timeoutId);
            };

            wsConnectionsRef.current.set(conn.id, ws);

        } catch (error) {
            console.warn(`[HighSpeed WS] Setup failed for ${conn.name}:`, error);
        }
    }, [enabled, fetchHyperliquidOrders, fetchHyperliquidPositions, updateSyncStatus]);

    // ========== MAIN EFFECT - Start syncing ==========
    useEffect(() => {
        if (!enabled || exchangeConnections.length === 0) {
            setIsConnected(false);
            return;
        }

        console.log(`[HighSpeed] Starting sync for ${exchangeConnections.length} connections`);

        // Clear existing intervals
        intervalsRef.current.forEach(interval => clearInterval(interval));
        intervalsRef.current.clear();

        // Initialize each connection
        exchangeConnections.forEach((conn, idx) => {
            // Initialize sync status
            updateSyncStatus(conn.id, {
                connectionId: conn.id,
                connectionName: conn.name,
                exchange: conn.type,
                status: 'syncing',
                lastSync: 0,
                latency: 0,
                ordersCount: 0,
                positionsCount: 0,
                isWebSocket: false,
            });

            if (conn.type === 'hyperliquid') {
                // Setup WebSocket for real-time updates
                setupHyperliquidWebSocket(conn);

                // Also setup polling as backup (WebSocket might miss some events)
                const posIntervalId = setInterval(() => fetchHyperliquidPositions(conn), positionInterval);
                const ordIntervalId = setInterval(() => fetchHyperliquidOrders(conn), orderInterval);

                intervalsRef.current.set(`${conn.id}-pos`, posIntervalId);
                intervalsRef.current.set(`${conn.id}-ord`, ordIntervalId);

                // Initial fetch (staggered)
                setTimeout(() => fetchHyperliquidPositions(conn), idx * 100);
                setTimeout(() => fetchHyperliquidOrders(conn), idx * 100 + 50);

            } else if (['binance', 'bybit'].includes(conn.type)) {
                // CEX polling
                const posIntervalId = setInterval(() => fetchCexPositions(conn), positionInterval * 2);
                const ordIntervalId = setInterval(() => fetchCexOrders(conn), orderInterval * 2);

                intervalsRef.current.set(`${conn.id}-pos`, posIntervalId);
                intervalsRef.current.set(`${conn.id}-ord`, ordIntervalId);

                // Initial fetch (staggered)
                setTimeout(() => fetchCexPositions(conn), idx * 200);
                setTimeout(() => fetchCexOrders(conn), idx * 200 + 100);
            }
        });

        setIsConnected(true);

        // Calculate global latency every second using ref for fresh values
        const latencyInterval = setInterval(() => {
            const statuses = Array.from(syncStatusRef.current.values());
            if (statuses.length > 0) {
                const connectedStatuses = statuses.filter(s => s.status === 'connected' && s.latency > 0);
                if (connectedStatuses.length > 0) {
                    const avgLatency = connectedStatuses.reduce((sum, s) => sum + s.latency, 0) / connectedStatuses.length;
                    setGlobalLatency(Math.round(avgLatency));
                }
            }
        }, 1000);

        return () => {
            console.log('[HighSpeed] Stopping sync');

            // Clear intervals
            intervalsRef.current.forEach(interval => clearInterval(interval));
            intervalsRef.current.clear();
            clearInterval(latencyInterval);

            // Cancel pending reconnect timeouts to prevent orphan WebSockets
            wsReconnectTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
            wsReconnectTimeoutsRef.current.clear();

            // Close WebSockets
            wsConnectionsRef.current.forEach(ws => ws.close());
            wsConnectionsRef.current.clear();

            setIsConnected(false);
        };
    }, [
        enabled,
        exchangeConnections,
        positionInterval,
        orderInterval,
        fetchHyperliquidOrders,
        fetchHyperliquidPositions,
        fetchCexOrders,
        fetchCexPositions,
        setupHyperliquidWebSocket,
        updateSyncStatus,
    ]);

    // ========== PUBLIC API ==========

    // Get orders for a specific symbol
    const getOrdersBySymbol = useCallback((symbol: string) => {
        const normalized = normalizeSymbol(symbol);
        return orders.filter(o => o.symbol === normalized || o.symbol.includes(normalized));
    }, [orders]);

    // Get positions for a specific symbol
    const getPositionsBySymbol = useCallback((symbol: string) => {
        const normalized = normalizeSymbol(symbol);
        return positions.filter(p => p.symbol === normalized || p.symbol.includes(normalized));
    }, [positions]);

    // Get all sync statuses as array
    const syncStatuses = useMemo(() => Array.from(syncStatus.values()), [syncStatus]);

    // Total stats
    const stats = useMemo(() => ({
        totalOrders: orders.length,
        totalPositions: positions.length,
        totalPnl: positions.reduce((sum, p) => sum + p.pnl, 0),
        avgLatency: globalLatency,
        connectedExchanges: syncStatuses.filter(s => s.status === 'connected').length,
        totalExchanges: syncStatuses.length,
    }), [orders, positions, globalLatency, syncStatuses]);

    // Force refresh all
    const forceRefresh = useCallback(() => {
        exchangeConnections.forEach(conn => {
            if (conn.type === 'hyperliquid') {
                fetchHyperliquidPositions(conn);
                fetchHyperliquidOrders(conn);
            } else if (['binance', 'bybit'].includes(conn.type)) {
                fetchCexPositions(conn);
                fetchCexOrders(conn);
            }
        });
    }, [exchangeConnections, fetchHyperliquidPositions, fetchHyperliquidOrders, fetchCexPositions, fetchCexOrders]);

    return {
        // Data
        orders,
        positions,

        // Filtered getters
        getOrdersBySymbol,
        getPositionsBySymbol,

        // Status
        isConnected,
        syncStatuses,
        globalLatency,
        stats,

        // Actions
        forceRefresh,
    };
}
