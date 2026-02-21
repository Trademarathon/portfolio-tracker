import type { Request, Response } from "express";
import ccxt from "ccxt";
import { getExchangeInstance } from "../lib/exchange-manager";
import { normalizeSymbol } from "../lib/normalization";

export async function openOrdersHandler(req: Request, res: Response) {
  try {
    const { exchangeId, apiKey, secret } = req.body;
    if (!exchangeId || !apiKey || !secret) {
      return res.status(400).json({ error: "Missing parameters" });
    }
    if (!(ccxt as any)[exchangeId]) {
      return res.status(400).json({ error: "Invalid exchange" });
    }
    let orders: any[] = [];

    if (exchangeId === "bybit") {

      const seenIds = new Set<string>();
      const addOrders = (list: any[]) => {
        (list || []).forEach((o: any) => {
          if (o?.id && !seenIds.has(String(o.id))) {
            seenIds.add(String(o.id));
            orders.push(o);
          }
        });
      };
      try {
        const exchangeSpot = getExchangeInstance("bybit", apiKey, secret, { options: { defaultType: "spot" } });
        const spotOrders = await exchangeSpot.fetchOpenOrders();
        addOrders(Array.isArray(spotOrders) ? spotOrders : []);
      } catch (e: any) {
        if (!e.message?.includes('Permission denied')) console.warn("[CCXT] Bybit spot open orders failed:", e?.message || e);
      }
      try {
        const exchangeUnified = getExchangeInstance("bybit", apiKey, secret, { options: { defaultType: "unified" } });
        const unifiedOrders = await exchangeUnified.fetchOpenOrders();
        addOrders(Array.isArray(unifiedOrders) ? unifiedOrders : []);
      } catch (_e: any) {
        // Unified often fails
      }
      try {
        const exchangeLinear = getExchangeInstance("bybit", apiKey, secret, { options: { defaultType: "linear" } });
        const linearOrders = await exchangeLinear.fetchOpenOrders();
        addOrders(Array.isArray(linearOrders) ? linearOrders : []);
      } catch (_e: any) {
        // Linear often fails
      }
    } else {
      const exchange = getExchangeInstance(exchangeId, apiKey, secret, exchangeId === "bybit" ? { options: { defaultType: "unified" } } : {});
      orders = await exchange.fetchOpenOrders();
      if (!Array.isArray(orders)) orders = [];
    }
    const normalizedOrders = orders.map((o: any) => ({
      id: o.id,
      symbol: normalizeSymbol(o.symbol),
      rawSymbol: o.symbol,
      type: o.type,
      side: o.side,
      price: o.price,
      amount: o.amount,
      filled: o.filled,
      remaining: o.remaining,
      status: o.status,
      timestamp: o.timestamp,
      datetime: o.datetime,
      exchange: exchangeId,
    }));
    res.json({ orders: normalizedOrders });
  } catch (error: any) {
    console.error("CCXT Open Orders Error:", error);
    res.status(500).json({ error: error.message });
  }
}
