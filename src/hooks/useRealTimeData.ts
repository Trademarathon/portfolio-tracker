"use client";

import { useEffect, useRef, useCallback } from 'react';
import { PortfolioConnection } from '@/lib/api/types';
import { apiFetch } from '@/lib/api/client';
import { getChainPortfolio } from '@/lib/api/wallet';
import { getZerionFullPortfolio } from '@/lib/api/zerion';
import { normalizeSymbol } from '@/lib/utils/normalization';
import { normalizeHyperliquidOpenOrders } from '@/lib/api/hyperliquid';
import { fetchBybitBalanceByType, fetchCexBalance, normalizeCexBalance } from '@/lib/api/cex';

// Rate limit tracking per exchange
interface RateLimitState {
    used: number;
    max: number;
    resetAt: number;
}

interface RateLimits {
    binance: RateLimitState;
    bybit: RateLimitState;
    hyperliquid: RateLimitState;
    okx: RateLimitState;
}

// Polling intervals in milliseconds - AGGRESSIVE MODE
// When tab is hidden (visibilityState), we use 2-3x longer intervals to save CPU/network
export const POLL_INTERVALS = {
    POSITIONS: 5000,    // 5s - stable default for desktop renderer
    BALANCES: 8000,     // 8s - reduce polling pressure
    ORDERS: 20000,      // 20s - avoid churn/flicker
    TRADES: 15000,      // 15s - optional in stable mode
    WALLET: 10000,      // 10s - Wallet transactions
    HISTORY: 15000,     // 15s - Historical data
};

// Visibility multiplier: when tab is hidden, poll less frequently
const VISIBILITY_HIDDEN_MULTIPLIER = 3;

function getEffectiveInterval(baseMs: number): number {
    if (typeof document === 'undefined') return baseMs;
    return document.visibilityState === 'hidden' ? baseMs * VISIBILITY_HIDDEN_MULTIPLIER : baseMs;
}

// API weights for rate limit tracking
const API_WEIGHTS: Record<string, { balance: number; positions: number; openOrders: number; fills: number }> = {
    binance: {
        balance: 10,
        positions: 5,
        openOrders: 3,
        fills: 10,
    },
    bybit: {
        balance: 1,
        positions: 1,
        openOrders: 1,
        fills: 5,
    },
    hyperliquid: {
        balance: 1,
        positions: 1,
        openOrders: 1,
        fills: 20,
    },
    okx: {
        balance: 1,
        positions: 1,
        openOrders: 1,
        fills: 5,
    },
};

// Initial rate limits
const INITIAL_RATE_LIMITS: RateLimits = {
    binance: { used: 0, max: 6000, resetAt: 0 },
    bybit: { used: 0, max: 1200, resetAt: 0 },
    hyperliquid: { used: 0, max: 1200, resetAt: 0 },
    okx: { used: 0, max: 1200, resetAt: 0 },
};

interface UseRealTimeDataOptions {
    connections: PortfolioConnection[];
    onBalanceUpdate: (connectionId: string, balances: any[]) => void;
    onPositionUpdate: (connectionId: string, positions: any[]) => void;
    onOrderUpdate: (connectionId: string, orders: any[]) => void;
    onTradeUpdate: (connectionId: string, trades: any[]) => void;

    enabled?: boolean;
    pollTrades?: boolean;
    pollWallets?: boolean;
}

