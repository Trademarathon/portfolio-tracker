"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import type { TickerData } from "@/hooks/useRealtimeMarket";
import type { AlphaSignalExport } from "@/components/Dashboard/NeuralAlphaFeed";
import {
    getMovementAlertsSettings,
    MOVEMENT_ALERTS_CACHE_KEY,
} from "@/lib/movementAlertsSettings";

const STABLES = ["USDT", "USDC", "DAI", "BUSD", "TUSD", "FRAX"];
const SYMBOL_RE = /^[A-Z][A-Z0-9]{1,14}$/;

function isTrackableSymbol(symbol: string): boolean {
    const s = (symbol || "").toUpperCase().trim();
    if (!s) return false;
    if (s.startsWith("@")) return false;
    if (/^\d+$/.test(s)) return false;
    return SYMBOL_RE.test(s);
}

function momentumScore(change24h: number, volume24h: number): number {
    return change24h * Math.log10(volume24h + 1);
}

function loadPersistedAlerts(): AlphaSignalExport[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem(MOVEMENT_ALERTS_CACHE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as AlphaSignalExport[];
        const cutoff = Date.now() - 60 * 60 * 1000; // 1h max
        return (Array.isArray(parsed) ? parsed : [])
            .filter((s) => s?.timestamp >= cutoff)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 30);
    } catch {
        return [];
    }
}

function savePersistedAlerts(list: AlphaSignalExport[]) {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(MOVEMENT_ALERTS_CACHE_KEY, JSON.stringify(list.slice(0, 30)));
    } catch (e) {
        console.warn("[MovementAlerts] Failed to persist", e);
    }
}

