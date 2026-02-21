import { normalizeSymbol } from '@/lib/utils/normalization';
import { safeParseJson } from './websocket-types';
import { WS_ENDPOINTS } from './websocket-endpoints';
import { getHyperliquidPerpsMetaAndCtxs, getHyperliquidNotionalVolumeUsd } from './hyperliquid';

/** Bybit does not support tickers.*; subscribe to each symbol individually */
const BYBIT_TICKER_SYMBOLS = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT',
    'LINKUSDT', 'AVAXUSDT', 'DOTUSDT', 'MATICUSDT', 'UNIUSDT', 'ATOMUSDT',
    'LTCUSDT', 'BCHUSDT', 'NEARUSDT', 'FILUSDT', 'INJUSDT', 'TIAUSDT',
    'ARBUSDT', 'OPUSDT', 'SUIUSDT', 'SEIUSDT', 'PEPEUSDT', 'WIFUSDT',
    'APTUSDT', 'STXUSDT', 'IMXUSDT', 'RENDERUSDT', 'FETUSDT', 'RUNEUSDT',
    'AAVEUSDT', 'MKRUSDT', 'CRVUSDT', 'SANDUSDT', 'MANAUSDT', 'AXSUSDT',
    'GMTUSDT', 'APEUSDT', 'BLURUSDT', 'LDOUSDT', 'JUPUSDT', 'WLDUSDT', 'STRKUSDT',
];

/** Symbols to poll for Binance open interest (REST; 24h ticker does not include OI) */
const BINANCE_OI_SYMBOLS = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT',
    'LINKUSDT', 'AVAXUSDT', 'DOTUSDT', 'MATICUSDT', 'UNIUSDT', 'ATOMUSDT',
    'LTCUSDT', 'BCHUSDT', 'NEARUSDT', 'FILUSDT', 'INJUSDT', 'TIAUSDT',
    'ARBUSDT', 'OPUSDT', 'SUIUSDT', 'SEIUSDT', 'PEPEUSDT', 'WIFUSDT',
    'APTUSDT', 'STXUSDT', 'IMXUSDT', 'RENDERUSDT', 'FETUSDT', 'RUNEUSDT',
    'AAVEUSDT', 'MKRUSDT', 'CRVUSDT', 'SANDUSDT', 'MANAUSDT', 'AXSUSDT',
    'GMTUSDT', 'APEUSDT', 'BLURUSDT', 'LDOUSDT', 'ENSUSDT', 'DYDXUSDT',
    '1000PEPEUSDT', '1000SHIBUSDT', '1000FLOKIUSDT', 'JUPUSDT', 'WLDUSDT', 'STRKUSDT',
];

export interface ScreenerTickerData {
    symbol: string;
    exchange: 'binance' | 'bybit' | 'hyperliquid';
    price: number;
    change24h: number;
    change5m?: number;
    change15m?: number;
    change1h?: number;
    volume24h: number;
    volume1h?: number;
    openInterest?: number;
    oiChange1h?: number; // Orion parity: OI % change 1h
    fundingRate?: number;
    trades15m?: number;
    volatility15m?: number;
    rvol?: number;
    liquidations5m?: number;
    liquidations1h?: number;
    timestamp: number;
}

export type TickerCallback = (ticker: ScreenerTickerData) => void;
export type StatusCallback = (status: { exchange: string, connected: boolean, error?: string }) => void;

/** Bybit ticker payload (snapshot + delta); omitted fields mean "unchanged" */
interface BybitTickerPayload {
    symbol?: string;
    lastPrice?: string;
    price24hPcnt?: string;
    volume24h?: string;
    openInterest?: string;
    openInterestValue?: string;
    fundingRate?: string;
}

export class ScreenerWebSocketManager {
    private binanceWs: WebSocket | null = null;
    private binanceMarkPriceWs: WebSocket | null = null;
    private bybitWs: WebSocket | null = null;
    private hyperliquidWs: WebSocket | null = null;

    private onTicker: TickerCallback;
    private onStatus?: StatusCallback;

    private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
    private heartbeatTimers: Map<string, NodeJS.Timeout> = new Map();
    private reconnectCounts: Map<string, number> = new Map();
    private manualDisconnect = false;

    /** Binance funding rate by symbol (e.g. BTCUSDT) from !markPrice@arr stream */
    private binanceFundingBySymbol: Map<string, number> = new Map();

