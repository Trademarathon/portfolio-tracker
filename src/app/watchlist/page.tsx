"use client";

import { MarketTable } from "@/components/Screener/MarketTable";
import { TradingViewChart } from "@/components/Screener/TradingViewChart";
import { ScreenerLightweightChart } from "@/components/Screener/ScreenerLightweightChart";
import { GlobalAIFeed } from "@/components/Dashboard/GlobalAIFeed";
import { useScreenerData } from "@/hooks/useScreenerData";
import { useAlerts } from "@/hooks/useAlerts";
import { useScreenerAiInsightSymbols } from "@/hooks/useScreenerAiInsightSymbols";
import { getScreenerInsights, getHighVolatilitySignals, symbolToBase } from "@/lib/screenerInsights";
import type { AlphaSignalExport } from "@/components/Dashboard/NeuralAlphaFeed";
import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
    Bell,
    Minimize2,
    Maximize2,
    Settings2,
    Zap,
    X,
    Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ExchangeIcon } from "@/components/ui/ExchangeIcon";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { AlertsSidebar } from "@/components/Screener/AlertsSidebar";
import { PageWrapper } from "@/components/Layout/PageWrapper";
import { FinancialTable } from "@/components/ui/financial-markets-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProToolsInterface } from "@/components/Screener/ProToolsInterface";

function isTradFiSymbol(symbol: string): boolean {
    const s = (symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!s) return false;

    // Major non-crypto instruments commonly exposed on exchange "tradfi" feeds.
    const explicit = new Set([
        "XAU", "XAG", "GOLD", "SILVER",
        "USOIL", "UKOIL", "WTI", "BRENT",
        "SPX", "SP500", "NAS100", "NDX", "DJI", "US30", "DAX", "NIKKEI",
        "DXY",
        "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD",
        "EURJPY", "GBPJPY", "EURGBP",
    ]);
    if (explicit.has(s)) return true;

    // Common FX pair form: six-letter fiat pair.
    if (/^(EUR|USD|GBP|JPY|CHF|AUD|CAD|NZD)(EUR|USD|GBP|JPY|CHF|AUD|CAD|NZD)$/.test(s)) return true;

    // Commodity/index prefixes occasionally used by providers.
    if (s.startsWith("XAU") || s.startsWith("XAG")) return true;
    if (s.includes("OIL") || s.includes("BRENT") || s.includes("WTI")) return true;
    if (s.includes("SPX") || s.includes("NAS") || s.includes("DOW") || s.includes("DAX")) return true;

    return false;
}

