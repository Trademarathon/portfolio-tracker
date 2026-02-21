"use client";

import { useEffect, useRef, useCallback } from 'react';
import { useJournal, JournalTrade } from '@/contexts/JournalContext';
import { normalizeSymbol } from '@/lib/utils/normalization';

const DEDUPE_TTL_MS = 10 * 60 * 1000;
const MAX_DEDUPE_KEYS = 5000;

function toMs(value: unknown): number {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return Date.now();
    if (n > 1e17) return Math.round(n / 1_000_000);
    if (n > 1e14) return Math.round(n / 1_000);
    if (n < 1e12) return Math.round(n * 1_000);
    return Math.round(n);
}

function toNumber(value: unknown): number | undefined {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
}

function toStringId(...values: unknown[]): string | undefined {
    for (const value of values) {
        if (value === null || value === undefined) continue;
        const s = String(value).trim();
        if (s) return s;
    }
    return undefined;
}

function stableToken(value: unknown): string {
    const s = String(value ?? '').trim();
    if (!s) return 'na';
    return s.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 64) || 'na';
}

function stableTradeFingerprint(
    trade: Pick<JournalTrade, 'symbol' | 'rawSymbol' | 'side' | 'price' | 'amount' | 'timestamp' | 'exchange'>,
    exchangeOverride?: string
): string {
    const exchange = String(exchangeOverride || trade.exchange || 'unknown').toLowerCase();
    const symbol = normalizeSymbol(trade.symbol || trade.rawSymbol || '');
    const side = String(trade.side || 'buy').toLowerCase();
    const tsSec = Math.floor(toMs(trade.timestamp) / 1000);
    const price = toNumber(trade.price) ?? 0;
    const amount = toNumber(trade.amount) ?? 0;
    return `${exchange}|${symbol}|${side}|${price.toFixed(10)}|${amount.toFixed(10)}|${tsSec}`;
}

function stableFallbackTradeId(
    prefix: string,
    trade: Pick<JournalTrade, 'symbol' | 'rawSymbol' | 'side' | 'price' | 'amount' | 'timestamp' | 'exchange'>,
    exchangeOverride?: string
): string {
    const exchange = String(exchangeOverride || trade.exchange || 'unknown').toLowerCase();
    const symbol = normalizeSymbol(trade.symbol || trade.rawSymbol || '');
    const side = String(trade.side || 'buy').toLowerCase();
    const ts = toMs(trade.timestamp);
    const price = toNumber(trade.price) ?? 0;
    const amount = toNumber(trade.amount) ?? 0;
    return [
        stableToken(prefix),
        stableToken(exchange),
        stableToken(symbol),
        stableToken(side),
        stableToken(price.toFixed(10)),
        stableToken(amount.toFixed(10)),
        stableToken(ts),
    ].join('-');
}

/**
 * Hook to integrate the Journal with real-time WebSocket updates.
 * Listens for trade events from the enhanced WebSocket manager and updates the Journal.
 */
