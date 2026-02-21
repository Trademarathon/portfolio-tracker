/** Indian Markets API configuration - reads from localStorage (client-side) */

export const DEFAULT_MF_API_BASE = "https://api.mfapi.in";
export const DEFAULT_STOCKS_API_BASE =
    "https://military-jobye-haiqstudios-14f59639.koyeb.app";

export const INDIAN_MF_API_BASE_KEY = "indian_mf_api_base";
export const INDIAN_STOCKS_API_BASE_KEY = "indian_stocks_api_base";
export const CAS_PARSER_API_KEY_STORAGE = "cas_parser_api_key";

export function getIndianMfApiBase(): string {
    if (typeof window === "undefined") return DEFAULT_MF_API_BASE;
    const v = localStorage.getItem(INDIAN_MF_API_BASE_KEY);
    return (v && v.trim()) || DEFAULT_MF_API_BASE;
}

export function getIndianStocksApiBase(): string {
    if (typeof window === "undefined") return DEFAULT_STOCKS_API_BASE;
    const v = localStorage.getItem(INDIAN_STOCKS_API_BASE_KEY);
    return (v && v.trim()) || DEFAULT_STOCKS_API_BASE;
}

export function getCasParserApiKey(): string {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(CAS_PARSER_API_KEY_STORAGE)?.trim() || "";
}
