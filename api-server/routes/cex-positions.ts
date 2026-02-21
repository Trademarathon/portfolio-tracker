import type { Request, Response } from "express";
import ccxt from "ccxt";
import { getExchangeInstance } from "../lib/exchange-manager";
import { normalizeSymbol } from "../lib/normalization";

/** Normalize a CCXT position to the shape expected by the frontend */
function normalizePosition(p: any, exchangeId: string): any {
  // CCXT: contracts = position size in base asset for crypto perps; contractSize may be 1
  const contractsNum = parseFloat(p.contracts ?? p.amount ?? "0");
  const contractSize = parseFloat(p.contractSize ?? "1") || 1;
  const size = Math.abs(contractsNum * (contractSize > 0 ? contractSize : 1));
  const side = (p.side === "long" || (typeof p.side === "string" && p.side.toLowerCase() === "long")) ? "long" : "short";
  return {
    symbol: normalizeSymbol(p.symbol),
    rawSymbol: p.symbol,
    size: size || Math.abs(contractsNum),
    entryPrice: parseFloat(p.entryPrice ?? p.average ?? "0"),
    markPrice: parseFloat(p.markPrice ?? p.lastPrice ?? "0"),
    unrealizedProfit: parseFloat(p.unrealizedPnl ?? p.unrealizedProfit ?? "0"),
    unrealizedProfitPercent: parseFloat(p.percentage ?? "0"),
    leverage: parseInt(String(p.leverage ?? "1"), 10) || 1,
    liquidationPrice: parseFloat(p.liquidationPrice ?? "0"),
    side,
    exchange: exchangeId,
  };
}

export async function positionsHandler(req: Request, res: Response) {
  try {
    const { exchangeId, apiKey, secret } = req.body;
    if (!exchangeId || !apiKey || !secret) {
      return res.status(400).json({ error: "Missing parameters" });
    }
    if (!(ccxt as any)[exchangeId]) {
      return res.status(400).json({ error: "Invalid exchange" });
    }

    let positions: any[] = [];

    if (exchangeId === "bybit") {

      const seen = new Set<string>();
      const addPositions = (list: any[]) => {
        (list || []).forEach((p: any) => {
          const sym = (p.symbol || p.info?.symbol || "").toUpperCase();
          if (!sym || seen.has(sym)) return;
          const size = Math.abs(parseFloat(p.contracts ?? p.amount ?? "0"));
          if (size === 0) return;
          seen.add(sym);
          positions.push(normalizePosition(p, "bybit"));
        });
      };
      // Try UNIFIED
      try {
        const exchangeUnified = getExchangeInstance("bybit", apiKey, secret, { options: { defaultType: "unified" } });
        const unified = await exchangeUnified.fetchPositions();
        addPositions(Array.isArray(unified) ? unified : []);
      } catch (e: any) {
        if (!e.message?.includes('Permission denied')) console.warn("[CEX Positions] Bybit unified failed:", e?.message || e);
      }
      // Try LINEAR
      try {
        const exchangeLinear = getExchangeInstance("bybit", apiKey, secret, { options: { defaultType: "linear" } });
        const linear = await exchangeLinear.fetchPositions();
        addPositions(Array.isArray(linear) ? linear : []);
      } catch (_e: any) {
        // Linear often fails for unified, ignore
      }
      // Try INVERSE
      try {
        const exchangeInverse = getExchangeInstance("bybit", apiKey, secret, { options: { defaultType: "inverse" } });
        const inverse = await exchangeInverse.fetchPositions();
        addPositions(Array.isArray(inverse) ? inverse : []);
      } catch (_e: any) {
        // Inverse often fails if account type mismatch, ignore or log softly
      }
    } else if (exchangeId === "binance") {
      try {
        const exchange = getExchangeInstance("binance", apiKey, secret, { options: { defaultType: "future" } });
        const raw = await exchange.fetchPositions();
        const list = Array.isArray(raw) ? raw : [];
        positions = list
          .filter((p: any) => Math.abs(parseFloat(p.contracts ?? p.amount ?? "0")) > 0)
          .map((p: any) => normalizePosition(p, "binance"));
      } catch (e: any) {
        console.warn("[CEX Positions] Binance failed:", e?.message || e);
      }
    } else {
      try {
        const exchange = getExchangeInstance(exchangeId, apiKey, secret);
        const raw = await exchange.fetchPositions?.();
        if (Array.isArray(raw)) {
          positions = raw
            .filter((p: any) => Math.abs(parseFloat(p.contracts ?? p.amount ?? "0")) > 0)
            .map((p: any) => normalizePosition(p, exchangeId));
        }
      } catch (e: any) {
        console.warn("[CEX Positions]", exchangeId, e?.message || e);
      }
    }

    // Frontend expects same shape as useHighSpeedSync: positionAmt/size, entryPrice, markPrice, unrealizedProfit, etc.
    const payload = positions.map((p) => ({
      symbol: p.symbol,
      rawSymbol: p.rawSymbol,
      positionAmt: p.side === "short" ? -p.size : p.size,
      size: p.size,
      entryPrice: p.entryPrice,
      markPrice: p.markPrice,
      unrealizedProfit: p.unrealizedProfit,
      unrealizedProfitPercent: p.unrealizedProfitPercent,
      leverage: p.leverage,
      liquidationPrice: p.liquidationPrice,
      side: p.side,
    }));

    res.json({ positions: payload });
  } catch (error: any) {
    console.error("CEX Positions Error:", error);
    res.status(500).json({ error: error.message });
  }
}
