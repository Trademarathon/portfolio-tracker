import { ultraFetch, getLatencyTracker } from '@/lib/ultraFast';

const HYPERLIQUID_API = 'https://api.hyperliquid.xyz/info';

// --- Types ---

export interface HyperliquidState {
    marginSummary: {
        accountValue: string;
        totalMarginUsed: string;
        totalNtlPos: string;
        totalRawUsd: string;
    };
    crossMarginSummary: {
        accountValue: string;
        totalMarginUsed: string;
        totalNtlPos: string;
        totalRawUsd: string;
    };
    assetPositions: Array<{
        position: {
            coin: string;
            szi: string; // size
            entryPx: string;
            positionValue: string;
            returnOnEquity: string;
            unrealizedPnl: string;
            leverage?: {
                type: string;
                value: number;
            };
            liquidationPx?: string;
        };
    }>;
}

export interface SpotMeta {
    universe: Array<{
        name: string;
        tokens: [number, number];
        index: number;
        isCanonical: boolean;
    }>;
    tokens: Array<{
        name: string;
        szDecimals: number;
        weiDecimals: number;
        index: number;
        tokenId: string;
        isCanonical: boolean;
    }>;
}

export interface SpotBalance {
    coin: string; // often an index as string or symbol
    total: string;
    hold: string; // amount in orders
}

export interface SpotState {
    balances: SpotBalance[];
}

export interface PerpsMeta {
    universe: Array<{
        name: string;
        szDecimals: number;
        maxLeverage: number;
        onlyIsolated?: boolean;
    }>;
}

export interface AssetCtx {
    funding: string;
    openInterest: string;
    prevDayPx: string;
    dayNtlVlm: string;
    markPx: string;
    oraclePx: string;
}

export interface PerpsMetaWithCtx {
    meta: PerpsMeta;
    ctxs: AssetCtx[];
}

// Alias for SDK compatibility if needed
export type Meta = PerpsMeta;

export interface UserFills {
    closedPnl: string;
    coin: string;
    crossed: boolean;
    dir: string;
    hash: string;
    oid: number;
    px: string;
    side: string;
    startPosition: string;
    sz: string;
    time: number;
    fee: string;
    feeToken: string;
    tid: number;
}

import { Position } from './types';
import { normalizeSymbol } from '@/lib/utils/normalization';

// --- API Functions ---

export async function getHyperliquidAccountState(userAddress: string): Promise<HyperliquidState | null> {
    const _tracker = getLatencyTracker('hyperliquid-state');
    const _start = performance.now();
    try {
        const response = await ultraFetch(HYPERLIQUID_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'clearinghouseState',
                user: userAddress
            })
        });

        if (!response.ok) {
            throw new Error('Failed to fetch Hyperliquid state');
        }

        return await response.json();
    } catch (error) {
        console.warn('Error fetching Hyperliquid data:', error);
        return null;
    }
}

export async function getHyperliquidSpotMeta(): Promise<SpotMeta | null> {
    // Cache + in-flight de-dupe to avoid 429 rate limits
    const TTL_MS = 1000 * 60 * 15; // 15 minutes
    const COOLDOWN_MS = 1000 * 60; // 60 seconds after 429
     
    if (spotMetaCache.value && Date.now() - spotMetaCache.ts < TTL_MS) return spotMetaCache.value;
    if (Date.now() < spotMetaCache.cooldownUntil) return spotMetaCache.value ?? null;
    if (spotMetaCache.inflight) return spotMetaCache.inflight;

    const _tracker = getLatencyTracker('hyperliquid-meta');
    const _start = performance.now();
    spotMetaCache.inflight = (async () => {
      try {
        const response = await ultraFetch(HYPERLIQUID_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'spotMeta' })
        });
        if (!response.ok) {
            // Cool down on any non-2xx (429s are common)
            spotMetaCache.cooldownUntil = Date.now() + COOLDOWN_MS;
            return spotMetaCache.value ?? null;
        }
        const json = await response.json();
        spotMetaCache.value = json;
        spotMetaCache.ts = Date.now();
        return json;
      } catch (error) {
        spotMetaCache.cooldownUntil = Date.now() + COOLDOWN_MS;
        // Keep previous cache value if we have one; avoid noisy console spam
        if (Date.now() - spotMetaCache.lastLogTs > 60000) {
            spotMetaCache.lastLogTs = Date.now();
            console.warn('Error fetching Hyperliquid Spot Meta:', error);
        }
        return spotMetaCache.value ?? null;
      } finally {
        spotMetaCache.inflight = null;
      }
    })();
    return spotMetaCache.inflight;
}

