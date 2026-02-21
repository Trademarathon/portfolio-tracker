/**
 * Futures Data Aggregator
 * Fetches and aggregates order book, funding rates, and market data from multiple exchanges
 * Supports: Binance, Bybit, Hyperliquid, OKX, Gate.io, Bitget, dYdX
 * 
 * Ultra-Fast Optimized
 */

import { ultraFetch, getLatencyTracker } from '@/lib/ultraFast';
import { WS_ENDPOINTS } from '@/lib/api/websocket-endpoints';
import {
    getHyperliquidL2Book,
    getHyperliquidPerpsMetaAndCtxs,
    getHyperliquidNotionalVolumeUsd
} from '@/lib/api/hyperliquid';

// ========== TYPES ==========

export interface OrderBookLevel {
    price: number;
    size: number;
    sizeUsd: number;
    orders?: number;
}

export interface AggregatedOrderBook {
    symbol: string;
    exchange: string;
    timestamp: number;
    bids: OrderBookLevel[];
    asks: OrderBookLevel[];
    spread: number;
    spreadPercent: number;
    midPrice: number;
}

/** Normalized orderbook update (snapshot or delta) for consistent parsing across exchanges */
export interface BookChange {
    exchange: string;
    symbol: string;
    bids: [number, number][]; // [price, size]
    asks: [number, number][];
    time: number;
    isSnapshot: boolean;
}

export interface FundingRate {
    symbol: string;
    exchange: string;
    rate: number;
    ratePercent: number;
    nextFundingTime: number;
    predictedRate?: number;
}

export interface FuturesMarketData {
    symbol: string;
    exchange: string;
    price: number;
    markPrice: number;
    indexPrice: number;
    volume24h: number;
    volumeUsd24h: number;
    openInterest: number;
    openInterestUsd: number;
    high24h: number;
    low24h: number;
    change24h: number;
    change24hPercent: number;
}

export interface ExchangeConfig {
    id: string;
    name: string;
    enabled: boolean;
    futuresEndpoint: string;
    wsEndpoint?: string;
    rateLimit: number; // requests per second
}

// ========== EXCHANGE CONFIGURATIONS ==========

export const FUTURES_EXCHANGES: ExchangeConfig[] = [
    { id: 'binance', name: 'Binance Futures', enabled: true, futuresEndpoint: WS_ENDPOINTS.binance.futures, wsEndpoint: WS_ENDPOINTS.binance.ws, rateLimit: 10 },
    { id: 'bybit', name: 'Bybit', enabled: true, futuresEndpoint: WS_ENDPOINTS.bybit.api, wsEndpoint: WS_ENDPOINTS.bybit.wsLinear, rateLimit: 10 },
    { id: 'hyperliquid', name: 'Hyperliquid', enabled: true, futuresEndpoint: WS_ENDPOINTS.hyperliquid.api, wsEndpoint: WS_ENDPOINTS.hyperliquid.ws, rateLimit: 20 },
    { id: 'okx', name: 'OKX', enabled: true, futuresEndpoint: WS_ENDPOINTS.okx.api, wsEndpoint: WS_ENDPOINTS.okx.ws, rateLimit: 10 },
    { id: 'gate', name: 'Gate.io', enabled: true, futuresEndpoint: 'https://api.gateio.ws/api/v4', wsEndpoint: WS_ENDPOINTS.gate.ws, rateLimit: 10 },
    { id: 'bitget', name: 'Bitget', enabled: true, futuresEndpoint: 'https://api.bitget.com', wsEndpoint: WS_ENDPOINTS.bitget.ws, rateLimit: 10 },
    { id: 'dydx', name: 'dYdX', enabled: true, futuresEndpoint: 'https://indexer.dydx.trade/v4', wsEndpoint: WS_ENDPOINTS.dydx.ws, rateLimit: 10 }
];

// Normalize symbol to exchange format (e.g. "BTC" or "BTCUSDT" -> "BTCUSDT")
function toFuturesSymbol(symbol: string): string {
    const base = (symbol || '').replace(/USDT|USDC|\/|-/gi, '').trim().toUpperCase() || 'BTC';
    return base + 'USDT';
}

// ========== BINANCE FUTURES ==========

