"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createChart, ColorType, CandlestickSeries, HistogramSeries, LineSeries, AreaSeries, type IChartApi, type ISeriesApi, type CandlestickData, type HistogramData, type LineData, type UTCTimestamp } from 'lightweight-charts';

type LightweightTheme = {
    layout: {
        background: { type: ColorType.Solid; color: string };
        textColor: string;
    };
    grid: {
        vertLines: { color: string };
        horzLines: { color: string };
    };
    upColor: string;
    downColor: string;
    borderUpColor: string;
    borderDownColor: string;
    wickUpColor: string;
    wickDownColor: string;
    atrColor: string;
};

const DEFAULT_THEME: LightweightTheme = {
    layout: {
        background: { type: ColorType.Solid, color: '#0c0c0e' },
        textColor: '#71717a',
    },
    grid: {
        vertLines: { color: 'rgba(0,0,0,0)' },
        horzLines: { color: 'rgba(0,0,0,0)' },
    },
    upColor: '#6CCF84',
    downColor: '#A376EC',
    borderUpColor: '#6CCF84',
    borderDownColor: '#A376EC',
    wickUpColor: '#6CCF84',
    wickDownColor: '#A376EC',
    atrColor: '#f59e0b',
};

const BINANCE_KLINES = 'https://api.binance.com/api/v3/klines';
const BYBIT_KLINES = 'https://api.bybit.com/v5/market/kline';
const LOWER_PRICE_SCALE_ID = 'lower';

type Kline = [number, string, string, string, string, string, number, ...unknown[]];
type ChartInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

function parseTvSymbol(tvSymbol: string): { exchange: string; symbol: string } {
    if (!tvSymbol || !tvSymbol.includes(':')) {
        return { exchange: '', symbol: '' };
    }
    const [exchange, sym] = tvSymbol.split(':');
    return { exchange: (exchange || '').toUpperCase(), symbol: (sym || '').trim() };
}

async function fetchBinanceKlines(symbol: string, interval = '1h', limit = 500, colors?: { up: string; down: string }): Promise<{ candle: CandlestickData<UTCTimestamp>[]; volume: HistogramData<UTCTimestamp>[] }> {
    const url = `${BINANCE_KLINES}?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Binance klines failed');
    const raw = (await res.json()) as Kline[];
    const upColor = colors?.up || DEFAULT_THEME.upColor;
    const downColor = colors?.down || DEFAULT_THEME.downColor;
    const candle: CandlestickData<UTCTimestamp>[] = [];
    const volume: HistogramData<UTCTimestamp>[] = [];
    for (const k of raw) {
        const time = Math.floor(k[0] / 1000) as UTCTimestamp;
        const open = parseFloat(k[1]);
        const high = parseFloat(k[2]);
        const low = parseFloat(k[3]);
        const close = parseFloat(k[4]);
        const vol = parseFloat(k[5]);
        candle.push({ time, open, high, low, close });
        volume.push({ time, value: vol, color: close >= open ? upColor : downColor });
    }
    return { candle, volume };
}

async function fetchBybitKlines(symbol: string, interval = '60', limit = 500, colors?: { up: string; down: string }): Promise<{ candle: CandlestickData<UTCTimestamp>[]; volume: HistogramData<UTCTimestamp>[] }> {
    const url = `${BYBIT_KLINES}?category=linear&symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Bybit klines failed');
    const json = (await res.json()) as {
        retCode?: number;
        retMsg?: string;
        result?: { list?: [string, string, string, string, string, string, ...unknown[]][] };
    };
    if (Number(json?.retCode || 0) !== 0) {
        throw new Error(`Bybit klines failed (${json?.retMsg || json?.retCode || 'unknown'})`);
    }
    const list = json?.result?.list ?? [];
    if (!list.length) throw new Error('Bybit returned empty kline set');
    const upColor = colors?.up || DEFAULT_THEME.upColor;
    const downColor = colors?.down || DEFAULT_THEME.downColor;
    const candle: CandlestickData<UTCTimestamp>[] = [];
    const volume: HistogramData<UTCTimestamp>[] = [];
    for (const k of list) {
        const time = Math.floor(parseInt(k[0], 10) / 1000) as UTCTimestamp;
        const open = parseFloat(k[1]);
        const high = parseFloat(k[2]);
        const low = parseFloat(k[3]);
        const close = parseFloat(k[4]);
        const vol = parseFloat(k[5]);
        candle.push({ time, open, high, low, close });
        volume.push({ time, value: vol, color: close >= open ? upColor : downColor });
    }
    candle.reverse();
    volume.reverse();
    return { candle, volume };
}

