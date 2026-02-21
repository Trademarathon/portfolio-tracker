import type { Request, Response } from "express";

const SCREENER_BASE_SYMBOLS = [
  "BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "LINK", "AVAX", "DOT", "MATIC",
  "UNI", "ATOM", "LTC", "BCH", "NEAR", "FIL", "INJ", "TIA", "ARB", "OP",
  "SUI", "SEI", "PEPE", "WIF", "APT", "STX", "JUP", "WLD", "STRK",
];

const markets = (() => {
  const exchanges = ["binance", "bybit", "hyperliquid"] as const;
  const out: Array<{ id: string; symbol: string; base: string; quote: string; exchange: string; active: boolean }> = [];
  for (const base of SCREENER_BASE_SYMBOLS) {
    const symbol = `${base}/USDT`;
    for (const exchange of exchanges) {
      const id = exchange === "hyperliquid" ? `${base}-${exchange}` : `${base}USDT-${exchange}`;
      out.push({ id, symbol, base, quote: "USDT", exchange, active: true });
    }
  }
  return out;
})();

export async function marketsHandler(_req: Request, res: Response) {
  try {
    res.json({ markets });
  } catch (error) {
    console.error("Error fetching markets:", error);
    res.status(500).json({ markets: [] });
  }
}
