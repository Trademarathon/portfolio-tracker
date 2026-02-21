"use client";

import { useState, useEffect } from "react";
import { useAlertsContext } from "@/contexts/AlertsContext";

// Orion-style condition types
export type AlertConditionType =
    | "trd_15m"      // TRD 15M - trades
    | "chg_15m"      // CHG % 15M
    | "chg_5m"       // CHG % 5m
    | "rvol"         // RVOL - relative volume
    | "oi"           // OI - open interest $
    | "oi_chg_15m"   // OI CHG % 15M
    | "oi_chg_1h"    // OI CHG % 1h
    | "vlt_15m"      // VLT 15M - volatility
    | "funding"      // FUNDING
    | "price_above"  // Price above
    | "price_below"  // Price below
    | "cvd_15m"      // CVD 15M - cumulative volume delta $ (target in K, e.g. 500 = $500K)
    | "mcap";        // MCAP - market cap $ (target in M, e.g. 50 = $50M)

export type AlertConditionOperator = "gt" | "lt" | "outside";

export interface AlertCondition {
    type: AlertConditionType | "vol_spike" | "oi_spike" | "squeeze" | "breakout" | "pump" | "dump";
    target: number;
    targetMin?: number;  // for outside range
    targetMax?: number;  // for outside range
    operator?: AlertConditionOperator;
    timeframe?: "1m" | "5m" | "15m" | "1h";
}

export interface Signal {
    id: string;
    symbol: string;
    type: "squeeze" | "breakout_up" | "breakout_down" | "massive_buy" | "massive_sell" | "trend_shift";
    intensity: number; // 0-100
    timestamp: number;
    price: number;
    message: string;
}

export interface Alert {
    id: string;
    symbol: string | "GLOBAL";
    symbols?: string[];  // multiple symbols e.g. ["BTCUSDT","ETHUSDT"]
    name?: string;
    exchange?: string;
    conditions: AlertCondition[];
    logic: "AND" | "OR";
    active: boolean;
    createdAt: number;
    repeat?: boolean;
    sound?: boolean;
    triggeredCount?: number;
}

