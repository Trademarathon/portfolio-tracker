
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

// --- API Functions ---

export async function getHyperliquidAccountState(userAddress: string): Promise<HyperliquidState | null> {
    try {
        const response = await fetch(HYPERLIQUID_API, {
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
    try {
        const response = await fetch(HYPERLIQUID_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'spotMeta' })
        });
        if (!response.ok) throw new Error('Failed to fetch Spot Meta');
        return await response.json();
    } catch (error) {
        console.warn('Error fetching Hyperliquid Spot Meta:', error);
        return null;
    }
}

export async function getHyperliquidPerpsMeta(): Promise<PerpsMeta | null> {
    try {
        const response = await fetch(HYPERLIQUID_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'meta' })
        });
        if (!response.ok) throw new Error('Failed to fetch Perps Meta');
        return await response.json();
    } catch (error) {
        console.warn('Error fetching Hyperliquid Perps Meta:', error);
        return null;
    }
}

export async function getHyperliquidAllAssets(): Promise<{ perp: string[], spot: string[] }> {
    try {
        const [spotMeta, perpsMeta] = await Promise.all([
            getHyperliquidSpotMeta(),
            getHyperliquidPerpsMeta()
        ]);

        const spot = spotMeta?.tokens.map(t => t.name + "-SPOT") || [];
        // Perps in universe are ordered. Name is the coin symbol.
        const perp = perpsMeta?.universe.map(u => u.name + "-PERP") || [];

        return { perp, spot };
    } catch (error) {
        console.warn('Error fetching Hyperliquid All Assets:', error);
        return { perp: [], spot: [] };
    }
}

export async function getHyperliquidSpotState(userAddress: string): Promise<SpotState | null> {
    try {
        const response = await fetch(HYPERLIQUID_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'spotClearinghouseState',
                user: userAddress
            })
        });
        if (!response.ok) throw new Error('Failed to fetch Spot State');
        return await response.json();
    } catch (error) {
        // Fallback or just return null
        return null;
    }
}

export async function getHyperliquidUserFills(userAddress: string): Promise<UserFills[]> {
    try {
        const response = await fetch(HYPERLIQUID_API, {
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
        const response = await fetch(HYPERLIQUID_API, {
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
        const response = await fetch(HYPERLIQUID_API, {
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

    // Filter out closed positions (size 0)
    return state.assetPositions
        .filter(item => parseFloat(item.position.szi) !== 0)
        .map(item => {
            const p = item.position;
            const size = parseFloat(p.szi);
            const side = size > 0 ? 'long' : 'short';

            return {
                symbol: p.coin,
                entryPrice: parseFloat(p.entryPx),
                size: Math.abs(size),
                pnl: parseFloat(p.unrealizedPnl),
                side: side,
            };
        });
}

export async function getHyperliquidOpenOrders(userAddress: string): Promise<any[]> {
    try {
        const response = await fetch(HYPERLIQUID_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'openOrders',
                user: userAddress
            })
        });

        if (!response.ok) return [];
        const orders = await response.json();

        return orders.map((o: any) => ({
            id: o.oid,
            symbol: o.coin,
            type: o.orderType || 'limit',
            side: o.side === 'B' ? 'buy' : 'sell',
            price: parseFloat(o.limitPx),
            amount: parseFloat(o.sz),
            filled: 0, // Hyperliquid doesn't show partial fill in this endpoint easily
            remaining: parseFloat(o.sz),
            status: 'open',
            timestamp: o.timestamp,
            exchange: 'hyperliquid'
        }));
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

        const response = await fetch(HYPERLIQUID_API, {
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
