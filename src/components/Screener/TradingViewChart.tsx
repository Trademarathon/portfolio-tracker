"use client";

import { useEffect, useRef, useState } from 'react';
import { ChartSettingsModal, ChartSettings } from './ChartSettingsModal';
import { ComponentSettingsLink } from '@/components/ui/ComponentSettingsLink';
import { BrandLogo } from "@/components/ui/BrandLogo";

const isValidTvSymbol = (s: string) => !!s && s.includes(':');

const TV_CHART_URL = 'https://www.tradingview.com/chart/';

export function TradingViewChart({ symbol, interval }: { symbol: string; interval?: string }) {
    const container = useRef<HTMLDivElement>(null);
    const [settings, setSettings] = useState<ChartSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const valid = isValidTvSymbol(symbol);

    useEffect(() => {
        const loadSettings = () => {
            const saved = localStorage.getItem('global_tv_settings');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Migration: apply minimal chart defaults (toolbars hidden, grid off)
                if ((parsed.tv_settings_version ?? 0) < 2) {
                    const minimal = { show_top_toolbar: false, show_side_toolbar: false, show_right_toolbar: false, show_legend: false, withdateranges: false, allow_symbol_change: false, save_image: false, details: false, hotlist: false, calendar: false, show_popup_button: false, show_vert_grid: false, show_horz_grid: false, tv_settings_version: 2 };
                    const migrated = { ...parsed, ...minimal };
                    localStorage.setItem('global_tv_settings', JSON.stringify(migrated));
                    setSettings(migrated);
                } else {
                    setSettings(parsed);
                }
            } else {
                setSettings({
                    theme: 'dark',
                    interval: '60',
                    style: '2', // Line Chart
                    studies: ['Volume@tv-basicstudies', 'ATR@tv-basicstudies'],
                    show_top_toolbar: false,
                    show_side_toolbar: false,
                    show_legend: false,
                    backgroundColor: "#141310",
                    gridColor: "rgba(255, 255, 255, 0.06)",
                    upColor: "#6CCF84",
                    downColor: "#A376EC",
                    vertGridColor: "rgba(42, 46, 57, 0.5)",
                    horzGridColor: "rgba(42, 46, 57, 0.5)",
                    timezone: "Etc/UTC",
                    withdateranges: false,
                    allow_symbol_change: false,
                    save_image: false,
                    details: false,
                    hotlist: false,
                    calendar: false,
                    show_popup_button: false,
                    align_orders_right: true,
                    align_positions_right: true,
                    plot_liquidation: true,
                    hide_reverse_position_button: false,
                    wickUpColor: "#6CCF84",
                    wickDownColor: "#A376EC",
                    apply_color_scheme_to_ui: false,
                    align_designer_orders_opposite: false,
                    show_fills_on_charts: true,
                    size_on_fill_markers: false,
                    show_pnl_for_reduce_orders: false,
                    show_vert_grid: false,
                    show_horz_grid: false,
                    show_right_toolbar: false,
                    uiAccentColor: "#6366f1",
                    uiBorderColor: "rgba(255, 255, 255, 0.1)",
                    uiBackgroundColor: "#0c0c0e",
                    uiSecondaryColor: "rgba(255, 255, 255, 0.05)",
                });
            }
        };

        loadSettings();
        window.addEventListener('settings-changed', loadSettings);
        return () => window.removeEventListener('settings-changed', loadSettings);
    }, []);

    useEffect(() => {
        if (!valid || !container.current || !settings) return;

        setLoading(true);
        setError(null);
        // Clean up previous widget
        container.current.innerHTML = '';

        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
        script.type = "text/javascript";
        script.async = true;
        script.onload = () => setLoading(false);
        script.onerror = () => {
            setError('Chart failed to load');
            setLoading(false);
        };
        
        // Use background color for grid lines when they're disabled (makes them invisible)
        const bgColor = settings.backgroundColor || settings.uiBackgroundColor || "#0c0c0e";
        // Grid lines removed from all global charts (always hidden)
        const vertGridVisible = false;
        const horzGridVisible = false;
        const upColor = settings.upColor || "#6CCF84";
        const downColor = settings.downColor || "#A376EC";
        const wickUp = settings.wickUpColor || upColor;
        const wickDown = settings.wickDownColor || downColor;
        const vertGridColor = "rgba(0,0,0,0)";
        const horzGridColor = "rgba(0,0,0,0)";
        const configuredStudies = Array.isArray(settings.studies) ? settings.studies : [];
        const fixedStudies = Array.from(new Set([...configuredStudies, 'Volume@tv-basicstudies', 'ATR@tv-basicstudies']));

        script.innerHTML = JSON.stringify({
            "autosize": true,
            "symbol": symbol,
            "interval": interval || settings.interval || "60",
            "timezone": settings.timezone || "Etc/UTC",
            "theme": settings.theme || "dark",
            "style": settings.style || "1",
            "locale": "en",
            "backgroundColor": bgColor,
            "gridColor": vertGridVisible || horzGridVisible ? (settings.vertGridColor || settings.uiBorderColor) : bgColor,
            "vertGridLineColor": vertGridColor,
            "horzGridLineColor": horzGridColor,
            "enable_publishing": false,
            "hide_top_toolbar": settings.show_top_toolbar === false,
            "hide_legend": settings.show_legend === false,
            "withdateranges": settings.withdateranges !== false,
            "hide_side_toolbar": settings.show_side_toolbar === false,
            "allow_symbol_change": settings.allow_symbol_change !== false,
            "save_image": settings.save_image !== false,
            "studies": fixedStudies,
            "upColor": upColor,
            "downColor": downColor,
            "borderUpColor": upColor,
            "borderDownColor": downColor,
            "wickUpColor": wickUp,
            "wickDownColor": wickDown,
            "details": settings.show_right_toolbar !== false && settings.details !== false,
            "hotlist": settings.show_right_toolbar !== false && settings.hotlist !== false,
            "calendar": settings.show_right_toolbar !== false && settings.calendar !== false,
            "show_popup_button": settings.show_popup_button !== false,
            "support_host": "https://www.tradingview.com",
            "overrides": {
                "paneProperties.background": bgColor,
                "paneProperties.vertGridProperties.visible": false,
                "paneProperties.vertGridProperties.color": vertGridColor,
                "paneProperties.horzGridProperties.visible": false,
                "paneProperties.horzGridProperties.color": horzGridColor,
                "paneProperties.separatorColor": "rgba(255,255,255,0.18)",
                "paneProperties.separatorHoverColor": "rgba(255,255,255,0.26)",
                "scalesProperties.lineColor": settings.uiBorderColor || "rgba(255, 255, 255, 0.1)",
                "scalesProperties.textColor": "#71717a",
                "mainSeriesProperties.candleStyle.upColor": upColor,
                "mainSeriesProperties.candleStyle.downColor": downColor,
                "mainSeriesProperties.candleStyle.borderUpColor": upColor,
                "mainSeriesProperties.candleStyle.borderDownColor": downColor,
                "mainSeriesProperties.candleStyle.wickUpColor": wickUp,
                "mainSeriesProperties.candleStyle.wickDownColor": wickDown,
            },
            "studies_overrides": {
                "volume.volume.paneSize": "medium",
                "Volume.volume.paneSize": "medium",
                "volume.volume.volume.color.0": upColor,
                "volume.volume.volume.color.1": downColor,
                "Volume.volume.volume.color.0": upColor,
                "Volume.volume.volume.color.1": downColor,
                "rsi.rsi.color": upColor,
                "macd.macd.color": upColor,
                "macd.signal.color": downColor,
                "macd.histogram.color": downColor,
                "moving average.plot.color": upColor,
                "bollinger bands.median.color": upColor,
                "bollinger bands.upper.color": upColor,
                "bollinger bands.lower.color": downColor,
                "average true range.plot.color": upColor,
                "accumulation/distribution.plot.color": upColor,
                "stochastic.%k.color": upColor,
                "stochastic.%d.color": downColor,
                "commodity channel index.plot.color": upColor,
                "money flow index.plot.color": upColor,
                "williams %r.plot.color": upColor,
                "on balance volume.plot.color": upColor,
            }
        });

        container.current.appendChild(script);
    }, [symbol, settings, valid, interval]);

    if (!valid) {
        return (
            <div className="tm-market-chart-surface h-full w-full flex items-center justify-center rounded-[14px] border border-white/10 bg-zinc-900/50 text-zinc-500 text-xs font-bold uppercase tracking-wider">
                Select a ticker to view chart
            </div>
        );
    }

    if (error) {
        const chartUrl = `${TV_CHART_URL}?symbol=${encodeURIComponent(symbol)}`;
        return (
            <div className="tm-market-chart-surface h-full w-full flex flex-col items-center justify-center gap-3 rounded-[14px] border border-white/10 bg-zinc-900/50 text-zinc-400 text-sm">
                <span>{error}</span>
                <a
                    href={chartUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-400 hover:text-indigo-300 underline"
                >
                    <BrandLogo brand="tradingview" size={12} />
                    Open in TradingView
                </a>
            </div>
        );
    }

    return (
        <div
            className="tradingview-widget-container tm-market-chart-surface h-full w-full relative group rounded-[14px] border border-white/10 overflow-hidden"
            style={{ backgroundColor: settings?.uiBackgroundColor || '#0c0c0e' }}
        >
            {loading && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-zinc-900/80 text-zinc-500 text-xs font-bold uppercase tracking-wider">
                    Loading chart…
                </div>
            )}
            <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
                <ChartSettingsModal onSettingsChange={setSettings} />
            </div>
            <ComponentSettingsLink tab="general" corner="top-right" title="Open chart settings" showOnHover size="xs" />
            <div
                className="w-full h-full rounded-[14px] overflow-hidden border"
                style={{ borderColor: settings?.uiBorderColor || 'rgba(255,255,255,0.05)' }}
                ref={container}
            />
        </div>
    );
}