export function useJournalWebSocket() {
    const { realtimeEnabled } = useJournal();
    const processedKeysRef = useRef<Map<string, number>>(new Map());
    
    // Process incoming WebSocket messages for trade events
    const handleWebSocketMessage = useCallback((event: CustomEvent) => {
        if (!realtimeEnabled) return;
        
        const message = event.detail || {};
        const exchange = String(message.exchange || message.source || '').toLowerCase();
        const emitTrade = (trade: JournalTrade | null, ...rawIds: unknown[]) => {
            if (!trade) return;
            const symbol = normalizeSymbol(trade.symbol || trade.rawSymbol || '');
            const price = toNumber(trade.price);
            const amount = toNumber(trade.amount);
            if (!symbol || !price || price <= 0 || !amount || amount <= 0) return;

            const normalizedTimestamp = toMs(trade.timestamp);
            const normalizedTrade: JournalTrade = {
                ...trade,
                symbol,
                rawSymbol: trade.rawSymbol || symbol,
                timestamp: normalizedTimestamp,
                exchange: trade.exchange || exchange || 'unknown',
                price,
                amount,
            };

            const fallbackId = toStringId(...rawIds);
            const id = toStringId(
                normalizedTrade.id,
                fallbackId,
                stableFallbackTradeId('ws', normalizedTrade, exchange)
            )!;
            const fingerprint = stableTradeFingerprint(normalizedTrade, exchange);
            const dedupeKeys = [id, `fp:${fingerprint}`];
            const now = Date.now();
            const isDuplicate = dedupeKeys.some((key) => {
                const seenAt = processedKeysRef.current.get(key);
                return typeof seenAt === 'number' && now - seenAt < DEDUPE_TTL_MS;
            });
            if (isDuplicate) return;

            dedupeKeys.forEach((key) => processedKeysRef.current.set(key, now));
            window.dispatchEvent(new CustomEvent('journal-new-trade', { detail: { ...normalizedTrade, id } }));
        };
        
        // Handle different exchange message types
        if (message.type === 'order_update' || message.type === 'fill' || message.type === 'trade') {
            const entries = Array.isArray(message.data) ? message.data : [message.data];
            entries.forEach((entry: any) => {
                const trade = parseTradeFromMessage({ ...message, data: entry });
                const tradeId = toStringId(entry?.id, entry?.orderId, entry?.tradeId, entry?.execId);
                emitTrade(trade, tradeId, entry?.fillId);
            });
        }
        
        // Handle Hyperliquid fills
        if (exchange === 'hyperliquid' && message.data?.fills) {
            message.data.fills.forEach((fill: any) => {
                const trade = parseHyperliquidFill(fill);
                emitTrade(trade, fill.hash, fill.tid, fill.oid);
            });
        }
        
        // Handle Binance fills
        if (exchange === 'binance' && message.data?.e === 'executionReport') {
            if (message.data.x === 'TRADE') {
                const trade = parseBinanceFill(message.data);
                emitTrade(trade, message.data.t, message.data.i);
            }
        }
        
        // Handle Bybit fills
        if (exchange === 'bybit' && message.data?.topic === 'execution') {
            const executions = message.data.data || [];
            executions.forEach((exec: any) => {
                const trade = parseBybitExecution(exec);
                emitTrade(trade, exec.execId, exec.orderId, exec.leavesQty);
            });
        }
    }, [realtimeEnabled]);
    
    // Listen for WebSocket messages
    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        // Listen for generic WebSocket messages from the enhanced manager
        window.addEventListener('ws-message', handleWebSocketMessage as EventListener);
        
        // Clean up processed IDs periodically
        const cleanup = setInterval(() => {
            const now = Date.now();
            const keys = processedKeysRef.current;
            for (const [key, ts] of keys.entries()) {
                if (now - ts >= DEDUPE_TTL_MS) keys.delete(key);
            }
            if (keys.size > MAX_DEDUPE_KEYS) {
                const ordered = Array.from(keys.entries()).sort((a, b) => a[1] - b[1]);
                const removeCount = Math.max(0, ordered.length - Math.floor(MAX_DEDUPE_KEYS * 0.75));
                for (let i = 0; i < removeCount; i += 1) {
                    keys.delete(ordered[i][0]);
                }
            }
        }, 60000);
        
        return () => {
            window.removeEventListener('ws-message', handleWebSocketMessage as EventListener);
            clearInterval(cleanup);
        };
    }, [handleWebSocketMessage]);
    
    // Return status
    return {
        isListening: realtimeEnabled,
        processedCount: processedKeysRef.current.size,
    };
}

// Parse trade from generic WebSocket message
function parseTradeFromMessage(message: any): JournalTrade | null {
    try {
        const data = message.data;
        if (!data) return null;
        const rawSymbol = String(data.rawSymbol || data.symbol || data.coin || '').trim();
        const symbol = normalizeSymbol(rawSymbol);
        const price = toNumber(data.price ?? data.px) ?? 0;
        const amount = toNumber(data.qty ?? data.sz ?? data.amount) ?? 0;
        if (!symbol || price <= 0 || amount <= 0) return null;

        const timestamp = toMs(data.time || data.timestamp || Date.now());
        const side = (String(data.side || '').toLowerCase() === 'buy' || data.side === 'B') ? 'buy' : 'sell';
        const exchange = String(message.exchange || 'unknown');
        const base: Omit<JournalTrade, 'id'> = {
            symbol,
            rawSymbol,
            side,
            price,
            amount,
            timestamp,
            exchange,
            status: 'closed',
            pnl: toNumber(data.realizedPnl ?? data.closedPnl) ?? 0,
            realizedPnl: toNumber(data.realizedPnl ?? data.closedPnl) ?? 0,
        };
        const id = toStringId(
            data.id,
            data.tradeId,
            data.execId,
            data.fillId,
            data.orderId,
            stableFallbackTradeId('ws', base, exchange)
        )!;
        
        return {
            ...base,
            id,
        };
    } catch {
        return null;
    }
}