export async function getHyperliquidPerpsMeta(): Promise<PerpsMeta | null> {
    const TTL_MS = 1000 * 60 * 15;
    const COOLDOWN_MS = 1000 * 60;
     
    if (perpsMetaCache.value && Date.now() - perpsMetaCache.ts < TTL_MS) return perpsMetaCache.value;
    if (Date.now() < perpsMetaCache.cooldownUntil) return perpsMetaCache.value ?? null;
    if (perpsMetaCache.inflight) return perpsMetaCache.inflight;

    perpsMetaCache.inflight = (async () => {
      try {
        const response = await ultraFetch(HYPERLIQUID_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'meta' })
        });
        if (!response.ok) {
            perpsMetaCache.cooldownUntil = Date.now() + COOLDOWN_MS;
            return perpsMetaCache.value ?? null;
        }
        const json = await response.json();
        perpsMetaCache.value = json;
        perpsMetaCache.ts = Date.now();
        return json;
      } catch (error) {
        perpsMetaCache.cooldownUntil = Date.now() + COOLDOWN_MS;
        if (Date.now() - perpsMetaCache.lastLogTs > 60000) {
            perpsMetaCache.lastLogTs = Date.now();
            console.warn('Error fetching Hyperliquid Perps Meta:', error);
        }
        return perpsMetaCache.value ?? null;
      } finally {
        perpsMetaCache.inflight = null;
      }
    })();

    return perpsMetaCache.inflight;
}

export async function getHyperliquidPerpsMetaAndCtxs(): Promise<PerpsMetaWithCtx | null> {
    const TTL_MS = 1000 * 15 * 1; // 15 seconds (ctxs move fast, but still de-dupe bursts)
    const COOLDOWN_MS = 1000 * 30; // 30s cooldown after 429
     
    if (perpsMetaCtxCache.value && Date.now() - perpsMetaCtxCache.ts < TTL_MS) return perpsMetaCtxCache.value;
    if (Date.now() < perpsMetaCtxCache.cooldownUntil) return perpsMetaCtxCache.value ?? null;
    if (perpsMetaCtxCache.inflight) return perpsMetaCtxCache.inflight;

    perpsMetaCtxCache.inflight = (async () => {
      try {
        const response = await ultraFetch(HYPERLIQUID_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'metaAndAssetCtxs' })
        });
        if (!response.ok) {
            perpsMetaCtxCache.cooldownUntil = Date.now() + COOLDOWN_MS;
            return perpsMetaCtxCache.value ?? null;
        }
        const data = await response.json();
        const value = {
            meta: data[0],
            ctxs: data[1]
        };
        perpsMetaCtxCache.value = value;
        perpsMetaCtxCache.ts = Date.now();
        return value;
      } catch (error) {
        perpsMetaCtxCache.cooldownUntil = Date.now() + COOLDOWN_MS;
        if (Date.now() - perpsMetaCtxCache.lastLogTs > 60000) {
            perpsMetaCtxCache.lastLogTs = Date.now();
            console.warn('Error fetching Hyperliquid Perps Meta and Ctxs:', error);
        }
        return perpsMetaCtxCache.value ?? null;
      } finally {
        perpsMetaCtxCache.inflight = null;
      }
    })();

    return perpsMetaCtxCache.inflight;
}

// Module-level caches (avoid re-fetch storms across hooks/components)
const spotMetaCache: {
    value: SpotMeta | null;
    ts: number;
    cooldownUntil: number;
    inflight: Promise<SpotMeta | null> | null;
    lastLogTs: number;
} = { value: null, ts: 0, cooldownUntil: 0, inflight: null, lastLogTs: 0 };

