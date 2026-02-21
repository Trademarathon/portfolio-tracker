/** Indian Markets - Transaction & Analytics types (mirrors spot holding logic) */

export type IndianAssetType = "mf" | "stock";

export interface IndianTransaction {
    id: string;
    type: IndianAssetType;
    side: "buy" | "sell";
    /** MF: schemeCode as string. Stock: ticker e.g. RELIANCE.NS */
    symbol: string;
    /** Display name - MF: schemeName, Stock: companyName */
    name: string;
    /** MF: schemeCode (number). Stock: undefined */
    schemeCode?: number;
    amount: number;
    price: number;
    timestamp: number;
    fee?: number;
    notes?: string;
}

export interface IndianAssetAnalytics {
    symbol: string;
    avgBuyPrice: number;
    avgSellPrice: number;
    totalBought: number;
    totalCost: number;
    totalSold: number;
    totalProceeds: number;
    realizedPnl: number;
    unrealizedPnl: number;
    unrealizedPnlPercent: number;
    buyCount: number;
    sellCount: number;
    netPosition: number;
    costBasis: number;
    daysHeld: number;
    firstBuyDate: number;
    lastBuyDate: number;
    lastSellDate: number;
    priceDistance: number;
}