async function fetchBinanceOrderBook(symbol: string, limit: number = 100): Promise<AggregatedOrderBook | null> {
    const tracker = getLatencyTracker('binance-ob');
    const start = performance.now();
    try {
        const binanceSymbol = toFuturesSymbol(symbol);
        const response = await ultraFetch(
            `https://fapi.binance.com/fapi/v1/depth?symbol=${binanceSymbol}&limit=${limit}`
        );
        tracker.add(Math.round(performance.now() - start));
        if (!response.ok) return null;
        const data = await response.json();
        
        const midPrice = (parseFloat(data.bids[0]?.[0] || '0') + parseFloat(data.asks[0]?.[0] || '0')) / 2;
        
        const bids: OrderBookLevel[] = data.bids.map((b: string[]) => ({
            price: parseFloat(b[0]),
            size: parseFloat(b[1]),
            sizeUsd: parseFloat(b[0]) * parseFloat(b[1])
        }));
        
        const asks: OrderBookLevel[] = data.asks.map((a: string[]) => ({
            price: parseFloat(a[0]),
            size: parseFloat(a[1]),
            sizeUsd: parseFloat(a[0]) * parseFloat(a[1])
        }));
        
        const spread = asks[0]?.price - bids[0]?.price || 0;
        const spreadPercent = midPrice > 0 ? (spread / midPrice) * 100 : 0;
        
        return {
            symbol,
            exchange: 'binance',
            timestamp: Date.now(),
            bids,
            asks,
            spread,
            spreadPercent,
            midPrice
        };
    } catch (e) {
        console.error('Binance orderbook error:', e);
        return null;
    }
}

async function fetchBinanceFundingRate(symbol: string): Promise<FundingRate | null> {
    const tracker = getLatencyTracker('binance-funding');
    const start = performance.now();
    try {
        const binanceSymbol = toFuturesSymbol(symbol);
        const response = await ultraFetch(
            `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${binanceSymbol}`
        );
        tracker.add(Math.round(performance.now() - start));
        if (!response.ok) return null;
        const data = await response.json();
        
        return {
            symbol,
            exchange: 'binance',
            rate: parseFloat(data.lastFundingRate || '0'),
            ratePercent: parseFloat(data.lastFundingRate || '0') * 100,
            nextFundingTime: data.nextFundingTime,
            predictedRate: parseFloat(data.estimatedSettlePrice || '0')
        };
    } catch (e) {
        console.error('Binance funding rate error:', e);
        return null;
    }
}

async function fetchBinanceMarketData(symbol: string): Promise<FuturesMarketData | null> {
    try {
        const binanceSymbol = toFuturesSymbol(symbol);
        const [tickerRes, markRes] = await Promise.all([
            fetch(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${binanceSymbol}`),
            fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${binanceSymbol}`)
        ]);
        
        if (!tickerRes.ok || !markRes.ok) return null;
        
        const ticker = await tickerRes.json();
        const mark = await markRes.json();
        
        const price = parseFloat(ticker.lastPrice || '0');
        
        return {
            symbol,
            exchange: 'binance',
            price,
            markPrice: parseFloat(mark.markPrice || '0'),
            indexPrice: parseFloat(mark.indexPrice || '0'),
            volume24h: parseFloat(ticker.volume || '0'),
            volumeUsd24h: parseFloat(ticker.quoteVolume || '0'),
            openInterest: 0, // Requires separate endpoint
            openInterestUsd: 0,
            high24h: parseFloat(ticker.highPrice || '0'),
            low24h: parseFloat(ticker.lowPrice || '0'),
            change24h: parseFloat(ticker.priceChange || '0'),
            change24hPercent: parseFloat(ticker.priceChangePercent || '0')
        };
    } catch (e) {
        console.error('Binance market data error:', e);
        return null;
    }
}

// ========== BYBIT ==========