const perpsMetaCache: {
    value: PerpsMeta | null;
    ts: number;
    cooldownUntil: number;
    inflight: Promise<PerpsMeta | null> | null;
    lastLogTs: number;
} = { value: null, ts: 0, cooldownUntil: 0, inflight: null, lastLogTs: 0 };

const perpsMetaCtxCache: {
    value: PerpsMetaWithCtx | null;
    ts: number;
    cooldownUntil: number;
    inflight: Promise<PerpsMetaWithCtx | null> | null;
    lastLogTs: number;
} = { value: null, ts: 0, cooldownUntil: 0, inflight: null, lastLogTs: 0 };

/** Hyperliquid Unit tokens: API returns UBTC/UETH/USOL but UI shows BTC/ETH/SOL */
const HL_DISPLAY_MAP: Record<string, string> = {
    UBTC: 'BTC',
    UETH: 'ETH',
    USOL: 'SOL',
};

/**
 * Returns real tick names from Hyperliquid APIs.
 * Maps Unit tokens (UBTC, UETH, USOL) to canonical names for display/linking.
 * - Spot: token names from spotMeta.tokens (exact API data).
 * - Perp: universe[].name from perpsMeta (exact API tick names).
 */
export async function getHyperliquidAllAssets(): Promise<{ perp: string[]; spot: string[] }> {
    try {
        const [spotMeta, perpsMeta] = await Promise.all([
            getHyperliquidSpotMeta(),
            getHyperliquidPerpsMeta()
        ]);

        const toDisplay = (name: string) => HL_DISPLAY_MAP[name?.toUpperCase()] || name;

        const spot = (spotMeta?.tokens || [])
            .map((t) => toDisplay(t.name) + "-SPOT")
            .filter((s) => s !== "-SPOT");
        const perp = (perpsMeta?.universe || [])
            .map((u) => toDisplay(u.name) + "-PERP")
            .filter(Boolean);

        return { perp, spot };
    } catch (error) {
        console.warn('Error fetching Hyperliquid All Assets:', error);
        return { perp: [], spot: [] };
    }
}

export async function getHyperliquidSpotState(userAddress: string): Promise<SpotState | null> {
    try {
        const response = await ultraFetch(HYPERLIQUID_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'spotClearinghouseState',
                user: userAddress
            })
        });
        if (!response.ok) throw new Error('Failed to fetch Spot State');
        return await response.json();
    } catch (_error) {
        // Fallback or just return null
        return null;
    }
}

export async function getHyperliquidUserFills(userAddress: string): Promise<UserFills[]> {
    try {
        const response = await ultraFetch(HYPERLIQUID_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'userFills',
                user: userAddress
            })
        });

        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.warn('Error fetching Hyperliquid Fills:', error);
        return [];
    }
}

export async function getHyperliquidUserTransfers(userAddress: string): Promise<any[]> {
    try {
        const response = await ultraFetch(HYPERLIQUID_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'userNonAccountTransfers',
                user: userAddress
            })
        });

        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.warn('Error fetching Hyperliquid Transfers:', error);
        return [];
    }
}

export async function getHyperliquidUserFunding(userAddress: string): Promise<any[]> {
    try {
        const response = await ultraFetch(HYPERLIQUID_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'userFunding',
                user: userAddress
            })
        });

        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.warn('Error fetching Hyperliquid Funding:', error);
        return [];
    }
}

export function parseHyperliquidPositions(state: HyperliquidState): Position[] {
    if (!state || !state.assetPositions) return [];

    return state.assetPositions
        .filter(item => parseFloat(item.position.szi) !== 0)
        .map(item => {
            const p = item.position;
            const size = parseFloat(p.szi);
            const side = size > 0 ? 'long' : 'short';
            const markPrice = parseFloat(p.positionValue) / Math.abs(size) || 0;

            return {
                symbol: normalizeSymbol(p.coin),
                entryPrice: parseFloat(p.entryPx),
                size: Math.abs(size),
                pnl: parseFloat(p.unrealizedPnl),
                side: side,
                leverage: p.leverage?.value || 1,
                liquidationPrice: p.liquidationPx ? parseFloat(p.liquidationPx) : 0,
                markPrice
            };
        });
}

