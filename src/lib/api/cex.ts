import { apiUrl } from './client';
import { normalizeSymbol } from '../utils/normalization';

const CEX_FETCH_TIMEOUT_MS = 8000;
const API_COOLDOWN_MS = 30000;
const API_SERVER_DOWN_COOLDOWN_MS = 45000;
const apiUnavailableUntilByKey = new Map<string, number>();
let apiServerUnavailableUntil = 0;
const CACHE_TTL_MS = 120000;
const CACHE_PREFIX = "cex_cache_v2";
const BYBIT_TYPED_BALANCE_CACHE_VERSION = "v2";
const WARN_THROTTLE_MS = 15000;
const lastWarnAtByKey = new Map<string, number>();
const LOCAL_API_BASE =
    (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:35821")
        .replace(/\/+$/, "");

function markApiServerUnavailable() {
    apiServerUnavailableUntil = Date.now() + API_SERVER_DOWN_COOLDOWN_MS;
}

function warnThrottled(key: string, message: string, ...args: unknown[]) {
    const now = Date.now();
    const last = lastWarnAtByKey.get(key) || 0;
    if (now - last < WARN_THROTTLE_MS) return;
    lastWarnAtByKey.set(key, now);
    console.warn(message, ...args);
}

function extraBodyScope(extraBody?: Record<string, unknown>): string {
    if (!extraBody || typeof extraBody !== "object") return "";
    const entries = Object.entries(extraBody)
        .filter(([_, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b));
    if (entries.length === 0) return "";
    return entries
        .map(([k, v]) => `${k}:${String(v)}`)
        .join("|");
}

function canUseStorage(): boolean {
    return typeof window !== 'undefined';
}

function makeAccountScope(exchange: string, apiKey?: string, secret?: string): string {
    const k = String(apiKey || "").slice(-8) || "nokey";
    const s = String(secret || "").slice(-6) || "nosecret";
    return `${exchange}:${k}:${s}`;
}

function cacheKey(kind: string, scope: string): string {
    return `${CACHE_PREFIX}:${kind}:${scope}`;
}

function readCache<T>(kind: string, scope: string): T | null {
    if (!canUseStorage()) return null;
    try {
        const raw = localStorage.getItem(cacheKey(kind, scope));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { at: number; data: T };
        if (!parsed || typeof parsed.at !== 'number') return null;
        if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
        return parsed.data;
    } catch {
        return null;
    }
}

function writeCache<T>(kind: string, scope: string, data: T): void {
    if (!canUseStorage()) return;
    try {
        localStorage.setItem(cacheKey(kind, scope), JSON.stringify({ at: Date.now(), data }));
    } catch {
        // ignore
    }
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
    const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Start the API server (npm run api-server) for CEX.')), timeoutMs)
    );
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await Promise.race([
            fetch(url, { ...options, signal: ctrl.signal }),
            timeoutPromise
        ]);
        clearTimeout(id);
        return res;
    } catch (e) {
        clearTimeout(id);
        if ((e as Error)?.message?.includes('timed out')) throw e;
        if ((e as Error)?.name === 'AbortError') throw new Error('Request timed out. Start the API server (npm run api-server) for CEX.');
        throw e;
    }
}

/**
 * Helper to fetch CEX data via the local proxy if needed.
 * This bypasses CORS in the browser by routing through our Next.js API.
 */
