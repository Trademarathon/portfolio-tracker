import moment from 'moment';
import { Transaction, PortfolioAsset, Transfer } from '@/lib/api/types';
import { buildLedgerEvents } from '@/lib/accounting/ledger';
import { computeCostBasisSnapshot } from '@/lib/accounting/cost-basis';

export interface AssetAnalytics {
    symbol: string;
    avgBuyPrice: number; // FIFO: current position only
    avgBuyPriceLifetime?: number; // Lifetime avg for pair (permanent)
    avgSellPrice: number;
    totalBought: number;
    totalCost: number;
    totalSold: number;
    totalProceeds: number;
    realizedPnl: number;
    unrealizedPnl: number;
    unrealizedPnlPercent: number;
    daysHeld: number;
    firstBuyDate: number;
    lastBuyDate: number;
    lastSellDate: number;
    priceDistance: number;
    buyCount: number;
    sellCount: number;
    netPosition: number; // totalBought - totalSold
    costBasis: number; // current balance cost (FIFO)
    dcaSignal: {
        signal: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'TRIM' | 'SELL';
        color: string;
        text: string;
    };
    basisConfidence?: 'exact' | 'estimated';
    totalFeesUsd?: number;
}

export function getSession(timestamp: number): string {
    const hour = moment(timestamp).utc().hour();
    if (hour >= 0 && hour < 8) return 'Asia';
    if (hour >= 8 && hour < 14) return 'London';
    if (hour >= 14 && hour < 22) return 'NY';
    return 'Asia';
}

/**
 * Calculate comprehensive asset analytics from transactions
 * - Properly distinguishes buys vs sells (ignores transfers)
 * - Tracks avg buy/sell prices separately
 * - Calculates realized and unrealized PnL
 * - Provides DCA signals based on price distance from cost basis
 */
export function calculateAssetAnalytics(
    asset: PortfolioAsset,
    transactions: Transaction[],
    options?: {
        transfers?: Transfer[];
        fromMs?: number;
        toMs?: number;
        depositBasisPrice?: number;
    }
): AssetAnalytics {
    const depositBasisPrice =
        typeof options?.depositBasisPrice === 'number' && options.depositBasisPrice > 0
            ? options.depositBasisPrice
            : (asset.price || 0);

    const events = buildLedgerEvents({
        symbol: asset.symbol,
        transactions: transactions || [],
        transfers: options?.transfers || [],
        fromMs: options?.fromMs,
        toMs: options?.toMs,
        depositBasisPrice,
    });

    const snapshot = computeCostBasisSnapshot({
        events,
        currentPrice: asset.price || 0,
        currentBalance: asset.balance || 0,
    });

    const avgBuyPrice = snapshot.avgBuyPriceCurrent;
    const avgBuyPriceLifetime = snapshot.avgBuyPriceLifetime;
    const avgSellPrice = snapshot.avgSellPrice;
    const netPosition = snapshot.netPosition;

    const costBasis = snapshot.costBasis;
    const currentVal = asset.valueUsd;
    const firstBuyDate = snapshot.firstBuyDate;
    let unrealizedPnl = snapshot.unrealizedPnl;
    let unrealizedPnlPercent = costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0;
    if (costBasis > 0) {
        unrealizedPnlPercent = (unrealizedPnl / costBasis) * 100;
    }

    // Fallback: when no tx history (wallet-only), use 24h price change as approximation
    if (avgBuyPrice === 0 && currentVal > 0 && asset.priceChange24h != null) {
        const pct = asset.priceChange24h;
        unrealizedPnl = currentVal * (pct / (100 + pct));
        unrealizedPnlPercent = pct;
    }

    const daysHeld = firstBuyDate > 0 ? moment().diff(moment(firstBuyDate), 'days') : 0;

    // Price distance from cost basis
    const price = asset.price || 0;
    const priceDistance = avgBuyPrice > 0 ? (price - avgBuyPrice) / avgBuyPrice : 0;

    // DCA Signal based on price distance
    let dcaSignal: AssetAnalytics['dcaSignal'] = { signal: 'HOLD', color: 'text-zinc-500', text: 'Hold' };

    if (avgBuyPrice > 0 && price > 0) {
        if (priceDistance < -0.30) {
            dcaSignal = { signal: 'STRONG_BUY', color: 'text-emerald-400', text: 'Strong Buy' };
        } else if (priceDistance < -0.10) {
            dcaSignal = { signal: 'BUY', color: 'text-emerald-500', text: 'Buy Zone' };
        } else if (priceDistance > 0.50) {
            dcaSignal = { signal: 'SELL', color: 'text-rose-500', text: 'Take Profit' };
        } else if (priceDistance > 0.25) {
            dcaSignal = { signal: 'TRIM', color: 'text-amber-500', text: 'Trim' };
        }
    }

    return {
        symbol: asset.symbol,
        avgBuyPrice,
        avgBuyPriceLifetime: avgBuyPriceLifetime || undefined,
        avgSellPrice,
        totalBought: snapshot.totalBought,
        totalCost: snapshot.totalCost,
        totalSold: snapshot.totalSold,
        totalProceeds: snapshot.totalProceeds,
        realizedPnl: snapshot.realizedPnl,
        unrealizedPnl,
        unrealizedPnlPercent,
        daysHeld,
        firstBuyDate: snapshot.firstBuyDate,
        lastBuyDate: snapshot.lastBuyDate,
        lastSellDate: snapshot.lastSellDate,
        buyCount: snapshot.buyCount,
        sellCount: snapshot.sellCount,
        netPosition,
        costBasis: snapshot.costBasis,
        dcaSignal,
        priceDistance,
        basisConfidence: snapshot.basisConfidence,
        totalFeesUsd: snapshot.totalFeesUsd,
    };
}

/**
 * Get a summary of all trading activity across assets
 */
export function calculatePortfolioAnalytics(
    assets: PortfolioAsset[],
    transactions: Transaction[],
    options?: {
        transfers?: Transfer[];
        fromMs?: number;
        toMs?: number;
        depositBasisPriceBySymbol?: Record<string, number>;
    }
): {
    totalCostBasis: number;
    totalRealizedPnl: number;
    totalUnrealizedPnl: number;
    totalTrades: number;
    winRate: number;
} {
    let totalCostBasis = 0;
    let totalRealizedPnl = 0;
    let totalUnrealizedPnl = 0;
    let totalTrades = 0;
    let winningTrades = 0;

    assets.forEach(asset => {
        const analytics = calculateAssetAnalytics(asset, transactions, {
            transfers: options?.transfers,
            fromMs: options?.fromMs,
            toMs: options?.toMs,
            depositBasisPrice:
                options?.depositBasisPriceBySymbol?.[asset.symbol.toUpperCase()] ?? asset.price ?? 0,
        });
        totalCostBasis += analytics.costBasis;
        totalRealizedPnl += analytics.realizedPnl;
        totalUnrealizedPnl += analytics.unrealizedPnl;
        totalTrades += analytics.buyCount + analytics.sellCount;
        
        // Count winning trades (sells above lifetime avg buy)
        const avgBuy = analytics.avgBuyPriceLifetime ?? analytics.avgBuyPrice;
        if (analytics.avgSellPrice > avgBuy && analytics.sellCount > 0) {
            winningTrades += analytics.sellCount;
        }
    });

    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    return {
        totalCostBasis,
        totalRealizedPnl,
        totalUnrealizedPnl,
        totalTrades,
        winRate
    };
}
