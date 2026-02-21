"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Save, Plus, Trash2, Key, Shield, AlertTriangle, Eye, EyeOff, Globe, Zap, Power, RefreshCw, LayoutGrid, Search, Server, CheckCircle2, XCircle, Clock, Filter, Wrench, Wifi, WifiOff, Activity, Edit, BarChart3, Settings2, Palette, Layers, TrendingUp, Lock, Unlock, Download, Upload, Pencil, Check, X, DollarSign, ChevronDown, Landmark } from "lucide-react";
import { PortfolioConnection, SupportedChain } from "@/lib/api/types";
import { v4 as uuidv4 } from 'uuid';
import { cn } from "@/lib/utils";
import { CryptoIcon } from "@/components/ui/CryptoIcon";
import { useWebSocketStatus } from "@/hooks/useWebSocketStatus";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { PageWrapper } from "@/components/Layout/PageWrapper";
import { useNotifications } from "@/components/Notifications/NotificationSystem";
import { useAlerts } from "@/hooks/useAlerts";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { Switch } from "@/components/ui/switch";
import { Bell, Volume2, Globe as WebIcon, ShieldCheck, Trash2 as TrashIcon } from "lucide-react";
const AlertsSettingsLazy = dynamic(
    () => import("@/components/Settings/AlertsSettings").then((m) => ({ default: m.AlertsSettings })),
    { ssr: false, loading: () => <div className="rounded-lg border border-white/10 bg-zinc-900/50 p-4 text-zinc-500 text-sm">Loading alerts…</div> }
);
const JournalPlaybookSettingsLazy = dynamic(
    () => import("@/components/Settings/JournalPlaybookSettings").then((m) => ({ default: m.JournalPlaybookSettings })),
    { ssr: false, loading: () => <div className="rounded-lg border border-white/10 bg-zinc-900/50 p-4 text-zinc-500 text-sm">Loading journal…</div> }
);
const ExportImportSettingsLazy = dynamic(
    () => import("@/components/Settings/ExportImportSettings").then((m) => ({ default: m.ExportImportSettings })),
    { ssr: false, loading: () => <div className="rounded-lg border border-white/10 bg-zinc-900/50 p-4 text-zinc-500 text-sm">Loading export/import…</div> }
);
const TradingSecurityCardLazy = dynamic(
    () => import("@/components/Settings/TradingSecurityCard").then((m) => ({ default: m.TradingSecurityCard })),
    { ssr: false, loading: () => <div className="rounded-lg border border-white/10 bg-zinc-900/50 p-4 text-zinc-500 text-sm">Loading security…</div> }
);
const LicenseSettingsCardLazy = dynamic(
    () => import("@/components/Settings/LicenseSettingsCard").then((m) => ({ default: m.LicenseSettingsCard })),
    { ssr: false, loading: () => <div className="rounded-lg border border-white/10 bg-zinc-900/50 p-4 text-zinc-500 text-sm">Loading license…</div> }
);
const SpotAvgPriceSettingsLazy = dynamic(
    () => import("@/components/Settings/SpotAvgPriceSettings").then((m) => ({ default: m.SpotAvgPriceSettings })),
    { ssr: false, loading: () => <div className="rounded-lg border border-white/10 bg-zinc-900/50 p-4 text-zinc-500 text-sm">Loading…</div> }
);
import {
    DEFAULT_MF_API_BASE,
    DEFAULT_STOCKS_API_BASE,
    INDIAN_MF_API_BASE_KEY,
    INDIAN_STOCKS_API_BASE_KEY,
    CAS_PARSER_API_KEY_STORAGE,
} from "@/lib/api/indian-markets-config";
import { persistConnections } from "@/lib/connection-persistence";
import { loadPersistedConnections } from "@/lib/connection-persistence";
import { LatencyMeter, LatencyBar } from "@/components/Settings/LatencyMeter";
import { DebugTab } from "@/components/Settings/tabs/DebugTab";
import { SecurityTab } from "@/components/Settings/tabs/SecurityTab";
import { GeneralTab } from "@/components/Settings/tabs/GeneralTab";
import { CloudSyncCard } from "@/components/Settings/CloudSyncCard";
import { AdminTab } from "@/components/Settings/AdminTab";
import { SocialSettings } from "@/components/Settings/SocialSettings";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { isBuilder } from "@/lib/user-cloud/config";
import { detectChainFromAddress, CHAIN_DISPLAY_NAMES } from "@/lib/addressChainDetection";
import { FUTURES_AGGREGATOR_SETTINGS_KEY, DEFAULT_AGGREGATOR_SETTINGS } from "@/lib/api/futures-aggregator";
import {
    type AppearanceSettings,
    type ThemeMode,
    type UiThemeMode,
    type PageSkinMode,
    type NumericStyle,
    type GlowIntensity,
    type GlowTheme,
    type FontSizeScale,
    type RadiusSize,
    type GlassEffect,
    DEFAULT_APPEARANCE_SETTINGS,
    APPLE_GLOW_PRESET,
    THEME_TEMPLATES,
    loadAppearanceSettings,
    saveAppearanceSettings,
    applyAppearanceSettings,
} from "@/lib/appearance-settings";
import type { AIProvider } from "@/lib/api/ai";

/** Sync aggregator keys from tvSettings (global_tv_settings) to futures_aggregator_settings so DOM/aggregator hook stays in sync. */
function syncAggregatorSettingsToFutures(tv: Record<string, any>) {
    try {
        const current = localStorage.getItem(FUTURES_AGGREGATOR_SETTINGS_KEY);
        const prev = current ? JSON.parse(current) : {};
        const next = {
            ...DEFAULT_AGGREGATOR_SETTINGS,
            ...prev,
            enabledExchanges: Array.isArray(tv.aggregatorExchanges) ? tv.aggregatorExchanges : (prev.enabledExchanges ?? DEFAULT_AGGREGATOR_SETTINGS.enabledExchanges),
            refreshInterval: typeof tv.aggregatorRefreshInterval === 'number' ? tv.aggregatorRefreshInterval : (prev.refreshInterval ?? DEFAULT_AGGREGATOR_SETTINGS.refreshInterval),
            orderBookDepth: typeof tv.aggregatorOrderBookDepth === 'number' ? tv.aggregatorOrderBookDepth : (prev.orderBookDepth ?? DEFAULT_AGGREGATOR_SETTINGS.orderBookDepth),
            tickSize: typeof tv.aggregatorTickSize === 'string' ? tv.aggregatorTickSize : (prev.tickSize ?? DEFAULT_AGGREGATOR_SETTINGS.tickSize),
        };
        localStorage.setItem(FUTURES_AGGREGATOR_SETTINGS_KEY, JSON.stringify(next));
    } catch { }
}

const INDICATORS = [
    { label: "Volume", value: "Volume@tv-basicstudies" },
    { label: "EMA (20/50/200)", value: "MAExp@tv-basicstudies" },
    { label: "RSI", value: "RSI@tv-basicstudies" },
    { label: "MACD", value: "MACD@tv-basicstudies" },
    { label: "Bollinger Bands", value: "BollingerBands@tv-basicstudies" },
    { label: "VWAP", value: "VWAP@tv-basicstudies" },
    { label: "Ichimoku Cloud", value: "IchimokuCloud@tv-basicstudies" },
    { label: "On Balance Volume", value: "OBV@tv-basicstudies" },
    { label: "Stochastic", value: "Stochastic@tv-basicstudies" },
    { label: "Average True Range", value: "ATR@tv-basicstudies" },
    { label: "Commodity Channel Index", value: "CCI@tv-basicstudies" },
    { label: "Money Flow Index", value: "MFI@tv-basicstudies" },
    { label: "Williams %R", value: "WilliamsR@tv-basicstudies" },
    { label: "Keltner Channels", value: "KeltnerChannels@tv-basicstudies" },
];

const BG_PRESETS = [
    { label: "Obsidian", value: "#0A0A0B" },
    { label: "TradingView", value: "#131722" },
    { label: "Deep Navy", value: "#050914" },
    { label: "Exocharts", value: "#141310" },
    { label: "Onyx", value: "#141318" },
    { label: "Pure Black", value: "#000000" },
];

const CHART_STYLES = [
    { id: "1", name: "Candles" },
    { id: "3", name: "Heikin" },
    { id: "2", name: "Hollow" },
    { id: "9", name: "Line" },
    { id: "14", name: "Area" },
    { id: "10", name: "Baseline" },
    { id: "0", name: "Bars" },
    { id: "13", name: "Columns" },
    { id: "12", name: "Hi-Lo" },
    { id: "4", name: "Renko" },
    { id: "5", name: "Kagi" },
    { id: "6", name: "P&F" },
    { id: "7", name: "Break" },
];

const DEFAULT_TV_COLORS = {
    upColor: "#6CCF84",
    downColor: "#A376EC",
    wickUpColor: "#6CCF84",
    wickDownColor: "#A376EC",
};

const SETTINGS_TABS = ['general', 'connections', 'journal', 'alerts', 'security', 'preferences', 'appearance', 'social', 'indian_markets', 'data', 'debug', 'admin'] as const;
const CONNECTION_EXCHANGE_TYPES = ['binance', 'bybit', 'hyperliquid', 'okx', 'kucoin', 'kraken', 'gate', 'bitget', 'mexc'] as const;
const CONNECTION_WALLET_TYPES = ['wallet', 'zerion', 'evm', 'solana', 'aptos', 'ton'] as const;

