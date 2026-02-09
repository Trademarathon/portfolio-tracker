/**
 * Utility to normalize cryptocurrency symbols for price fetching.
 * Maps wrapped tokens and platform-specific symbols to their main trading symbol.
 */
export function normalizeSymbol(symbol: string, chain?: string): string {
    if (!symbol) return '';

    // 0. Basic cleaning
    let s = symbol.toUpperCase().trim();

    // 1. Handle specific exchange/blockchain formats (e.g. "0x...::Module::Coin" or "Spot::BTC")
    if (s.includes('::')) {
        const parts = s.split('::');
        return normalizeSymbol(parts[parts.length - 1], chain); // Recurse on the last part
    }

    // 2. Handle Base:Quote or similar
    if (s.includes(':')) {
        return normalizeSymbol(s.split(':')[0], chain);
    }

    // 3. Remove quote currencies and suffixes for both / and - separators
    // e.g. BTC/USD, BTC-USDT, BTC-PERP
    // We strip common quotes from end
    s = s.replace(/[:\/-](USDT|USDC|BTC|ETH|BNB|EUR|USD|DAI)$/, '')
        .replace(/-(SPOT|PERP|FUTURES)$/, '');

    // 4. Clean unified symbols like BTCUSDT if they look like market pairs (6+ chars ending in USDT/USDC)
    // Be careful with symbols that ACTUALLY end in USDT like USDT itself (length 4)
    if (s.endsWith('USDT') && s.length > 4) s = s.replace('USDT', '');
    if (s.endsWith('USDC') && s.length > 4) s = s.replace('USDC', '');
    if (s.endsWith('USD') && s.length > 3) s = s.replace('USD', '');

    // Mapping dictionary for common wrapped assets and specific fixes
    const mapping: Record<string, string> = {
        'WETH': 'ETH',
        'WBTC': 'BTC',
        'WBNB': 'BNB',
        'WAXE': 'AXE',
        'WFTM': 'FTM',
        'WAVAX': 'AVAX',
        'WMATIC': 'MATIC',
        'WPOL': 'POL',
        'WCRO': 'CRO',
        'WSOL': 'SOL',
        'USDC.E': 'USDC',
        'USDC.P': 'USDC',
        'USDT.E': 'USDT',
        'USDT.P': 'USDT',
        'BTC.B': 'BTC', // Avalanche BTC
        'MANTLE': 'MNT',
        'GAS': 'GAS',
        'LUNA': 'LUNC', // Classic assumption by default
        'WIF': 'WIF'    // Explicit keep
    };

    if (mapping[s]) {
        return mapping[s];
    }

    // Special logic for specific chains if needed
    if (chain === 'SOL' && s === 'SOL') return 'SOL';

    return s;
}