async function fetchHyperliquidFallbackKlines(symbol: string, interval: ChartInterval = '1h', colors?: { up: string; down: string }): Promise<{ candle: CandlestickData<UTCTimestamp>[]; volume: HistogramData<UTCTimestamp>[] }> {
    const s = (symbol || '').toUpperCase().trim();
    const bybitPair = s.endsWith('USDT') ? s : `${s}USDT`;
    const binancePair = bybitPair;
    const bybitInterval = interval === '1m' ? '1' : interval === '5m' ? '5' : interval === '15m' ? '15' : interval === '1h' ? '60' : interval === '4h' ? '240' : interval === '1d' ? 'D' : '60';
    const binanceInterval = interval === '1m' ? '1m' : interval === '5m' ? '5m' : interval === '15m' ? '15m' : interval === '1h' ? '1h' : interval === '4h' ? '4h' : interval === '1d' ? '1d' : '1h';

    // Try Bybit first, then Binance as fallback for broader pair coverage.
    try {
        return await fetchBybitKlines(bybitPair, bybitInterval, 500, colors);
    } catch {
        return await fetchBinanceKlines(binancePair, binanceInterval, 500, colors);
    }
}

function toThemeFromSettings(raw: unknown): LightweightTheme {
    const settings = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
    const bg = typeof settings.backgroundColor === 'string'
        ? settings.backgroundColor
        : (typeof settings.uiBackgroundColor === 'string' ? settings.uiBackgroundColor : DEFAULT_THEME.layout.background.color);
    const text = typeof settings.uiTextColor === 'string' ? settings.uiTextColor : DEFAULT_THEME.layout.textColor;
    const up = typeof settings.upColor === 'string' ? settings.upColor : DEFAULT_THEME.upColor;
    const down = typeof settings.downColor === 'string' ? settings.downColor : DEFAULT_THEME.downColor;
    const wickUp = typeof settings.wickUpColor === 'string' ? settings.wickUpColor : up;
    const wickDown = typeof settings.wickDownColor === 'string' ? settings.wickDownColor : down;
    const atr = typeof settings.atrColor === 'string' ? settings.atrColor : DEFAULT_THEME.atrColor;
    return {
        layout: {
            background: { type: ColorType.Solid, color: bg },
            textColor: text,
        },
        grid: {
            // Force global chart grids off for cleaner execution view.
            vertLines: { color: 'rgba(0,0,0,0)' },
            horzLines: { color: 'rgba(0,0,0,0)' },
        },
        upColor: up,
        downColor: down,
        borderUpColor: up,
        borderDownColor: down,
        wickUpColor: wickUp,
        wickDownColor: wickDown,
        atrColor: atr,
    };
}

