"use client";

import { useEffect, useRef, useCallback } from 'react';
import { useJournal, JournalTrade } from '@/contexts/JournalContext';

/**
 * Hook to integrate the Journal with real-time WebSocket updates.
 * Listens for trade events from the enhanced WebSocket manager and updates the Journal.
 */
export function useJournalWebSocket() {
    const { trades, realtimeEnabled } = useJournal();
    const processedIdsRef = useRef<Set<string>>(new Set());
    
    // Process incoming WebSocket messages for trade events
    const handleWebSocketMessage = useCallback((event: CustomEvent) => {
        if (!realtimeEnabled) return;
        
        const message = event.detail;
        
        // Handle different exchange message types
        if (message.type === 'order_update' || message.type === 'fill' || message.type === 'trade') {
            const tradeId = message.data?.id || message.data?.orderId || message.data?.tradeId;
            
            // Skip if already processed
            if (tradeId && processedIdsRef.current.has(tradeId)) return;
            if (tradeId) processedIdsRef.current.add(tradeId);
            
            // Parse trade from message
            const trade = parseTradeFromMessage(message);
            if (trade) {
                // Dispatch to Journal
                window.dispatchEvent(new CustomEvent('journal-new-trade', { detail: trade }));
            }
        }
        
        // Handle Hyperliquid fills
        if (message.exchange === 'hyperliquid' && message.data?.fills) {
            message.data.fills.forEach((fill: any) => {
                const tradeId = fill.hash || fill.oid;
                if (processedIdsRef.current.has(tradeId)) return;
                processedIdsRef.current.add(tradeId);
                
                const trade = parseHyperliquidFill(fill);
                if (trade) {
                    window.dispatchEvent(new CustomEvent('journal-new-trade', { detail: trade }));
                }
            });
        }
        
        // Handle Binance fills
        if (message.exchange === 'binance' && message.data?.e === 'executionReport') {
            if (message.data.x === 'TRADE') {
                const tradeId = message.data.t?.toString();
                if (tradeId && !processedIdsRef.current.has(tradeId)) {
                    processedIdsRef.current.add(tradeId);
                    
                    const trade = parseBinanceFill(message.data);
                    if (trade) {
                        window.dispatchEvent(new CustomEvent('journal-new-trade', { detail: trade }));
                    }
                }
            }
        }
        
        // Handle Bybit fills
        if (message.exchange === 'bybit' && message.data?.topic === 'execution') {
            const executions = message.data.data || [];
            executions.forEach((exec: any) => {
                const tradeId = exec.execId;
                if (tradeId && !processedIdsRef.current.has(tradeId)) {
                    processedIdsRef.current.add(tradeId);
                    
                    const trade = parseBybitExecution(exec);
                    if (trade) {
                        window.dispatchEvent(new CustomEvent('journal-new-trade', { detail: trade }));
                    }
                }
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
            if (processedIdsRef.current.size > 1000) {
                const ids = Array.from(processedIdsRef.current);
                processedIdsRef.current = new Set(ids.slice(-500));
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
        processedCount: processedIdsRef.current.size,
    };
}

// Parse trade from generic WebSocket message
function parseTradeFromMessage(message: any): JournalTrade | null {
    try {
        const data = message.data;
        if (!data) return null;
        
        return {
            id: data.id || data.orderId || data.tradeId || `ws-${Date.now()}`,
            symbol: data.symbol || data.coin || '',
            side: (data.side?.toLowerCase() === 'buy' || data.side === 'B') ? 'buy' : 'sell',
            price: parseFloat(data.price || data.px || 0),
            amount: parseFloat(data.qty || data.sz || data.amount || 0),
            timestamp: data.time || data.timestamp || Date.now(),
            exchange: message.exchange || 'unknown',
            status: 'closed',
            pnl: parseFloat(data.realizedPnl || data.closedPnl || 0),
            realizedPnl: parseFloat(data.realizedPnl || data.closedPnl || 0),
        };
    } catch {
        return null;
    }
}

// Parse Hyperliquid fill
function parseHyperliquidFill(fill: any): JournalTrade | null {
    try {
        return {
            id: fill.hash || fill.oid || `hl-${Date.now()}`,
            symbol: fill.coin,
            side: fill.side === 'B' ? 'buy' : 'sell',
            price: parseFloat(fill.px),
            amount: parseFloat(fill.sz),
            timestamp: fill.time,
            exchange: 'Hyperliquid',
            status: 'closed',
            pnl: parseFloat(fill.closedPnl || 0),
            realizedPnl: parseFloat(fill.closedPnl || 0),
            notes: fill.dir, // "Open Long", "Close Short", etc.
        };
    } catch {
        return null;
    }
}

// Parse Binance execution report
function parseBinanceFill(data: any): JournalTrade | null {
    try {
        return {
            id: data.t?.toString() || `bn-${Date.now()}`,
            symbol: data.s,
            side: data.S?.toLowerCase() === 'buy' ? 'buy' : 'sell',
            price: parseFloat(data.L), // Last filled price
            amount: parseFloat(data.l), // Last filled quantity
            timestamp: data.T || Date.now(),
            exchange: 'Binance',
            status: 'closed',
            pnl: parseFloat(data.rp || 0), // Realized profit (for futures)
            realizedPnl: parseFloat(data.rp || 0),
            fees: parseFloat(data.n || 0), // Commission
        };
    } catch {
        return null;
    }
}

// Parse Bybit execution
function parseBybitExecution(exec: any): JournalTrade | null {
    try {
        return {
            id: exec.execId || `by-${Date.now()}`,
            symbol: exec.symbol,
            side: exec.side?.toLowerCase() === 'buy' ? 'buy' : 'sell',
            price: parseFloat(exec.execPrice),
            amount: parseFloat(exec.execQty),
            timestamp: parseInt(exec.execTime) || Date.now(),
            exchange: 'Bybit',
            status: 'closed',
            pnl: parseFloat(exec.closedPnl || 0),
            realizedPnl: parseFloat(exec.closedPnl || 0),
            fees: parseFloat(exec.execFee || 0),
        };
    } catch {
        return null;
    }
}

export default useJournalWebSocket;
