import type { Request, Response } from "express";
import ccxt from "ccxt";
import { normalizeSymbol } from "../lib/normalization";
import { getStoredConnection } from "./cex-connection-store";

export async function placeOrderHandler(req: Request, res: Response) {
  try {
    const { connectionId, exchangeId: bodyExchangeId, apiKey: bodyApiKey, secret: bodySecret, symbol, side, type, amount, price } = req.body;

    let exchangeId: string;
    let apiKey: string;
    let secret: string;

    if (connectionId) {
      const stored = getStoredConnection(connectionId);
      if (!stored) {
        return res.status(400).json({ error: "Connection not registered. Register in Settings → Connections (Use secure proxy)." });
      }
      exchangeId = stored.exchangeId;
      apiKey = stored.apiKey;
      secret = stored.secret;
    } else {
      exchangeId = bodyExchangeId;
      apiKey = bodyApiKey;
      secret = bodySecret;
      if (!exchangeId || !apiKey || !secret) {
        return res.status(400).json({ error: "Missing parameters: exchangeId, apiKey, secret, symbol, side, amount (or use connectionId)" });
      }
    }

    if (!symbol || !side || !amount) {
      return res.status(400).json({ error: "Missing parameters: symbol, side, amount" });
    }
    if (!["binance", "bybit", "okx"].includes(exchangeId)) {
      return res.status(400).json({ error: "Only binance, bybit, and okx are supported" });
    }

    const base = normalizeSymbol(symbol) || symbol;
    const marketSymbol = `${base}/USDT:USDT`; // Perpetual futures format
    const orderType = (type || "limit").includes("market") ? "market" : "limit";

    const ExchangeClass = exchangeId === "binance" ? (ccxt as any).binanceusdm : (ccxt as any)[exchangeId];
    const exchange = new ExchangeClass({
      apiKey,
      secret,
      options: exchangeId === "bybit" ? { defaultType: "swap" } : exchangeId === "okx" ? { defaultType: "swap" } : undefined,
    });

    const order = await exchange.createOrder(
      marketSymbol,
      orderType,
      side.toLowerCase(),
      parseFloat(amount),
      orderType === "limit" && price ? parseFloat(price) : undefined
    );

    res.json({ success: true, orderId: order.id, order });
  } catch (error: any) {
    console.error("[CEX Place Order]", error);
    res.status(500).json({ error: error.message || "Failed to place order" });
  }
}
