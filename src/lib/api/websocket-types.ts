// Enhanced WebSocket Types and Interfaces

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting';

export interface WebSocketConnectionInfo {
    id: string;
    connectionId: string; // Original connection ID from Settings
    name: string;
    type: 'binance' | 'bybit' | 'hyperliquid' | 'okx' | 'wallet' | 'evm' | 'solana' | 'zerion' | 'aptos' | 'ton' | 'manual';
    status: WebSocketStatus;
    lastUpdate: Date;
    latency?: number;
    error?: string;
    reconnectAttempts: number;
}

export interface WebSocketMessage {
    source: string; // Connection name
    connectionId: string;
    type: 'balance' | 'position' | 'trade' | 'blockchain' | 'status' | 'allMids' | 'marketStats' | 'l2Book';
    data: unknown;
    timestamp: number;
}

export interface MarketStatData {
    symbol: string;
    price: number;
    change24h: number; // %
    volume24h: number; // USD
    fundingRate: number; // Hourly
    openInterest: number; // USD
    lastUpdated: number;
}

export interface ReconnectionConfig {
    maxAttempts: number;
    baseDelay: number; // Base delay in ms
    maxDelay: number; // Max delay in ms
    backoffMultiplier: number;
}

export const DEFAULT_RECONNECT_CONFIG: ReconnectionConfig = {
    maxAttempts: 15,
    baseDelay: 1000, // 1 second
    maxDelay: 60000, // 1 minute
    backoffMultiplier: 2
};

/** Safe JSON parse for WebSocket messages - returns null on failure */
export function safeParseJson<T = unknown>(data: string): T | null {
    try {
        return JSON.parse(data) as T;
    } catch {
        return null;
    }
}
