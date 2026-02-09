import { CryptoPrice } from './types';

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

export async function getTopCoins(limit = 50, specificSymbols: string[] = []): Promise<CryptoPrice[]> {
    try {
        let url = `${COINGECKO_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false&price_change_percentage=24h`;

        // If specific symbols are provided, we need to map them to CoinGecko IDs or fetch by IDs if possible.
        // CoinGecko API requires 'ids' parameter for specific coins.
        // Mapping symbols to IDs is tricky without a full list. 
        // For now, let's just fetch a larger list (e.g. 250) to cover most.
        // Or better, use the 'ids' param if we have known mappings.
        // A simple robust fix for now: Fetch top 250.
        url = `${COINGECKO_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false&price_change_percentage=24h`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('Failed to fetch prices');
        }

        const data = await response.json();

        // Handle Capitalization for matching later
        return data.map((coin: any) => ({
            ...coin,
            symbol: coin.symbol.toUpperCase()
        }));

    } catch (error) {
        console.warn('Warning fetching prices:', error);
        return [];
    }
}