async function fetchCexApi(
    path: string,
    exchangeId: string,
    apiKey: string,
    secret: string,
    extraBody?: Record<string, unknown>
): Promise<Response> {
    const scope = extraBodyScope(extraBody);
    const accountScope = makeAccountScope(exchangeId, apiKey, secret);
    const cooldownKey = scope ? `${accountScope}:${path}:${scope}` : `${accountScope}:${path}`;
    const unavailableUntil = apiUnavailableUntilByKey.get(cooldownKey) || 0;
    if (Date.now() < unavailableUntil) {
        throw new Error(`CEX API temporarily unavailable (${exchangeId})`);
    }
    if (Date.now() < apiServerUnavailableUntil) {
        throw new Error(`CEX API server unavailable (${exchangeId}). Start api-server and retry.`);
    }
    const url = apiUrl(path);
    const canUseNextProxy = typeof window !== 'undefined';

    const isRetryableStatus = (status: number) => status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
    const isMissingRouteStatus = (status: number) => status === 404 || status === 405;
    const shouldRetryBybit = (status?: number, error?: unknown) => {
        if (exchangeId !== 'bybit') return false;
        if (typeof status === 'number') return isRetryableStatus(status);
        const msg = String((error as Error)?.message || '');
        return /timed out|network|fetch failed|unavailable|ECONN|503|504|429/i.test(msg);
    };

    // In Next.js browser runtime, prefer same-origin API route first.
    // This avoids direct-browser CORS/network failures against 127.0.0.1.
    if (canUseNextProxy) {
        try {
            const nextRouteResponse = await fetch(path, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ exchangeId, exchange: exchangeId, apiKey, secret, ...(extraBody || {}) })
            });
            if (nextRouteResponse.ok) return nextRouteResponse;
            if (shouldRetryBybit(nextRouteResponse.status)) {
                await new Promise((r) => setTimeout(r, 450));
                const retry = await fetch(path, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ exchangeId, exchange: exchangeId, apiKey, secret, ...(extraBody || {}) })
                });
                if (retry.ok) return retry;
                if (retry.status >= 500) return retry;
            }
            if (nextRouteResponse.status === 502 || nextRouteResponse.status === 503 || nextRouteResponse.status === 504) {
                apiUnavailableUntilByKey.set(cooldownKey, Date.now() + API_COOLDOWN_MS);
                markApiServerUnavailable();
            }
            // If backend returned structured error, surface it directly.
            if (nextRouteResponse.status >= 500) return nextRouteResponse;
        } catch (e) {
            if (shouldRetryBybit(undefined, e)) {
                try {
                    await new Promise((r) => setTimeout(r, 500));
                    const retry = await fetch(path, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ exchangeId, exchange: exchangeId, apiKey, secret, ...(extraBody || {}) })
                    });
                    if (retry.ok) return retry;
                } catch {
                    // fall through to proxy path
                }
            }
            apiUnavailableUntilByKey.set(cooldownKey, Date.now() + API_COOLDOWN_MS);
            markApiServerUnavailable();
            warnThrottled(`next:${path}`, `[CEX NextRoute] ${path} failed, trying /api/proxy fallback:`, e);
        }

        try {
            const proxyResponse = await fetch('/api/proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: url.startsWith('http') ? url : `${LOCAL_API_BASE}${url.startsWith('/') ? '' : '/'}${url}`,
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: { exchangeId, exchange: exchangeId, apiKey, secret, ...(extraBody || {}) }
                })
            });
            if (proxyResponse.ok) return proxyResponse;
            // In static export/runtime without Next API routes, /api/proxy can be 404.
            // Fall through to direct standalone API server fetch in that case.
            if (isMissingRouteStatus(proxyResponse.status)) {
                warnThrottled(`proxy:${path}`, `[CEX Proxy] /api/proxy unavailable (${proxyResponse.status}), using direct API server for ${path}`);
            } else {
                if (proxyResponse.status === 502 || proxyResponse.status === 503 || proxyResponse.status === 504) {
                    apiUnavailableUntilByKey.set(cooldownKey, Date.now() + API_COOLDOWN_MS);
                    markApiServerUnavailable();
                }
                return proxyResponse;
            }
        } catch (_e) {
            apiUnavailableUntilByKey.set(cooldownKey, Date.now() + API_COOLDOWN_MS);
            markApiServerUnavailable();
            throw new Error(`CEX API unreachable. Start API server: npm run api-server (${exchangeId})`);
        }
    }

    // Direct fetch (server-side, or fallback in browser)
    try {
        const response = await fetchWithTimeout(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ exchangeId, exchange: exchangeId, apiKey, secret, ...(extraBody || {}) })
        }, CEX_FETCH_TIMEOUT_MS);
        if (!response.ok && (response.status === 502 || response.status === 503 || response.status === 504)) {
            apiUnavailableUntilByKey.set(cooldownKey, Date.now() + API_COOLDOWN_MS);
            markApiServerUnavailable();
        }
        return response;
    } catch (e) {
        apiUnavailableUntilByKey.set(cooldownKey, Date.now() + API_COOLDOWN_MS);
        markApiServerUnavailable();
        throw e;
    }
}

/** Fetch CEX balance; proxies through server to bypass browser CORS blocks on 127.0.0.1. */
export async function fetchCexBalance(exchangeId: string, apiKey: string, secret: string): Promise<{ symbol: string; balance: number }[]> {
    const scope = makeAccountScope(exchangeId, apiKey, secret);
    const cached = readCache<{ symbol: string; balance: number }[]>('balance', scope);
    try {
        const response = await fetchCexApi('/api/cex/balance', exchangeId, apiKey, secret);
        if (!response.ok) {
            let errMsg = `HTTP ${response.status}`;
            try {
                const errBody = await response.json();
                errMsg = (errBody && errBody.error) || errMsg;
            } catch {
                const text = await response.text();
                if (text && text.length < 200) errMsg = text;
            }
            if (cached) return cached;
            throw new Error(errMsg);
        }
        const rawBalance = await response.json().catch(() => ({}));
        const normalized = normalizeCexBalance(rawBalance);
        if (normalized.length > 0) {
            writeCache('balance', scope, normalized);
        } else if (cached) {
            return cached;
        }
        return normalized;
    } catch (e) {
        // Non-fatal in UI: upstream caller handles this and shows per-connection status/retry.
        warnThrottled(`balance:${exchangeId}`, `[CEX Balance] ${exchangeId} unavailable:`, (e as Error).message);
        if (cached) return cached;
        throw e;
    }
}

