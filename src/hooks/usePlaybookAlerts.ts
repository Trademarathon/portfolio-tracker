"use client";

import { useEffect, useRef, useCallback, useState } from 'react';
import { useJournal } from '@/contexts/JournalContext';
import { normalizeSymbol } from '@/lib/utils/normalization';
import type { PlaybookLevelAlert } from '@/lib/api/alerts';
import { WS_ENDPOINTS } from '@/lib/api/websocket-endpoints';

const RECONNECT_BASE_DELAY_MS = 2000;
const RECONNECT_MAX_DELAY_MS = 30000;

interface PriceUpdate {
    symbol: string;
    price: number;
    timestamp: number;
}

interface AlertTrigger {
    alert: PlaybookLevelAlert;
    currentPrice: number;
    message: string;
    timestamp: number;
}

export function usePlaybookAlerts() {
    const { playbookAlerts, checkPriceAlerts, spotPlans, perpPlans, realtimeEnabled } = useJournal();
    const [recentTriggers, setRecentTriggers] = useState<AlertTrigger[]>([]);
    const [isMonitoring, setIsMonitoring] = useState(true);
    const [connectAttempt, setConnectAttempt] = useState(0);
    const pricesCacheRef = useRef<Record<string, number>>({});
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const retryCountRef = useRef(0);
    const latestMonitoringStateRef = useRef({
        isMonitoring: true,
        realtimeEnabled: true,
        hasEnabledAlerts: false,
    });

    const hasEnabledAlerts = playbookAlerts.some(a => a.enabled && !a.triggered);

    useEffect(() => {
        latestMonitoringStateRef.current = {
            isMonitoring,
            realtimeEnabled,
            hasEnabledAlerts,
        };
    }, [isMonitoring, realtimeEnabled, hasEnabledAlerts]);

    // Get unique symbols from active plans (normalized for price streams)
    const activeSymbols = useCallback(() => {
        const symbols = new Set<string>();
        spotPlans.filter(p => p.isActive).forEach(p => {
            const n = normalizeSymbol(p.symbol);
            if (n) symbols.add(n);
        });
        perpPlans.filter(p => p.isActive).forEach(p => {
            const n = normalizeSymbol(p.symbol);
            if (n) symbols.add(n);
        });
        return Array.from(symbols);
    }, [spotPlans, perpPlans]);

    // Connect to Binance WebSocket for real-time prices
    useEffect(() => {
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }

        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        if (!realtimeEnabled || !isMonitoring || !hasEnabledAlerts) return;

        const symbols = activeSymbols();
        if (symbols.length === 0) return;

        // Create mini ticker stream for all symbols
        const streams = symbols.map(s => `${s.toLowerCase()}usdt@miniTicker`).join('/');
        const wsUrl = `${WS_ENDPOINTS.binance.wsSpotStream}?streams=${streams}`;

        try {
            const socket = new WebSocket(wsUrl);
            wsRef.current = socket;

            socket.onopen = () => {
                retryCountRef.current = 0;
                console.log('[PlaybookAlerts] WebSocket connected for price monitoring');
            };

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.data && data.data.s && data.data.c) {
                        const symbol = data.data.s;
                        const price = parseFloat(data.data.c);
                        pricesCacheRef.current[symbol] = price;

                        // Check alerts with updated prices
                        checkPriceAlerts(pricesCacheRef.current);
                    }
                } catch (_e) {
                    // Ignore parse errors
                }
            };

            socket.onerror = () => {
                // WebSocket "error" events are not very informative in browsers; avoid console.error
                // to prevent Next.js Dev overlay noise.
                console.warn('[PlaybookAlerts] WebSocket error (connection failed or interrupted)', {
                    url: wsUrl,
                    readyState: socket.readyState,
                    online: typeof navigator !== 'undefined' ? navigator.onLine : undefined,
                });
            };

            socket.onclose = (event) => {
                console.log('[PlaybookAlerts] WebSocket closed', {
                    code: event.code,
                    reason: event.reason,
                    wasClean: event.wasClean,
                });

                wsRef.current = null;

                const latest = latestMonitoringStateRef.current;
                if (!latest.realtimeEnabled || !latest.isMonitoring || !latest.hasEnabledAlerts) return;

                const delay = Math.min(
                    RECONNECT_BASE_DELAY_MS * Math.pow(2, retryCountRef.current),
                    RECONNECT_MAX_DELAY_MS
                );
                retryCountRef.current += 1;

                reconnectTimerRef.current = setTimeout(() => {
                    const stillLatest = latestMonitoringStateRef.current;
                    if (!stillLatest.realtimeEnabled || !stillLatest.isMonitoring || !stillLatest.hasEnabledAlerts) return;
                    setConnectAttempt(a => a + 1);
                }, delay);
            };
        } catch (e) {
            // Avoid console.error to prevent Next.js Dev overlay noise
            console.warn('[PlaybookAlerts] Failed to create WebSocket for price monitoring', e);
        }

        return () => {
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [realtimeEnabled, isMonitoring, hasEnabledAlerts, connectAttempt, activeSymbols, checkPriceAlerts]);

    // Listen for triggered alerts
    useEffect(() => {
        const handleAlertTriggered = (event: CustomEvent) => {
            const trigger = event.detail as AlertTrigger;
            setRecentTriggers(prev => [trigger, ...prev].slice(0, 20));

            // Show browser notification if enabled
            if (Notification.permission === 'granted') {
                new Notification('Playbook Alert Triggered', {
                    body: trigger.message,
                    icon: '/favicon.ico',
                    tag: trigger.alert.id,
                });
            }

            // Play sound if enabled
            try {
                const audio = new Audio('/sounds/alert.mp3');
                audio.volume = 0.5;
                audio.play().catch(() => { }); // Ignore if can't play
            } catch (_e) {
                // Ignore audio errors
            }
        };

        window.addEventListener('playbook-alert-triggered', handleAlertTriggered as EventListener);

        return () => {
            window.removeEventListener('playbook-alert-triggered', handleAlertTriggered as EventListener);
        };
    }, []);

    // Request notification permission
    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'default') {
                Notification.requestPermission();
            }
        }
    }, []);

    // Get enabled alerts count
    const enabledAlertsCount = playbookAlerts.filter(a => a.enabled && !a.triggered).length;
    const triggeredAlertsCount = playbookAlerts.filter(a => a.triggered).length;

    return {
        isMonitoring,
        setIsMonitoring,
        enabledAlertsCount,
        triggeredAlertsCount,
        recentTriggers,
        currentPrices: pricesCacheRef.current,
        activeSymbols: activeSymbols(),
    };
}

// Hook for checking alerts against a specific price
export function useAlertCheck(symbol: string, currentPrice: number) {
    const { playbookAlerts } = useJournal();
    const normSym = normalizeSymbol(symbol);

    const relevantAlerts = playbookAlerts.filter(a => {
        const alertNorm = normalizeSymbol(a.symbol);
        return alertNorm === normSym && a.enabled && !a.triggered;
    });

    const nearbyAlerts = relevantAlerts.filter(a => {
        const distance = Math.abs(currentPrice - a.levelValue) / a.levelValue;
        return distance < 0.02; // Within 2% of level
    });

    return {
        relevantAlerts,
        nearbyAlerts,
        hasNearbyAlerts: nearbyAlerts.length > 0,
    };
}
