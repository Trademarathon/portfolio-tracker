import { useRealtimeMarket } from './useRealtimeMarket';

export function useLivePrices(symbols: string[]) {
    const { prices, stats } = useRealtimeMarket(symbols);

    // Map stats to old priceChanges format
    const priceChanges: Record<string, number> = {};
    Object.keys(stats).forEach(sym => {
        priceChanges[sym] = stats[sym].change24h;
    });

    return { prices, priceChanges };
}
