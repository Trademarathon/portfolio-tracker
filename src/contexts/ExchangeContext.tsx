"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, ReactNode } from 'react';
import { PortfolioConnection, Position } from '@/lib/api/types';
import { normalizeSymbol } from '@/lib/utils/normalization';
import { loadPersistedConnections, persistConnections } from '@/lib/connection-persistence';

// ========== TYPES ==========
export interface ExchangeBalance {
    asset: string;
    free: number;
    locked: number;
    total: number;
    usdValue: number;
    exchange: string;
    connectionId: string;
}

export interface ExchangeOrder {
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
    triggerPrice?: number;
}

export interface ExchangePosition {
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

export interface ConnectionStatus {
    id: string;
    name: string;
    exchange: string;
    status: 'connected' | 'syncing' | 'error' | 'disconnected';
    latency: number;
    lastSync: number;
    isWebSocket: boolean;
    ordersCount: number;
    positionsCount: number;
    balancesCount: number;
}

interface ExchangeContextValue {
    // Connections
    connections: PortfolioConnection[];
    enabledConnections: PortfolioConnection[];
    connectionStatuses: Map<string, ConnectionStatus>;

    // Aggregated Data
    allBalances: ExchangeBalance[];
    allOrders: ExchangeOrder[];
    allPositions: ExchangePosition[];

    // By Connection
    getBalancesByConnection: (connectionId: string) => ExchangeBalance[];
    getOrdersByConnection: (connectionId: string) => ExchangeOrder[];
    getPositionsByConnection: (connectionId: string) => ExchangePosition[];

    // By Symbol
    getOrdersBySymbol: (symbol: string) => ExchangeOrder[];
    getPositionsBySymbol: (symbol: string) => ExchangePosition[];

    // Stats
    totalBalance: number;
    totalPnl: number;
    globalLatency: number;
    isConnected: boolean;

    // Actions
    refreshConnection: (connectionId: string) => Promise<void>;
    refreshAll: () => Promise<void>;

