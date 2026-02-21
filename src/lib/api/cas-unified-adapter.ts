/**
 * Adapter: CAS Parser UnifiedResponse -> CASParsedData for casToTransactions
 * See: cas-parser-node UnifiedResponse structure
 */

import type { CASParsedData, CASMFScheme, CASEquityHolding } from "./cas-to-transactions";

interface UnifiedScheme {
    name?: string;
    isin?: string;
    units?: number;
    nav?: number;
    cost?: number;
    value?: number;
    transactions?: Array<{
        date?: string;
        type?: string;
        units?: number;
        amount?: number;
        nav?: number;
    }>;
}

interface UnifiedMutualFund {
    schemes?: UnifiedScheme[];
    folio_number?: string;
    amc?: string;
}

interface UnifiedEquity {
    name?: string;
    isin?: string;
    units?: number;
    value?: number;
}

interface UnifiedHoldings {
    equities?: UnifiedEquity[];
    demat_mutual_funds?: UnifiedScheme[];
}

interface UnifiedDematAccount {
    holdings?: UnifiedHoldings;
}

interface UnifiedResponse {
    mutual_funds?: UnifiedMutualFund[];
    demat_accounts?: UnifiedDematAccount[];
}

export function unifiedResponseToCasData(unified: UnifiedResponse): CASParsedData {
    const mutual_funds: CASMFScheme[] = [];
    const equity: CASEquityHolding[] = [];

    for (const mf of unified.mutual_funds ?? []) {
        for (const scheme of mf.schemes ?? []) {
            const units = scheme.units ?? 0;
            if (units <= 0) continue;
            const avgCost = scheme.cost != null && units > 0 ? scheme.cost / units : scheme.nav ?? 0;
            mutual_funds.push({
                folio: mf.folio_number,
                fund_house: mf.amc,
                scheme_name: scheme.name,
                isin: scheme.isin,
                units,
                quantity: units,
                avg_cost: avgCost,
                average_price: avgCost,
                nav: scheme.nav,
                current_value: scheme.value,
                transactions: scheme.transactions?.map((t) => ({
                    date: t.date,
                    type: t.type,
                    units: t.units,
                    amount: t.amount,
                    price: t.nav,
                })),
            });
        }
    }

    for (const acc of unified.demat_accounts ?? []) {
        const holdings = acc.holdings;
        if (!holdings) continue;

        for (const eq of holdings.equities ?? []) {
            const qty = eq.units ?? 0;
            if (qty <= 0) continue;
            const avgPrice = eq.value != null && qty > 0 ? eq.value / qty : 0;
            const sym = eq.name
                ? eq.name.split(/\s+/)[0].toUpperCase()
                : eq.isin ?? "";
            equity.push({
                symbol: sym,
                isin: eq.isin,
                company_name: eq.name,
                exchange: "NSE",
                quantity: qty,
                avg_price: avgPrice,
                current_value: eq.value,
            });
        }

        for (const dmf of holdings.demat_mutual_funds ?? []) {
            const units = dmf.units ?? 0;
            if (units <= 0) continue;
            const avgCost = dmf.value != null && units > 0 ? dmf.value / units : dmf.nav ?? 0;
            mutual_funds.push({
                isin: dmf.isin,
                scheme_name: dmf.name,
                units,
                quantity: units,
                avg_cost: avgCost,
                nav: dmf.nav,
                current_value: dmf.value,
            });
        }
    }

    return { mutual_funds, equity };
}