/**
 * Normalize raw Hyperliquid open orders into a unified shape that the UI expects.
 * This is shared between the initial REST snapshot and the aggressive polling hook.
 */
export function normalizeHyperliquidOpenOrders(rawOrders: any[], connectionName?: string): any[] {
    if (!Array.isArray(rawOrders)) return [];

    return rawOrders.map((o: any) => {
        const rawSymbol = String(o.coin ?? o.symbol ?? '');

        // Normalize side to 'buy' | 'sell'
        const rawSide = String(o.side ?? '').toUpperCase();
        const side: 'buy' | 'sell' =
            rawSide === 'B' || rawSide === 'BUY' || rawSide === 'LONG'
                ? 'buy'
                : 'sell';

        const price = parseFloat(o.limitPx ?? o.px ?? o.price ?? '0');
        const amount = parseFloat(o.sz ?? o.size ?? '0');
        const filled = o.filled !== undefined ? parseFloat(String(o.filled)) : 0;

        return {
            // Use string IDs consistently for UI components
            id: String(o.oid ?? o.cloid ?? `${rawSymbol}-${o.timestamp ?? Date.now()}`),
            symbol: rawSymbol,           // Final human-readable symbol is resolved later in usePortfolioData
            rawSymbol,
            type: String(o.orderType ?? o.type ?? 'limit').toLowerCase(),
            side,
            price: isNaN(price) ? 0 : price,
            amount: isNaN(amount) ? 0 : amount,
            filled: isNaN(filled) ? 0 : filled,
            remaining: isNaN(amount - filled) ? 0 : Math.max(amount - filled, 0),
            status: 'open',
            timestamp: Number(o.timestamp ?? o.t ?? Date.now()),
            exchange: 'hyperliquid',
            connectionName,
            isPerp: !rawSymbol.startsWith('@') && !/^\d+$/.test(rawSymbol),
            // Perp-specific extras (best-effort)
            reduceOnly: Boolean(o.reduceOnly),
            leverage: typeof o.leverage === 'number'
                ? o.leverage
                : (typeof o.leverage?.value === 'number' ? o.leverage.value : undefined),
        };
    });
}

/**
 * Resolve Hyperliquid spot symbol aliases (e.g. "@142" or "142") into readable token symbols.
 * Hyperliquid can return either token indices or universe market indices depending on endpoint.
 */
export function resolveHyperliquidSymbol(raw: string, spotMeta: SpotMeta | null | undefined): string {
    const normalizedRaw = normalizeSymbol(String(raw || ''));
    if (!spotMeta) return normalizedRaw;

    const source = String(raw ?? '').trim();
    if (!source) return normalizedRaw;

    const idx = source.startsWith('@') ? parseInt(source.slice(1), 10) : parseInt(source, 10);
    if (Number.isNaN(idx)) return normalizedRaw;

    // 1) Token index path (most common for @<id> in spot balances/orders)
    const token = spotMeta.tokens.find(t => t.index === idx);
    if (token?.name) return normalizeSymbol(token.name);

    // 2) Universe market index path (map to base token)
    const market = spotMeta.universe.find(u => u.index === idx);
    if (market) {
        const baseTokenId = market.tokens?.[0];
        const baseToken = spotMeta.tokens.find(t => t.index === baseTokenId);
        return normalizeSymbol(baseToken?.name || market.name || source);
    }

    return normalizedRaw;
}

export async function getHyperliquidOpenOrders(userAddress: string, connectionName?: string): Promise<any[]> {
    try {
        const response = await ultraFetch(HYPERLIQUID_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'openOrders',
                user: userAddress
            })
        });

        if (!response.ok) return [];
        const orders = await response.json();

        return normalizeHyperliquidOpenOrders(orders, connectionName);
    } catch (error) {
        console.warn('Error fetching Hyperliquid Open Orders:', error);
        return [];
    }
}

