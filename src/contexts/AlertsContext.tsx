"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type {
    Alert,
    AlertCondition,
    Signal,
} from "@/hooks/useAlerts";
import { pushScreenerTriggerToMain } from "@/lib/screenerAlertsBridge";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { getValueWithCloud, setValueWithCloud } from "@/lib/supabase/sync";
import { useSupabaseRealtimeSyncUpdate } from "@/hooks/useSupabaseRealtime";

const ALERTS_KEY = "portfolio_alerts";
const SIGNALS_KEY = "portfolio_signals";

/** Cooldown (ms) before the same alert can trigger again (avoid re-notify on navigation). */
const ALERT_COOLDOWN_MS = 3 * 60 * 1000; // 3 minutes

export interface AlertsContextValue {
    alerts: Alert[];
    signals: Signal[];
    addAlert: (symbol: string | "GLOBAL", conditions: AlertCondition[], logic: "AND" | "OR", opts?: { name?: string; exchange?: string; repeat?: boolean; sound?: boolean; symbols?: string[] }) => void;
    updateAlert: (id: string, updates: Partial<Alert>) => void;
    toggleAlert: (id: string) => void;
    removeAlert: (id: string) => void;
    clearSignals: () => void;
    addSignal: (signal: Omit<Signal, "id">) => void;
    checkAlerts: (prices: Record<string, number>, metrics?: Record<string, any>) => void;
    detectSignals: (prices: Record<string, number>, metrics: Record<string, any>) => void;
}

const AlertsContext = React.createContext<AlertsContextValue | null>(null);