// Parse Hyperliquid fill
function parseHyperliquidFill(fill: any): JournalTrade | null {
    try {
        const rawSymbol = String(fill.coin || '').trim();
        const symbol = normalizeSymbol(rawSymbol);
        const price = toNumber(fill.px) ?? 0;
        const amount = toNumber(fill.sz) ?? 0;
        if (!symbol || price <= 0 || amount <= 0) return null;

        const timestamp = toMs(fill.time);
        const base: Omit<JournalTrade, 'id'> = {
            symbol,
            rawSymbol,
            side: fill.side === 'B' ? 'buy' : 'sell',
            price,
            amount,
            timestamp,
            exchange: 'Hyperliquid',
            status: 'closed',
            pnl: toNumber(fill.closedPnl) ?? 0,
            realizedPnl: toNumber(fill.closedPnl) ?? 0,
            notes: fill.dir, // "Open Long", "Close Short", etc.
        };
        const id = toStringId(
            fill.hash,
            fill.tid,
            fill.oid,
            fill.tradeId,
            stableFallbackTradeId('hl', base, 'hyperliquid')
        )!;

        return {
            ...base,
            id,
        };
    } catch {
        return null;
    }
}

// Parse Binance execution report
function parseBinanceFill(data: any): JournalTrade | null {
    try {
        const rawSymbol = String(data.s || '').trim();
        const symbol = normalizeSymbol(rawSymbol);
        const price = toNumber(data.L) ?? 0; // Last filled price
        const amount = toNumber(data.l) ?? 0; // Last filled quantity
        if (!symbol || price <= 0 || amount <= 0) return null;

        const timestamp = toMs(data.T || Date.now());
        const base: Omit<JournalTrade, 'id'> = {
            symbol,
            rawSymbol,
            side: data.S?.toLowerCase() === 'buy' ? 'buy' : 'sell',
            price,
            amount,
            timestamp,
            exchange: 'Binance',
            status: 'closed',
            pnl: toNumber(data.rp) ?? 0, // Realized profit (for futures)
            realizedPnl: toNumber(data.rp) ?? 0,
            fees: Math.abs(toNumber(data.n) ?? 0), // Commission
        };
        const id = toStringId(
            data.t,
            data.a,
            data.i,
            data.c,
            stableFallbackTradeId('bn', base, 'binance')
        )!;

        return {
            ...base,
            id,
        };
    } catch {
        return null;
    }
}

// Parse Bybit execution
function parseBybitExecution(exec: any): JournalTrade | null {
    try {
        const rawSymbol = String(exec.symbol || '').trim();
        const symbol = normalizeSymbol(rawSymbol);
        const price = toNumber(exec.execPrice) ?? 0;
        const amount = toNumber(exec.execQty) ?? 0;
        if (!symbol || price <= 0 || amount <= 0) return null;

        const timestamp = toMs(exec.execTime || Date.now());
        const base: Omit<JournalTrade, 'id'> = {
            symbol,
            rawSymbol,
            side: exec.side?.toLowerCase() === 'buy' ? 'buy' : 'sell',
            price,
            amount,
            timestamp,
            exchange: 'Bybit',
            status: 'closed',
            pnl: toNumber(exec.closedPnl) ?? 0,
            realizedPnl: toNumber(exec.closedPnl) ?? 0,
            fees: Math.abs(toNumber(exec.execFee) ?? 0),
        };
        const id = toStringId(
            exec.execId,
            exec.tradeId,
            exec.orderId,
            stableFallbackTradeId('by', base, 'bybit')
        )!;

        return {
            ...base,
            id,
        };
    } catch {
        return null;
    }
}

export default useJournalWebSocket;