export function useRealTimeData(options: UseRealTimeDataOptions) {
    const {
        connections,
        onBalanceUpdate,
        onPositionUpdate,
        onOrderUpdate,
        onTradeUpdate,
        enabled = true,
        pollTrades = false,
        pollWallets = false,
    } = options;

    const rateLimitsRef = useRef<RateLimits>({ ...INITIAL_RATE_LIMITS });
    const intervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
    const triggerImmediateRef = useRef<(() => Promise<void>) | null>(null);

    // USE REFS for callbacks to avoid dependency issues
    const onBalanceUpdateRef = useRef(onBalanceUpdate);
    const onPositionUpdateRef = useRef(onPositionUpdate);
    const onOrderUpdateRef = useRef(onOrderUpdate);
    const onTradeUpdateRef = useRef(onTradeUpdate);
    const isWalletLikeConnection = useCallback((conn: PortfolioConnection) => {
        return !!conn.walletAddress && (
            conn.type === 'wallet' ||
            conn.type === 'evm' ||
            conn.type === 'solana' ||
            conn.type === 'aptos' ||
            conn.type === 'ton' ||
            conn.type === 'zerion' ||
            !!conn.hardwareType
        );
    }, []);

    // Keep refs updated
    useEffect(() => {
        onBalanceUpdateRef.current = onBalanceUpdate;
        onPositionUpdateRef.current = onPositionUpdate;
        onOrderUpdateRef.current = onOrderUpdate;
        onTradeUpdateRef.current = onTradeUpdate;
    }, [onBalanceUpdate, onPositionUpdate, onOrderUpdate, onTradeUpdate]);

    // Reset rate limits every minute
    useEffect(() => {
        const resetInterval = setInterval(() => {
            const now = Date.now();
            Object.keys(rateLimitsRef.current).forEach((exchange) => {
                const key = exchange as keyof RateLimits;
                if (now >= rateLimitsRef.current[key].resetAt) {
                    rateLimitsRef.current[key].used = 0;
                    rateLimitsRef.current[key].resetAt = now + 60000;
                }
            });
        }, 5000);

        return () => clearInterval(resetInterval);
    }, []);

    // Check if we can make a request (rate limit check)
    const canMakeRequest = (exchange: keyof RateLimits, weight: number): boolean => {
        const limit = rateLimitsRef.current[exchange];
        const remaining = limit.max - limit.used;
        if (remaining >= weight) {
            rateLimitsRef.current[exchange].used += weight;
            return true;
        }
        console.warn(`[RealTime] Rate limit approaching for ${exchange}: ${limit.used}/${limit.max}`);
        return false;
    };

    // Start polling for all connections
    useEffect(() => {
        if (!enabled || connections.length === 0) {
            console.log('[RealTime] Polling disabled or no connections');
            return;
        }

        const isDev = process.env.NODE_ENV !== 'production';
        if (isDev) {
            console.log('[RealTime] Starting polling for', connections.length, 'connections');
        }

        // Clear existing intervals
        intervalsRef.current.forEach((interval) => clearInterval(interval));
        intervalsRef.current.clear();

        // Fetch functions (inline to avoid dependency issues)
        const fetchBalances = async (conn: PortfolioConnection) => {
            if (!conn.enabled) return;
            const timeoutMs = 8000;

            try {
                let balances: any[] = [];

                if (conn.type === 'bybit' && conn.apiKey && conn.secret) {
                    const exchange = conn.type as keyof RateLimits;
                    const weight = API_WEIGHTS[exchange]?.balance ?? 1;
                    if (!canMakeRequest(exchange, weight)) return;

                    const stables = new Set(['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'USDE']);
                    const attemptErrors: string[] = [];
                    let typedAttempts = 0;
                    let typedFailures = 0;
                    let mergedFailed = false;
                    const normalizeBybitRows = (rows: Array<{ symbol: string; balance: number }>, subType: 'Spot' | 'Perp') =>
                        rows
                            .map((row) => ({
                                symbol: normalizeSymbol(row.symbol),
                                balance: Number(row.balance) || 0,
                                _subType: subType,
                            }))
                            .filter((row) => row.symbol && row.balance > 0);
                    const byTypeSafe = async (accountType: 'spot' | 'unified' | 'swap' | 'contract' | 'funding' | 'fund') => {
                        typedAttempts += 1;
                        try {
                            return await fetchBybitBalanceByType(accountType, conn.apiKey!, conn.secret!);
                        } catch (e) {
                            typedFailures += 1;
                            const message = e instanceof Error ? e.message : String(e);
                            attemptErrors.push(`${accountType}: ${message}`);
                            return [] as { symbol: string; balance: number }[];
                        }
                    };

                    const spotBalances = await byTypeSafe('spot');

                    if (spotBalances.length > 0) {
                        balances.push(...normalizeBybitRows(spotBalances, 'Spot'));

                        let perpBalances = await byTypeSafe('swap');
                        if (perpBalances.length === 0) {
                            perpBalances = await byTypeSafe('contract');
                        }

                        if (perpBalances.length > 0) {
                            const stableOnly = perpBalances.filter((b) => stables.has(normalizeSymbol(b.symbol)));
                            if (stableOnly.length > 0) {
                                balances.push(...normalizeBybitRows(stableOnly, 'Perp'));
                            }
                        }
                    } else {
                        const unifiedBalances = await byTypeSafe('unified');
                        if (unifiedBalances.length > 0) {
                            balances.push(...normalizeBybitRows(unifiedBalances, 'Spot'));
                        } else {
                            const fundingBalances = await byTypeSafe('funding');
                            if (fundingBalances.length > 0) {
                                balances.push(...normalizeBybitRows(fundingBalances, 'Spot'));
                            }
                        }
                    }

                    if (balances.length === 0) {
                        const merged = await fetchCexBalance('bybit', conn.apiKey, conn.secret).catch((e) => {
                            mergedFailed = true;
                            const message = e instanceof Error ? e.message : String(e);
                            attemptErrors.push(`merged: ${message}`);
                            return [];
                        });
                        if (merged.length > 0) {
                            balances.push(...normalizeBybitRows(merged, 'Spot'));
                        }
                    }

                    const allTypedFailed = typedAttempts > 0 && typedFailures >= typedAttempts;
                    if (balances.length === 0 && allTypedFailed && mergedFailed) {
                        throw new Error(`Bybit polling balance failed (${attemptErrors.join(' | ')})`);
                    }
                } else if (conn.type === 'binance' && conn.apiKey && conn.secret) {
                    const exchange = conn.type as keyof RateLimits;
                    const weight = API_WEIGHTS[exchange]?.balance ?? 1;
                    if (!canMakeRequest(exchange, weight)) return;
                    const ctrl = new AbortController();
                    const t = setTimeout(() => ctrl.abort(), timeoutMs);
                    try {
                        const res = await apiFetch('/api/cex/balance', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ exchangeId: conn.type, apiKey: conn.apiKey, secret: conn.secret }),
                            signal: ctrl.signal,
                        }, timeoutMs);
                        clearTimeout(t);
                        const raw = await res.json().catch(() => ({}));
                        if (res.ok && raw && typeof raw === 'object') {
                            const normalized = normalizeCexBalance(raw);
                            balances = Array.isArray(normalized) ? normalized : [];
                        }
                    } catch (_) {
                        clearTimeout(t);
                    }
                } else if (conn.type === 'hyperliquid' && conn.walletAddress) {
                    const exchange = conn.type as keyof RateLimits;
                    if (API_WEIGHTS[exchange] && !canMakeRequest(exchange, API_WEIGHTS[exchange].balance)) return;
                    const res = await fetch('https://api.hyperliquid.xyz/info', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'spotClearinghouseState', user: conn.walletAddress }),
                    });
                    if (res.ok) {
                        const data = await res.json();
                        balances = (data.balances || []).map((b: any) => ({
                            symbol: normalizeSymbol(b.coin),
                            balance: parseFloat(b.total),
                        }));
                    }
                } else if (isWalletLikeConnection(conn)) {
                    const walletAddress = conn.walletAddress!;
                    const chain = conn.chain || (conn.type === 'solana' ? 'SOL' : 'ETH');
                    if (conn.type === 'zerion') {
                        const p = await getZerionFullPortfolio(walletAddress);
                        (p.tokens || []).forEach((t) => {
                            if (t.symbol && t.balance > 0) balances.push({ symbol: normalizeSymbol(t.symbol), balance: t.balance });
                        });
                    } else {
                        const chainKey = (conn.type === 'solana' || chain === 'SOL' ? 'SOL' : chain) as string;
                        let list: any[] = [];
                        try {
                            const res = await apiFetch(`/api/wallet/portfolio?address=${encodeURIComponent(walletAddress)}&chain=${encodeURIComponent(chainKey)}`, {}, timeoutMs);
                            if (res.ok) {
                                const data = await res.json();
                                if (Array.isArray(data)) list = data;
                            }
                        } catch {
                            // fallback below
                        }
                        if (list.length === 0) {
                            list = await getChainPortfolio(walletAddress, chainKey as any);
                        }
                        list.forEach((b) => {
                            if (b.symbol && b.balance > 0) balances.push({ symbol: normalizeSymbol(b.symbol), balance: b.balance });
                        });
                    }
                }

                if (balances.length > 0) {
                    onBalanceUpdateRef.current(conn.id, balances);
                }
            } catch (e) {
                if (isDev) console.warn(`[RealTime] Balance failed for ${conn.name}:`, e);
            }
        };

        const fetchPositions = async (conn: PortfolioConnection) => {
            if (!conn.enabled) return;
            const exchange = conn.type as keyof RateLimits;
            if (!API_WEIGHTS[exchange]) return;

            const weight = API_WEIGHTS[exchange].positions;
            if (!canMakeRequest(exchange, weight)) return;

            try {
                let positions: any[] = [];
                let didFetchPositions = false;

                if (conn.type === 'hyperliquid' && conn.walletAddress) {
                    const res = await fetch('https://api.hyperliquid.xyz/info', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'clearinghouseState', user: conn.walletAddress }),
                    });
                    if (res.ok) {
                        const data = await res.json();
                        positions = (data.assetPositions || [])
                            .filter((ap: any) => parseFloat(ap.position?.szi || '0') !== 0)
                            .map((ap: any) => ({
                                symbol: normalizeSymbol(ap.position.coin),
                                size: parseFloat(ap.position.szi),
                                entryPrice: parseFloat(ap.position.entryPx),
                                markPrice: parseFloat(ap.position.positionValue) / Math.abs(parseFloat(ap.position.szi)) || 0,
                                pnl: parseFloat(ap.position.unrealizedPnl),
                                side: parseFloat(ap.position.szi) > 0 ? 'long' : 'short',
                                leverage: ap.position.leverage?.value || 1,
                                liquidationPrice: parseFloat(ap.position.liquidationPx) || 0,
                            }));
                        didFetchPositions = true;

                        // Also update perp collateral (USDC) for Hyperliquid
                        const accountValue = [
                            data?.marginSummary?.accountValue,
                            data?.crossMarginSummary?.accountValue,
                            data?.withdrawable,
                            data?.accountValue,
                            data?.totalAccountValue,
                            data?.userState?.accountValue,
                        ]
                            .map((v: any) => parseFloat(String(v ?? "0")) || 0)
                            .find((v: number) => v > 0) || 0;
                        if (accountValue > 0) {
                            onBalanceUpdateRef.current(conn.id, [{ symbol: 'USDC', balance: accountValue, _subType: 'Perp' }]);
                        }
                    }
                } else if ((conn.type === 'bybit' || conn.type === 'binance') && conn.apiKey && conn.secret) {
                    const timeoutMs = 8000;
                    const ctrl = new AbortController();
                    const t = setTimeout(() => ctrl.abort(), timeoutMs);
                    try {
                        const res = await apiFetch('/api/cex/positions', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ exchangeId: conn.type, apiKey: conn.apiKey, secret: conn.secret }),
                            signal: ctrl.signal,
                        }, timeoutMs);
                        clearTimeout(t);
                        if (res.ok) {
                            const data = await res.json();
                            const rawList = data.positions || [];
                            positions = rawList.map((p: any) => ({
                                symbol: normalizeSymbol(p.symbol),
                                size: Math.abs(parseFloat(p.size || p.positionAmt || '0')),
                                entryPrice: parseFloat(p.entryPrice || '0'),
                                markPrice: parseFloat(p.markPrice || '0'),
                                pnl: parseFloat(p.unrealizedProfit || '0'),
                                side: (p.side || (parseFloat(p.positionAmt || '0') >= 0 ? 'long' : 'short')) as 'long' | 'short',
                                leverage: parseInt(p.leverage || '1', 10) || 1,
                                liquidationPrice: parseFloat(p.liquidationPrice || '0'),
                            }));
                            didFetchPositions = true;
                        }
                    } catch (_) {
                        clearTimeout(t);
                    }
                }

                if (didFetchPositions) {
                    onPositionUpdateRef.current(conn.id, positions);
                }
            } catch (e) {
                if (isDev) console.warn(`[RealTime] Position failed for ${conn.name}:`, e);
            }
        };

        const fetchOrders = async (conn: PortfolioConnection) => {
            if (!conn.enabled) return;
            const exchange = conn.type as keyof RateLimits;
            if (!API_WEIGHTS[exchange]) return;

            const weight = API_WEIGHTS[exchange].openOrders;
            if (!canMakeRequest(exchange, weight)) return;

            try {
                let orders: any[] = [];
                let didFetch = false;

                if ((conn.type === 'binance' || conn.type === 'bybit' || conn.type === 'okx') && conn.apiKey && conn.secret) {
                    const timeoutMs = 8000;
                    const ctrl = new AbortController();
                    const t = setTimeout(() => ctrl.abort(), timeoutMs);
                    try {
                        const res = await apiFetch('/api/cex/open-orders', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ exchangeId: conn.type, apiKey: conn.apiKey, secret: conn.secret }),
                            signal: ctrl.signal,
                        }, timeoutMs);
                        clearTimeout(t);
                        if (res.ok) {
                            const data = await res.json();
                            orders = data.orders || [];
                            didFetch = true;
                        }
                    } catch (_) {
                        clearTimeout(t);
                    }
                } else if (conn.type === 'hyperliquid' && conn.walletAddress) {
                    const res = await fetch('https://api.hyperliquid.xyz/info', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'openOrders', user: conn.walletAddress }),
                    });
                    if (res.ok) {
                        const raw = await res.json();
                        orders = normalizeHyperliquidOpenOrders(raw, conn.name);
                        didFetch = true;
                    }
                }

                // IMPORTANT: only push updates when we successfully fetched.
                // This prevents UI flicker/"disconnect" feel when an API call fails and returns empty.
                if (didFetch) {
                    onOrderUpdateRef.current(conn.id, orders);
                }
            } catch (e) {
                if (isDev) console.warn(`[RealTime] Order failed for ${conn.name}:`, e);
            }
        };

        const fetchTrades = async (conn: PortfolioConnection) => {
            if (!conn.enabled) return;
            const exchange = conn.type as keyof RateLimits;
            if (!API_WEIGHTS[exchange]) return;

            const weight = API_WEIGHTS[exchange].fills;
            if (!canMakeRequest(exchange, weight)) return;

            try {
                let trades: any[] = [];

                if ((conn.type === 'binance' || conn.type === 'bybit') && conn.apiKey && conn.secret) {
                    const timeoutMs = 8000;
                    const ctrl = new AbortController();
                    const t = setTimeout(() => ctrl.abort(), timeoutMs);
                    try {
                        const res = await apiFetch('/api/cex/trades', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ exchange: conn.type, apiKey: conn.apiKey, secret: conn.secret }),
                            signal: ctrl.signal,
                        }, timeoutMs);
                        clearTimeout(t);
                        if (res.ok) {
                            const data = await res.json();
                            trades = data.trades || [];
                        }
                    } catch (_) {
                        clearTimeout(t);
                    }
                } else if (conn.type === 'hyperliquid' && conn.walletAddress) {
                    const res = await fetch('https://api.hyperliquid.xyz/info', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'userFills', user: conn.walletAddress }),
                    });
                    if (res.ok) {
                        const fills = await res.json();
                        // Normalize Hyperliquid fills to match other exchanges
                        trades = fills.slice(0, 100).map((f: any) => ({
                            id: f.hash || `${f.tid}`,
                            timestamp: f.time,
                            symbol: normalizeSymbol(f.coin),
                            side: (f.side === 'B' || f.dir?.toLowerCase().includes('long')) ? 'buy' : 'sell',
                            price: parseFloat(f.px),
                            amount: parseFloat(f.sz),
                            pnl: parseFloat(f.closedPnl || '0'),
                            fee: parseFloat(f.fee || '0'),
                            feeCurrency: f.feeToken || 'USDC',
                            exchange: 'Hyperliquid',
                            takerOrMaker: f.crossed ? 'taker' : 'maker',
                        }));
                    }
                }

                if (trades.length > 0) {
                    onTradeUpdateRef.current(conn.id, trades);
                }
            } catch (e) {
                if (isDev) console.warn(`[RealTime] Trades failed for ${conn.name}:`, e);
            }
        };

        // One-cycle refresh for all connections (used when tab becomes visible)
        const runImmediate = async () => {
            const cexConn = connections.filter(c => c.enabled && ['binance', 'bybit', 'hyperliquid', 'okx'].includes(c.type));
            const walletConn = connections.filter(c => c.enabled && isWalletLikeConnection(c));
            for (const conn of cexConn) {
                await fetchPositions(conn);
                await fetchBalances(conn);
                await fetchOrders(conn);
            }
            for (const conn of walletConn) {
                await fetchBalances(conn);
            }
        };
        triggerImmediateRef.current = runImmediate;

        // Visibility-aware polling: use longer intervals when tab is hidden
        const schedulePoll = (key: string, fn: () => void, baseMs: number) => {
            const run = () => {
                const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
                if (!hidden) {
                    fn();
                }
                const nextMs = getEffectiveInterval(baseMs);
                const t = setTimeout(() => run(), nextMs);
                intervalsRef.current.set(key, t);
            };
            run();
        };

        const WALLET_POLL_MS = 15000; // 15s for wallet/ledger to avoid hammering portfolio API

        // Setup polling for CEX connections
        connections.forEach((conn) => {
            if (!conn.enabled) return;

            const isExchange = ['binance', 'bybit', 'hyperliquid', 'okx'].includes(conn.type);
            if (isExchange) {
                if (isDev) console.log(`[RealTime] Setting up polling for ${conn.name} (${conn.type})`);
                schedulePoll(`${conn.id}-positions`, () => fetchPositions(conn), POLL_INTERVALS.POSITIONS);
                schedulePoll(`${conn.id}-balances`, () => fetchBalances(conn), POLL_INTERVALS.BALANCES);
                schedulePoll(`${conn.id}-orders`, () => fetchOrders(conn), POLL_INTERVALS.ORDERS);
                if (pollTrades) {
                    schedulePoll(`${conn.id}-trades`, () => fetchTrades(conn), POLL_INTERVALS.TRADES);
                }
                setTimeout(() => fetchPositions(conn), 100);
                setTimeout(() => fetchBalances(conn), 500);
                setTimeout(() => fetchOrders(conn), 1200);
                if (pollTrades) {
                    setTimeout(() => fetchTrades(conn), 2000);
                }
                return;
            }

            if (pollWallets && isWalletLikeConnection(conn)) {
                if (isDev) console.log(`[RealTime] Setting up wallet polling for ${conn.name} (${conn.chain || conn.type})`);
                schedulePoll(`${conn.id}-wallet-balances`, () => fetchBalances(conn), WALLET_POLL_MS);
                setTimeout(() => fetchBalances(conn), 800);
            }
        });

        // When tab becomes visible, trigger immediate refresh
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                triggerImmediateRef.current?.();
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', onVisibilityChange);
            triggerImmediateRef.current = null;
            if (isDev) console.log('[RealTime] Stopping polling');
            intervalsRef.current.forEach((t) => clearTimeout(t));
            intervalsRef.current.clear();
        };
    }, [enabled, connections, pollTrades, pollWallets, isWalletLikeConnection]); // Removed callback dependencies - using refs instead

    // Get current rate limit status
    const getRateLimitStatus = useCallback(() => {
        return { ...rateLimitsRef.current };
    }, []);

    return {
        getRateLimitStatus,
        POLL_INTERVALS,
        triggerRefresh: () => triggerImmediateRef.current?.(),
    };
}

// Utility hook for interval-based polling
export function useInterval(callback: () => void, delay: number | null) {
    const savedCallback = useRef(callback);

    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);

    useEffect(() => {
        if (delay === null) return;

        const id = setInterval(() => savedCallback.current(), delay);
        return () => clearInterval(id);
    }, [delay]);
}