export function AlertsProvider({ children }: { children: React.ReactNode }) {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [signals, setSignals] = useState<Signal[]>([]);
    const { user, cloudSyncEnabled } = useSupabaseAuth();
    const signalsRef = useRef<Signal[]>([]);
    const alertsRef = useRef<Alert[]>([]);
    const lastTriggeredRef = useRef<Map<string, number>>(new Map());

    useEffect(() => {
        signalsRef.current = signals;
    }, [signals]);
    useEffect(() => {
        alertsRef.current = alerts;
    }, [alerts]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const saved = await getValueWithCloud(ALERTS_KEY, user?.id ?? null, cloudSyncEnabled);
            if (cancelled) return;
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (Array.isArray(parsed)) setAlerts(parsed);
                } catch (e) {
                    console.warn("Failed to parse alerts", e);
                }
            }
            const savedSignals = await getValueWithCloud(SIGNALS_KEY, user?.id ?? null, cloudSyncEnabled);
            if (cancelled) return;
            if (savedSignals) {
                try {
                    const parsed = JSON.parse(savedSignals);
                    if (Array.isArray(parsed)) setSignals(parsed.slice(0, 50));
                } catch (e) {
                    console.warn("Failed to parse signals", e);
                }
            }
        })();
        return () => { cancelled = true; };
    }, [user?.id, cloudSyncEnabled]);

    const handleRealtimeSyncUpdate = useCallback(
        async (key: string) => {
            if (key !== ALERTS_KEY && key !== SIGNALS_KEY) return;
            const saved = await getValueWithCloud(key, user?.id ?? null, cloudSyncEnabled);
            if (key === ALERTS_KEY) {
                if (saved == null || saved === "") return;
                try {
                    const parsed = JSON.parse(saved);
                    if (!Array.isArray(parsed)) return;
                    const currentAlerts = alertsRef.current;
                    if (parsed.length === 0 && currentAlerts.length > 0) return;
                    setAlerts(parsed);
                } catch {}
            }
            if (key === SIGNALS_KEY) {
                if (saved == null || saved === "") return;
                try {
                    const parsed = JSON.parse(saved);
                    if (!Array.isArray(parsed)) return;
                    const list = parsed.slice(0, 50);
                    const currentSignals = signalsRef.current;
                    if (list.length === 0 && currentSignals.length > 0) return;
                    setSignals(list);
                } catch {}
            }
        },
        [user?.id, cloudSyncEnabled]
    );
    useSupabaseRealtimeSyncUpdate(handleRealtimeSyncUpdate);

    const saveAlerts = useCallback((newAlerts: Alert[]) => {
        setAlerts(newAlerts || []);
        const raw = JSON.stringify(newAlerts || []);
        localStorage.setItem(ALERTS_KEY, raw);
        setValueWithCloud(ALERTS_KEY, raw, user?.id ?? null, cloudSyncEnabled);
    }, [user?.id, cloudSyncEnabled]);

    const addSignal = useCallback((signal: Omit<Signal, "id">) => {
        const newSignal: Signal = {
            ...signal,
            id: Math.random().toString(36).substr(2, 9),
        };
        setSignals(prev => {
            const updated = [newSignal, ...prev].slice(0, 50);
            const raw = JSON.stringify(updated);
            localStorage.setItem(SIGNALS_KEY, raw);
            setValueWithCloud(SIGNALS_KEY, raw, user?.id ?? null, cloudSyncEnabled);
            return updated;
        });
    }, [user?.id, cloudSyncEnabled]);

    const addAlert = useCallback((symbol: string | "GLOBAL", conditions: AlertCondition[], logic: "AND" | "OR" = "AND", opts?: { name?: string; exchange?: string; repeat?: boolean; sound?: boolean; symbols?: string[] }) => {
        const newAlert: Alert = {
            id: Math.random().toString(36).substr(2, 9),
            symbol,
            conditions,
            logic,
            active: true,
            createdAt: Date.now(),
            triggeredCount: 0,
            ...(opts?.name && { name: opts.name }),
            ...(opts?.exchange && { exchange: opts.exchange }),
            ...(opts?.repeat !== undefined && { repeat: opts.repeat }),
            ...(opts?.sound !== undefined && { sound: opts.sound }),
            ...(opts?.symbols?.length && { symbols: opts.symbols }),
        };
        setAlerts(prev => {
            const updated = [...prev, newAlert];
            const raw = JSON.stringify(updated);
            localStorage.setItem(ALERTS_KEY, raw);
            setValueWithCloud(ALERTS_KEY, raw, user?.id ?? null, cloudSyncEnabled);
            return updated;
        });
    }, [user?.id, cloudSyncEnabled]);

    const updateAlert = useCallback((id: string, updates: Partial<Alert>) => {
        setAlerts(prev => {
            const updated = prev.map(a => a.id === id ? { ...a, ...updates } : a);
            const raw = JSON.stringify(updated);
            localStorage.setItem(ALERTS_KEY, raw);
            setValueWithCloud(ALERTS_KEY, raw, user?.id ?? null, cloudSyncEnabled);
            return updated;
        });
    }, [user?.id, cloudSyncEnabled]);

    const toggleAlert = useCallback((id: string) => {
        setAlerts(prev => {
            const updated = prev.map(a => a.id === id ? { ...a, active: !a.active } : a);
            const raw = JSON.stringify(updated);
            localStorage.setItem(ALERTS_KEY, raw);
            setValueWithCloud(ALERTS_KEY, raw, user?.id ?? null, cloudSyncEnabled);
            return updated;
        });
    }, [user?.id, cloudSyncEnabled]);

    const removeAlert = useCallback((id: string) => {
        setAlerts(prev => {
            const updated = prev.filter(a => a.id !== id);
            const raw = JSON.stringify(updated);
            localStorage.setItem(ALERTS_KEY, raw);
            setValueWithCloud(ALERTS_KEY, raw, user?.id ?? null, cloudSyncEnabled);
            return updated;
        });
    }, [user?.id, cloudSyncEnabled]);

    const clearSignals = useCallback(() => {
        setSignals([]);
        localStorage.removeItem(SIGNALS_KEY);
        setValueWithCloud(SIGNALS_KEY, "[]", user?.id ?? null, cloudSyncEnabled);
    }, [user?.id, cloudSyncEnabled]);

    const checkAlerts = useCallback((prices: Record<string, number>, metrics?: Record<string, any>) => {
        if (!prices || typeof prices !== "object") return;
        setAlerts(prev => {
            const triggered: string[] = [];
            const updatedAlerts = prev.map(alert => {
                if (!alert.active) return alert;
                const targets = alert.symbols?.length ? alert.symbols.map(s => s.replace("USDT", "")) : (alert.symbol === "GLOBAL" ? Object.keys(prices || {}) : [alert.symbol]);
                let isOverallTriggered = false;
                let triggeredSymbolForAlert = "";

                for (const sym of targets) {
                    const price = prices[sym];
                    if (!price) continue;
                    const results = alert.conditions.map(cond => {
                        if (cond.type === "price_above") return price >= cond.target;
                        if (cond.type === "price_below") return price <= cond.target;
                        if (cond.type === "vol_spike") return metrics?.[sym]?.rvol >= cond.target;
                        if (cond.type === "oi_spike") return metrics?.[sym]?.oiChange1h >= cond.target;
                        if (cond.type === "pump") return metrics?.[sym]?.change5m >= cond.target;
                        if (cond.type === "dump") return metrics?.[sym]?.change5m <= -cond.target;
                        if (cond.type === "squeeze") return metrics?.[sym]?.momentumScore >= cond.target;
                        const m = metrics?.[sym];
                        if (!m) return false;
                        const op = cond.operator || "gt";
                        const isOutside = (v: number, lo: number, hi: number) => v < lo || v > hi;
                        if (cond.type === "trd_15m") return op === "gt" ? (m.trades15m || 0) >= cond.target : op === "lt" ? (m.trades15m || 0) <= cond.target : isOutside(m.trades15m || 0, cond.targetMin ?? cond.target, cond.targetMax ?? cond.target);
                        if (cond.type === "chg_15m") return op === "gt" ? (m.change15m || 0) >= cond.target : op === "lt" ? (m.change15m || 0) <= cond.target : isOutside(m.change15m || 0, cond.targetMin ?? -999, cond.targetMax ?? 999);
                        if (cond.type === "chg_5m") return op === "gt" ? (m.change5m || 0) >= cond.target : op === "lt" ? (m.change5m || 0) <= cond.target : isOutside(m.change5m || 0, cond.targetMin ?? -999, cond.targetMax ?? 999);
                        if (cond.type === "rvol") return (m.rvol || 0) >= cond.target;
                        if (cond.type === "oi") return (m.openInterest || 0) >= (cond.target >= 1 ? cond.target * 1e6 : cond.target * 1e3);
                        if (cond.type === "oi_chg_15m" || cond.type === "oi_chg_1h") return op === "gt" ? (m.oiChange1h || 0) >= cond.target : op === "lt" ? (m.oiChange1h || 0) <= cond.target : isOutside(m.oiChange1h || 0, cond.targetMin ?? -999, cond.targetMax ?? 999);
                        if (cond.type === "vlt_15m") return (m.volatility15m || 0) >= cond.target;
                        if (cond.type === "funding") return op === "gt" ? ((m.fundingRate || 0) * 100) >= cond.target : ((m.fundingRate || 0) * 100) <= cond.target;
                        if (cond.type === "cvd_15m") {
                            const v = (m as { cvd15m?: number }).cvd15m ?? 0;
                            const t = (cond.target ?? 0) * 1000;
                            const tMin = (cond.targetMin ?? -1e6) * 1000;
                            const tMax = (cond.targetMax ?? 1e6) * 1000;
                            return op === "gt" ? v >= t : op === "lt" ? v <= t : isOutside(v, tMin, tMax);
                        }
                        if (cond.type === "mcap") {
                            const v = (m as { mcap?: number }).mcap ?? 0;
                            const t = (cond.target ?? 0) * 1e6;
                            const tMin = (cond.targetMin ?? 0) * 1e6;
                            const tMax = (cond.targetMax ?? 1e9) * 1e6;
                            return op === "gt" ? v >= t : op === "lt" ? v <= t : isOutside(v, tMin, tMax);
                        }
                        return false;
                    });
                    const isTriggered = alert.logic === "AND" ? results.every(r => r === true) : results.some(r => r === true);
                    if (isTriggered) {
                        isOverallTriggered = true;
                        triggeredSymbolForAlert = sym;
                        break;
                    }
                }
                if (isOverallTriggered) {
                    const now = Date.now();
                    const last = lastTriggeredRef.current.get(alert.id) ?? 0;
                    if (now - last < ALERT_COOLDOWN_MS) return alert;
                    lastTriggeredRef.current.set(alert.id, now);
                    const sym = triggeredSymbolForAlert || (alert.symbol as string);
                    const msg = `${alert.symbol === "GLOBAL" ? `Global Alert (${triggeredSymbolForAlert})` : alert.symbol} triggered!`;
                    const price = (prices || {})[sym] || 0;
                    triggered.push(msg);
                    addSignal({
                        symbol: sym,
                        type: "trend_shift",
                        intensity: 100,
                        timestamp: now,
                        price,
                        message: msg,
                    });
                    pushScreenerTriggerToMain(sym, msg, price);
                    return { ...alert, active: alert.repeat ? true : false, triggeredCount: (alert.triggeredCount || 0) + 1 };
                }
                return alert;
            });
            if (triggered.length > 0) {
                try {
                    const raw = JSON.stringify(updatedAlerts);
                    localStorage.setItem(ALERTS_KEY, raw);
                    setValueWithCloud(ALERTS_KEY, raw, user?.id ?? null, cloudSyncEnabled);
                    const settings = localStorage.getItem("screener_alert_settings");
                    const useBrowserNotif = settings ? JSON.parse(settings).browserNotifications === true : false;
                    if (useBrowserNotif && "Notification" in window && Notification.permission === "granted") {
                        triggered.forEach(msg => new Notification("Screener Alert", { body: msg }));
                    }
                } catch {}
                return updatedAlerts;
            }
            return prev;
        });
    }, [addSignal, user?.id, cloudSyncEnabled]);

    const detectSignals = useCallback((prices: Record<string, number>, metrics: Record<string, any>) => {
        if (!metrics || typeof metrics !== "object") return;
        setSignals(prev => {
            const next = [...prev];
            Object.entries(metrics).forEach(([sym, metric]) => {
                if (metric.change5m > 0.8) {
                    const signalPrice = (prices || {})[sym];
                    const exists = next.find(s => s?.symbol === sym && s?.type === "breakout_up" && Date.now() - s.timestamp < 300000);
                    if (!exists) {
                        next.unshift({
                            id: Math.random().toString(36).substr(2, 9),
                            symbol: sym,
                            type: "breakout_up",
                            intensity: Math.min(metric.change5m * 10, 100),
                            timestamp: Date.now(),
                            price: signalPrice,
                            message: `${sym} is breaking out! Momentum surge detected.`,
                        });
                    }
                }
                if (metric.momentumScore > 90) {
                    const exists = next.find(s => s?.symbol === sym && s?.type === "trend_shift" && Date.now() - s.timestamp < 420000);
                    if (!exists) {
                        next.unshift({
                            id: Math.random().toString(36).substr(2, 9),
                            symbol: sym,
                            type: "trend_shift",
                            intensity: metric.momentumScore,
                            timestamp: Date.now(),
                            price: (prices || {})[sym],
                            message: `${sym} showing extreme buyer conviction (Algorithmic Squeeze).`,
                        });
                    }
                }
            });
            const trimmed = next.slice(0, 50);
            const raw = JSON.stringify(trimmed);
            localStorage.setItem(SIGNALS_KEY, raw);
            setValueWithCloud(SIGNALS_KEY, raw, user?.id ?? null, cloudSyncEnabled);
            return trimmed;
        });
    }, [user?.id, cloudSyncEnabled]);

    const value: AlertsContextValue = {
        alerts,
        signals,
        addAlert,
        updateAlert,
        toggleAlert,
        removeAlert,
        clearSignals,
        addSignal,
        checkAlerts,
        detectSignals,
    };

    return (
        <AlertsContext.Provider value={value}>
            {children}
        </AlertsContext.Provider>
    );
}

export function useAlertsContext() {
    return React.useContext(AlertsContext);
}
