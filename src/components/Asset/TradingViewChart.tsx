import { useEffect, useRef, memo, useState, useCallback } from 'react';
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ChartSettingsModal, ChartSettings } from '../Screener/ChartSettingsModal';
import { ComponentSettingsLink } from '@/components/ui/ComponentSettingsLink';
import { ChevronDown, FunctionSquare, LayoutGrid, Bell, Settings2, Target, ShieldAlert, SlidersHorizontal, Trash2, X, BellRing, BellOff, Plus, TrendingUp, TrendingDown, Crosshair, DollarSign, AlertTriangle } from "lucide-react";

// ========== ALERT TYPES ==========
interface ChartAlert {
    id: string;
    symbol: string;
    price: number;
    type: 'above' | 'below' | 'cross';
    enabled: boolean;
    createdAt: number;
    note?: string;
}

const ALERTS_STORAGE_KEY = 'chart_alerts';

declare global {
    interface Window {
        TradingView: any;
    }
}

interface TradingViewChartProps {
    symbol: string;
    positions?: any[];
    orders?: any[];
    currentPrice?: number;
}

function TradingViewWidget({
    symbol,
    positions = [],
    orders = [],
    currentPrice = 0
}: TradingViewChartProps) {
    const container = useRef<HTMLDivElement>(null);
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const [settings, setSettings] = useState<ChartSettings | null>(null);
    const [isReduceOnly, setIsReduceOnly] = useState(false);
    const [orderSize, setOrderSize] = useState("1 000");
    const [isLocked, setIsLocked] = useState(false);
    const [showOrderPanel, setShowOrderPanel] = useState(false);
    const [sizePresetMode, setSizePresetMode] = useState<'BTC' | 'USDT' | '%'>('USDT');
    const [selectedSizePreset, setSelectedSizePreset] = useState<number>(1000);

    // ========== ALERT STATE ==========
    const [alerts, setAlerts] = useState<ChartAlert[]>([]);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; price: number } | null>(null);
    const [editingAlert, setEditingAlert] = useState<ChartAlert | null>(null);
    const [alertNote, setAlertNote] = useState('');

    // ========== FLOATING PLUS BUTTON STATE ==========
    const [mousePosition, setMousePosition] = useState<{ x: number; y: number; price: number } | null>(null);
    const [showPlusButton, setShowPlusButton] = useState(false);
    const [menuMode, setMenuMode] = useState<'main' | 'alert' | 'order'>('main');

    // ========== CHART PRICE RANGE STATE ==========
    // Track visible price range by observing TradingView's Y-axis labels
    const [chartPriceRange, setChartPriceRange] = useState<{ high: number; low: number }>({ high: 0, low: 0 });
    const chartContainerHeightRef = useRef<number>(0);
    const priceRangeObserverRef = useRef<MutationObserver | null>(null);
    
    // Observe TradingView iframe's Y-axis labels to get actual visible price range
    useEffect(() => {
        if (!chartContainerRef.current || !currentPrice) return;
        
        // Function to extract prices from TradingView's Y-axis
        const extractPriceRange = () => {
            try {
                // Try to find the TradingView iframe
                const iframe = chartContainerRef.current?.querySelector('iframe');
                if (!iframe) return null;
                
                // We can't access iframe content due to cross-origin, so we estimate
                // based on the visible price scale on the right side (which we render ourselves)
                return null;
            } catch {
                return null;
            }
        };
        
        // Since we can't access iframe content, use a smarter estimation approach
        // Based on common TradingView behavior and visible chart characteristics
        const updatePriceRange = () => {
            if (!currentPrice) return;
            
            // Collect all relevant price points
            const prices: number[] = [currentPrice];
            
            positions.forEach(pos => {
                if (pos.entryPrice) prices.push(pos.entryPrice);
                if (pos.liquidationPrice) prices.push(pos.liquidationPrice);
            });
            
            orders.forEach(order => {
                const price = order.price || order.stopPrice;
                if (price) prices.push(price);
            });
            
            alerts.forEach(alert => {
                if (alert.price) prices.push(alert.price);
            });
            
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            
            // Calculate the spread as a percentage of current price
            const spread = maxPrice - minPrice;
            const spreadPercent = (spread / currentPrice) * 100;
            
            // TradingView typically shows a wider range than just the data points
            // It auto-scales with padding, typically 15-25% total range for most timeframes
            // For volatile assets or when zoomed out, it can be 30-50%
            
            // Base our estimate on the spread of data points with generous padding
            let rangePercent = Math.max(15, spreadPercent * 2.5);
            
            // Cap the range at a reasonable maximum
            rangePercent = Math.min(rangePercent, 50);
            
            const halfRangeValue = (currentPrice * rangePercent / 100) / 2;
            
            // Calculate high and low with the current price as center
            // But adjust to ensure all data points are visible
            let high = currentPrice + halfRangeValue;
            let low = currentPrice - halfRangeValue;
            
            // Adjust if data points would be outside
            if (maxPrice > high * 0.98) {
                high = maxPrice * 1.05;
            }
            if (minPrice < low * 1.02) {
                low = minPrice * 0.95;
            }
            
            // Ensure the range makes sense (high > low)
            if (high <= low) {
                high = currentPrice * 1.1;
                low = currentPrice * 0.9;
            }
            
            setChartPriceRange({ high, low });
        };
        
        // Initial update
        updatePriceRange();
        
        // Re-calculate when prices or data changes
        const intervalId = setInterval(updatePriceRange, 2000);
        
        return () => {
            clearInterval(intervalId);
            if (priceRangeObserverRef.current) {
                priceRangeObserverRef.current.disconnect();
            }
        };
    }, [currentPrice, positions, orders, alerts]);

    // Calculate Y position for a given price (0-100%)
    // TradingView Y-axis: top = high price, bottom = low price
    const calculatePricePosition = useCallback((price: number): number => {
        const { high, low } = chartPriceRange;
        
        if (!high || !low || high === low || !currentPrice) {
            // Fallback: use a 20% range centered on current price
            if (!currentPrice) return 50;
            const rangeHalf = currentPrice * 0.10;
            const estimatedHigh = currentPrice + rangeHalf;
            const estimatedLow = currentPrice - rangeHalf;
            const position = ((estimatedHigh - price) / (estimatedHigh - estimatedLow)) * 100;
            return Math.max(0, Math.min(100, position));
        }
        
        // Normal calculation: position as percentage from top
        const range = high - low;
        const position = ((high - price) / range) * 100;
        
        // Clamp to valid range but allow slight overflow for visual indication
        return Math.max(-5, Math.min(105, position));
    }, [chartPriceRange, currentPrice]);

    // Load alerts from localStorage
    useEffect(() => {
        const saved = localStorage.getItem(ALERTS_STORAGE_KEY);
        if (saved) {
            try {
                const allAlerts: ChartAlert[] = JSON.parse(saved);
                setAlerts(allAlerts.filter(a => a.symbol === symbol));
            } catch { }
        }
    }, [symbol]);

    // Save alerts to localStorage
    const saveAlerts = useCallback((newAlerts: ChartAlert[]) => {
        const saved = localStorage.getItem(ALERTS_STORAGE_KEY);
        let allAlerts: ChartAlert[] = [];
        if (saved) {
            try {
                allAlerts = JSON.parse(saved);
            } catch { }
        }
        // Remove old alerts for this symbol and add new ones
        allAlerts = allAlerts.filter(a => a.symbol !== symbol);
        allAlerts = [...allAlerts, ...newAlerts];
        localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(allAlerts));
        setAlerts(newAlerts);
    }, [symbol]);

    // Calculate price from Y position (using chart price range)
    const calculatePriceFromY = useCallback((y: number, containerHeight: number): number => {
        if (!chartPriceRange.high || !chartPriceRange.low || chartPriceRange.high === chartPriceRange.low) {
            // Fallback
            if (!currentPrice) return 0;
            const priceRange = currentPrice * 0.15;
            const centerY = containerHeight / 2;
            const priceOffset = ((centerY - y) / containerHeight) * priceRange * 2;
            return currentPrice + priceOffset;
        }
        
        // Calculate price based on chart range
        const yPercent = y / containerHeight;
        const range = chartPriceRange.high - chartPriceRange.low;
        return chartPriceRange.high - (yPercent * range);
    }, [currentPrice, chartPriceRange]);

    // Handle right-click on chart
    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        const rect = chartContainerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const y = e.clientY - rect.top;
        const price = calculatePriceFromY(y, rect.height);

        setContextMenu({
            x: e.clientX - rect.left,
            y: y,
            price: Math.round(price * 100) / 100
        });
    }, [calculatePriceFromY]);

    // Add new alert
    const addAlert = useCallback((type: 'above' | 'below' | 'cross') => {
        if (!contextMenu) return;

        const newAlert: ChartAlert = {
            id: `alert-${Date.now()}`,
            symbol,
            price: contextMenu.price,
            type,
            enabled: true,
            createdAt: Date.now(),
            note: alertNote || undefined
        };

        saveAlerts([...alerts, newAlert]);
        setContextMenu(null);
        setAlertNote('');
    }, [contextMenu, symbol, alerts, alertNote, saveAlerts]);

    // Delete alert
    const deleteAlert = useCallback((id: string) => {
        saveAlerts(alerts.filter(a => a.id !== id));
    }, [alerts, saveAlerts]);

    // Toggle alert enabled
    const toggleAlert = useCallback((id: string) => {
        saveAlerts(alerts.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
    }, [alerts, saveAlerts]);

    // Close context menu on click outside
    useEffect(() => {
        const handleClick = () => {
            setContextMenu(null);
            setMenuMode('main');
        };
        if (contextMenu) {
            document.addEventListener('click', handleClick);
            return () => document.removeEventListener('click', handleClick);
        }
    }, [contextMenu]);

    // ========== MOUSE TRACKING FOR FLOATING PLUS ==========
    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const rect = chartContainerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const price = calculatePriceFromY(y, rect.height);

        // Only show plus button near the right edge (price axis area)
        const isNearRightEdge = x > rect.width - 80;

        setMousePosition({ x, y, price: Math.round(price * 100) / 100 });
        setShowPlusButton(isNearRightEdge && !contextMenu);
    }, [calculatePriceFromY, contextMenu]);

    const handleMouseLeave = useCallback(() => {
        setShowPlusButton(false);
        setMousePosition(null);
    }, []);

    // Open menu from plus button click
    const handlePlusClick = useCallback(() => {
        if (mousePosition) {
            setContextMenu({
                x: mousePosition.x - 60,
                y: mousePosition.y,
                price: mousePosition.price
            });
            setShowPlusButton(false);
            setMenuMode('main');
        }
    }, [mousePosition]);

    const updateSetting = (key: keyof ChartSettings, value: any) => {
        if (!settings) return;
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        localStorage.setItem('global_tv_settings', JSON.stringify(newSettings));
        // Dispatch event for real-time synchronization across components
        window.dispatchEvent(new Event('settings-changed'));
    };

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
                    style: '2', // Default to Line
                    studies: ['Volume@tv-basicstudies'],
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
        if (!container.current || !settings) return;

        // Clean up previous script if any
        container.current.innerHTML = '';

        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/tv.js";
        script.type = "text/javascript";
        script.async = true;
        script.onload = () => {
            if (typeof window.TradingView !== 'undefined') {
                // Prepare grid visibility settings
                const bgColor = settings.backgroundColor || settings.uiBackgroundColor || "#0c0c0e";
                // Grid lines removed from all global charts (always hidden)
                const vertGridVisible = false;
                const horzGridVisible = false;
                const vertGridColor = "rgba(0,0,0,0)";
                const horzGridColor = "rgba(0,0,0,0)";
                const upColor = settings.upColor || "#6CCF84";
                const downColor = settings.downColor || "#A376EC";
                const wickUp = settings.wickUpColor || upColor;
                const wickDown = settings.wickDownColor || downColor;

                new window.TradingView.widget({
                    "width": "100%",
                    "height": "100%",
                    "symbol": symbol.includes(':') 
                        ? symbol 
                        : `BINANCE:${symbol.replace('USDT', '').replace('USD', '').replace('-', '').replace('/', '')}USDT`,
                    "interval": settings.interval || "60",
                    "timezone": settings.timezone || "Etc/UTC",
                    "theme": settings.theme || "dark",
                    "style": settings.style || "1",
                    "locale": "en",
                    "toolbar_bg": bgColor,
                    "enable_publishing": false,
                    "hide_top_toolbar": settings.show_top_toolbar === false,
                    "hide_side_toolbar": settings.show_side_toolbar === false,
                    "hide_legend": settings.show_legend === false,
                    "withdateranges": settings.withdateranges !== false,
                    "save_image": settings.save_image !== false,
                    "container_id": container.current?.id,
                    "allow_symbol_change": settings.allow_symbol_change !== false,
                    "studies": settings.studies || [],
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
                    // Apply chart theme colors (Body/Wick Up & Down) to all indicators: volume, RSI, MACD, MA, Bollinger, ATR, etc.
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
            }
        };
        container.current.appendChild(script);

        return () => {
            if (container.current) {
                container.current.innerHTML = '';
            }
        };
    }, [symbol, settings]);

    if (!settings) return null;

    return (
        <div
            className="tradingview-widget-container h-full w-full relative group flex flex-col"
            style={{ backgroundColor: settings.uiBackgroundColor }}
        >
            {/* Professional Top Toolbar - hidden when show_top_toolbar is false for minimal chart mode */}
            {settings.show_top_toolbar !== false && (
            <div
                className="h-10 border-b flex items-center justify-between px-2 z-50"
                style={{ borderColor: settings.uiBorderColor, backgroundColor: settings.uiBackgroundColor }}
            >
                <div className="flex items-center gap-1">
                    <div className="relative group/symbol">
                        <button
                            className="flex items-center gap-1.5 px-2 py-1 rounded transition-colors border"
                            style={{ backgroundColor: settings.uiSecondaryColor, borderColor: settings.uiBorderColor }}
                        >
                            <span className="text-[11px] font-black tracking-tight text-white">{symbol.replace('USDT', '')}USDT</span>
                            <ChevronDown size={12} className="text-zinc-500" />
                        </button>
                        <div className="absolute top-full left-0 mt-1 w-40 opacity-0 group-hover/symbol:opacity-100 pointer-events-none group-hover/symbol:pointer-events-auto transition-all z-[100] border rounded-lg shadow-2xl backdrop-blur-xl" style={{ backgroundColor: settings.uiBackgroundColor + 'f2', borderColor: settings.uiBorderColor }}>
                            {['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ARBUSDT'].map(s => (
                                <button key={s} className="w-full text-left px-3 py-2 text-[10px] font-bold text-zinc-400 hover:text-white hover:bg-white/5 first:rounded-t-lg last:rounded-b-lg transition-colors">
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="h-4 w-px mx-1" style={{ backgroundColor: settings.uiBorderColor }} />

                    <div className="flex items-center gap-0.5">
                        {/* ... interval buttons ... */}
                        {['5m', '30m', '1h', '4h', 'D'].map((int) => (
                            <button
                                key={int}
                                onClick={() => {
                                    const newInt = int === 'D' ? 'D' : int.replace('m', '');
                                    const finalInt = int === '1h' ? '60' : newInt;
                                    updateSetting('interval', finalInt);
                                }}
                                className={cn(
                                    "px-2 py-1 rounded text-[10px] font-bold transition-all",
                                    (settings.interval === (int === 'D' ? 'D' : int.replace('m', '')) || (int === '1h' && settings.interval === '60'))
                                        ? "text-white"
                                        : "text-zinc-500 hover:text-white"
                                )}
                                style={
                                    (settings.interval === (int === 'D' ? 'D' : int.replace('m', '')) || (int === '1h' && settings.interval === '60'))
                                        ? { backgroundColor: settings.uiAccentColor + '33', color: settings.uiAccentColor }
                                        : { backgroundColor: 'transparent' }
                                }
                            >
                                {int}
                            </button>
                        ))}
                    </div>

                    <div className="h-4 w-px mx-1" style={{ backgroundColor: settings.uiBorderColor }} />

                    <div className="relative group/func">
                        <button className="p-1.5 rounded hover:bg-white/5 text-zinc-400 hover:text-white transition-colors">
                            <FunctionSquare size={14} />
                        </button>
                        <div className="absolute top-full left-0 mt-1 w-48 opacity-0 group-hover/func:opacity-100 pointer-events-none group-hover/func:pointer-events-auto transition-all z-[100] border rounded-lg shadow-2xl backdrop-blur-xl p-1" style={{ backgroundColor: settings.uiBackgroundColor + 'f2', borderColor: settings.uiBorderColor }}>
                            <div className="px-2 py-1.5 text-[8px] font-black uppercase text-zinc-500 tracking-widest">Analysis Tools</div>
                            {['RSI Divergence', 'Liquidity Pools', 'Orderflow Delta', 'Volume Profile'].map(f => (
                                <button key={f} className="w-full text-left px-2 py-1.5 text-[10px] font-bold text-zinc-300 hover:text-white hover:bg-white/5 rounded transition-colors flex items-center justify-between">
                                    {f}
                                    <div className="w-1 h-1 rounded-full bg-indigo-500" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div
                        className="flex items-center gap-1.5 px-2 py-0.5 rounded border"
                        style={{ backgroundColor: settings.uiAccentColor + '1a', borderColor: settings.uiAccentColor + '33' }}
                    >
                        <span className="text-[10px] font-black" style={{ color: settings.uiAccentColor }}>10x CR</span>
                        <ChevronDown size={10} style={{ color: settings.uiAccentColor + '80' }} />
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={isReduceOnly}
                                onChange={(e) => setIsReduceOnly(e.target.checked)}
                                className="sr-only"
                            />
                            <div
                                className={cn(
                                    "w-3 h-3 rounded-sm border transition-colors flex items-center justify-center",
                                )}
                                style={{
                                    backgroundColor: isReduceOnly ? settings.uiAccentColor : 'transparent',
                                    borderColor: isReduceOnly ? settings.uiAccentColor : settings.uiBorderColor
                                }}
                            >
                                {isReduceOnly && <div className="w-1.5 h-1.5 bg-white rounded-[1px]" />}
                            </div>
                            <span className="text-[10px] font-bold text-zinc-400 group-hover:text-white transition-colors">Reduce only</span>
                        </label>
                    </div>

                    <div
                        className="flex items-center gap-2 px-2 py-1 rounded border"
                        style={{ backgroundColor: settings.uiSecondaryColor, borderColor: settings.uiBorderColor }}
                    >
                        <SlidersHorizontal size={12} className="text-zinc-500" />
                        <input
                            type="text"
                            value={orderSize}
                            onChange={(e) => setOrderSize(e.target.value)}
                            className="bg-transparent text-[11px] font-black text-white outline-none w-14 text-right"
                        />
                    </div>

                    <div className="h-4 w-px mx-1" style={{ backgroundColor: settings.uiBorderColor }} />

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setShowOrderPanel(!showOrderPanel)}
                            className={cn(
                                "flex items-center gap-1.5 px-2 py-1 rounded transition-all border",
                            )}
                            style={showOrderPanel ? {
                                backgroundColor: settings.uiAccentColor + '33',
                                color: settings.uiAccentColor,
                                borderColor: settings.uiAccentColor + '4d'
                            } : {
                                backgroundColor: settings.uiSecondaryColor,
                                color: '#a1a1aa',
                                borderColor: settings.uiBorderColor
                            }}
                        >
                            <LayoutGrid size={12} />
                            <span className="text-[10px] font-black uppercase tracking-widest leading-none mt-0.5">Order panel</span>
                        </button>
                        <button
                            onClick={() => setIsLocked(!isLocked)}
                            className={cn(
                                "p-1.5 rounded hover:bg-white/5 transition-colors",
                            )}
                            style={{ color: isLocked ? settings.uiAccentColor : '#71717a' }}
                        >
                            <Settings2 size={14} />
                        </button>
                    </div>
                </div>
            </div>
            )}

            <div
                ref={chartContainerRef}
                className="flex-1 h-full w-full relative group/chart overflow-hidden"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            >
                <div className="absolute top-2 left-2 z-[40] opacity-0 group-hover/chart:opacity-100 transition-opacity flex items-center gap-1.5">
                    <ChartSettingsModal onSettingsChange={setSettings} />
                </div>
                <ComponentSettingsLink tab="general" corner="top-right" title="Open chart settings" showOnHover size="xs" />
                <div id={`tv_chart_${symbol}`} className="h-full w-full" ref={container} />

                {/* ========== FLOATING PLUS BUTTON (matches screenshot) ========== */}
                <AnimatePresence>
                    {showPlusButton && mousePosition && !contextMenu && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.1 }}
                            className="absolute z-[90] flex items-center"
                            style={{
                                right: 8,
                                top: mousePosition.y - 12,
                            }}
                        >
                            {/* Price display */}
                            <div className="px-2 py-1 rounded-l-md bg-[#2a2a3e] border border-r-0 border-indigo-500/40 text-[11px] font-mono text-indigo-300 font-bold">
                                {mousePosition.price.toLocaleString()}
                            </div>
                            {/* Plus button */}
                            <button
                                onClick={handlePlusClick}
                                className="w-6 h-6 rounded-r-md bg-indigo-500 hover:bg-indigo-400 flex items-center justify-center cursor-pointer border border-indigo-400/50 transition-all"
                            >
                                <Plus size={14} className="text-white" strokeWidth={2.5} />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ========== CHART ORDER MENU (Only shows on + click) ========== */}
                <AnimatePresence>
                    {contextMenu && menuMode === 'main' && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.1 }}
                            className="absolute z-[100] w-44 rounded-lg overflow-hidden shadow-2xl"
                            style={{
                                right: 8,
                                top: contextMenu.y - 60,
                                backgroundColor: '#1a1a24',
                                border: '1px solid rgba(99, 102, 241, 0.25)'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Order Options */}
                            <div className="py-1">
                                {/* SELL LIMIT */}
                                <button
                                    onClick={() => {
                                        console.log('Sell Limit at', contextMenu.price);
                                        setContextMenu(null);
                                    }}
                                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-bold text-trading-bearish">SELL LIMIT</span>
                                        <div className="w-1.5 h-1.5 rounded-full bg-trading-bearish" />
                                    </div>
                                    <span className="text-[11px] font-mono text-zinc-400">{contextMenu.price.toLocaleString()}</span>
                                </button>

                                {/* BUY STOP */}
                                <button
                                    onClick={() => {
                                        console.log('Buy Stop at', contextMenu.price);
                                        setContextMenu(null);
                                    }}
                                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-bold text-trading-bullish">BUY STOP</span>
                                        <div className="w-1.5 h-1.5 rounded-full bg-trading-bullish" />
                                    </div>
                                    <span className="text-[11px] font-mono text-zinc-400">{contextMenu.price.toLocaleString()}</span>
                                </button>

                                {/* SELL STOP */}
                                <button
                                    onClick={() => {
                                        console.log('Sell Stop at', contextMenu.price);
                                        setContextMenu(null);
                                    }}
                                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-bold text-trading-bearish">SELL STOP</span>
                                        <div className="w-1.5 h-1.5 rounded-full bg-trading-bearish" />
                                    </div>
                                    <span className="text-[11px] font-mono text-zinc-400">{contextMenu.price.toLocaleString()}</span>
                                </button>
                            </div>

                            {/* Footer - Price indicator */}
                            <div className="px-3 py-2 border-t border-white/10 flex items-center gap-2 bg-[#16161e]">
                                <TrendingDown size={12} className="text-indigo-400" />
                                <span className="text-[10px] font-mono text-zinc-400">@ {contextMenu.price.toLocaleString()}</span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ========== ALERT SUBMENU ========== */}
                <AnimatePresence>
                    {contextMenu && menuMode === 'alert' && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, x: 10 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.95, x: 10 }}
                            className="absolute z-[101] w-52 rounded-lg shadow-2xl overflow-hidden"
                            style={{
                                left: Math.min(contextMenu.x + 195, (chartContainerRef.current?.offsetWidth || 500) - 220),
                                top: Math.min(contextMenu.y, (chartContainerRef.current?.offsetHeight || 500) - 200),
                                backgroundColor: '#1a1a1f',
                                border: '1px solid rgba(255,255,255,0.08)'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="px-3 py-2 border-b border-white/10 flex items-center gap-2">
                                <button onClick={() => setMenuMode('main')} className="text-zinc-500 hover:text-white">
                                    <ChevronDown size={14} className="rotate-90" />
                                </button>
                                <span className="text-[10px] font-bold text-zinc-400 uppercase">Alert Type</span>
                            </div>
                            <div className="py-1">
                                <button
                                    onClick={() => addAlert('above')}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 transition-colors"
                                >
                                    <div className="w-2 h-2 rounded-full bg-trading-bullish" />
                                    <span className="text-[11px] font-medium text-white">Price Above</span>
                                </button>
                                <button
                                    onClick={() => addAlert('below')}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 transition-colors"
                                >
                                    <div className="w-2 h-2 rounded-full bg-trading-bearish" />
                                    <span className="text-[11px] font-medium text-white">Price Below</span>
                                </button>
                                <button
                                    onClick={() => addAlert('cross')}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 transition-colors"
                                >
                                    <div className="w-2 h-2 rounded-full bg-indigo-500" />
                                    <span className="text-[11px] font-medium text-white">Price Cross</span>
                                </button>
                            </div>
                            <div className="px-3 py-2 border-t border-white/10">
                                <input
                                    type="text"
                                    placeholder="Note (optional)"
                                    value={alertNote}
                                    onChange={(e) => setAlertNote(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[10px] text-white placeholder-zinc-500 outline-none"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ========== ALERT LINES ON CHART ========== */}
                <div className="absolute inset-x-0 inset-y-0 pointer-events-none overflow-hidden z-15">
                    {alerts.map((alert) => {
                        if (!currentPrice) return null;
                        const topPos = calculatePricePosition(alert.price);

                        // Skip if completely out of view
                        if (topPos < -2 || topPos > 102) return null;
                        
                        // Clamp position for rendering
                        const clampedPos = Math.max(1, Math.min(99, topPos));

                        const alertColor = alert.type === 'above'
                            ? 'rgba(16, 185, 129, 0.8)'
                            : alert.type === 'below'
                                ? 'rgba(244, 63, 94, 0.8)'
                                : 'rgba(99, 102, 241, 0.8)';

                        const alertBgColor = alert.type === 'above'
                            ? 'rgba(16, 185, 129, 0.15)'
                            : alert.type === 'below'
                                ? 'rgba(244, 63, 94, 0.15)'
                                : 'rgba(99, 102, 241, 0.15)';

                        return (
                            <div
                                key={alert.id}
                                className="absolute left-0 right-0 h-[1px] transition-all duration-150 z-10"
                                style={{
                                    top: `${clampedPos}%`,
                                    borderTop: `1px dashed ${alert.enabled ? alertColor : 'rgba(113, 113, 122, 0.4)'}`,
                                }}
                            >
                                {/* Alert Label */}
                                <div
                                    className="absolute -top-[13px] right-[52px] flex items-center gap-1.5 px-2 py-1 rounded-lg border backdrop-blur-md shadow-lg pointer-events-auto cursor-pointer group"
                                    style={{
                                        backgroundColor: alert.enabled ? alertBgColor : 'rgba(39, 39, 42, 0.9)',
                                        borderColor: alert.enabled ? alertColor : 'rgba(113, 113, 122, 0.3)'
                                    }}
                                    onClick={() => setEditingAlert(alert)}
                                >
                                    {alert.enabled ? (
                                        <BellRing size={10} style={{ color: alertColor }} />
                                    ) : (
                                        <BellOff size={10} className="text-zinc-500" />
                                    )}
                                    <span
                                        className="text-[9px] font-black uppercase tracking-tight"
                                        style={{ color: alert.enabled ? alertColor : '#71717a' }}
                                    >
                                        {alert.type === 'above' ? '↑' : alert.type === 'below' ? '↓' : '↕'} Alert
                                    </span>
                                    {alert.note && (
                                        <span className="text-[8px] text-zinc-500 max-w-[60px] truncate">
                                            {alert.note}
                                        </span>
                                    )}

                                    {/* Quick Actions on Hover */}
                                    <div className="hidden group-hover:flex items-center gap-1 ml-1">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleAlert(alert.id);
                                            }}
                                            className="p-0.5 rounded hover:bg-white/10"
                                        >
                                            {alert.enabled ? (
                                                <BellOff size={10} className="text-zinc-400" />
                                            ) : (
                                                <BellRing size={10} className="text-trading-bullish" />
                                            )}
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteAlert(alert.id);
                                            }}
                                            className="p-0.5 rounded hover:bg-trading-bearish/20"
                                        >
                                            <Trash2 size={10} className="text-trading-bearish" />
                                        </button>
                                    </div>
                                </div>

                                {/* Price Label on Axis */}
                                <div
                                    className="absolute -top-[13px] right-0 w-[52px] h-[26px] flex items-center justify-center text-[10px] font-black font-mono shadow-xl border-l z-50"
                                    style={{
                                        backgroundColor: alert.enabled ? alertBgColor : 'rgba(39, 39, 42, 0.9)',
                                        color: alert.enabled ? 'white' : '#71717a',
                                        borderColor: 'rgba(255,255,255,0.1)'
                                    }}
                                >
                                    {alert.price.toFixed(2)}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Vertical Price Tooltip Rail (Simulated) */}
                {settings.show_right_toolbar && (
                    <div
                        className="absolute top-0 bottom-0 right-0 w-12 border-l z-20 pointer-events-none"
                        style={{ backgroundColor: settings.uiBackgroundColor + '33', borderColor: settings.uiBorderColor }}
                    />
                )}

                {/* ========== RIGHT-SIDE ORDER/POSITION PANEL ========== */}
                {/* This panel shows orders and positions as stacked cards on the right side */}
                {/* This approach works reliably regardless of chart zoom/pan state */}
                <div className="absolute top-12 right-1 z-30 flex flex-col gap-1.5 pointer-events-none max-h-[calc(100%-140px)] overflow-y-auto scrollbar-hide">
                    {/* Current Position Cards */}
                    {positions.map((pos, idx) => {
                        const isLong = pos.side === 'long';
                        const pnlPercent = pos.entryPrice ? ((currentPrice - pos.entryPrice) / pos.entryPrice * 100 * (isLong ? 1 : -1)) : 0;
                        
                        return (
                            <div
                                key={`pos-card-${idx}`}
                                className="pointer-events-auto flex items-stretch rounded-lg overflow-hidden shadow-xl border backdrop-blur-xl animate-in slide-in-from-right-2"
                                style={{
                                    borderColor: isLong ? 'rgba(108, 207, 132, 0.4)' : 'rgba(163, 118, 236, 0.4)',
                                    backgroundColor: settings.uiBackgroundColor + 'f5'
                                }}
                            >
                                {/* Side indicator */}
                                <div 
                                    className="w-1.5"
                                    style={{ backgroundColor: isLong ? '#6CCF84' : '#A376EC' }}
                                />
                                
                                {/* Content */}
                                <div className="flex items-center gap-2 px-2 py-1.5">
                                    {/* Side Badge */}
                                    <div 
                                        className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase"
                                        style={{ 
                                            backgroundColor: isLong ? 'rgba(108, 207, 132, 0.2)' : 'rgba(163, 118, 236, 0.2)',
                                            color: isLong ? '#6CCF84' : '#A376EC'
                                        }}
                                    >
                                        {isLong ? 'LONG' : 'SHORT'}
                                    </div>
                                    
                                    {/* Size */}
                                    <span className="text-[10px] font-black text-white">{pos.size}</span>
                                    
                                    {/* Entry Price */}
                                    <span className="text-[9px] font-mono text-zinc-400">@{pos.entryPrice?.toFixed(4)}</span>
                                    
                                    {/* PNL */}
                                    <div className={cn(
                                        "px-1.5 py-0.5 rounded text-[10px] font-black font-mono",
                                        pos.pnl >= 0 ? "bg-trading-bullish/20 text-trading-bullish" : "bg-trading-bearish/20 text-trading-bearish"
                                    )}>
                                        {pos.pnl >= 0 ? '+' : ''}{pos.pnl?.toFixed(2)}
                                        <span className="text-[8px] ml-0.5 opacity-70">({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)</span>
                                    </div>
                                    
                                    {/* Close button */}
                                    <button className="p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-white transition-colors">
                                        <X size={10} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    
                    {/* Open Order Cards */}
                    {orders.map((order, idx) => {
                        const price = order.price || order.stopPrice;
                        if (!price) return null;
                        
                        const isBuy = order.side?.toLowerCase() === 'buy';
                        const orderType = order.type?.toUpperCase() || 'LIMIT';
                        const distancePercent = currentPrice ? ((price - currentPrice) / currentPrice * 100) : 0;
                        
                        return (
                            <div
                                key={`order-card-${idx}`}
                                className="pointer-events-auto flex items-stretch rounded-lg overflow-hidden shadow-xl border backdrop-blur-xl animate-in slide-in-from-right-2"
                                style={{
                                    borderColor: isBuy ? 'rgba(108, 207, 132, 0.3)' : 'rgba(163, 118, 236, 0.3)',
                                    backgroundColor: settings.uiBackgroundColor + 'ee'
                                }}
                            >
                                {/* Side indicator - dashed pattern for pending orders */}
                                <div 
                                    className="w-1.5"
                                    style={{ 
                                        background: isBuy 
                                            ? 'repeating-linear-gradient(0deg, #6CCF84 0px, #6CCF84 3px, transparent 3px, transparent 6px)'
                                            : 'repeating-linear-gradient(0deg, #A376EC 0px, #A376EC 3px, transparent 3px, transparent 6px)'
                                    }}
                                />
                                
                                {/* Content */}
                                <div className="flex items-center gap-2 px-2 py-1.5">
                                    {/* Type Badge */}
                                    <div 
                                        className="px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-tight"
                                        style={{ 
                                            backgroundColor: isBuy ? 'rgba(108, 207, 132, 0.15)' : 'rgba(163, 118, 236, 0.15)',
                                            color: isBuy ? '#6CCF84' : '#A376EC'
                                        }}
                                    >
                                        {orderType} {isBuy ? 'BUY' : 'SELL'}
                                    </div>
                                    
                                    {/* Size */}
                                    <span className="text-[10px] font-black text-white">{order.amount || order.size}</span>
                                    
                                    {/* Price */}
                                    <span 
                                        className="text-[10px] font-mono font-bold"
                                        style={{ color: isBuy ? '#6CCF84' : '#A376EC' }}
                                    >
                                        @{price.toFixed(4)}
                                    </span>
                                    
                                    {/* Distance from current */}
                                    <span className="text-[8px] text-zinc-500 font-mono">
                                        ({distancePercent >= 0 ? '+' : ''}{distancePercent.toFixed(2)}%)
                                    </span>
                                    
                                    {/* Cancel button */}
                                    <button className="p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-red-400 transition-colors">
                                        <X size={10} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    
                    {/* Liquidation Warning */}
                    {settings?.plot_liquidation && positions.length > 0 && positions[0].liquidationPrice && (
                        <div
                            className="pointer-events-auto flex items-stretch rounded-lg overflow-hidden shadow-xl border backdrop-blur-xl animate-in slide-in-from-right-2"
                            style={{
                                borderColor: 'rgba(245, 158, 11, 0.4)',
                                backgroundColor: settings.uiBackgroundColor + 'ee'
                            }}
                        >
                            <div className="w-1.5 bg-amber-500" />
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <AlertTriangle size={12} className="text-amber-500" />
                                <span className="text-[8px] font-black text-amber-500 uppercase">LIQ</span>
                                <span className="text-[10px] font-mono font-bold text-amber-400">
                                    @{positions[0].liquidationPrice.toFixed(4)}
                                </span>
                                <span className="text-[8px] text-zinc-500 font-mono">
                                    ({((positions[0].liquidationPrice - currentPrice) / currentPrice * 100).toFixed(2)}%)
                                </span>
                            </div>
                        </div>
                    )}
                </div>
                
                {/* ========== CURRENT PRICE INDICATOR ON Y-AXIS ========== */}
                {/* This shows the current price on the right edge, always visible */}
                {currentPrice > 0 && (
                    <div 
                        className="absolute right-0 z-40 flex items-center pointer-events-none"
                        style={{ top: 'calc(50% - 13px)' }}
                    >
                        <div 
                            className="h-[26px] flex items-center justify-center px-2 text-[11px] font-black font-mono shadow-xl"
                            style={{
                                backgroundColor: settings.uiAccentColor || '#3b82f6',
                                color: 'white',
                                borderRadius: '4px 0 0 4px'
                            }}
                        >
                            {currentPrice.toFixed(4)}
                        </div>
                    </div>
                )}

                {/* ========== FLOATING ORDER PANEL (Size Presets) ========== */}
                <AnimatePresence>
                    {showOrderPanel && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, x: 20 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.95, x: 20 }}
                            className="absolute top-16 right-4 z-50 w-56 rounded-xl border shadow-2xl overflow-hidden backdrop-blur-xl"
                            style={{ 
                                backgroundColor: (settings?.uiBackgroundColor || '#0c0c0e') + 'f5', 
                                borderColor: settings?.uiBorderColor || 'rgba(255,255,255,0.1)' 
                            }}
                        >
                            {/* Mode Toggle Tabs */}
                            <div className="flex items-center justify-center gap-1 p-2 border-b" style={{ borderColor: settings?.uiBorderColor }}>
                                {(['BTC', 'USDT', '%'] as const).map((m) => (
                                    <button
                                        key={m}
                                        onClick={() => setSizePresetMode(m)}
                                        className={cn(
                                            "px-4 py-1.5 rounded-md text-xs font-bold transition-all",
                                            sizePresetMode === m
                                                ? "text-white shadow-lg"
                                                : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                                        )}
                                        style={sizePresetMode === m ? {
                                            backgroundColor: settings?.uiAccentColor || '#6366f1',
                                            boxShadow: `0 4px 15px ${(settings?.uiAccentColor || '#6366f1')}40`
                                        } : {}}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                            
                            {/* Size Presets */}
                            <div className="p-2 space-y-1">
                                {sizePresetMode === '%' ? (
                                    // Percentage presets
                                    [10, 25, 50, 75, 100].map((pct) => {
                                        const isSelected = selectedSizePreset === pct;
                                        return (
                                            <button
                                                key={pct}
                                                onClick={() => {
                                                    setSelectedSizePreset(pct);
                                                    setOrderSize(`${pct}%`);
                                                }}
                                                className={cn(
                                                    "w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all",
                                                    isSelected
                                                        ? "border"
                                                        : "hover:bg-white/5 border border-transparent"
                                                )}
                                                style={isSelected ? {
                                                    backgroundColor: (settings?.uiAccentColor || '#6366f1') + '20',
                                                    borderColor: (settings?.uiAccentColor || '#6366f1') + '50'
                                                } : {}}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                                                    )}
                                                    style={{ borderColor: isSelected ? (settings?.uiAccentColor || '#6366f1') : '#52525b' }}
                                                    >
                                                        {isSelected && (
                                                            <div 
                                                                className="w-2 h-2 rounded-full" 
                                                                style={{ backgroundColor: settings?.uiAccentColor || '#6366f1' }}
                                                            />
                                                        )}
                                                    </div>
                                                    <div className="flex items-center rounded px-2 py-0.5" style={{ backgroundColor: settings?.uiSecondaryColor }}>
                                                        <span className="text-white font-bold text-sm">{pct}</span>
                                                        <span className="text-zinc-400 text-xs ml-1">%</span>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })
                                ) : (
                                    // USDT/BTC presets
                                    [20, 300, 500, 1000, 2000].map((usd) => {
                                        const btc = currentPrice > 0 ? usd / currentPrice : 0;
                                        const isSelected = selectedSizePreset === usd;
                                        const displayValue = sizePresetMode === 'USDT' ? usd : btc;
                                        const displayUnit = sizePresetMode === 'USDT' ? 'USDT' : 'BTC';
                                        
                                        return (
                                            <button
                                                key={usd}
                                                onClick={() => {
                                                    setSelectedSizePreset(usd);
                                                    setOrderSize(usd.toLocaleString());
                                                }}
                                                className={cn(
                                                    "w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all",
                                                    isSelected
                                                        ? "border"
                                                        : "hover:bg-white/5 border border-transparent"
                                                )}
                                                style={isSelected ? {
                                                    backgroundColor: (settings?.uiAccentColor || '#6366f1') + '20',
                                                    borderColor: (settings?.uiAccentColor || '#6366f1') + '50'
                                                } : {}}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                                                    )}
                                                    style={{ borderColor: isSelected ? (settings?.uiAccentColor || '#6366f1') : '#52525b' }}
                                                    >
                                                        {isSelected && (
                                                            <div 
                                                                className="w-2 h-2 rounded-full" 
                                                                style={{ backgroundColor: settings?.uiAccentColor || '#6366f1' }}
                                                            />
                                                        )}
                                                    </div>
                                                    <div className="flex items-center rounded px-2 py-0.5" style={{ backgroundColor: settings?.uiSecondaryColor }}>
                                                        <span className="text-white font-bold text-sm">
                                                            {sizePresetMode === 'USDT' ? displayValue.toLocaleString() : displayValue.toFixed(4)}
                                                        </span>
                                                        <span className="text-zinc-400 text-xs ml-1">{displayUnit}</span>
                                                    </div>
                                                </div>
                                                <span className="text-zinc-500 text-xs">
                                                    ≈ {sizePresetMode === 'USDT' ? btc.toFixed(4) : usd.toLocaleString()} {sizePresetMode === 'USDT' ? 'BTC' : 'USDT'}
                                                </span>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ========== ALERT EDIT MODAL ========== */}
                <AnimatePresence>
                    {editingAlert && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
                            onClick={() => setEditingAlert(null)}
                        >
                            <motion.div
                                initial={{ scale: 0.9, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.9, y: 20 }}
                                className="w-72 border rounded-2xl shadow-2xl overflow-hidden"
                                style={{
                                    backgroundColor: settings?.uiBackgroundColor || '#0c0c0e',
                                    borderColor: settings?.uiBorderColor || 'rgba(255,255,255,0.1)'
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: settings?.uiBorderColor }}>
                                    <div className="flex items-center gap-2">
                                        <BellRing size={16} className="text-indigo-400" />
                                        <span className="text-sm font-bold text-white">Edit Alert</span>
                                    </div>
                                    <button
                                        onClick={() => setEditingAlert(null)}
                                        className="p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-white"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>

                                {/* Content */}
                                <div className="p-4 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-zinc-400">Price</span>
                                        <span className="text-sm font-black font-mono text-white">
                                            ${editingAlert.price.toLocaleString()}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-zinc-400">Type</span>
                                        <span className={cn(
                                            "text-xs font-bold uppercase px-2 py-0.5 rounded",
                                            editingAlert.type === 'above' && "bg-trading-bullish/20 text-trading-bullish",
                                            editingAlert.type === 'below' && "bg-trading-bearish/20 text-trading-bearish",
                                            editingAlert.type === 'cross' && "bg-indigo-500/20 text-indigo-400"
                                        )}>
                                            {editingAlert.type === 'above' ? '↑ Above' : editingAlert.type === 'below' ? '↓ Below' : '↕ Cross'}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-zinc-400">Status</span>
                                        <button
                                            onClick={() => {
                                                toggleAlert(editingAlert.id);
                                                setEditingAlert({ ...editingAlert, enabled: !editingAlert.enabled });
                                            }}
                                            className={cn(
                                                "flex items-center gap-2 px-2 py-1 rounded-lg transition-colors",
                                                editingAlert.enabled
                                                    ? "bg-trading-bullish/20 text-trading-bullish"
                                                    : "bg-zinc-800 text-zinc-500"
                                            )}
                                        >
                                            {editingAlert.enabled ? <BellRing size={12} /> : <BellOff size={12} />}
                                            <span className="text-[10px] font-bold uppercase">
                                                {editingAlert.enabled ? 'Active' : 'Disabled'}
                                            </span>
                                        </button>
                                    </div>

                                    {editingAlert.note && (
                                        <div>
                                            <span className="text-[11px] font-bold text-zinc-400 block mb-1">Note</span>
                                            <p className="text-[11px] text-zinc-300 bg-white/5 rounded-lg px-3 py-2">
                                                {editingAlert.note}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="px-4 py-3 border-t flex items-center justify-between" style={{ borderColor: settings?.uiBorderColor }}>
                                    <button
                                        onClick={() => {
                                            deleteAlert(editingAlert.id);
                                            setEditingAlert(null);
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-trading-bearish/10 border border-trading-bearish/20 text-trading-bearish text-[10px] font-bold uppercase hover:bg-trading-bearish/20 transition-colors"
                                    >
                                        <Trash2 size={12} />
                                        Delete
                                    </button>
                                    <button
                                        onClick={() => setEditingAlert(null)}
                                        className="px-4 py-1.5 rounded-lg bg-indigo-500 text-white text-[10px] font-bold uppercase hover:bg-indigo-600 transition-colors"
                                    >
                                        Done
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ========== ALERTS LIST BUTTON ========== */}
                {alerts.length > 0 && (
                    <div className="absolute top-2 right-2 z-40">
                        <div className="relative group/alerts">
                            <button
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border backdrop-blur-md transition-all hover:bg-white/5"
                                style={{
                                    backgroundColor: settings?.uiBackgroundColor + 'cc' || '#0c0c0ecc',
                                    borderColor: settings?.uiBorderColor || 'rgba(255,255,255,0.1)'
                                }}
                            >
                                <BellRing size={12} className="text-indigo-400" />
                                <span className="text-[10px] font-bold text-white">{alerts.length}</span>
                            </button>

                            {/* Alerts Dropdown */}
                            <div
                                className="absolute top-full right-0 mt-1 w-64 opacity-0 invisible group-hover/alerts:opacity-100 group-hover/alerts:visible transition-all border rounded-xl shadow-2xl backdrop-blur-xl overflow-hidden max-h-80 overflow-y-auto"
                                style={{
                                    backgroundColor: settings?.uiBackgroundColor + 'f8' || '#0c0c0ef8',
                                    borderColor: settings?.uiBorderColor || 'rgba(255,255,255,0.1)'
                                }}
                            >
                                <div className="px-3 py-2 border-b sticky top-0" style={{ borderColor: settings?.uiBorderColor, backgroundColor: settings?.uiBackgroundColor }}>
                                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Active Alerts</span>
                                </div>
                                {alerts.map((alert) => (
                                    <div
                                        key={alert.id}
                                        className="px-3 py-2 border-b hover:bg-white/5 transition-colors cursor-pointer flex items-center justify-between group"
                                        style={{ borderColor: settings?.uiBorderColor }}
                                        onClick={() => setEditingAlert(alert)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={cn(
                                                "w-5 h-5 rounded flex items-center justify-center text-[10px] font-black",
                                                alert.type === 'above' && "bg-trading-bullish/20 text-trading-bullish",
                                                alert.type === 'below' && "bg-trading-bearish/20 text-trading-bearish",
                                                alert.type === 'cross' && "bg-indigo-500/20 text-indigo-400",
                                                !alert.enabled && "opacity-50"
                                            )}>
                                                {alert.type === 'above' ? '↑' : alert.type === 'below' ? '↓' : '↕'}
                                            </div>
                                            <div>
                                                <div className="text-[11px] font-bold text-white font-mono">
                                                    ${alert.price.toLocaleString()}
                                                </div>
                                                {alert.note && (
                                                    <div className="text-[9px] text-zinc-500 truncate max-w-[120px]">
                                                        {alert.note}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleAlert(alert.id);
                                                }}
                                                className="p-1 rounded hover:bg-white/10"
                                            >
                                                {alert.enabled ? (
                                                    <BellOff size={12} className="text-zinc-400" />
                                                ) : (
                                                    <BellRing size={12} className="text-trading-bullish" />
                                                )}
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteAlert(alert.id);
                                                }}
                                                className="p-1 rounded hover:bg-trading-bearish/20"
                                            >
                                                <Trash2 size={12} className="text-trading-bearish" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}

export const TradingViewChart = memo(TradingViewWidget);