async function fetchBybitOrderBook(symbol: string, limit: number = 100): Promise<AggregatedOrderBook | null> {
    const tracker = getLatencyTracker('bybit-ob');
    const start = performance.now();
    try {
        const bybitSymbol = toFuturesSymbol(symbol);
        const response = await ultraFetch(
            `https://api.bybit.com/v5/market/orderbook?category=linear&symbol=${bybitSymbol}&limit=${limit}`
        );
        tracker.add(Math.round(performance.now() - start));
        
        if (!response.ok) return null;
        const data = await response.json();
        
        if (data.retCode !== 0) return null;
        
        const result = data.result;
        const bids: OrderBookLevel[] = result.b.map((b: string[]) => ({
            price: parseFloat(b[0]),
            size: parseFloat(b[1]),
            sizeUsd: parseFloat(b[0]) * parseFloat(b[1])
        }));
        
        const asks: OrderBookLevel[] = result.a.map((a: string[]) => ({
            price: parseFloat(a[0]),
            size: parseFloat(a[1]),
            sizeUsd: parseFloat(a[0]) * parseFloat(a[1])
        }));
        
        const midPrice = (bids[0]?.price + asks[0]?.price) / 2 || 0;
        const spread = asks[0]?.price - bids[0]?.price || 0;
        
        return {
            symbol,
            exchange: 'bybit',
            timestamp: parseInt(result.ts),
            bids,
            asks,
            spread,
            spreadPercent: midPrice > 0 ? (spread / midPrice) * 100 : 0,
            midPrice
        };
    } catch (e) {
        console.error('Bybit orderbook error:', e);
        return null;
    }
}

async function fetchBybitFundingRate(symbol: string): Promise<FundingRate | null> {
    const tracker = getLatencyTracker('bybit-funding');
    const start = performance.now();
    try {
        const bybitSymbol = toFuturesSymbol(symbol);
        const response = await ultraFetch(
            `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${bybitSymbol}`
        );
        tracker.add(Math.round(performance.now() - start));
        
        if (!response.ok) return null;
        const data = await response.json();
        
        if (data.retCode !== 0 || !data.result.list[0]) return null;
        
        const ticker = data.result.list[0];
        
        return {
            symbol,
            exchange: 'bybit',
            rate: parseFloat(ticker.fundingRate || '0'),
            ratePercent: parseFloat(ticker.fundingRate || '0') * 100,
            nextFundingTime: parseInt(ticker.nextFundingTime || '0')
        };
    } catch (e) {
        console.error('Bybit funding rate error:', e);
        return null;
    }
}

async function fetchBybitMarketData(symbol: string): Promise<FuturesMarketData | null> {
    const tracker = getLatencyTracker('bybit-market');
    const start = performance.now();
    try {
        const bybitSymbol = toFuturesSymbol(symbol);
        const response = await ultraFetch(
            `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${bybitSymbol}`
        );
        tracker.add(Math.round(performance.now() - start));
        
        if (!response.ok) return null;
        const data = await response.json();
        
        if (data.retCode !== 0 || !data.result.list[0]) return null;
        
        const ticker = data.result.list[0];
        const price = parseFloat(ticker.lastPrice || '0');
        
        return {
            symbol,
            exchange: 'bybit',
            price,
            markPrice: parseFloat(ticker.markPrice || '0'),
            indexPrice: parseFloat(ticker.indexPrice || '0'),
            volume24h: parseFloat(ticker.volume24h || '0'),
            volumeUsd24h: parseFloat(ticker.turnover24h || '0'),
            openInterest: parseFloat(ticker.openInterest || '0'),
            openInterestUsd: parseFloat(ticker.openInterestValue || '0'),
            high24h: parseFloat(ticker.highPrice24h || '0'),
            low24h: parseFloat(ticker.lowPrice24h || '0'),
            change24h: price - parseFloat(ticker.prevPrice24h || '0'),
            change24hPercent: parseFloat(ticker.price24hPcnt || '0') * 100
        };
    } catch (e) {
        console.error('Bybit market data error:', e);
        return null;
    }
}

// ========== HYPERLIQUID ==========

async function fetchHyperliquidOrderBook(symbol: string, limit: number = 100): Promise<AggregatedOrderBook | null> {
    const tracker = getLatencyTracker('hyperliquid-ob');
    const start = performance.now();
    try {
        const hlSymbol = symbol.replace('USDT', '').replace('/', '');
        const data = await getHyperliquidL2Book(hlSymbol);
        tracker.add(Math.round(performance.now() - start));

        const levels = data.levels || [[], []];

        const bids: OrderBookLevel[] = levels[0].slice(0, limit).map((b: { px: string; sz: string; n: number }) => ({
            price: parseFloat(b.px),
            size: parseFloat(b.sz),
            sizeUsd: parseFloat(b.px) * parseFloat(b.sz),
            orders: b.n
        }));

        const asks: OrderBookLevel[] = levels[1].slice(0, limit).map((a: { px: string; sz: string; n: number }) => ({
            price: parseFloat(a.px),
            size: parseFloat(a.sz),
            sizeUsd: parseFloat(a.px) * parseFloat(a.sz),
            orders: a.n
        }));

        const midPrice = (bids[0]?.price + asks[0]?.price) / 2 || 0;
        const spread = asks[0]?.price - bids[0]?.price || 0;

        return {
            symbol,
            exchange: 'hyperliquid',
            timestamp: Date.now(),
            bids,
            asks,
            spread,
            spreadPercent: midPrice > 0 ? (spread / midPrice) * 100 : 0,
            midPrice
        };
    } catch (e) {
        console.error('Hyperliquid orderbook error:', e);
        return null;
    }
}

