import { useQuery } from '@tanstack/react-query';
import { normalizeSymbol } from '@/lib/utils/normalization';
import { SYMBOL_TO_ID } from '@/lib/api/prices';

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

interface HistoryPoint {
    date: number;
    price: number;
}

export function useAssetHistory(symbol: string, days: number = 30) {
    const normalizedSymbol = normalizeSymbol(symbol);

    // Try to find ID in our map, otherwise assume lowercase symbol (fallback)
    // Note: This fallback is weak for many coins, but better than nothing.
    // Ideally we'd search for the coin if not in map, but that requires another API call.
    const coingeckoId = SYMBOL_TO_ID[normalizedSymbol] ||
        SYMBOL_TO_ID[normalizedSymbol.toUpperCase()] ||
        normalizedSymbol.toLowerCase();

    return useQuery({
        queryKey: ['assetHistory', normalizedSymbol, days],
        queryFn: async () => {
            if (!coingeckoId) throw new Error('Symbol ID not found');

            // Add slight delay to prevent rate limits if multiple widgets load
            await new Promise(r => setTimeout(r, Math.random() * 1000));

            const res = await fetch(
                `${COINGECKO_API}/coins/${coingeckoId}/market_chart?vs_currency=usd&days=${days}&interval=${days > 1 ? 'daily' : 'hourly'}`
            );

            if (!res.ok) {
                if (res.status === 429) {
                    throw new Error('Rate limited by CoinGecko');
                }
                throw new Error(`Failed to fetch history for ${symbol}`);
            }

            const data = await res.json();

            if (!data.prices) return [];

            return data.prices.map(([date, price]: [number, number]) => ({
                date,
                price
            })) as HistoryPoint[];
        },
        enabled: !!symbol && !!coingeckoId,
        staleTime: 1000 * 60 * 30, // Cache for 30 minutes
        retry: 1,
    });
}
