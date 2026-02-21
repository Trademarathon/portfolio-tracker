"use client";

import { useEffect, useCallback } from 'react';
import { useJournal } from '@/contexts/JournalContext';
import { useJournalWebSocket } from '@/hooks/useJournalWebSocket';
import { usePlaybookAlerts } from '@/hooks/usePlaybookAlerts';

/**
 * Component that integrates the Journal with real-time WebSocket updates.
 * This component doesn't render anything - it just manages the integration.
 */
export function JournalWebSocketIntegration() {
    const { realtimeEnabled, syncPlaybooks, syncAlerts, checkPriceAlerts } = useJournal();
    
    // Initialize WebSocket listener for trades
    useJournalWebSocket();
    
    // Initialize playbook alerts monitoring
    const { isMonitoring, activeSymbols } = usePlaybookAlerts();
    
    // Listen for portfolio data updates and forward to journal
    useEffect(() => {
        if (typeof window === 'undefined' || !realtimeEnabled) return;
        
        // Listen for position updates (when a trade is closed)
        const handlePositionUpdate = (event: CustomEvent) => {
            const position = event.detail;
            if (position?.status === 'closed' || position?.size === 0) {
                // Position was closed - might indicate a completed trade
                window.dispatchEvent(new CustomEvent('journal-trade-update', { 
                    detail: {
                        id: position.id,
                        symbol: position.symbol,
                        realizedPnl: position.realizedPnl || position.pnl,
                        status: 'closed',
                    }
                }));
            }
        };
        
        // Listen for order fills
        const handleOrderFill = (event: CustomEvent) => {
            const order = event.detail;
            if (order?.status === 'filled' || order?.status === 'closed') {
                window.dispatchEvent(new CustomEvent('journal-new-trade', { 
                    detail: {
                        id: order.id || order.orderId,
                        symbol: order.symbol,
                        side: order.side,
                        price: order.avgPrice || order.price,
                        amount: order.qty || order.amount,
                        timestamp: order.timestamp || Date.now(),
                        exchange: order.exchange || 'unknown',
                        status: 'closed',
                        realizedPnl: order.realizedPnl || 0,
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
            const { alert, message } = event.detail;
            
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
