"use client";

import type { EnhancedTickerData } from "@/hooks/useScreenerData";

export type InsightType = "pump" | "dump" | "neutral";

export interface ScreenerInsight {
    symbol: string;
    exchange: string;
    symbolKey: string;
    type: InsightType;
    reason: string;
    recommendation: string;
    timestamp: number;
}

export interface ScreenerInsightsOptions {
    /** When true, only include tickers that match the current preset (e.g. high-volume, big-movers) */
    presetMatch?: boolean;
    /** Preset label for reason text */
    presetLabel?: string;
}

export interface ScreenerVolatilitySignal {
    symbol: string;
    exchange: string;
    reason: string;
    timestamp: number;
    chg1h: number;
    volRatio: number;
    oiChange1h: number;
}

export function symbolToBase(symbol: string): string {
    const s = (symbol || "").toUpperCase().replace(/\//g, "");
    return s.endsWith("USDT") ? s : s + "USDT";
}

/**
 * Rule-based screener insights: high volume, high volatility, preset match.
 * Produces pump/dump reason and short recommendation text per ticker.
 */
export function getScreenerInsights(
    tickers: EnhancedTickerData[],
    options: ScreenerInsightsOptions = {}
): ScreenerInsight[] {
    const { presetMatch = false, presetLabel = "preset" } = options;
    const now = Date.now();
    const out: ScreenerInsight[] = [];

    for (const t of tickers || []) {
        if (!t?.symbol) continue;
        const symbolKey = `${t.symbol}-${t.exchange || "unknown"}`;
        const vol24 = t.volume24h ?? 0;
        const vol1h = (t as any).volume1h ?? vol24 / 24;
        const chg1h = t.change1h ?? 0;
        const chg24 = t.change24h ?? 0;

        const vlt = t.volatility15m ?? 0;
        const momentum = (t.momentumScore ?? 0) / 10;

        let type: InsightType = "neutral";
        let reason = "";
        let recommendation = "Watch for confirmation.";

        // High volume (relative) + positive move
        if (vol1h > 0 && vol24 > 10_000_000 && (chg1h > 1 || chg24 > 2)) {
            type = chg1h >= 0 && chg24 >= 0 ? "pump" : "dump";
            reason = type === "pump"
                ? "High volume with positive short-term move."
                : "High volume with negative move.";
            recommendation = type === "pump"
                ? "Consider momentum long with tight stop; check funding."
                : "Avoid new longs; consider hedging or reducing exposure.";
        }

        // High volatility
        if (!reason && vlt >= 2) {
            type = chg1h >= 0 ? "pump" : "dump";
            reason = `Elevated volatility (15m ${vlt.toFixed(2)}%).`;
            recommendation = "Reduce size or wait for volatility to settle before adding.";
        }

        // Strong momentum score
        if (!reason && momentum >= 0.8) {
            type = chg1h >= 0 ? "pump" : "dump";
            reason = `High relative volume / momentum (${momentum.toFixed(2)}x).`;
            recommendation = type === "pump"
                ? "Momentum long only with defined risk."
                : "Avoid chasing; wait for structure break.";
        }

        // Preset match (user filtered to this set)
        if (presetMatch && presetLabel !== "all") {
            if (!reason) {
                type = chg1h >= 0 ? "pump" : chg1h < 0 ? "dump" : "neutral";
                reason = `Matches ${presetLabel} filter.`;
                recommendation = "Filter match; confirm with volume and structure.";
            } else {
                reason += ` Matches ${presetLabel}.`;
            }
        }

        // Default for any ticker we're tracking
        if (!reason) {
            reason = "No strong signal.";
            if (chg1h > 0.5 || chg24 > 1) recommendation = "Slight bullish bias; monitor for breakout.";
            else if (chg1h < -0.5 || chg24 < -1) recommendation = "Slight bearish bias; avoid overexposure.";
        }

        out.push({
            symbol: t.symbol,
            exchange: t.exchange || "",
            symbolKey,
            type,
            reason,
            recommendation,
            timestamp: now,
        });
    }

    return out;
}

/** High-volatility screener signals with "how/why" explanations. */
export function getHighVolatilitySignals(tickers: EnhancedTickerData[]): ScreenerVolatilitySignal[] {
    const now = Date.now();
    const out: ScreenerVolatilitySignal[] = [];
    for (const t of tickers || []) {
        if (!t?.symbol) continue;
        const chg1h = t.change1h ?? 0;
        const vol1h = (t as any).volume1h ?? (t.volume24h || 0) / 24;
        const vol24 = t.volume24h || 0;
        const volRatio = vol24 > 0 ? vol1h / (vol24 / 24) : 0;
        const oiChange1h = (t as any).oiChange1h ?? 0;
        const isHigh =
            Math.abs(chg1h) >= 3 ||
            volRatio >= 2 ||
            Math.abs(oiChange1h) >= 4;
        if (!isHigh) continue;
        const reason = [
            `${chg1h >= 0 ? "+" : ""}${chg1h.toFixed(1)}% in 1h`,
            volRatio >= 2 ? `vol ${volRatio.toFixed(1)}x avg` : null,
            Math.abs(oiChange1h) >= 4 ? `OI ${oiChange1h >= 0 ? "+" : ""}${oiChange1h.toFixed(1)}%` : null,
        ]
            .filter(Boolean)
            .join(" · ");
        out.push({
            symbol: t.symbol,
            exchange: t.exchange || "",
            reason,
            timestamp: now,
            chg1h,
            volRatio,
            oiChange1h,
        });
    }
    return out;
}