/** Bybit-only: fetch balances for a specific account type (spot, unified, swap/contract, funding). */
export async function fetchBybitBalanceByType(
    accountType: 'spot' | 'unified' | 'swap' | 'contract' | 'funding' | 'fund',
    apiKey: string,
    secret: string
): Promise<{ symbol: string; balance: number }[]> {
    const cacheId = `${makeAccountScope('bybit', apiKey, secret)}:${accountType}:${BYBIT_TYPED_BALANCE_CACHE_VERSION}`;
    const cached = readCache<{ symbol: string; balance: number }[]>('balance_by_type', cacheId);
    try {
        const res = await fetchCexApi('/api/cex/balance', 'bybit', apiKey, secret, { accountType });
        if (!res.ok) {
            let errMsg = `HTTP ${res.status}`;
            try {
                const errBody = await res.json();
                errMsg = (errBody && errBody.error) || errMsg;
            } catch {
                const text = await res.text();
                if (text && text.length < 200) errMsg = text;
            }
            if (cached) return cached;
            throw new Error(errMsg);
        }
        const rawBalance = await res.json().catch(() => ({}));
        const normalized = normalizeCexBalance(rawBalance);
        if (normalized.length > 0) {
            writeCache('balance_by_type', cacheId, normalized);
        } else if (cached) {
            return cached;
        }
        return normalized;
    } catch (e) {
        warnThrottled(`bybit-balance:${accountType}`, `[Bybit Balance:${accountType}] unavailable:`, (e as Error).message);
        if (cached) return cached;
        throw e;
    }
}

/** Parse Bybit list[].coin[] (wallet-balance) or result.balance[] (asset/coins-balance) into { symbol, balance }[] */
function parseBybitRawBalance(raw: any): { symbol: string; balance: number }[] {
    const bySymbol: Record<string, number> = {};
    const addBalance = (sym: string, val: number) => {
        if (!sym || !Number.isFinite(val) || val === 0) return;
        bySymbol[sym] = (bySymbol[sym] ?? 0) + val;
    };
    const parseCoinValue = (row: any): number => {
        const wallet = parseFloat(row?.walletBalance ?? row?.wallet_balance ?? 0) || 0;
        if (wallet > 0) return wallet;
        const equity = parseFloat(row?.equity ?? 0) || 0;
        if (equity > 0) return equity;
        const free = parseFloat(row?.free ?? row?.availableBalance ?? row?.availableToWithdraw ?? row?.available_to_withdraw ?? 0) || 0;
        const locked = parseFloat(row?.locked ?? row?.frozenBalance ?? 0) || 0;
        if (free > 0 || locked > 0) return free + locked;
        return 0;
    };

    // 1) Asset endpoint: result.balance = [{ coin, walletBalance, equity ... }]
    const balanceArray = raw?.result?.balance ?? raw?.balance;
    if (Array.isArray(balanceArray)) {
        for (const b of balanceArray) {
            const sym = b?.coin;
            if (!sym) continue;
            const val = parseCoinValue(b);
            addBalance(sym, val);
        }
    }

    // 2) Wallet-balance endpoint: result.list[].coin[]
    const list = raw?.result?.list ?? raw?.list;
    if (Array.isArray(list)) {
        for (const acc of list) {
            const coins = acc?.coin;
            if (Array.isArray(coins)) {
                for (const c of coins) {
                    const sym = c?.coin;
                    if (!sym) continue;
                    const val = parseCoinValue(c);
                    addBalance(sym, val);
                }
            }
            // Some Bybit account responses expose only account-level totals without coin rows.
            // Keep these totals as quote-equivalent to prevent false zero balances.
            const accountTotal =
                parseFloat(acc?.totalWalletBalance ?? acc?.totalEquity ?? 0) || 0;
            if (accountTotal > 0 && (!Array.isArray(coins) || coins.length === 0)) {
                const inferredQuote = String(acc?.accountType || '').toUpperCase() === 'UNIFIED' ? 'USDT' : 'USDC';
                addBalance(inferredQuote, accountTotal);
            }
        }
    }

    return Object.entries(bySymbol).map(([symbol, balance]) => ({ symbol, balance }));
}

