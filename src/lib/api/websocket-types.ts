// Enhanced WebSocket Types and Interfaces

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting';

export interface WebSocketConnectionInfo {
    id: string;
    connectionId: string; // Original connection ID from Settings
    name: string;
    type: 'binance' | 'bybit' | 'hyperliquid' | 'wallet' | 'evm' | 'solana';
    status: WebSocketStatus;
    lastUpdate: Date;
    latency?: number;
    error?: string;
    reconnectAttempts: number;
}

export interface WebSocketMessage {
    source: string; // Connection name
    connectionId: string;
    type: 'balance' | 'position' | 'trade' | 'blockchain' | 'status' | 'allMids' | 'marketStats';
    data: any;
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
    maxAttempts: 10,
    baseDelay: 1000, // 1 second
    maxDelay: 60000, // 1 minute
    backoffMultiplier: 2
};
