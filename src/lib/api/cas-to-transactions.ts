/**
 * Map CAS Parser JSON response to IndianTransaction[]
 * Supports structures from CAMS, KFIN, CDSL, NSDL
 */

import type { IndianTransaction } from "./indian-markets-types";

/** CAS Parser / exported JSON - flexible structure */
export interface CASParsedData {
    investor?: { name?: string; pan?: string };
    mutual_funds?: CASMFScheme[];
    fund_holdings?: CASMFScheme[];
    schemes?: CASMFScheme[];
    equity?: CASEquityHolding[];
    demat_holdings?: CASEquityHolding[];
    holdings?: CASEquityHolding[];
}

export interface CASMFScheme {
    folio?: string;
    fund_house?: string;
    scheme_name?: string;
    scheme_code?: number | string;
    isin?: string;
    units?: number;
    quantity?: number;
    avg_cost?: number;
    average_price?: number;
    current_value?: number;
    nav?: number;
    last_price?: number;
    transactions?: Array<{
        date?: string;
        type?: string;
        units?: number;
        quantity?: number;
        amount?: number;
        price?: number;
    }>;
}

export interface CASEquityHolding {
    symbol?: string;
    isin?: string;
    company_name?: string;
    exchange?: string;
    quantity?: number;
    avg_price?: number;
    average_price?: number;
    current_value?: number;
}

function parseDate(value: string | number | undefined): number {
    if (!value) return Date.now();
    if (typeof value === "number") return value;
    const d = new Date(value);
    return isNaN(d.getTime()) ? Date.now() : d.getTime();
}

function toSymbol(symbol: string, exchange?: string): string {
    const s = (symbol || "").trim().toUpperCase();
    if (!s) return "";
    if (exchange) {
        const ex = exchange.toUpperCase();
        if (ex === "NSE" || ex === "NS") return `${s}.NS`;
        if (ex === "BSE" || ex === "BO") return `${s}.BO`;
    }
    if (s.endsWith(".NS") || s.endsWith(".BO")) return s;
    return `${s}.NS`;
}

function generateId(): string {
    return `cas-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Convert CAS parsed JSON to IndianTransaction arrays
 */
export function casToTransactions(data: CASParsedData): {
    mfTransactions: IndianTransaction[];
    stockTransactions: IndianTransaction[];
} {
    const mfTransactions: IndianTransaction[] = [];
    const stockTransactions: IndianTransaction[] = [];

    const mfSchemes =
        data.mutual_funds ?? data.fund_holdings ?? data.schemes ?? [];
    const equityHoldings =
        data.equity ?? data.demat_holdings ?? data.holdings ?? [];

    for (const scheme of mfSchemes) {
        const schemeName =
            scheme.scheme_name ?? scheme.fund_house ?? "Unknown Scheme";
        const schemeCode = scheme.scheme_code;
        const codeStr =
            schemeCode != null ? String(schemeCode) : schemeName.slice(0, 20);
        const units = scheme.units ?? scheme.quantity ?? 0;
        const avgPrice =
            scheme.avg_cost ??
            scheme.average_price ??
            scheme.nav ??
            scheme.last_price ??
            0;

        if (units <= 0) continue;

        const hasTxs = scheme.transactions && scheme.transactions.length > 0;
        if (hasTxs) {
            for (const tx of scheme.transactions!) {
                const amt = tx.units ?? tx.quantity ?? 0;
                if (amt <= 0) continue;
                const isBuy =
                    (tx.type ?? "").toUpperCase().includes("PURCHASE") ||
                    (tx.type ?? "").toUpperCase().includes("BUY") ||
                    (tx.type ?? "").toUpperCase().includes("SIP");
                const side = isBuy ? "buy" : "sell";
                const price = tx.price ?? (isBuy ? avgPrice : 0);
                const ts = parseDate(tx.date);

                mfTransactions.push({
                    id: generateId(),
                    type: "mf",
                    side,
                    symbol: codeStr,
                    name: schemeName,
                    schemeCode:
                        typeof schemeCode === "number"
                            ? schemeCode
                            : schemeCode
                              ? parseInt(String(schemeCode), 10)
                              : undefined,
                    amount: amt,
                    price,
                    timestamp: ts,
                });
            }
        } else {
            mfTransactions.push({
                id: generateId(),
                type: "mf",
                side: "buy",
                symbol: codeStr,
                name: schemeName,
                schemeCode:
                    typeof schemeCode === "number"
                        ? schemeCode
                        : schemeCode
                          ? parseInt(String(schemeCode), 10)
                          : undefined,
                amount: units,
                price: avgPrice,
                timestamp: Date.now(),
            });
        }
    }

    for (const hold of equityHoldings) {
        const symbol = hold.symbol ?? hold.isin ?? "";
        if (!symbol) continue;
        const qty = hold.quantity ?? 0;
        if (qty <= 0) continue;
        const avgPrice = hold.avg_price ?? hold.average_price ?? 0;
        const sym = toSymbol(symbol, hold.exchange);
        const name = hold.company_name ?? symbol;

        stockTransactions.push({
            id: generateId(),
            type: "stock",
            side: "buy",
            symbol: sym,
            name,
            amount: qty,
            price: avgPrice,
            timestamp: Date.now(),
        });
    }

    return { mfTransactions, stockTransactions };
}