    // Setters for integration with usePortfolioData
    updateConnections: (connections: PortfolioConnection[]) => void;
    updateBalances: (connectionId: string, balances: ExchangeBalance[]) => void;
    updateOrders: (connectionId: string, orders: ExchangeOrder[]) => void;
    updatePositions: (connectionId: string, positions: ExchangePosition[]) => void;
    updateConnectionStatus: (status: ConnectionStatus) => void;
}

const ExchangeContext = createContext<ExchangeContextValue | null>(null);

// ========== PROVIDER ==========
export function ExchangeProvider({ children }: { children: ReactNode }) {
    const [connections, setConnections] = useState<PortfolioConnection[]>([]);
    const [connectionStatuses, setConnectionStatuses] = useState<Map<string, ConnectionStatus>>(new Map());

    // Data maps for efficient updates
    const balancesMapRef = useRef<Map<string, ExchangeBalance[]>>(new Map());
    const ordersMapRef = useRef<Map<string, ExchangeOrder[]>>(new Map());
    const positionsMapRef = useRef<Map<string, ExchangePosition[]>>(new Map());

    const [balancesVersion, setBalancesVersion] = useState(0);
    const [ordersVersion, setOrdersVersion] = useState(0);
    const [positionsVersion, setPositionsVersion] = useState(0);

    // Load connections from localStorage on mount (restore from persisted file in Tauri first)
    useEffect(() => {
        loadPersistedConnections().then(() => {
            const saved = localStorage.getItem('portfolio_connections');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    setConnections(parsed);
                } catch (e) {
                    console.error('Failed to parse connections:', e);
                }
            }
        });

        // Listen for connection changes from settings
        const handleConnectionsChanged = () => {
            const updated = localStorage.getItem('portfolio_connections');
            if (updated) {
                try {
                    setConnections(JSON.parse(updated));
                } catch (e) {
                    console.error('Failed to parse updated connections:', e);
                }
            }
        };

        window.addEventListener('connections-changed', handleConnectionsChanged);
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'portfolio_connections') {
                handleConnectionsChanged();
            }
        };
        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('connections-changed', handleConnectionsChanged);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    // Enabled connections filter
    const enabledConnections = useMemo(() => {
        return (Array.isArray(connections) ? connections : []).filter(c => c.enabled !== false);
    }, [connections]);

    // Aggregated data with memoization
    const allBalances = useMemo(() => {
        const all: ExchangeBalance[] = [];
        balancesMapRef.current.forEach(balances => all.push(...balances));
        return all;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [balancesVersion]);

    const allOrders = useMemo(() => {
        const all: ExchangeOrder[] = [];
        ordersMapRef.current.forEach(orders => all.push(...orders));
        return all;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ordersVersion]);

    const allPositions = useMemo(() => {
        const all: ExchangePosition[] = [];
        positionsMapRef.current.forEach(positions => all.push(...positions));
        return all;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [positionsVersion]);

    // Stats
    const totalBalance = useMemo(() => {
        return allBalances.reduce((sum, b) => sum + b.usdValue, 0);
    }, [allBalances]);

    const totalPnl = useMemo(() => {
        return allPositions.reduce((sum, p) => sum + p.pnl, 0);
    }, [allPositions]);

    const globalLatency = useMemo(() => {
        const statuses = Array.from(connectionStatuses.values());
        if (statuses.length === 0) return 0;
        return Math.round(statuses.reduce((sum, s) => sum + s.latency, 0) / statuses.length);
    }, [connectionStatuses]);

    const isConnected = useMemo(() => {
        return Array.from(connectionStatuses.values()).some(s => s.status === 'connected');
    }, [connectionStatuses]);

    // Getters
    const getBalancesByConnection = useCallback((connectionId: string) => {
        return balancesMapRef.current.get(connectionId) || [];
    }, []);

    const getOrdersByConnection = useCallback((connectionId: string) => {
        return ordersMapRef.current.get(connectionId) || [];
    }, []);

    const getPositionsByConnection = useCallback((connectionId: string) => {
        return positionsMapRef.current.get(connectionId) || [];
    }, []);

    const getOrdersBySymbol = useCallback((symbol: string) => {
        const normalized = normalizeSymbol(symbol);
        return allOrders.filter(o => normalizeSymbol(o.symbol) === normalized);
    }, [allOrders]);

    const getPositionsBySymbol = useCallback((symbol: string) => {
        const normalized = normalizeSymbol(symbol);
        return allPositions.filter(p => normalizeSymbol(p.symbol) === normalized);
    }, [allPositions]);

    // Update functions for integration
    const updateConnections = useCallback((newConnections: PortfolioConnection[]) => {
        setConnections(newConnections);
        persistConnections(newConnections);
    }, []);

    const updateBalances = useCallback((connectionId: string, balances: ExchangeBalance[]) => {
        balancesMapRef.current.set(connectionId, balances);
        setBalancesVersion(v => v + 1);
    }, []);

    const updateOrders = useCallback((connectionId: string, orders: ExchangeOrder[]) => {
        ordersMapRef.current.set(connectionId, orders);
        setOrdersVersion(v => v + 1);
        // Dispatch event for chart overlay updates
        window.dispatchEvent(new CustomEvent('orders-updated', { detail: { connectionId, orders } }));
    }, []);

    const updatePositions = useCallback((connectionId: string, positions: ExchangePosition[]) => {
        positionsMapRef.current.set(connectionId, positions);
        setPositionsVersion(v => v + 1);
        // Dispatch event for chart overlay updates
        window.dispatchEvent(new CustomEvent('positions-updated', { detail: { connectionId, positions } }));
    }, []);

    const updateConnectionStatus = useCallback((status: ConnectionStatus) => {
        setConnectionStatuses(prev => {
            const next = new Map(prev);
            next.set(status.id, status);
            return next;
        });
    }, []);

    const refreshConnection = useCallback(async (connectionId: string) => {
        // Dispatch event for usePortfolioData to handle
        window.dispatchEvent(new CustomEvent('refresh-connection', { detail: { connectionId } }));
    }, []);

    const refreshAll = useCallback(async () => {
        window.dispatchEvent(new Event('refresh-all-connections'));
    }, []);

    const value: ExchangeContextValue = {
        connections,
        enabledConnections,
        connectionStatuses,
        allBalances,
        allOrders,
        allPositions,
        getBalancesByConnection,
        getOrdersByConnection,
        getPositionsByConnection,
        getOrdersBySymbol,
        getPositionsBySymbol,
        totalBalance,
        totalPnl,
        globalLatency,
        isConnected,
        refreshConnection,
        refreshAll,
        updateConnections,
        updateBalances,
        updateOrders,
        updatePositions,
        updateConnectionStatus,
    };

    return (
        <ExchangeContext.Provider value={value}>
            {children}
        </ExchangeContext.Provider>
    );
}

// ========== HOOK ==========
export function useExchange() {
    const context = useContext(ExchangeContext);
    if (!context) {
        throw new Error('useExchange must be used within an ExchangeProvider');
    }
    return context;
}

// ========== OPTIONAL HOOK (for components that may be outside provider) ==========
export function useExchangeOptional() {
    return useContext(ExchangeContext);
}
