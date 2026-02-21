"use client";

import { useState, useCallback, useEffect } from "react";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { getValueWithCloud, setValueWithCloud } from "@/lib/supabase/sync";

const STORAGE_KEY = "screener_ai_insight_symbols";
const DEFAULT_SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT"];

function normalizeBase(s: string): string {
    const u = (s || "").toUpperCase().replace(/\//g, "");
    return u.endsWith("USDT") ? u : u + "USDT";
}

function parseSymbols(raw: string | null): Set<string> {
    if (!raw) return new Set(DEFAULT_SYMBOLS);
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
            const arr = parsed.filter((x): x is string => typeof x === "string").map(normalizeBase);
            return new Set(arr.length ? arr : DEFAULT_SYMBOLS);
        }
    } catch { /* ignore */ }
    return new Set(DEFAULT_SYMBOLS);
}

function loadFromStorage(): Set<string> {
    if (typeof window === "undefined") return new Set(DEFAULT_SYMBOLS);
    return parseSymbols(localStorage.getItem(STORAGE_KEY));
}

export function useScreenerAiInsightSymbols(): [Set<string>, (symbolBase: string) => void] {
    const { user, cloudSyncEnabled } = useSupabaseAuth();
    const [symbols, setSymbols] = useState<Set<string>>(loadFromStorage);

    // When sync is on, hydrate from cloud so list is stable across tabs/navigation
    useEffect(() => {
        if (!user?.id || !cloudSyncEnabled) return;
        let cancelled = false;
        getValueWithCloud(STORAGE_KEY, user.id, true).then((raw) => {
            if (cancelled) return;
            setSymbols(parseSymbols(raw));
        });
        return () => { cancelled = true; };
    }, [user?.id, cloudSyncEnabled]);

    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY && e.newValue) {
                setSymbols(parseSymbols(e.newValue));
            }
        };
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, []);

    const toggle = useCallback((symbolBase: string) => {
        const base = normalizeBase(symbolBase);
        setSymbols(prev => {
            const next = new Set(prev);
            if (next.has(base)) next.delete(base);
            else next.add(base);
            const raw = JSON.stringify([...next]);
            try {
                localStorage.setItem(STORAGE_KEY, raw);
            } catch { /* ignore */ }
            if (user?.id && cloudSyncEnabled) {
                setValueWithCloud(STORAGE_KEY, raw, user.id, true).catch(() => {});
            }
            return next;
        });
    }, [user?.id, cloudSyncEnabled]);

    return [symbols, toggle];
}
