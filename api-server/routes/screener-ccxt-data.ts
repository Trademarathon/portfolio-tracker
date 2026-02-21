import type { Request, Response } from "express";
import ccxt from "ccxt";

const EXCHANGE_CONFIGS = [
  { name: "binance", exchangeClass: ccxt.binance, options: { defaultType: "future" } },
  { name: "bybit", exchangeClass: ccxt.bybit, options: { defaultType: "linear" } },
  { name: "hyperliquid", exchangeClass: ccxt.hyperliquid, options: {} },
];

type ScreenerItem = {
  symbol: string;
  rawSymbol: string;
  exchange: string;
  price: number;
  volume24h: number;
  change24h: number;
  fundingRate: number;
  timestamp: number;
};

function normalizeSymbol(symbol: string) {
  if (!symbol || typeof symbol !== "string") return "";
  let s = String(symbol).toUpperCase().trim();
  if (s.includes(":")) s = s.split(":")[0];
  s = s.replace(/[:\/-](USDT|USDC|BTC|ETH|USD|DAI)$/, "").replace(/-(SPOT|PERP|FUTURES)$/, "");
  if (s.endsWith("USDT") && s.length > 4) s = s.replace("USDT", "");
  if (s.endsWith("USDC") && s.length > 4) s = s.replace("USDC", "");
  if (s.endsWith("USD") && s.length > 3) s = s.replace("USD", "");
  return s;
}

export async function ccxtDataHandler(_req: Request, res: Response) {
  const out: ScreenerItem[] = [];
  const now = Date.now();

  for (const { name, exchangeClass, options } of EXCHANGE_CONFIGS) {
    try {
      const exchange = new exchangeClass(options);
      await exchange.loadMarkets();

      const tickers = await exchange.fetchTickers();
      const keyToItem: Record<string, ScreenerItem> = {};

      for (const [symbol, ticker] of Object.entries(tickers)) {
        if (!symbol.endsWith("/USDT") && !symbol.endsWith("/USD")) continue;
        const normalized = normalizeSymbol(symbol);
        const key = `${normalized}-${name}`;
        keyToItem[key] = {
          symbol: normalized,
          rawSymbol: symbol,
          exchange: name,
          price: typeof ticker.last === "number" ? ticker.last : parseFloat(String(ticker.last || 0)),
          volume24h: typeof ticker.quoteVolume === "number" ? ticker.quoteVolume : parseFloat(String(ticker.quoteVolume || 0)),
          change24h: typeof ticker.percentage === "number" ? ticker.percentage : parseFloat(String(ticker.percentage || 0)),
          fundingRate: 0,
          timestamp: now,
        };
      }

      if (exchange.has["fetchFundingRates"]) {
        try {
          const fundingRates = await exchange.fetchFundingRates();
          for (const [symbol, funding] of Object.entries(fundingRates)) {
            const normalized = normalizeSymbol(symbol);
            const key = `${normalized}-${name}`;
            const rate = typeof (funding && (funding as any).fundingRate) === "number" ? (funding as any).fundingRate : 0;
            if (keyToItem[key]) keyToItem[key].fundingRate = rate;
            else {
              keyToItem[key] = {
                symbol: normalized,
                rawSymbol: symbol,
                exchange: name,
                price: 0,
                volume24h: 0,
                change24h: 0,
                fundingRate: rate,
                timestamp: now,
              };
            }
          }
        } catch {
          // ignore
        }
      }

      out.push(...Object.values(keyToItem));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[Screener] ${name} failed:`, msg);
    }
  }

  res.json({ data: out });
}
