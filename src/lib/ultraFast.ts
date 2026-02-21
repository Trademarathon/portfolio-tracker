// ========== ULTRA-FAST CONFIGURATION ==========
export const ULTRA_CONFIG = {
    // Polling intervals (ms) - aggressive for low latency
    TICKER_POLL_MS: 100,        // 10x per second for price
    TRADES_POLL_MS: 200,        // 5x per second for trades
    ORDERBOOK_POLL_MS: 150,     // 6.6x per second for orderbook
    POSITION_POLL_MS: 250,      // 4x per second for positions
    ORDER_POLL_MS: 300,         // 3.3x per second for orders
    // Watchlist hits multiple third-party public APIs; keep this slower to reduce
    // rate-limits and "Failed to fetch" noise in dev.
    WATCHLIST_POLL_MS: 10000,   // 0.1x per second for watchlist
    LIQUIDATION_POLL_MS: 300,   // 3.3x per second for liquidations
    CVD_POLL_MS: 500,           // 2x per second for CVD

    // WebSocket settings
    WS_HEARTBEAT_MS: 15000,     // Keep-alive ping
    WS_RECONNECT_MS: 500,       // Fast reconnect
    WS_MAX_RECONNECTS: 10,

    // Request optimization
    REQUEST_TIMEOUT_MS: 3000,   // Aggressive timeout
    BATCH_DELAY_MS: 10,         // Micro-batch delay
    MAX_CONCURRENT_REQUESTS: 8,

    // Latency tracking
    LATENCY_WINDOW_SIZE: 20,    // Rolling average window
};

// ========== LATENCY TRACKER CLASS ==========
export class LatencyTracker {
    private samples: number[] = [];
    private maxSamples: number;

    constructor(maxSamples = ULTRA_CONFIG.LATENCY_WINDOW_SIZE) {
        this.maxSamples = maxSamples;
    }

    add(latency: number) {
        this.samples.push(latency);
        if (this.samples.length > this.maxSamples) {
            this.samples.shift();
        }
    }

    get average(): number {
        if (this.samples.length === 0) return 0;
        return Math.round(this.samples.reduce((a, b) => a + b, 0) / this.samples.length);
    }

    get min(): number {
        return this.samples.length > 0 ? Math.min(...this.samples) : 0;
    }

    get max(): number {
        return this.samples.length > 0 ? Math.max(...this.samples) : 0;
    }

    get p99(): number {
        if (this.samples.length === 0) return 0;
        const sorted = [...this.samples].sort((a, b) => a - b);
        const idx = Math.floor(sorted.length * 0.99);
        return sorted[idx] || sorted[sorted.length - 1];
    }

    get stats() {
        return {
            avg: this.average,
            min: this.min,
            max: this.max,
            p99: this.p99,
        };
    }
}

// ========== REQUEST QUEUE FOR THROTTLING ==========
export class RequestQueue {
    private queue: (() => Promise<void>)[] = [];
    private running = 0;
    private maxConcurrent: number;

    constructor(maxConcurrent = ULTRA_CONFIG.MAX_CONCURRENT_REQUESTS) {
        this.maxConcurrent = maxConcurrent;
    }

    async add(fn: () => Promise<void>) {
        if (this.running < this.maxConcurrent) {
            this.running++;
            try {
                await fn();
            } finally {
                this.running--;
                this.processNext();
            }
        } else {
            this.queue.push(fn);
        }
    }

    private processNext() {
        if (this.queue.length > 0 && this.running < this.maxConcurrent) {
            const next = this.queue.shift();
            if (next) {
                this.running++;
                next().finally(() => {
                    this.running--;
                    this.processNext();
                });
            }
        }
    }

    get pending(): number {
        return this.queue.length;
    }

    get active(): number {
        return this.running;
    }
}

