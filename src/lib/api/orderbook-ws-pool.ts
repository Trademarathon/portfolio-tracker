"use client";

/**
 * Shared WebSocket pool for order book (Binance depth, Bybit orderbook).
 * One connection per (symbol, exchange); multiple subscribers share the same stream.
 */

import { WS_ENDPOINTS } from './websocket-endpoints';
import { safeParseJson } from './websocket-types';
import type { AggregatedOrderBook } from '@/lib/api/futures-aggregator';

type BookHandler = (book: AggregatedOrderBook) => void;

// --- Binance: one WS per symbol ---
const binanceEntries = new Map<string, { ws: WebSocket; refCount: number; handlers: Set<BookHandler> }>();

function buildBinanceBook(symbol: string, data: { b?: string[][]; a?: string[][] }): AggregatedOrderBook | null {
  const bids = (data.b ?? []).map((b) => ({
    price: parseFloat(b[0]),
    size: parseFloat(b[1]),
    sizeUsd: parseFloat(b[0]) * parseFloat(b[1]),
  }));
  const asks = (data.a ?? []).map((a) => ({
    price: parseFloat(a[0]),
    size: parseFloat(a[1]),
    sizeUsd: parseFloat(a[0]) * parseFloat(a[1]),
  }));
  if (bids.length === 0 && asks.length === 0) return null;
  const bestBid = bids[0]?.price;
  const bestAsk = asks[0]?.price;
  const midPrice = bestBid != null && bestAsk != null ? (bestBid + bestAsk) / 2 : (bestBid ?? bestAsk ?? 0);
  const spread = (bestAsk ?? 0) - (bestBid ?? 0);
  return {
    symbol,
    exchange: 'binance',
    timestamp: Date.now(),
    bids,
    asks,
    spread,
    spreadPercent: midPrice > 0 ? (spread / midPrice) * 100 : 0,
    midPrice,
  };
}

function subscribeBinance(symbol: string, onBook: BookHandler): () => void {
  const key = symbol.toLowerCase();
  let entry = binanceEntries.get(key);
  if (!entry) {
    const ws = new WebSocket(`${WS_ENDPOINTS.binance.ws}/${key}@depth20@100ms`);
    entry = { ws, refCount: 0, handlers: new Set() };
    binanceEntries.set(key, entry);
    ws.onmessage = (event) => {
      const data = safeParseJson<{ b?: string[][]; a?: string[][] }>(event.data);
      if (!data) return;
      const book = buildBinanceBook(symbol.toUpperCase(), data);
      if (book) entry!.handlers.forEach((h) => h(book));
    };
    ws.onclose = () => {
      binanceEntries.delete(key);
    };
    ws.onerror = () => {
      binanceEntries.delete(key);
    };
  }
  entry.refCount++;
  entry.handlers.add(onBook);
  return () => {
    entry!.refCount--;
    entry!.handlers.delete(onBook);
    if (entry!.refCount <= 0) {
      entry!.ws.onclose = null;
      entry!.ws.onerror = null;
      entry!.ws.close();
      binanceEntries.delete(key);
    }
  };
}

// --- Bybit: one shared WS, snapshot + delta per symbol ---
type BybitBookState = { bids: Map<number, { size: number; sizeUsd: number }>; asks: Map<number, { size: number; sizeUsd: number }> };

let bybitWs: WebSocket | null = null;
const bybitSubscriptions = new Map<string, { refCount: number; handlers: Set<BookHandler>; state: BybitBookState }>();
let bybitOpen = false;
let bybitReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let bybitReconnecting = false;
const BYBIT_RECONNECT_DELAY_MS = 1500;
const BYBIT_RECONNECT_MAX_ATTEMPTS = 10;
let bybitReconnectAttempts = 0;

