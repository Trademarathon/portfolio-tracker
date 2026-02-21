"use client";

import { useEffect } from 'react';
import { useJournal } from '@/contexts/JournalContext';
import { useJournalWebSocket } from '@/hooks/useJournalWebSocket';
import { usePlaybookAlerts } from '@/hooks/usePlaybookAlerts';
import { normalizeSymbol } from '@/lib/utils/normalization';

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

function buildFallbackId(
    prefix: string,
    exchange: unknown,
    symbol: unknown,
    side: unknown,
    price: unknown,
    amount: unknown,
    timestamp: unknown
): string {
    const ex = String(exchange || 'unknown').toLowerCase().replace(/[^a-z0-9._-]+/gi, '_');
    const sym = normalizeSymbol(String(symbol || '')).replace(/[^A-Z0-9._-]+/g, '_');
    const sd = String(side || 'buy').toLowerCase();
    const px = (toNumber(price) ?? 0).toFixed(10);
    const qty = (toNumber(amount) ?? 0).toFixed(10);
    const ts = toMs(timestamp);
    return `${prefix}-${ex}-${sym}-${sd}-${px}-${qty}-${ts}`;
}

/**
 * Component that integrates the Journal with real-time WebSocket updates.
 * This component doesn't render anything - it just manages the integration.
 */
export function JournalWebSocketIntegration() {
    const { realtimeEnabled, syncPlaybooks, syncAlerts, checkPriceAlerts } = useJournal();
    
    // Initialize WebSocket listener for trades
    useJournalWebSocket();
    
    // Initialize playbook alerts monitoring
    const { isMonitoring, activeSymbols: _activeSymbols } = usePlaybookAlerts();
    
    // Listen for portfolio data updates and forward to journal
    useEffect(() => {
        if (typeof window === 'undefined' || !realtimeEnabled) return;
        
        // Listen for position updates (when a trade is closed)
        const handlePositionUpdate = (event: CustomEvent) => {
            const position = event.detail;
            if (position?.status === 'closed' || position?.size === 0) {
                const timestamp = toMs(position.closeTime || position.updatedAt || position.timestamp || Date.now());
                const symbol = normalizeSymbol(position.symbol || '');
                if (!symbol) return;
                const id = toStringId(
                    position.tradeId,
                    position.id,
                    position.positionId,
                    buildFallbackId(
                        'pos',
                        position.exchange,
                        symbol,
                        position.side,
                        position.exitPrice || position.price,
                        position.closedSize || position.size || position.amount,
                        timestamp
                    )
                )!;

                // Position was closed - might indicate a completed trade
                window.dispatchEvent(new CustomEvent('journal-trade-update', { 
                    detail: {
                        id,
                        symbol,
                        exchange: position.exchange || 'unknown',
                        timestamp,
                        realizedPnl: toNumber(position.realizedPnl ?? position.pnl) ?? 0,
                        status: 'closed',
                    }
                }));
            }
        };
        
        // Listen for order fills
        const handleOrderFill = (event: CustomEvent) => {
            const order = event.detail;
            if (order?.status === 'filled' || order?.status === 'closed') {
                const symbol = normalizeSymbol(order.symbol || '');
                const price = toNumber(order.avgPrice ?? order.price);
                const amount = toNumber(order.qty ?? order.amount);
                if (!symbol || !price || price <= 0 || !amount || amount <= 0) return;
                const timestamp = toMs(order.timestamp || order.time || Date.now());
                const exchange = String(order.exchange || 'unknown');
                const side = String(order.side || '').toLowerCase() === 'buy' ? 'buy' : 'sell';
                const id = toStringId(
                    order.tradeId,
                    order.execId,
                    order.fillId,
                    order.id,
                    order.orderId,
                    buildFallbackId('ord', exchange, symbol, side, price, amount, timestamp)
                )!;

                window.dispatchEvent(new CustomEvent('journal-new-trade', { 
                    detail: {
                        id,
                        symbol,
                        side,
                        price,
                        amount,
                        timestamp,
                        exchange,
                        status: 'closed',
                        realizedPnl: toNumber(order.realizedPnl) ?? 0,
                        fees: Math.abs(toNumber(order.fee ?? order.fees) ?? 0),
                    }
                }));
            }
        };
        
        // Listen for balance updates to track PnL changes
        const handleBalanceUpdate = (event: CustomEvent) => {
            // Could be used to update portfolio value in stats
            const balance = event.detail;
            if (balance) {
                window.dispatchEvent(new CustomEvent('journal-balance-update', { detail: balance }));
            }
        };
        
        window.addEventListener('position-update', handlePositionUpdate as EventListener);
        window.addEventListener('order-fill', handleOrderFill as EventListener);
        window.addEventListener('balance-update', handleBalanceUpdate as EventListener);
        
        return () => {
            window.removeEventListener('position-update', handlePositionUpdate as EventListener);
            window.removeEventListener('order-fill', handleOrderFill as EventListener);
            window.removeEventListener('balance-update', handleBalanceUpdate as EventListener);
        };
    }, [realtimeEnabled]);
    
    // Sync playbooks and alerts when they change externally
    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        const handlePlaybookChange = () => {
            syncPlaybooks();
            syncAlerts();
        };
        
        window.addEventListener('playbook-updated', handlePlaybookChange);
        window.addEventListener('spot-plans-updated', handlePlaybookChange);
        window.addEventListener('perp-plans-updated', handlePlaybookChange);
        
        return () => {
            window.removeEventListener('playbook-updated', handlePlaybookChange);
            window.removeEventListener('spot-plans-updated', handlePlaybookChange);
            window.removeEventListener('perp-plans-updated', handlePlaybookChange);
        };
    }, [syncPlaybooks, syncAlerts]);
    
    // Listen for price updates and check alerts
    useEffect(() => {
        if (typeof window === 'undefined' || !realtimeEnabled || !isMonitoring) return;
        
        const handlePriceUpdate = (event: CustomEvent) => {
            const prices = event.detail;
            if (prices && typeof prices === 'object') {
                checkPriceAlerts(prices);
            }
        };
        
        window.addEventListener('market-prices-update', handlePriceUpdate as EventListener);
        
        return () => {
            window.removeEventListener('market-prices-update', handlePriceUpdate as EventListener);
        };
    }, [realtimeEnabled, isMonitoring, checkPriceAlerts]);
    
    // Show toast notifications for new trades
    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        const handleNewTrade = (event: CustomEvent) => {
            const trade = event.detail;
            
            // You could integrate with a toast library here
            console.log('[Journal] New trade received:', trade.symbol, trade.side, trade.amount);
        };
        
        const handleAlertTriggered = (event: CustomEvent) => {
            const { alert: _alert, message } = event.detail;
            
            // You could integrate with a toast library here
            console.log('[Journal] Alert triggered:', message);
        };
        
        window.addEventListener('journal-trade-received', handleNewTrade as EventListener);
        window.addEventListener('playbook-alert-triggered', handleAlertTriggered as EventListener);
        
        return () => {
            window.removeEventListener('journal-trade-received', handleNewTrade as EventListener);
            window.removeEventListener('playbook-alert-triggered', handleAlertTriggered as EventListener);
        };
    }, []);
    
    // This component doesn't render anything
    return null;
}
