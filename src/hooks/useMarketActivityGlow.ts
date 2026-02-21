"use client";

import { useState, useEffect, useRef } from 'react';

// Thresholds: glow only when BOTH volume and trade count indicate high market activity
const VOLUME_THRESHOLD_USD = 35e9;      // BTC+ETH 24h volume > $35B
const TRADE_COUNT_THRESHOLD = 600_000;  // BTC+ETH 24h trade count > 600k

export function useMarketActivityGlow() {
    const [shouldGlow, setShouldGlow] = useState(false);
    const lastFetchRef = useRef(0);

    useEffect(() => {
        const fetchAndCheck = async () => {
            const now = Date.now();
            if (now - lastFetchRef.current < 55_000) return; // Debounce ~60s
            lastFetchRef.current = now;

            try {
                const [btcRes, ethRes] = await Promise.all([
                    fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT'),
                    fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=ETHUSDT'),
                ]);
                if (!btcRes.ok || !ethRes.ok) return;
                const btc = await btcRes.json();
                const eth = await ethRes.json();

                const btcVolume = btc ? parseFloat(btc.quoteVolume || '0') : 0;
                const ethVolume = eth ? parseFloat(eth.quoteVolume || '0') : 0;
                const btcCount = btc ? parseInt(btc.count || '0', 10) : 0;
                const ethCount = eth ? parseInt(eth.count || '0', 10) : 0;

                const totalVolume = btcVolume + ethVolume;
                const totalTrades = btcCount + ethCount;

                const highVolume = totalVolume >= VOLUME_THRESHOLD_USD;
                const highActivity = totalTrades >= TRADE_COUNT_THRESHOLD;

                setShouldGlow(highVolume && highActivity);
            } catch {
                setShouldGlow(false);
            }
        };

        fetchAndCheck();
        const interval = setInterval(fetchAndCheck, 60_000); // Poll every 60s
        return () => clearInterval(interval);
    }, []);

    return shouldGlow;
}