    /** Binance OI (contract count) from REST poll; OI USD = contracts * price in processBinanceTicker */
    private binanceOIContractsBySymbol: Map<string, number> = new Map();
    private binanceOIPollTimer: ReturnType<typeof setInterval> | null = null;
    private hyperliquidStatsPollTimer: ReturnType<typeof setInterval> | null = null;

    /** Bybit: cache last known OI and other optional fields so delta-only updates don't clear them */
    private bybitLastTickerBySymbol: Map<string, { openInterest?: number; fundingRate?: number; volume24h?: number; change24h?: number }> = new Map();
    private bybitFirstTickerLogged = false;

    // Price tracking for computing short-term changes
    private priceHistory: Map<string, { prices: number[], timestamps: number[] }> = new Map();
    // Rolling 24h volume snapshots to estimate true last-1h traded volume and RVOL
    private volumeHistory: Map<string, { volumes: number[], timestamps: number[] }> = new Map();
    // OI tracking for oiChange1h (Orion parity)
    private oiHistory: Map<string, { ois: number[], timestamps: number[] }> = new Map();

    constructor(onTicker: TickerCallback, onStatus?: StatusCallback) {
        this.onTicker = onTicker;
        this.onStatus = onStatus;
    }

    public connect() {
        this.manualDisconnect = false;
        console.log('[ScreenerWS] Initializing connections...');
        this.connectBinance();
        this.connectBybit();
        this.connectHyperliquid();
    }

    // ======= BINANCE =======
    private connectBinance() {
        try {
            // Use fapi (Futures API) which is more standard
            this.binanceWs = new WebSocket(`${WS_ENDPOINTS.binance.ws}/!ticker@arr`);

            this.binanceWs.onopen = () => {
                console.log('[ScreenerWS] Binance connected');
                this.onStatus?.({ exchange: 'binance', connected: true });
                this.reconnectCounts.set('binance', 0);
            };

            this.binanceWs.onmessage = (event) => {
                const data = safeParseJson<unknown[]>(event.data);
                if (Array.isArray(data)) {
                    data.forEach((ticker: unknown) => this.processBinanceTicker(ticker as { s?: string; c?: string; P?: string; v?: string; r?: string; E?: number }));
                }
            };

            this.binanceWs.onerror = (_error) => {
                // WebSocket Errors are often generic in browsers, logger doesn't show much 
                // Don't log full object if it's empty/useless
                console.error('[ScreenerWS] Binance connection error (Market data may be unavailable in some regions)');
                this.onStatus?.({ exchange: 'binance', connected: false, error: 'Connection error' });

                if (!this.manualDisconnect) {
                    try { this.binanceWs?.close(); } catch { /* noop */ }
                    this.scheduleReconnect('binance', () => this.connectBinance());
                }
            };

            this.binanceWs.onclose = () => {
                this.onStatus?.({ exchange: 'binance', connected: false });
                if (!this.manualDisconnect) {
                    this.scheduleReconnect('binance', () => this.connectBinance());
                }
            };

            // Binance 24h ticker does not include funding; subscribe to mark price stream for funding rate
            this.connectBinanceMarkPrice();
            // Binance 24h ticker does not include OI; poll REST for open interest
            this.startBinanceOIPoll();
        } catch (error) {
            console.error('[ScreenerWS] Binance connection failed:', error);
        }
    }

    private startBinanceOIPoll() {
        const fetchOI = async () => {
            const base = WS_ENDPOINTS.binance.futures;
            for (const symbol of BINANCE_OI_SYMBOLS) {
                try {
                    const res = await fetch(`${base}/fapi/v1/openInterest?symbol=${symbol}`);
                    if (!res.ok) continue;
                    const data = await res.json() as { openInterest?: string; symbol?: string };
                    const contracts = parseFloat(data.openInterest || '0');
                    if (!Number.isNaN(contracts)) this.binanceOIContractsBySymbol.set(symbol, contracts);
                } catch {
                    // ignore per-symbol errors
                }
            }
        };
        fetchOI();
        this.binanceOIPollTimer = setInterval(fetchOI, 60_000);
    }

