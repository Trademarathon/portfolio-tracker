export interface FundingRate {
    symbol: string;
    markPrice: number;
    indexPrice: number;
    fundingRate: number; // e.g. 0.0001 (0.01%)
    nextFundingTime: number;
    annualized: number; // (Funding Rate * 3 * 365) * 100 for APR %
}

const BINANCE_FUTURES_API = 'https://fapi.binance.com/fapi/v1';

export async function getGlobalFundingRates(): Promise<FundingRate[]> {
    try {
        const response = await fetch(`${BINANCE_FUTURES_API}/premiumIndex`);
        if (!response.ok) {
            throw new Error('Failed to fetch funding rates');
        }

        const data = await response.json();

        // Filter mainly for USDT pairs to avoid redundancy
        // And maybe filter out some low volume trash if needed, but for now take all USDT
        return data
            .filter((item: any) => item.symbol.endsWith('USDT'))
            .map((item: any) => ({
                symbol: item.symbol,
                markPrice: parseFloat(item.markPrice),
                indexPrice: parseFloat(item.indexPrice),
                fundingRate: parseFloat(item.lastFundingRate),
                nextFundingTime: item.nextFundingTime,
                annualized: parseFloat(item.lastFundingRate) * 3 * 365 * 100 // Approximation
            }));
    } catch (error) {
        console.warn("Error fetching funding rates:", error);
        return [];
    }
}
