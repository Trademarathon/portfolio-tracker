"use client";

import { useState, useEffect, useRef } from "react";
import { WS_ENDPOINTS } from "@/lib/api/websocket-endpoints";

const WS_URL = `${WS_ENDPOINTS.binance.wsFuturesStream}?streams=xauusdt@miniTicker/xagusdt@miniTicker`;

export interface CommodityTicker {
  price: number;
  change24h: number;
}

function parseTicker(d: { s: string; c: string; o: string }): { price: number; change24h: number } {
  const price = parseFloat(d.c);
  const open = parseFloat(d.o) || price;
  const change24h = open > 0 ? ((price - open) / open) * 100 : 0;
  return { price, change24h };
}

export function useBinanceCommodities(): {
  gold: CommodityTicker;
  silver: CommodityTicker;
  isConnected: boolean;
} {
  const [gold, setGold] = useState<CommodityTicker>({ price: 0, change24h: 0 });
  const [silver, setSilver] = useState<CommodityTicker>({ price: 0, change24h: 0 });
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial REST fetch for immediate display (Binance Futures – XAU/XAG are Futures pairs)
  useEffect(() => {
    if (typeof window === "undefined") return;
    Promise.all([
      fetch("https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=XAUUSDT").then((r) => r.json()),
      fetch("https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=XAGUSDT").then((r) => r.json()),
    ])
      .then(([g, s]: { symbol: string; lastPrice: string; priceChangePercent: string }[]) => {
        const goldPrice = parseFloat(g?.lastPrice ?? "0");
        const goldChange = parseFloat(g?.priceChangePercent ?? "0");
        const silverPrice = parseFloat(s?.lastPrice ?? "0");
        const silverChange = parseFloat(s?.priceChangePercent ?? "0");
        if (g?.symbol === "XAUUSDT") setGold({ price: goldPrice, change24h: goldChange });
        if (s?.symbol === "XAGUSDT") setSilver({ price: silverPrice, change24h: silverChange });
      })
      .catch(() => { });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const connect = () => {
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => setIsConnected(true);

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            const d = msg?.data;
            if (!d?.s || !d?.c) return;

            const { price, change24h } = parseTicker(d);

            if (d.s === "XAUUSDT") {
              setGold((prev) => (prev.price !== price ? { price, change24h } : prev));
            } else if (d.s === "XAGUSDT") {
              setSilver((prev) => (prev.price !== price ? { price, change24h } : prev));
            }
          } catch {
            // ignore
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          wsRef.current = null;
          reconnectRef.current = setTimeout(connect, 5000);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch (_e) {
        reconnectRef.current = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  return { gold, silver, isConnected };
}
