import { ExchangeTicker } from './types';

type TickerCallback = (ticker: ExchangeTicker) => void;

class WebSocketManager {
    private listeners: TickerCallback[] = [];
    private connections: Map<string, WebSocket> = new Map();
    private heartbeats: Map<string, NodeJS.Timeout> = new Map();
    private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
    private isReconnecting: { [key: string]: boolean } = {};

    // Track subscribed symbols to avoid redundant calls and manage reconnection state
    private subscribedSymbols: { [exchange: string]: Set<string> } = {
        'binance': new Set(),
        'bybit': new Set(),
        'hyperliquid': new Set() // Hyperliquid uses 'allMids' channel, so set is just a flag
    };

    constructor() {
        // Singleton instance
    }

    subscribe(callback: TickerCallback) {
        this.listeners.push(callback);
        // Return unsubscribe function
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    private normalizeSymbol(symbol: string): string {
        return symbol.toUpperCase().replace('USDT', '').replace('USD', '');
    }

    private notify(ticker: ExchangeTicker) {
        this.listeners.forEach(cb => cb(ticker));
    }

    // --- CONNECTION MANAGEMENT ---

    private scheduleReconnect(ex: string) {
        if (this.isReconnecting[ex]) return;
        this.isReconnecting[ex] = true;

        console.log(`[PriceWS] Scheduling reconnect for ${ex} in 3s...`);

        this.cleanupConnection(ex); // Clean up socket/heartbeat

        const timer = setTimeout(() => {
            this.isReconnecting[ex] = false;
            console.log(`[PriceWS] Reconnecting ${ex}...`);
            this.reconnect(ex);
        }, 3000);

        this.reconnectTimers.set(ex, timer);
    }

    private cleanupConnection(ex: string) {
        const ws = this.connections.get(ex);
        if (ws) {
            // Remove listeners to prevent "closed" event loop during cleanup
            ws.onclose = null;
            ws.onerror = null;
            ws.close();
            this.connections.delete(ex);
        }

        const hb = this.heartbeats.get(ex);
        if (hb) {
            clearInterval(hb);
            this.heartbeats.delete(ex);
        }
    }

    private reconnect(ex: string) {
        // Re-subscribe to all previously tracked symbols
        const symbols = Array.from(this.subscribedSymbols[ex] || []);
        if (ex === 'binance' && symbols.length > 0) {
            this.connectBinance(symbols, true);
        } else if (ex === 'bybit' && symbols.length > 0) {
            this.connectBybit(symbols, true);
        } else if (ex === 'hyperliquid') {
            this.connectHyperliquid(true);
        }
    }

    // --- BINANCE ---

    connectBinance(symbols: string[], isReconnect = false) {
        const ex = 'binance';
        const newSymbols = symbols.filter(s => !this.subscribedSymbols[ex].has(s));

        if (newSymbols.length === 0 && !isReconnect && this.connections.has(ex)) {
            return; // Already subscribed or connected
        }

        // Add to registry
        symbols.forEach(s => this.subscribedSymbols[ex].add(s));

        // Binance doesn't support dynamic subscribe easily on public raw streams (needs distinct connection URL).
        // For robust "All Market" support, we usually use !ticker@arr or separate streams.
        // However, forcing a reconnect is safer for Binance URL-based streams when user changes watchlist.
        // We will only reconnect if we have NEW symbols that are not covered.
        // Optimization: If the connection exists, we *must* close and reopen with new URL params for Binance.
        // Unlike Bybit, Binance standard raw streams are URL defined.

        this.cleanupConnection(ex);

        const allSymbols = Array.from(this.subscribedSymbols[ex]);
        if (allSymbols.length === 0) return;

        // Limit stream length (Binance has limits, but 50-100 is fine)
        const streams = allSymbols.map(s => `${s.toLowerCase()}usdt@ticker`).join('/');
        const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${streams}`);

        ws.onopen = () => {
            console.log(`[PriceWS] Binance Connected (${allSymbols.length} active)`);
            this.isReconnecting[ex] = false;
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.s && data.c) {
                    this.notify({
                        symbol: this.normalizeSymbol(data.s),
                        lastPrice: parseFloat(data.c),
                        priceChangePercent: parseFloat(data.P),
                        exchange: 'binance'
                    });
                }
            } catch (e) { }
        };

        ws.onerror = (e) => console.error('[PriceWS] Binance Error:', e);
        ws.onclose = () => {
            console.log('[PriceWS] Binance Closed');
            this.scheduleReconnect(ex);
        };

        this.connections.set(ex, ws);
    }

    // --- BYBIT ---

    connectBybit(symbols: string[], isReconnect = false) {
        const ex = 'bybit';

        // Add to registry
        symbols.forEach(s => this.subscribedSymbols[ex].add(s));

        let ws = this.connections.get(ex);

        // Case 1: No active connection -> Connect
        if (!ws || ws.readyState === WebSocket.CLOSED) {
            ws = new WebSocket('wss://stream.bybit.com/v5/public/linear');
            this.connections.set(ex, ws);

            ws.onopen = () => {
                console.log(`[PriceWS] Bybit Connected`);
                this.isReconnecting[ex] = false;

                // Subscribe to ALL symbols in registry
                const allSymbols = Array.from(this.subscribedSymbols[ex]);
                if (allSymbols.length > 0) {
                    this.sendBybitSubscribe(ws!, allSymbols);
                }

                // Heartbeat (20s)
                const hb = setInterval(() => {
                    if (ws!.readyState === WebSocket.OPEN) ws!.send(JSON.stringify({ op: 'ping' }));
                }, 20000);
                this.heartbeats.set(ex, hb);
            };

            ws.onerror = (e) => console.error('[PriceWS] Bybit Error:', e);
            ws.onclose = () => {
                console.log('[PriceWS] Bybit Closed');
                this.scheduleReconnect(ex);
            };

            ws.onmessage = (event) => this.handleBybitMessage(event);
        }
        // Case 2: Connection OPEN -> Just Subscribe
        else if (ws.readyState === WebSocket.OPEN) {
            // Only subscribe to the specific requested symbols (or all if reconnecting)
            // To be safe and idempotent, we can just subscribe to the requested ones.
            // Bybit allows duplicate sub requests (no error).
            this.sendBybitSubscribe(ws, symbols);
        }
        // Case 3: Connection CONNECTING -> Do nothing, onopen will handle it via registry.
    }

    private sendBybitSubscribe(ws: WebSocket, symbols: string[]) {
        const args = symbols.map(s => `tickers.${s.toUpperCase()}USDT`);
        // Limit 10 args per request recommendation? Bybit V5 permits more.
        // We'll dispatch directly.
        if (args.length > 0) {
            ws.send(JSON.stringify({ op: 'subscribe', args: args }));
        }
    }

    private handleBybitMessage(event: MessageEvent) {
        try {
            const data = JSON.parse(event.data);
            if (data.topic && data.data) {
                const tickerData = data.data;
                const symbol = data.topic.split('.')[1];
                const price = tickerData.lastPrice; // Note: may not exist in delta? Public linear usually sends snapshot logic.
                const change = tickerData.price24hPcnt;

                if (price) {
                    this.notify({
                        symbol: this.normalizeSymbol(symbol),
                        lastPrice: parseFloat(price),
                        priceChangePercent: parseFloat(change || '0') * 100,
                        exchange: 'bybit'
                    });
                }
            }
        } catch (e) { }
    }

    // --- HYPERLIQUID ---

    connectHyperliquid(isReconnect = false) {
        const ex = 'hyperliquid';

        // Single channel 'allMids', so just tracking if we asked for it
        if (!isReconnect && this.subscribedSymbols[ex].size > 0 && this.connections.has(ex)) {
            return; // Already connected and running
        }

        this.subscribedSymbols[ex].add('ALL'); // Flag that we want this

        // If exists and open, do nothing
        const existing = this.connections.get(ex);
        if (existing && existing.readyState === WebSocket.OPEN) return;

        this.cleanupConnection(ex); // Safety cleanup if restarting

        const ws = new WebSocket('wss://api.hyperliquid.xyz/ws');

        ws.onopen = () => {
            console.log(`[PriceWS] Hyperliquid Connected`);
            this.isReconnecting[ex] = false;

            ws.send(JSON.stringify({
                method: "subscribe",
                subscription: { type: "allMids" }
            }));

            // Heartbeat (30s)
            const hb = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ method: 'ping' }));
            }, 30000);
            this.heartbeats.set(ex, hb);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.channel === 'allMids') {
                    const mids = data.data.mids;
                    Object.entries(mids).forEach(([coin, price]) => {
                        this.notify({
                            symbol: coin,
                            lastPrice: parseFloat(price as string),
                            priceChangePercent: 0,
                            exchange: 'hyperliquid'
                        });
                    });
                }
            } catch (e) { }
        };

        ws.onerror = (e) => console.error('[PriceWS] Hyperliquid Error:', e);
        ws.onclose = () => {
            console.log('[PriceWS] Hyperliquid Closed');
            this.scheduleReconnect(ex);
        };

        this.connections.set(ex, ws);
    }

    disconnectAll() {
        this.connections.forEach(ws => ws.close());
        this.connections.clear();

        this.heartbeats.forEach(timer => clearInterval(timer));
        this.heartbeats.clear();

        this.reconnectTimers.forEach(timer => clearTimeout(timer));
        this.reconnectTimers.clear();

        // Clear registries
        this.subscribedSymbols['binance'] = new Set();
        this.subscribedSymbols['bybit'] = new Set();
        this.subscribedSymbols['hyperliquid'] = new Set();
    }
}

export const wsManager = new WebSocketManager();
