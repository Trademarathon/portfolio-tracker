"use client";

import { useEffect, useRef } from 'react';

export function TradingViewChart({ symbol }: { symbol: string }) {
    const container = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!container.current) return;

        // Clean up previous widget
        container.current.innerHTML = '';

        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
        script.type = "text/javascript";
        script.async = true;
        script.innerHTML = JSON.stringify({
            "autosize": true,
            "symbol": `BINANCE:${symbol}USDT`,
            "interval": "H",
            "timezone": "Etc/UTC",
            "theme": "dark",
            "style": "1",
            "locale": "en",
            "backgroundColor": "rgba(0, 0, 0, 1)",
            "gridColor": "rgba(255, 255, 255, 0.06)",
            "hide_side_toolbar": false,
            "allow_symbol_change": true,
            "save_image": false,
            "calendar": false,
            "support_host": "https://www.tradingview.com"
        });

        container.current.appendChild(script);
    }, [symbol]);

    return (
        <div className="tradingview-widget-container h-full w-full rounded-xl overflow-hidden border border-white/5" ref={container}>
            <div className="tradingview-widget-container__widget h-full w-full"></div>
        </div>
    );
}
