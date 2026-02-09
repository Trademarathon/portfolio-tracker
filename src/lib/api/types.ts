export interface CryptoPrice {
    id: string;
    symbol: string;
    name: string;
    current_price: number;
    price_change_percentage_24h: number;
    market_cap: number;
}

export interface Position {
    symbol: string;
    entryPrice: number;
    markPrice?: number;
    size: number;
    pnl?: number;
    fee?: number;
    feeCurrency?: string;
    side: 'long' | 'short';
    leverage?: number;
    liquidationPrice?: number;
}

export type AssetSector = 'L1' | 'DeFi' | 'AI' | 'Meme' | 'Gaming' | 'Infra' | 'Stablecoin' | 'Other';

export interface ExchangeTicker {
    symbol: string;
    lastPrice: number;
    priceChangePercent?: number;
    exchange: 'binance' | 'bybit' | 'hyperliquid' | 'coinGecko';
}

export interface Transaction {
    id: string;
    symbol: string;
    side: 'buy' | 'sell';
    price: number;
    amount: number;
    timestamp: number;
    exchange: string;
    // Journaling Fields
    notes?: string;
    tags?: string[]; // e.g., "Revenge", "Trend", "Scalp"
    screenshots?: string[]; // URLs
    pnl?: number; // Realized PnL for this trade (if closed)
    status?: 'open' | 'closed';
    // Fee Breakdown
    feeType?: 'trading' | 'network' | 'funding';
    takerOrMaker?: 'maker' | 'taker';
    fee?: number;
    feeCurrency?: string;
}

export interface Transfer {
    id: string;
    type: 'Deposit' | 'Withdraw';
    asset: string;
    amount: number;
    status: string;
    timestamp: number;
    txHash?: string;
    connectionId: string;
    feeType?: string;
    symbol?: string; // Optional alias for asset to unify access
}

export interface SourceBreakdown {
    [source: string]: number; // e.g. { "Binance": 0.5, "Wallet": 1.2 }
}

export interface PortfolioAsset {
    symbol: string;
    balance: number;
    valueUsd: number;
    allocations: number;
    sector?: AssetSector;
    price?: number;
    priceChange24h?: number;
    name?: string;
    breakdown?: SourceBreakdown;
}

export interface PortfolioConnection {
    id: string;
    type: 'binance' | 'bybit' | 'hyperliquid' | 'wallet' | 'evm' | 'solana' | 'zerion';
    name: string; // User defined, e.g. "Main Account"
    chain?: string; // For wallets (ETH, SOL, etc.)
    apiKey?: string;
    secret?: string;
    walletAddress?: string;
    enabled?: boolean; // Toggle to enable/disable real-time data fetching
    isSimulated?: boolean;
}