export default function SettingsPage() {
    const [saved, setSaved] = useState(false);
    const { notify } = useNotifications();
    const { user } = useSupabaseAuth();
    const { triggerConnectionsRefetch } = usePortfolio();
    const searchParams = useSearchParams();
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        setIsMounted(true);
    }, []);
    const showAdminTab = isMounted && isBuilder(user);

    // Get initial tab from URL params (hydrate after mount to avoid SSR mismatch)
    const [activeTab, setActiveTab] = useState('general');

    // Update active tab when URL changes
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (!isMounted) return;
        if (tab && SETTINGS_TABS.includes(tab as typeof SETTINGS_TABS[number])) {
            if (tab === 'admin' && !showAdminTab) return;
            setActiveTab(tab);
        }
    }, [searchParams, showAdminTab, isMounted]);

    // If admin tab is hidden and we're on admin, switch to general
    useEffect(() => {
        if (!showAdminTab && activeTab === 'admin') setActiveTab('general');
    }, [showAdminTab, activeTab]);

    // --- STATE: GENERAL ---
    const [isDemoMode, setIsDemoMode] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [baseCurrency, setBaseCurrency] = useState('USD'); // Placeholder for now

    // --- STATE: CONNECTIONS ---
    const [connections, setConnections] = useState<PortfolioConnection[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [newConnection, setNewConnection] = useState<Partial<PortfolioConnection>>({
        type: 'binance',
        name: '',
    });
    const [showChainSelect, setShowChainSelect] = useState(false);
    // Default to single-chain tracking to avoid noisy multi-chain fetch fan-out.
    const [trackAllEvmChains, setTrackAllEvmChains] = useState(false);
    const exchangeConnections = connections.filter(c => CONNECTION_EXCHANGE_TYPES.includes(c.type as typeof CONNECTION_EXCHANGE_TYPES[number]));
    const walletConnections = connections.filter(c => CONNECTION_WALLET_TYPES.includes(c.type as typeof CONNECTION_WALLET_TYPES[number]) && !c.hardwareType);

    // --- STATE: PREFERENCES (Advanced) ---
    const [dustThreshold, setDustThreshold] = useState(1.0); // Default $1.00
    const [hideSpam, setHideSpam] = useState(true);
    const [filters, setFilters] = useState({
        transactionTypes: ['buy', 'sell', 'transfer'],
        minAmount: 0,
        dateRange: 'all' as 'all' | '7d' | '30d' | '90d',
    });

    // --- STATE: TRADINGVIEW ---
    const [tvSettings, setTvSettings] = useState({
        theme: 'dark',
        interval: '60',
        style: '1',
        studies: ['Volume@tv-basicstudies'],
        show_top_toolbar: false,
        show_side_toolbar: false,
        show_legend: false,
        backgroundColor: "#141310",
        gridColor: "rgba(255, 255, 255, 0.06)",
        upColor: DEFAULT_TV_COLORS.upColor,
        downColor: DEFAULT_TV_COLORS.downColor,
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
        wickUpColor: DEFAULT_TV_COLORS.wickUpColor,
        wickDownColor: DEFAULT_TV_COLORS.wickDownColor,
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
        // Terminal Specifics
        enableOrderConfirmations: true,
        defaultOrderSize: "0.1",
        quickTradeButtons: ["0.1", "0.5", "1.0", "5.0"],
        showFloatingTradePanel: true,
        // Order Configuration
        fatFingerProtection: 10000,
        enableDualInputControls: true,
        showQuickPercentButtons: true,
        hyperliquidChaseServerFills: false,
        enableAutoTP: false,
        enableQuickButtons: true,
        orderQuickButtons: ["100", "250", "500", "1000", "2500", "5000", "10000"],
        quickButtonsMode: "USD",
        quickButtonsStyle: "filled",
        // Position Configuration
        simplifiedPnL: false,
        denialMode: false,
        nukeAccountPositions: false,
        nukeLockedPositions: false,
        globalReduceOnly: false,
        quickCloseButtons: ["25", "50", "75", "100"],
        // DOM Configuration - Core Settings
        showDOMPanel: true,
        domAutoCenter: true,
        domTickSize: "auto",
        domMaxRows: 500,
        domRowHeight: 17,
        domAutoCenterTolerance: 22,
        domDuplicateSharedPrice: true,
        domFont: "JetBrains Mono",
        domFontSize: 14,
        domHeaderFontSize: 13,
        domHorizGridEvery: 1,
        domShowCenterLine: false,
        domShowCrossHair: true,
        // Ultra-fast DOM Mode
        domUltraFastMode: false,
        domUltraFastUpdateMs: 16, // ~60 FPS (16ms)
        domNormalUpdateMs: 50, // ~20 FPS (50ms)

        // DOM Data Source
        domReconstructMarketOrders: true,
        domFilterSmallTrades: false,
        domSmallTradeThreshold: 100, // USD
        domFilterLargeTrades: false,
        domLargeTradeThreshold: 100000, // USD
        domNormalizeRotationCandles: true,
        domNormalizeSeconds: 3,
        domUseSyntheticVolume: true,
        domSyntheticVolumeMode: "volume_price",
        domOverrideTickSize: true,
        domRoundingPrecision: "power_of_10",

        // Terminal background run - pause sync when tab hidden unless enabled
        terminalBackgroundRun: false,
        // DOM Info, Meters
        domShowHeader: true,
        domShowBottomInfo: true,
        domBottomInfoSmallFontSize: 14,
        domBottomInfoLargeFontSize: 14,
        domProfileInfoElapsedCandle: false,
        domProfileInfoVolume: true,
        domProfileInfoDelta: true,
        domProfileInfoFontSize: 14,
        domBidAskShowTotal: true,
        domPullStackShowTotals: true,
        domShowTradeMeter: true,
        domTradeMeterEMA: 5,
        domShowBidAskMeter: true,
        domBidAskMeterEMA: 5,
        domShowPullStackMeter: true,
        domPullStackMeterEMA: 5,
        domMetersShowLegend: true,

        // DOM Bid, Ask
        domShowBidAsk: true,
        domShowText: true,
        domShowProfile: true,
        domShortNumbers: true,
        domBidInverseText: false,
        domBidInverseProfile: false,
        domAskInverseText: false,
        domAskInverseProfile: false,
        domCombineBidAskColumns: false,
        domProfileMinFill: 5,

        // DOM Colors
        domBidColor: "#10b981",
        domAskColor: "#f43f5e",
        domBidProfileColor: "#10b98133",
        domAskProfileColor: "#f43f5e33",
        domCenterLineColor: "#fbbf24",
        domGridColor: "#27272a",
        // Terminal header bar: show/hide components
        headerShowPrice: true,
        headerShowMarketStats: true,
        headerShowConnection: true,
        headerShowExchangeDots: true,
        headerShowDomIndicator: true,
        headerShowLatency: true,
        headerShowPositions: true,
        headerShowRefresh: true,
        headerShowWidgetToggles: true,
        headerShowEditReset: true,
    });

    const [alertSettings, setAlertSettings] = useState({
        browserNotifications: true,
        soundEnabled: true,
        soundVolume: 0.5,
        webhookEnabled: false,
        webhookUrl: "",
        minIntensityForAlert: 50,
    });

    const [appearance, setAppearance] = useState<AppearanceSettings>(DEFAULT_APPEARANCE_SETTINGS);

    const [aiProvider, setAiProvider] = useState<AIProvider>("auto");
    const [openaiApiKey, setOpenaiApiKey] = useState("");
    const [geminiApiKey, setGeminiApiKey] = useState("");
    const [ollamaBaseUrl, setOllamaBaseUrl] = useState("http://127.0.0.1:11434");
    const [ollamaModel, setOllamaModel] = useState("llama3.1:8b");
    const [showOpenaiKey, setShowOpenaiKey] = useState(false);
    const [showGeminiKey, setShowGeminiKey] = useState(false);

    const [indianMfApiBase, setIndianMfApiBase] = useState(DEFAULT_MF_API_BASE);
    const [indianStocksApiBase, setIndianStocksApiBase] = useState(DEFAULT_STOCKS_API_BASE);
    const [casParserApiKey, setCasParserApiKey] = useState("");

    const { alerts, removeAlert, toggleAlert } = useAlerts();

    // Real-time Connection Status
    const wsStatusMap = useWebSocketStatus();

    // --- LOAD / SAVE EFFECTS ---
    useEffect(() => {
        const loadSettings = async () => {
            await loadPersistedConnections();

            // Load settings
            setIsDemoMode(localStorage.getItem("demo_mode") === "true");
            setAutoRefresh(localStorage.getItem("settings_auto_refresh") !== "false");
            setHideSpam(localStorage.getItem("settings_hide_spam") !== "false");

            const savedDust = localStorage.getItem("settings_dust_threshold");
            if (savedDust) setDustThreshold(parseFloat(savedDust));

            const savedConnections = localStorage.getItem("portfolio_connections");
            if (savedConnections) {
                try {
                    const parsed = JSON.parse(savedConnections);
                    setConnections(Array.isArray(parsed) ? parsed : []);
                } catch {
                    setConnections([]);
                }
            }

            const savedFilters = localStorage.getItem("transaction_filters");
            if (savedFilters) setFilters(JSON.parse(savedFilters));

            const savedTv = localStorage.getItem("global_tv_settings");
            if (savedTv) {
                const parsed = JSON.parse(savedTv);
                // One-time migration: apply minimal chart defaults (toolbars hidden, grid off)
                const version = parsed.tv_settings_version ?? 0;
                if (version < 2) {
                    const minimal = {
                        show_top_toolbar: false,
                        show_side_toolbar: false,
                        show_right_toolbar: false,
                        show_legend: false,
                        withdateranges: false,
                        allow_symbol_change: false,
                        save_image: false,
                        details: false,
                        hotlist: false,
                        calendar: false,
                        show_popup_button: false,
                        show_vert_grid: false,
                        show_horz_grid: false,
                        tv_settings_version: 2,
                    };
                    const migrated = { ...parsed, ...minimal };
                    localStorage.setItem("global_tv_settings", JSON.stringify(migrated));
                    setTvSettings(prev => ({ ...prev, ...migrated }));
                    syncAggregatorSettingsToFutures(migrated);
                } else {
                    setTvSettings(prev => ({ ...prev, ...parsed }));
                    syncAggregatorSettingsToFutures(parsed || {});
                }
            }

            const savedAlerts = localStorage.getItem("global_alert_settings");
            if (savedAlerts) setAlertSettings(prev => ({ ...prev, ...JSON.parse(savedAlerts) }));

            const savedOpenaiKey = localStorage.getItem("openai_api_key");
            if (savedOpenaiKey) setOpenaiApiKey(savedOpenaiKey);
            const savedGeminiKey = localStorage.getItem("gemini_api_key");
            if (savedGeminiKey) setGeminiApiKey(savedGeminiKey);
            const savedOllamaBase = localStorage.getItem("ollama_base_url");
            if (savedOllamaBase) setOllamaBaseUrl(savedOllamaBase);
            const savedOllamaModel = localStorage.getItem("ollama_model");
            if (savedOllamaModel) setOllamaModel(savedOllamaModel);
            const savedProvider = (localStorage.getItem("ai_provider") || "auto").toLowerCase();
            if (savedProvider === "openai" || savedProvider === "gemini" || savedProvider === "ollama" || savedProvider === "auto") {
                setAiProvider(savedProvider as AIProvider);
            }

            const savedMfBase = localStorage.getItem(INDIAN_MF_API_BASE_KEY);
            if (savedMfBase) setIndianMfApiBase(savedMfBase);
            const savedStocksBase = localStorage.getItem(INDIAN_STOCKS_API_BASE_KEY);
            if (savedStocksBase) setIndianStocksApiBase(savedStocksBase);
            const savedCasParser = localStorage.getItem(CAS_PARSER_API_KEY_STORAGE);
            if (savedCasParser) setCasParserApiKey(savedCasParser);

            setAppearance(loadAppearanceSettings());
        };

        loadSettings();
    }, []);

    const updateTvSetting = (key: string, value: any) => {
        let normalizedValue = value;

        // Robust color normalization for copy-paste UX
        if (typeof value === 'string') {
            const trimmed = value.trim();
            // Prepend # if it's a valid hex and missing prefix
            if (/^[0-9A-Fa-f]{3,8}$/.test(trimmed)) {
                normalizedValue = '#' + trimmed;
            } else {
                normalizedValue = trimmed;
            }
        }

        const newSettings = { ...tvSettings, [key]: normalizedValue };
        setTvSettings(newSettings);
        localStorage.setItem("global_tv_settings", JSON.stringify(newSettings));
        if (['aggregatorExchanges', 'aggregatorRefreshInterval', 'aggregatorOrderBookDepth', 'aggregatorTickSize'].includes(key)) {
            syncAggregatorSettingsToFutures(newSettings);
        }
        window.dispatchEvent(new Event('settings-changed'));
    };

    const updateAppearance = (partial: Partial<AppearanceSettings>) => {
        const next = { ...appearance, ...partial };
        setAppearance(next);
        saveAppearanceSettings(next);
        applyAppearanceSettings(next);
    };

    const handleSave = () => {
        persistConnections(connections);
        localStorage.setItem("transaction_filters", JSON.stringify(filters));
        localStorage.setItem("settings_auto_refresh", String(autoRefresh));
        localStorage.setItem("settings_dust_threshold", String(dustThreshold));
        localStorage.setItem("settings_hide_spam", String(hideSpam));
        localStorage.setItem("global_tv_settings", JSON.stringify(tvSettings));
        syncAggregatorSettingsToFutures(tvSettings);
        localStorage.setItem("global_alert_settings", JSON.stringify(alertSettings));
        if (openaiApiKey.trim()) localStorage.setItem("openai_api_key", openaiApiKey.trim());
        else localStorage.removeItem("openai_api_key");
        if (geminiApiKey.trim()) localStorage.setItem("gemini_api_key", geminiApiKey.trim());
        else localStorage.removeItem("gemini_api_key");
        if (ollamaBaseUrl.trim()) localStorage.setItem("ollama_base_url", ollamaBaseUrl.trim());
        else localStorage.removeItem("ollama_base_url");
        if (ollamaModel.trim()) localStorage.setItem("ollama_model", ollamaModel.trim());
        else localStorage.removeItem("ollama_model");
        localStorage.setItem("ai_provider", aiProvider);
        window.dispatchEvent(new Event("openai-api-key-changed"));
        window.dispatchEvent(new Event("gemini-api-key-changed"));
        window.dispatchEvent(new Event("ollama-settings-changed"));
        window.dispatchEvent(new Event("ai-provider-changed"));

        localStorage.setItem(INDIAN_MF_API_BASE_KEY, indianMfApiBase.trim() || DEFAULT_MF_API_BASE);
        localStorage.setItem(INDIAN_STOCKS_API_BASE_KEY, indianStocksApiBase.trim() || DEFAULT_STOCKS_API_BASE);
        localStorage.setItem(CAS_PARSER_API_KEY_STORAGE, casParserApiKey.trim());
        window.dispatchEvent(new Event("indian-markets-settings-changed"));

        saveAppearanceSettings(appearance);
        applyAppearanceSettings(appearance);

        notify({
            type: 'success',
            title: 'TERMINAL CONFIG SAVED',
            message: 'Your preferences and color engine settings have been synchronized successfully.',
            duration: 3000
        });

        // Demo mode has its own toggle handler, but sync it here just in case
        localStorage.setItem("demo_mode", String(isDemoMode));

        setSaved(true);
        setTimeout(() => setSaved(false), 3000);

        // Dispatch custom event to notify app of setting changes (if needed by other components)
        window.dispatchEvent(new Event('settings-changed'));
    };

    const toggleDemoMode = () => {
        const newValue = !isDemoMode;
        setIsDemoMode(newValue);
        localStorage.setItem("demo_mode", String(newValue));
        window.location.reload();
    };

    // --- CONNECTION HANDLERS ---
    const addConnection = () => {
        if (!newConnection.name) return;

        const isEvmAddress = (addr: string) => /^0x[0-9a-fA-F]{40}$/i.test((addr || '').trim());
        const EVM_CHAINS: SupportedChain[] = [
            'ETH', 'ARB', 'OP', 'BASE', 'MATIC', 'BSC', 'AVAX', 'FTM',
            'LINEA', 'SCROLL', 'ZKSYNC', 'BLAST', 'GNOSIS', 'CELO',
            'CRONOS', 'MANTLE', 'KAVA'
        ];
        const isEvmChain = (c: SupportedChain) => EVM_CHAINS.includes(c);

        const chain = newConnection.chain || 'ETH';
        const walletAddr = newConnection.walletAddress?.trim();
        const isWalletEvm = newConnection.type === 'wallet' && walletAddr && isEvmAddress(walletAddr) && isEvmChain(chain);

        if (newConnection.type === 'wallet' && isEvmChain(chain) && walletAddr && !isEvmAddress(walletAddr)) {
            notify({
                type: 'error',
                title: 'Invalid EVM Address',
                message: 'Use a valid 0x... EVM address before adding wallet chains.',
                duration: 3500
            });
            return;
        }

        if (isWalletEvm && trackAllEvmChains) {
            const existingKeys = new Set(
                connections.map(c => `${c.type}|${(c.walletAddress || '').toLowerCase()}|${c.chain || ''}|${c.hardwareType || ''}|${c.name}`)
            );
            const newConns: PortfolioConnection[] = EVM_CHAINS
                .filter(ch => !existingKeys.has(`wallet|${walletAddr!.toLowerCase()}|${ch}|${newConnection.hardwareType || ''}|${newConnection.name!}`))
                .map(ch => ({
                id: uuidv4(),
                type: 'wallet',
                name: newConnection.name!,
                walletAddress: walletAddr!,
                chain: ch,
                hardwareType: newConnection.hardwareType, // Preserve hardware type (Ledger/Trezor)
                enabled: true
            }));
            if (newConns.length === 0) {
                notify({
                    type: 'info',
                    title: 'Already Added',
                    message: 'These wallet-chain connections already exist.',
                    duration: 2500
                });
                return;
            }
            const updatedConnections = [...connections, ...newConns];
            setConnections(updatedConnections);
            persistConnections(updatedConnections);
            triggerConnectionsRefetch?.();
            setIsAdding(false);
            setNewConnection({ type: 'binance', name: '' });
            notify({
                type: 'success',
                title: 'Wallet Added',
                message: `${newConnection.name} is now tracked on ${EVM_CHAINS.length} EVM chains (ETH, ARB, OP, BASE, and more).`,
                duration: 4000
            });
            return;
        }

        const conn: PortfolioConnection = {
            id: uuidv4(),
            type: newConnection.type as any,
            name: newConnection.name,
            apiKey: newConnection.apiKey,
            secret: newConnection.secret,
            walletAddress: newConnection.walletAddress,
            chain: newConnection.chain,
            hardwareType: newConnection.hardwareType, // Include hardware type for Ledger/Trezor/GridPlus
            enabled: true
        };
        const duplicate = connections.some(c =>
            c.type === conn.type &&
            (c.walletAddress || '').toLowerCase() === (conn.walletAddress || '').toLowerCase() &&
            (c.chain || '') === (conn.chain || '') &&
            (c.hardwareType || '') === (conn.hardwareType || '') &&
            c.name === conn.name
        );
        if (duplicate) {
            notify({
                type: 'info',
                title: 'Already Added',
                message: 'This connection already exists.',
                duration: 2500
            });
            return;
        }
        const updatedConnections = [...connections, conn];
        setConnections(updatedConnections);
        // Auto-save connections immediately for better UX
        persistConnections(updatedConnections);
        triggerConnectionsRefetch?.();
        setIsAdding(false);
        setNewConnection({ type: 'binance', name: '' });

        // Show success notification
        notify({
            type: 'success',
            title: 'Connection Added',
            message: conn.hardwareType
                ? `${conn.hardwareType.charAt(0).toUpperCase() + conn.hardwareType.slice(1)} wallet added to Hardware Wallets`
                : `${conn.name} connected successfully`,
            duration: 3000
        });
    };

    const toggleConnection = (id: string) => {
        const updatedConnections = connections.map(conn =>
            conn.id === id ? { ...conn, enabled: !conn.enabled } : conn
        );
        setConnections(updatedConnections);
        persistConnections(updatedConnections);
    };

    const removeConnection = (id: string) => {
        const conn = connections.find(c => c.id === id);
        if (conn?.locked) {
            notify({
                type: 'error',
                title: 'Connection Locked',
                message: 'Unlock the connection before deleting it.',
                duration: 3000
            });
            return;
        }
        const updatedConnections = connections.filter(c => c.id !== id);
        setConnections(updatedConnections);
        persistConnections(updatedConnections);
    };

    // Lock/Unlock connection
    const toggleLockConnection = (id: string) => {
        const updatedConnections = connections.map(conn =>
            conn.id === id ? { ...conn, locked: !conn.locked } : conn
        );
        setConnections(updatedConnections);
        persistConnections(updatedConnections);
        const conn = updatedConnections.find(c => c.id === id);
        notify({
            type: 'success',
            title: conn?.locked ? 'Connection Locked' : 'Connection Unlocked',
            message: conn?.locked ? 'This connection is now protected from deletion.' : 'You can now delete this connection.',
            duration: 2000
        });
    };

    // Rename connection
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');

    const startRename = (conn: PortfolioConnection) => {
        setRenamingId(conn.id);
        setRenameValue(conn.displayName || conn.name);
    };

    const saveRename = (id: string) => {
        if (!renameValue.trim()) {
            setRenamingId(null);
            return;
        }
        const updatedConnections = connections.map(conn =>
            conn.id === id ? { ...conn, displayName: renameValue.trim() } : conn
        );
        setConnections(updatedConnections);
        persistConnections(updatedConnections);
        setRenamingId(null);
        notify({
            type: 'success',
            title: 'Connection Renamed',
            message: `Connection renamed to "${renameValue.trim()}"`,
            duration: 2000
        });
    };

    const cancelRename = () => {
        setRenamingId(null);
        setRenameValue('');
    };

    const toggleAllowTrading = (id: string) => {
        const updatedConnections = connections.map(conn =>
            conn.id === id ? { ...conn, allowTrading: !conn.allowTrading } : conn
        );
        setConnections(updatedConnections);
        persistConnections(updatedConnections);
    };

    // Edit Hardware Wallet - Add new chain
    const [editingHardwareWallet, setEditingHardwareWallet] = useState<{
        deviceName: string;
        hardwareType: string;
        existingChains: string[];
    } | null>(null);

    // Hardware wallet collapsed state and balance filter
    const [collapsedHardwareWallets, setCollapsedHardwareWallets] = useState<Record<string, boolean>>({});
    const [hwBalanceFilter, setHwBalanceFilter] = useState<Record<string, boolean>>({}); // true = show only $5+ balance

    const toggleHardwareWalletCollapse = (deviceKey: string) => {
        setCollapsedHardwareWallets(prev => ({
            ...prev,
            [deviceKey]: !(prev[deviceKey] ?? true)
        }));
    };

    const toggleHwBalanceFilter = (deviceKey: string) => {
        setHwBalanceFilter(prev => ({
            ...prev,
            [deviceKey]: !prev[deviceKey]
        }));
    };

    const [newChainForHardware, setNewChainForHardware] = useState<{
        chain: SupportedChain;
        address: string;
        addAllEvm: boolean;
    }>({ chain: 'ETH', address: '', addAllEvm: false });

    // All EVM chains that share the same address format (0x...)
    const EVM_CHAIN_LIST: SupportedChain[] = [
        'ETH', 'ARB', 'OP', 'BASE', 'MATIC', 'BSC', 'AVAX', 'FTM',
        'LINEA', 'SCROLL', 'ZKSYNC', 'BLAST', 'GNOSIS', 'CELO',
        'CRONOS', 'MANTLE', 'KAVA'
    ];

    // Check if a chain is EVM compatible
    const isEvmChain = (chain: SupportedChain) => EVM_CHAIN_LIST.includes(chain);

    const startEditHardwareWallet = (deviceName: string, hardwareType: string, chains: PortfolioConnection[]) => {
        setEditingHardwareWallet({
            deviceName,
            hardwareType,
            existingChains: chains.map(c => c.chain || 'ETH')
        });
        setNewChainForHardware({ chain: 'ETH', address: '', addAllEvm: false });
    };

    const addChainToHardwareWallet = () => {
        if (!editingHardwareWallet || !newChainForHardware.address.trim()) {
            notify({
                type: 'error',
                title: 'Missing Address',
                message: 'Please enter a wallet address for this chain.',
                duration: 3000
            });
            return;
        }

        const address = newChainForHardware.address.trim();
        const isEvm = isEvmChain(newChainForHardware.chain);
        const isEvmAddress = (addr: string) => /^0x[0-9a-fA-F]{40}$/i.test((addr || '').trim());
        if (isEvm && !isEvmAddress(address)) {
            notify({
                type: 'error',
                title: 'Invalid EVM Address',
                message: 'Use a valid 0x... address for EVM chains.',
                duration: 3000
            });
            return;
        }

        // Determine which chains to add
        let chainsToAdd: SupportedChain[] = [];

        if (newChainForHardware.addAllEvm && isEvm) {
            // Add all EVM chains that aren't already added
            chainsToAdd = EVM_CHAIN_LIST.filter(
                chain => !editingHardwareWallet.existingChains.includes(chain)
            );
        } else {
            // Just add the selected chain
            if (editingHardwareWallet.existingChains.includes(newChainForHardware.chain)) {
                notify({
                    type: 'error',
                    title: 'Chain Already Exists',
                    message: `${newChainForHardware.chain} is already added to this wallet.`,
                    duration: 3000
                });
                return;
            }
            chainsToAdd = [newChainForHardware.chain];
        }

        if (chainsToAdd.length === 0) {
            notify({
                type: 'info',
                title: 'All Chains Added',
                message: 'All EVM chains are already added to this wallet.',
                duration: 3000
            });
            return;
        }

        // Create connections for all chains to add
        const existingKeys = new Set(
            connections.map(c => `${c.type}|${(c.walletAddress || '').toLowerCase()}|${c.chain || ''}|${c.hardwareType || ''}|${c.name}`)
        );
        const newConnections: PortfolioConnection[] = chainsToAdd
            .filter(chain => !existingKeys.has(`wallet|${address.toLowerCase()}|${chain}|${editingHardwareWallet.hardwareType || ''}|${editingHardwareWallet.deviceName}`))
            .map(chain => ({
            id: uuidv4(),
            type: 'wallet' as const,
            name: editingHardwareWallet.deviceName,
            walletAddress: address,
            chain: chain,
            hardwareType: editingHardwareWallet.hardwareType as any,
            enabled: true
        }));
        if (newConnections.length === 0) {
            notify({
                type: 'info',
                title: 'Already Added',
                message: 'All selected chains for this address are already configured.',
                duration: 3000
            });
            return;
        }

        const updatedConnections = [...connections, ...newConnections];
        setConnections(updatedConnections);
        persistConnections(updatedConnections);
        triggerConnectionsRefetch?.();

        notify({
            type: 'success',
            title: chainsToAdd.length > 1 ? 'Chains Added' : 'Chain Added',
            message: chainsToAdd.length > 1
                ? `${chainsToAdd.length} EVM chains added to ${editingHardwareWallet.deviceName}.`
                : `${newChainForHardware.chain} chain added to ${editingHardwareWallet.deviceName}.`,
            duration: 3000
        });

        // Update existing chains in the editing state
        setEditingHardwareWallet({
            ...editingHardwareWallet,
            existingChains: [...editingHardwareWallet.existingChains, ...chainsToAdd]
        });
        setNewChainForHardware({ chain: 'ETH', address: '', addAllEvm: false });

        // Auto-collapse after adding chains and close the edit form
        const deviceKey = `${editingHardwareWallet.hardwareType}-${editingHardwareWallet.deviceName}`;
        setCollapsedHardwareWallets(prev => ({ ...prev, [deviceKey]: true }));
        setEditingHardwareWallet(null);
    };

    const cancelEditHardwareWallet = () => {
        setEditingHardwareWallet(null);
        setNewChainForHardware({ chain: 'ETH', address: '', addAllEvm: false });
    };

    // Export all connections to JSON file
    const exportConnections = () => {
        const exportData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            connections: connections.map(conn => ({
                ...conn,
                // Mask sensitive data for security
                apiKey: conn.apiKey ? `${conn.apiKey.slice(0, 8)}...${conn.apiKey.slice(-4)}` : undefined,
                secret: conn.secret ? '********' : undefined
            }))
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `portfolio-connections-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        notify({
            type: 'success',
            title: 'Connections Exported',
            message: `${connections.length} connections exported to file. Note: API secrets are masked for security.`,
            duration: 4000
        });
    };

    // Import connections from JSON file
    const importConnections = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target?.result as string);

                if (!data.connections || !Array.isArray(data.connections)) {
                    throw new Error('Invalid file format');
                }

                // Merge with existing connections (avoid duplicates by ID)
                const existingIds = new Set(connections.map(c => c.id));
                const newConnections = data.connections.filter((c: PortfolioConnection) => !existingIds.has(c.id));

                // For imported connections, generate new IDs to avoid conflicts
                const importedConnections = newConnections.map((conn: PortfolioConnection) => ({
                    ...conn,
                    id: uuidv4(),
                    // Clear masked secrets - user needs to re-enter
                    apiKey: conn.apiKey?.includes('...') ? undefined : conn.apiKey,
                    secret: conn.secret === '********' ? undefined : conn.secret,
                    displayName: conn.displayName || `${conn.name} (Imported)`
                }));

                const updatedConnections = [...connections, ...importedConnections];
                setConnections(updatedConnections);
                persistConnections(updatedConnections);

                notify({
                    type: 'success',
                    title: 'Connections Imported',
                    message: `${importedConnections.length} new connections imported. Re-enter API keys if needed.`,
                    duration: 5000
                });
            } catch (err) {
                notify({
                    type: 'error',
                    title: 'Import Failed',
                    message: 'Invalid file format. Please use a valid export file.',
                    duration: 4000
                });
            }
        };
        reader.readAsText(file);

        // Reset input
        event.target.value = '';
    };

    // Repair connection state
    const [repairingId, setRepairingId] = useState<string | null>(null);

    // Local connection health state with latency tracking
    const [connectionHealth, setConnectionHealth] = useState<Record<string, {
        status: 'connected' | 'disconnected' | 'checking';
        latency?: number;
        lastChecked?: Date;
        reason?: string;
    }>>({});

    // Merge local health with websocket status
    const connectionStatus = connections.reduce((acc, conn) => {
        const wsInfo = wsStatusMap.get(conn.id);
        const localHealth = connectionHealth[conn.id];

        // Prefer local health if recently checked, otherwise use websocket status
        if (localHealth && localHealth.lastChecked && (Date.now() - localHealth.lastChecked.getTime() < 60000)) {
            acc[conn.id] = localHealth;
        } else {
            acc[conn.id] = {
                status: wsInfo?.status === 'connected' ? 'connected' : wsInfo?.status === 'error' ? 'disconnected' : 'checking',
                lastSync: wsInfo?.lastUpdate,
                latency: wsInfo?.latency || localHealth?.latency,
                reason: localHealth?.reason,
            };
        }
        return acc;
    }, {} as { [key: string]: { status: 'connected' | 'disconnected' | 'checking'; lastSync?: Date; latency?: number; reason?: string } });

    // Test a single connection and update health
    const testConnectionHealth = async (conn: PortfolioConnection): Promise<{ success: boolean; latency: number; reason?: string }> => {
        const startTime = Date.now();
        const parseApiError = async (res: Response): Promise<string> => {
            let reason = `HTTP ${res.status}`;
            const responseClone = res.clone();
            try {
                const payload = await responseClone.json();
                if (typeof payload?.error === 'string' && payload.error) reason = payload.error;
                if (typeof payload?.details === 'string' && payload.details) reason = payload.details;
                if (typeof payload?.diagnostics?.message === 'string' && payload.diagnostics.message) reason = payload.diagnostics.message;
                if (Array.isArray(payload?.diagnostics?.errors) && payload.diagnostics.errors.length > 0) {
                    reason = String(payload.diagnostics.errors[0]);
                }
                if (typeof reason === 'string' && reason.startsWith('{')) {
                    try {
                        const nested = JSON.parse(reason);
                        if (typeof nested?.error === 'string' && nested.error) reason = nested.error;
                    } catch {
                        // ignore nested parse
                    }
                }
            } catch {
                const text = await res.text().catch(() => '');
                if (text) reason = text;
            }
            if (typeof reason === 'string' && reason.startsWith('HTTP 5')) {
                reason = 'Service unavailable (server error). Please retry in a few seconds.';
            }
            return reason;
        };
        try {
            if (conn.type === 'hyperliquid' && conn.walletAddress) {
                // Use Hyperliquid's meta endpoint for fast ping
                const res = await fetch('https://api.hyperliquid.xyz/info', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'meta' }),
                });
                const latency = Date.now() - startTime;
                if (!res.ok) return { success: false, latency, reason: 'Hyperliquid connection failed' };
                return { success: true, latency };
            } else if (conn.type === 'bybit' && conn.apiKey && conn.secret) {
                // Authenticated probe: treat "connected" as valid credentials + permissions.
                const res = await fetch('/api/cex/balance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        exchangeId: 'bybit',
                        apiKey: conn.apiKey,
                        secret: conn.secret,
                        accountType: 'spot',
                    }),
                });
                const latency = Date.now() - startTime;
                if (!res.ok) {
                    const reason = await parseApiError(res);
                    return { success: false, latency, reason };
                }
                return { success: true, latency };
            } else if (conn.type === 'binance' && conn.apiKey && conn.secret) {
                // Authenticated probe: requires valid key/signature.
                const res = await fetch('/api/cex/balance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        exchangeId: 'binance',
                        apiKey: conn.apiKey,
                        secret: conn.secret,
                    }),
                });
                const latency = Date.now() - startTime;
                if (!res.ok) {
                    const reason = await parseApiError(res);
                    return { success: false, latency, reason };
                }
                return { success: true, latency };
            } else if (conn.walletAddress) {
                // Use fast public RPC endpoints with simple eth_blockNumber call
                const chainRpcEndpoints: Record<string, string> = {
                    'ETH': 'https://eth.llamarpc.com',
                    'ARB': 'https://arb1.arbitrum.io/rpc',
                    'OP': 'https://mainnet.optimism.io',
                    'BASE': 'https://mainnet.base.org',
                    'MATIC': 'https://polygon-rpc.com',
                    'BSC': 'https://bsc-dataseed.binance.org',
                    'AVAX': 'https://api.avax.network/ext/bc/C/rpc',
                    'FTM': 'https://rpc.ftm.tools',
                    'LINEA': 'https://rpc.linea.build',
                    'SCROLL': 'https://rpc.scroll.io',
                    'ZKSYNC': 'https://mainnet.era.zksync.io',
                    'BLAST': 'https://rpc.blast.io',
                    'GNOSIS': 'https://rpc.gnosischain.com',
                    'CELO': 'https://forno.celo.org',
                    'CRONOS': 'https://evm.cronos.org',
                    'MANTLE': 'https://rpc.mantle.xyz',
                    'SOL': 'https://api.mainnet-beta.solana.com',
                };
                const endpoint = chainRpcEndpoints[conn.chain || 'ETH'];
                if (endpoint) {
                    if (conn.chain === 'SOL') {
                        const res = await fetch(endpoint, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth' }),
                        });
                        const latency = Date.now() - startTime;
                        if (res.ok) return { success: true, latency };
                    } else {
                        // Fast eth_blockNumber call - just pings the RPC
                        const res = await fetch(endpoint, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
                        });
                        const latency = Date.now() - startTime;
                        if (res.ok) return { success: true, latency };
                    }
                }
                // Fallback for chains without RPC - mark as connected
                return { success: true, latency: 50 };
            }
            return { success: true, latency: Date.now() - startTime };
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            return { success: false, latency: Date.now() - startTime, reason: message };
        }
    };

    // Auto health check on mount and periodically
    useEffect(() => {
        const checkAllConnections = async () => {
            const enabledConnections = connections.filter(c => c.enabled !== false);

            // Set all to checking initially
            const checkingState: typeof connectionHealth = {};
            enabledConnections.forEach(conn => {
                checkingState[conn.id] = { status: 'checking', lastChecked: new Date(), reason: undefined };
            });
            setConnectionHealth(prev => ({ ...prev, ...checkingState }));

            // Test connections in parallel (batched to avoid rate limits)
            const batchSize = 3;
            for (let i = 0; i < enabledConnections.length; i += batchSize) {
                const batch = enabledConnections.slice(i, i + batchSize);
                await Promise.all(batch.map(async (conn) => {
                    const result = await testConnectionHealth(conn);
                    setConnectionHealth(prev => ({
                        ...prev,
                        [conn.id]: {
                            status: result.success ? 'connected' : 'disconnected',
                            latency: result.latency,
                            lastChecked: new Date(),
                            reason: result.success ? undefined : result.reason,
                        }
                    }));
                }));
            }
        };

        // Initial check after a short delay
        const timer = setTimeout(checkAllConnections, 1000);

        // Periodic health check every 30 seconds
        const interval = setInterval(checkAllConnections, 30000);

        return () => {
            clearTimeout(timer);
            clearInterval(interval);
        };
    }, [connections]);

    // Repair / test connection handler
    const repairConnection = async (conn: PortfolioConnection) => {
        setRepairingId(conn.id);

        // Set to checking state with animation
        setConnectionHealth(prev => ({
            ...prev,
            [conn.id]: { status: 'checking', lastChecked: new Date(), reason: undefined }
        }));

        try {
            const result = await testConnectionHealth(conn);

            // Update health state
            setConnectionHealth(prev => ({
                ...prev,
                [conn.id]: {
                    status: result.success ? 'connected' : 'disconnected',
                    latency: result.latency,
                    lastChecked: new Date(),
                    reason: result.success ? undefined : result.reason,
                }
            }));

            if (result.success) {
                notify({
                    type: 'success',
                    title: 'Connection OK',
                    message: `${conn.displayName || conn.name}: ${result.latency}ms`,
                    duration: 2000
                });
            } else {
                notify({
                    type: 'error',
                    title: 'Connection Failed',
                    message: `${conn.displayName || conn.name}: ${result.reason || 'Connection test failed'}`,
                    duration: 3500
                });
                console.warn(`[Repair] ${conn.name}: ${result.reason || 'Connection test failed'}`);
                return;
            }

            console.log(`[Repair] ${conn.name}: ${result.latency}ms - OK`);
            window.dispatchEvent(new Event('settings-changed'));
        } catch (error) {
            setConnectionHealth(prev => ({
                ...prev,
                [conn.id]: {
                    status: 'disconnected',
                    lastChecked: new Date(),
                    reason: error instanceof Error ? error.message : String(error),
                }
            }));
            notify({
                type: 'error',
                title: 'Connection Failed',
                message: `${conn.displayName || conn.name}: ${error instanceof Error ? error.message : String(error)}`,
                duration: 3500
            });
            console.warn(`[Repair] ${conn.name}: Failed`, error);
        } finally {
            setRepairingId(null);
        }
    };

    // --- FILTER HANDLERS ---
    const toggleTransactionType = (type: string) => {
        setFilters(prev => ({
            ...prev,
            transactionTypes: prev.transactionTypes.includes(type)
                ? prev.transactionTypes.filter(t => t !== type)
                : [...prev.transactionTypes, type]
        }));
    };

    const tabContentClass = "flex-1 min-h-0 overflow-auto mt-0 pt-2 pb-12 space-y-6 focus:outline-none data-[state=inactive]:hidden";
    const settingsTabTriggerClass = "tm-settings-tab data-[state=active]:bg-cyan-500/18 data-[state=active]:text-cyan-100 data-[state=active]:border-cyan-400/35 text-zinc-400 border border-transparent text-xs sm:text-sm py-2.5 px-4 rounded-lg font-semibold transition-all";
    const settingsAdminTabTriggerClass = "tm-settings-tab data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-200 data-[state=active]:border-amber-400/35 text-amber-500/90 border border-transparent text-xs sm:text-sm py-2.5 px-4 rounded-lg font-semibold transition-all";
    const settingsContentClass = `${tabContentClass} tm-settings-content`;

    if (!isMounted) {
        return (
            <PageWrapper className="tm-settings-shell flex flex-col min-h-screen w-full max-w-none px-4 md:px-6 lg:px-8 pt-6 pb-8">
                <div className="tm-settings-header shrink-0 rounded-xl border border-white/10 bg-white/[0.02] p-4 md:p-5">
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">Settings</h1>
                    <p className="text-sm text-zinc-400 mt-1">Loading workspace settings…</p>
                </div>
            </PageWrapper>
        );
    }

    return (
        <PageWrapper className="tm-settings-shell flex flex-col min-h-screen w-full max-w-none px-4 md:px-6 lg:px-8 pt-6 pb-8">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col flex-1 min-h-0 tm-settings-tabs-root">
                {/* Sticky header: title + tab nav */}
                <div className="tm-settings-header shrink-0 sticky top-0 z-20 bg-background/90 backdrop-blur-xl border-b border-white/8 -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 pt-0 pb-4 mb-4">
                    <div className="flex flex-col gap-1.5 mb-4">
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">Settings</h1>
                        <p className="text-sm text-zinc-400">Connection control, security posture, layout system, and data policy.</p>
                    </div>
                    <TabsList className="tm-settings-tabs inline-flex w-full flex-wrap gap-1 bg-white/[0.035] rounded-xl p-1.5 border border-white/10 h-auto">
                        <TabsTrigger value="general" className={settingsTabTriggerClass}>General</TabsTrigger>
                        <TabsTrigger
                            value="admin"
                            className={cn(settingsAdminTabTriggerClass, !showAdminTab && "opacity-50")}
                            disabled={!showAdminTab}
                            title={showAdminTab ? undefined : "Admin tab is only available for builder account"}
                        >
                            Admin
                        </TabsTrigger>
                        <TabsTrigger value="connections" className={settingsTabTriggerClass}>Connections</TabsTrigger>
                        <TabsTrigger value="journal" className={settingsTabTriggerClass}>Journal</TabsTrigger>
                        <TabsTrigger value="alerts" className={settingsTabTriggerClass}>Alerts</TabsTrigger>
                        <TabsTrigger value="security" className={settingsTabTriggerClass}>Security</TabsTrigger>
                        <TabsTrigger value="preferences" className={settingsTabTriggerClass}>Preferences</TabsTrigger>
                        <TabsTrigger value="appearance" className={settingsTabTriggerClass}>Appearance</TabsTrigger>
                        <TabsTrigger value="social" className={settingsTabTriggerClass}>Social</TabsTrigger>
                        <TabsTrigger value="indian_markets" className={settingsTabTriggerClass}>Indian Markets</TabsTrigger>
                        <TabsTrigger value="data" className={settingsTabTriggerClass}>Data</TabsTrigger>
                        <TabsTrigger value="debug" className={settingsTabTriggerClass}>Debug</TabsTrigger>
                    </TabsList>
                </div>


                {/* --- JOURNAL & PLAYBOOK TAB --- */}
                <TabsContent value="journal" className={settingsContentClass}>
                    <JournalPlaybookSettingsLazy />
                </TabsContent>

                {/* --- ALERTS TAB --- */}
                <TabsContent value="alerts" className={settingsContentClass}>
                    <AlertsSettingsLazy />
                </TabsContent>

                {/* --- DATA EXPORT/IMPORT TAB --- */}
                <TabsContent value="data" className={settingsContentClass}>
                    <ExportImportSettingsLazy />
                </TabsContent>

                {/* --- SECURITY TAB --- */}
                <TabsContent value="security" className={settingsContentClass}>
                    <LicenseSettingsCardLazy />
                    <TradingSecurityCardLazy />
                    <SecurityTab
                        aiProvider={aiProvider}
                        setAiProvider={setAiProvider}
                        openaiApiKey={openaiApiKey}
                        setOpenaiApiKey={setOpenaiApiKey}
                        geminiApiKey={geminiApiKey}
                        setGeminiApiKey={setGeminiApiKey}
                        ollamaBaseUrl={ollamaBaseUrl}
                        setOllamaBaseUrl={setOllamaBaseUrl}
                        ollamaModel={ollamaModel}
                        setOllamaModel={setOllamaModel}
                        showOpenaiKey={showOpenaiKey}
                        setShowOpenaiKey={setShowOpenaiKey}
                        showGeminiKey={showGeminiKey}
                        setShowGeminiKey={setShowGeminiKey}
                        notify={notify}
                    />
                </TabsContent>

                {/* --- GENERAL TAB --- */}
                <TabsContent value="general" className={settingsContentClass}>
                    <CloudSyncCard />
                    <GeneralTab
                        isDemoMode={isDemoMode}
                        toggleDemoMode={toggleDemoMode}
                        autoRefresh={autoRefresh}
                        setAutoRefresh={setAutoRefresh}
                    />
                </TabsContent>

                {/* --- SOCIAL TAB --- */}
                <TabsContent value="social" className={settingsContentClass}>
                    <SocialSettings />
                </TabsContent>

                {/* --- CONNECTIONS TAB --- */}
                <TabsContent value="connections" className={settingsContentClass}>
                    {/* Export/Import Actions */}
                    <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/30 border border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                                <Download className="h-4 w-4 text-indigo-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-white">Backup & Restore</h3>
                                <p className="text-[10px] text-zinc-500">Export all connections to a file or import from backup</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={exportConnections}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold hover:bg-indigo-500/20 transition-colors"
                            >
                                <Download className="h-3.5 w-3.5" />
                                Export
                            </button>
                            <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition-colors cursor-pointer">
                                <Upload className="h-3.5 w-3.5" />
                                Import
                                <input
                                    type="file"
                                    accept=".json"
                                    onChange={importConnections}
                                    className="hidden"
                                />
                            </label>
                        </div>
                    </div>

                    {/* Connection Type Cards - Improved UI with Real Logos */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* CEX Exchanges Card */}
                        <div className="relative group">
                            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity" />
                            <div className="relative p-5 rounded-2xl bg-zinc-900/80 border border-amber-500/20 backdrop-blur-sm">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/30 flex items-center justify-center border border-amber-500/30">
                                        <Server className="h-6 w-6 text-amber-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-white text-lg">CEX Exchanges</h3>
                                        <p className="text-xs text-zinc-400">API-based connections</p>
                                    </div>
                                </div>
                                <p className="text-xs text-zinc-300 mb-4 leading-relaxed">Connect your centralized exchanges via API keys for real-time balance and trade tracking.</p>
                                <div className="flex items-center gap-2">
                                    <CryptoIcon type="exchange" id="binance" size={20} />
                                    <CryptoIcon type="exchange" id="bybit" size={20} />
                                    <CryptoIcon type="exchange" id="hyperliquid" size={20} />
                                    <CryptoIcon type="exchange" id="okx" size={20} />
                                    <span className="text-[10px] text-zinc-400 ml-1">+5 more</span>
                                </div>
                            </div>
                        </div>

                        {/* On-Chain Wallets Card */}
                        <div className="relative group">
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity" />
                            <div className="relative p-5 rounded-2xl bg-zinc-900/80 border border-blue-500/20 backdrop-blur-sm">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center border border-blue-500/30">
                                        <Globe className="h-6 w-6 text-blue-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-white text-lg">On-Chain Wallets</h3>
                                        <p className="text-xs text-zinc-400">Address-based tracking</p>
                                    </div>
                                </div>
                                <p className="text-xs text-zinc-300 mb-4 leading-relaxed">Track any wallet address across 50+ blockchains with Zerion integration.</p>
                                <div className="flex items-center gap-2">
                                    <CryptoIcon type="chain" id="eth" size={20} />
                                    <CryptoIcon type="chain" id="sol" size={20} />
                                    <CryptoIcon type="chain" id="btc" size={20} />
                                    <CryptoIcon type="chain" id="arb" size={20} />
                                    <CryptoIcon type="chain" id="ton" size={20} />
                                    <span className="text-[10px] text-zinc-400 ml-1">+45 chains</span>
                                </div>
                            </div>
                        </div>

                        {/* Hardware Wallets Card */}
                        <div className="relative group">
                            <div className="absolute inset-0 bg-gradient-to-r from-zinc-600/20 to-zinc-700/20 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity" />
                            <div className="relative p-5 rounded-2xl bg-zinc-900/80 border border-zinc-700 backdrop-blur-sm">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center border border-zinc-600">
                                        <Shield className="h-6 w-6 text-zinc-300" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-white text-lg">Hardware Wallets</h3>
                                        <p className="text-xs text-zinc-400">Cold storage tracking</p>
                                    </div>
                                </div>
                                <p className="text-xs text-zinc-300 mb-4 leading-relaxed">Monitor your Ledger, Trezor, or GridPlus cold storage addresses securely.</p>
                                <div className="flex items-center gap-2">
                                    <CryptoIcon type="hardware" id="ledger" size={20} />
                                    <CryptoIcon type="hardware" id="trezor" size={20} />
                                    <CryptoIcon type="hardware" id="gridplus" size={20} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* HARDWARE WALLETS SECTION - Grouped by Device */}
                    <div className="rounded-2xl bg-gradient-to-b from-zinc-900/50 to-zinc-950/30 border border-white/[0.06] overflow-hidden shadow-xl shadow-black/20">
                        <div className="px-5 py-4 border-b border-white/[0.06] bg-gradient-to-r from-zinc-800/50 via-zinc-900/50 to-transparent backdrop-blur-sm">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-gradient-to-br from-zinc-700/50 to-zinc-800/50 border border-white/10">
                                        <Shield className="h-4 w-4 text-zinc-300" />
                                    </div>
                                    <span className="text-sm font-black text-white uppercase tracking-wide">Hardware Wallets</span>
                                </div>
                                <span className="px-3 py-1.5 rounded-full bg-gradient-to-r from-zinc-800/80 to-zinc-700/50 text-zinc-300 text-[10px] font-bold border border-white/10 shadow-inner">
                                    {connections.filter(c => c.hardwareType).length} connected
                                </span>
                            </div>
                            <p className="text-[10px] text-zinc-500 mt-2">Lists are collapsed by default — click a device to expand or collapse.</p>
                        </div>
                        <div className="p-4 space-y-4">
                            {/* Group hardware wallets by device name */}
                            {(() => {
                                const hwWallets = connections.filter(c => c.hardwareType);
                                // Group by device name (e.g., "Trezor Model T", "Ledger Nano X")
                                const grouped = hwWallets.reduce((acc, conn) => {
                                    // Extract base device name (without chain suffix)
                                    const baseName = conn.name.replace(/\s*\(.*?\)\s*$/, '').trim();
                                    const deviceKey = `${conn.hardwareType}-${baseName}`;
                                    if (!acc[deviceKey]) {
                                        acc[deviceKey] = {
                                            name: baseName,
                                            hardwareType: conn.hardwareType,
                                            chains: []
                                        };
                                    }
                                    acc[deviceKey].chains.push(conn);
                                    return acc;
                                }, {} as Record<string, { name: string; hardwareType: string | undefined; chains: typeof hwWallets }>);

                                const deviceGroups = Object.values(grouped);

                                if (deviceGroups.length === 0) {
                                    return (
                                        <div className="text-center py-8 text-zinc-600 text-sm">
                                            No hardware wallets connected
                                        </div>
                                    );
                                }

                                return deviceGroups.map((device, idx) => {
                                    const deviceKey = `${device.hardwareType}-${device.name}`;
                                    const isCollapsed = collapsedHardwareWallets[deviceKey] ?? true;
                                    const isFiltered = hwBalanceFilter[deviceKey];

                                    return (
                                        <div key={deviceKey} className="rounded-xl border border-white/5 bg-gradient-to-b from-zinc-900/50 to-zinc-950/50 overflow-hidden">
                                            {/* Device Header - Clickable to collapse */}
                                            <div
                                                className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/[0.02] cursor-pointer hover:bg-white/[0.04] transition-colors"
                                                onClick={() => toggleHardwareWalletCollapse(deviceKey)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-800 border border-white/10">
                                                        <CryptoIcon type="hardware" id={device.hardwareType || 'ledger'} size={24} />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-white text-sm">{device.name}</h3>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-700/50 text-zinc-400 font-bold uppercase">
                                                                {device.hardwareType}
                                                            </span>
                                                            <span className="text-[9px] text-zinc-500">
                                                                {device.chains.length} chain{device.chains.length !== 1 ? 's' : ''}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {/* Chain icons preview */}
                                                    <div className="flex items-center -space-x-1.5">
                                                        {device.chains.slice(0, 5).map((chain, i) => (
                                                            <div
                                                                key={chain.id || i}
                                                                className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center"
                                                                style={{ zIndex: 5 - i }}
                                                                title={chain.chain}
                                                            >
                                                                <CryptoIcon type="chain" id={chain.chain?.toLowerCase() || 'eth'} size={12} />
                                                            </div>
                                                        ))}
                                                        {device.chains.length > 5 && (
                                                            <div className="w-5 h-5 rounded-full bg-zinc-700 border border-zinc-600 flex items-center justify-center text-[8px] font-bold text-zinc-300">
                                                                +{device.chains.length - 5}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {/* Balance filter button */}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); toggleHwBalanceFilter(deviceKey); }}
                                                        className={cn(
                                                            "p-2 rounded-lg transition-colors",
                                                            isFiltered
                                                                ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/30"
                                                                : "text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                                                        )}
                                                        title={isFiltered ? "Showing $5+ only" : "Show all chains"}
                                                    >
                                                        <DollarSign className="h-4 w-4" />
                                                    </button>
                                                    {/* Edit button to add more chains */}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); startEditHardwareWallet(device.name, device.hardwareType || 'ledger', device.chains); }}
                                                        className="p-2 rounded-lg text-zinc-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                                                        title="Add chain"
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                    </button>
                                                    {/* Collapse indicator */}
                                                    <ChevronDown className={cn(
                                                        "h-4 w-4 text-zinc-500 transition-transform duration-200",
                                                        isCollapsed && "-rotate-90"
                                                    )} />
                                                </div>
                                            </div>

                                            {/* Add Chain Form - Shows when editing this device */}
                                            {editingHardwareWallet?.deviceName === device.name && (
                                                <div className="px-4 py-3 border-b border-white/5 bg-cyan-500/5">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <Plus className="h-3.5 w-3.5 text-cyan-400" />
                                                        <span className="text-xs font-bold text-cyan-400">Add New Chain</span>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                        <div>
                                                            <label className="text-[9px] font-bold text-zinc-500 uppercase mb-1 block">Chain</label>
                                                            <select
                                                                value={newChainForHardware.chain}
                                                                onChange={(e) => setNewChainForHardware({ ...newChainForHardware, chain: e.target.value as SupportedChain })}
                                                                className="w-full px-3 py-2 bg-zinc-900 border border-white/10 rounded-lg text-white text-sm focus:border-cyan-500/50 outline-none"
                                                            >
                                                                <optgroup label="EVM Chains (0x)">
                                                                    <option value="ETH">Ethereum</option>
                                                                    <option value="ARB">Arbitrum</option>
                                                                    <option value="OP">Optimism</option>
                                                                    <option value="BASE">Base</option>
                                                                    <option value="MATIC">Polygon</option>
                                                                    <option value="BSC">BNB Chain</option>
                                                                    <option value="AVAX">Avalanche</option>
                                                                    <option value="FTM">Fantom</option>
                                                                    <option value="LINEA">Linea</option>
                                                                    <option value="SCROLL">Scroll</option>
                                                                    <option value="ZKSYNC">zkSync</option>
                                                                    <option value="BLAST">Blast</option>
                                                                    <option value="GNOSIS">Gnosis</option>
                                                                    <option value="CELO">Celo</option>
                                                                    <option value="CRONOS">Cronos</option>
                                                                    <option value="MANTLE">Mantle</option>
                                                                </optgroup>
                                                                <optgroup label="Non-EVM">
                                                                    <option value="SOL">Solana</option>
                                                                    <option value="BTC">Bitcoin</option>
                                                                    <option value="SUI">Sui</option>
                                                                    <option value="APT">Aptos</option>
                                                                    <option value="TON">TON</option>
                                                                    <option value="TRX">Tron</option>
                                                                    <option value="NEAR">NEAR</option>
                                                                    <option value="COSMOS">Cosmos</option>
                                                                    <option value="HBAR">Hedera</option>
                                                                    <option value="XRP">XRP</option>
                                                                    <option value="ADA">Cardano</option>
                                                                    <option value="DOT">Polkadot</option>
                                                                    <option value="ALGO">Algorand</option>
                                                                </optgroup>
                                                            </select>
                                                        </div>
                                                        <div className="md:col-span-2">
                                                            <label className="text-[9px] font-bold text-zinc-500 uppercase mb-1 block">Wallet Address</label>
                                                            <div className="flex gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={newChainForHardware.address}
                                                                    onChange={(e) => setNewChainForHardware({ ...newChainForHardware, address: e.target.value })}
                                                                    placeholder={`Enter ${newChainForHardware.chain} address...`}
                                                                    className="flex-1 px-3 py-2 bg-zinc-900 border border-white/10 rounded-lg text-white text-sm placeholder:text-zinc-600 focus:border-cyan-500/50 outline-none font-mono"
                                                                />
                                                                <button
                                                                    onClick={addChainToHardwareWallet}
                                                                    className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-black font-bold text-sm rounded-lg transition-colors"
                                                                >
                                                                    {newChainForHardware.addAllEvm && isEvmChain(newChainForHardware.chain) ? 'Add All' : 'Add'}
                                                                </button>
                                                                <button
                                                                    onClick={cancelEditHardwareWallet}
                                                                    className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-sm rounded-lg transition-colors"
                                                                >
                                                                    <X className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Add All EVM Chains Option */}
                                                    {isEvmChain(newChainForHardware.chain) && newChainForHardware.address.startsWith('0x') && (
                                                        <div className="mt-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                                <div className="relative">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={newChainForHardware.addAllEvm}
                                                                        onChange={(e) => setNewChainForHardware({ ...newChainForHardware, addAllEvm: e.target.checked })}
                                                                        className="sr-only peer"
                                                                    />
                                                                    <div className="w-10 h-5 bg-zinc-700 rounded-full peer peer-checked:bg-emerald-500 transition-colors" />
                                                                    <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full peer-checked:translate-x-5 transition-transform" />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <span className="text-sm font-bold text-emerald-400">Add to all EVM chains</span>
                                                                    <p className="text-[10px] text-zinc-400 mt-0.5">
                                                                        Same address works on ETH, ARB, OP, BASE, MATIC, BSC, AVAX, and {EVM_CHAIN_LIST.length - 7} more chains
                                                                    </p>
                                                                </div>
                                                            </label>
                                                            {newChainForHardware.addAllEvm && (
                                                                <div className="mt-2 flex flex-wrap gap-1">
                                                                    {EVM_CHAIN_LIST.filter(c => !editingHardwareWallet.existingChains.includes(c)).slice(0, 12).map(chain => (
                                                                        <span key={chain} className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[9px] text-emerald-400 font-mono">
                                                                            {chain}
                                                                        </span>
                                                                    ))}
                                                                    {EVM_CHAIN_LIST.filter(c => !editingHardwareWallet.existingChains.includes(c)).length > 12 && (
                                                                        <span className="px-1.5 py-0.5 bg-zinc-700 rounded text-[9px] text-zinc-400">
                                                                            +{EVM_CHAIN_LIST.filter(c => !editingHardwareWallet.existingChains.includes(c)).length - 12} more
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {editingHardwareWallet.existingChains.length > 0 && (
                                                        <div className="flex items-center gap-2 mt-3 text-[10px] text-zinc-500">
                                                            <span>Existing chains:</span>
                                                            <div className="flex flex-wrap gap-1">
                                                                {editingHardwareWallet.existingChains.slice(0, 10).map(chain => (
                                                                    <span key={chain} className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400 font-mono">
                                                                        {chain}
                                                                    </span>
                                                                ))}
                                                                {editingHardwareWallet.existingChains.length > 10 && (
                                                                    <span className="px-1.5 py-0.5 bg-zinc-700 rounded text-zinc-400">
                                                                        +{editingHardwareWallet.existingChains.length - 10} more
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Chain List - Collapsible */}
                                            {!isCollapsed && (
                                                <div className="divide-y divide-white/[0.03] animate-in slide-in-from-top-2 duration-200">
                                                    {device.chains
                                                        .filter(conn => {
                                                            // When balance filter is on, only show chains (placeholder - all shown for now since no balance data in settings)
                                                            // In production, this would check actual balance >= $5
                                                            return true; // Show all chains, filter would be applied with actual balance data
                                                        })
                                                        .map((conn) => {
                                                            const status = connectionStatus[conn.id];
                                                            const isEnabled = conn.enabled !== false;
                                                            return (
                                                                <div
                                                                    key={conn.id}
                                                                    className={cn(
                                                                        "flex items-center justify-between px-4 py-2.5 transition-all hover:bg-white/[0.02]",
                                                                        !isEnabled && "opacity-50"
                                                                    )}
                                                                >
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-7 h-7 rounded-lg bg-zinc-800/80 border border-white/5 flex items-center justify-center">
                                                                            <CryptoIcon type="chain" id={conn.chain?.toLowerCase() || 'eth'} size={16} />
                                                                        </div>
                                                                        <div>
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-xs font-bold text-white uppercase">{conn.displayName || conn.chain || 'ETH'}</span>
                                                                                {isEnabled && (
                                                                                    <span className="px-1 py-0.5 rounded text-[7px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                                                        TRACKING
                                                                                    </span>
                                                                                )}
                                                                                {conn.locked && (
                                                                                    <span className="px-1 py-0.5 rounded text-[7px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-0.5">
                                                                                        <Lock className="h-2 w-2" /> LOCKED
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <p className="text-[9px] text-zinc-500 font-mono mt-0.5">
                                                                                {conn.walletAddress ? `${conn.walletAddress.slice(0, 6)}...${conn.walletAddress.slice(-4)}` : '—'}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <LatencyBar latency={status?.latency} status={status?.status} />
                                                                        <div className="flex items-center gap-0.5">
                                                                            <button
                                                                                onClick={() => toggleLockConnection(conn.id)}
                                                                                className={cn(
                                                                                    "p-1.5 rounded-md transition-colors",
                                                                                    conn.locked ? "text-amber-400 bg-amber-500/10" : "text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10"
                                                                                )}
                                                                                title={conn.locked ? "Unlock" : "Lock"}
                                                                            >
                                                                                {conn.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                                                                            </button>
                                                                            <button
                                                                                onClick={() => repairConnection(conn)}
                                                                                disabled={repairingId === conn.id}
                                                                                className={cn(
                                                                                    "p-1.5 rounded-md transition-colors",
                                                                                    repairingId === conn.id ? "text-amber-500 bg-amber-500/10" : "text-zinc-500 hover:text-amber-500 hover:bg-amber-500/10"
                                                                                )}
                                                                                title="Test"
                                                                            >
                                                                                <Wrench className={cn("h-3.5 w-3.5", repairingId === conn.id && "animate-spin")} />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => toggleConnection(conn.id)}
                                                                                className={cn(
                                                                                    "p-1.5 rounded-md transition-colors",
                                                                                    isEnabled ? "text-blue-500 bg-blue-500/10" : "text-zinc-500 bg-zinc-800"
                                                                                )}
                                                                                title={isEnabled ? "Disable" : "Enable"}
                                                                            >
                                                                                <Power className="h-3.5 w-3.5" />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => removeConnection(conn.id)}
                                                                                className={cn(
                                                                                    "p-1.5 rounded-md transition-colors",
                                                                                    conn.locked
                                                                                        ? "text-zinc-700 cursor-not-allowed"
                                                                                        : "text-zinc-500 hover:text-red-500 hover:bg-red-500/10"
                                                                                )}
                                                                                title={conn.locked ? "Unlock to delete" : "Remove"}
                                                                                disabled={conn.locked}
                                                                            >
                                                                                <Trash2 className="h-3.5 w-3.5" />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                </div>
                                            )}

                                            {/* Collapsed summary */}
                                            {isCollapsed && (
                                                <div className="px-4 py-2 text-[10px] text-zinc-500 bg-zinc-900/30">
                                                    {isFiltered ? 'Showing chains with $5+ balance' : `${device.chains.length} chains configured`}
                                                </div>
                                            )}
                                        </div>
                                    )
                                });
                            })()}
                        </div>
                    </div>

                    {/* EXCHANGES SECTION */}
                    <div className="rounded-2xl bg-gradient-to-b from-zinc-900/50 to-zinc-950/30 border border-amber-500/10 overflow-hidden shadow-xl shadow-amber-500/5">
                        <div className="px-5 py-4 border-b border-amber-500/10 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent backdrop-blur-sm">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30">
                                        <Server className="h-4 w-4 text-amber-400" />
                                    </div>
                                    <span className="text-sm font-black text-white uppercase tracking-wide">Exchanges</span>
                                </div>
                                <span className="px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/30 shadow-inner shadow-amber-500/10">
                                    {exchangeConnections.length} connected
                                </span>
                            </div>
                        </div>
                        <div className="p-4 space-y-2">
                            {exchangeConnections.map(conn => {
                                const status = connectionStatus[conn.id];
                                const isEnabled = conn.enabled !== false;
                                const isRenaming = renamingId === conn.id;
                                return (
                                    <div key={conn.id} className={cn(
                                        "group p-4 rounded-xl border transition-all duration-300",
                                        isEnabled
                                            ? "bg-gradient-to-r from-zinc-900/80 to-zinc-950/50 border-white/[0.06] hover:border-amber-500/30 hover:shadow-lg hover:shadow-amber-500/5"
                                            : "bg-zinc-950/50 border-zinc-800/50 opacity-60",
                                        conn.locked && "ring-1 ring-amber-500/30"
                                    )}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="p-2 rounded-xl bg-gradient-to-br from-zinc-800/80 to-zinc-900/80 border border-white/10 group-hover:border-amber-500/20 transition-colors">
                                                    <CryptoIcon type="exchange" id={conn.type} size={28} />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        {isRenaming ? (
                                                            <div className="flex items-center gap-1">
                                                                <input
                                                                    type="text"
                                                                    value={renameValue}
                                                                    onChange={(e) => setRenameValue(e.target.value)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') saveRename(conn.id);
                                                                        if (e.key === 'Escape') cancelRename();
                                                                    }}
                                                                    className="px-2 py-1 bg-zinc-800 border border-white/10 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                                                                    autoFocus
                                                                />
                                                                <button onClick={() => saveRename(conn.id)} className="p-1.5 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors">
                                                                    <Check className="h-4 w-4" />
                                                                </button>
                                                                <button onClick={cancelRename} className="p-1.5 text-zinc-400 hover:bg-zinc-700 rounded-lg transition-colors">
                                                                    <X className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <h3 className="font-bold text-white group-hover:text-amber-100 transition-colors">{conn.displayName || conn.name}</h3>
                                                        )}
                                                        {isEnabled && !isRenaming && (
                                                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-gradient-to-r from-emerald-500/20 to-emerald-400/10 text-emerald-400 font-bold border border-emerald-500/30 shadow-sm shadow-emerald-500/10">LIVE</span>
                                                        )}
                                                        {conn.locked && !isRenaming && (
                                                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-amber-400/10 text-amber-400 font-bold border border-amber-500/30 flex items-center gap-1 shadow-sm shadow-amber-500/10">
                                                                <Lock className="h-2.5 w-2.5" /> LOCKED
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-zinc-500 uppercase mt-0.5 font-medium">{conn.type}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <LatencyBar latency={status?.latency} status={status?.status} />
                                                <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => startRename(conn)} className="p-2 text-zinc-500 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-all hover:scale-105" title="Rename">
                                                        <Pencil className="h-4 w-4" />
                                                    </button>
                                                    <button onClick={() => toggleLockConnection(conn.id)} className={cn("p-2 rounded-lg transition-colors", conn.locked ? "text-amber-400 bg-amber-500/10" : "text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10")} title={conn.locked ? "Unlock" : "Lock"}>
                                                        {conn.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                                                    </button>
                                                    <button onClick={() => repairConnection(conn)} disabled={repairingId === conn.id} className={cn("p-2 rounded-lg transition-colors", repairingId === conn.id ? "text-amber-500 bg-amber-500/10" : "text-zinc-500 hover:text-amber-500 hover:bg-amber-500/10")} title="Test">
                                                        <Wrench className={cn("h-4 w-4", repairingId === conn.id && "animate-spin")} />
                                                    </button>
                                                    <button onClick={() => toggleConnection(conn.id)} className={cn("p-2 rounded-lg transition-colors", isEnabled ? "text-emerald-500 bg-emerald-500/10" : "text-zinc-500 bg-zinc-800")} title={isEnabled ? "Disable" : "Enable"}>
                                                        <Power className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => removeConnection(conn.id)}
                                                        className={cn(
                                                            "p-2 rounded-lg transition-colors",
                                                            conn.locked
                                                                ? "text-zinc-700 cursor-not-allowed"
                                                                : "text-zinc-500 hover:text-red-500 hover:bg-red-500/10"
                                                        )}
                                                        title={conn.locked ? "Unlock to delete" : "Remove"}
                                                        disabled={conn.locked}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                                            <div className="text-[10px] text-zinc-500 font-mono">
                                                {conn.apiKey ? `API: ${conn.apiKey.slice(0, 4)}...${conn.apiKey.slice(-4)}` : conn.walletAddress ? `${conn.walletAddress.slice(0, 6)}...${conn.walletAddress.slice(-4)}` : ''}
                                            </div>
                                            {['binance', 'bybit', 'okx'].includes(conn.type) && (
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <span className="text-[9px] font-bold text-zinc-500 uppercase">Allow Trading</span>
                                                    <Switch
                                                        checked={conn.allowTrading === true}
                                                        onCheckedChange={() => toggleAllowTrading(conn.id)}
                                                    />
                                                </label>
                                            )}
                                        </div>
                                        {status?.status === 'disconnected' && status?.reason && (
                                            <div className="mt-2 text-[10px] text-amber-400/90 border border-amber-500/20 bg-amber-500/5 rounded-lg px-2.5 py-1.5">
                                                {status.reason}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {exchangeConnections.length === 0 && (
                                <div className="text-center py-8 text-zinc-600 text-sm">
                                    No exchanges connected yet
                                </div>
                            )}
                        </div>
                    </div>

                    {/* WALLETS SECTION */}
                    <div className="rounded-2xl bg-gradient-to-b from-zinc-900/50 to-zinc-950/30 border border-blue-500/10 overflow-hidden shadow-xl shadow-blue-500/5">
                        <div className="px-5 py-4 border-b border-blue-500/10 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent backdrop-blur-sm">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30">
                                        <Globe className="h-4 w-4 text-blue-400" />
                                    </div>
                                    <span className="text-sm font-black text-white uppercase tracking-wide">Wallets</span>
                                </div>
                                <span className="px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-500/20 to-indigo-500/10 text-blue-400 text-[10px] font-bold border border-blue-500/30 shadow-inner shadow-blue-500/10">
                                    {walletConnections.length} connected
                                </span>
                            </div>
                        </div>
                        <div className="p-4 space-y-2">
                            {walletConnections.map(conn => {
                                const status = connectionStatus[conn.id];
                                const isEnabled = conn.enabled !== false;
                                return (
                                    <div key={conn.id} className={cn(
                                        "p-4 rounded-xl border transition-all hover:bg-white/[0.02]",
                                        isEnabled ? "bg-white/[0.01] border-white/5" : "bg-zinc-950/50 border-zinc-800 opacity-60"
                                    )}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <CryptoIcon type="chain" id={(conn.chain || conn.type).toLowerCase()} />
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        {renamingId === conn.id ? (
                                                            <div className="flex items-center gap-1">
                                                                <input
                                                                    type="text"
                                                                    value={renameValue}
                                                                    onChange={(e) => setRenameValue(e.target.value)}
                                                                    className="px-2 py-1 bg-zinc-800 border border-zinc-600 rounded text-xs text-white w-32"
                                                                    autoFocus
                                                                    onKeyDown={(e) => e.key === 'Enter' && saveRename(conn.id)}
                                                                />
                                                                <button onClick={() => saveRename(conn.id)} className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded">
                                                                    <Check className="h-4 w-4" />
                                                                </button>
                                                                <button onClick={cancelRename} className="p-1 text-zinc-400 hover:bg-zinc-700 rounded">
                                                                    <X className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <h3 className="font-bold text-white">{conn.displayName || conn.name}</h3>
                                                        )}
                                                        {isEnabled && renamingId !== conn.id && (
                                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30">TRACKING</span>
                                                        )}
                                                        {conn.locked && renamingId !== conn.id && (
                                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30 flex items-center gap-0.5">
                                                                <Lock className="h-2.5 w-2.5" /> LOCKED
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-zinc-500 uppercase mt-0.5">{conn.type} {conn.chain ? `• ${conn.chain}` : ''}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <LatencyBar latency={status?.latency} status={status?.status} />
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => startRename(conn)} className="p-2 text-zinc-500 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors" title="Rename">
                                                        <Pencil className="h-4 w-4" />
                                                    </button>
                                                    <button onClick={() => toggleLockConnection(conn.id)} className={cn("p-2 rounded-lg transition-colors", conn.locked ? "text-amber-400 bg-amber-500/10" : "text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10")} title={conn.locked ? "Unlock" : "Lock"}>
                                                        {conn.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                                                    </button>
                                                    <button onClick={() => repairConnection(conn)} disabled={repairingId === conn.id} className={cn("p-2 rounded-lg transition-colors", repairingId === conn.id ? "text-amber-500 bg-amber-500/10" : "text-zinc-500 hover:text-amber-500 hover:bg-amber-500/10")} title="Test">
                                                        <Wrench className={cn("h-4 w-4", repairingId === conn.id && "animate-spin")} />
                                                    </button>
                                                    <button onClick={() => toggleConnection(conn.id)} className={cn("p-2 rounded-lg transition-colors", isEnabled ? "text-blue-500 bg-blue-500/10" : "text-zinc-500 bg-zinc-800")} title={isEnabled ? "Disable" : "Enable"}>
                                                        <Power className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => removeConnection(conn.id)}
                                                        className={cn(
                                                            "p-2 rounded-lg transition-colors",
                                                            conn.locked
                                                                ? "text-zinc-700 cursor-not-allowed"
                                                                : "text-zinc-500 hover:text-red-500 hover:bg-red-500/10"
                                                        )}
                                                        title={conn.locked ? "Unlock to delete" : "Remove"}
                                                        disabled={conn.locked}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                                            <div className="text-[10px] text-zinc-500 font-mono">
                                                {conn.walletAddress ? `${conn.walletAddress.slice(0, 8)}...${conn.walletAddress.slice(-6)}` : ''}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {walletConnections.length === 0 && (
                                <div className="text-center py-8 text-zinc-600 text-sm">
                                    No wallets connected yet
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ADD CONNECTION */}
                    {!isAdding ? (
                        <button
                            onClick={() => setIsAdding(true)}
                            className="relative w-full py-10 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-muted-foreground hover:border-indigo-500/50 hover:text-indigo-400 transition-all group overflow-hidden"
                        >
                            {/* Hover background glow */}
                            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-indigo-500/5 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.1)_0%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity" />

                            <div className="relative z-10 flex flex-col items-center">
                                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-zinc-800/80 to-zinc-900/80 border border-white/10 flex items-center justify-center group-hover:scale-110 group-hover:bg-gradient-to-br group-hover:from-indigo-500/30 group-hover:to-purple-500/30 group-hover:border-indigo-500/40 group-hover:shadow-xl group-hover:shadow-indigo-500/20 transition-all duration-300 mb-4">
                                    <Plus className="h-7 w-7 group-hover:rotate-90 transition-transform duration-300" />
                                </div>
                                <span className="font-black text-sm group-hover:text-indigo-300 transition-colors">Add New Connection</span>
                                <span className="text-[10px] text-zinc-500 mt-1 group-hover:text-indigo-400/60 transition-colors">Exchange, Wallet, or Hardware</span>
                            </div>
                        </button>
                    ) : (
                        <Card className="bg-zinc-950 border-primary/50 ring-1 ring-primary/20 animate-in fade-in slide-in-from-bottom-2">
                            <CardHeader className="pb-4">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base">Add Connection</CardTitle>
                                    <button onClick={() => setIsAdding(false)} className="text-zinc-500 hover:text-white"><XCircle className="h-5 w-5" /></button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Connection Type Selection */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 font-mono">Connection Type</label>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {[
                                            { value: 'binance', label: 'Binance', desc: 'Spot & Futures' },
                                            { value: 'bybit', label: 'Bybit', desc: 'Spot & Derivatives' },
                                            { value: 'hyperliquid', label: 'Hyperliquid', desc: 'Perps DEX' },
                                            { value: 'okx', label: 'OKX', desc: 'Spot & Futures' },
                                            { value: 'kucoin', label: 'KuCoin', desc: 'Spot Trading' },
                                            { value: 'kraken', label: 'Kraken', desc: 'Spot & Futures' },
                                            { value: 'gate', label: 'Gate.io', desc: 'Spot Trading' },
                                            { value: 'bitget', label: 'Bitget', desc: 'Spot & Copy' },
                                            { value: 'mexc', label: 'MEXC', desc: 'Spot Trading' },
                                            { value: 'zerion', label: 'Zerion', desc: '50+ chains' },
                                            { value: 'wallet', label: 'Wallet', iconId: 'eth', desc: 'ETH/SOL/etc' },
                                            { value: 'ledger', label: 'Ledger', desc: 'Cold Storage' },
                                            { value: 'trezor', label: 'Trezor', desc: 'Cold Storage' },
                                            { value: 'gridplus', label: 'GridPlus', desc: 'Lattice1' },
                                        ].map(opt => (
                                            <button
                                                key={opt.value}
                                                onClick={() => {
                                                    if (['ledger', 'trezor', 'gridplus'].includes(opt.value)) {
                                                        setNewConnection({ ...newConnection, type: 'wallet', chain: 'ETH', hardwareType: opt.value as any });
                                                    } else {
                                                        setNewConnection({ ...newConnection, type: opt.value as any, chain: opt.value === 'wallet' ? 'ETH' : undefined, hardwareType: undefined });
                                                    }
                                                }}
                                                className={cn(
                                                    "p-3 rounded-xl border text-left transition-all group",
                                                    (['ledger', 'trezor', 'gridplus'].includes(opt.value)
                                                        ? newConnection.hardwareType === opt.value
                                                        : opt.value === 'wallet'
                                                            ? newConnection.type === 'wallet' && !newConnection.hardwareType
                                                            : newConnection.type === opt.value)
                                                        ? "border-indigo-500/50 bg-indigo-500/10 ring-1 ring-indigo-500/20"
                                                        : "border-white/5 bg-white/[0.02] hover:border-white/20 hover:bg-white/5"
                                                )}
                                            >
                                                <div className="mb-2">
                                                    <CryptoIcon
                                                        type={
                                                            ['ledger', 'trezor', 'gridplus'].includes(opt.value)
                                                                ? 'hardware'
                                                                : ['binance', 'bybit', 'hyperliquid', 'okx', 'kucoin', 'kraken', 'gate', 'bitget', 'mexc'].includes(opt.value)
                                                                    ? 'exchange'
                                                                    : 'chain'
                                                        }
                                                        id={opt.iconId || opt.value}
                                                        size={24}
                                                    />
                                                </div>
                                                <div className="text-xs font-bold text-white">{opt.label}</div>
                                                <div className="text-[10px] text-zinc-500">{opt.desc}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Connection Name */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 font-mono">Name (Label)</label>
                                    <input
                                        type="text"
                                        placeholder={
                                            newConnection.type === 'binance' ? 'e.g. Binance Main, Trading Account' :
                                                newConnection.type === 'bybit' ? 'e.g. Bybit Futures, Scalping Account' :
                                                    newConnection.type === 'hyperliquid' ? 'e.g. Hyperliquid Perps, Main Wallet' :
                                                        newConnection.type === 'zerion' ? 'e.g. DeFi Portfolio, Main Wallet' :
                                                            'e.g. ETH Wallet, Cold Storage'
                                        }
                                        className="w-full bg-zinc-900/50 border border-white/5 rounded-lg p-3 text-white text-sm focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-zinc-600"
                                        value={newConnection.name}
                                        onChange={(e) => setNewConnection({ ...newConnection, name: e.target.value })}
                                    />
                                </div>

                                {/* Exchange-specific: API Keys */}
                                {(newConnection.type === 'binance' || newConnection.type === 'bybit') && (
                                    <>
                                        {/* Hint Box */}
                                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                            <div className="flex items-start gap-2">
                                                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                                                <div>
                                                    <p className="text-xs text-amber-200 font-bold mb-1">
                                                        {newConnection.type === 'binance' ? 'Binance API Setup' : 'Bybit API Setup'}
                                                    </p>
                                                    <p className="text-[11px] text-zinc-300">
                                                        {newConnection.type === 'binance'
                                                            ? 'Go to Binance → Profile → API Management → Create API. Enable "Read" permissions only. IP whitelist recommended.'
                                                            : 'Go to Bybit → Account → API → Create New Key. Select "Read-Only" for security. Enable IP restrictions.'
                                                        }
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 font-mono">API Key</label>
                                                <div className="relative group">
                                                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 group-focus-within:text-indigo-400 transition-colors" />
                                                    <input
                                                        type="text"
                                                        placeholder={newConnection.type === 'binance' ? 'e.g. vmPUZE6mv9SD5VNHk4...' : 'e.g. aBc1DeF2gHi3jKl4mN...'}
                                                        className="w-full bg-zinc-900/50 border border-white/5 rounded-lg py-3 pl-10 pr-3 text-white font-mono text-sm focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-zinc-700"
                                                        value={newConnection.apiKey || ''}
                                                        onChange={(e) => setNewConnection({ ...newConnection, apiKey: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 font-mono">API Secret</label>
                                                <div className="relative group">
                                                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 group-focus-within:text-indigo-400 transition-colors" />
                                                    <input
                                                        type="password"
                                                        placeholder="Your API secret (hidden)"
                                                        className="w-full bg-zinc-900/50 border border-white/5 rounded-lg py-3 pl-10 pr-3 text-white font-mono text-sm focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-zinc-700"
                                                        value={newConnection.secret || ''}
                                                        onChange={(e) => setNewConnection({ ...newConnection, secret: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* Hyperliquid: Wallet Address */}
                                {newConnection.type === 'hyperliquid' && (
                                    <>
                                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                            <div className="flex items-start gap-2">
                                                <Zap className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                                                <div>
                                                    <p className="text-xs text-emerald-200 font-bold mb-1">Hyperliquid Setup</p>
                                                    <p className="text-[11px] text-zinc-300">
                                                        Enter your Arbitrum wallet address used with Hyperliquid. No API keys needed - we read your positions directly from the chain.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 font-mono">Arbitrum Wallet Address</label>
                                            <div className="relative group">
                                                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 group-focus-within:text-emerald-400 transition-colors" />
                                                <input
                                                    type="text"
                                                    placeholder="0x742d35Cc6634C0532925a3b844..."
                                                    className="w-full bg-zinc-900/50 border border-white/5 rounded-lg py-3 pl-10 pr-3 text-white font-mono text-sm focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-zinc-700"
                                                    value={newConnection.walletAddress || ''}
                                                    onChange={(e) => setNewConnection({ ...newConnection, walletAddress: e.target.value })}
                                                />
                                            </div>
                                            <p className="text-[10px] text-zinc-500">Example: 0x742d35Cc6634C0532925a3b844Bc454e4438f44e</p>
                                        </div>
                                    </>
                                )}

                                {/* Zerion: Multi-chain wallet */}
                                {newConnection.type === 'zerion' && (
                                    <>
                                        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                            <div className="flex items-start gap-2">
                                                <Globe className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                                                <div>
                                                    <p className="text-xs text-blue-200 font-bold mb-1">Zerion Multi-Chain Tracking</p>
                                                    <p className="text-[11px] text-zinc-300">
                                                        Enter any EVM wallet address to track across 50+ chains including Ethereum, Polygon, Arbitrum, Optimism, Base, Avalanche, and more. Also supports Solana addresses!
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 font-mono">Wallet Address (Any Chain)</label>
                                            <div className="relative group">
                                                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 group-focus-within:text-blue-400 transition-colors" />
                                                <input
                                                    type="text"
                                                    placeholder="0x... or So1ana..."
                                                    className="w-full bg-zinc-900/50 border border-white/5 rounded-lg py-3 pl-10 pr-3 text-white font-mono text-sm focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all placeholder:text-zinc-700"
                                                    value={newConnection.walletAddress || ''}
                                                    onChange={(e) => setNewConnection({ ...newConnection, walletAddress: e.target.value })}
                                                />
                                            </div>
                                            <div className="flex gap-3 text-[10px] text-zinc-500">
                                                <span>EVM: 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045</span>
                                                <span>SOL: 5ZWj7a1f8tWkjBESHKgrLmXshuXxqeY9SYcfbshpAqPG</span>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* Single Chain Wallet */}
                                {newConnection.type === 'wallet' && (
                                    <>
                                        <div className={cn("p-3 border rounded-lg", newConnection.hardwareType ? "bg-indigo-500/10 border-indigo-500/20" : "bg-purple-500/10 border-purple-500/20")}>
                                            <div className="flex items-start gap-2">
                                                {newConnection.hardwareType ? <Shield className="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" /> : <Globe className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />}
                                                <div>
                                                    <p className={cn("text-xs font-bold mb-1", newConnection.hardwareType ? "text-indigo-200" : "text-purple-200")}>
                                                        {newConnection.hardwareType ? `Hardware Wallet Setup (${newConnection.hardwareType.charAt(0).toUpperCase() + newConnection.hardwareType.slice(1)})` : 'Single Chain Wallet'}
                                                    </p>
                                                    <p className="text-[11px] text-zinc-300">
                                                        {newConnection.hardwareType
                                                            ? "Enter your EVM address (e.g. 0x...) to automatically track balances across Ethereum, Arbitrum, Optimism, Base, and all other supported EVM chains."
                                                            : "Paste your wallet address and we’ll detect the chain. You can change it below if needed."
                                                        }
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 font-mono">Wallet Address</label>
                                            <div className="relative group">
                                                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 group-focus-within:text-purple-400 transition-colors" />
                                                <input
                                                    type="text"
                                                    placeholder={
                                                        newConnection.chain === 'SOL'
                                                            ? '5ZWj7a1f8tWkjBESHKgrLmXshuXxqeY9SYcfbshpAqPG'
                                                            : newConnection.chain === 'BTC'
                                                                ? 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
                                                                : newConnection.chain === 'HBAR'
                                                                    ? '0.0.123456'
                                                                    : newConnection.chain === 'TON'
                                                                        ? 'EQC3...TonWalletAddress'
                                                                        : newConnection.chain === 'TRX'
                                                                            ? 'TXYZ1234abcd...'
                                                                            : newConnection.chain === 'XRP'
                                                                                ? 'rBZ3tYDXe3xkZ2Z7YdC...'
                                                                                : '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
                                                    }
                                                    className="w-full bg-zinc-900/50 border border-white/5 rounded-lg py-3 pl-10 pr-3 text-white font-mono text-sm focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 outline-none transition-all placeholder:text-zinc-700"
                                                    value={newConnection.walletAddress || ''}
                                                    onChange={(e) => {
                                                        const trimmed = e.target.value.trim();
                                                        const next = { ...newConnection, walletAddress: e.target.value };
                                                        if (trimmed.length >= 26) {
                                                            const detected = detectChainFromAddress(e.target.value);
                                                            if (detected) next.chain = detected;
                                                        }
                                                        setNewConnection(next);
                                                    }}
                                                />
                                            </div>
                                            <p className="text-[10px] text-zinc-500">
                                                {newConnection.chain === 'SOL'
                                                    ? 'Solana addresses are Base58 encoded, typically 32-44 characters'
                                                    : newConnection.chain === 'BTC'
                                                        ? 'Bitcoin addresses usually start with 1, 3 or bc1 and vary from 26-62 characters'
                                                        : newConnection.chain === 'HBAR'
                                                            ? 'Hedera account IDs are in the format shard.realm.num, e.g. 0.0.123456'
                                                            : newConnection.chain === 'TON'
                                                                ? 'TON wallet addresses typically start with EQ or UQ and are Base64url encoded'
                                                                : newConnection.chain === 'TRX'
                                                                    ? 'Tron addresses start with T and are 34 characters long'
                                                                    : newConnection.chain === 'XRP'
                                                                        ? 'XRP classic addresses start with r and are usually 25-35 characters long'
                                                                        : newConnection.chain === 'APT'
                                                                            ? 'Aptos addresses are 0x-prefixed and typically 66 characters (32-byte hex account address)'
                                                                            : 'EVM-style chains (ETH, ARB, OP, BASE, MATIC, AVAX, BSC) use 0x + 40 hex characters'
                                                }
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 font-mono">Chain</label>
                                            {showChainSelect ? (
                                                <>
                                                    <select
                                                        className="w-full bg-zinc-900/50 border border-white/5 rounded-lg p-3 text-white text-sm focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 outline-none transition-all"
                                                        value={newConnection.chain || 'ETH'}
                                                        onChange={(e) => {
                                                            setNewConnection({ ...newConnection, chain: e.target.value as SupportedChain });
                                                            setShowChainSelect(false);
                                                        }}
                                                    >
                                                        <optgroup label="EVM Chains (0x addresses)">
                                                            <option value="ETH">Ethereum</option>
                                                            <option value="ARB">Arbitrum</option>
                                                            <option value="OP">Optimism</option>
                                                            <option value="BASE">Base</option>
                                                            <option value="MATIC">Polygon</option>
                                                            <option value="BSC">BNB Chain</option>
                                                            <option value="AVAX">Avalanche</option>
                                                            <option value="FTM">Fantom</option>
                                                            <option value="LINEA">Linea</option>
                                                            <option value="SCROLL">Scroll</option>
                                                            <option value="ZKSYNC">zkSync</option>
                                                            <option value="BLAST">Blast</option>
                                                            <option value="GNOSIS">Gnosis</option>
                                                            <option value="CELO">Celo</option>
                                                            <option value="CRONOS">Cronos</option>
                                                            <option value="MANTLE">Mantle</option>
                                                        </optgroup>
                                                        <optgroup label="Non-EVM Chains">
                                                            <option value="SOL">Solana</option>
                                                            <option value="BTC">Bitcoin</option>
                                                            <option value="SUI">Sui</option>
                                                            <option value="APT">Aptos</option>
                                                            <option value="TON">TON</option>
                                                            <option value="TRX">Tron</option>
                                                            <option value="NEAR">NEAR</option>
                                                            <option value="COSMOS">Cosmos</option>
                                                            <option value="HBAR">Hedera</option>
                                                            <option value="XRP">XRP</option>
                                                            <option value="ADA">Cardano</option>
                                                            <option value="DOT">Polkadot</option>
                                                            <option value="ALGO">Algorand</option>
                                                            <option value="KAVA">Kava</option>
                                                            <option value="INJ">Injective</option>
                                                        </optgroup>
                                                        <optgroup label="Legacy Chains">
                                                            <option value="DOGE">Dogecoin (DOGE) - D...</option>
                                                            <option value="LTC">Litecoin (LTC) - L...</option>
                                                            <option value="BCH">Bitcoin Cash (BCH)</option>
                                                        </optgroup>
                                                    </select>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowChainSelect(false)}
                                                        className="text-[10px] text-zinc-500 hover:text-zinc-300"
                                                    >
                                                        Done
                                                    </button>
                                                </>
                                            ) : (
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-sm text-zinc-300">
                                                        {newConnection.chain ? CHAIN_DISPLAY_NAMES[newConnection.chain] : 'Ethereum'}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowChainSelect(true)}
                                                        className="text-[10px] text-purple-400 hover:text-purple-300 font-medium"
                                                    >
                                                        Change
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Track on all EVM chains - only when chain is EVM */}
                                        {(newConnection.chain || 'ETH') && ['ETH', 'ARB', 'OP', 'BASE', 'MATIC', 'BSC', 'AVAX', 'FTM', 'LINEA', 'SCROLL', 'ZKSYNC', 'BLAST', 'GNOSIS', 'CELO', 'CRONOS', 'MANTLE', 'KAVA'].includes(newConnection.chain || 'ETH') && (
                                            <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                                                <label className="flex items-center gap-3 cursor-pointer group">
                                                    <div className="relative">
                                                        <input
                                                            type="checkbox"
                                                            checked={trackAllEvmChains}
                                                            onChange={(e) => setTrackAllEvmChains(e.target.checked)}
                                                            className="sr-only peer"
                                                        />
                                                        <div className="w-10 h-5 bg-zinc-700 rounded-full peer peer-checked:bg-emerald-500 transition-colors" />
                                                        <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full peer peer-checked:translate-x-5 transition-transform" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <span className="text-sm font-bold text-emerald-400">Track on all EVM chains</span>
                                                        <p className="text-[10px] text-zinc-400 mt-0.5">
                                                            Same address works on Ethereum, Arbitrum, Base, Polygon, BNB, Avalanche, and 11+ more chains. We’ll fetch balances for all of them.
                                                        </p>
                                                    </div>
                                                </label>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Manual Wallet Configuration */}
                                {newConnection.type === 'manual' && (
                                    <>
                                        <div className="p-3 bg-zinc-500/10 border border-zinc-500/20 rounded-lg">
                                            <div className="flex items-start gap-2">
                                                <Edit className="h-4 w-4 text-zinc-400 mt-0.5 shrink-0" />
                                                <div>
                                                    <p className="text-xs text-zinc-200 font-bold mb-1">Manual Wallet Setup</p>
                                                    <p className="text-[11px] text-zinc-400">
                                                        Create a container for your offline assets. You can manually add transactions to this wallet later.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 font-mono">Hardware Type (Optional)</label>
                                            <select
                                                className="w-full bg-zinc-900/50 border border-white/5 rounded-lg p-3 text-white text-sm focus:border-zinc-500/50 focus:ring-1 focus:ring-zinc-500/20 outline-none transition-all"
                                                value={newConnection.hardwareType || ''}
                                                onChange={(e) => setNewConnection({ ...newConnection, hardwareType: e.target.value as any })}
                                            >
                                                <option value="">None / Other</option>
                                                <option value="ledger">Ledger</option>
                                                <option value="trezor">Trezor</option>
                                                <option value="gridplus">GridPlus</option>
                                                <option value="tangem">Tangem</option>
                                                <option value="onekey">OneKey</option>
                                            </select>
                                        </div>
                                    </>
                                )}

                                <div className="flex justify-end gap-2 pt-4 border-t border-white/5 mt-4">
                                    <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors">Cancel</button>
                                    <button
                                        onClick={addConnection}
                                        disabled={!newConnection.name}
                                        className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white px-6 py-2.5 rounded-lg font-bold text-sm transition-colors shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Add Connection
                                    </button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Sticky Save Footer */}
                    <div className="sticky bottom-0 left-0 right-0 p-4 -mx-4 -mb-4 bg-gradient-to-t from-zinc-950 via-zinc-950/98 to-transparent backdrop-blur-sm">
                        <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/80 border border-white/[0.06] shadow-xl shadow-black/30">
                            <div className="flex items-center gap-3">
                                <div className="relative flex items-center justify-center">
                                    <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-md animate-pulse" />
                                    <div className="relative p-2 rounded-full bg-gradient-to-br from-emerald-500/30 to-emerald-600/20 border border-emerald-500/40">
                                        <Activity className="h-4 w-4 text-emerald-400" />
                                    </div>
                                </div>
                                <div>
                                    <span className="text-white font-bold text-sm">{connections.filter(c => c.enabled !== false).length} active connections</span>
                                    <p className="text-[10px] text-zinc-500">Syncing in real-time</p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    persistConnections(connections);
                                    notify({
                                        type: 'success',
                                        title: 'Connections Saved',
                                        message: 'All connection settings have been saved',
                                        duration: 2000
                                    });
                                }}
                                className="relative group flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white text-sm font-bold transition-all shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:scale-[1.02]"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 rounded-xl transition-opacity" />
                                <Save className="h-4 w-4 relative z-10" />
                                <span className="relative z-10">Save Changes</span>
                            </button>
                        </div>
                    </div>
                </TabsContent>

                {/* --- PREFERENCES TAB (ADVANCED) --- */}
                <TabsContent value="preferences" className={settingsContentClass}>
                    {/* Spot orders – average price (custom date/time range) */}
                    <div className="mb-6">
                        <SpotAvgPriceSettingsLazy />
                    </div>
                    {/* Visual Preferences */}
                    <Card className="bg-card/50 backdrop-blur-xl border-border">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Search className="h-4 w-4 text-zinc-400" />
                                Display Preferences
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Dust Threshold */}
                            <div className="space-y-3">
                                <label className="text-xs font-bold uppercase text-zinc-500">Dust Threshold ($)</label>
                                <div className="flex gap-4 items-center">
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="bg-black/40 border border-white/10 rounded p-3 text-white text-sm w-32 focus:border-primary/50 outline-none"
                                        value={dustThreshold}
                                        onChange={(e) => setDustThreshold(parseFloat(e.target.value) || 0)}
                                    />
                                    <p className="text-xs text-muted-foreground">Balances below this value will be hidden from Spot/Overview.</p>
                                </div>
                            </div>

                            {/* Hide Spam */}
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <label className="text-sm font-medium text-zinc-200">Hide Spam Assets</label>
                                    <p className="text-xs text-muted-foreground">Automatically filter out known spam tokens and scam NFTs.</p>
                                </div>
                                <button
                                    onClick={() => setHideSpam(!hideSpam)}
                                    className={cn(
                                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                                        hideSpam ? "bg-emerald-500" : "bg-zinc-700"
                                    )}
                                >
                                    <span className={cn("inline-block h-3 w-3 transform rounded-full bg-white transition-transform", hideSpam ? "translate-x-5" : "translate-x-1")} />
                                </button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Transaction Filters */}
                    <Card className="bg-card/50 backdrop-blur-xl border-border">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Filter className="h-4 w-4 text-zinc-400" />
                                Transaction Filter Defaults
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-3">
                                <label className="text-xs font-bold uppercase text-zinc-500">Visible Types</label>
                                <div className="flex flex-wrap gap-2">
                                    {['buy', 'sell', 'transfer'].map(type => (
                                        <button
                                            key={type}
                                            onClick={() => toggleTransactionType(type)}
                                            className={cn(
                                                "px-4 py-2 rounded-lg border text-xs font-bold uppercase transition-all",
                                                filters.transactionTypes.includes(type)
                                                    ? "border-primary bg-primary/20 text-primary"
                                                    : "border-white/10 bg-white/5 text-zinc-500 hover:border-white/20"
                                            )}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="text-xs font-bold uppercase text-zinc-500">Min Transaction ($)</label>
                                    <input
                                        type="number"
                                        className="w-full bg-black/40 border border-white/10 rounded p-3 text-white text-sm focus:border-primary/50 outline-none"
                                        value={filters.minAmount}
                                        onChange={(e) => setFilters({ ...filters, minAmount: parseFloat(e.target.value) || 0 })}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-xs font-bold uppercase text-zinc-500">Default Date Range</label>
                                    <select
                                        className="w-full bg-black/40 border border-white/10 rounded p-3 text-white text-sm focus:border-primary/50 outline-none"
                                        value={filters.dateRange}
                                        onChange={(e) => setFilters({ ...filters, dateRange: e.target.value as any })}
                                    >
                                        <option value="all">All Time</option>
                                        <option value="7d">Last 7 Days</option>
                                        <option value="30d">Last 30 Days</option>
                                        <option value="90d">Last 90 Days</option>
                                    </select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- APPEARANCE TAB --- */}
                <TabsContent value="appearance" className={settingsContentClass}>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-violet-500/20 border border-violet-500/30">
                                <Palette className="h-4 w-4 text-violet-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white tracking-tight">Appearance</h2>
                                <p className="text-[11px] text-zinc-500 mt-0.5">Colors, theme, borders, fonts, sidebar & glow for the whole app</p>
                            </div>
                        </div>
                    </div>

                    {/* Theme templates – one click for whole project */}
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                            <LayoutGrid className="h-4 w-4 text-violet-400" />
                            <span className="text-sm font-bold text-white">Theme templates</span>
                        </div>
                        <div className="p-4">
                            <p className="text-[11px] text-zinc-500 mb-4">Apply a full theme (colors, sidebar, glow, glass, gradient) across the app in one click.</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                {THEME_TEMPLATES.map((tpl) => (
                                    <button
                                        key={tpl.id}
                                        type="button"
                                        onClick={() => updateAppearance(tpl.settings)}
                                        className={cn(
                                            "flex flex-col items-start p-4 rounded-xl border text-left transition-all",
                                            "bg-white/[0.02] border-white/10 hover:bg-white/5 hover:border-white/20"
                                        )}
                                    >
                                        <div className="flex items-center gap-2 w-full mb-2">
                                            <div
                                                className="w-3 h-3 rounded-full shrink-0 border border-white/20"
                                                style={{ backgroundColor: tpl.accentColor }}
                                            />
                                            <span className="text-sm font-bold text-white truncate">{tpl.name}</span>
                                        </div>
                                        {tpl.description && (
                                            <p className="text-[10px] text-zinc-500 line-clamp-2">{tpl.description}</p>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Theme */}
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                            <Settings2 className="h-4 w-4 text-violet-400" />
                            <span className="text-sm font-bold text-white">Theme</span>
                        </div>
                        <div className="p-4">
                            <div className="flex flex-wrap gap-2">
                                {(["dark", "light"] as ThemeMode[]).map((mode) => (
                                    <button
                                        key={mode}
                                        onClick={() => updateAppearance({ theme: mode })}
                                        className={cn(
                                            "px-4 py-2.5 rounded-lg text-sm font-bold capitalize transition-all",
                                            appearance.theme === mode ? "bg-violet-500 text-white" : "bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10"
                                        )}
                                    >
                                        {mode}
                                    </button>
                                ))}
                            </div>
                            <div className="mt-4">
                                <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">UI Style</label>
                                <div className="flex flex-wrap gap-2">
                                    {(["default", "neo-minimal", "clone-exact"] as UiThemeMode[]).map((mode) => (
                                        <button
                                            key={mode}
                                            onClick={() => updateAppearance({ uiTheme: mode })}
                                            className={cn(
                                                "px-4 py-2.5 rounded-lg text-sm font-bold transition-all",
                                                appearance.uiTheme === mode ? "bg-violet-500 text-white" : "bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10"
                                            )}
                                        >
                                            {mode === "clone-exact" ? "Clone Exact (Legacy)" : mode === "neo-minimal" ? "Neo Minimal" : "Default"}
                                        </button>
                                    ))}
                                </div>
                                <p className="mt-2 text-[10px] text-zinc-500">`clone-exact` remains as rollback fallback and is not recommended for active use.</p>
                            </div>
                            <div className="mt-4">
                                <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">Page Skin Rollout</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                                        <p className="text-xs font-bold text-white mb-2">Journal</p>
                                        <div className="flex gap-2">
                                            {(["legacy", "neo"] as PageSkinMode[]).map((mode) => (
                                                <button
                                                    key={`journal-${mode}`}
                                                    onClick={() =>
                                                        updateAppearance({
                                                            pageSkin: {
                                                                journal: mode,
                                                                futures: appearance.pageSkin?.futures ?? "legacy",
                                                            },
                                                        })
                                                    }
                                                    className={cn(
                                                        "px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all",
                                                        (appearance.pageSkin?.journal ?? "legacy") === mode
                                                            ? "bg-violet-500 text-white"
                                                            : "bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10"
                                                    )}
                                                >
                                                    {mode}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                                        <p className="text-xs font-bold text-white mb-2">Futures</p>
                                        <div className="flex gap-2">
                                            {(["legacy", "neo"] as PageSkinMode[]).map((mode) => (
                                                <button
                                                    key={`futures-${mode}`}
                                                    onClick={() =>
                                                        updateAppearance({
                                                            pageSkin: {
                                                                journal: appearance.pageSkin?.journal ?? "legacy",
                                                                futures: mode,
                                                            },
                                                        })
                                                    }
                                                    className={cn(
                                                        "px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all",
                                                        (appearance.pageSkin?.futures ?? "legacy") === mode
                                                            ? "bg-violet-500 text-white"
                                                            : "bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10"
                                                    )}
                                                >
                                                    {mode}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Colors */}
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                            <Palette className="h-4 w-4 text-sky-400" />
                            <span className="text-sm font-bold text-white">Colors</span>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">Background</label>
                                    <div className="flex gap-2 items-center">
                                        <input type="color" value={appearance.background} onChange={(e) => updateAppearance({ background: e.target.value })} className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer" />
                                        <input type="text" value={appearance.background} onChange={(e) => updateAppearance({ background: e.target.value })} className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">Cards & panels</label>
                                    <div className="flex gap-2 items-center">
                                        <input type="color" value={appearance.cardBackground} onChange={(e) => updateAppearance({ cardBackground: e.target.value })} className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer" />
                                        <input type="text" value={appearance.cardBackground} onChange={(e) => updateAppearance({ cardBackground: e.target.value })} className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">Primary (brand)</label>
                                    <div className="flex gap-2 items-center">
                                        <input type="color" value={appearance.primary} onChange={(e) => updateAppearance({ primary: e.target.value })} className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer" />
                                        <input type="text" value={appearance.primary} onChange={(e) => updateAppearance({ primary: e.target.value })} className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">Border opacity (0–1)</label>
                                    <input type="number" min="0" max="1" step="0.05" value={appearance.borderOpacity} onChange={(e) => updateAppearance({ borderOpacity: parseFloat(e.target.value) || 0 })} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Glass effect */}
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                            <Layers className="h-4 w-4 text-sky-400" />
                            <span className="text-sm font-bold text-white">Glass effect</span>
                        </div>
                        <div className="p-4">
                            <p className="text-[10px] text-zinc-500 mb-3">Frosted glass on elements that use the <span className="font-mono text-zinc-400">.app-glass</span> class (e.g. cards, sidebars).</p>
                            <div className="flex flex-wrap gap-2">
                                {(["off", "subtle", "medium", "heavy"] as GlassEffect[]).map((g) => (
                                    <button
                                        key={g}
                                        onClick={() => updateAppearance({ glassEffect: g })}
                                        className={cn(
                                            "px-4 py-2.5 rounded-lg text-sm font-bold capitalize transition-all",
                                            appearance.glassEffect === g ? "bg-sky-500 text-white" : "bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10"
                                        )}
                                    >
                                        {g}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Gradient */}
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                            <Palette className="h-4 w-4 text-violet-400" />
                            <span className="text-sm font-bold text-white">Gradient background</span>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-white">Enable page gradient</span>
                                <button
                                    onClick={() => updateAppearance({ gradientEnabled: !appearance.gradientEnabled })}
                                    className={cn(
                                        "w-10 h-5 rounded-full p-0.5 transition-colors",
                                        appearance.gradientEnabled ? "bg-violet-500" : "bg-zinc-700"
                                    )}
                                >
                                    <span className={cn("block w-4 h-4 rounded-full bg-white shadow-sm transition-transform", appearance.gradientEnabled ? "translate-x-5" : "translate-x-0")} />
                                </button>
                            </div>
                            {appearance.gradientEnabled && (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">Start color</label>
                                            <div className="flex gap-2 items-center">
                                                <input type="color" value={appearance.gradientStart} onChange={(e) => updateAppearance({ gradientStart: e.target.value })} className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer" />
                                                <input type="text" value={appearance.gradientStart} onChange={(e) => updateAppearance({ gradientStart: e.target.value })} className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">End color</label>
                                            <div className="flex gap-2 items-center">
                                                <input type="color" value={appearance.gradientEnd} onChange={(e) => updateAppearance({ gradientEnd: e.target.value })} className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer" />
                                                <input type="text" value={appearance.gradientEnd} onChange={(e) => updateAppearance({ gradientEnd: e.target.value })} className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono" />
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">Angle (degrees)</label>
                                        <input type="number" min="0" max="360" value={appearance.gradientAngle} onChange={(e) => updateAppearance({ gradientAngle: parseInt(e.target.value, 10) || 0 })} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                            <LayoutGrid className="h-4 w-4 text-amber-400" />
                            <span className="text-sm font-bold text-white">Sidebar</span>
                        </div>
                        <div className="p-4 space-y-4">
                            <p className="text-[11px] text-zinc-500">Use hex (<code className="text-zinc-400">#1a1a1e</code>) or <code className="text-zinc-400">rgba()</code> for best compatibility. Accent is the hover/highlight color.</p>
                            <div className="flex flex-wrap gap-2 mb-4">
                                {[
                                    { label: "Dark", bg: "#1a1a1e", fg: "#a1a1aa", accent: "rgba(255,255,255,0.06)" },
                                    { label: "Darker", bg: "#141318", fg: "#94a3b8", accent: "rgba(255,255,255,0.08)" },
                                    { label: "Match page", bg: "#141310", fg: "#d4d4d8", accent: "rgba(255,255,255,0.05)" },
                                ].map((preset) => (
                                    <button
                                        key={preset.label}
                                        type="button"
                                        onClick={() => updateAppearance({ sidebarBackground: preset.bg, sidebarForeground: preset.fg, sidebarAccent: preset.accent })}
                                        className="px-3 py-2 rounded-lg text-xs font-bold border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white hover:border-white/20 transition-colors"
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">Background</label>
                                    <div className="flex gap-2 items-center">
                                        <input
                                            type="color"
                                            value={appearance.sidebarBackground.startsWith("#") && appearance.sidebarBackground.length >= 7 ? appearance.sidebarBackground : "#1a1a1e"}
                                            onChange={(e) => updateAppearance({ sidebarBackground: e.target.value })}
                                            className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer shrink-0"
                                        />
                                        <input
                                            type="text"
                                            spellCheck={false}
                                            autoComplete="off"
                                            value={appearance.sidebarBackground}
                                            onChange={(e) => updateAppearance({ sidebarBackground: e.target.value })}
                                            className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 outline-none"
                                            placeholder="#1a1a1e"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">Text</label>
                                    <div className="flex gap-2 items-center">
                                        <input
                                            type="color"
                                            value={appearance.sidebarForeground.startsWith("#") && appearance.sidebarForeground.length >= 7 ? appearance.sidebarForeground : "#a1a1aa"}
                                            onChange={(e) => updateAppearance({ sidebarForeground: e.target.value })}
                                            className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer shrink-0"
                                        />
                                        <input
                                            type="text"
                                            spellCheck={false}
                                            autoComplete="off"
                                            value={appearance.sidebarForeground}
                                            onChange={(e) => updateAppearance({ sidebarForeground: e.target.value })}
                                            className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 outline-none"
                                            placeholder="#a1a1aa"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">Accent (hover)</label>
                                    <input
                                        type="text"
                                        spellCheck={false}
                                        autoComplete="off"
                                        value={appearance.sidebarAccent}
                                        onChange={(e) => updateAppearance({ sidebarAccent: e.target.value })}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 outline-none"
                                        placeholder="rgba(255,255,255,0.06)"
                                    />
                                    <p className="text-[9px] text-zinc-500 mt-1">e.g. rgba(255,255,255,0.06) or #ffffff0f</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Borders & radius */}
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                            <Layers className="h-4 w-4 text-emerald-400" />
                            <span className="text-sm font-bold text-white">Borders & radius</span>
                        </div>
                        <div className="p-4">
                            <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-3 block">Corner radius</label>
                            <div className="flex flex-wrap gap-2">
                                {(["smooth", "medium", "rounded", "pill"] as RadiusSize[]).map((r) => (
                                    <button
                                        key={r}
                                        onClick={() => updateAppearance({ radius: r })}
                                        className={cn(
                                            "px-4 py-2.5 rounded-lg text-sm font-bold capitalize transition-all",
                                            appearance.radius === r ? "bg-emerald-500 text-white" : "bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10"
                                        )}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Typography */}
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                            <Edit className="h-4 w-4 text-cyan-400" />
                            <span className="text-sm font-bold text-white">Typography</span>
                        </div>
                        <div className="p-4">
                            <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-3 block">Font size scale</label>
                            <div className="flex flex-wrap gap-2">
                                {(["small", "medium", "large"] as FontSizeScale[]).map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => updateAppearance({ fontSizeScale: s })}
                                        className={cn(
                                            "px-4 py-2.5 rounded-lg text-sm font-bold capitalize transition-all",
                                            appearance.fontSizeScale === s ? "bg-cyan-500 text-white" : "bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10"
                                        )}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] text-zinc-500 mt-2">Scales the whole UI (rem). Small ≈ 94%, Large ≈ 106%.</p>
                            <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 mt-4 block">Numeric style</label>
                            <div className="flex flex-wrap gap-2">
                                {(["default", "digital"] as NumericStyle[]).map((n) => (
                                    <button
                                        key={n}
                                        onClick={() => updateAppearance({ numericStyle: n })}
                                        className={cn(
                                            "px-4 py-2.5 rounded-lg text-sm font-bold capitalize transition-all",
                                            (appearance.numericStyle || "default") === n ? "bg-cyan-500 text-white" : "bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10"
                                        )}
                                    >
                                        {n}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Glow & highlights */}
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                            <Zap className="h-4 w-4 text-amber-400" />
                            <span className="text-sm font-bold text-white">Glow & highlights</span>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">Color theme</label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    <button
                                        onClick={() => updateAppearance({ glowTheme: "custom" })}
                                        className={cn(
                                            "px-4 py-2.5 rounded-lg text-sm font-bold transition-all",
                                            appearance.glowTheme === "custom" ? "bg-amber-500 text-white" : "bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10"
                                        )}
                                    >
                                        Custom
                                    </button>
                                    <button
                                        onClick={() => updateAppearance({ glowTheme: "apple", glowAccent: APPLE_GLOW_PRESET.glowAccent, glowSuccess: APPLE_GLOW_PRESET.glowSuccess, glowDanger: APPLE_GLOW_PRESET.glowDanger, highlightColor: APPLE_GLOW_PRESET.highlightColor })}
                                        className={cn(
                                            "px-4 py-2.5 rounded-lg text-sm font-bold transition-all",
                                            appearance.glowTheme === "apple" ? "bg-zinc-500 text-white" : "bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10"
                                        )}
                                    >
                                        Apple Intelligence
                                    </button>
                                </div>
                                <p className="text-[10px] text-zinc-500">Apple Intelligence: soft, neutral glows (zinc/sage tones). Custom: use your colors below.</p>
                            </div>
                            <div>
                                <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">Glow intensity</label>
                                <div className="flex flex-wrap gap-2">
                                    {(["off", "low", "medium", "high"] as GlowIntensity[]).map((g) => (
                                        <button
                                            key={g}
                                            onClick={() => updateAppearance({ glowIntensity: g })}
                                            className={cn(
                                                "px-4 py-2.5 rounded-lg text-sm font-bold capitalize transition-all",
                                                appearance.glowIntensity === g ? "bg-amber-500 text-white" : "bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10"
                                            )}
                                        >
                                            {g}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[10px] text-zinc-500 mt-2">Affects PnL glow, order-fill highlight, economic calendar, and accent glows.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">Glow accent</label>
                                    <div className="flex gap-2 items-center">
                                        <input type="color" value={appearance.glowAccent} onChange={(e) => updateAppearance({ glowTheme: "custom", glowAccent: e.target.value })} className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer" />
                                        <input type="text" value={appearance.glowAccent} onChange={(e) => updateAppearance({ glowTheme: "custom", glowAccent: e.target.value })} className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">Success (e.g. PnL up)</label>
                                    <div className="flex gap-2 items-center">
                                        <input type="color" value={appearance.glowSuccess} onChange={(e) => updateAppearance({ glowTheme: "custom", glowSuccess: e.target.value })} className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer" />
                                        <input type="text" value={appearance.glowSuccess} onChange={(e) => updateAppearance({ glowTheme: "custom", glowSuccess: e.target.value })} className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">Danger (e.g. PnL down)</label>
                                    <div className="flex gap-2 items-center">
                                        <input type="color" value={appearance.glowDanger} onChange={(e) => updateAppearance({ glowTheme: "custom", glowDanger: e.target.value })} className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer" />
                                        <input type="text" value={appearance.glowDanger} onChange={(e) => updateAppearance({ glowTheme: "custom", glowDanger: e.target.value })} className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">Highlight / shimmer</label>
                                    <div className="flex gap-2 items-center">
                                        <input type="color" value={appearance.highlightColor} onChange={(e) => updateAppearance({ glowTheme: "custom", highlightColor: e.target.value })} className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer" />
                                        <input type="text" value={appearance.highlightColor} onChange={(e) => updateAppearance({ glowTheme: "custom", highlightColor: e.target.value })} className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        <button
                            onClick={() => {
                                updateAppearance(DEFAULT_APPEARANCE_SETTINGS);
                                notify({ type: "success", title: "Appearance reset", message: "Restored default colors, theme, and glow.", duration: 2000 });
                            }}
                            className="text-xs text-zinc-500 hover:text-zinc-400 underline"
                        >
                            Reset to defaults
                        </button>
                        <p className="text-[10px] text-zinc-500">Changes apply immediately. Use Save in the bar above to persist with other settings.</p>
                    </div>
                </TabsContent>

                {/* --- INDIAN MARKETS API TAB --- */}
                <TabsContent value="indian_markets" className={settingsContentClass}>
                    <Card className="bg-card/50 backdrop-blur-xl border-border">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Landmark className="h-4 w-4 text-amber-400" />
                                Indian Markets API
                            </CardTitle>
                            <CardDescription>
                                Configure API base URLs for Mutual Funds (MFapi.in) and Indian Stocks (NSE/BSE). Leave blank to use defaults.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-3">
                                <label className="text-xs font-bold uppercase text-zinc-500">Mutual Funds API Base (MFapi.in)</label>
                                <input
                                    type="url"
                                    className="w-full bg-black/40 border border-white/10 rounded p-3 text-white text-sm focus:border-primary/50 outline-none font-mono"
                                    placeholder={DEFAULT_MF_API_BASE}
                                    value={indianMfApiBase}
                                    onChange={(e) => setIndianMfApiBase(e.target.value)}
                                />
                                <p className="text-[10px] text-zinc-500">Default: {DEFAULT_MF_API_BASE}</p>
                            </div>
                            <div className="space-y-3">
                                <label className="text-xs font-bold uppercase text-zinc-500">Indian Stocks API Base (NSE/BSE)</label>
                                <input
                                    type="url"
                                    className="w-full bg-black/40 border border-white/10 rounded p-3 text-white text-sm focus:border-primary/50 outline-none font-mono"
                                    placeholder={DEFAULT_STOCKS_API_BASE}
                                    value={indianStocksApiBase}
                                    onChange={(e) => setIndianStocksApiBase(e.target.value)}
                                />
                                <p className="text-[10px] text-zinc-500">Default: {DEFAULT_STOCKS_API_BASE}</p>
                            </div>
                            <div className="space-y-3">
                                <label className="text-xs font-bold uppercase text-zinc-500">CAS Parser API Key (Optional)</label>
                                <input
                                    type="password"
                                    className="w-full bg-black/40 border border-white/10 rounded p-3 text-white text-sm focus:border-primary/50 outline-none font-mono"
                                    placeholder="Get from app.casparser.in"
                                    value={casParserApiKey}
                                    onChange={(e) => setCasParserApiKey(e.target.value)}
                                />
                                <p className="text-[10px] text-zinc-500">Required for PDF upload. Get free key at casparser.in. JSON upload works without it.</p>
                            </div>
                            <div className="flex items-center justify-between pt-2">
                                <button
                                    onClick={() => {
                                        setIndianMfApiBase(DEFAULT_MF_API_BASE);
                                        setIndianStocksApiBase(DEFAULT_STOCKS_API_BASE);
                                        notify({ type: "success", title: "Reset", message: "API URLs reset to defaults." });
                                    }}
                                    className="text-xs text-zinc-500 hover:text-zinc-400 underline"
                                >
                                    Reset to defaults
                                </button>
                                <button
                                    onClick={() => {
                                        localStorage.setItem(INDIAN_MF_API_BASE_KEY, indianMfApiBase.trim() || DEFAULT_MF_API_BASE);
                                        localStorage.setItem(INDIAN_STOCKS_API_BASE_KEY, indianStocksApiBase.trim() || DEFAULT_STOCKS_API_BASE);
                                        localStorage.setItem(CAS_PARSER_API_KEY_STORAGE, casParserApiKey.trim());
                                        window.dispatchEvent(new Event("indian-markets-settings-changed"));
                                        notify({ type: "success", title: "Saved", message: "Indian Markets API settings saved." });
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-bold hover:bg-amber-500/30 transition-colors"
                                >
                                    <Save className="h-4 w-4" />
                                    Save
                                </button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- DEBUG TAB --- */}
                <TabsContent value="debug" className={settingsContentClass}>
                    <DebugTab connections={connections} connectionStatus={connectionStatus} />
                </TabsContent>

                <TabsContent value="admin" className={settingsContentClass}>
                    {showAdminTab ? (
                        <AdminTab />
                    ) : (
                        <Card className="border-white/10 bg-zinc-900/40">
                            <CardHeader>
                                <CardTitle className="text-white">Admin Access Required</CardTitle>
                                <CardDescription>
                                    This section is available only for the builder/admin account.
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>

        </PageWrapper>
    );
}
