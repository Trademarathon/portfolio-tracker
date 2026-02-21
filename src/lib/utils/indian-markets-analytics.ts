import moment from "moment";
import type { IndianTransaction, IndianAssetAnalytics } from "@/lib/api/indian-markets-types";

interface Lot {
    amount: number;
    cost: number;
    timestamp: number;
}

/**
 * Calculate Indian asset analytics from transactions (FIFO, like spot)
 */
export function calculateIndianAssetAnalytics(
    symbol: string,
    balance: number,
    currentPrice: number,
    transactions: IndianTransaction[]
): IndianAssetAnalytics {
    const assetTx = transactions
        .filter((t) => t.symbol === symbol && t.price > 0 && t.amount > 0)
        .sort((a, b) => a.timestamp - b.timestamp);

    const lots: Lot[] = [];
    let totalBought = 0;
    let totalCost = 0;
    let totalSold = 0;
    let totalProceeds = 0;
    let lastSellDate = 0;
    let lastBuyDate = 0;
    let buyCount = 0;
    let sellCount = 0;
    let realizedPnl = 0;

    assetTx.forEach((tx) => {
        const isBuy = tx.side === "buy";
        const fee = tx.fee ?? 0;

        if (isBuy) {
            const cost = tx.amount * tx.price + fee;
            lots.push({ amount: tx.amount, cost, timestamp: tx.timestamp });
            totalBought += tx.amount;
            totalCost += cost;
            lastBuyDate = tx.timestamp;
            buyCount++;
        } else {
            lastSellDate = tx.timestamp;
            totalSold += tx.amount;
            totalProceeds += tx.amount * tx.price - fee;
            sellCount++;

            let remaining = tx.amount;
            const proceedsPerUnit = tx.price - (fee / tx.amount);
            while (remaining > 0 && lots.length > 0) {
                const lot = lots[0];
                const take = Math.min(remaining, lot.amount);
                const costPerUnit = lot.cost / lot.amount;
                realizedPnl += take * (proceedsPerUnit - costPerUnit);
                lot.amount -= take;
                lot.cost -= take * costPerUnit;
                remaining -= take;
                if (lot.amount <= 0) lots.shift();
            }
        }
    });

    const avgSellPrice = totalSold > 0 ? totalProceeds / totalSold : 0;
    const netPosition = totalBought - totalSold;
    const positionFromTrades = lots.reduce((s, l) => s + l.amount, 0);
    const costBasisTotal = lots.reduce((s, l) => s + l.cost, 0);
    const avgBuyPrice = positionFromTrades > 0 ? costBasisTotal / positionFromTrades : 0;

    const firstBuyDate = lots.length > 0 ? Math.min(...lots.map((l) => l.timestamp)) : 0;
    const lastBuyDateResolved =
        lots.length > 0 ? Math.max(...lots.map((l) => l.timestamp)) : lastBuyDate;

    const currentVal = balance * currentPrice;
    const costBasisQuantity = Math.min(balance, positionFromTrades);
    const costBasis = avgBuyPrice > 0 ? costBasisQuantity * avgBuyPrice : 0;
    const currentValWithCost =
        balance > 0 ? costBasisQuantity * (currentVal / balance) : 0;
    const unrealizedPnl = costBasis > 0 ? currentValWithCost - costBasis : 0;
    const unrealizedPnlPercent = costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0;

    const daysHeld = firstBuyDate > 0 ? moment().diff(moment(firstBuyDate), "days") : 0;
    const priceDistance = avgBuyPrice > 0 ? (currentPrice - avgBuyPrice) / avgBuyPrice : 0;

    return {
        symbol,
        avgBuyPrice,
        avgSellPrice,
        totalBought,
        totalCost,
        totalSold,
        totalProceeds,
        realizedPnl,
        unrealizedPnl,
        unrealizedPnlPercent,
        buyCount,
        sellCount,
        netPosition,
        costBasis,
        daysHeld,
        firstBuyDate,
        lastBuyDate: lastBuyDateResolved,
        lastSellDate,
        priceDistance,
    };
}
