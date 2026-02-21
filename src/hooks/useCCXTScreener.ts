"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { apiUrl } from "@/lib/api/client";

export interface CCXTTickerData {
  symbol: string;
  exchange: string;
  price: number;
  volume24h: number;
  change24h?: number;
  timestamp: number;
}

export interface CCXTFundingData {
  symbol: string;
  exchange: string;
  fundingRate: number;
  timestamp: number;
}

export interface CCXTOpenInterestData {
  symbol: string;
  exchange: string;
  openInterest: number;
  timestamp: number;
}

export interface CCXTMarketData extends CCXTTickerData {
  fundingRate: number;
  openInterest: number;
  base?: string;
  quote?: string;
  rawSymbol?: string;
  change5m?: number;
  change15m?: number;
  change1h?: number;
  change4h?: number;
  change8h?: number;
  change12h?: number;
  change1d?: number;
  trades15m?: number;
  volatility15m?: number;
  liquidations5m?: number;
  liquidations1h?: number;
  momentumScore?: number;
}

/** Fetches screener data from API (ccxt runs server-side only to avoid browser crashes). */
export function useCCXTScreener() {
  const [data, setData] = useState<CCXTMarketData[]>([]);
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/screener/ccxt-data"));
      if (!res.ok) {
        setErrors((prev) => {
          const next = new Map(prev);
          next.set("api", `HTTP ${res.status}`);
          return next;
        });
        return;
      }
      const json = await res.json();
      const items = Array.isArray(json?.data) ? json.data : [];
      setData(
        items.map((item: { symbol: string; rawSymbol?: string; exchange: string; price: number; volume24h: number; change24h?: number; fundingRate?: number; timestamp: number }) => {
          const [base, quote] = (item.symbol || "").split("/");
          return {
            symbol: item.symbol,
            rawSymbol: item.rawSymbol,
            base: base || "",
            quote: quote || "",
            exchange: item.exchange,
            price: item.price ?? 0,
            volume24h: item.volume24h ?? 0,
            change24h: item.change24h ?? 0,
            fundingRate: item.fundingRate ?? 0,
            openInterest: 0,
            timestamp: item.timestamp ?? Date.now(),
          } as CCXTMarketData;
        })
      );
      setErrors((prev) => {
        const next = new Map(prev);
        next.delete("api");
        return next;
      });
    } catch (e) {
      setErrors((prev) => {
        const next = new Map(prev);
        next.set("api", e instanceof Error ? e.message : "Failed to load screener");
        return next;
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 10000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [fetchData]);

  const dataArray = data;
  const enhancedData = useMemo(() => {
    return dataArray.map((item) => {
      const momentumScore = (item.change24h || 0) * Math.log10(item.volume24h + 1);
      return {
        ...item,
        momentumScore,
        change5m: 0,
        change15m: 0,
        change1h: 0,
        change4h: 0,
        change8h: 0,
        change12h: 0,
        change1d: item.change24h ?? 0,
        trades15m: 0,
        volatility15m: 0,
        liquidations5m: 0,
        liquidations1h: 0,
      };
    });
  }, [dataArray]);

  return {
    data: enhancedData,
    errors: Array.from(errors.entries()).map(([exchange, message]) => ({ exchange, message })),
    loading,
  };
}
