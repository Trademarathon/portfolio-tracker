
"use client";

import { useQuery } from "@tanstack/react-query";
import { getHyperliquidAllAssets } from "@/lib/api/hyperliquid";

export function useMarketsData() {
    return useQuery({
        queryKey: ['markets', 'hyperliquid'],
        queryFn: async () => {
            const data = await getHyperliquidAllAssets();
            // Flatten and clean symbols for display
            // Perps: "BTC-PERP" -> "BTC", type: "perp"
            // Spot: "HYPE-SPOT" -> "HYPE", type: "spot"

            const perps = data.perp.map(s => ({
                symbol: s.replace("-PERP", ""),
                fullSymbol: s,
                type: 'perp' as const
            }));

            const spots = data.spot.map(s => ({
                symbol: s.replace("-SPOT", ""),
                fullSymbol: s,
                type: 'spot' as const
            }));

            // Merge and dedup by symbol (prioritize perp or keep both?)
            // For a list, we might want unique rows.
            // If symbol exists in both, maybe we show "BTC" and it implies both?
            // Or show distinct rows? 
            // The Screener usually shows one row per asset with aggregated stats.

            const map = new Map<string, { symbol: string, types: string[] }>();

            [...perps, ...spots].forEach(item => {
                if (!map.has(item.symbol)) {
                    map.set(item.symbol, { symbol: item.symbol, types: [item.type] });
                } else {
                    map.get(item.symbol)?.types.push(item.type);
                }
            });

            return Array.from(map.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
        },
        staleTime: 1000 * 60 * 5, // 5 minutes cache
        refetchOnWindowFocus: false
    });
}
