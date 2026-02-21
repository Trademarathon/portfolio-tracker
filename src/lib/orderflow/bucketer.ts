/**
 * Price/time bucketing for order flow charts.
 */

export interface Trade {
    time: number;
    price: number;
    qty: number;
    value: number;
    side: 'buy' | 'sell';
}

export interface PriceBin {
    price: number;
    volume: number;
    delta: number;
    buyVolume: number;
    sellVolume: number;
}

export interface ClusterBin {
    price: number;
    timeStart: number;
    timeEnd: number;
    volume: number;
    delta: number;
}

export type AggregationMode = 'price' | 'time' | 'both';

export type ClusterShadeMode = 'volume' | 'delta';

export interface BucketerSettings {
    binSize: number;
    timeRange: '5m' | '15m' | '1h' | '4h' | 'session';
    aggregation: AggregationMode;
    clusterShadeMode?: ClusterShadeMode;
}

export interface OrderBookLevel {
    price: number;
    sizeUsd: number;
}

const TIME_RANGE_MS: Record<string, number> = {
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    session: 24 * 60 * 60 * 1000,
};

function roundToBin(price: number, binSize: number): number {
    return Math.floor(price / binSize) * binSize;
}

/** Bucket trades by price only - for Volume Profile and Delta Profile */
export function bucketByPrice(trades: Trade[], binSize: number): PriceBin[] {
    const map = new Map<number, { volume: number; delta: number; buyVolume: number; sellVolume: number }>();

    for (const t of trades) {
        const bucket = roundToBin(t.price, binSize);
        const existing = map.get(bucket) ?? { volume: 0, delta: 0, buyVolume: 0, sellVolume: 0 };
        existing.volume += t.value;
        existing.buyVolume += t.side === 'buy' ? t.value : 0;
        existing.sellVolume += t.side === 'sell' ? t.value : 0;
        existing.delta += t.side === 'buy' ? t.value : -t.value;
        map.set(bucket, existing);
    }

    return Array.from(map.entries())
        .map(([price, data]) => ({
            price,
            volume: data.volume,
            delta: data.delta,
            buyVolume: data.buyVolume,
            sellVolume: data.sellVolume,
        }))
        .sort((a, b) => a.price - b.price);
}

/** Bucket trades by price and time - for Volume Cluster and Delta Cluster */
export function bucketByPriceAndTime(
    trades: Trade[],
    binSize: number,
    timeRange: string,
    timeBinCount: number = 20
): ClusterBin[] {
    const now = Date.now();
    const rangeMs = TIME_RANGE_MS[timeRange] ?? TIME_RANGE_MS['15m'];
    const timeBinMs = rangeMs / timeBinCount;
    const rangeStart = now - rangeMs;

    const map = new Map<string, { volume: number; delta: number }>();

    for (const t of trades) {
        const priceBucket = roundToBin(t.price, binSize);
        const binIndex = Math.floor((t.time - rangeStart) / timeBinMs);
        const timeStart = rangeStart + binIndex * timeBinMs;
        const key = `${priceBucket}_${timeStart}`;
        const existing = map.get(key) ?? { volume: 0, delta: 0 };
        existing.volume += t.value;
        existing.delta += t.side === 'buy' ? t.value : -t.value;
        map.set(key, existing);
    }

    return Array.from(map.entries()).map(([key, data]) => {
        const [priceStr, timeStr] = key.split('_');
        const price = parseFloat(priceStr);
        const timeStart = parseFloat(timeStr);
        return {
            price,
            timeStart,
            timeEnd: timeStart + timeBinMs,
            volume: data.volume,
            delta: data.delta,
        };
    });
}

/** Convert order book to bid-ask profile bins (for Bid-Ask Profile) */
export function bucketOrderBookByPrice(
    bids: OrderBookLevel[],
    asks: OrderBookLevel[],
    binSize: number
): PriceBin[] {
    const map = new Map<number, { buyVolume: number; sellVolume: number }>();

    for (const b of bids) {
        const bucket = roundToBin(b.price, binSize);
        const existing = map.get(bucket) ?? { buyVolume: 0, sellVolume: 0 };
        existing.buyVolume += b.sizeUsd;
        map.set(bucket, existing);
    }
    for (const a of asks) {
        const bucket = roundToBin(a.price, binSize);
        const existing = map.get(bucket) ?? { buyVolume: 0, sellVolume: 0 };
        existing.sellVolume += a.sizeUsd;
        map.set(bucket, existing);
    }

    return Array.from(map.entries())
        .map(([price, data]) => ({
            price,
            volume: data.buyVolume + data.sellVolume,
            delta: data.buyVolume - data.sellVolume,
            buyVolume: data.buyVolume,
            sellVolume: data.sellVolume,
        }))
        .sort((a, b) => a.price - b.price);
}

/** Filter trades by time range */
export function filterTradesByTimeRange(
    trades: Trade[],
    timeRange: string
): Trade[] {
    const rangeMs = TIME_RANGE_MS[timeRange] ?? TIME_RANGE_MS['15m'];
    const cutoff = Date.now() - rangeMs;
    return trades.filter(t => t.time >= cutoff);
}
