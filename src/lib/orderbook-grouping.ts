
import { getHyperliquidL2Book, L2BookParams } from './api/hyperliquid';

export type { L2BookParams };

// Internal type for optional grouping params (coin is added by caller)
type L2BookGroupingParams = Omit<L2BookParams, 'coin'>;

export interface GroupedLevel {
    px: string;
    sz: string;
    n: number;
}

export interface GroupedOrderbook {
    bids: GroupedLevel[];
    asks: GroupedLevel[];
}

/**
 * Calculates available step sizes for an asset based on its price and size decimals.
 * Formula derived from Hyperliquid's official Python SDK / implementation.
 */
export function calculateOrderbookStepSizes(price: number, szDecimals: number): number[] {
    // Step 1: Minimum price step
    const minPriceStep = Math.pow(10, -(6 - szDecimals));

    // Step 2: Price-based divisor
    const divisor = price >= 10000 ? 50000 : 30000;

    // Step 3: Base step calculation
    const baseCalc = Math.pow(10, Math.round(Math.log10(price / divisor)));
    const base = Math.max(minPriceStep, baseCalc);

    // Step 4: Multipliers depend on conditions
    let options: number[];

    if (baseCalc < minPriceStep) {
        if (price < base * 1000) {
            options = [base, base * 10]; // Very cheap assets
        } else {
            options = [base, base * 10, base * 100]; // Cheap assets
        }
    } else if (base >= 1) {
        options = [base, base * 10, base * 20, base * 50, base * 100, base * 1000, base * 10000]; // Expensive assets
    } else {
        options = [base, base * 2, base * 5, base * 10, base * 100, base * 1000]; // Normal assets
    }

    return options.map(opt => parseFloat(opt.toPrecision(10))); // Fix floating point issues
}

/**
 * Maps a desired step size to Hyperliquid's l2Book API parameters.
 * Returns null if the step size requires client-side grouping.
 */
export function stepToL2BookParams(stepSize: number, allSteps: number[], price: number): L2BookGroupingParams | null {
    // The smallest step is always the default (no params needed)
    if (allSteps.length > 0 && stepSize === allSteps[0]) {
        return {}; // Empty params = default
    }

    // Normalize step relative to price order of magnitude
    const priceOrder = Math.pow(10, Math.floor(Math.log10(price)));
    const normalizedStep = stepSize / priceOrder;

    // Map to API parameters based on normalized step
    // Using loose equality check with epsilon for float comparison
    const match = (target: number, epsilon: number) => Math.abs(normalizedStep - target) < epsilon;

    if (match(0.0002, 0.00005)) {
        return { nSigFigs: 5, mantissa: 2 }; // ~0.02% step
    } else if (match(0.0005, 0.0001)) {
        return { nSigFigs: 5, mantissa: 5 }; // ~0.05% step
    } else if (match(0.001, 0.0002)) {
        return { nSigFigs: 4 }; // ~0.1% step
    } else if (match(0.01, 0.002)) {
        return { nSigFigs: 3 }; // ~1% step
    } else if (match(0.1, 0.02)) {
        return { nSigFigs: 2 }; // ~10% step
    } else {
        return null; // Not supported by API - needs client-side grouping
    }
}

/**
 * Groups orderbook levels by rounding prices to the nearest step size.
 * Aggregates sizes and counts for each group.
 */
export function groupOrderbookLevels(
    levels: Array<{ px: string; sz: string; n: number }>,
    stepSize: number,
): GroupedLevel[] {
    const grouped = new Map<string, { totalSize: number; count: number }>();

    for (const level of levels) {
        const price = parseFloat(level.px);
        // Round price to nearest step
        const groupedPrice = Math.floor(price / stepSize) * stepSize;

        // Use precision to avoid floating point key issues
        const safeKey = groupedPrice.toFixed(10);

        const existing = grouped.get(safeKey) || { totalSize: 0, count: 0 };
        grouped.set(safeKey, {
            totalSize: existing.totalSize + parseFloat(level.sz),
            count: existing.count + level.n,
        });
    }

    // Convert back to array
    return Array.from(grouped.entries())
        .map(([px, { totalSize, count }]) => ({
            px: parseFloat(px).toString(), // normalize string representation "100.000000" -> "100"
            sz: totalSize.toString(),
            n: count,
        }))
        // Note: Sort is handled by getGroupedOrderbook to respect Bids vs Asks direction
        .sort((a, b) => parseFloat(b.px) - parseFloat(a.px)); // Default to descending sort
}

/**
 * Fetches the orderbook with the specified grouping step.
 * Automatically decides whether to use API aggregation or client-side grouping.
 */
export async function getGroupedOrderbook(
    coin: string,
    stepSize: number,
    price: number,
    szDecimals: number
): Promise<GroupedOrderbook | null> {

    // 1. Calculate available steps to know if we are asking for valid or custom
    const allSteps = calculateOrderbookStepSizes(price, szDecimals);

    // 2. Check if API supports this step
    const apiParams = stepToL2BookParams(stepSize, allSteps, price);

    if (apiParams) {
        // API supports it directly
        const book = await getHyperliquidL2Book(coin, apiParams.nSigFigs, apiParams.mantissa);
        if (!book || !book.levels) return null;

        // API returns levels as [bids, asks]
        return {
            bids: book.levels[0] || [],
            asks: book.levels[1] || []
        };
    } else {
        // Client-side grouping needed
        const defaultBook = await getHyperliquidL2Book(coin); // No params = raw

        if (!defaultBook || !defaultBook.levels) return null;

        const bids = groupOrderbookLevels(defaultBook.levels[0], stepSize);
        const asks = groupOrderbookLevels(defaultBook.levels[1], stepSize);

        // Sort bids descending (high to low), asks ascending (low to high)
        return {
            bids: bids,
            // groupOrderbookLevels sorts descending. For asks we want ascending.
            asks: asks.reverse()
        };
    }
}
