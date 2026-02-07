import { useState, useEffect, useRef } from 'react';
import { wsManager } from '@/lib/api/websocket';
import { ExchangeTicker } from '@/lib/api/types';

export function useLivePrices(symbols: string[]) {
    const [prices, setPrices] = useState<{ [key: string]: number }>({});
    const [priceChanges, setPriceChanges] = useState<{ [key: string]: number }>({});

    const pricesRef = useRef<{ [key: string]: number }>({});
    const changesRef = useRef<{ [key: string]: number }>({});

    useEffect(() => {
        if (symbols.length === 0) return;

        // Start connections
        wsManager.connectHyperliquid();

        // Dynamically connect to Binance for user's assets
        const binanceSymbols = symbols.map(s => s.toLowerCase());
        if (binanceSymbols.length > 0) {
            wsManager.connectBinance(binanceSymbols);
        }

        // Dynamically connect to Bybit
        if (symbols.length > 0) {
            wsManager.connectBybit(symbols);
        }

        const unsubscribe = wsManager.subscribe((ticker: ExchangeTicker) => {
            // Buffer updates in refs without triggering re-render
            pricesRef.current[ticker.symbol] = ticker.lastPrice;
            if (ticker.priceChangePercent) {
                changesRef.current[ticker.symbol] = ticker.priceChangePercent;
            }
        });

        // Flush buffer to state every 1s to prevent UI thrashing
        const interval = setInterval(() => {
            if (Object.keys(pricesRef.current).length > 0) {
                setPrices(prev => ({ ...prev, ...pricesRef.current }));
                // Optional: clear buffer if we only want new updates? 
                // No, we want latest state. But keeping refs grows? No, keys just overwrite.
            }
            if (Object.keys(changesRef.current).length > 0) {
                setPriceChanges(prev => ({ ...prev, ...changesRef.current }));
            }
        }, 1000);

        return () => {
            unsubscribe();
            // Do NOT disconnect all, as this manager might be shared or simply persistent.
            // wsManager.disconnectAll(); 
            clearInterval(interval);
        };
    }, [JSON.stringify(symbols)]); // Re-connect when symbols change

    return { prices, priceChanges };
}
