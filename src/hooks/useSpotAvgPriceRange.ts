"use client";

import { useState, useEffect } from "react";
import {
    getSpotAvgPriceRange,
    getSpotAvgPriceRangeMs,
    setSpotAvgPriceRange,
    type SpotAvgPriceRange,
} from "@/lib/spot-avg-price-range";

export function useSpotAvgPriceRange(): SpotAvgPriceRange & {
    fromMs: number;
    toMs: number;
    hasRange: boolean;
    setRange: (r: SpotAvgPriceRange) => void;
} {
    const [range, setRangeState] = useState<SpotAvgPriceRange>(getSpotAvgPriceRange);
    const { fromMs, toMs, hasRange } = getSpotAvgPriceRangeMs();

    useEffect(() => {
        const sync = () => setRangeState(getSpotAvgPriceRange());
        window.addEventListener("spot_avg_price_range", sync);
        return () => window.removeEventListener("spot_avg_price_range", sync);
    }, []);

    const setRange = (r: SpotAvgPriceRange) => {
        setSpotAvgPriceRange(r);
        setRangeState(r);
    };

    return {
        ...range,
        fromMs,
        toMs,
        hasRange,
        setRange,
    };
}
