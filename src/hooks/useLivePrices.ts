import { useRealtimeMarket } from './useRealtimeMarket';
import { normalizeSymbol } from '@/lib/utils/normalization';

export function useLivePrices(symbols: string[]) {
    // Pass empty array to get all prices, or optimize by passing normalized symbols if useRealtimeMarket supports filtering
    // useRealtimeMarket currently subscribes to ALL if undefined/empty, or filters outputs.
    // We want ALL prices so we can map WETH -> ETH
    const { prices, stats } = useRealtimeMarket();

    // Map prices to requested symbols
    const mappedPrices: Record<string, number> = {};
    const priceChanges: Record<string, number> = {};

    if (symbols && symbols.length > 0) {
        symbols.forEach(sym => {
            const norm = normalizeSymbol(sym);
            // Try normalized first, then direct
            const price = prices[norm] || prices[sym];
            const stat = stats[norm] || stats[sym];

            if (price) mappedPrices[sym] = price;
            if (stat) priceChanges[sym] = stat.change24h;
        });
    } else {
        // If no symbols provided, return all (raw)
        return { prices, priceChanges: {} };
    }

    return { prices: mappedPrices, priceChanges };
}
