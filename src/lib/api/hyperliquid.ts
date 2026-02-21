import { ultraFetch, getLatencyTracker } from '@/lib/ultraFast';
import { normalizeSymbol } from '@/lib/utils/normalization';
import { Position } from './types';

export const HYPERLIQUID_INFO_API = 'https://api.hyperliquid.xyz/info';

type HyperliquidInfoPayload = {
    type: string;
    [key: string]: unknown;
};

interface CachedResource<T> {
    value: T | null;
    ts: number;
    cooldownUntil: number;
    inflight: Promise<T | null> | null;
    lastLogTs: number;
}

function createCache<T>(): CachedResource<T> {
    return { value: null, ts: 0, cooldownUntil: 0, inflight: null, lastLogTs: 0 };
}

function toFiniteNumber(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function warnOncePerMinute(cache: CachedResource<unknown>, message: string, error: unknown) {
    const now = Date.now();
    if (now - cache.lastLogTs > 60000) {
        cache.lastLogTs = now;
        console.warn(message, error);
    }
}

async function hyperliquidInfoRequest<T>(payload: HyperliquidInfoPayload): Promise<T | null> {
    const result = await hyperliquidInfoRequestResult<T>(payload);
    return result.ok ? result.data : null;
}

interface HyperliquidRequestResult<T> {
    ok: boolean;
    data: T | null;
}

async function hyperliquidInfoRequestResult<T>(payload: HyperliquidInfoPayload): Promise<HyperliquidRequestResult<T>> {
    try {
        const response = await ultraFetch(HYPERLIQUID_INFO_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) return { ok: false, data: null };
        return { ok: true, data: await response.json() as T };
    } catch (_error) {
        return { ok: false, data: null };
    }
}

async function fetchCachedInfo<T>(params: {
    cache: CachedResource<T>;
    ttlMs: number;
    cooldownMs: number;
    trackerName?: string;
    payload: HyperliquidInfoPayload;
    map: (raw: unknown) => T | null;
    logMessage: string;
}): Promise<T | null> {
    const { cache, ttlMs, cooldownMs, trackerName, payload, map, logMessage } = params;
    const now = Date.now();

    if (cache.value && now - cache.ts < ttlMs) return cache.value;
    if (now < cache.cooldownUntil) return cache.value ?? null;
    if (cache.inflight) return cache.inflight;

    cache.inflight = (async () => {
        const tracker = trackerName ? getLatencyTracker(trackerName) : null;
        const start = typeof performance !== 'undefined' ? performance.now() : 0;
        try {
            const response = await ultraFetch(HYPERLIQUID_INFO_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (tracker) {
                const elapsed = (typeof performance !== 'undefined' ? performance.now() : start) - start;
                tracker.add(Math.round(elapsed));
            }

            if (!response.ok) {
                cache.cooldownUntil = Date.now() + cooldownMs;
                return cache.value ?? null;
            }

            const raw = await response.json();
            const parsed = map(raw);
            if (!parsed) {
                cache.cooldownUntil = Date.now() + cooldownMs;
                return cache.value ?? null;
            }

            cache.value = parsed;
            cache.ts = Date.now();
            return parsed;
        } catch (error) {
            cache.cooldownUntil = Date.now() + cooldownMs;
            warnOncePerMinute(cache, logMessage, error);
            return cache.value ?? null;
        } finally {
            cache.inflight = null;
        }
    })();

    return cache.inflight;
}

// --- Types ---

export interface HyperliquidState {
    marginSummary?: {
        accountValue?: string;
        totalMarginUsed?: string;
        totalNtlPos?: string;
        totalRawUsd?: string;
    };
    crossMarginSummary?: {
        accountValue?: string;
        totalMarginUsed?: string;
        totalNtlPos?: string;
        totalRawUsd?: string;
    };
    assetPositions?: Array<{
        position?: {
            coin?: string;
            szi?: string;
            entryPx?: string;
            positionValue?: string;
            returnOnEquity?: string;
            unrealizedPnl?: string;
            leverage?: {
                type?: string;
                value?: number;
            };
            liquidationPx?: string;
        };
    }>;
    withdrawable?: string | number;
    accountValue?: string | number;
    totalAccountValue?: string | number;
    userState?: {
        accountValue?: string | number;
    };
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
    coin: string;
    total: string;
    hold: string;
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
    funding?: string;
    openInterest?: string;
    prevDayPx?: string;
    dayNtlVlm?: string;
    dayNfv?: string;
    markPx?: string;
    oraclePx?: string;
}

export interface SpotAssetCtx {
    dayNtlVlm?: string;
    dayNfv?: string;
    markPx?: string;
    prevDayPx?: string;
    midPx?: string;
}

export interface PerpsMetaWithCtx {
    meta: PerpsMeta;
    ctxs: AssetCtx[];
}

export interface SpotMetaWithCtx {
    meta: SpotMeta;
    ctxs: SpotAssetCtx[];
}

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

function parsePerpsMetaAndCtxs(raw: unknown): PerpsMetaWithCtx | null {
    if (Array.isArray(raw) && raw.length >= 2) {
        const meta = raw[0] as PerpsMeta | undefined;
        const ctxs = raw[1] as AssetCtx[] | undefined;
        if (meta?.universe && Array.isArray(ctxs)) {
            return { meta, ctxs };
        }
    }

    if (raw && typeof raw === 'object') {
        const obj = raw as { meta?: PerpsMeta; assetCtxs?: AssetCtx[]; ctxs?: AssetCtx[] };
        const ctxs = obj.assetCtxs ?? obj.ctxs;
        if (obj.meta?.universe && Array.isArray(ctxs)) {
            return { meta: obj.meta, ctxs };
        }
    }

    return null;
}

function parseSpotMetaAndCtxs(raw: unknown): SpotMetaWithCtx | null {
    if (Array.isArray(raw) && raw.length >= 2) {
        const meta = raw[0] as SpotMeta | undefined;
        const ctxs = raw[1] as SpotAssetCtx[] | undefined;
        if (meta?.universe && Array.isArray(ctxs)) {
            return { meta, ctxs };
        }
    }

    if (raw && typeof raw === 'object') {
        const obj = raw as { spotMeta?: SpotMeta; spotAssetCtxs?: SpotAssetCtx[]; meta?: SpotMeta; ctxs?: SpotAssetCtx[] };
        const meta = obj.spotMeta ?? obj.meta;
        const ctxs = obj.spotAssetCtxs ?? obj.ctxs;
        if (meta?.universe && Array.isArray(ctxs)) {
            return { meta, ctxs };
        }
    }

    return null;
}

const spotMetaCache = createCache<SpotMeta>();
const perpsMetaCache = createCache<PerpsMeta>();
const perpsMetaCtxCache = createCache<PerpsMetaWithCtx>();
const spotMetaCtxCache = createCache<SpotMetaWithCtx>();

export function getHyperliquidNotionalVolumeUsd(ctx: { dayNtlVlm?: unknown; dayNfv?: unknown } | null | undefined): number {
    if (!ctx) return 0;
    const dayNtlVlm = toFiniteNumber(ctx.dayNtlVlm, 0);
    if (dayNtlVlm > 0) return dayNtlVlm;
    const dayNfv = toFiniteNumber(ctx.dayNfv, 0);
    return dayNfv > 0 ? dayNfv : 0;
}

// --- API Functions ---

export async function getHyperliquidAccountState(userAddress: string): Promise<HyperliquidState | null> {
    return hyperliquidInfoRequest<HyperliquidState>({
        type: 'clearinghouseState',
        user: userAddress
    });
}

export async function getHyperliquidSpotMeta(): Promise<SpotMeta | null> {
    return fetchCachedInfo({
        cache: spotMetaCache,
        ttlMs: 1000 * 60 * 15,
        cooldownMs: 1000 * 60,
        trackerName: 'hyperliquid-spot-meta',
        payload: { type: 'spotMeta' },
        map: (raw) => (raw && typeof raw === 'object' && Array.isArray((raw as SpotMeta).tokens) ? raw as SpotMeta : null),
        logMessage: 'Error fetching Hyperliquid spotMeta:'
    });
}

export async function getHyperliquidPerpsMeta(): Promise<PerpsMeta | null> {
    return fetchCachedInfo({
        cache: perpsMetaCache,
        ttlMs: 1000 * 60 * 15,
        cooldownMs: 1000 * 60,
        trackerName: 'hyperliquid-perps-meta',
        payload: { type: 'meta' },
        map: (raw) => (raw && typeof raw === 'object' && Array.isArray((raw as PerpsMeta).universe) ? raw as PerpsMeta : null),
        logMessage: 'Error fetching Hyperliquid meta:'
    });
}

export async function getHyperliquidPerpsMetaAndCtxs(): Promise<PerpsMetaWithCtx | null> {
    return fetchCachedInfo({
        cache: perpsMetaCtxCache,
        ttlMs: 1000 * 15,
        cooldownMs: 1000 * 30,
        trackerName: 'hyperliquid-meta-and-ctxs',
        payload: { type: 'metaAndAssetCtxs' },
        map: parsePerpsMetaAndCtxs,
        logMessage: 'Error fetching Hyperliquid metaAndAssetCtxs:'
    });
}

export async function getHyperliquidSpotMetaAndAssetCtxs(): Promise<SpotMetaWithCtx | null> {
    return fetchCachedInfo({
        cache: spotMetaCtxCache,
        ttlMs: 1000 * 15,
        cooldownMs: 1000 * 30,
        trackerName: 'hyperliquid-spot-meta-and-ctxs',
        payload: { type: 'spotMetaAndAssetCtxs' },
        map: parseSpotMetaAndCtxs,
        logMessage: 'Error fetching Hyperliquid spotMetaAndAssetCtxs:'
    });
}

/** Hyperliquid Unit tokens: API returns UBTC/UETH/USOL but UI shows BTC/ETH/SOL */
const HL_DISPLAY_MAP: Record<string, string> = {
    UBTC: 'BTC',
    UETH: 'ETH',
    USOL: 'SOL',
};

export async function getHyperliquidAllAssets(): Promise<{ perp: string[]; spot: string[] }> {
    try {
        const [spotMeta, perpsMeta] = await Promise.all([
            getHyperliquidSpotMeta(),
            getHyperliquidPerpsMeta()
        ]);

        const toDisplay = (name: string) => HL_DISPLAY_MAP[name?.toUpperCase()] || name;

        const spot = (spotMeta?.tokens || [])
            .map((t) => `${toDisplay(t.name)}-SPOT`)
            .filter((s) => s !== '-SPOT');

        const perp = (perpsMeta?.universe || [])
            .map((u) => `${toDisplay(u.name)}-PERP`)
            .filter(Boolean);

        return { perp, spot };
    } catch (error) {
        console.warn('Error fetching Hyperliquid assets:', error);
        return { perp: [], spot: [] };
    }
}

export async function getHyperliquidSpotState(userAddress: string): Promise<SpotState | null> {
    return hyperliquidInfoRequest<SpotState>({
        type: 'spotClearinghouseState',
        user: userAddress
    });
}

export async function getHyperliquidUserFills(userAddress: string): Promise<UserFills[]> {
    const fills = await hyperliquidInfoRequest<UserFills[]>({
        type: 'userFills',
        user: userAddress
    });
    return Array.isArray(fills) ? fills : [];
}

export async function getHyperliquidUserTransfers(userAddress: string): Promise<any[]> {
    const transfers = await hyperliquidInfoRequest<any[]>({
        type: 'userNonAccountTransfers',
        user: userAddress
    });
    return Array.isArray(transfers) ? transfers : [];
}

export async function getHyperliquidUserFunding(userAddress: string): Promise<any[]> {
    const funding = await hyperliquidInfoRequest<any[]>({
        type: 'userFunding',
        user: userAddress
    });
    return Array.isArray(funding) ? funding : [];
}

export function parseHyperliquidPositions(state: HyperliquidState): Position[] {
    if (!state?.assetPositions) return [];

    return state.assetPositions
        .map((item) => item?.position)
        .filter((position): position is NonNullable<typeof position> => !!position)
        .filter((position) => toFiniteNumber(position.szi, 0) !== 0)
        .map((position) => {
            const size = toFiniteNumber(position.szi, 0);
            const absSize = Math.abs(size);
            const positionValue = toFiniteNumber(position.positionValue, 0);
            const markPrice = absSize > 0 ? positionValue / absSize : 0;

            return {
                symbol: normalizeSymbol(String(position.coin || '')),
                entryPrice: toFiniteNumber(position.entryPx, 0),
                size: absSize,
                pnl: toFiniteNumber(position.unrealizedPnl, 0),
                side: size > 0 ? 'long' : 'short',
                leverage: toFiniteNumber(position.leverage?.value, 1) || 1,
                liquidationPrice: toFiniteNumber(position.liquidationPx, 0),
                markPrice
            };
        });
}

/**
 * Normalize raw Hyperliquid open orders into a unified shape that the UI expects.
 * Supports both `frontendOpenOrders` (official docs) and legacy `openOrders`.
 */
export function normalizeHyperliquidOpenOrders(rawOrders: any[], connectionName?: string): any[] {
    if (!Array.isArray(rawOrders)) return [];

    return rawOrders.map((o: any) => {
        const rawSymbol = String(o.coin ?? o.symbol ?? '');
        const rawSide = String(o.side ?? '').toUpperCase();
        const side: 'buy' | 'sell' =
            rawSide === 'B' || rawSide === 'BUY' || rawSide === 'LONG'
                ? 'buy'
                : 'sell';

        const price = toFiniteNumber(o.limitPx ?? o.px ?? o.price, 0);
        const amount = toFiniteNumber(o.sz ?? o.size, 0);
        const filled = o.filled !== undefined ? toFiniteNumber(o.filled, 0) : 0;
        const normalizedType = String(o.orderType ?? o.type ?? 'limit')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '_');

        return {
            id: String(o.oid ?? o.cloid ?? `${rawSymbol}-${o.timestamp ?? Date.now()}`),
            symbol: rawSymbol,
            rawSymbol,
            type: normalizedType,
            side,
            price,
            amount,
            filled,
            remaining: Math.max(amount - filled, 0),
            status: 'open',
            timestamp: toFiniteNumber(o.timestamp ?? o.t, Date.now()),
            exchange: 'hyperliquid',
            connectionName,
            isPerp: !rawSymbol.startsWith('@') && !/^\d+$/.test(rawSymbol),
            reduceOnly: Boolean(o.reduceOnly),
            leverage: typeof o.leverage === 'number'
                ? o.leverage
                : (typeof o.leverage?.value === 'number' ? o.leverage.value : undefined),
            triggerPrice: toFiniteNumber(o.triggerPx, 0) || undefined,
            triggerCondition: typeof o.triggerCondition === 'string' ? o.triggerCondition : undefined,
        };
    });
}

/**
 * Resolve Hyperliquid spot symbol aliases (e.g. "@142" or "142") into readable token symbols.
 */
export function resolveHyperliquidSymbol(raw: string, spotMeta: SpotMeta | null | undefined): string {
    const normalizedRaw = normalizeSymbol(String(raw || ''));
    if (!spotMeta) return normalizedRaw;

    const source = String(raw ?? '').trim();
    if (!source) return normalizedRaw;

    const idx = source.startsWith('@') ? parseInt(source.slice(1), 10) : parseInt(source, 10);
    if (Number.isNaN(idx)) return normalizedRaw;

    const token = spotMeta.tokens.find(t => t.index === idx);
    if (token?.name) return normalizeSymbol(token.name);

    const market = spotMeta.universe.find(u => u.index === idx);
    if (market) {
        const baseTokenId = market.tokens?.[0];
        const baseToken = spotMeta.tokens.find(t => t.index === baseTokenId);
        return normalizeSymbol(baseToken?.name || market.name || source);
    }

    return normalizedRaw;
}

export interface HyperliquidOpenOrdersResult {
    ok: boolean;
    orders: any[];
}

export async function getHyperliquidOpenOrdersResult(userAddress: string, connectionName?: string): Promise<HyperliquidOpenOrdersResult> {
    const frontendResult = await hyperliquidInfoRequestResult<any[]>({
        type: 'frontendOpenOrders',
        user: userAddress
    });
    if (frontendResult.ok) {
        return {
            ok: true,
            orders: normalizeHyperliquidOpenOrders(Array.isArray(frontendResult.data) ? frontendResult.data : [], connectionName)
        };
    }

    const legacyResult = await hyperliquidInfoRequestResult<any[]>({
        type: 'openOrders',
        user: userAddress
    });
    if (legacyResult.ok) {
        return {
            ok: true,
            orders: normalizeHyperliquidOpenOrders(Array.isArray(legacyResult.data) ? legacyResult.data : [], connectionName)
        };
    }

    return { ok: false, orders: [] };
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
    const body: HyperliquidInfoPayload = {
        type: 'l2Book',
        coin
    };

    if (nSigFigs !== undefined) body.nSigFigs = nSigFigs;
    if (mantissa !== undefined) body.mantissa = mantissa;

    const book = await hyperliquidInfoRequest<L2Book>(body);
    if (!book || !Array.isArray(book.levels)) {
        return { coin, levels: [[], []] };
    }
    return book;
}
