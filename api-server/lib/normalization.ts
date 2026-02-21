/**
 * Normalize symbol for API server (mirrors src/lib/utils/normalization.ts).
 */
export function normalizeSymbol(symbol: string, chain?: string): string {
  if (!symbol || typeof symbol !== "string") return "";

  let s = String(symbol).toUpperCase().trim();

  if (s.includes("::")) {
    const parts = s.split("::");
    return normalizeSymbol(parts[parts.length - 1], chain);
  }
  if (s.includes(":")) {
    return normalizeSymbol(s.split(":")[0], chain);
  }

  s = s
    .replace(/[:\/-](USDT|USDC|BTC|ETH|BNB|EUR|USD|DAI)$/, "")
    .replace(/-(SPOT|PERP|FUTURES)$/, "");

  if (s.endsWith("USDT") && s.length > 4) s = s.replace("USDT", "");
  if (s.endsWith("USDC") && s.length > 4) s = s.replace("USDC", "");
  if (s.endsWith("USD") && s.length > 3) s = s.replace("USD", "");

  const mapping: Record<string, string> = {
    WETH: "ETH",
    WBTC: "BTC",
    WBNB: "BNB",
    WAXE: "AXE",
    WFTM: "FTM",
    WAVAX: "AVAX",
    WMATIC: "MATIC",
    WPOL: "POL",
    WCRO: "CRO",
    WSOL: "SOL",
    "USDC.E": "USDC",
    "USDC.P": "USDC",
    "USDT.E": "USDT",
    "USDT.P": "USDT",
    "BTC.B": "BTC",
    MANTLE: "MNT",
    // Legacy bad alias observed in historical cached journal rows.
    NIGGO: "MIGGO",
    GAS: "GAS",
    LUNA: "LUNC",
    WIF: "WIF",
    UBTC: "BTC",
    UETH: "ETH",
    USOL: "SOL",
  };

  if (mapping[s]) return mapping[s];
  if (chain === "SOL" && s === "SOL") return "SOL";
  s = s.replace(/[/:_-]+$/, "");
  return s;
}