    private connectBinanceMarkPrice() {
        try {
            this.binanceMarkPriceWs = new WebSocket(`${WS_ENDPOINTS.binance.ws}/!markPrice@arr`);

            this.binanceMarkPriceWs.onmessage = (event) => {
                const data = safeParseJson<unknown[]>(event.data);
                if (Array.isArray(data)) {
                    data.forEach((item: unknown) => {
                        const row = item as { s?: string; r?: string };
                        if (row.s && row.r !== undefined) {
                            const rate = parseFloat(row.r);
                            if (!Number.isNaN(rate)) this.binanceFundingBySymbol.set(row.s, rate);
                        }
                    });
                }
            };

            this.binanceMarkPriceWs.onerror = () => {
                try { this.binanceMarkPriceWs?.close(); } catch { /* noop */ }
                if (!this.manualDisconnect) {
                    this.binanceMarkPriceWs = null;
                    setTimeout(() => this.connectBinanceMarkPrice(), 5000);
                }
            };

            this.binanceMarkPriceWs.onclose = () => {
                this.binanceMarkPriceWs = null;
                if (!this.manualDisconnect) {
                    setTimeout(() => this.connectBinanceMarkPrice(), 5000);
                }
            };
        } catch (error) {
            console.error('[ScreenerWS] Binance mark price connection failed:', error);
        }
    }

    private processBinanceTicker(ticker: { s?: string; c?: string; P?: string; v?: string; r?: string; E?: number }) {
        // Filter for USDT perps only
        if (!ticker.s || !ticker.s.endsWith('USDT')) return;

        const symbol = ticker.s.replace('USDT', '');
        const price = parseFloat(ticker.c || '0');
        const change24h = parseFloat(ticker.P || '0');
        const volume24h = parseFloat(ticker.v || '0') * price;
        // Binance 24h ticker has no funding in stream; use mark price stream data
        const fundingRate = this.binanceFundingBySymbol.get(ticker.s);
        // Binance OI from REST poll (contracts * price = USD)
        const contracts = this.binanceOIContractsBySymbol.get(ticker.s);
        const openInterestUsd = contracts != null && price > 0 ? contracts * price : undefined;

        this.trackPrice(symbol, 'binance', price);
        this.trackVolume(symbol, 'binance', volume24h);
        if (openInterestUsd != null) this.trackOI(symbol, 'binance', openInterestUsd);
        const metrics = this.getMetrics(symbol, 'binance', price, volume24h, openInterestUsd);

        const tickerData: ScreenerTickerData = {
            symbol: normalizeSymbol(ticker.s || ''),
            exchange: 'binance',
            price,
            change24h,
            volume24h,
            openInterest: openInterestUsd,
            fundingRate: fundingRate !== undefined ? fundingRate : undefined,
            timestamp: ticker.E || Date.now(),
            ...metrics
        };

        this.onTicker(tickerData);
    }

