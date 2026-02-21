import { useRealtimeMarket } from './useRealtimeMarket';
import { normalizeSymbol } from '@/lib/utils/normalization';
import { useMemo } from 'react';

export function useLivePrices(symbols: string[]) {
    const requestedSymbols = useMemo(() => {
        const out = new Set<string>();
        (symbols || []).forEach((sym) => {
            const norm = normalizeSymbol(sym);
            if (norm) out.add(norm);
            if (sym) out.add(sym);
            if (norm === 'WETH') out.add('ETH');
            if (norm === 'WBTC') out.add('BTC');
        });
        return Array.from(out);
    }, [symbols]);

    // Subscribe only to requested symbols to avoid full-market state churn.
    const { prices, stats } = useRealtimeMarket(requestedSymbols);

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
