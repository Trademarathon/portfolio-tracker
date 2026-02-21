/** Indian Stocks API - NSE/BSE via 0xramm Indian Stock API */

import { getIndianStocksApiBase } from "./indian-markets-config";
import { apiUrl } from "./client";

export const X_INDIAN_STOCKS_API_BASE = "X-Indian-Stocks-Api-Base";

function getHeaders(): HeadersInit {
    const base = getIndianStocksApiBase();
    return { [X_INDIAN_STOCKS_API_BASE]: base };
}

export interface StockSearchResult {
    symbol: string;
    company_name: string;
    match_type?: string;
    source?: string;
    api_url?: string;
    nse_url?: string;
    bse_url?: string;
}

export interface StockSearchResponse {
    status: string;
    query?: string;
    total_results?: number;
    results?: StockSearchResult[];
}

export interface StockPriceData {
    company_name: string;
    last_price: number;
    change?: number;
    percent_change?: number;
    previous_close?: number;
    volume?: number;
    market_cap?: number;
    currency?: string;
    last_update?: string;
}

export interface StockPriceResponse {
    status: string;
    symbol?: string;
    exchange?: string;
    ticker?: string;
    data?: StockPriceData;
}

export interface BatchStockItem {
    symbol: string;
    exchange: string;
    ticker: string;
    company_name: string;
    last_price: number;
    change?: number;
    percent_change?: number;
    volume?: number;
    market_cap?: number;
    sector?: string;
}

export interface BatchStockResponse {
    status: string;
    count?: number;
    stocks?: BatchStockItem[];
}

export async function searchStocks(query: string): Promise<StockSearchResponse> {
    const res = await fetch(apiUrl(`/api/indian-stocks/search?q=${encodeURIComponent(query)}`), {
        headers: getHeaders(),
    });
    if (!res.ok) return { status: "error" };
    return res.json();
}

export async function getStockPrice(symbol: string): Promise<StockPriceResponse | null> {
    const res = await fetch(
        apiUrl(`/api/indian-stocks/price?symbol=${encodeURIComponent(symbol)}`),
        { headers: getHeaders() }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.status === "success" ? data : null;
}

export async function getBatchPrices(symbols: string[]): Promise<BatchStockResponse | null> {
    const symbolsParam = symbols.join(",");
    const res = await fetch(
        apiUrl(`/api/indian-stocks/batch?symbols=${encodeURIComponent(symbolsParam)}`),
        { headers: getHeaders() }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.status === "success" ? data : null;
}