    // ======= BYBIT =======
    private connectBybit() {
        try {
            this.bybitWs = new WebSocket(WS_ENDPOINTS.bybit.wsLinear);

            this.bybitWs.onopen = () => {
                console.log('[ScreenerWS] Bybit connected');
                this.onStatus?.({ exchange: 'bybit', connected: true });
                this.reconnectCounts.set('bybit', 0);

                const existingHb = this.heartbeatTimers.get('bybit');
                if (existingHb) clearInterval(existingHb);
                this.heartbeatTimers.delete('bybit');

                // Bybit does not support tickers.*; subscribe in batches to avoid undocumented limits
                const BYBIT_SUB_BATCH = 20;
                for (let i = 0; i < BYBIT_TICKER_SYMBOLS.length; i += BYBIT_SUB_BATCH) {
                    const chunk = BYBIT_TICKER_SYMBOLS.slice(i, i + BYBIT_SUB_BATCH).map(s => `tickers.${s}`);
                    this.bybitWs?.send(JSON.stringify({ op: 'subscribe', args: chunk }));
                }

                // REST snapshot so all symbols have data even if WS pushes are delayed or sparse
                fetch(`${WS_ENDPOINTS.bybit.api}/v5/market/tickers?category=linear`)
                    .then((r) => r.json())
                    .then((data: { result?: { list?: BybitTickerPayload[] } }) => {
                        const list = data?.result?.list;
                        if (Array.isArray(list)) {
                            list.forEach((item) => this.processBybitTicker(item));
                        }
                    })
                    .catch((e) => console.error('[ScreenerWS] Bybit REST tickers failed:', e));

                // Heartbeat
                this.heartbeatTimers.set('bybit', setInterval(() => {
                    if (this.bybitWs?.readyState === WebSocket.OPEN) {
                        this.bybitWs.send(JSON.stringify({ op: 'ping' }));
                    }
                }, 20000));
            };

            this.bybitWs.onmessage = (event) => {
                try {
                    const msg = safeParseJson<{ op?: string; topic?: string; data?: unknown }>(event.data);
                    if (!msg) return;
                    if (msg.op === 'pong' || msg.op === 'subscribe') return;
                    if (!msg.topic?.startsWith('tickers.') || msg.data == null) return;

                    const raw = msg.data;
                    const payload: unknown = Array.isArray(raw) ? raw[0] : raw;
                    if (!payload || typeof payload !== 'object' || !('symbol' in payload)) return;

                    this.processBybitTicker(payload as BybitTickerPayload);

                    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development' && !this.bybitFirstTickerLogged) {
                        this.bybitFirstTickerLogged = true;
                        console.log('[ScreenerWS] Bybit first ticker:', msg.topic, (payload as BybitTickerPayload).symbol);
                    }
                } catch (e) {
                    console.error('[ScreenerWS] Bybit message error:', e, event.data);
                }
            };

            this.bybitWs.onerror = (error) => {
                console.error('[ScreenerWS] Bybit error:', error);
                this.onStatus?.({ exchange: 'bybit', connected: false, error: 'Connection error' });
                if (!this.manualDisconnect) {
                    try { this.bybitWs?.close(); } catch { /* noop */ }
                    this.scheduleReconnect('bybit', () => this.connectBybit());
                }
            };

            this.bybitWs.onclose = () => {
                console.log('[ScreenerWS] Bybit disconnected, reconnecting...');
                this.onStatus?.({ exchange: 'bybit', connected: false });
                const hb = this.heartbeatTimers.get('bybit');
                if (hb) clearInterval(hb);
                this.heartbeatTimers.delete('bybit');
                if (!this.manualDisconnect) this.scheduleReconnect('bybit', () => this.connectBybit());
            };
        } catch (error) {
            console.error('[ScreenerWS] Bybit connection failed:', error);
        }
    }

    private processBybitTicker(data: BybitTickerPayload) {
        const symbol = data.symbol?.replace('USDT', '') || '';
        if (!symbol) return;

        const cacheKey = normalizeSymbol(data.symbol || '');
        const cached = this.bybitLastTickerBySymbol.get(cacheKey);

        const price = parseFloat(data.lastPrice || '0');

        // OI: prefer openInterestValue (USD); else openInterest * price; else use cache
        let openInterest: number | undefined;
        if (data.openInterestValue !== undefined && data.openInterestValue !== '') {
            const parsed = parseFloat(data.openInterestValue);
            if (!Number.isNaN(parsed)) openInterest = parsed;
        }
        if (openInterest === undefined && data.openInterest !== undefined && data.openInterest !== '') {
            const parsed = parseFloat(data.openInterest);
            if (!Number.isNaN(parsed) && price > 0) openInterest = parsed * price;
        }
        if (openInterest === undefined && cached?.openInterest !== undefined) {
            openInterest = cached.openInterest;
        }

        // Optional fields: use message value if present, else cached
        const change24hRaw = data.price24hPcnt !== undefined && data.price24hPcnt !== '' ? parseFloat(data.price24hPcnt || '0') * 100 : undefined;
        const change24h = change24hRaw !== undefined ? change24hRaw : (cached?.change24h ?? 0);

        const volume24hRaw = data.volume24h !== undefined && data.volume24h !== '' ? parseFloat(data.volume24h || '0') * price : undefined;
        const volume24h = volume24hRaw !== undefined ? volume24hRaw : (cached?.volume24h ?? 0);

        const fundingRateRaw = data.fundingRate !== undefined && data.fundingRate !== '' ? parseFloat(data.fundingRate || '0') : undefined;
        const fundingRate = fundingRateRaw !== undefined ? fundingRateRaw : cached?.fundingRate;

        this.trackPrice(symbol, 'bybit', price);
        this.trackVolume(symbol, 'bybit', volume24h);
        if (openInterest !== undefined) this.trackOI(symbol, 'bybit', openInterest);
        const metrics = this.getMetrics(symbol, 'bybit', price, volume24h, openInterest);

        const tickerData: ScreenerTickerData = {
            symbol: cacheKey,
            exchange: 'bybit',
            price,
            change24h,
            volume24h,
            openInterest,
            fundingRate,
            timestamp: Date.now(),
            ...metrics
        };

        this.bybitLastTickerBySymbol.set(cacheKey, {
            openInterest,
            fundingRate,
            volume24h,
            change24h
        });

        this.onTicker(tickerData);
    }

    // ======= HYPERLIQUID =======
    private connectHyperliquid() {
        try {
            this.hyperliquidWs = new WebSocket(WS_ENDPOINTS.hyperliquid.ws);

            this.hyperliquidWs.onopen = () => {
                console.log('[ScreenerWS] Hyperliquid connected');
                this.onStatus?.({ exchange: 'hyperliquid', connected: true });
                this.reconnectCounts.set('hyperliquid', 0);

                const existingHb = this.heartbeatTimers.get('hyperliquid');
                if (existingHb) clearInterval(existingHb);
                this.heartbeatTimers.delete('hyperliquid');

                // Subscribe to allMids (all prices)
                this.hyperliquidWs?.send(JSON.stringify({
                    method: 'subscribe',
                    subscription: { type: 'allMids' }
                }));

                // Market stats are polled from official info endpoint (metaAndAssetCtxs)
                // to avoid dependency on internal websocket channels.
                this.clearHyperliquidStatsPoll();
                this.pollHyperliquidStats().catch(() => { /* noop */ });
                this.hyperliquidStatsPollTimer = setInterval(() => {
                    this.pollHyperliquidStats().catch(() => { /* noop */ });
                }, 20000);

                // Heartbeat
                this.heartbeatTimers.set('hyperliquid', setInterval(() => {
                    if (this.hyperliquidWs?.readyState === WebSocket.OPEN) {
                        this.hyperliquidWs.send(JSON.stringify({ method: 'ping' }));
                    }
                }, 20000));
            };

            this.hyperliquidWs.onmessage = (event) => {
                try {
                    const msg = safeParseJson<{ channel?: string; data?: { mids?: Record<string, unknown> } }>(event.data);
                    if (!msg) return;

                    if (msg.channel === 'allMids' && msg.data?.mids && typeof msg.data.mids === 'object') {
                        Object.entries(msg.data.mids).forEach(([symbol, price]) => {
                            const p = parseFloat(price as string);
                            if (!Number.isNaN(p)) this.trackPrice(symbol, 'hyperliquid', p);
                        });
                    }
                } catch (e) {
                    console.error('[ScreenerWS] Hyperliquid message error:', e, event.data);
                }
            };

            this.hyperliquidWs.onerror = (error) => {
                console.error('[ScreenerWS] Hyperliquid error:', error);
                this.onStatus?.({ exchange: 'hyperliquid', connected: false, error: 'Connection error' });
                if (!this.manualDisconnect) {
                    this.clearHyperliquidStatsPoll();
                    try { this.hyperliquidWs?.close(); } catch { /* noop */ }
                    this.scheduleReconnect('hyperliquid', () => this.connectHyperliquid());
                }
            };

            this.hyperliquidWs.onclose = () => {
                console.log('[ScreenerWS] Hyperliquid disconnected, reconnecting...');
                this.onStatus?.({ exchange: 'hyperliquid', connected: false });
                const hb = this.heartbeatTimers.get('hyperliquid');
                if (hb) clearInterval(hb);
                this.heartbeatTimers.delete('hyperliquid');
                this.clearHyperliquidStatsPoll();
                if (!this.manualDisconnect) this.scheduleReconnect('hyperliquid', () => this.connectHyperliquid());
            };
        } catch (error) {
            console.error('[ScreenerWS] Hyperliquid connection failed:', error);
        }
    }

    private clearHyperliquidStatsPoll() {
        if (this.hyperliquidStatsPollTimer) {
            clearInterval(this.hyperliquidStatsPollTimer);
            this.hyperliquidStatsPollTimer = null;
        }
    }

    private async pollHyperliquidStats() {
        const data = await getHyperliquidPerpsMetaAndCtxs();
        if (!data) return;
        this.processHyperliquidStats({
            meta: data.meta,
            assetCtxs: data.ctxs
        });
    }

    private processHyperliquidStats(data: {
        meta?: { universe?: Array<{ name?: string } | null> };
        assetCtxs?: Array<{ markPx?: string; prevDayPx?: string; dayNtlVlm?: string; dayNfv?: string; openInterest?: string; funding?: string } | null>;
    }) {
        if (!data || typeof data !== 'object') return;

        const universe = data.meta?.universe || [];
        const assetCtxs = data.assetCtxs || [];

        if (!Array.isArray(universe) || !Array.isArray(assetCtxs)) return;

        universe.forEach((asset: { name?: string } | null, index: number) => {
            try {
                if (!asset) return;
                const ctx = assetCtxs[index];
                if (!ctx) return;

                const symbol = asset.name;
                if (!symbol) return;

                const price = parseFloat(ctx.markPx || '0');
                const prevDayPx = parseFloat(ctx.prevDayPx || '0');
                const change24h = prevDayPx > 0 ? ((price / prevDayPx) - 1) * 100 : 0;
                const volume24h = getHyperliquidNotionalVolumeUsd(ctx);
                const openInterest = parseFloat(ctx.openInterest || '0') * price;
                const fundingRate = parseFloat(ctx.funding || '0');

                this.trackVolume(symbol, 'hyperliquid', volume24h);
                this.trackOI(symbol, 'hyperliquid', openInterest);
                const metrics = this.getMetrics(symbol, 'hyperliquid', price, volume24h, openInterest);

                const tickerData: ScreenerTickerData = {
                    symbol: normalizeSymbol(symbol),
                    exchange: 'hyperliquid',
                    price,
                    change24h,
                    volume24h,
                    openInterest,
                    fundingRate,
                    timestamp: Date.now(),
                    ...metrics
                };

                this.onTicker(tickerData);
            } catch (e) {
                console.warn('[ScreenerWS] Hyperliquid asset skip:', asset?.name ?? index, e);
            }
        });
    }

    // ======= UTILITIES =======
    private trackPrice(symbol: string, exchange: string, price: number) {
        const key = `${symbol}-${exchange}`;
        if (!this.priceHistory.has(key)) {
            this.priceHistory.set(key, { prices: [], timestamps: [] });
        }

        const history = this.priceHistory.get(key)!;
        const now = Date.now();

        // Optimization: Limit history resolution to ~5s to save memory directly in the browser
        const lastTime = history.timestamps.length > 0 ? history.timestamps[history.timestamps.length - 1] : 0;
        if (now - lastTime! < 5000) {
            // Update last point instead of appending
            if (history.prices.length > 0) {
                history.prices[history.prices.length - 1] = price;
                history.timestamps[history.timestamps.length - 1] = now;
            } else {
                history.prices.push(price);
                history.timestamps.push(now);
            }
        } else {
            history.prices.push(price);
            history.timestamps.push(now);
        }

        // Keep last 65 minutes of data for 1h calculations
        const cutoff = now - 65 * 60 * 1000;
        while (history.timestamps.length > 0 && history.timestamps[0]! < cutoff) {
            history.timestamps.shift();
            history.prices.shift();
        }
    }

    private trackOI(symbol: string, exchange: string, oi: number) {
        const key = `${symbol}-${exchange}`;
        if (!this.oiHistory.has(key)) {
            this.oiHistory.set(key, { ois: [], timestamps: [] });
        }
        const history = this.oiHistory.get(key)!;
        const now = Date.now();
        const lastTime = history.timestamps.length > 0 ? history.timestamps[history.timestamps.length - 1] : 0;
        if (now - lastTime! < 60000) {
            if (history.ois.length > 0) {
                history.ois[history.ois.length - 1] = oi;
                history.timestamps[history.timestamps.length - 1] = now;
            } else {
                history.ois.push(oi);
                history.timestamps.push(now);
            }
        } else {
            history.ois.push(oi);
            history.timestamps.push(now);
        }
        const cutoff = now - 65 * 60 * 1000;
        while (history.timestamps.length > 0 && history.timestamps[0]! < cutoff) {
            history.timestamps.shift();
            history.ois.shift();
        }
    }

    private trackVolume(symbol: string, exchange: string, volume24h: number) {
        if (!Number.isFinite(volume24h) || volume24h <= 0) return;
        const key = `${symbol}-${exchange}`;
        if (!this.volumeHistory.has(key)) {
            this.volumeHistory.set(key, { volumes: [], timestamps: [] });
        }
        const history = this.volumeHistory.get(key)!;
        const now = Date.now();
        const lastTime = history.timestamps.length > 0 ? history.timestamps[history.timestamps.length - 1] : 0;
        if (now - lastTime < 5000) {
            if (history.volumes.length > 0) {
                history.volumes[history.volumes.length - 1] = volume24h;
                history.timestamps[history.timestamps.length - 1] = now;
            } else {
                history.volumes.push(volume24h);
                history.timestamps.push(now);
            }
        } else {
            history.volumes.push(volume24h);
            history.timestamps.push(now);
        }

        const cutoff = now - 65 * 60 * 1000;
        while (history.timestamps.length > 0 && history.timestamps[0]! < cutoff) {
            history.timestamps.shift();
            history.volumes.shift();
        }
    }

    private estimateVolume1h(symbol: string, exchange: string): number {
        const key = `${symbol}-${exchange}`;
        const history = this.volumeHistory.get(key);
        if (!history || history.volumes.length < 2) return 0;

        const cutoff = Date.now() - 60 * 60 * 1000;
        let rolling = 0;
        for (let i = 1; i < history.volumes.length; i++) {
            if (history.timestamps[i]! < cutoff) continue;
            const prev = history.volumes[i - 1]!;
            const curr = history.volumes[i]!;
            const delta = curr >= prev ? curr - prev : curr;
            if (delta > 0) rolling += delta;
        }
        return rolling;
    }

    private estimateVolume5m(symbol: string, exchange: string): number {
        const key = `${symbol}-${exchange}`;
        const history = this.volumeHistory.get(key);
        if (!history || history.volumes.length < 2) return 0;

        const cutoff = Date.now() - 5 * 60 * 1000;
        let rolling = 0;
        for (let i = 1; i < history.volumes.length; i++) {
            if (history.timestamps[i]! < cutoff) continue;
            const prev = history.volumes[i - 1]!;
            const curr = history.volumes[i]!;
            const delta = curr >= prev ? curr - prev : curr;
            if (delta > 0) rolling += delta;
        }
        return rolling;
    }

    private deriveRvol(volume5m: number, volume24h: number): number {
        if (!Number.isFinite(volume24h) || volume24h <= 0) return 0;
        const avg5m = Math.max(volume24h / 288, 1);
        const r = volume5m / avg5m;
        if (!Number.isFinite(r) || r < 0) return 0;
        return Math.min(r, 99.99);
    }

    private getMetrics(symbol: string, exchange: string, currentPrice: number, volume24h: number, openInterest?: number) {
        const key = `${symbol}-${exchange}`;
        const history = this.priceHistory.get(key);

        let oiChange1h: number | undefined;
        if (openInterest !== undefined) {
            const oiKey = `${symbol}-${exchange}`;
            const oiHist = this.oiHistory.get(oiKey);
            if (oiHist && oiHist.ois.length >= 2) {
                const now = Date.now();
                const targetTime = now - 60 * 60 * 1000;
                for (let i = oiHist.timestamps.length - 1; i >= 0; i--) {
                    if (oiHist.timestamps[i]! <= targetTime) {
                        const oi1h = oiHist.ois[i];
                        if (oi1h && oi1h > 0) {
                            oiChange1h = ((openInterest - oi1h) / oi1h) * 100;
                        }
                        break;
                    }
                }
            }
        }

        if (!history || history.prices.length < 2) {
            const volume1h = this.estimateVolume1h(symbol, exchange);
            const volume5m = this.estimateVolume5m(symbol, exchange);
            return {
                change5m: 0,
                change15m: 0,
                change1h: 0,
                volatility15m: 0,
                trades15m: 0,
                volume1h,
                rvol: this.deriveRvol(volume5m, volume24h),
                liquidations5m: 0,
                liquidations1h: 0,
                oiChange1h
            };
        }

        const now = Date.now();
        const findPriceAtTime = (msAgo: number) => {
            const targetTime = now - msAgo;
            // Find finding closest timestamp
            for (let i = history.timestamps.length - 1; i >= 0; i--) {
                if (history.timestamps[i]! <= targetTime) {
                    return history.prices[i];
                }
            }
            return history.prices[0]; // fallback to oldest
        };

        const price5m = findPriceAtTime(5 * 60 * 1000);
        const price15m = findPriceAtTime(15 * 60 * 1000);
        const price1h = findPriceAtTime(60 * 60 * 1000);

        const change5m = price5m ? ((currentPrice - price5m) / price5m) * 100 : 0;
        const change15m = price15m ? ((currentPrice - price15m) / price15m) * 100 : 0;
        const change1h = price1h ? ((currentPrice - price1h) / price1h) * 100 : 0;

        // Calculate volatility (std dev of returns in last 15m)
        let volatility15m = 0;
        const prices15m = [];
        for (let i = 0; i < history.timestamps.length; i++) {
            if (history.timestamps[i]! > now - 15 * 60 * 1000) {
                prices15m.push(history.prices[i]!);
            }
        }

        if (prices15m.length > 1) {
            const mean = prices15m.reduce((a, b) => a + b, 0) / prices15m.length;
            const variance = prices15m.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices15m.length;
            volatility15m = (Math.sqrt(variance) / mean) * 100;
        }

        // Simulate trades count based on volume
        const trades15m = Math.round((volume24h / 96) / 500);
        const volume1h = this.estimateVolume1h(symbol, exchange);
        const volume5m = this.estimateVolume5m(symbol, exchange);
        const rvol = this.deriveRvol(volume5m, volume24h);

        // Simulate liquidations based on volatility spikes
        const baseLiq = volume24h * 0.0001; // Base liquidation factor
        const volFactor = volatility15m > 0.5 ? volatility15m : 0;

        const liquidations5m = Math.round(baseLiq * volFactor);
        const liquidations1h = Math.round(baseLiq * volFactor * 12);

        return {
            change5m,
            change15m,
            change1h,
            volatility15m,
            trades15m,
            volume1h,
            rvol,
            liquidations5m,
            liquidations1h,
            oiChange1h
        };
    }

    private scheduleReconnect(exchange: string, reconnectFn: () => void) {
        if (this.manualDisconnect) return;
        if (this.reconnectTimers.has(exchange)) return;

        // Exponential backoff
        const attempts = (this.reconnectCounts.get(exchange) || 0) + 1;
        this.reconnectCounts.set(exchange, attempts);
        const delay = Math.min(1500 * Math.pow(2, attempts), 60000); // max 60s
        const jitter = Math.floor(Math.random() * 500);

        const timer = setTimeout(() => {
            this.reconnectTimers.delete(exchange);
            reconnectFn();
        }, delay + jitter);

        this.reconnectTimers.set(exchange, timer);
    }

    public disconnect() {
        console.log('[ScreenerWS] Disconnecting all...');

        this.manualDisconnect = true;

        this.reconnectTimers.forEach(timer => clearTimeout(timer));
        this.reconnectTimers.clear();
        this.heartbeatTimers.forEach(timer => clearInterval(timer));
        this.heartbeatTimers.clear();

        if (this.binanceOIPollTimer) {
            clearInterval(this.binanceOIPollTimer);
            this.binanceOIPollTimer = null;
        }
        this.clearHyperliquidStatsPoll();

        [this.binanceWs, this.binanceMarkPriceWs, this.bybitWs, this.hyperliquidWs].forEach(ws => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        });
        this.binanceWs = null;
        this.binanceMarkPriceWs = null;
        this.bybitWs = null;
        this.hyperliquidWs = null;
    }
}

let sharedManager: ScreenerWebSocketManager | null = null;
let sharedRefCount = 0;
const sharedTickerSubs = new Set<TickerCallback>();
const sharedStatusSubs = new Set<StatusCallback>();

export function acquireSharedScreenerWebSocketManager(
    onTicker: TickerCallback,
    onStatus?: StatusCallback
) {
    sharedRefCount += 1;
    sharedTickerSubs.add(onTicker);
    if (onStatus) sharedStatusSubs.add(onStatus);

    if (!sharedManager) {
        sharedManager = new ScreenerWebSocketManager(
            (ticker) => {
                sharedTickerSubs.forEach(cb => cb(ticker));
            },
            (status) => {
                sharedStatusSubs.forEach(cb => cb(status));
            }
        );
        sharedManager.connect();
    }

    const release = () => {
        sharedTickerSubs.delete(onTicker);
        if (onStatus) sharedStatusSubs.delete(onStatus);
        sharedRefCount = Math.max(0, sharedRefCount - 1);
        if (sharedRefCount === 0) {
            sharedManager?.disconnect();
            sharedManager = null;
        }
    };

    return { manager: sharedManager, release };
}