export function normalizeCexBalance(ccxtBalance: any): { symbol: string, balance: number }[] {
    const balances: { symbol: string, balance: number }[] = [];

    if (!ccxtBalance || typeof ccxtBalance !== 'object') return balances;

    // (Custom Bybit raw parsing was removed to fully support CCXT's native standardized .total parsing)

    const total = ccxtBalance.total || {};

    if (Object.keys(total).length === 0 && ccxtBalance.free && ccxtBalance.used) {
        const free = ccxtBalance.free || {};
        const used = ccxtBalance.used || {};
        const allSymbols = new Set([...Object.keys(free), ...Object.keys(used)]);
        allSymbols.forEach(symbol => {
            const freeAmount = typeof free[symbol] === 'string' ? parseFloat(free[symbol]) : (free[symbol] || 0);
            const usedAmount = typeof used[symbol] === 'string' ? parseFloat(used[symbol]) : (used[symbol] || 0);
            (total as Record<string, number>)[symbol] = freeAmount + usedAmount;
        });
    }

    Object.entries(total).forEach(([symbol, balance]) => {
        const b = typeof balance === 'string' ? parseFloat(balance) : (balance as number);
        if (b > 0) {
            balances.push({ symbol, balance: b });
        }
    });

    return balances;
}

export interface CexTransfer {
    id: string;
    type: 'Deposit' | 'Withdraw';
    asset: string;
    symbol?: string;
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
    feeAsset?: string;
    feeUsd?: number;
    info?: Record<string, unknown>;
    sourceType?: 'cex' | 'dex' | 'wallet' | 'manual';
}

export async function fetchCexTransfers(
    exchange: 'binance' | 'bybit' | 'hyperliquid',
    apiKey: string,
    apiSecret: string
): Promise<CexTransfer[]> {
    const cached = readCache<CexTransfer[]>('transfers', exchange);
    try {
        const response = await fetchCexApi('/api/cex/transfers', exchange, apiKey, apiSecret);
        if (!response.ok) return cached || [];
        const data = await response.json();
        const transfers = data.transfers || [];
        writeCache('transfers', exchange, transfers);
        return transfers;
    } catch (e) {
        warnThrottled("transfers", "Transfers Fetch Error", e);
        return cached || [];
    }
}

export async function fetchCexTrades(
    exchange: 'binance' | 'bybit',
    apiKey: string,
    apiSecret: string
) {
    const cached = readCache<any[]>('trades', exchange);
    try {
        const response = await fetchCexApi('/api/cex/trades', exchange, apiKey, apiSecret);
        if (!response.ok) return cached || [];
        const data = await response.json();
        const trades = data.trades || [];
        writeCache('trades', exchange, trades);
        return trades;
    } catch (e) {
        warnThrottled("trades", "Trades Fetch Error", e);
        return cached || [];
    }
}

export async function fetchCexOpenOrders(
    exchange: 'binance' | 'bybit' | 'okx',
    apiKey: string,
    apiSecret: string
) {
    const cached = readCache<any[]>('open_orders', exchange);
    try {
        const response = await fetchCexApi('/api/cex/open-orders', exchange, apiKey, apiSecret);
        if (!response.ok) return cached || [];
        const data = await response.json();
        const orders = data.orders || [];
        writeCache('open_orders', exchange, orders);
        return orders;
    } catch (e) {
        warnThrottled("open-orders", "Open Orders Fetch Error", e);
        return cached || [];
    }
}

/** Position shape expected by updatePositions (symbol, size, entryPrice, markPrice, pnl, side, leverage, liquidationPrice) */
export interface CexPosition {
    symbol: string;
    size: number;
    entryPrice: number;
    markPrice: number;
    pnl: number;
    side: 'long' | 'short';
    leverage: number;
    liquidationPrice: number;
}

export async function fetchCexPositions(
    exchangeId: 'binance' | 'bybit',
    apiKey: string,
    secret: string
): Promise<CexPosition[]> {
    const cached = readCache<CexPosition[]>('positions', exchangeId);
    try {
        const response = await fetchCexApi('/api/cex/positions', exchangeId, apiKey, secret);
        if (!response.ok) return cached || [];
        const data = await response.json().catch(() => ({}));
        const rawList = data.positions || [];
        const parsed = rawList.map((p: any) => ({
            symbol: normalizeSymbol(p.symbol),
            size: Math.abs(parseFloat(p.size ?? p.positionAmt ?? '0')),
            entryPrice: parseFloat(p.entryPrice ?? '0'),
            markPrice: parseFloat(p.markPrice ?? '0'),
            pnl: parseFloat(p.unrealizedProfit ?? '0'),
            side: (p.side ?? (parseFloat(p.positionAmt ?? '0') >= 0 ? 'long' : 'short')) as 'long' | 'short',
            leverage: parseInt(String(p.leverage ?? '1'), 10) || 1,
            liquidationPrice: parseFloat(p.liquidationPrice ?? '0'),
        }));
        writeCache('positions', exchangeId, parsed);
        return parsed;
    } catch (e) {
        warnThrottled(`positions:${exchangeId}`, `[CEX Positions] ${exchangeId} failed:`, e);
        return cached || [];
    }
}