function ScreenerContent() {
    const searchParams = useSearchParams();
    const { alerts } = useAlerts();
    const { tickersList = [], isConnected } = useScreenerData() || {};
    const [aiInsightSymbols, toggleAiInsight] = useScreenerAiInsightSymbols();
    const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isChartVisible, setIsChartVisible] = useState(false);
    const [exchangeFilter, setExchangeFilter] = useState<string>("all");
    const [useBuiltInChart, setUseBuiltInChart] = useState(true);
    const [chartTimeframe, setChartTimeframe] = useState<'5m' | '15m' | '1h' | '4h' | '1d'>('5m');
    const [chartAutoFallback, setChartAutoFallback] = useState(false);
    const [isChartCompact, setIsChartCompact] = useState(true);
    const [marketViewMode, setMarketViewMode] = useState<"crypto" | "indices">("crypto");

    const marketStats = useMemo(() => {
        const totalVol = (tickersList || []).reduce((acc, t) => acc + (t.volume24h || 0), 0);
        const totalOI = (tickersList || []).reduce((acc, t) => acc + (t.openInterest || 0), 0);
        const totalLiqs = (tickersList || []).reduce((acc, t) => acc + (t.liquidations5m || 0), 0);
        const fundingRates = (tickersList || []).map(t => t.fundingRate).filter(f => f !== undefined) as number[];
        const avgFunding = fundingRates.length > 0 ? fundingRates.reduce((a, b) => a + b, 0) / fundingRates.length : 0;

        return {
            vol: totalVol,
            oi: totalOI,
            liqs: totalLiqs,
            funding: avgFunding
        };
    }, [tickersList]);

    const formatCompact = (val: number) => {
        if (val >= 1e9) return (val / 1e9).toFixed(2) + 'B';
        if (val >= 1e6) return (val / 1e6).toFixed(2) + 'M';
        if (val >= 1e3) return (val / 1e3).toFixed(1) + 'K';
        return val.toFixed(0);
    };

    const statTiles = useMemo(() => ([
        {
            key: "vol",
            label: "VOL (24H)",
            value: `$${formatCompact(marketStats.vol)}`,
            valueClass: "text-zinc-100",
        },
        {
            key: "oi",
            label: "TOTAL OI",
            value: `$${formatCompact(marketStats.oi)}`,
            valueClass: "text-zinc-100",
        },
        {
            key: "liq",
            label: "LIQS (5M)",
            value: `$${formatCompact(marketStats.liqs)}`,
            valueClass: "text-rose-300",
        },
        {
            key: "funding",
            label: "AVG FUNDING",
            value: `${(marketStats.funding * 100).toFixed(4)}%`,
            valueClass: marketStats.funding >= 0 ? "text-emerald-300" : "text-rose-300",
        },
    ]), [marketStats]);

    const tvInterval = chartTimeframe === '5m'
        ? '5'
        : chartTimeframe === '15m'
            ? '15'
            : chartTimeframe === '1h'
                ? '60'
                : chartTimeframe === '4h'
                    ? '240'
                    : 'D';


    useEffect(() => {
        const symbol = searchParams.get("symbol");
        if (symbol && symbol !== selectedSymbol) {
            setSelectedSymbol(symbol);
            setIsChartVisible(true);
        }
    }, [searchParams, selectedSymbol]);

    const handleSelectSymbol = (symbol: string) => {
        if (selectedSymbol === symbol) {
            setIsChartVisible(!isChartVisible);
        } else {
            setSelectedSymbol(symbol);
            setIsChartVisible(true);
            setChartAutoFallback(false);
        }
    };

    // Convert screener key (SYMBOL-exchange) to TradingView symbol and clean label
    const { chartSymbol, chartLabel } = useMemo(() => {
        if (!selectedSymbol) return { chartSymbol: '', chartLabel: '' };
        const parts = selectedSymbol.split('-');
        const sym = parts[0] || '';
        const ex = (parts[1] || '').toUpperCase();
        const symForUsdt = sym.endsWith('USDT') ? sym : sym + 'USDT';
        let chartSymbol = 'BINANCE:' + symForUsdt;
        if (ex === 'BINANCE') chartSymbol = 'BINANCE:' + symForUsdt;
        else if (ex === 'BYBIT') chartSymbol = 'BYBIT:' + symForUsdt;
        else if (ex === 'HYPERLIQUID') chartSymbol = 'HYPERLIQUID:' + sym;
        const base = sym.replace(/USDT$/i, '') || sym;
        const chartLabel = base + '/USD';
        return { chartSymbol, chartLabel };
    }, [selectedSymbol]);

    const tradeFiTickers = useMemo(() => {
        const list = tickersList || [];
        const bySymbol = new Map<string, typeof list>();
        for (const t of list) {
            const sym = (t.symbol || "").toUpperCase();
            if (!sym || !isTradFiSymbol(sym)) continue;
            const arr = bySymbol.get(sym) || [];
            arr.push(t);
            bySymbol.set(sym, arr);
        }

        // Keep one row per symbol to avoid duplicates across exchanges.
        const out: typeof list = [];
        bySymbol.forEach((arr) => {
            const preferred = [...arr].sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0))[0];
            if (preferred) out.push(preferred);
        });
        return out.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
    }, [tickersList]);

    const safeTickers = tickersList || [];
    const filteredCount = exchangeFilter === "tradfi"
        ? tradeFiTickers.length
        : exchangeFilter === "all"
            ? safeTickers.length
            : safeTickers.filter(t => t.exchange === exchangeFilter).length;
    const symbolCountDenom = exchangeFilter === "tradfi" ? tradeFiTickers.length : safeTickers.length;

    const aiInsightTickers = useMemo(
        () => (tickersList || []).filter(t => aiInsightSymbols.has(symbolToBase(t.symbol))),
        [tickersList, aiInsightSymbols]
    );
    const screenerGlobalItems = useMemo((): AlphaSignalExport[] => {
        const insights = getScreenerInsights(aiInsightTickers, { presetLabel: "screener" }).slice(0, 12);
        const volatility = getHighVolatilitySignals(tickersList || []).slice(0, 8);
        const insightItems: AlphaSignalExport[] = insights.map((i) => ({
            id: `scr-${i.symbolKey}`,
            type: i.type === "pump" ? "GOING_UP" : i.type === "dump" ? "GOING_DOWN" : "IMMINENT_MOVEMENT",
            symbol: i.symbol,
            title: `${i.exchange.toUpperCase()} ${i.type.toUpperCase()}`,
            description: `${i.reason} ${i.recommendation}`.trim(),
            timestamp: i.timestamp,
            priority: i.type === "neutral" ? "low" : "medium",
            data: {
                source: "SCREENER",
            },
        }));
        const volItems: AlphaSignalExport[] = volatility.map((v) => ({
            id: `vol-${v.symbol}-${v.exchange}`,
            type: "VOLATILITY_ALERT",
            symbol: v.symbol,
            title: `${(v.exchange || "MARKET").toUpperCase()} HIGH VOL`,
            description: v.reason || "High short-term volatility detected.",
            timestamp: v.timestamp,
            priority: "high",
            data: { source: "SCREENER" },
        }));
        return [...volItems, ...insightItems];
    }, [aiInsightTickers, tickersList]);

    const socialSymbols = useMemo(() => {
        return [...(tickersList || [])]
            .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0))
            .slice(0, 20)
            .map((t) => t.symbol);
    }, [tickersList]);

    return (
        <PageWrapper className="tm-markets-page flex flex-col gap-4 px-4 md:px-6 lg:px-8 pt-4 pb-8 max-w-none w-full h-screen">
            <Tabs defaultValue="overview" className="flex flex-col flex-1 h-full min-h-0">
                <TabsList className="bg-black/20 border border-white/5 p-1 rounded-xl w-fit shrink-0 mb-4 mx-auto sm:mx-0">
                    <TabsTrigger value="overview" className="rounded-lg text-xs font-semibold px-6 py-2 data-[state=active]:bg-white/10 data-[state=active]:text-white text-zinc-400">
                        Overview
                    </TabsTrigger>
                    <TabsTrigger value="tools" className="rounded-lg text-xs font-semibold px-6 py-2 data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-400 text-zinc-400 flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5" />
                        Spaghetti
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="flex-1 min-h-0 m-0 focus-visible:outline-none data-[state=active]:flex flex-col">
                    <div className="tm-market-shell tm-tab-shell bg-zinc-950 clone-noise clone-divider flex flex-1 w-full min-w-0 text-zinc-100 rounded-[1.25rem] overflow-hidden border border-white/5 shadow-2xl">
                        {/* Left Main Content */}
                        <div className="flex-1 flex flex-col min-w-0 w-full border-r border-white/5">
                            {/* Header strip - uniform dark screener layout */}
                            <div className="tm-market-topbar tm-topbar shrink-0 clone-divider">
                                <div className="flex items-center gap-5">
                                    <div className="flex items-center gap-2">
                                        <div className="tm-page-header-icon">
                                            <Zap className="h-5 w-5 text-amber-400" />
                                        </div>
                                        <h1 className="tm-topbar-title">Markets</h1>
                                    </div>
                                    <div className="h-4 w-px bg-white/10 hidden sm:block" />
                                    <div className="flex items-center gap-1">
                                        {["all", "binance", "hyperliquid", "bybit", "tradfi"].map((ex) => {
                                            const label = ex === "all" ? "ALL" : ex === "binance" ? "Binance" : ex === "hyperliquid" ? "Hyperliquid" : ex === "bybit" ? "Bybit" : "TradeFi";
                                            const isActive = exchangeFilter === ex;
                                            const isTradeFi = ex === "tradfi";
                                            return (
                                                <button
                                                    key={ex}
                                                    onClick={() => setExchangeFilter(ex)}
                                                    title={isTradeFi ? "Binance + Hyperliquid (crypto pairs from these exchanges)" : undefined}
                                                    className={cn(
                                                        "tm-market-filter-btn flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all border",
                                                        isActive
                                                            ? "bg-white/16 text-white border-white/25 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
                                                            : "bg-transparent text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-white/5"
                                                    )}
                                                >
                                                    {ex !== "all" && !isTradeFi && (
                                                        <ExchangeIcon
                                                            exchange={label}
                                                            size={14}
                                                            className={cn(isActive ? "opacity-100" : "opacity-60")}
                                                        />
                                                    )}
                                                    {ex === "all" ? "ALL" : isTradeFi ? "TRADEFI" : label.toUpperCase()}
                                                </button>
                                            );
                                        })}
                                        <button
                                            onClick={() => setMarketViewMode((v) => (v === "crypto" ? "indices" : "crypto"))}
                                            className={cn(
                                                "tm-market-filter-btn ml-1 flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all border",
                                                marketViewMode === "indices"
                                                    ? "bg-cyan-500/20 text-cyan-200 border-cyan-500/30"
                                                    : "bg-transparent text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-white/5"
                                            )}
                                        >
                                            {marketViewMode === "indices" ? "CRYPTO VIEW" : "INDICES VIEW"}
                                        </button>
                                    </div>
                                    <div className="h-4 w-px bg-white/10 hidden md:block" />
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                                        <span className="text-zinc-300 font-mono">{filteredCount}/{symbolCountDenom}</span> SYMBOLS <span className="text-zinc-500 mx-1">•</span> <span className={cn("font-mono", isConnected ? "text-emerald-400" : "text-amber-400")}>{isConnected ? "LIVE" : "CONNECTING"}</span>
                                    </div>
                                    <div className="h-4 w-px bg-white/10 hidden lg:block" />
                                    <div className="hidden lg:flex items-center gap-2">
                                        {statTiles.map((tile, idx) => (
                                            <motion.div
                                                key={tile.key}
                                                initial={{ opacity: 0, y: 6 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.28, delay: idx * 0.04 }}
                                                className="tm-market-stat min-w-[84px] rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5"
                                            >
                                                <span className="block text-[8px] font-black uppercase tracking-[0.14em] text-zinc-500">{tile.label}</span>
                                                <span className={cn("block text-[11px] font-mono font-bold", tile.valueClass)}>
                                                    {tile.value}
                                                </span>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center gap-1.5">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                        className={cn(
                                            "text-[10px] font-bold uppercase tracking-widest h-8 px-3 transition-all rounded border",
                                            isSidebarOpen ? "bg-white/15 text-white border-white/20" : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border-transparent"
                                        )}
                                    >
                                        <Bell className="h-3.5 w-3.5 mr-2" />
                                        Alerts
                                        {(alerts || []).filter(a => a?.active).length > 0 && (
                                            <span className="ml-2 px-1.5 py-0.5 bg-amber-500 text-zinc-950 rounded-full text-[8px] font-black">
                                                {(alerts || []).filter(a => a?.active).length}
                                            </span>
                                        )}
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-200 rounded border border-transparent hover:bg-white/5">
                                        <Settings2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* Content Area */}
                            <div className="flex-1 min-h-0 flex overflow-hidden">
                                {/* Left: Markets + Chart */}
                                <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                                    <div className="flex-1 min-h-0 flex flex-col w-full transition-all duration-300 ease-out">
                                        <div className="flex-1 flex flex-col overflow-hidden w-full min-w-0">
                                            {marketViewMode === "crypto" ? (
                                                <MarketTable
                                                    onSelect={handleSelectSymbol}
                                                    selectedSymbol={selectedSymbol || ""}
                                                    onOpenAlerts={() => setIsSidebarOpen(true)}
                                                    exchangeFilter={exchangeFilter === "tradfi" ? "all" : exchangeFilter}
                                                    isConnecting={!isConnected}
                                                    tickersOverride={exchangeFilter === "tradfi" ? tradeFiTickers : undefined}
                                                    aiInsightSymbols={aiInsightSymbols}
                                                    onToggleAiInsight={toggleAiInsight}
                                                />
                                            ) : (
                                                <div className="h-full overflow-auto bg-zinc-950 p-4">
                                                    <FinancialTable title="Index" />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className={cn(
                                        "tm-market-chart-shell flex flex-col border-t border-white/5 transition-all duration-300 ease-out overflow-hidden",
                                        marketViewMode === "crypto" && isChartVisible && selectedSymbol
                                            ? isChartCompact
                                                ? "h-[206px] min-h-[206px] max-h-[206px] shrink-0"
                                                : "h-[44%] min-h-[280px] max-h-[500px] shrink-0"
                                            : "h-0"
                                    )}>
                                        {isChartVisible && selectedSymbol && (
                                            <>
                                                <div className={cn(
                                                    "tm-market-chart-header border-b border-white/8 flex items-center justify-between shrink-0",
                                                    isChartCompact ? "px-2.5 py-1.5" : "px-3 py-2"
                                                )}>
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <span className="text-[11px] font-bold font-mono tracking-tight text-zinc-200 bg-white/10 px-2 py-1 rounded-md border border-white/10">
                                                            {chartLabel}
                                                        </span>
                                                        <div className={cn(
                                                            "flex items-center gap-2 text-[10px] text-zinc-400 font-bold uppercase min-w-0",
                                                            isChartCompact && "gap-1.5"
                                                        )}>
                                                            <div className={cn(
                                                                "flex items-center gap-1 rounded-lg border border-white/10 bg-zinc-900/70 px-1.5 py-1",
                                                                isChartCompact && "px-1 py-0.5"
                                                            )}>
                                                                {(['5m', '15m', '1h', '4h', '1d'] as const).map((tf) => (
                                                                    <button
                                                                        key={tf}
                                                                        type="button"
                                                                        onClick={() => setChartTimeframe(tf)}
                                                                        className={cn(
                                                                            "tm-market-chart-tf px-1.5 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-[0.1em] transition-colors",
                                                                            chartTimeframe === tf
                                                                                ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                                                                : "border-transparent hover:bg-white/5 hover:text-zinc-300 text-zinc-500"
                                                                        )}
                                                                    >
                                                                        {tf}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            <span className="text-white/20 hidden xl:inline">|</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => { setUseBuiltInChart(true); setChartAutoFallback(false); }}
                                                                className={cn("tm-market-chart-mode px-2 py-1 rounded-md border border-transparent", useBuiltInChart ? "bg-white/10 text-zinc-200 border-white/15" : "text-zinc-500 hover:text-zinc-300")}
                                                            >
                                                                Built-in
                                                            </button>
                                                            <span className="text-white/20 hidden xl:inline">|</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => setUseBuiltInChart(false)}
                                                                className={cn("tm-market-chart-mode px-2 py-1 rounded-md inline-flex items-center gap-1.5 border border-transparent", !useBuiltInChart ? "bg-white/10 text-zinc-200 border-white/15" : "text-zinc-500 hover:text-zinc-300")}
                                                            >
                                                                <BrandLogo brand="tradingview" size={12} />
                                                                TradingView
                                                            </button>
                                                            <span className={cn("text-white/20 hidden 2xl:inline", isChartCompact && "hidden")} >|</span>
                                                            <span className={cn("hidden 2xl:inline-flex items-center gap-2", isChartCompact && "hidden")}>
                                                                <BrandLogo brand="binance" size={12} />
                                                                <BrandLogo brand="hyperliquid" size={12} />
                                                                <BrandLogo brand="bybit" size={12} />
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-zinc-400 hover:text-zinc-200 rounded-md border border-transparent hover:border-white/15"
                                                            onClick={() => setIsChartCompact((v) => !v)}
                                                            title={isChartCompact ? "Expand chart" : "Compact chart"}
                                                        >
                                                            {isChartCompact ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-zinc-400 hover:text-rose-400 rounded-md border border-transparent hover:border-rose-500/30"
                                                            onClick={() => setIsChartVisible(false)}
                                                        >
                                                            <X className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className={cn("tm-market-chart-body flex-1 min-h-0 relative", isChartCompact ? "p-1.5" : "p-2.5")}>
                                                    {chartAutoFallback && useBuiltInChart && (
                                                        <div className="absolute top-2 left-2 z-20 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border border-amber-500/30 bg-amber-500/10 text-amber-300">
                                                            Built-in unavailable, using TradingView fallback
                                                        </div>
                                                    )}
                                                    {chartSymbol && chartSymbol.includes(':') ? (
                                                        useBuiltInChart && !chartAutoFallback ? (
                                                            <ScreenerLightweightChart
                                                                symbol={chartSymbol}
                                                                interval={chartTimeframe}
                                                                onLoadError={() => setChartAutoFallback(true)}
                                                            />
                                                        ) : (
                                                            <TradingViewChart symbol={chartSymbol} interval={tvInterval} />
                                                        )
                                                    ) : (
                                                        <div className="h-full flex items-center justify-center text-zinc-500 text-xs font-bold uppercase tracking-wider">
                                                            Select a symbol to view chart
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Right: Global AI Feed */}
                                <div className="tm-market-feed-panel hidden lg:flex w-[352px] min-h-0 border-l border-white/8 bg-zinc-900/35">
                                    <div className="w-full h-full min-h-0 p-2.5">
                                        <GlobalAIFeed
                                            className="h-full min-h-0"
                                            compact
                                            scope="markets"
                                            socialSymbols={socialSymbols}
                                            screenerAdditionalItems={screenerGlobalItems}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="tools" className="flex-1 min-h-0 m-0 focus-visible:outline-none data-[state=active]:flex flex-col">
                    <ProToolsInterface />
                </TabsContent>
            </Tabs>

            {/* Right Sidebar */}
            <AlertsSidebar
                open={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />
        </PageWrapper>
    );
}

export default function ScreenerPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center p-10 text-muted-foreground">Loading Screener...</div>}>
            <ScreenerContent />
        </Suspense>
    );
}
