import ccxt from "ccxt";

// Cache exchange instances by unique key (apiKey + secret hash or similar)
const exchangeCache = new Map<string, any>();

/** Clear all cached exchange instances (useful when credentials change). */
export function clearExchangeCache(): void {
    exchangeCache.clear();
}

export function getExchangeInstance(exchangeId: string, apiKey: string, secret: string, options: any = {}): any {
    // Unique key for cache
    const optionsKey = JSON.stringify(options);
    const key = `${exchangeId}:${apiKey}:${secret}:${optionsKey}`;

    if (exchangeCache.has(key)) {
        return exchangeCache.get(key);
    }

    if (!(ccxt as any)[exchangeId]) {
        throw new Error(`Invalid exchange: ${exchangeId}`);
    }

    // Bybit UTA (Unified Trading Account) defaults:
    // All Bybit accounts are now UTA – there are no more separate SPOT/CONTRACT account types.
    // CCXT v4 uses defaultType to decide the V5 API category parameter.
    // "swap" maps to the unified linear endpoint which covers both spot and derivatives on UTA.
    const bybitDefaults = exchangeId === "bybit" ? {
        defaultType: "swap",
        recvWindow: 20000,
        adjustForTimeDifference: true,
    } : {};

    const mergedOptions = {
        ...bybitDefaults,
        ...(options?.options || {}),
    };

    // IMPORTANT: Enable built-in rate limiter + timeout safety
    const exchange = new (ccxt as any)[exchangeId]({
        apiKey,
        secret,
        enableRateLimit: true,
        timeout: 15000,
        ...options,
        options: mergedOptions,
    });

    if (exchangeId === "bybit") {
        exchange.options = {
            ...(exchange.options || {}),
            recvWindow: 20000,
            adjustForTimeDifference: true,
        };
    }

    exchangeCache.set(key, exchange);
    return exchange;
}