// ========== FAST FETCH WITH TIMEOUT ==========
export async function ultraFetch(
    url: string,
    options: RequestInit = {},
    timeout = ULTRA_CONFIG.REQUEST_TIMEOUT_MS
): Promise<Response> {
    // Browser-side: Proxy cross-origin or local-IP requests to bypass CORS/PNA blocks
    if (typeof window !== 'undefined' && url.startsWith('http')) {
        const isLocal = url.includes('127.0.0.1') || url.includes('localhost');
        const isCurrentHost = url.includes(window.location.host);

        if (isLocal || !isCurrentHost) {
            try {
                // Extract body to forward as an object if possible
                let parsedBody: any = undefined;
                if (options?.body) {
                    try {
                        parsedBody = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
                    } catch (_e) {
                        parsedBody = options.body;
                    }
                }

                const proxyResponse = await fetch('/api/proxy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url,
                        method: options?.method || 'GET',
                        headers: options?.headers,
                        body: parsedBody
                    }),
                    signal: options?.signal,
                    keepalive: true,
                });

                // If proxy worked or gave a real error, return it
                if (proxyResponse.ok || proxyResponse.status !== 599) {
                    return proxyResponse;
                }
            } catch (_e) {
                // FALLBACK to direct fetch if proxy itself fails
                console.warn("[ultraFetch] Proxy failed, falling back to direct:", url);
            }
        }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: options?.signal || controller.signal,
            keepalive: typeof window !== 'undefined',
        });
        return response;
    } catch (e: any) {
        // IMPORTANT: never throw from ultraFetch.
        // Many UI components call ultraFetch directly and only check `response.ok`.
        // If `fetch()` rejects (CORS, offline, DNS, etc), it becomes a noisy
        // console TypeError ("Failed to fetch") and can trigger Next dev "issues".
        const statusText =
            e?.name === 'AbortError' ? 'Timeout' :
                e?.message ? String(e.message) :
                    'Network error';
        return new Response(null, { status: 599, statusText });
    } finally {
        clearTimeout(timeoutId);
    }
}

// ========== FAST JSON FETCH ==========
export async function ultraFetchJson<T>(
    url: string,
    options: RequestInit = {},
    timeout = ULTRA_CONFIG.REQUEST_TIMEOUT_MS
): Promise<{ data: T | null; latency: number; error?: string }> {
    const start = performance.now();

    try {
        const response = await ultraFetch(url, options, timeout);
        const latency = Math.round(performance.now() - start);

        if (!response.ok) {
            return { data: null, latency, error: `HTTP ${response.status}` };
        }

        const data = await response.json();
        return { data, latency };
    } catch (e: any) {
        const latency = Math.round(performance.now() - start);
        return { data: null, latency, error: e.message || 'Fetch failed' };
    }
}

// ========== GLOBAL INSTANCES ==========
export const globalRequestQueue = new RequestQueue();
export const globalLatencyTrackers: Map<string, LatencyTracker> = new Map();

export function getLatencyTracker(exchange: string): LatencyTracker {
    if (!globalLatencyTrackers.has(exchange)) {
        globalLatencyTrackers.set(exchange, new LatencyTracker());
    }
    return globalLatencyTrackers.get(exchange)!;
}

// ========== EXCHANGE ENDPOINTS (single registry: websocket-endpoints.ts) ==========
export { ENDPOINTS } from '@/lib/api/websocket-endpoints';

// ========== UTILITY FUNCTIONS ==========
export function formatLatencyStatus(latency: number): {
    label: string;
    color: string;
    bgColor: string;
    bars: number;
} {
    if (latency <= 30) return { label: 'ULTRA', color: 'text-emerald-400', bgColor: 'bg-emerald-400', bars: 5 };
    if (latency <= 50) return { label: 'FAST', color: 'text-emerald-400', bgColor: 'bg-emerald-400', bars: 4 };
    if (latency <= 100) return { label: 'GOOD', color: 'text-lime-400', bgColor: 'bg-lime-400', bars: 3 };
    if (latency <= 200) return { label: 'OK', color: 'text-amber-400', bgColor: 'bg-amber-400', bars: 2 };
    if (latency <= 500) return { label: 'SLOW', color: 'text-orange-400', bgColor: 'bg-orange-400', bars: 1 };
    return { label: 'LAG', color: 'text-rose-400', bgColor: 'bg-rose-400', bars: 1 };
}
