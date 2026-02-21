"use client";

import { useState, useEffect, useMemo } from "react";
import { ultraFetchJson } from "@/lib/ultraFast";
import { getHyperliquidAllAssets } from "@/lib/api/hyperliquid";
import type { PortfolioConnection } from "@/lib/api/types";

export type PairWithExchange = { symbol: string; exchange: "binance" | "bybit" | "hyperliquid" };
const DEFAULT_BASES = [
    "BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "LINK", "AVAX", "DOT", "MATIC",
    "UNI", "ATOM", "LTC", "BCH", "NEAR", "FIL", "INJ", "TIA", "ARB", "OP",
    "SUI", "SEI", "PEPE", "WIF", "APT", "STX", "JUP", "WLD", "STRK",
];

/**
 * Normalize Hyperliquid symbols (e.g. BTC-PERP, BTC-SPOT) to unified USDT format
 * for consistency with Binance/Bybit. Keeps exact API names where already USDT.
 */
function normalizeToUsdt(s: string): string {
    const upper = s.toUpperCase();
    if (upper.endsWith("USDT")) return upper;
    if (upper.endsWith("-PERP") || upper.endsWith("-SPOT")) return upper.replace(/-PERP|-SPOT$/i, "") + "USDT";
    if (upper.endsWith("USDC") || upper.endsWith("USD")) return upper.replace(/USDC|USD$/i, "") + "USDT";
    return upper + "USDT";
}

/** Binance spot: exchangeInfo returns ALL listed pairs with exact tick names from API */
async function fetchBinanceSpot(): Promise<PairWithExchange[]> {
    try {
        const { data } = await ultraFetchJson<any>("https://api.binance.com/api/v3/exchangeInfo?permissions=SPOT");
        const symbols = data?.symbols;
        if (!Array.isArray(symbols)) return [];
        return symbols
            .filter((s: any) => s.status === "TRADING" && s.quoteAsset === "USDT")
            .map((s: any) => ({ symbol: s.symbol, exchange: "binance" as const }));
    } catch {
        return [];
    }
}

/** Binance perp: exchangeInfo returns ALL perpetual contracts with exact tick names from API */
async function fetchBinancePerp(): Promise<PairWithExchange[]> {
    try {
        const { data } = await ultraFetchJson<any>("https://fapi.binance.com/fapi/v1/exchangeInfo");
        const symbols = data?.symbols;
        if (!Array.isArray(symbols)) return [];
        return symbols
            .filter((s: any) => s.status === "TRADING" && s.quoteAsset === "USDT")
            .map((s: any) => ({ symbol: s.symbol, exchange: "binance" as const }));
    } catch {
        return [];
    }
}

/** Bybit spot: instruments-info returns ALL instruments with exact tick names from API */
async function fetchBybitSpot(): Promise<PairWithExchange[]> {
    try {
        const { data } = await ultraFetchJson<any>("https://api.bybit.com/v5/market/instruments-info?category=spot&limit=1000");
        const list = data?.result?.list;
        if (!Array.isArray(list)) return [];
        return list
            .filter((i: any) => i.status === "Trading" && i.quoteCoin === "USDT")
            .map((i: any) => ({ symbol: i.symbol, exchange: "bybit" as const }));
    } catch {
        return [];
    }
}

/** Bybit perp: instruments-info with pagination (linear can have 500+ symbols) */
async function fetchBybitPerp(): Promise<PairWithExchange[]> {
    const results: PairWithExchange[] = [];
    let cursor: string | undefined;
    try {
        do {
            const url = cursor
                ? `https://api.bybit.com/v5/market/instruments-info?category=linear&limit=1000&cursor=${encodeURIComponent(cursor)}`
                : "https://api.bybit.com/v5/market/instruments-info?category=linear&limit=1000";
            const { data } = await ultraFetchJson<any>(url);
            const list = data?.result?.list;
            const next = data?.result?.nextPageCursor;
            if (Array.isArray(list)) {
                list
                    .filter((i: any) => i.status === "Trading" && i.quoteCoin === "USDT")
                    .forEach((i: any) => results.push({ symbol: i.symbol, exchange: "bybit" as const }));
            }
            cursor = next && String(next).trim() ? next : undefined;
        } while (cursor);
    } catch {
        // Return what we have so far
    }
    return results;
}