async function fetchHyperliquidFundingRate(symbol: string): Promise<FundingRate | null> {
    const _tracker = getLatencyTracker('hyperliquid-funding');
    const _start = performance.now();
    try {
        const hlSymbol = symbol.replace('USDT', '').replace('/', '');
        const data = await getHyperliquidPerpsMetaAndCtxs();
        if (!data) return null;

        const { meta, ctxs: assetCtxs } = data;
        const index = meta.universe.findIndex((u: { name: string }) => u.name === hlSymbol);

        if (index === -1) return null;

        const ctx = assetCtxs[index];
        const fundingRate = parseFloat(ctx?.funding || '0');

        return {
            symbol,
            exchange: 'hyperliquid',
            rate: fundingRate,
            ratePercent: fundingRate * 100,
            nextFundingTime: Date.now() + 3600000 // HL funds every hour
        };
    } catch (e) {
        console.error('Hyperliquid funding rate error:', e);
        return null;
    }
}

async function fetchHyperliquidMarketData(symbol: string): Promise<FuturesMarketData | null> {
    const tracker = getLatencyTracker('hyperliquid-market');
    const start = performance.now();
    try {
        const hlSymbol = symbol.replace('USDT', '').replace('/', '');
        const data = await getHyperliquidPerpsMetaAndCtxs();
        tracker.add(Math.round(performance.now() - start));
        if (!data) return null;

        const { meta, ctxs: assetCtxs } = data;
        const index = meta.universe.findIndex((u: { name: string }) => u.name === hlSymbol);

        if (index === -1) return null;

        const ctx = assetCtxs[index];
        const markPrice = parseFloat(ctx.markPx || '0');
        const prevPrice = parseFloat(ctx.prevDayPx || '0');
        const volumeUsd24h = getHyperliquidNotionalVolumeUsd(ctx);
        const openInterest = parseFloat(ctx.openInterest || '0');

        return {
            symbol,
            exchange: 'hyperliquid',
            price: markPrice,
            markPrice,
            indexPrice: parseFloat(ctx.oraclePx || '0'),
            volume24h: markPrice > 0 ? volumeUsd24h / markPrice : 0,
            volumeUsd24h,
            openInterest,
            openInterestUsd: openInterest * markPrice,
            high24h: 0, // Not available
            low24h: 0,
            change24h: markPrice - prevPrice,
            change24hPercent: prevPrice > 0 ? ((markPrice - prevPrice) / prevPrice) * 100 : 0
        };
    } catch (e) {
        console.error('Hyperliquid market data error:', e);
        return null;
    }
}

// ========== OKX ==========

async function fetchOkxOrderBook(symbol: string, limit: number = 100): Promise<AggregatedOrderBook | null> {
    const tracker = getLatencyTracker('okx-ob');
    const start = performance.now();
    try {
        const base = (symbol || '').replace(/USDT|USDC|\/|-/gi, '').trim().toUpperCase() || 'BTC';
        const okxSymbol = `${base}-USDT-SWAP`;
        const response = await ultraFetch(
            `https://www.okx.com/api/v5/market/books?instId=${okxSymbol}&sz=${limit}`
        );
        tracker.add(Math.round(performance.now() - start));
        if (!response.ok) return null;
        const data = await response.json();
        
        if (data.code !== '0' || !data.data[0]) return null;
        
        const book = data.data[0];
        
        const bids: OrderBookLevel[] = book.bids.map((b: string[]) => ({
            price: parseFloat(b[0]),
            size: parseFloat(b[1]),
            sizeUsd: parseFloat(b[0]) * parseFloat(b[1]),
            orders: parseInt(b[3])
        }));
        
        const asks: OrderBookLevel[] = book.asks.map((a: string[]) => ({
            price: parseFloat(a[0]),
            size: parseFloat(a[1]),
            sizeUsd: parseFloat(a[0]) * parseFloat(a[1]),
            orders: parseInt(a[3])
        }));
        
        const midPrice = (bids[0]?.price + asks[0]?.price) / 2 || 0;
        const spread = asks[0]?.price - bids[0]?.price || 0;
        
        return {
            symbol,
            exchange: 'okx',
            timestamp: parseInt(book.ts),
            bids,
            asks,
            spread,
            spreadPercent: midPrice > 0 ? (spread / midPrice) * 100 : 0,
            midPrice
        };
    } catch (e) {
        console.error('OKX orderbook error:', e);
        return null;
    }
}

