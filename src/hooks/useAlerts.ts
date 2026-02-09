"use client";

import { useState, useEffect } from "react";

export interface AlertCondition {
    type: "price_above" | "price_below" | "vol_spike" | "oi_spike";
    target: number;
}

export interface Alert {
    id: string;
    symbol: string | "GLOBAL";
    conditions: AlertCondition[];
    logic: "AND" | "OR";
    active: boolean;
    createdAt: number;
}

export function useAlerts() {
    const [alerts, setAlerts] = useState<Alert[]>([]);

    useEffect(() => {
        const saved = localStorage.getItem("portfolio_alerts");
        if (saved) {
            try {
                setAlerts(JSON.parse(saved));
            } catch (e) {
                console.warn("Failed to parse alerts", e);
            }
        }
    }, []);

    const saveAlerts = (newAlerts: Alert[]) => {
        setAlerts(newAlerts);
        localStorage.setItem("portfolio_alerts", JSON.stringify(newAlerts));
    };

    const addAlert = (symbol: string | "GLOBAL", conditions: AlertCondition[], logic: "AND" | "OR" = "AND") => {
        const newAlert: Alert = {
            id: Math.random().toString(36).substr(2, 9),
            symbol,
            conditions,
            logic,
            active: true,
            createdAt: Date.now(),
        };
        saveAlerts([...alerts, newAlert]);
    };

    const toggleAlert = (id: string) => {
        saveAlerts(alerts.map(a => a.id === id ? { ...a, active: !a.active } : a));
    };

    const removeAlert = (id: string) => {
        saveAlerts(alerts.filter(a => a.id !== id));
    };

    const checkAlerts = (prices: Record<string, number>, metrics?: Record<string, any>) => {
        const triggered: string[] = [];
        const updatedAlerts = alerts.map(alert => {
            if (!alert.active) return alert;

            const targets = alert.symbol === "GLOBAL" ? Object.keys(prices) : [alert.symbol];
            let isOverallTriggered = false;
            let triggeredSymbol = "";

            for (const sym of targets) {
                const price = prices[sym];
                if (!price) continue;

                const results = alert.conditions.map(cond => {
                    if (cond.type === "price_above") return price >= cond.target;
                    if (cond.type === "price_below") return price <= cond.target;
                    // Potential for volume/OI spike triggers if metrics provided
                    if (metrics && metrics[sym]) {
                        if (cond.type === "vol_spike") return metrics[sym].rvol >= cond.target;
                        if (cond.type === "oi_spike") return metrics[sym].oiChange1h >= cond.target;
                    }
                    return false;
                });

                const isTriggered = alert.logic === "AND"
                    ? results.every(r => r === true)
                    : results.some(r => r === true);

                if (isTriggered) {
                    isOverallTriggered = true;
                    triggeredSymbol = sym;
                    break;
                }
            }

            if (isOverallTriggered) {
                triggered.push(`${alert.symbol === "GLOBAL" ? `Global Alert (${triggeredSymbol})` : alert.symbol} triggered!`);
                return { ...alert, active: false };
            }
            return alert;
        });

        if (triggered.length > 0) {
            saveAlerts(updatedAlerts);
            triggered.forEach(msg => {
                if ("Notification" in window && Notification.permission === "granted") {
                    new Notification("Market Alert", { body: msg });
                } else {
                    alert(msg);
                }
            });
        }
    };

    return { alerts, addAlert, toggleAlert, removeAlert, checkAlerts };
}