export interface L2BookParams {
    coin: string;
    nSigFigs?: number;
    mantissa?: number;
}

export interface L2Book {
    coin: string;
    levels: [Array<{ px: string; sz: string; n: number }>, Array<{ px: string; sz: string; n: number }>];
}

export async function getHyperliquidL2Book(coin: string, nSigFigs?: number, mantissa?: number): Promise<L2Book> {
    try {
        const body: any = {
            type: 'l2Book',
            coin
        };
        if (nSigFigs) body.nSigFigs = nSigFigs;
        if (mantissa) body.mantissa = mantissa;

        const response = await ultraFetch(HYPERLIQUID_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) throw new Error('Failed to fetch L2 Book');
        return await response.json();
    } catch (error) {
        console.warn('Error fetching Hyperliquid L2 Book:', error);
        return { coin, levels: [[], []] };
    }
}

// ========== ORDER TYPES ==========
export interface OrderRequest {
    symbol: string;
    side: 'buy' | 'sell';
    type: 'limit' | 'market' | 'stop_limit' | 'stop_market' | 'chase' | 'scale' | 'twap' | 'swarm';
    price?: number;
    size: number;
    leverage?: number;
    reduceOnly?: boolean;
    postOnly?: boolean;
    triggerPrice?: number;  // For stop orders
    tpPrice?: number;       // Take profit
    slPrice?: number;       // Stop loss
    // Chase specific
    chaseDistance?: number; // Distance from best price to chase
    // Scale specific
    scaleOrders?: number;   // Number of orders
    scaleRange?: [number, number]; // Price range [start, end]
    // TWAP specific
    twapDuration?: number;  // Duration in seconds
    twapInterval?: number;  // Interval between orders
    // Swarm specific
    swarmCount?: number;    // Number of swarm orders
}

export interface OrderResult {
    success: boolean;
    orderId?: string;
    error?: string;
    message?: string;
}

// Hyperliquid Exchange API endpoint
const _HYPERLIQUID_EXCHANGE_API = 'https://api.hyperliquid.xyz/exchange';

/**
 * Get best bid/ask from L2 book
 */
export async function getBestBidAsk(coin: string): Promise<{ bid: number; ask: number }> {
    const book = await getHyperliquidL2Book(coin);
    const bestBid = book.levels[0]?.[0] ? parseFloat(book.levels[0][0].px) : 0;
    const bestAsk = book.levels[1]?.[0] ? parseFloat(book.levels[1][0].px) : 0;
    return { bid: bestBid, ask: bestAsk };
}

/**
 * Calculate execution price for market orders with slippage protection
 */
export function calculateMarketPrice(
    side: 'buy' | 'sell',
    book: L2Book,
    size: number,
    _maxSlippage: number = 0.01 // 1% default
): { price: number; avgPrice: number; slippage: number } {
    const levels = side === 'buy' ? book.levels[1] : book.levels[0]; // asks for buy, bids for sell
    let remainingSize = size;
    let totalCost = 0;
    let bestPrice = 0;

    for (const level of levels) {
        if (remainingSize <= 0) break;
        const px = parseFloat(level.px);
        const sz = parseFloat(level.sz);
        if (!bestPrice) bestPrice = px;

        const fillSize = Math.min(remainingSize, sz);
        totalCost += fillSize * px;
        remainingSize -= fillSize;
    }

    const avgPrice = totalCost / (size - remainingSize);
    const slippage = bestPrice ? Math.abs(avgPrice - bestPrice) / bestPrice : 0;

    return {
        price: bestPrice,
        avgPrice,
        slippage
    };
}

/**
 * Format order for Hyperliquid API
 * Note: Actual order placement requires wallet signing which happens client-side
 */