/** Hyperliquid: spotMeta + perpsMeta yield real tick names; normalize for consistency */
async function fetchHyperliquidPairs(): Promise<{ spot: PairWithExchange[]; perp: PairWithExchange[] }> {
    try {
        const assets = await getHyperliquidAllAssets();
        const spot = (assets.spot || []).map((s) => ({ symbol: normalizeToUsdt(s), exchange: "hyperliquid" as const }));
        const perp = (assets.perp || []).map((s) => ({ symbol: normalizeToUsdt(s), exchange: "hyperliquid" as const }));
        return { spot, perp };
    } catch {
        return { spot: [], perp: [] };
    }
}

function buildFallbackPairs(exchanges: Array<"binance" | "bybit" | "hyperliquid">): PairWithExchange[] {
    const out: PairWithExchange[] = [];
    for (const base of DEFAULT_BASES) {
        const symbol = `${base}USDT`;
        for (const exchange of exchanges) out.push({ symbol, exchange });
    }
    return out;
}

export function useExchangePairs(connections: PortfolioConnection[]) {
    const [spotPairsWithExchange, setSpotPairsWithExchange] = useState<PairWithExchange[]>([]);
    const [perpPairsWithExchange, setPerpPairsWithExchange] = useState<PairWithExchange[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const enabledExchanges = useMemo(() => {
        return connections.filter(
            (c) => c.enabled !== false && ["binance", "bybit", "hyperliquid"].includes(c.type)
        );
    }, [connections]);

    const hasBinance = enabledExchanges.some((c) => c.type === "binance");
    const hasBybit = enabledExchanges.some((c) => c.type === "bybit");
    const hasHyperliquid = enabledExchanges.some((c) => c.type === "hyperliquid");

    const spotPairs = useMemo(() => [...new Set(spotPairsWithExchange.map((p) => p.symbol))].sort(), [spotPairsWithExchange]);
    const perpPairs = useMemo(() => [...new Set(perpPairsWithExchange.map((p) => p.symbol))].sort(), [perpPairsWithExchange]);

    useEffect(() => {
        if (enabledExchanges.length === 0) {
            setSpotPairsWithExchange([]);
            setPerpPairsWithExchange([]);
            setIsLoading(false);
            return;
        }

        let cancelled = false;
        setIsLoading(true);

        const run = async () => {
            const spotPromises: Promise<PairWithExchange[]>[] = [];
            const perpPromises: Promise<PairWithExchange[]>[] = [];

            if (hasBinance) {
                spotPromises.push(fetchBinanceSpot());
                perpPromises.push(fetchBinancePerp());
            }
            if (hasBybit) {
                spotPromises.push(fetchBybitSpot());
                perpPromises.push(fetchBybitPerp());
            }
            if (hasHyperliquid) {
                const hl = fetchHyperliquidPairs();
                spotPromises.push(hl.then((r) => r.spot));
                perpPromises.push(hl.then((r) => r.perp));
            }

            const [spotResults, perpResults] = await Promise.all([
                Promise.all(spotPromises),
                Promise.all(perpPromises),
            ]);

            if (cancelled) return;

            const connectedExchanges: Array<"binance" | "bybit" | "hyperliquid"> = [];
            if (hasBinance) connectedExchanges.push("binance");
            if (hasBybit) connectedExchanges.push("bybit");
            if (hasHyperliquid) connectedExchanges.push("hyperliquid");

            const spotFlat = spotResults.flat();
            const perpFlat = perpResults.flat();
            const fallback = buildFallbackPairs(connectedExchanges);

            // If network/CORS/API blocks pair discovery, still expose sensible symbols for all connected exchanges.
            setSpotPairsWithExchange(spotFlat.length > 0 ? spotFlat : fallback);
            setPerpPairsWithExchange(perpFlat.length > 0 ? perpFlat : fallback);
            setIsLoading(false);
        };

        run();
        return () => {
            cancelled = true;
        };
    }, [enabledExchanges.length, hasBinance, hasBybit, hasHyperliquid]);

    return {
        spotPairs,
        perpPairs,
        spotPairsWithExchange,
        perpPairsWithExchange,
        isLoading,
        hasConnectedExchanges: enabledExchanges.length > 0,
    };
}