export function useMovementAlerts(
    symbols: string[],
    stats: Record<string, TickerData>
): AlphaSignalExport[] {
    const lastEmittedRef = useRef<Map<string, number>>(new Map());
    const [accumulated, setAccumulated] = useState<AlphaSignalExport[]>(loadPersistedAlerts);
    const [settings, setSettings] = useState(getMovementAlertsSettings);

    useEffect(() => {
        const handler = () => setSettings(getMovementAlertsSettings());
        window.addEventListener("movement-alerts-settings-changed", handler);
        return () => window.removeEventListener("movement-alerts-settings-changed", handler);
    }, []);

    const newSignals = useMemo(() => {
        if (!settings.enabled) return [];
        const out: AlphaSignalExport[] = [];
        const now = Date.now();
        const dedupeMs = settings.dedupeWindowMinutes * 60 * 1000;
        const effective = {
            ...settings,
            // Make defaults practical in live use even when old strict values are persisted.
            imminentMomentum: Math.min(settings.imminentMomentum, 45),
            breakUp1h: Math.min(settings.breakUp1h, 0.6),
            breakDown1h: Math.max(settings.breakDown1h, -0.6),
            goingUp1h: Math.min(settings.goingUp1h, 0.2),
            goingDown1h: Math.max(settings.goingDown1h, -0.2),
            extreme24hUp: Math.min(settings.extreme24hUp, 5),
            extreme24hDown: Math.max(settings.extreme24hDown, -5),
        };

        const relevantSymbols = symbols.filter(
            (s) => s && isTrackableSymbol(s) && !STABLES.includes(s.toUpperCase())
        );
        if (relevantSymbols.length === 0) return out;

        const typeEnabled = (type: string) => {
            const map: Record<string, keyof typeof settings.types> = {
                IMMINENT_MOVEMENT: "imminentMovement",
                BREAK_UP: "breakUp",
                BREAK_DOWN: "breakDown",
                GOING_UP: "goingUp",
                GOING_DOWN: "goingDown",
                EXTREME_UP: "extremeUp",
                EXTREME_DOWN: "extremeDown",
            };
                const key = map[type];
            return key ? effective.types[key] : true;
        };

        for (const sym of relevantSymbols) {
            const ticker = stats[sym];
            if (!ticker) continue;

            const { change24h, change1h, volume24h } = ticker;
            const mom = momentumScore(change24h, volume24h);

            const dedupeKey = (type: string) => `mov-${sym}-${type}`;
            const canEmit = (type: string) => {
                const key = dedupeKey(type);
                const last = lastEmittedRef.current.get(key) ?? 0;
                if (now - last < dedupeMs) return false;
                lastEmittedRef.current.set(key, now);
                return true;
            };

            const addSignal = (
                type: AlphaSignalExport["type"],
                title: string,
                desc: string,
                confidence?: number,
                priority: "high" | "medium" | "low" = "medium"
            ) => {
                if (!typeEnabled(type) || !canEmit(type)) return;
                out.push({
                    id: `mov-${sym}-${type}-${now}`,
                    type,
                    symbol: sym,
                    title,
                    description: desc,
                    timestamp: now,
                    priority,
                    data: confidence != null ? { confidencePercent: confidence } : undefined,
                });
            };
            let emittedForSymbol = false;
            const emit = (
                type: AlphaSignalExport["type"],
                title: string,
                desc: string,
                confidence?: number,
                priority: "high" | "medium" | "low" = "medium"
            ) => {
                const before = out.length;
                addSignal(type, title, desc, confidence, priority);
                if (out.length > before) emittedForSymbol = true;
            };

            if (change24h > effective.extreme24hUp) {
                emit(
                    "EXTREME_UP",
                    `${sym} Extreme Up`,
                    `${sym} +${change24h.toFixed(1)}% in 24h. Strong bullish momentum.`,
                    Math.min(Math.round(change24h), 99),
                    "high"
                );
            }
            if (change24h < effective.extreme24hDown) {
                emit(
                    "EXTREME_DOWN",
                    `${sym} Extreme Down`,
                    `${sym} ${change24h.toFixed(1)}% in 24h. Significant bearish pressure.`,
                    Math.min(Math.round(Math.abs(change24h)), 99),
                    "high"
                );
            }

            if (change1h > effective.breakUp1h) {
                emit(
                    "BREAK_UP",
                    `${sym} Breaks Up`,
                    `Squeeze pattern breaking upwards. +${change1h.toFixed(1)}% in 1h.`,
                    Math.min(Math.round(change1h * 20), 99),
                    change1h > 3 ? "high" : "medium"
                );
            }
            if (change1h < effective.breakDown1h) {
                emit(
                    "BREAK_DOWN",
                    `${sym} Breaks Down`,
                    `Squeeze pattern breaking downwards. ${change1h.toFixed(1)}% in 1h.`,
                    Math.min(Math.round(Math.abs(change1h) * 20), 99),
                    change1h < -3 ? "high" : "medium"
                );
            }

            if (change1h > effective.goingUp1h && change1h <= effective.breakUp1h) {
                emit(
                    "GOING_UP",
                    `${sym} Going Up`,
                    `Short-term uptrend. +${change1h.toFixed(1)}% in 1h.`,
                    Math.min(Math.round(change1h * 25), 99)
                );
            }
            if (change1h < effective.goingDown1h && change1h >= effective.breakDown1h) {
                emit(
                    "GOING_DOWN",
                    `${sym} Going Down`,
                    `Short-term downtrend. ${change1h.toFixed(1)}% in 1h.`,
                    Math.min(Math.round(Math.abs(change1h) * 25), 99)
                );
            }

            if (mom > effective.imminentMomentum) {
                emit(
                    "IMMINENT_MOVEMENT",
                    `${sym} Imminent Movement`,
                    `High momentum detected. Price may be approaching a breakout.`,
                    Math.min(Math.round(mom / 1.2), 99),
                    mom > 120 ? "high" : "medium"
                );
            }

            // Volume expansion signal (previously missing): helps surface alerts in normal markets.
            if (volume24h > 5_000_000 && Math.abs(change1h) >= 0.15) {
                emit(
                    "SUDDEN_VOLUME",
                    `${sym} Volume Expansion`,
                    `Active flow detected: ${change1h >= 0 ? "+" : ""}${change1h.toFixed(2)}% in 1h with elevated volume.`,
                    Math.min(Math.round(Math.abs(change1h) * 40), 95),
                    Math.abs(change1h) > 1 ? "high" : "medium"
                );
            }

            // Baseline fallback so widget doesn't stay empty for long periods.
            if (!emittedForSymbol && Math.abs(change24h) >= 1.2) {
                if (change24h > 0) {
                    emit(
                        "GOING_UP",
                        `${sym} Trend Up`,
                        `${sym} is up ${change24h.toFixed(1)}% on 24h trend.`,
                        Math.min(Math.round(Math.abs(change24h) * 6), 90),
                        "low"
                    );
                } else {
                    emit(
                        "GOING_DOWN",
                        `${sym} Trend Down`,
                        `${sym} is down ${Math.abs(change24h).toFixed(1)}% on 24h trend.`,
                        Math.min(Math.round(Math.abs(change24h) * 6), 90),
                        "low"
                    );
                }
            }
        }

        return out;
    }, [symbols, stats, settings]);

    useEffect(() => {
        if (newSignals.length === 0) return;
        setAccumulated((prev) => {
            const merged = [...newSignals, ...prev];
            const cutoff = Date.now() - settings.maxAgeMinutes * 60 * 1000;
            const filtered = merged
                .filter((s) => s.timestamp >= cutoff)
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, 30);
            savePersistedAlerts(filtered);
            return filtered;
        });
    }, [newSignals, settings.maxAgeMinutes]);

    return useMemo(() => {
        const cutoff = Date.now() - settings.maxAgeMinutes * 60 * 1000;
        const filtered = accumulated
            .filter((s) => s.timestamp >= cutoff)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, settings.maxAlertsShown);
        return filtered;
    }, [accumulated, settings.maxAgeMinutes, settings.maxAlertsShown]);
}