export function ScreenerLightweightChart({
    symbol,
    symbolKey,
    interval = '1h',
    entryPrice,
    avgBuyPrice,
    avgSellPrice,
    showAvgBuy = true,
    showAvgSell = true,
    showEntry = true,
    showVolume = true,
    lowerPaneMode = 'atr',
    positionSize,
    entryTimestamp,
    exitTimestamp,
    exitPrice,
    side,
    onLoadError,
    onCandlesLoaded,
}: {
    symbol?: string;
    symbolKey?: string;
    interval?: ChartInterval;
    entryPrice?: number;
    avgBuyPrice?: number;
    avgSellPrice?: number;
    showAvgBuy?: boolean;
    showAvgSell?: boolean;
    showEntry?: boolean;
    showVolume?: boolean;
    lowerPaneMode?: 'atr' | 'pnl' | 'none';
    positionSize?: number;
    entryTimestamp?: number;
    exitTimestamp?: number;
    exitPrice?: number;
    side?: string;
    onLoadError?: (error: string) => void;
    onCandlesLoaded?: (candles: CandlestickData<UTCTimestamp>[]) => void;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const lowerSeriesRef = useRef<ISeriesApi<'Line'> | ISeriesApi<'Area'> | null>(null);
    const priceLinesRef = useRef<Array<{ price: number; title: string }>>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [chartTheme, setChartTheme] = useState<LightweightTheme>(DEFAULT_THEME);

    const tvSymbol = symbol ?? (symbolKey ? (() => {
        const parts = symbolKey.split('-');
        const sym = parts[0] || '';
        const ex = (parts[1] || '').toUpperCase();
        const symForUsdt = sym.endsWith('USDT') ? sym : sym + 'USDT';
        if (ex === 'BINANCE') return `BINANCE:${symForUsdt}`;
        if (ex === 'BYBIT') return `BYBIT:${symForUsdt}`;
        if (ex === 'HYPERLIQUID') return `HYPERLIQUID:${sym}`;
        return `BINANCE:${symForUsdt}`;
    })() : '');

    const { exchange, symbol: pair } = parseTvSymbol(tvSymbol);
    const valid = !!exchange && !!pair;
    const normalizedSide = String(side || '').toLowerCase();
    const fallbackEntryTitle = normalizedSide === 'sell' || normalizedSide === 'short' ? 'Entry (Short)' : 'Entry';

    const priceLines = useMemo(() => {
        const list: Array<{ price: number; title: string; color: string; style: 0 | 1 | 2 }> = [];
        if (showAvgBuy && avgBuyPrice && avgBuyPrice > 0) list.push({ price: avgBuyPrice, title: 'Avg Buy', color: '#10b981', style: 2 });
        if (showAvgSell && avgSellPrice && avgSellPrice > 0) list.push({ price: avgSellPrice, title: 'Avg Sell', color: '#ef4444', style: 2 });
        if (showEntry && entryPrice && entryPrice > 0) {
            list.push({ price: entryPrice, title: fallbackEntryTitle, color: normalizedSide === 'sell' || normalizedSide === 'short' ? '#ef4444' : '#10b981', style: 2 });
        }
        return list;
    }, [avgBuyPrice, avgSellPrice, entryPrice, fallbackEntryTitle, normalizedSide, showAvgBuy, showAvgSell, showEntry]);

    const buildAtr14 = useCallback((candles: CandlestickData<UTCTimestamp>[]): LineData<UTCTimestamp>[] => {
        const period = 14;
        if (candles.length < period + 1) return [];
        const trueRanges: number[] = [];
        for (let i = 0; i < candles.length; i += 1) {
            const c = candles[i];
            const prevClose = i > 0 ? candles[i - 1].close : c.close;
            const tr = Math.max(
                c.high - c.low,
                Math.abs(c.high - prevClose),
                Math.abs(c.low - prevClose)
            );
            trueRanges.push(tr);
        }

        const out: LineData<UTCTimestamp>[] = [];
        let atr = trueRanges.slice(0, period).reduce((sum, v) => sum + v, 0) / period;
        out.push({ time: candles[period - 1].time, value: atr });
        for (let i = period; i < trueRanges.length; i += 1) {
            atr = ((atr * (period - 1)) + trueRanges[i]) / period;
            out.push({ time: candles[i].time, value: atr });
        }
        return out;
    }, []);

    const buildPositionPnl = useCallback((candles: CandlestickData<UTCTimestamp>[]): LineData<UTCTimestamp>[] => {
        if (!candles.length) return [];
        const qty = Math.abs(Number(positionSize || 0));
        if (!Number.isFinite(qty) || qty <= 0) return [];

        const isShort = normalizedSide === 'sell' || normalizedSide === 'short';
        const defaultEntryPrice = Number(entryPrice || candles[0].open || candles[0].close || 0);
        if (!Number.isFinite(defaultEntryPrice) || defaultEntryPrice <= 0) return [];

        const entrySec = Number.isFinite(Number(entryTimestamp))
            ? Math.floor(Number(entryTimestamp) / 1000)
            : null;
        const exitSec = Number.isFinite(Number(exitTimestamp))
            ? Math.floor(Number(exitTimestamp) / 1000)
            : null;
        const validExitPrice = Number(exitPrice);
        const hasExit = Number.isFinite(validExitPrice) && validExitPrice > 0;
        const realized = hasExit
            ? (isShort ? (defaultEntryPrice - validExitPrice) : (validExitPrice - defaultEntryPrice)) * qty
            : null;

        return candles.map((bar) => {
            if (entrySec !== null && bar.time < entrySec) {
                return { time: bar.time, value: 0 };
            }

            if (exitSec !== null && realized !== null && bar.time >= exitSec) {
                return { time: bar.time, value: realized };
            }

            const mark = isShort
                ? (defaultEntryPrice - bar.close) * qty
                : (bar.close - defaultEntryPrice) * qty;
            return { time: bar.time, value: mark };
        });
    }, [positionSize, normalizedSide, entryPrice, entryTimestamp, exitTimestamp, exitPrice]);

    useEffect(() => {
        const readSettings = () => {
            try {
                const raw = localStorage.getItem('global_tv_settings');
                if (!raw) {
                    setChartTheme(DEFAULT_THEME);
                    return;
                }
                const parsed = JSON.parse(raw);
                setChartTheme(toThemeFromSettings(parsed));
            } catch {
                setChartTheme(DEFAULT_THEME);
            }
        };
        readSettings();
        window.addEventListener('settings-changed', readSettings);
        return () => window.removeEventListener('settings-changed', readSettings);
    }, []);

    useEffect(() => {
        if (!valid || !containerRef.current) return;
        const containerEl = containerRef.current;

        setError(null);
        setLoading(true);
        onCandlesLoaded?.([]);

        const load = async () => {
            try {
                let candle: CandlestickData<UTCTimestamp>[];
                let volume: HistogramData<UTCTimestamp>[];
                const binanceInterval = interval === '1m' ? '1m' : interval === '5m' ? '5m' : interval === '15m' ? '15m' : interval === '1h' ? '1h' : interval === '4h' ? '4h' : interval === '1d' ? '1d' : '1h';
                const bybitInterval = interval === '1m' ? '1' : interval === '5m' ? '5' : interval === '15m' ? '15' : interval === '1h' ? '60' : interval === '4h' ? '240' : interval === '1d' ? 'D' : '60';
                if (exchange === 'BINANCE') {
                    try {
                        const data = await fetchBinanceKlines(pair, binanceInterval, 500, { up: chartTheme.upColor, down: chartTheme.downColor });
                        candle = data.candle;
                        volume = data.volume;
                    } catch {
                        const bybitPair = pair.replace(/PERP$/i, 'USDT').replace(/\/+/g, '');
                        const data = await fetchBybitKlines(bybitPair, bybitInterval, 500, { up: chartTheme.upColor, down: chartTheme.downColor });
                        candle = data.candle;
                        volume = data.volume;
                    }
                } else if (exchange === 'BYBIT') {
                    try {
                        const bybitPair = pair.replace(/PERP$/i, 'USDT').replace(/\/+/g, '');
                        const data = await fetchBybitKlines(bybitPair, bybitInterval, 500, { up: chartTheme.upColor, down: chartTheme.downColor });
                        candle = data.candle;
                        volume = data.volume;
                    } catch {
                        const binancePair = pair.replace(/PERP$/i, 'USDT').replace(/\/+/g, '');
                        const data = await fetchBinanceKlines(binancePair, binanceInterval, 500, { up: chartTheme.upColor, down: chartTheme.downColor });
                        candle = data.candle;
                        volume = data.volume;
                    }
                } else if (exchange === 'HYPERLIQUID') {
                    const data = await fetchHyperliquidFallbackKlines(pair, interval, { up: chartTheme.upColor, down: chartTheme.downColor });
                    candle = data.candle;
                    volume = data.volume;
                } else {
                    const err = 'Unsupported exchange for built-in chart';
                    setError(err);
                    onLoadError?.(err);
                    onCandlesLoaded?.([]);
                    setLoading(false);
                    return;
                }
                if (!Array.isArray(candle) || candle.length === 0) {
                    const err = `No chart candles found for ${pair}`;
                    setError(err);
                    onLoadError?.(err);
                    onCandlesLoaded?.([]);
                    setLoading(false);
                    return;
                }

                if (!containerEl) return;

                containerEl.innerHTML = '';
                const chart = createChart(containerEl, {
                    layout: chartTheme.layout,
                    grid: chartTheme.grid,
                    width: containerEl.clientWidth,
                    height: containerEl.clientHeight,
                    timeScale: { timeVisible: true, secondsVisible: interval === '1m' || interval === '5m' },
                    rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
                    crosshair: {
                        vertLine: { visible: false, labelVisible: false },
                        horzLine: { visible: false, labelVisible: false },
                    },
                });

                const candleSeries = chart.addSeries(CandlestickSeries, {
                    upColor: chartTheme.upColor,
                    downColor: chartTheme.downColor,
                    borderUpColor: chartTheme.borderUpColor,
                    borderDownColor: chartTheme.borderDownColor,
                    wickUpColor: chartTheme.wickUpColor,
                    wickDownColor: chartTheme.wickDownColor,
                });
                candleSeries.setData(candle);
                onCandlesLoaded?.(candle);
                candleSeries.priceScale().applyOptions({
                    scaleMargins: lowerPaneMode === 'none'
                        ? { top: 0.05, bottom: showVolume ? 0.2 : 0.08 }
                        : { top: 0.05, bottom: showVolume ? 0.36 : 0.30 },
                });
                priceLinesRef.current = [];
                for (const line of priceLines) {
                    candleSeries.createPriceLine({
                        price: line.price,
                        color: line.color,
                        lineWidth: 2,
                        lineStyle: line.style,
                        axisLabelVisible: true,
                        title: line.title,
                    });
                    priceLinesRef.current.push({ price: line.price, title: line.title });
                }

                let volumeSeries: ISeriesApi<'Histogram'> | null = null;
                if (showVolume) {
                    volumeSeries = chart.addSeries(HistogramSeries, {
                        priceFormat: { type: 'volume' },
                        priceScaleId: '',
                    });
                    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 }, visible: false });
                    volumeSeries.setData(volume);
                }

                if (lowerPaneMode !== 'none') {
                    if (lowerPaneMode === 'pnl') {
                        const pnlSeries = chart.addSeries(AreaSeries, {
                            lineColor: '#6CCF84',
                            topColor: 'rgba(108,207,132,0.35)',
                            bottomColor: 'rgba(108,207,132,0.03)',
                            lineWidth: 2,
                            priceScaleId: LOWER_PRICE_SCALE_ID,
                            lastValueVisible: true,
                            priceLineVisible: false,
                        });
                        pnlSeries.setData(buildPositionPnl(candle));
                        pnlSeries.priceScale().applyOptions({
                            visible: true,
                            borderColor: 'rgba(108,207,132,0.25)',
                            textColor: '#6CCF84',
                            scaleMargins: { top: 0.76, bottom: 0.06 },
                        });
                        lowerSeriesRef.current = pnlSeries;
                    } else {
                        const atrSeries = chart.addSeries(LineSeries, {
                            color: chartTheme.atrColor,
                            lineWidth: 2,
                            priceScaleId: LOWER_PRICE_SCALE_ID,
                            lastValueVisible: true,
                            priceLineVisible: false,
                        });
                        atrSeries.setData(buildAtr14(candle));
                        atrSeries.priceScale().applyOptions({
                            visible: true,
                            borderColor: 'rgba(245,158,11,0.25)',
                            textColor: chartTheme.atrColor,
                            scaleMargins: { top: 0.76, bottom: 0.06 },
                        });
                        lowerSeriesRef.current = atrSeries;
                    }
                } else {
                    lowerSeriesRef.current = null;
                }

                chartRef.current = chart;
                candleSeriesRef.current = candleSeries;
                volumeSeriesRef.current = volumeSeries;
                chart.timeScale().fitContent();
            } catch (e) {
                const msg = e instanceof Error ? e.message : 'Failed to load chart data';
                setError(msg);
                onLoadError?.(msg);
                onCandlesLoaded?.([]);
            } finally {
                setLoading(false);
            }
        };

        load();

        return () => {
            if (chartRef.current && containerEl) {
                chartRef.current.remove();
                chartRef.current = null;
                candleSeriesRef.current = null;
                volumeSeriesRef.current = null;
                lowerSeriesRef.current = null;
                priceLinesRef.current = [];
            }
        };
    }, [valid, exchange, pair, interval, chartTheme, priceLines, showVolume, lowerPaneMode, buildAtr14, buildPositionPnl, onLoadError, onCandlesLoaded]);

    useEffect(() => {
        if (!chartRef.current || !containerRef.current) return;
        const el = containerRef.current;
        const ro = new ResizeObserver(() => {
            if (chartRef.current && el) chartRef.current.applyOptions({ width: el.clientWidth, height: el.clientHeight });
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, [loading]);

    if (!valid) {
        return (
            <div className="tm-market-chart-surface h-full w-full flex items-center justify-center rounded-[14px] border border-white/10 bg-zinc-900/50 text-zinc-500 text-xs font-bold uppercase tracking-wider">
                Select a ticker to view chart
            </div>
        );
    }

    if (error) {
        return (
            <div className="tm-market-chart-surface h-full w-full flex items-center justify-center rounded-[14px] border border-white/10 bg-zinc-900/50 text-zinc-400 text-sm">
                {error}
            </div>
        );
    }

    return (
        <div className="tm-market-chart-surface h-full w-full relative rounded-[14px] overflow-hidden border border-white/10" style={{ backgroundColor: chartTheme.layout.background.color }}>
            {lowerPaneMode !== 'none' && (
                <div className="pointer-events-none absolute left-0 right-0 top-[72%] z-[5] h-px bg-white/20" />
            )}
            {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-900/80 text-zinc-500 text-xs font-bold uppercase tracking-wider">
                    Loading chart…
                </div>
            )}
            <div ref={containerRef} className="w-full h-full min-h-[180px]" />
        </div>
    );
}
