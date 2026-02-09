import { CryptoPrice } from './types';

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
    'HLP': 'hyperliquid-perpetual' // Approximation
};

export async function fetchSpecificPrices(symbols: string[]): Promise<CryptoPrice[]> {
    if (symbols.length === 0) return [];

    // Convert symbols to IDs
    const ids = symbols.map(s => {
        const upper = s.toUpperCase();
        return SYMBOL_TO_ID[upper] || s.toLowerCase();
    }).filter(Boolean); // Remove empty

    const uniqueIds = Array.from(new Set(ids));

    // Chunk requests if too many (CG max ~50 per call ideally)
    const chunkSize = 50;
    const results: CryptoPrice[] = [];

    for (let i = 0; i < uniqueIds.length; i += chunkSize) {
        const chunk = uniqueIds.slice(i, i + chunkSize);
        try {
            const url = `${COINGECKO_API}/coins/markets?vs_currency=usd&ids=${chunk.join(',')}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`;
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                results.push(...data.map((coin: any) => ({
                    ...coin,
                    symbol: coin.symbol.toUpperCase()
                })));
            }
        } catch (e) {
            console.warn(`Failed to fetch specific batch ${i}:`, e);
        }
    }

    return results;
}

export async function getTopCoins(limit = 250): Promise<CryptoPrice[]> {
    try {
        let url = `${COINGECKO_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false&price_change_percentage=24h`;
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