async function fetchOkxFundingRate(symbol: string): Promise<FundingRate | null> {
    const tracker = getLatencyTracker('okx-funding');
    const start = performance.now();
    try {
        const base = (symbol || '').replace(/USDT|USDC|\/|-/gi, '').trim().toUpperCase() || 'BTC';
        const okxSymbol = `${base}-USDT-SWAP`;
        const response = await ultraFetch(
            `https://www.okx.com/api/v5/public/funding-rate?instId=${okxSymbol}`
        );
        tracker.add(Math.round(performance.now() - start));
        if (!response.ok) return null;
        const data = await response.json();
        
        if (data.code !== '0' || !data.data[0]) return null;
        
        const fr = data.data[0];
        
        return {
            symbol,
            exchange: 'okx',
            rate: parseFloat(fr.fundingRate || '0'),
            ratePercent: parseFloat(fr.fundingRate || '0') * 100,
            nextFundingTime: parseInt(fr.nextFundingTime || '0'),
            predictedRate: parseFloat(fr.nextFundingRate || '0')
        };
    } catch (e) {
        console.error('OKX funding rate error:', e);
        return null;
    }
}

// ========== AGGREGATION FUNCTIONS ==========

/**
 * Fetch order book from all enabled exchanges
 */
export async function fetchAggregatedOrderBook(
    symbol: string,
    exchanges: string[] = ['binance', 'bybit', 'hyperliquid', 'okx'],
    limit: number = 50
): Promise<AggregatedOrderBook[]> {
    const fetchers: Promise<AggregatedOrderBook | null>[] = [];
    
    if (exchanges.includes('binance')) {
        fetchers.push(fetchBinanceOrderBook(symbol, limit));
    }
    if (exchanges.includes('bybit')) {
        fetchers.push(fetchBybitOrderBook(symbol, limit));
    }
    if (exchanges.includes('hyperliquid')) {
        fetchers.push(fetchHyperliquidOrderBook(symbol, limit));
    }
    if (exchanges.includes('okx')) {
        fetchers.push(fetchOkxOrderBook(symbol, limit));
    }
    
    const results = await Promise.all(fetchers);
    return results.filter((r): r is AggregatedOrderBook => r !== null);
}

/**
 * Fetch funding rates from all enabled exchanges
 */
export async function fetchAggregatedFundingRates(
    symbol: string,
    exchanges: string[] = ['binance', 'bybit', 'hyperliquid', 'okx']
): Promise<FundingRate[]> {
    const fetchers: Promise<FundingRate | null>[] = [];
    
    if (exchanges.includes('binance')) {
        fetchers.push(fetchBinanceFundingRate(symbol));
    }
    if (exchanges.includes('bybit')) {
        fetchers.push(fetchBybitFundingRate(symbol));
    }
    if (exchanges.includes('hyperliquid')) {
        fetchers.push(fetchHyperliquidFundingRate(symbol));
    }
    if (exchanges.includes('okx')) {
        fetchers.push(fetchOkxFundingRate(symbol));
    }
    
    const results = await Promise.all(fetchers);
    return results.filter((r): r is FundingRate => r !== null);
}

/**
 * Fetch market data from all enabled exchanges
 */
export async function fetchAggregatedMarketData(
    symbol: string,
    exchanges: string[] = ['binance', 'bybit', 'hyperliquid']
): Promise<FuturesMarketData[]> {
    const fetchers: Promise<FuturesMarketData | null>[] = [];
    
    if (exchanges.includes('binance')) {
        fetchers.push(fetchBinanceMarketData(symbol));
    }
    if (exchanges.includes('bybit')) {
        fetchers.push(fetchBybitMarketData(symbol));
    }
    if (exchanges.includes('hyperliquid')) {
        fetchers.push(fetchHyperliquidMarketData(symbol));
    }
    
    const results = await Promise.all(fetchers);
    return results.filter((r): r is FuturesMarketData => r !== null);
}