export function formatHyperliquidOrder(order: OrderRequest, assetIndex: number): any {
    const isBuy = order.side === 'buy';

    // Base order structure
    const orderWire: any = {
        a: assetIndex,                    // Asset index
        b: isBuy,                         // true = buy, false = sell
        p: order.price?.toString() || '0', // Price as string
        s: order.size.toString(),         // Size as string
        r: order.reduceOnly || false,     // Reduce only
        t: {                              // Order type
            limit: {
                tif: order.postOnly ? 'Alo' : 'Gtc' // ALO = Add Liquidity Only (Post Only)
            }
        }
    };

    // Handle trigger orders (stops)
    if (order.type === 'stop_limit' || order.type === 'stop_market') {
        orderWire.t = {
            trigger: {
                isMarket: order.type === 'stop_market',
                triggerPx: order.triggerPrice?.toString() || order.price?.toString(),
                tpsl: 'sl' // Could be 'tp' for take profit
            }
        };
    }

    return orderWire;
}

/**
 * Prepare TWAP orders (client-side simulation)
 * Returns array of orders to be placed at intervals
 */
export function prepareTwapOrders(
    order: OrderRequest,
    intervals: number = 10
): OrderRequest[] {
    const duration = order.twapDuration || 300; // Default 5 minutes
    const _intervalTime = duration / intervals;
    const sizePerOrder = order.size / intervals;

    return Array.from({ length: intervals }, (_v, _i) => ({
        ...order,
        size: sizePerOrder,
        type: 'limit' as const,
        // Each order should be placed at current market price at execution time
    }));
}

/**
 * Prepare Scale orders
 * Distributes orders across a price range
 */
export function prepareScaleOrders(
    order: OrderRequest,
    count: number = 5
): OrderRequest[] {
    const [startPrice, endPrice] = order.scaleRange || [order.price! * 0.99, order.price! * 1.01];
    const priceStep = (endPrice - startPrice) / (count - 1);
    const sizePerOrder = order.size / count;

    return Array.from({ length: count }, (_, i) => ({
        ...order,
        price: startPrice + (priceStep * i),
        size: sizePerOrder,
        type: 'limit' as const,
    }));
}

/**
 * Prepare Chase order logic
 * Chase orders follow the best bid/ask and update when price moves
 */
export function prepareChaseOrder(
    order: OrderRequest,
    bestBid: number,
    bestAsk: number
): OrderRequest {
    const chaseDistance = order.chaseDistance || 0; // 0 = at the best price
    const targetPrice = order.side === 'buy'
        ? bestBid + chaseDistance
        : bestAsk - chaseDistance;

    return {
        ...order,
        price: targetPrice,
        type: 'limit' as const,
        postOnly: true, // Chase orders are typically post-only
    };
}

/**
 * Validate order before submission
 */
export function validateOrder(order: OrderRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!order.symbol) errors.push('Symbol is required');
    if (!order.size || order.size <= 0) errors.push('Size must be positive');
    if (!order.side) errors.push('Side (buy/sell) is required');

    if (order.type === 'limit' && (!order.price || order.price <= 0)) {
        errors.push('Price is required for limit orders');
    }

    if ((order.type === 'stop_limit' || order.type === 'stop_market') && !order.triggerPrice) {
        errors.push('Trigger price is required for stop orders');
    }

    if (order.leverage && (order.leverage < 1 || order.leverage > 100)) {
        errors.push('Leverage must be between 1 and 100');
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Get asset index from meta for order placement
 */
export async function getAssetIndex(coin: string): Promise<number> {
    const meta = await getHyperliquidPerpsMeta();
    if (!meta) return -1;

    const index = meta.universe.findIndex(u => u.name.toUpperCase() === coin.toUpperCase());
    return index;
}

/**
 * Calculate position size from USD value
 */
export function calculatePositionSize(
    usdValue: number,
    price: number,
    leverage: number = 1
): number {
    if (!price || price <= 0) return 0;
    return (usdValue * leverage) / price;
}

/**
 * Calculate required margin for position
 */
export function calculateRequiredMargin(
    size: number,
    price: number,
    leverage: number = 1
): number {
    if (!leverage || leverage <= 0) return size * price;
    return (size * price) / leverage;
}
