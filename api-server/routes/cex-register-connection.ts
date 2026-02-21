import type { Request, Response } from "express";
import { setStoredConnection } from "./cex-connection-store";

/**
 * Register a CEX connection for secure order placement.
 * Keys are stored server-side; frontend then sends only connectionId when placing orders.
 */
export async function registerConnectionHandler(req: Request, res: Response) {
  try {
    const { connectionId, exchangeId, apiKey, secret } = req.body;
    if (!connectionId || !exchangeId || !apiKey || !secret) {
      return res.status(400).json({
        error: "Missing parameters: connectionId, exchangeId, apiKey, secret",
      });
    }
    if (!["binance", "bybit", "okx"].includes(exchangeId)) {
      return res.status(400).json({ error: "Only binance, bybit, and okx are supported" });
    }
    setStoredConnection(connectionId, { exchangeId, apiKey, secret });
    res.json({ success: true, connectionId });
  } catch (error: any) {
    console.error("[CEX Register Connection]", error);
    res.status(500).json({ error: error.message || "Failed to register connection" });
  }
}
