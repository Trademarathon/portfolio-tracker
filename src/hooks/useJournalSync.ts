"use client";

import { useEffect, useRef, useCallback, useState } from 'react';
import { useJournal, JournalTrade } from '@/contexts/JournalContext';

// Sync configuration - always run at full speed (including when tab hidden)
const SYNC_INTERVAL = 5000; // 5 seconds

interface SyncStatus {
    isConnected: boolean;
    lastSyncTime: number | null;
    error: string | null;
    tradesCount: number;
}

export function useJournalSync() {
    const { 
        syncTrades, 
        trades, 
        realtimeEnabled, 
        setRealtimeEnabled,
        lastSyncTime,
        isSyncing,
        connectedExchanges,
    } = useJournal();
    
    const [syncStatus, setSyncStatus] = useState<SyncStatus>({
        isConnected: false,
        lastSyncTime: null,
        error: null,
        tradesCount: 0,
    });
    
    const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
    
    // Setup periodic sync - always runs at full speed (including when tab hidden)
    useEffect(() => {
        if (!realtimeEnabled) {
            if (syncIntervalRef.current) {
                clearInterval(syncIntervalRef.current);
                syncIntervalRef.current = null;
            }
            return;
        }
        
        const performSync = async () => {
            try {
                await syncTrades();
                setSyncStatus(prev => ({
                    ...prev,
                    isConnected: true,
                    lastSyncTime: Date.now(),
                    error: null,
                    tradesCount: trades.length,
                }));
            } catch (error: any) {
                setSyncStatus(prev => ({
                    ...prev,
                    isConnected: false,
                    error: error.message || 'Sync failed',
                }));
            }
        };
        
        // Start sync interval - always at full rate
        const startSync = () => {
            if (syncIntervalRef.current) {
                clearInterval(syncIntervalRef.current);
            }
            syncIntervalRef.current = setInterval(performSync, SYNC_INTERVAL);
        };
        
        // Initial sync
        performSync();
        startSync();
        
        return () => {
            if (syncIntervalRef.current) {
                clearInterval(syncIntervalRef.current);
            }
        };
    }, [realtimeEnabled, syncTrades, trades.length]);
    
    // Listen for real-time trade events from WebSocket
    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        const handleNewTrade = (event: CustomEvent<JournalTrade>) => {
            setSyncStatus(prev => ({
                ...prev,
                tradesCount: prev.tradesCount + 1,
                lastSyncTime: Date.now(),
            }));
        };
        
        window.addEventListener('journal-new-trade', handleNewTrade as EventListener);
        
        return () => {
            window.removeEventListener('journal-new-trade', handleNewTrade as EventListener);
        };
    }, []);
    
    // Manual sync trigger
    const triggerSync = useCallback(async () => {
        await syncTrades();
    }, [syncTrades]);
    
    // Toggle real-time sync
    const toggleRealtime = useCallback(() => {
        setRealtimeEnabled(!realtimeEnabled);
    }, [realtimeEnabled, setRealtimeEnabled]);
    
    return {
        syncStatus: {
            ...syncStatus,
            isConnected: connectedExchanges.length > 0,
            lastSyncTime,
            tradesCount: trades.length,
        },
        isSyncing,
        realtimeEnabled,
        connectedExchanges,
        triggerSync,
        toggleRealtime,
    };
}

// Hook for listening to trade updates in real-time
export function useTradeUpdates(onNewTrade?: (trade: JournalTrade) => void) {
    useEffect(() => {
        if (typeof window === 'undefined' || !onNewTrade) return;
        
        const handleNewTrade = (event: CustomEvent<JournalTrade>) => {
            onNewTrade(event.detail);
        };
        
        window.addEventListener('journal-new-trade', handleNewTrade as EventListener);
        
        return () => {
            window.removeEventListener('journal-new-trade', handleNewTrade as EventListener);
        };
    }, [onNewTrade]);
}

// Hook for listening to alert triggers
export function useAlertTriggers(onAlertTriggered?: (alert: any) => void) {
    useEffect(() => {
        if (typeof window === 'undefined' || !onAlertTriggered) return;
        
        const handleAlertTriggered = (event: CustomEvent) => {
            onAlertTriggered(event.detail);
        };
        
        window.addEventListener('playbook-alert-triggered', handleAlertTriggered as EventListener);
        
        return () => {
            window.removeEventListener('playbook-alert-triggered', handleAlertTriggered as EventListener);
        };
    }, [onAlertTriggered]);
}
