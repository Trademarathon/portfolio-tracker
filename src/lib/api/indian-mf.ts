/** Indian Mutual Funds API - MFapi.in */

import { getIndianMfApiBase } from "./indian-markets-config";
import { apiUrl } from "./client";

export const X_INDIAN_MF_API_BASE = "X-Indian-MF-Api-Base";

function getHeaders(): HeadersInit {
    const base = getIndianMfApiBase();
    return { [X_INDIAN_MF_API_BASE]: base };
}

export interface MFSearchResult {
    schemeCode: number;
    schemeName: string;
}

export interface MFNavLatest {
    meta: {
        fund_house: string;
        scheme_type: string;
        scheme_category: string;
        scheme_code: number;
        scheme_name: string;
    };
    data: Array<{ date: string; nav: string }>;
    status: string;
}

export interface MFHistory {
    meta: MFNavLatest['meta'];
    data: Array<{ date: string; nav: string }>;
}

export async function searchMF(query: string): Promise<MFSearchResult[]> {
    const res = await fetch(apiUrl(`/api/indian-mf/search?q=${encodeURIComponent(query)}`), {
        headers: getHeaders(),
    });
    if (!res.ok) return [];
    return res.json();
}

export async function getLatestNav(schemeCode: number): Promise<MFNavLatest | null> {
    const res = await fetch(apiUrl(`/api/indian-mf/nav/${schemeCode}`), {
        headers: getHeaders(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.status === "SUCCESS" ? data : null;
}

export async function getNavHistory(schemeCode: number): Promise<MFHistory | null> {
    const res = await fetch(apiUrl(`/api/indian-mf/history/${schemeCode}`), {
        headers: getHeaders(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data ? data : null;
}