/**
 * Merge order books from multiple exchanges into a single aggregated book
 */
export function mergeOrderBooks(books: AggregatedOrderBook[], tickSize: number = 0.01): {
    bids: Map<number, { totalSize: number; totalUsd: number; exchanges: string[] }>;
    asks: Map<number, { totalSize: number; totalUsd: number; exchanges: string[] }>;
} {
    const bids = new Map<number, { totalSize: number; totalUsd: number; exchanges: string[] }>();
    const asks = new Map<number, { totalSize: number; totalUsd: number; exchanges: string[] }>();
    
    for (const book of books) {
        for (const bid of book.bids) {
            const roundedPrice = Math.floor(bid.price / tickSize) * tickSize;
            const existing = bids.get(roundedPrice) || { totalSize: 0, totalUsd: 0, exchanges: [] };
            existing.totalSize += bid.size;
            existing.totalUsd += bid.sizeUsd;
            if (!existing.exchanges.includes(book.exchange)) {
                existing.exchanges.push(book.exchange);
            }
            bids.set(roundedPrice, existing);
        }
        
        for (const ask of book.asks) {
            const roundedPrice = Math.ceil(ask.price / tickSize) * tickSize;
            const existing = asks.get(roundedPrice) || { totalSize: 0, totalUsd: 0, exchanges: [] };
            existing.totalSize += ask.size;
            existing.totalUsd += ask.sizeUsd;
            if (!existing.exchanges.includes(book.exchange)) {
                existing.exchanges.push(book.exchange);
            }
            asks.set(roundedPrice, existing);
        }
    }
    
    return { bids, asks };
}

/**
 * Get best bid/ask across all exchanges
 */
export function getBestPrices(books: AggregatedOrderBook[]): {
    bestBid: { price: number; exchange: string } | null;
    bestAsk: { price: number; exchange: string } | null;
    spread: number;
    spreadPercent: number;
} {
    let bestBid: { price: number; exchange: string } | null = null;
    let bestAsk: { price: number; exchange: string } | null = null;
    
    for (const book of books) {
        if (book.bids[0] && (!bestBid || book.bids[0].price > bestBid.price)) {
            bestBid = { price: book.bids[0].price, exchange: book.exchange };
        }
        if (book.asks[0] && (!bestAsk || book.asks[0].price < bestAsk.price)) {
            bestAsk = { price: book.asks[0].price, exchange: book.exchange };
        }
    }
    
    const spread = bestAsk && bestBid ? bestAsk.price - bestBid.price : 0;
    const midPrice = bestAsk && bestBid ? (bestAsk.price + bestBid.price) / 2 : 0;
    const spreadPercent = midPrice > 0 ? (spread / midPrice) * 100 : 0;
    
    return { bestBid, bestAsk, spread, spreadPercent };
}

/**
 * Calculate average funding rate across exchanges
 */
export function getAverageFundingRate(rates: FundingRate[]): {
    avgRate: number;
    avgRatePercent: number;
    annualized: number;
    exchanges: string[];
} {
    if (rates.length === 0) {
        return { avgRate: 0, avgRatePercent: 0, annualized: 0, exchanges: [] };
    }
    
    const totalRate = rates.reduce((sum, r) => sum + r.rate, 0);
    const avgRate = totalRate / rates.length;
    const avgRatePercent = avgRate * 100;
    // Annualized = rate * 3 (8h intervals) * 365 days
    const annualized = avgRate * 3 * 365 * 100;
    
    return {
        avgRate,
        avgRatePercent,
        annualized,
        exchanges: rates.map(r => r.exchange)
    };
}

// ========== STORAGE KEYS ==========
export const FUTURES_AGGREGATOR_SETTINGS_KEY = 'futures_aggregator_settings';

export interface FuturesAggregatorSettings {
    enabledExchanges: string[];
    refreshInterval: number; // ms
    orderBookDepth: number;
    autoAggregateOrderBook: boolean;
    showFundingRates: boolean;
    tickSize: string; // 'auto' or number
}

export const DEFAULT_AGGREGATOR_SETTINGS: FuturesAggregatorSettings = {
    enabledExchanges: ['binance', 'bybit', 'hyperliquid'],
    refreshInterval: 1000,
    orderBookDepth: 100,
    autoAggregateOrderBook: true,
    showFundingRates: true,
    tickSize: 'auto'
};
