/**
 * Hook for aggregating futures data from multiple exchanges
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    fetchAggregatedOrderBook,
    fetchAggregatedFundingRates,
    fetchAggregatedMarketData,
    mergeOrderBooks,
    getBestPrices,
    getAverageFundingRate,
    AggregatedOrderBook,
    FundingRate,
    FuturesMarketData,
    FuturesAggregatorSettings,
    DEFAULT_AGGREGATOR_SETTINGS,
    FUTURES_AGGREGATOR_SETTINGS_KEY
} from '@/lib/api/futures-aggregator';
import { subscribeOrderBook } from '@/lib/api/orderbook-ws-pool';

export interface UseFuturesAggregatorResult {
    // Data
    orderBooks: AggregatedOrderBook[];
    fundingRates: FundingRate[];
    marketData: FuturesMarketData[];
    
    // Merged data
    mergedOrderBook: ReturnType<typeof mergeOrderBooks> | null;
    bestPrices: ReturnType<typeof getBestPrices>;
    avgFunding: ReturnType<typeof getAverageFundingRate>;
    
    // State
    isLoading: boolean;
    lastUpdate: number;
    errors: { exchange: string; error: string }[];
    
    // Settings
    settings: FuturesAggregatorSettings;
    updateSettings: (settings: Partial<FuturesAggregatorSettings>) => void;
    
    // Actions
    refresh: () => Promise<void>;
    setSymbol: (symbol: string) => void;
}

export function useFuturesAggregator(initialSymbol: string = 'BTCUSDT'): UseFuturesAggregatorResult {
    const [symbol, setSymbol] = useState(initialSymbol);
    const [orderBooks, setOrderBooks] = useState<AggregatedOrderBook[]>([]);
    const [fundingRates, setFundingRates] = useState<FundingRate[]>([]);
    const [marketData, setMarketData] = useState<FuturesMarketData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [lastUpdate, setLastUpdate] = useState(0);
    const [errors, setErrors] = useState<{ exchange: string; error: string }[]>([]);
    const [settings, setSettings] = useState<FuturesAggregatorSettings>(DEFAULT_AGGREGATOR_SETTINGS);
    
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Sync symbol from parent when it changes (e.g. user selects new pair)
    useEffect(() => {
        setSymbol(initialSymbol);
    }, [initialSymbol]);
    
    // Load settings from localStorage (initial + when Settings page updates and dispatches)
    const loadSettings = useCallback(() => {
        try {
            const saved = localStorage.getItem(FUTURES_AGGREGATOR_SETTINGS_KEY);
            const parsed = saved ? JSON.parse(saved) : {};
            setSettings(prev => ({ ...DEFAULT_AGGREGATOR_SETTINGS, ...prev, ...parsed }));
        } catch (e) {
            console.error('Failed to parse aggregator settings:', e);
        }
    }, []);

    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    useEffect(() => {
        const handleSettingsChanged = () => loadSettings();
        window.addEventListener('settings-changed', handleSettingsChanged);
        return () => window.removeEventListener('settings-changed', handleSettingsChanged);
    }, [loadSettings]);
    
    // Update settings
    const updateSettings = useCallback((newSettings: Partial<FuturesAggregatorSettings>) => {
        setSettings(prev => {
            const updated = { ...prev, ...newSettings };
            localStorage.setItem(FUTURES_AGGREGATOR_SETTINGS_KEY, JSON.stringify(updated));
            return updated;
        });
    }, []);
    
    // Fetch all data
    const refresh = useCallback(async () => {
        if (isLoading) return;
        
        setIsLoading(true);
        const newErrors: { exchange: string; error: string }[] = [];
        
        try {
            // Fetch order books
            const books = await fetchAggregatedOrderBook(
                symbol,
                settings.enabledExchanges,
                settings.orderBookDepth
            );
            setOrderBooks(books);
            
            // Fetch funding rates
            if (settings.showFundingRates) {
                const rates = await fetchAggregatedFundingRates(symbol, settings.enabledExchanges);
                setFundingRates(rates);
            }
            
            // Fetch market data
            const data = await fetchAggregatedMarketData(symbol, settings.enabledExchanges);
            setMarketData(data);
            
            setLastUpdate(Date.now());
        } catch (e) {
            console.error('Aggregator fetch error:', e);
            newErrors.push({ exchange: 'all', error: String(e) });
        } finally {
            setErrors(newErrors);
            setIsLoading(false);
        }
    }, [symbol, settings.enabledExchanges, settings.orderBookDepth, settings.showFundingRates, isLoading]);
    
    // Auto-refresh
    useEffect(() => {
        // Initial fetch
        refresh();
        
        // Set up interval
        if (settings.refreshInterval > 0) {
            intervalRef.current = setInterval(refresh, settings.refreshInterval);
        }
        
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [symbol, settings.refreshInterval]); // Don't include refresh to avoid infinite loop
    
    // Compute merged data
    const mergedOrderBook = orderBooks.length > 0 && settings.autoAggregateOrderBook
        ? mergeOrderBooks(orderBooks, settings.tickSize === 'auto' ? 0.01 : parseFloat(settings.tickSize))
        : null;
    
    const bestPrices = getBestPrices(orderBooks);
    const avgFunding = getAverageFundingRate(fundingRates);
    
    return {
        orderBooks,
        fundingRates,
        marketData,
        mergedOrderBook,
        bestPrices,
        avgFunding,
        isLoading,
        lastUpdate,
        errors,
        settings,
        updateSettings,
        refresh,
        setSymbol
    };
}

// ========== WEBSOCKET VERSION (pooled: one connection per symbol+exchange) ==========

const BATCH_MS = 16; // 60fps for smooth DOM updates

function toFuturesSymbol(s: string): string {
    const cleaned = s.replace(/USDT|USDC|\/|-/gi, '').toUpperCase() || 'BTC';
    return cleaned + 'USDT';
}

export function useFuturesWebSocket(symbol: string, exchanges: string[] = ['binance', 'bybit']) {
    const futuresSymbol = toFuturesSymbol(symbol);
    const [connected, setConnected] = useState<Record<string, boolean>>({});
    const [lastTrades, setLastTrades] = useState<any[]>([]);
    const [realtimeBook, setRealtimeBook] = useState<Record<string, AggregatedOrderBook>>({});
    
    const pendingRef = useRef<Partial<Record<string, AggregatedOrderBook>>>({});
    const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const flushBatch = useCallback(() => {
        batchTimerRef.current = null;
        const pending = pendingRef.current;
        if (Object.keys(pending).length === 0) return;
        pendingRef.current = {};
        const updates = Object.fromEntries(
            Object.entries(pending).filter(([, v]) => v != null)
        ) as Record<string, AggregatedOrderBook>;
        setRealtimeBook(prev => ({ ...prev, ...updates }));
    }, []);

    const scheduleBatch = useCallback(() => {
        if (batchTimerRef.current == null) {
            batchTimerRef.current = setTimeout(flushBatch, BATCH_MS);
        }
    }, [flushBatch]);
    
    useEffect(() => {
        const releases: (() => void)[] = [];
        const onBook = (exchange: string) => (book: AggregatedOrderBook) => {
            pendingRef.current[exchange] = book;
            setConnected(prev => ({ ...prev, [exchange]: true }));
            scheduleBatch();
        };
        if (exchanges.includes('binance')) {
            releases.push(subscribeOrderBook(futuresSymbol, 'binance', onBook('binance')));
        }
        if (exchanges.includes('bybit')) {
            releases.push(subscribeOrderBook(futuresSymbol, 'bybit', onBook('bybit')));
        }
        return () => {
            if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
            batchTimerRef.current = null;
            pendingRef.current = {};
            releases.forEach((r) => r());
        };
    }, [futuresSymbol, exchanges, scheduleBatch]);
    
    return {
        connected,
        realtimeBook,
        lastTrades,
        aggregatedBook: Object.values(realtimeBook)
    };
}
