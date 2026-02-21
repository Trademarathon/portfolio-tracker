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
    type?: 'Buy' | 'Sell'; // some APIs return capitalized
    asset?: string; // sometimes distinct from symbol
    price: number;
    amount: number;
    timestamp: number;
    exchange: string;
    // Journaling Fields
    notes?: string;
    tags?: string[]; // e.g., "Revenge", "Trend", "Scalp"
    screenshots?: string[]; // URLs
    pnl?: number; // Realized PnL for this trade (if closed)
    status?: 'open' | 'closed' | 'failed' | 'completed';
    // Fee Breakdown
    feeType?: 'trading' | 'network' | 'funding';
    takerOrMaker?: 'maker' | 'taker';
    fee?: number;
    feeCurrency?: string;
    feeAsset?: string;
    feeUsd?: number;
    quoteAsset?: string;
    sourceType?: 'cex' | 'dex' | 'wallet' | 'manual';
    estimatedBasis?: boolean;
    connectionId?: string;
    chain?: string;
}

export interface Transfer {
    id: string;
    type: 'Deposit' | 'Withdraw';
    asset: string;
    amount: number;
    status: string;
    timestamp: number;
    txHash?: string;
    datetime?: string;
    exchange?: string;
    address?: string;
    from?: string;
    to?: string;
    network?: string;
    chain?: string;
    fee?: number;
    tag?: string;
    info?: Record<string, unknown>;
    connectionId: string;
    feeType?: string;
    symbol?: string; // Optional alias for asset to unify access
    isInternalTransfer?: boolean;
    fromConnectionId?: string;
    toConnectionId?: string;
    feeAsset?: string;
    feeUsd?: number;
    sourceType?: 'cex' | 'dex' | 'wallet' | 'manual';
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
    type?: 'Token' | 'DeFi' | 'NFT';
    icon?: string;
}

// All supported chain types
export type SupportedChain = 
    // EVM Chains
    | 'ETH' | 'ARB' | 'MATIC' | 'OP' | 'BASE' | 'BSC' | 'AVAX' | 'FTM' | 'CELO' | 'CRONOS' | 'GNOSIS' | 'LINEA' | 'SCROLL' | 'ZKSYNC' | 'MANTLE' | 'BLAST'
    // Non-EVM Chains
    | 'SOL' | 'BTC' | 'XRP' | 'HBAR' | 'SUI' | 'APT' | 'TON' | 'TRX' | 'NEAR' | 'COSMOS' | 'DOT' | 'ADA' | 'ALGO' | 'XLM' | 'DOGE' | 'LTC' | 'BCH' | 'XTZ' | 'EOS' | 'FIL' | 'VET' | 'EGLD' | 'KAVA' | 'INJ';

export interface PortfolioConnection {
    id: string;
    type: 'binance' | 'bybit' | 'hyperliquid' | 'okx' | 'wallet' | 'evm' | 'solana' | 'zerion' | 'aptos' | 'ton' | 'manual';
    name: string; // User defined, e.g. "Main Account"
    displayName?: string; // Custom rename - shown instead of name
    chain?: SupportedChain; // For wallets - all supported chains
    apiKey?: string;
    secret?: string;
    walletAddress?: string;
    enabled?: boolean; // Toggle to enable/disable real-time data fetching
    isSimulated?: boolean;
    hardwareType?: 'ledger' | 'trezor' | 'gridplus' | 'tangem' | 'onekey';
    lastFetchMs?: number; // Last fetch latency in ms
    lastFetchTime?: number; // Last fetch timestamp
    locked?: boolean; // Prevent deletion when locked
    exchange?: string; // Exchange name for orders
    /** When true, allows placing orders with this connection. Default false for security. */
    allowTrading?: boolean;
}

export interface SocialPost {
    id: string;
    author: string;
    text: string;
    url: string;
    timestamp: number;
    symbols: string[];
    score: number;
}
