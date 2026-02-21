"use client";

import type { FootprintCandle } from '@/hooks/useFootprintData';

export interface ProfileLevel {
    price: number;
    volume: number;
    tpoCount: number;
}

/**
 * Compute volume profile from footprint candles.
 * Buckets volume by price level - each candle distributes its volume across the price levels it touches.
 */
export function computeVolumeProfile(candles: FootprintCandle[], tickSize?: number): ProfileLevel[] {
    if (candles.length === 0) return [];

    const allPrices = candles.flatMap((c) => [c.open, c.high, c.low, c.close]);
    const minP = Math.min(...allPrices);
    const maxP = Math.max(...allPrices);
    const range = maxP - minP || 1;
    const numLevels = Math.min(50, Math.max(10, Math.floor(range / (tickSize || range / 30))));
    const step = range / numLevels;

    const levels = new Map<number, { volume: number; tpoCount: number }>();

    for (const c of candles) {
        const lowIdx = Math.max(0, Math.floor((c.low - minP) / step));
        const highIdx = Math.min(numLevels - 1, Math.ceil((c.high - minP) / step));
        const levelsTouched = highIdx - lowIdx + 1 || 1;
        const volPerLevel = c.totalVol / levelsTouched;

        for (let i = lowIdx; i <= highIdx; i++) {
            const price = minP + (i + 0.5) * step;
            const key = Math.round(price * 1e6) / 1e6;
            const existing = levels.get(key) || { volume: 0, tpoCount: 0 };
            levels.set(key, {
                volume: existing.volume + volPerLevel,
                tpoCount: existing.tpoCount + 1,
            });
        }
    }

    return Array.from(levels.entries())
        .map(([price, { volume, tpoCount }]) => ({ price, volume, tpoCount }))
        .sort((a, b) => a.price - b.price);
}

export function getPOC(levels: ProfileLevel[]): number {
    if (levels.length === 0) return 0;
    let maxVol = 0;
    let poc = levels[0].price;
    for (const l of levels) {
        if (l.volume > maxVol) {
            maxVol = l.volume;
            poc = l.price;
        }
    }
    return poc;
}