export function useAlerts() {
    const ctx = useAlertsContext();
    const [alerts, setAlerts] = useState<Alert[]>(() => {
        if (ctx) return [];
        try {
            const saved = localStorage.getItem("portfolio_alerts");
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch { }
        return [];
    });
    const [signals, setSignals] = useState<Signal[]>(() => {
        if (ctx) return [];
        try {
            const saved = localStorage.getItem("portfolio_signals");
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) return parsed.slice(0, 50);
            }
        } catch { }
        return [];
    });

    if (ctx) return ctx;

    const saveAlerts = (newAlerts: Alert[]) => {
        setAlerts(newAlerts || []);
        localStorage.setItem("portfolio_alerts", JSON.stringify(newAlerts || []));
    };

    const addAlert = (symbol: string | "GLOBAL", conditions: AlertCondition[], logic: "AND" | "OR" = "AND", opts?: { name?: string; exchange?: string; repeat?: boolean; sound?: boolean; symbols?: string[] }) => {
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
        saveAlerts([...(alerts || []), newAlert]);
    };

    const updateAlert = (id: string, updates: Partial<Alert>) => {
        saveAlerts((alerts || []).map(a => a.id === id ? { ...a, ...updates } : a));
    };

    const toggleAlert = (id: string) => {
        saveAlerts((alerts || []).map(a => a.id === id ? { ...a, active: !a.active } : a));
    };

    const removeAlert = (id: string) => {
        saveAlerts((alerts || []).filter(a => a.id !== id));
    };

    const clearSignals = () => {
        setSignals([]);
        localStorage.removeItem("portfolio_signals");
    };

    const addSignal = (signal: Omit<Signal, "id">) => {
        const newSignal: Signal = {
            ...signal,
            id: Math.random().toString(36).substr(2, 9),
        };
        setSignals(prev => {
            const updated = [newSignal, ...prev].slice(0, 50);
            localStorage.setItem("portfolio_signals", JSON.stringify(updated));
            return updated;
        });
    };

    const checkAlerts = (prices: Record<string, number>, metrics?: Record<string, any>) => {
        if (!prices || typeof prices !== 'object') return;
        const triggered: string[] = [];
        const updatedAlerts = (alerts || []).map(alert => {
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
                    // Orion-style
                    const m = metrics?.[sym];
                    if (!m) return false;
                    const op = cond.operator || "gt";
                    const isOutside = (v: number, lo: number, hi: number) => v < lo || v > hi;
                    if (cond.type === "trd_15m") return op === "gt" ? (m.trades15m || 0) >= cond.target : op === "lt" ? (m.trades15m || 0) <= cond.target : isOutside(m.trades15m || 0, cond.targetMin ?? cond.target, cond.targetMax ?? cond.target);
                    if (cond.type === "chg_15m") return op === "gt" ? (m.change15m || 0) >= cond.target : op === "lt" ? (m.change15m || 0) <= cond.target : isOutside(m.change15m || 0, cond.targetMin ?? -999, cond.targetMax ?? 999);
                    if (cond.type === "chg_5m") return op === "gt" ? (m.change5m || 0) >= cond.target : op === "lt" ? (m.change5m || 0) <= cond.target : isOutside(m.change5m || 0, cond.targetMin ?? -999, cond.targetMax ?? 999);
                    if (cond.type === "rvol") return (m.rvol || 0) >= cond.target;
                    if (cond.type === "oi") return (m.openInterest || 0) >= (cond.target >= 1 ? cond.target * 1e6 : cond.target * 1e3); // $M or $K
                    if (cond.type === "oi_chg_15m" || cond.type === "oi_chg_1h") return op === "gt" ? (m.oiChange1h || 0) >= cond.target : op === "lt" ? (m.oiChange1h || 0) <= cond.target : isOutside(m.oiChange1h || 0, cond.targetMin ?? -999, cond.targetMax ?? 999);
                    if (cond.type === "vlt_15m") return (m.volatility15m || 0) >= cond.target;
                    if (cond.type === "funding") return op === "gt" ? ((m.fundingRate || 0) * 100) >= cond.target : ((m.fundingRate || 0) * 100) <= cond.target;
                    // CVD 15M: value in $, target in K (500 = $500K); no data yet => 0
                    if (cond.type === "cvd_15m") {
                        const v = (m as { cvd15m?: number }).cvd15m ?? 0;
                        const t = (cond.target ?? 0) * 1000;
                        const tMin = ((cond.targetMin ?? -1e6) * 1000);
                        const tMax = ((cond.targetMax ?? 1e6) * 1000);
                        return op === "gt" ? v >= t : op === "lt" ? v <= t : isOutside(v, tMin, tMax);
                    }
                    // MCAP: value in $, target in M (50 = $50M); no data yet => 0
                    if (cond.type === "mcap") {
                        const v = (m as { mcap?: number }).mcap ?? 0;
                        const t = (cond.target ?? 0) * 1e6;
                        const tMin = ((cond.targetMin ?? 0) * 1e6);
                        const tMax = ((cond.targetMax ?? 1e9) * 1e6);
                        return op === "gt" ? v >= t : op === "lt" ? v <= t : isOutside(v, tMin, tMax);
                    }
                    return false;
                });

                const isTriggered = alert.logic === "AND"
                    ? results.every(r => r === true)
                    : results.some(r => r === true);

                if (isTriggered) {
                    isOverallTriggered = true;
                    triggeredSymbolForAlert = sym;
                    break;
                }
            }

            if (isOverallTriggered) {
                const msg = `${alert.symbol === "GLOBAL" ? `Global Alert (${triggeredSymbolForAlert})` : alert.symbol} triggered!`;
                triggered.push(msg);

                // Add to signals feed automatically
                if (typeof addSignal === 'function') {
                    addSignal({
                        symbol: triggeredSymbolForAlert || (alert.symbol as string),
                        type: "trend_shift",
                        intensity: 100,
                        timestamp: Date.now(),
                        price: (prices || {})[triggeredSymbolForAlert || (alert.symbol as string)] || 0,
                        message: msg
                    });
                }

                return { ...alert, active: alert.repeat ? true : false, triggeredCount: (alert.triggeredCount || 0) + 1 };
            }
            return alert;
        });

        if (triggered.length > 0) {
            saveAlerts(updatedAlerts);
            let useBrowserNotif = false;
            try {
                const settings = localStorage.getItem("screener_alert_settings");
                if (settings) useBrowserNotif = JSON.parse(settings).browserNotifications === true;
            } catch { }
            triggered.forEach(msg => {
                if (useBrowserNotif && "Notification" in window && Notification.permission === "granted") {
                    new Notification("Screener Alert", { body: msg });
                }
            });
        }
    };

    const detectSignals = (prices: Record<string, number>, metrics: Record<string, any>) => {
        if (!metrics || typeof metrics !== 'object') return;

        Object.entries(metrics).forEach(([sym, metric]) => {
            // 1. Sudden Pump (e.g. > 0.8% in small timeframe estimate)
            if (metric.change5m > 0.8) {
                const signalPrice = (prices || {})[sym];
                const exists = (signals || []).find(s => s && s.symbol === sym && s.type === 'breakout_up' && Date.now() - s.timestamp < 300000);
                if (!exists) {
                    addSignal({
                        symbol: sym,
                        type: "breakout_up",
                        intensity: Math.min(metric.change5m * 10, 100),
                        timestamp: Date.now(),
                        price: signalPrice,
                        message: `${sym} is breaking out! Momentum surge detected.`
                    });
                }
            }

            // 2. High Momentum (Squeeze/Explosion)
            if (metric.momentumScore > 90) {
                const exists = (signals || []).find(s => s && s.symbol === sym && s.type === 'trend_shift' && Date.now() - s.timestamp < 420000);
                if (!exists) {
                    addSignal({
                        symbol: sym,
                        type: "trend_shift",
                        intensity: metric.momentumScore,
                        timestamp: Date.now(),
                        price: (prices || {})[sym],
                        message: `${sym} showing extreme buyer conviction (Algorithmic Squeeze).`
                    });
                }
            }
        });
    };

    return { alerts, signals, addAlert, updateAlert, toggleAlert, removeAlert, checkAlerts, addSignal, detectSignals, clearSignals };
}
