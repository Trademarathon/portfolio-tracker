/**
 * Shared date/time range for "Spot orders – average price" (Settings + ASSETS table).
 * Stored in localStorage so both Settings and HoldingsTable use the same range.
 */

export const SPOT_AVG_PRICE_RANGE_KEY = "spot_avg_price_range";

export type SpotAvgPriceRange = {
    fromDate: string;
    fromTime: string;
    toDate: string;
    toTime: string;
};

function getDefaultRange(): SpotAvgPriceRange {
    const now = new Date();
    const defaultFrom = new Date(2026, 0, 1, 0, 0, 0); // Jan 1, 2026
    const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59); // end of current month
    return {
        fromDate: defaultFrom.toISOString().slice(0, 10),
        fromTime: "00:00",
        toDate: defaultTo.toISOString().slice(0, 10),
        toTime: "23:59",
    };
}

export function getSpotAvgPriceRange(): SpotAvgPriceRange {
    if (typeof window === "undefined") return getDefaultRange();
    try {
        const raw = localStorage.getItem(SPOT_AVG_PRICE_RANGE_KEY);
        if (!raw) return getDefaultRange();
        const parsed = JSON.parse(raw) as Partial<SpotAvgPriceRange>;
        return {
            fromDate: parsed.fromDate ?? getDefaultRange().fromDate,
            fromTime: parsed.fromTime ?? "00:00",
            toDate: parsed.toDate ?? getDefaultRange().toDate,
            toTime: parsed.toTime ?? "23:59",
        };
    } catch {
        return getDefaultRange();
    }
}

export function setSpotAvgPriceRange(range: SpotAvgPriceRange): void {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(SPOT_AVG_PRICE_RANGE_KEY, JSON.stringify(range));
        window.dispatchEvent(new Event("spot_avg_price_range"));
    } catch {
        // ignore
    }
}

/** Returns fromMs, toMs and whether the range is valid (from < to). */
export function getSpotAvgPriceRangeMs(): { fromMs: number; toMs: number; hasRange: boolean } {
    const r = getSpotAvgPriceRange();
    const fromMs = new Date(r.fromDate + "T" + r.fromTime).getTime();
    const toMs = new Date(r.toDate + "T" + r.toTime).getTime();
    return { fromMs, toMs, hasRange: fromMs < toMs };
}
