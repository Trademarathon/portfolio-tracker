import type { IndianTransaction } from "./indian-markets-types";

const MF_TX_KEY = "indianMfTransactions";
const STOCK_TX_KEY = "indianStockTransactions";

const LEGACY_MF_HOLDINGS_KEY = "indianMfHoldings";
const LEGACY_STOCK_HOLDINGS_KEY = "indianStockHoldings";

/** Migrate legacy holdings to transactions (one buy per holding) */
function migrateMfHoldings(): IndianTransaction[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem(LEGACY_MF_HOLDINGS_KEY);
        if (!raw) return [];
        const holdings = JSON.parse(raw) as Array<{
            id: string;
            schemeCode: number;
            schemeName: string;
            units: number;
            purchaseDate: string;
            purchaseNav?: number;
        }>;
        const tx: IndianTransaction[] = holdings.map((h) => {
            const nav = h.purchaseNav ?? 0;
            const ts = new Date(h.purchaseDate).getTime();
            return {
                id: `mf-migrate-${h.id}-${ts}`,
                type: "mf",
                side: "buy",
                symbol: String(h.schemeCode),
                name: h.schemeName,
                schemeCode: h.schemeCode,
                amount: h.units,
                price: nav,
                timestamp: ts,
            };
        });
        localStorage.setItem(MF_TX_KEY, JSON.stringify(tx));
        localStorage.removeItem(LEGACY_MF_HOLDINGS_KEY);
        return tx;
    } catch {
        return [];
    }
}

function migrateStockHoldings(): IndianTransaction[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem(LEGACY_STOCK_HOLDINGS_KEY);
        if (!raw) return [];
        const holdings = JSON.parse(raw) as Array<{
            id: string;
            symbol: string;
            companyName: string;
            quantity: number;
            avgBuyPrice?: number;
            exchange: string;
        }>;
        const tx: IndianTransaction[] = holdings.map((h) => ({
            id: `stock-migrate-${h.id}-${Date.now()}`,
            type: "stock",
            side: "buy",
            symbol: h.symbol,
            name: h.companyName,
            amount: h.quantity,
            price: h.avgBuyPrice ?? 0,
            timestamp: Date.now() - 86400000,
        }));
        localStorage.setItem(STOCK_TX_KEY, JSON.stringify(tx));
        localStorage.removeItem(LEGACY_STOCK_HOLDINGS_KEY);
        return tx;
    } catch {
        return [];
    }
}

export function loadMFTransactions(): IndianTransaction[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem(MF_TX_KEY);
        if (!raw) {
            const migrated = migrateMfHoldings();
            if (migrated.length === 0) {
                localStorage.setItem(MF_TX_KEY, "[]");
            }
            return migrated;
        }
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

export function loadStockTransactions(): IndianTransaction[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem(STOCK_TX_KEY);
        if (!raw) {
            const migrated = migrateStockHoldings();
            if (migrated.length === 0) {
                localStorage.setItem(STOCK_TX_KEY, "[]");
            }
            return migrated;
        }
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

export function saveMFTransactions(tx: IndianTransaction[]) {
    if (typeof window === "undefined") return;
    localStorage.setItem(MF_TX_KEY, JSON.stringify(tx));
}

export function saveStockTransactions(tx: IndianTransaction[]) {
    if (typeof window === "undefined") return;
    localStorage.setItem(STOCK_TX_KEY, JSON.stringify(tx));
}

/** Merge new MF transactions, avoiding duplicates by symbol */
export function mergeMFTransactions(
    existing: IndianTransaction[],
    newOnes: IndianTransaction[]
): IndianTransaction[] {
    const existingSymbols = new Set(
        existing.filter((t) => t.type === "mf").map((t) => t.symbol)
    );
    const added = newOnes.filter((t) => t.type === "mf" && !existingSymbols.has(t.symbol));
    return [...existing, ...added];
}

/** Replace all MF transactions */
export function replaceMFTransactions(newOnes: IndianTransaction[]) {
    if (typeof window === "undefined") return;
    const mfOnly = newOnes.filter((t) => t.type === "mf");
    localStorage.setItem(MF_TX_KEY, JSON.stringify(mfOnly));
}

/** Merge new stock transactions, avoiding duplicates by symbol */
export function mergeStockTransactions(
    existing: IndianTransaction[],
    newOnes: IndianTransaction[]
): IndianTransaction[] {
    const existingSymbols = new Set(
        existing.filter((t) => t.type === "stock").map((t) => t.symbol)
    );
    const added = newOnes.filter((t) => t.type === "stock" && !existingSymbols.has(t.symbol));
    return [...existing, ...added];
}

/** Replace all stock transactions */
export function replaceStockTransactions(newOnes: IndianTransaction[]) {
    if (typeof window === "undefined") return;
    const stockOnly = newOnes.filter((t) => t.type === "stock");
    localStorage.setItem(STOCK_TX_KEY, JSON.stringify(stockOnly));
}
