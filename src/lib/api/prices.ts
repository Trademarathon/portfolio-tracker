import { CryptoPrice } from './types';
import { ultraFetch, getLatencyTracker as _getLatencyTracker } from '@/lib/ultraFast';

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

// Map common symbols to CoinGecko IDs
export const SYMBOL_TO_ID: Record<string, string> = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'BNB': 'binancecoin',
    'SOL': 'solana',
    'XRP': 'ripple',
    'USDC': 'usd-coin',
    'USDT': 'tether',
    'ADA': 'cardano',
    'AVAX': 'avalanche-2',
    'DOGE': 'dogecoin',
    'DOT': 'polkadot',
    'TRX': 'tron',
    'LINK': 'chainlink',
    'MATIC': 'matic-network',
    'WBTC': 'wrapped-bitcoin',
    'UNI': 'uniswap',
    'LTC': 'litecoin',
    'DAI': 'dai',
    'BCH': 'bitcoin-cash',
    'ATOM': 'cosmos',
    'XLM': 'stellar',
    'ETC': 'ethereum-classic',
    'FIL': 'filecoin',
    'WHBAR': 'hbar',
    'HBAR': 'hbar',
    'ICP': 'internet-computer',
    'RUNE': 'thorchain',
    'NEAR': 'near',
    'LDO': 'lido-dao',
    'APT': 'aptos',
    'ARB': 'arbitrum',
    'OP': 'optimism',
    'TIA': 'celestia',
    'SUI': 'sui',
    'SEI': 'sei',
    'INJ': 'injective-protocol',
    'PEPE': 'pepe',
    'WIF': 'dogwifhat',
    'BONK': 'bonk',
    'FLOKI': 'floki',
    'SHIB': 'shiba-inu',
    'FTM': 'fantom',
    'VET': 'vechain',
    'RNDR': 'render-token',
    'MNT': 'mantle',
    'MKR': 'maker',
    'AAVE': 'aave',
    'SNX': 'havven',
    'ALGO': 'algorand',
    'AXS': 'axie-infinity',
    'SAND': 'the-sandbox',
    'EGLD': 'elrond-erd-2',
    'THETA': 'theta-token',
    'STX': 'blockstack',
    'IMX': 'immutable-x',
    'EOS': 'eos',
    'XTZ': 'tezos',
    'MANA': 'decentraland',
    'HYPE': 'hyperliquid',
    'PURR': 'purr',
    'HLP': 'hyperliquid-perpetual', // Approximation
    'TON': 'the-open-network',
    'DOGS': 'dogs-2',
    'NOT': 'notcoin',
    'CATI': 'catizen',
    'HMSTR': 'hamster-kombat'
};

export async function fetchSpecificPrices(symbols: string[]): Promise<CryptoPrice[]> {
    if (symbols.length === 0) return [];

    // Convert symbols to IDs (keep symbol -> id for fallback)
    const symbolToId = new Map<string, string>();
    const ids = symbols.map(s => {
        const upper = s.toUpperCase();
        const id = SYMBOL_TO_ID[upper] || s.toLowerCase();
        symbolToId.set(upper, id);
        return id;
    }).filter(Boolean);
    const uniqueIds = Array.from(new Set(ids));

    const results: CryptoPrice[] = [];
    const chunkSize = 50;

    for (let i = 0; i < uniqueIds.length; i += chunkSize) {
        const chunk = uniqueIds.slice(i, i + chunkSize);
        try {
            const url = `${COINGECKO_API}/coins/markets?vs_currency=usd&ids=${chunk.join(',')}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`;
            const response = await ultraFetch(url);
            if (response.ok) {
                const data = await response.json();
                results.push(...data.map((coin: any) => ({
                    ...coin,
                    symbol: (coin.symbol || '').toUpperCase()
                })));
            }
        } catch (e) {
            console.warn(`Failed to fetch specific batch ${i}:`, e);
        }
    }

    // Fallback: coins/markets often omits small-cap / TON tokens (e.g. DOGS). Use simple/price for any symbol we requested but didn't get.
    const gotSymbols = new Set(results.map(r => (r.symbol || '').toUpperCase()));
    const missing = symbols.map(s => s.toUpperCase()).filter(s => !gotSymbols.has(s));
    if (missing.length > 0) {
        try {
            const simple = await fetchSimplePrices(missing);
            Object.entries(simple).forEach(([sym, { price, change24h }]) => {
                if (price != null && price > 0) {
                    results.push({
                        id: symbolToId.get(sym) || sym.toLowerCase(),
                        symbol: sym,
                        name: sym,
                        current_price: price,
                        price_change_percentage_24h: change24h ?? 0,
                        market_cap: 0
                    } as CryptoPrice);
                }
            });
        } catch (e) {
            console.warn('Fallback simple/price for missing symbols failed:', e);
        }
    }

    return results;
}

/** Simple price fetch - lighter endpoint, good fallback when coins/markets fails */
export async function fetchSimplePrices(symbols: string[]): Promise<Record<string, { price: number; change24h: number }>> {
    if (symbols.length === 0) return {};
    const ids = symbols.map(s => SYMBOL_TO_ID[s.toUpperCase()] || s.toLowerCase()).filter(Boolean);
    const uniqueIds = Array.from(new Set(ids));
    try {
        const url = `${COINGECKO_API}/simple/price?ids=${uniqueIds.join(',')}&vs_currencies=usd&include_24hr_change=true`;
        const response = await ultraFetch(url);
        if (!response.ok) return {};
        const data = await response.json();
        const idToSymbol: Record<string, string> = {};
        for (const [sym, id] of Object.entries(SYMBOL_TO_ID)) {
            idToSymbol[id as string] = sym;
        }
        const result: Record<string, { price: number; change24h: number }> = {};
        for (const [id, val] of Object.entries(data as Record<string, { usd?: number; usd_24h_change?: number }>)) {
            const sym = idToSymbol[id] || id.toUpperCase();
            const v = val as { usd?: number; usd_24h_change?: number };
            if (v?.usd != null) result[sym] = { price: v.usd, change24h: v.usd_24h_change ?? 0 };
        }
        return result;
    } catch {
        return {};
    }
}

export async function getTopCoins(limit = 250): Promise<CryptoPrice[]> {
    try {
        const url = `${COINGECKO_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false&price_change_percentage=24h`;
        const response = await ultraFetch(url);

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