function buildBybitBookFromMaps(
  symbol: string,
  bidsMap: Map<number, { size: number; sizeUsd: number }>,
  asksMap: Map<number, { size: number; sizeUsd: number }>,
  timestamp: number
): AggregatedOrderBook {
  const bids = [...bidsMap.entries()]
    .sort((a, b) => b[0] - a[0])
    .slice(0, 200)
    .map(([price, { size, sizeUsd }]) => ({ price, size, sizeUsd }));
  const asks = [...asksMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .slice(0, 200)
    .map(([price, { size, sizeUsd }]) => ({ price, size, sizeUsd }));
  const bestBid = bids[0]?.price;
  const bestAsk = asks[0]?.price;
  const midPrice = bestBid != null && bestAsk != null ? (bestBid + bestAsk) / 2 : 0;
  const spread = bestBid != null && bestAsk != null ? bestAsk - bestBid : 0;
  return {
    symbol,
    exchange: 'bybit',
    timestamp,
    bids,
    asks,
    spread,
    spreadPercent: midPrice > 0 ? (spread / midPrice) * 100 : 0,
    midPrice,
  };
}

function ensureBybitSubscribed(symbol: string) {
  if (!bybitWs || bybitWs.readyState !== WebSocket.OPEN) return;
  bybitWs.send(JSON.stringify({ op: 'subscribe', args: [`orderbook.200.${symbol}`] }));
}

function scheduleBybitReconnect() {
  if (bybitReconnecting || bybitSubscriptions.size === 0) return;
  if (bybitReconnectAttempts >= BYBIT_RECONNECT_MAX_ATTEMPTS) {
    bybitReconnectAttempts = 0;
    return;
  }
  bybitReconnecting = true;
  if (bybitReconnectTimer) clearTimeout(bybitReconnectTimer);
  const delay = BYBIT_RECONNECT_DELAY_MS * Math.pow(1.5, Math.min(bybitReconnectAttempts, 4));
  bybitReconnectAttempts += 1;
  bybitReconnectTimer = setTimeout(() => {
    bybitReconnectTimer = null;
    bybitReconnecting = false;

    if (bybitSubscriptions.size === 0 || bybitWs?.readyState === WebSocket.OPEN) return;
    bybitWs = new WebSocket(WS_ENDPOINTS.bybit.wsLinear);
    bybitWs.onopen = () => {
      bybitOpen = true;
      bybitReconnectAttempts = 0;
      bybitSubscriptions.forEach((_, sym) => ensureBybitSubscribed(sym));
    };
    bybitWs.onclose = () => {
      bybitOpen = false;
      bybitWs = null;
      scheduleBybitReconnect();
    };
    bybitWs.onerror = () => {
      bybitOpen = false;
      bybitWs = null;
      scheduleBybitReconnect();
    };
    bybitWs.onmessage = (event) => {
      const data = safeParseJson<{ topic?: string; type?: string; data?: { s?: string; ts?: string; b?: string[][]; a?: string[][] } }>(event.data);
      if (!data?.topic?.startsWith('orderbook') || !data.data) return;
      const bookData = data.data;
      const sym = bookData.s ?? data.topic.split('.')[2];
      const sub = bybitSubscriptions.get(sym);
      if (!sub) return;
      const ts = parseInt(bookData.ts || '0') || Date.now();
      if (data.type === 'snapshot') {
        sub.state.bids.clear();
        sub.state.asks.clear();
      }
      const apply = (map: Map<number, { size: number; sizeUsd: number }>, levels: string[][] | undefined) => {
        if (!levels) return;
        for (const [p, s] of levels) {
          const price = parseFloat(p);
          const size = parseFloat(s);
          if (size === 0) map.delete(price);
          else map.set(price, { size, sizeUsd: price * size });
        }
      };
      apply(sub.state.bids, bookData.b);
      apply(sub.state.asks, bookData.a);
      if (sub.state.bids.size > 0 || sub.state.asks.size > 0) {
        const book = buildBybitBookFromMaps(sym, sub.state.bids, sub.state.asks, ts);
        sub.handlers.forEach((h) => h(book));
      }
    };
  }, delay);
}

function subscribeBybit(symbol: string, onBook: BookHandler): () => void {
  let sub = bybitSubscriptions.get(symbol);
  if (!sub) {
    sub = {
      refCount: 0,
      handlers: new Set(),
      state: { bids: new Map(), asks: new Map() },
    };
    bybitSubscriptions.set(symbol, sub);
    if (!bybitWs) {
      bybitWs = new WebSocket(WS_ENDPOINTS.bybit.wsLinear);
      bybitWs.onopen = () => {
        bybitOpen = true;
        bybitReconnectAttempts = 0;
        bybitSubscriptions.forEach((_, sym) => ensureBybitSubscribed(sym));
      };
      bybitWs.onclose = () => {
        bybitOpen = false;
        bybitWs = null;
        scheduleBybitReconnect();
      };
      bybitWs.onerror = () => {
        bybitOpen = false;
        bybitWs = null;
        scheduleBybitReconnect();
      };
      bybitWs.onmessage = (event) => {
        const data = safeParseJson<{ topic?: string; type?: string; data?: { s?: string; ts?: string; b?: string[][]; a?: string[][] } }>(event.data);
        if (!data?.topic?.startsWith('orderbook') || !data.data) return;
        const bookData = data.data;
        const sym = bookData.s ?? data.topic.split('.')[2];
        const subEntry = bybitSubscriptions.get(sym);
        if (!subEntry) return;
        const ts = parseInt(bookData.ts || '0') || Date.now();
        if (data.type === 'snapshot') {
          subEntry.state.bids.clear();
          subEntry.state.asks.clear();
        }
        const apply = (map: Map<number, { size: number; sizeUsd: number }>, levels: string[][] | undefined) => {
          if (!levels) return;
          for (const [p, s] of levels) {
            const price = parseFloat(p);
            const size = parseFloat(s);
            if (size === 0) map.delete(price);
            else map.set(price, { size, sizeUsd: price * size });
          }
        };
        apply(subEntry.state.bids, bookData.b);
        apply(subEntry.state.asks, bookData.a);
        if (subEntry.state.bids.size > 0 || subEntry.state.asks.size > 0) {
          const book = buildBybitBookFromMaps(sym, subEntry.state.bids, subEntry.state.asks, ts);
          subEntry.handlers.forEach((h) => h(book));
        }
      };
    }
    if (bybitOpen) ensureBybitSubscribed(symbol);
  }
  sub.refCount++;
  sub.handlers.add(onBook);
  return () => {
    sub!.refCount--;
    sub!.handlers.delete(onBook);
    if (sub!.refCount <= 0) {
      bybitSubscriptions.delete(symbol);
      if (bybitWs?.readyState === WebSocket.OPEN) {
        bybitWs.send(JSON.stringify({ op: 'unsubscribe', args: [`orderbook.200.${symbol}`] }));
      }
      if (bybitSubscriptions.size === 0 && bybitWs) {
        if (bybitReconnectTimer) clearTimeout(bybitReconnectTimer);
        bybitReconnectTimer = null;
        bybitReconnecting = false;
        bybitWs.close();
        bybitWs = null;
      }
    }
  };
}

export type OrderBookExchange = 'binance' | 'bybit';

/**
 * Subscribe to order book stream for one (symbol, exchange). Returns unsubscribe.
 * Multiple callers for the same (symbol, exchange) share one WebSocket.
 */
export function subscribeOrderBook(symbol: string, exchange: OrderBookExchange, onBook: BookHandler): () => void {
  const normalized = symbol.replace(/USDT|USDC|\/|-/gi, '').toUpperCase() || 'BTC';
  const sym = exchange === 'binance' ? normalized + 'USDT' : normalized + 'USDT';
  if (exchange === 'binance') return subscribeBinance(sym, onBook);
  return subscribeBybit(sym, onBook);
}
