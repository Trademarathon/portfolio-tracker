import type { Request, Response } from "express";
import { DEFAULT_STOCKS_API_BASE } from "../../src/lib/api/indian-markets-config";

const X_INDIAN_STOCKS_API_BASE = "X-Indian-Stocks-Api-Base";

export async function searchHandler(req: Request, res: Response) {
  try {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ error: "Missing query parameter q" });
    }
    const base = (req.headers[X_INDIAN_STOCKS_API_BASE.toLowerCase()] as string)?.trim() || DEFAULT_STOCKS_API_BASE;
    const fetchRes = await fetch(
      `${base.replace(/\/$/, "")}/search?q=${encodeURIComponent(query)}`,
      { headers: { Accept: "application/json" } }
    );
    const data = await fetchRes.json();
    res.json(data);
  } catch (error) {
    console.error("Indian stock search error:", error);
    res.status(500).json({ status: "error", message: "Search failed" });
  }
}

export async function priceHandler(req: Request, res: Response) {
  try {
    const symbol = req.query.symbol as string;
    if (!symbol) {
      return res.status(400).json({ error: "Missing symbol parameter" });
    }
    const base = (req.headers[X_INDIAN_STOCKS_API_BASE.toLowerCase()] as string)?.trim() || DEFAULT_STOCKS_API_BASE;
    const fetchRes = await fetch(
      `${base.replace(/\/$/, "")}/stock?symbol=${encodeURIComponent(symbol)}&res=num`,
      { headers: { Accept: "application/json" } }
    );
    const data = await fetchRes.json();
    res.json(data);
  } catch (error) {
    console.error("Indian stock price error:", error);
    res.status(500).json({ status: "error", message: "Price fetch failed" });
  }
}

export async function batchHandler(req: Request, res: Response) {
  try {
    const symbols = req.query.symbols as string;
    if (!symbols) {
      return res.status(400).json({ error: "Missing symbols parameter" });
    }
    const base = (req.headers[X_INDIAN_STOCKS_API_BASE.toLowerCase()] as string)?.trim() || DEFAULT_STOCKS_API_BASE;
    const fetchRes = await fetch(
      `${base.replace(/\/$/, "")}/stock/list?symbols=${encodeURIComponent(symbols)}&res=num`,
      { headers: { Accept: "application/json" } }
    );
    const data = await fetchRes.json();
    res.json(data);
  } catch (error) {
    console.error("Indian stock batch error:", error);
    res.status(500).json({ status: "error", message: "Batch fetch failed" });
  }
}
