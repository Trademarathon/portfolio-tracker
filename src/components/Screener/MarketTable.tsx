"use client";

import { useScreenerData, EnhancedTickerData } from "@/hooks/useScreenerData";
import { useAlerts } from "@/hooks/useAlerts";
import React, { useState, useMemo, useEffect, useCallback, useRef, CSSProperties } from "react";
import { cn } from "@/lib/utils";
import {
    Bell,
    Search,
    Activity,
    Star,
    ArrowUpRight,
    ChevronDown,
    Save,
    Plus,
    LayoutGrid,
    Columns3,
    Filter,
    X,
    BarChart3,
    Sparkles
} from "lucide-react";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { List } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger, PopoverClose } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { FiltersPanel, ScreenerFilter } from "@/components/Screener/FiltersPanel";

// --- Type Definitions ---
interface ColumnDef { key: string; label: string; disabled?: boolean }
interface ColumnGroup { title: string; columns: ColumnDef[]; showAll?: boolean }

interface AlertCondition {
    type: string;
    operator: string;
    value: number;
}

interface SignalData {
    symbol: string;
    type: string;
    strength?: number;
    intensity?: number;
    timestamp: number;
}

type Preset = "all" | "high-volume" | "oi-spike" | "big-movers" | "high-funding";

const SCREENER_FILTER_PRESETS_KEY = "screener_filter_presets";
const SCREENER_COLUMN_VISIBILITY_KEY = "screener_column_visibility";
const SCREENER_COLUMN_ORDER_KEY = "screener_column_order";
const SCREENER_COLUMN_WIDTHS_KEY = "screener_column_widths";
const WATCHLIST_FAVORITES_KEY = "watchlist_favorites";
const SCREENER_DEFAULT_COL_WIDTHS: Record<string, number> = {
    market: 168,
    price: 102,
    signal: 120,
    oi: 98,
    funding: 100,
    trd15m: 94,
    vlt15m: 94,
    liq5m: 95,
    liq1h: 95,
    momentum: 78,
    chg5m: 96,
    chg15m: 96,
    chg1h: 96,
    chg24h: 96,
    volume1h: 102,
    volume24h: 102,
    oiChg1h: 110,
    action: 40,
    ai: 52,
};

const SCREENER_MIN_COL_WIDTHS: Record<string, number> = {
    market: 148,
    price: 94,
    signal: 110,
    oi: 90,
    funding: 92,
    trd15m: 86,
    vlt15m: 86,
    liq5m: 90,
    liq1h: 90,
    momentum: 70,
    chg5m: 90,
    chg15m: 90,
    chg1h: 90,
    chg24h: 90,
    volume1h: 96,
    volume24h: 96,
    oiChg1h: 102,
    action: 36,
    ai: 44,
};

const COLUMN_MAX_WIDTH = 320;

const clampColumnWidth = (widthKey: string, width: number) => {
    const min = SCREENER_MIN_COL_WIDTHS[widthKey] ?? 56;
    if (!Number.isFinite(width)) return min;
    return Math.max(min, Math.min(COLUMN_MAX_WIDTH, Math.round(width)));
};

const sanitizeColumnWidths = (source?: Record<string, number>): Record<string, number> => {
    const next: Record<string, number> = { ...SCREENER_DEFAULT_COL_WIDTHS };
    if (!source) return next;
    for (const [key, rawValue] of Object.entries(source)) {
        if (typeof rawValue === "number") {
            next[key] = clampColumnWidth(key, rawValue);
        }
    }
    return next;
};

/** Default order of data columns (Symbol is always first and not draggable) */
const DEFAULT_COLUMN_ORDER = [
    "price", "change5m", "change15m", "change1h", "change24h",
    "volume1h", "volume24h", "oi", "oiChange1h", "funding",
    "vlt15m", "trd15m", "signal", "liq5m", "liq1h", "momentum", "ai",
] as const;

/** Header config for each data column (Orion-style titles: FUNDING %, VOL (1D), TRD (15M), VLT (15M), RVOL) */
const HEADER_COLUMN_CONFIG: Record<string, { title: string; field: string; widthKey: string; align?: "left" | "right"; tooltip?: string }> = {
    price: { title: "PRICE", field: "price", widthKey: "price", tooltip: "Last mark price" },
    change5m: { title: "CHG 5M", field: "change5m", widthKey: "chg5m", align: "right", tooltip: "Price change over last 5 minutes" },
    change15m: { title: "CHG 15M", field: "change15m", widthKey: "chg15m", align: "right", tooltip: "Price change over last 15 minutes" },
    change1h: { title: "CHG 1H", field: "change1h", widthKey: "chg1h", align: "right", tooltip: "Price change over last hour" },
    change24h: { title: "CHG 1D", field: "change24h", widthKey: "chg24h", align: "right", tooltip: "Price change over last 24 hours" },
    volume1h: { title: "VOL 1H", field: "volume1h", widthKey: "volume1h", align: "right", tooltip: "Trading volume in last hour" },
    volume24h: { title: "VOL 1D", field: "volume24h", widthKey: "volume24h", align: "right", tooltip: "Trading volume in last 24 hours" },
    oi: { title: "OI $", field: "openInterest", widthKey: "oi", tooltip: "Total open interest in USD" },
    oiChange1h: { title: "OI CHG 1H", field: "oiChange1h", widthKey: "oiChg1h", align: "right", tooltip: "Open interest change over last hour" },
    funding: { title: "FUNDING", field: "fundingRate", widthKey: "funding", tooltip: "Periodic rate paid between longs and shorts" },
    vlt15m: { title: "VLT 15M", field: "volatility15m", widthKey: "vlt15m", tooltip: "Price volatility over last 15 minutes" },
    trd15m: { title: "TRD 15M", field: "trades15m", widthKey: "trd15m", tooltip: "Number of executed trades" },
    signal: { title: "SIGNAL", field: "signal", widthKey: "signal", tooltip: "Alert or movement signal" },
    liq5m: { title: "LIQ (5M)", field: "liquidations5m", widthKey: "liq5m", tooltip: "Estimated liquidations in last 5 minutes" },
    liq1h: { title: "LIQ (1H)", field: "liquidations1h", widthKey: "liq1h", tooltip: "Estimated liquidations in last hour" },
    momentum: { title: "RVOL", field: "rvol", widthKey: "momentum", align: "right", tooltip: "Relative volume: current 5m volume vs 24h average" },
    ai: { title: "AI", field: "ai", widthKey: "ai", tooltip: "Toggle AI Insight feed for this symbol" },
};

interface FilterPreset {
    id: string;
    name: string;
    filters: ScreenerFilter[];
}

// --- Helper Functions ---

const formatCompact = (val: number) => {
    if (!Number.isFinite(val)) return '-';
    if (Math.abs(val) < 1e-9) return '0';
    if (val >= 1e9) return (val / 1e9).toFixed(2) + 'B';
    if (val >= 1e6) return (val / 1e6).toFixed(2) + 'M';
    if (val >= 1e3) return (val / 1e3).toFixed(1) + 'K';
    return val.toFixed(0);
};

const formatMarketPrice = (price: number | undefined) => {
    const p = Number(price || 0);
    if (!Number.isFinite(p) || p <= 0) return '$—';
    if (p >= 1000) return `$${p.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    if (p >= 1) return `$${p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
    if (p >= 0.01) return `$${p.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
    return `$${p.toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 8 })}`;
};

// --- Constants --- Orion column parity (https://screener.orionterminal.com/)
const COLUMN_GROUPS: ColumnGroup[] = [
    {
        title: "CORE",
        columns: [
            { key: "market", label: "Symbol", disabled: true },
            { key: "price", label: "Price" },
            { key: "oi", label: "OI $" },
            { key: "funding", label: "Funding" },
            { key: "momentum", label: "Momentum" },
            { key: "ai", label: "AI Insight" },
            { key: "mcap", label: "MCAP", disabled: true },
        ],
        showAll: false,
    },
    {
        title: "CHANGE %",
        columns: [
            { key: "change5m", label: "5m" },
            { key: "change15m", label: "15m" },
            { key: "change1h", label: "1h" },
            { key: "change4h", label: "4h", disabled: true },
            { key: "change8h", label: "8h", disabled: true },
            { key: "change12h", label: "12h", disabled: true },
            { key: "change24h", label: "1d" },
        ],
        showAll: true,
    },
    {
        title: "VOLUME",
        columns: [
            { key: "volume5m", label: "5m", disabled: true },
            { key: "volume15m", label: "15m", disabled: true },
            { key: "volume1h", label: "1h" },
            { key: "volume4h", label: "4h", disabled: true },
            { key: "volume8h", label: "8h", disabled: true },
            { key: "volume12h", label: "12h", disabled: true },
            { key: "volume24h", label: "1d" },
        ],
        showAll: true,
    },
    {
        title: "TRADES",
        columns: [
            { key: "trd5m", label: "5m", disabled: true },
            { key: "trd15m", label: "15m" },
            { key: "trd1h", label: "1h", disabled: true },
            { key: "trd4h", label: "4h", disabled: true },
            { key: "trd8h", label: "8h", disabled: true },
            { key: "trd12h", label: "12h", disabled: true },
            { key: "trd1d", label: "1d", disabled: true },
        ],
        showAll: true,
    },
    {
        title: "VOLATILITY",
        columns: [
            { key: "vlt5m", label: "5m", disabled: true },
            { key: "vlt15m", label: "15m" },
            { key: "vlt1h", label: "1h", disabled: true },
            { key: "vlt4h", label: "4h", disabled: true },
            { key: "vlt8h", label: "8h", disabled: true },
            { key: "vlt12h", label: "12h", disabled: true },
            { key: "vlt1d", label: "1d", disabled: true },
        ],
        showAll: true,
    },
    {
        title: "OI CHANGE %",
        columns: [
            { key: "oiChg5m", label: "5m", disabled: true },
            { key: "oiChg15m", label: "15m", disabled: true },
            { key: "oiChange1h", label: "1h" },
            { key: "oiChg4h", label: "4h", disabled: true },
            { key: "oiChg8h", label: "8h", disabled: true },
            { key: "oiChg12h", label: "12h", disabled: true },
            { key: "oiChg1d", label: "1d", disabled: true },
        ],
        showAll: true,
    },
    {
        title: "OI CHANGE $",
        columns: [
            { key: "oiChg$5m", label: "5m", disabled: true },
            { key: "oiChg$15m", label: "15m", disabled: true },
            { key: "oiChg$1h", label: "1h", disabled: true },
            { key: "oiChg$4h", label: "4h", disabled: true },
            { key: "oiChg$8h", label: "8h", disabled: true },
            { key: "oiChg$12h", label: "12h", disabled: true },
            { key: "oiChg$1d", label: "1d", disabled: true },
        ],
        showAll: true,
    },
    {
        title: "CVD",
        columns: [
            { key: "cvd5m", label: "5m", disabled: true },
            { key: "cvd15m", label: "15m", disabled: true },
            { key: "cvd1h", label: "1h", disabled: true },
            { key: "cvd4h", label: "4h", disabled: true },
            { key: "cvd8h", label: "8h", disabled: true },
            { key: "cvd12h", label: "12h", disabled: true },
            { key: "cvd1d", label: "1d", disabled: true },
        ],
        showAll: true,
    },
    {
        title: "VOL CHANGE %",
        columns: [
            { key: "volChgPct5m", label: "5m", disabled: true },
            { key: "volChgPct15m", label: "15m", disabled: true },
            { key: "volChgPct1h", label: "1h", disabled: true },
            { key: "volChgPct4h", label: "4h", disabled: true },
            { key: "volChgPct8h", label: "8h", disabled: true },
            { key: "volChgPct12h", label: "12h", disabled: true },
            { key: "volChgPct1d", label: "1d", disabled: true },
        ],
        showAll: true,
    },
    {
        title: "VOL CHANGE $",
        columns: [
            { key: "volChg$5m", label: "5m", disabled: true },
            { key: "volChg$15m", label: "15m", disabled: true },
            { key: "volChg$1h", label: "1h", disabled: true },
            { key: "volChg$4h", label: "4h", disabled: true },
            { key: "volChg$8h", label: "8h", disabled: true },
            { key: "volChg$12h", label: "12h", disabled: true },
            { key: "volChg$1d", label: "1d", disabled: true },
        ],
        showAll: true,
    },
    {
        title: "BTC CORR",
        columns: [
            { key: "btcCorr5m", label: "5m", disabled: true },
            { key: "btcCorr15m", label: "15m", disabled: true },
            { key: "btcCorr1h", label: "1h", disabled: true },
            { key: "btcCorr4h", label: "4h", disabled: true },
            { key: "btcCorr8h", label: "8h", disabled: true },
            { key: "btcCorr12h", label: "12h", disabled: true },
            { key: "btcCorr1d", label: "1d", disabled: true },
        ],
        showAll: true,
    },
    {
        title: "Activity",
        columns: [
            { key: "signal", label: "Signal" },
            { key: "liq5m", label: "Liq (5m)" },
            { key: "liq1h", label: "Liq (1h)" },
        ],
        showAll: false,
    },
];

const ORION_DEFAULT_COLUMNS: Record<string, boolean> = {
    market: true,
    price: true,
    oi: true,
    funding: true,
    momentum: true,
    ai: true,
    change5m: true,
    change15m: true,
    change1h: true,
    change24h: true,
    volume1h: true,
    volume24h: true,
    oiChange1h: true,
    vlt15m: true,
    trd15m: true,
};

const ORION_CORE_ONLY: Record<string, boolean> = {
    market: true,
    price: true,
    oi: true,
    funding: true,
    momentum: true,
};

// --- Row Component ---

interface RowProps {
    items: EnhancedTickerData[];
    selectedSymbol?: string | null;
    signals: SignalData[];
    onSelect?: (symbol: string) => void;
    colWidths: Record<string, number>;
    isCompact: boolean;
    visibleColumns: Record<string, boolean>;
    columnOrder: string[];
    addAlert?: (symbol: string, conditions: AlertCondition[]) => void;
    favorites?: Set<string>;
    toggleFavorite?: (symbol: string) => void;
    preset?: Preset;
    aiInsightSymbols?: Set<string>;
    onToggleAiInsight?: (symbolBase: string) => void;
}

function symbolToBase(symbol: string): string {
    const s = (symbol || "").toUpperCase().replace(/\//g, "");
    return s.endsWith("USDT") ? s : s + "USDT";
}

const Row = React.memo(({
    index,
    style,
    items,
    selectedSymbol,
    signals,
    onSelect,
    colWidths,
    isCompact,
    visibleColumns,
    columnOrder,
    addAlert,
    favorites,
    toggleFavorite,
    preset = "all" as Preset,
    aiInsightSymbols,
    onToggleAiInsight,
}: {
    index: number;
    style: CSSProperties
} & RowProps) => {
    const item = (items || [])[index];
    const order = columnOrder?.length ? columnOrder : [...DEFAULT_COLUMN_ORDER];
    const symbolKey = item?.symbol && item?.exchange ? `${item.symbol}-${item.exchange}` : "";

    // Hooks must be called before any conditional returns
    const [flash, setFlash] = useState<'up' | 'down' | null>(null);
    const prevPriceRef = useRef(item?.price);
    const prevSymbolKeyRef = useRef(symbolKey);

    useEffect(() => {
        // react-window reuses row components by index; reset when row identity changes.
        if (prevSymbolKeyRef.current !== symbolKey) {
            prevSymbolKeyRef.current = symbolKey;
            prevPriceRef.current = item?.price;
            setFlash(null);
            return;
        }

        if (!item || item.price === undefined || prevPriceRef.current === undefined) {
            if (item) prevPriceRef.current = item.price;
            return;
        }

        if (item.price > prevPriceRef.current) {
            setFlash('up');
            const timer = setTimeout(() => setFlash(null), 800);
            prevPriceRef.current = item.price;
            return () => clearTimeout(timer);
        } else if (item.price < prevPriceRef.current) {
            setFlash('down');
            const timer = setTimeout(() => setFlash(null), 800);
            prevPriceRef.current = item.price;
            return () => clearTimeout(timer);
        }
    }, [item?.price, item, symbolKey]);
    
    // Early return after hooks
    if (!item || !item.symbol) return null;

    const isSelected = selectedSymbol === `${item.symbol}-${item.exchange}`;
    const isFavorite = favorites?.has(symbolKey);

    const renderChangeCell = (val: number | undefined, widthClass: string) => {
        const v = val ?? 0;
        const positive = v > 0;
        const negative = v < 0;
        return (
            <div className={cn(widthClass, "px-2.5 text-right")}>
                <span
                    className={cn(
                        "inline-flex items-center justify-end rounded-md border px-2 py-0.5 text-[10px] font-semibold tabular-nums",
                        positive && "border-emerald-500/40 bg-emerald-500/12 text-emerald-300",
                        negative && "border-rose-500/40 bg-rose-500/12 text-rose-300",
                        !positive && !negative && "border-white/10 bg-white/5 text-zinc-400"
                    )}
                >
                    {val !== undefined ? `${v > 0 ? '+' : ''}${v.toFixed(2)}%` : '-'}
                </span>
            </div>
        );
    };

    const renderDataCell = (key: string) => {
        const w = (k: string, fallback = 95): CSSProperties => {
            const width = colWidths[k] ?? fallback;
            return { width, minWidth: width, maxWidth: width };
        };
        const isPlaceholder = item.placeholder === true || !Number.isFinite(item.price) || item.price <= 0;
        const metricsReady = item.metricsReady === true;
        const hasFunding = item.hasFundingRate === true;
        const hasOpenInterest = item.hasOpenInterest === true;
        const hasVolume24h = item.hasVolume24h === true || (item.volume24h || 0) > 0;
        const hasVolume1h = item.hasVolume1h === true || (item.volume1h || 0) > 0;
        const emptyCellFor = (widthKey: string, fallback = 90) => (
            <div key={key} style={w(widthKey, fallback)} className="px-2.5 text-right text-[11px] font-medium font-mono tabular-nums text-zinc-500/70 shrink-0">
                —
            </div>
        );
        switch (key) {
            case "price":
                return (
                    <div key={key} style={w("price", 100)} className="px-2.5 text-[12px] font-semibold font-mono tabular-nums text-zinc-100 shrink-0 text-right">
                        {isPlaceholder ? "—" : formatMarketPrice(item.price)}
                    </div>
                );
            case "change5m": return metricsReady ? <div key={key} style={w("chg5m", 90)} className="shrink-0">{renderChangeCell(item.change5m, "")}</div> : emptyCellFor("chg5m", 90);
            case "change15m": return metricsReady ? <div key={key} style={w("chg15m", 90)} className="shrink-0">{renderChangeCell(item.change15m, "")}</div> : emptyCellFor("chg15m", 90);
            case "change1h": return metricsReady ? <div key={key} style={w("chg1h", 90)} className="shrink-0">{renderChangeCell(item.change1h, "")}</div> : emptyCellFor("chg1h", 90);
            case "change24h": return isPlaceholder ? emptyCellFor("chg24h", 90) : <div key={key} style={w("chg24h", 90)} className="shrink-0">{renderChangeCell(item.change24h, "")}</div>;
            case "volume1h":
                const rawVolume1h = Number((item as any).volume1h);
                const fallbackVolume1h = Number(item.volume24h || 0) > 0 ? Number(item.volume24h || 0) / 24 : 0;
                const volume1h = rawVolume1h > 0 ? rawVolume1h : fallbackVolume1h;
                return hasVolume1h && !isPlaceholder ? (
                    <div key={key} style={w("volume1h", 95)} className="px-2.5 text-right text-[11px] font-medium font-mono tabular-nums text-zinc-300 shrink-0">
                        {`$${formatCompact(volume1h)}`}
                    </div>
                ) : emptyCellFor("volume1h", 95);
            case "volume24h":
                const volume24h = Number(item.volume24h || 0);
                return hasVolume24h && !isPlaceholder ? (
                    <div key={key} style={w("volume24h", 95)} className="px-2.5 text-right text-[11px] font-medium font-mono tabular-nums text-zinc-300 shrink-0">
                        {`$${formatCompact(volume24h)}`}
                    </div>
                ) : emptyCellFor("volume24h", 95);
            case "oi":
                const openInterest = Number(item.openInterest || 0);
                return hasOpenInterest && !isPlaceholder ? (
                    <div key={key} style={w("oi", 95)} className="px-2.5 text-right text-[11px] font-medium font-mono tabular-nums text-zinc-300 shrink-0" title="Open interest (USD)">
                        {`$${formatCompact(openInterest)}`}
                    </div>
                ) : emptyCellFor("oi", 95);
            case "oiChange1h":
                const oiChangeRaw = (item as any).oiChange1h;
                const oiChange = Number.isFinite(oiChangeRaw) ? Number(oiChangeRaw) : 0;
                return hasOpenInterest && !isPlaceholder ? (
                    <div key={key} style={w("oiChg1h", 100)} className="px-2.5 text-right shrink-0">
                        <span className={cn("text-[11px] font-medium font-mono tabular-nums", oiChange > 0 ? "text-emerald-400" : oiChange < 0 ? "text-rose-400" : "text-zinc-500")}>
                            {`${oiChange > 0 ? '+' : ''}${oiChange.toFixed(2)}%`}
                        </span>
                    </div>
                ) : emptyCellFor("oiChg1h", 100);
            case "funding":
                return hasFunding && !isPlaceholder ? (
                    <div key={key} style={w("funding", 90)} className="px-2.5 text-right text-[11px] font-medium font-mono tabular-nums shrink-0">
                        <span className={cn(item.fundingRate !== undefined && (item.fundingRate || 0) > 0 ? "text-emerald-400" : (item.fundingRate || 0) < 0 ? "text-rose-400" : "text-zinc-500")}>
                            {`${((item.fundingRate || 0) * 100).toFixed(4)}%`}
                        </span>
                    </div>
                ) : emptyCellFor("funding", 90);
            case "vlt15m":
                return metricsReady ? (
                    <div key={key} style={w("vlt15m", 85)} className="px-2.5 text-right text-[11px] font-medium font-mono tabular-nums text-zinc-300 shrink-0">
                        {`${(item.volatility15m || 0).toFixed(2)}%`}
                    </div>
                ) : emptyCellFor("vlt15m", 85);
            case "trd15m":
                return metricsReady ? (
                    <div key={key} style={w("trd15m", 90)} className="px-2.5 text-right text-[11px] font-medium font-mono tabular-nums text-zinc-300 shrink-0">
                        {formatCompact(item.trades15m || 0)}
                    </div>
                ) : emptyCellFor("trd15m", 90);
            case "signal":
                return (
                    <div key={key} style={w("signal", 120)} className="px-3 flex items-center shrink-0">
                        {(() => {
                            const latestSignal = signals.find(s => s.symbol === item.symbol);
                            if (!latestSignal) return <span className="text-zinc-500 text-[10px]">—</span>;
                            const isNew = Date.now() - latestSignal.timestamp < 300000;
                            const type = latestSignal.type.replace(/_/g, ' ');
                            return (
                                <div className="flex flex-col items-start leading-tight">
                                    <div className={cn("text-[9px] font-black uppercase px-1 rounded flex items-center gap-1", latestSignal.type.includes('up') || latestSignal.type.includes('buy') ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500", isNew && "animate-pulse")}>
                                        {latestSignal.type.includes('up') ? '↑' : latestSignal.type.includes('down') ? '↓' : '⚡'}{type}
                                    </div>
                                    <span className="text-[8px] text-zinc-500 font-bold truncate max-w-[100px]">{new Date(latestSignal.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            );
                        })()}
                    </div>
                );
            case "liq5m":
                return metricsReady ? (
                    <div key={key} style={w("liq5m", 95)} className="px-2.5 text-right text-[11px] font-medium font-mono tabular-nums text-rose-400 shrink-0">
                        {`$${formatCompact(item.liquidations5m || 0)}`}
                    </div>
                ) : emptyCellFor("liq5m", 95);
            case "liq1h":
                return metricsReady ? (
                    <div key={key} style={w("liq1h", 95)} className="px-2.5 text-right text-[11px] font-medium font-mono tabular-nums text-rose-400 shrink-0">
                        {`$${formatCompact(item.liquidations1h || 0)}`}
                    </div>
                ) : emptyCellFor("liq1h", 95);
            case "momentum":
                if (isPlaceholder) return emptyCellFor("momentum", 75);
                const rawRvol = Number((item as any).rvol);
                const rvol = Number.isFinite(rawRvol) && rawRvol > 0
                    ? Math.min(rawRvol, 99.99)
                    : Number(item.volume24h || 0) > 0
                        ? 1
                        : 0;
                return (
                    <div key={key} style={w("momentum", 75)} className="px-2.5 text-right shrink-0">
                        <span className={cn(
                            "inline-flex items-center justify-end rounded-md border px-2 py-0.5 text-[10px] font-semibold tabular-nums",
                            rvol >= 2 ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/12" :
                                rvol >= 1 ? "text-cyan-300 border-cyan-500/35 bg-cyan-500/10" : "text-zinc-400 border-white/10 bg-white/5"
                        )}>
                            {rvol.toFixed(2)}x
                        </span>
                    </div>
                );
            case "ai":
                if (!onToggleAiInsight || !aiInsightSymbols) return null;
                const base = symbolToBase(item.symbol);
                const hasAi = aiInsightSymbols.has(base);
                return (
                    <div key={key} style={w("ai", 44)} className="px-2 flex items-center shrink-0">
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onToggleAiInsight(base); }}
                            className={cn(
                                "p-1 rounded transition-colors",
                                hasAi ? "text-amber-400 bg-amber-500/20" : "text-zinc-500 hover:text-amber-400/80 hover:bg-white/5"
                            )}
                            title={hasAi ? "Remove from AI Insight feed" : "Add to AI Insight feed"}
                        >
                            <Sparkles className="h-3.5 w-3.5" />
                        </button>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div style={style} onClick={() => onSelect?.(symbolKey)} className="gpu-accelerated no-select px-2">
            <div className={cn(
                "flex items-center h-full border-b border-white/[0.045] transition-all duration-200 cursor-pointer relative group rounded-md",
                "hover:bg-[linear-gradient(92deg,rgba(34,211,238,0.08),rgba(255,255,255,0.02),rgba(0,0,0,0.06))] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]",
                isSelected && "bg-cyan-500/10 border-l-[2px] border-l-cyan-300 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.22)]",
                flash === 'up' && "flash-up",
                flash === 'down' && "flash-down",
                preset !== "all" && "ring-1 ring-amber-500/20 rounded-sm shadow-[0_0_12px_rgba(245,158,11,0.08)]",
                item.placeholder && "opacity-70"
            )}>
                <div style={{ width: colWidths.market ?? 140, minWidth: colWidths.market ?? 140, maxWidth: colWidths.market ?? 140 }} className="px-2.5 flex items-center gap-1.5 min-w-0 shrink-0">
                    <button
                        onClick={(e) => { e.stopPropagation(); toggleFavorite?.(symbolKey); }}
                        className={cn("p-0.5 hover:text-amber-400 transition-colors", isFavorite ? "text-amber-400" : "text-zinc-500")}
                    >
                        <Star className={cn("h-3 w-3", isFavorite && "fill-amber-400")} />
                    </button>
                    <ArrowUpRight className="h-3 w-3 text-zinc-500 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
                    <TokenIcon symbol={item.symbol} size={18} />
                    <div className="font-semibold text-zinc-100 text-[12px] uppercase tracking-tight truncate">{item.symbol}</div>
                    {item.exchange === 'hyperliquid' && <div className="text-[7px] bg-purple-500/20 text-purple-400 px-1 rounded font-black italic">HL</div>}
                    {item.exchange === 'binance' && <div className="text-[7px] bg-amber-500/20 text-amber-400 px-1 rounded font-black italic">B</div>}
                    {item.exchange === 'bybit' && <div className="text-[7px] bg-orange-500/20 text-orange-400 px-1 rounded font-black italic">BY</div>}
                </div>
                {order.filter(k => visibleColumns[k]).map(k => renderDataCell(k))}
                <div className="flex-1" />
            </div>
        </div>
    );
});

Row.displayName = 'MarketRow';

// --- Main Table Component ---

const SCREENER_AI_INSIGHT_SYMBOLS_KEY = "screener_ai_insight_symbols";
const DEFAULT_AI_INSIGHT_SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT"];

export const MarketTable = React.memo(({
    onSelect,
    selectedSymbol,
    onOpenAlerts,
    isCompact = false,
    exchangeFilter = "all",
    isConnecting = false,
    tickersOverride,
    hideToolbar = false,
    aiInsightSymbols: aiInsightSymbolsProp,
    onToggleAiInsight: onToggleAiInsightProp,
}: {
    onSelect?: (symbol: string) => void,
    selectedSymbol?: string,
    onOpenAlerts?: () => void,
    isCompact?: boolean,
    exchangeFilter?: string,
    isConnecting?: boolean,
    tickersOverride?: EnhancedTickerData[],
    hideToolbar?: boolean,
    aiInsightSymbols?: Set<string>,
    onToggleAiInsight?: (symbolBase: string) => void,
}) => {
    const screenerData = useScreenerData();
    const { alerts, signals, addAlert, checkAlerts, detectSignals } = useAlerts();

    const tickersList = tickersOverride ?? (screenerData?.tickersList || []);
    const isConnected = screenerData?.isConnected || false;

    const [search, setSearch] = useState("");
    const [preset, setPreset] = useState<Preset>("all");
    const [sortBy, setSortBy] = useState<string>("volume24h");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [filters, setFilters] = useState<ScreenerFilter[]>([]);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [presets, setPresets] = useState<FilterPreset[]>([]);
    const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
    const [storageHydrated, setStorageHydrated] = useState(false);

    const [internalAiSymbols, setInternalAiSymbols] = useState<Set<string>>(new Set(DEFAULT_AI_INSIGHT_SYMBOLS));

    const internalToggleAi = useCallback((symbolBase: string) => {
        const base = symbolBase.toUpperCase().replace(/\//g, "").endsWith("USDT") ? symbolBase.toUpperCase().replace(/\//g, "") : symbolBase.toUpperCase().replace(/\//g, "") + "USDT";
        setInternalAiSymbols(prev => {
            const next = new Set(prev);
            if (next.has(base)) next.delete(base);
            else next.add(base);
            try { localStorage.setItem(SCREENER_AI_INSIGHT_SYMBOLS_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
            return next;
        });
    }, []);

    const aiInsightSymbols = aiInsightSymbolsProp ?? internalAiSymbols;
    const onToggleAiInsight = onToggleAiInsightProp ?? internalToggleAi;

    useEffect(() => {
        try {
            const raw = localStorage.getItem(SCREENER_FILTER_PRESETS_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as FilterPreset[];
                setPresets(Array.isArray(parsed) ? parsed : []);
            }
        } catch { /* ignore */ }
    }, []);

    const savePresetsToStorage = (next: FilterPreset[]) => {
        try { localStorage.setItem(SCREENER_FILTER_PRESETS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    };

    const [savePresetOpen, setSavePresetOpen] = useState(false);
    const [presetNameInput, setPresetNameInput] = useState("");

    const handleSavePreset = () => {
        if (filters.length === 0) return;
        setPresetNameInput("Custom");
        setSavePresetOpen(true);
    };

    const confirmSavePreset = () => {
        const name = presetNameInput?.trim() || "Custom";
        const id = Math.random().toString(36).substr(2, 9);
        const preset: FilterPreset = { id, name, filters: [...filters] };
        const next = [...presets, preset];
        setPresets(next);
        savePresetsToStorage(next);
        setSelectedPresetId(id);
        setSavePresetOpen(false);
        setFiltersOpen(false);
    };

    const loadPreset = (preset: FilterPreset) => {
        setFilters([...preset.filters]);
        setSelectedPresetId(preset.id);
    };

    const deletePreset = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const next = presets.filter(x => x.id !== id);
        setPresets(next);
        savePresetsToStorage(next);
        if (selectedPresetId === id) setSelectedPresetId(null);
    };

    const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({ ...ORION_DEFAULT_COLUMNS });

    const [columnOrder, setColumnOrder] = useState<string[]>([...DEFAULT_COLUMN_ORDER]);

    const [draggedColumnKey, setDraggedColumnKey] = useState<string | null>(null);

    useEffect(() => {
        if (!storageHydrated) return;
        try { localStorage.setItem(SCREENER_COLUMN_VISIBILITY_KEY, JSON.stringify(visibleColumns)); } catch { /* ignore */ }
    }, [visibleColumns, storageHydrated]);

    useEffect(() => {
        if (!storageHydrated) return;
        try { localStorage.setItem(SCREENER_COLUMN_ORDER_KEY, JSON.stringify(columnOrder)); } catch { /* ignore */ }
    }, [columnOrder, storageHydrated]);

    const handleColumnDragStart = (e: React.DragEvent, key: string) => {
        setDraggedColumnKey(key);
        e.dataTransfer.setData("text/plain", key);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleColumnDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleColumnDrop = (e: React.DragEvent, overKey: string) => {
        e.preventDefault();
        const key = e.dataTransfer.getData("text/plain");
        if (!key || key === overKey) return;
        setColumnOrder(prev => {
            const i = prev.indexOf(key);
            const j = prev.indexOf(overKey);
            if (i === -1 || j === -1) return prev;
            const next = [...prev];
            next.splice(i, 1);
            next.splice(j, 0, key);
            return next;
        });
        setDraggedColumnKey(null);
    };

    const handleColumnDragEnd = () => setDraggedColumnKey(null);

    const toggleFavorite = (key: string) => {
        setFavorites(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    useEffect(() => {
        if (!storageHydrated) return;
        try {
            localStorage.setItem(WATCHLIST_FAVORITES_KEY, JSON.stringify(Array.from(favorites)));
            window.dispatchEvent(new CustomEvent("watchlist-favorites-changed"));
        } catch { /* ignore */ }
    }, [favorites, storageHydrated]);

    const setPresetFromLabel = (label: string) => {
        const key = label.toLowerCase().replace(/\s+/g, "-") as Preset;
        setPreset(key);
    };

    const [colWidths, setColWidths] = useState<Record<string, number>>(() => sanitizeColumnWidths());

    useEffect(() => {
        if (!storageHydrated) return;
        try { localStorage.setItem(SCREENER_COLUMN_WIDTHS_KEY, JSON.stringify(colWidths)); } catch { /* ignore */ }
    }, [colWidths, storageHydrated]);

    useEffect(() => {
        try {
            const rawFavorites = localStorage.getItem(WATCHLIST_FAVORITES_KEY);
            if (rawFavorites) {
                const parsed = JSON.parse(rawFavorites) as unknown;
                if (Array.isArray(parsed)) {
                    setFavorites(new Set(parsed.filter((v): v is string => typeof v === "string")));
                }
            }

            const rawAiSymbols = localStorage.getItem(SCREENER_AI_INSIGHT_SYMBOLS_KEY);
            if (rawAiSymbols) {
                const parsed = JSON.parse(rawAiSymbols) as unknown;
                if (Array.isArray(parsed)) {
                    const arr = parsed
                        .filter((s): s is string => typeof s === "string")
                        .map((s) => (s.toUpperCase().replace(/\//g, "").endsWith("USDT") ? s.toUpperCase().replace(/\//g, "") : s.toUpperCase().replace(/\//g, "") + "USDT"));
                    setInternalAiSymbols(new Set(arr));
                }
            }

            const rawVisibility = localStorage.getItem(SCREENER_COLUMN_VISIBILITY_KEY);
            if (rawVisibility) {
                const parsed = JSON.parse(rawVisibility) as Record<string, boolean>;
                if (parsed && typeof parsed === "object") {
                    setVisibleColumns({ ...ORION_DEFAULT_COLUMNS, ...parsed });
                }
            }

            const rawOrder = localStorage.getItem(SCREENER_COLUMN_ORDER_KEY);
            if (rawOrder) {
                const parsed = JSON.parse(rawOrder) as string[];
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setColumnOrder(parsed);
                }
            }

            const rawWidths = localStorage.getItem(SCREENER_COLUMN_WIDTHS_KEY);
            if (rawWidths) {
                const parsed = JSON.parse(rawWidths) as Record<string, number>;
                if (parsed && typeof parsed === "object") {
                    setColWidths(sanitizeColumnWidths(parsed));
                }
            }
        } catch {
            // fall back to deterministic defaults
        } finally {
            setStorageHydrated(true);
        }
    }, []);

    const resizeStateRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);
    const onResizeStart = useCallback((e: React.MouseEvent, widthKey: string) => {
        e.preventDefault();
        e.stopPropagation();
        resizeStateRef.current = {
            key: widthKey,
            startX: e.clientX,
            startWidth: colWidths[widthKey] ?? 95,
        };

        const onMouseMove = (ev: MouseEvent) => {
            const st = resizeStateRef.current;
            if (!st) return;
            const delta = ev.clientX - st.startX;
            const next = clampColumnWidth(st.key, st.startWidth + delta);
            setColWidths(prev => (prev[st.key] === next ? prev : { ...prev, [st.key]: next }));
        };
        const onMouseUp = () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
            resizeStateRef.current = null;
        };
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
    }, [colWidths]);

    const applyFilter = (item: EnhancedTickerData, f: ScreenerFilter): boolean => {
        const raw = (item as any)[f.metric];
        let val: number;
        if (f.metric === "volume1h") val = ((item as any).volume1h ?? (item.volume24h || 0) / 24) || 0;
        else if (f.metric === "volume24h") val = item.volume24h || 0;
        else if (f.metric === "openInterest") val = item.openInterest || 0;
        else if (f.metric === "fundingRate") val = (item.fundingRate || 0) * 100; // Compare % value
        else if (f.metric === "momentumScore") val = item.momentumScore || 0;
        else if (f.metric === "rvol") val = (item as any).rvol || 0;
        else val = (raw ?? 0) as number;
        if (f.operator === "gt") return val > f.value;
        if (f.operator === "gte") return val >= f.value;
        if (f.operator === "lt") return val < f.value;
        if (f.operator === "lte") return val <= f.value;
        return true;
    };

    const filteredItems = useMemo(() => {
        let items = [...tickersList];
        if (search) {
            const low = search.toLowerCase();
            items = items.filter(i => i.symbol && i.symbol.toLowerCase().includes(low));
        }
        if (exchangeFilter !== "all") {
            items = items.filter(i => i.exchange === exchangeFilter);
        }
        if (preset !== "all") {
            if (preset === "high-volume") items = items.filter(i => (i.volume24h || 0) > 1e9);
            if (preset === "oi-spike") items = items.filter(i => (i.openInterest || 0) > 5e8);
            if (preset === "big-movers") items = items.filter(i => Math.abs(i.change1h || i.change24h || 0) > 2);
            if (preset === "high-funding") items = items.filter(i => Math.abs((i.fundingRate || 0) * 100) > 0.01);
        }
        filters.forEach(f => {
            items = items.filter(i => applyFilter(i, f));
        });
        items = items.sort((a, b) => {
            const factor = sortDir === "asc" ? 1 : -1;
            const valA = (a as unknown as Record<string, number>)[sortBy] ?? 0;
            const valB = (b as unknown as Record<string, number>)[sortBy] ?? 0;
            return (valA > valB ? 1 : -1) * factor;
        });
        items = items.filter((item, index, arr) =>
            arr.findIndex(i => i.symbol === item.symbol && i.exchange === item.exchange) === index
        );

        // Remove stale placeholder rows (price=0) when at least one live quote exists for same symbol.
        const hasLiveBySymbol = new Map<string, boolean>();
        for (const row of items) {
            if ((row.price || 0) > 0) hasLiveBySymbol.set(row.symbol, true);
        }
        items = items.filter((row) => {
            const price = Number(row.price || 0);
            if (price > 0) return true;
            // If any exchange has live quote for this symbol, hide zero placeholder rows.
            if (hasLiveBySymbol.get(row.symbol)) return false;
            // If this entire symbol has no live quote yet, keep row so user still sees coverage.
            return true;
        });
        return items;
    }, [tickersList, search, sortBy, sortDir, exchangeFilter, preset, filters]);

    const checkAlertsAllowedRef = useRef(false);
    useEffect(() => {
        const t = setTimeout(() => { checkAlertsAllowedRef.current = true; }, 2000);
        return () => clearTimeout(t);
    }, []);
    useEffect(() => {
        if (!isConnected || tickersList.length === 0) return;
        const interval = setInterval(() => {
            if (!checkAlertsAllowedRef.current) return;
            const prices: Record<string, number> = {};
            const metrics: Record<string, { change24h?: number; change15m?: number; change5m?: number; volume24h?: number; fundingRate?: number; momentumScore?: number; oiChange1h?: number; rvol?: number; trades15m?: number; volatility15m?: number; openInterest?: number }> = {};
            tickersList.forEach(t => {
                if (!t.symbol) return;
                prices[t.symbol] = t.price || 0;
                const rvol = (t as any).rvol ?? 0;
                metrics[t.symbol] = { change24h: t.change24h, change15m: t.change15m, change5m: t.change5m, volume24h: t.volume24h, fundingRate: t.fundingRate, momentumScore: t.momentumScore || 0, oiChange1h: (t as any).oiChange1h, rvol, trades15m: t.trades15m, volatility15m: t.volatility15m, openInterest: t.openInterest };
            });
            checkAlerts(prices, metrics);
            detectSignals?.(prices, metrics);
        }, 5000);
        return () => clearInterval(interval);
    }, [tickersList, isConnected, checkAlerts, detectSignals]);

    const handleSort = (field: string) => {
        if (sortBy === field) setSortDir(prev => prev === "asc" ? "desc" : "asc");
        else { setSortBy(field); setSortDir("desc"); }
    };

    const toggleColumn = (col: string) => {
        setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }));
    };

    const headerCellRender = ({ title, field, widthKey, align = "left", tooltip }: { title: string, field: string, widthKey: string, align?: "left" | "right"; tooltip?: string }) => (
        <div
            style={{ width: colWidths[widthKey] ?? 95, minWidth: colWidths[widthKey] ?? 95, maxWidth: colWidths[widthKey] ?? 95 }}
            className={cn("tm-market-header-cell px-2.5 h-9 flex items-center shrink-0 group/header cursor-pointer transition-colors relative select-none", align === "right" && "justify-end")}
            onClick={() => handleSort(field)}
            title={tooltip}
        >
            <div className="flex items-center gap-1">
                <span className="tm-market-header-label font-semibold text-[9px] uppercase tracking-[0.08em] text-zinc-500 group-hover/header:text-zinc-300 whitespace-nowrap">
                    {title}
                </span>
                {sortBy === field && (
                    <span className="text-[9px] text-cyan-300 font-bold">{sortDir === 'asc' ? '↑' : '↓'}</span>
                )}
            </div>
            <span className="pointer-events-none absolute right-0 top-1.5 bottom-1.5 w-px bg-white/12 group-hover/header:bg-cyan-300/70 transition-colors" />
            <button
                type="button"
                onMouseDown={(e) => onResizeStart(e, widthKey)}
                onClick={(e) => e.stopPropagation()}
                className="absolute -right-1.5 top-0 h-full w-3 cursor-col-resize z-20"
                title={`Resize ${title} (drag divider)`}
                aria-label={`Resize ${title}`}
            />
        </div>
    );

    const orderedVisibleColumns = useMemo(() => {
        const visible = (Object.keys(visibleColumns) as string[]).filter(k => k !== "market" && visibleColumns[k]);
        const orderSet = new Set(columnOrder);
        const ordered: string[] = columnOrder.filter(k => visible.includes(k));
        visible.forEach(k => { if (!orderSet.has(k)) ordered.push(k); });
        return ordered;
    }, [columnOrder, visibleColumns]);

    const draggableHeaderCell = (key: string) => {
        const config = HEADER_COLUMN_CONFIG[key];
        if (!config) return null;
        const width = colWidths[config.widthKey] ?? 95;
        const isDragging = draggedColumnKey === key;
        return (
            <div
                key={key}
                draggable
                onDragStart={(e) => handleColumnDragStart(e, key)}
                onDragOver={handleColumnDragOver}
                onDrop={(e) => handleColumnDrop(e, key)}
                onDragEnd={handleColumnDragEnd}
                className={cn(
                    "tm-market-header-cell px-2.5 h-9 flex items-center shrink-0 group/header cursor-pointer transition-colors relative select-none",
                    config.align === "right" && "justify-end",
                    isDragging && "opacity-50"
                )}
                style={{ width, minWidth: width, maxWidth: width }}
                title={config.tooltip}
            >
                <div className="flex items-center gap-1" onClick={() => handleSort(config.field)}>
                    <span className="tm-market-header-label font-semibold text-[9px] uppercase tracking-[0.1em] text-zinc-500 group-hover/header:text-zinc-200 whitespace-nowrap">
                        {config.title}
                    </span>
                    {sortBy === config.field && (
                        <span className="text-[9px] text-cyan-300 font-bold">{sortDir === 'asc' ? '↑' : '↓'}</span>
                    )}
                </div>
                <span className="pointer-events-none absolute right-0 top-1.5 bottom-1.5 w-px bg-white/12 group-hover/header:bg-cyan-300/65 transition-colors" />
                <button
                    type="button"
                    draggable={false}
                    onMouseDown={(e) => onResizeStart(e, config.widthKey)}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute -right-1.5 top-0 h-full w-3 cursor-col-resize z-20"
                    title={`Resize ${config.title} (drag divider)`}
                    aria-label={`Resize ${config.title}`}
                />
            </div>
        );
    };

    return (
        <div className="tm-market-table-shell tm-premium-card h-full w-full flex flex-col bg-zinc-950/90 overflow-hidden rounded-2xl border border-white/10 clone-shell clone-divider">
            {!hideToolbar && (
            <div className="tm-market-toolbar relative flex items-center justify-between px-4 py-2.5 flex-shrink-0 bg-zinc-900/80 border-b border-white/10">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="relative shrink-0">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                        <Input
                            placeholder="Search symbols..."
                            className="w-[168px] h-8 bg-zinc-900/80 border-white/12 pl-8 text-[11px] text-zinc-200 placeholder:text-zinc-500 focus:bg-zinc-800 focus:border-cyan-400/45 transition-all rounded-lg"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest shrink-0">
                        <span className="text-zinc-300 font-mono">{filteredItems.length}</span>/<span className="font-mono">{tickersList.length}</span> SYMBOLS
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                        {["All", "High Volume", "OI Spike", "Big Movers", "High Funding"].map(label => {
                            const key = label.toLowerCase().replace(/\s+/g, "-") as Preset;
                            const active = preset === key;
                            return (
                                <button
                                    key={label}
                                    type="button"
                                    className={cn(
                                        "tm-market-preset h-7 px-3 text-[10px] font-black uppercase tracking-wider rounded-lg border transition-all",
                                        active
                                            ? "bg-white/14 text-white border-white/25"
                                            : "text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-white/5"
                                    )}
                                    onClick={() => setPresetFromLabel(label)}
                                >
                                    {label === "All" ? "ALL" : label.toUpperCase().replace(/\s+/g, " ")}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex items-center gap-2 pr-1 shrink-0">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 bg-zinc-800/80 border-white/10 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors gap-2 rounded px-3">
                                <Save className="h-3 w-3" />
                                <span className="font-bold">Saved: {presets.find(p => p.id === selectedPresetId)?.name ?? "—"}</span>
                                <ChevronDown className="h-3 w-3 opacity-30" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-zinc-900 border-white/10 w-52 text-zinc-400">
                            <DropdownMenuLabel className="text-[10px] font-black uppercase text-zinc-500 p-2">Filter presets</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-white/5" />
                            <DropdownMenuItem
                                onClick={() => {
                                    setFilters([]);
                                    setFiltersOpen(true);
                                }}
                                className="py-2 gap-2 hover:bg-white/5 focus:bg-white/5 text-amber-400"
                            >
                                <Plus className="h-3 w-3" />
                                Create custom filter
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-white/5" />
                            {presets.length === 0 ? (
                                <div className="px-2 py-4 text-[11px] text-zinc-500">No saved presets</div>
                            ) : (
                                presets.map(p => (
                                    <DropdownMenuItem key={p.id} onClick={() => loadPreset(p)} className="py-2 flex items-center justify-between gap-2 hover:bg-white/5 focus:bg-white/5">
                                        <div className="flex flex-col">
                                            <span className={cn("text-[11px] font-bold", selectedPresetId === p.id && "text-amber-400")}>{p.name}</span>
                                            <span className="text-[9px] text-zinc-500">{p.filters.length} filters</span>
                                        </div>
                                        <button onClick={(e) => { e.stopPropagation(); deletePreset(p.id, e); }} className="p-1 hover:text-rose-400 text-zinc-500">
                                            <X className="h-3 w-3" />
                                        </button>
                                    </DropdownMenuItem>
                                ))
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button variant="outline" size="sm" className="h-8 bg-zinc-800/80 border-white/10 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors gap-2 rounded px-3 disabled:opacity-50" onClick={handleSavePreset} disabled={filters.length === 0} title={filters.length === 0 ? "Add filters first" : "Save current filters as preset"}>
                        <Save className="h-3 w-3" />
                        Save
                    </Button>

                    <div className="relative">
                        <Button variant="outline" size="icon" className="h-8 w-8 bg-zinc-800/80 border-white/10 text-zinc-400 hover:text-zinc-200 relative" onClick={() => setFiltersOpen(!filtersOpen)}>
                            <Filter className="h-3.5 w-3.5" />
                            {filters.length > 0 && (
                                <div className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-primary text-primary-foreground text-[8px] font-bold flex items-center justify-center rounded-full border border-card">
                                    {filters.length}
                                </div>
                            )}
                        </Button>
                        <FiltersPanel open={filtersOpen} onClose={() => setFiltersOpen(false)} filters={filters} onFiltersChange={setFilters} onSaveAsPreset={() => setSavePresetOpen(true)} />
                    </div>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="icon" className="h-8 w-8 bg-zinc-800/80 border-white/10 text-zinc-400 hover:text-zinc-200">
                                <Columns3 className="h-3.5 w-3.5" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[480px] bg-zinc-900 border-white/10 shadow-2xl p-0 overflow-hidden" align="end">
                            <div className="flex items-center justify-between p-4 border-b border-white/10">
                                <h3 className="text-[12px] font-bold text-zinc-200">Column Visibility</h3>
                                <PopoverClose asChild>
                                    <button className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-white/10 transition-colors">
                                        <X className="h-4 w-4" />
                                    </button>
                                </PopoverClose>
                            </div>
                            <div className="p-4 max-h-[500px] overflow-y-auto custom-scrollbar space-y-6">
                                {COLUMN_GROUPS.map((group, idx) => (
                                    <div
                                        key={group.title}
                                        className={cn(
                                            "space-y-3 pb-4",
                                            idx < COLUMN_GROUPS.length - 1 && "border-b border-white/10"
                                        )}
                                    >
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-[10px] font-black text-zinc-500 tracking-widest">{group.title}</h4>
                                            {group.showAll && (
                                                <button
                                                    onClick={() => {
                                                        const updates = { ...visibleColumns };
                                                        group.columns.forEach(c => { if (!c.disabled) updates[c.key] = true; });
                                                        setVisibleColumns(updates);
                                                    }}
                                                    className="text-[10px] font-bold text-amber-400 hover:underline"
                                                >
                                                    Show All
                                                </button>
                                            )}
                                        </div>
                                        <div className={cn("gap-2 grid", group.showAll ? "grid-cols-7" : "grid-cols-3")}>
                                            {group.columns.map((col: ColumnDef) => (
                                                <div key={col.key} className="flex items-center gap-2 bg-white/5 p-2 rounded hover:bg-white/10 transition-colors cursor-pointer group/col border border-white/5"
                                                    onClick={() => !col.disabled && toggleColumn(col.key)}>
                                                    <Checkbox
                                                        checked={col.key === 'market' ? true : !!visibleColumns[col.key]}
                                                        disabled={col.disabled}
                                                        className="h-3.5 w-3.5 border-zinc-600 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                                                    />
                                                    <span className={cn("text-[11px] font-bold truncate",
                                                        (col.key === 'market' || !!visibleColumns[col.key]) ? "text-zinc-200" : "text-zinc-500"
                                                    )}>{col.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="p-4 bg-zinc-800/50 border-t border-white/10 flex items-center gap-2">
                                <Button
                                    className="flex-1 h-8 bg-white/5 hover:bg-white/10 text-[11px] font-bold text-zinc-400 hover:text-zinc-200"
                                    onClick={() => {
                                        const allCols: Record<string, boolean> = { market: true };
                                        COLUMN_GROUPS.forEach(g => g.columns.forEach(c => {
                                            if (!c.disabled) allCols[c.key] = true;
                                        }));
                                        setVisibleColumns(allCols);
                                    }}
                                >
                                    All
                                </Button>
                                <Button
                                    className="flex-1 h-8 bg-white/5 hover:bg-white/10 text-[11px] font-bold text-zinc-400 hover:text-zinc-200"
                                    onClick={() => setVisibleColumns({ ...ORION_DEFAULT_COLUMNS })}
                                >
                                    Defaults
                                </Button>
                                <Button
                                    className="flex-1 h-8 bg-white/5 hover:bg-white/10 text-[11px] font-bold text-zinc-400 hover:text-zinc-200"
                                    onClick={() => setVisibleColumns({ ...ORION_CORE_ONLY })}
                                >
                                    Core Only
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>

                    <div className="flex items-center border border-white/10 rounded overflow-hidden h-8">
                        <Button variant="ghost" size="icon" className="h-full w-8 border-r border-white/10 text-zinc-500 bg-zinc-800/50 rounded-none hover:text-zinc-300">
                            <LayoutGrid className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-full w-8 text-zinc-500 hover:text-zinc-200 rounded-none"
                            onClick={onOpenAlerts}
                        >
                            <Bell className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            </div>
            )}

            <Dialog open={savePresetOpen} onOpenChange={setSavePresetOpen}>
                <DialogContent className="bg-card border-border sm:max-w-[340px]">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-bold">Save Filter Preset</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                        <Input
                            placeholder="Preset name"
                            value={presetNameInput}
                            onChange={e => setPresetNameInput(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && confirmSavePreset()}
                            className="h-9 bg-muted/30 border-border text-[11px]"
                        />
                    </div>
                    <DialogFooter className="gap-2 pt-2">
                        <Button variant="outline" size="sm" className="h-8" onClick={() => setSavePresetOpen(false)}>Cancel</Button>
                        <Button size="sm" className="h-8" onClick={confirmSavePreset}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="tm-market-header-row flex items-center h-9 flex-shrink-0 border-b border-white/10 px-2 bg-zinc-900/85 z-10">
                {headerCellRender({ title: "SYMBOL", field: "symbol", widthKey: "market", tooltip: "Trading pair and exchange" })}
                {orderedVisibleColumns.map(k => draggableHeaderCell(k))}
                <div className="tm-market-header-filler h-full flex-1 min-w-[20px]" />
            </div>

            <div className="flex-1 min-h-0 relative px-2">
                {filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center absolute inset-0 text-zinc-500 bg-zinc-950/80">
                        {tickersList.length === 0 ? (
                            <>
                                <div className="h-10 w-10 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin mb-4" />
                                <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Connecting to exchanges</p>
                                <p className="text-[10px] mt-1 text-zinc-600">Binance · Hyperliquid · Bybit</p>
                            </>
                        ) : (
                            <>
                                <BarChart3 className="h-12 w-12 text-zinc-600 mb-4" />
                                <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">No symbols match</p>
                                <p className="text-[10px] mt-1 text-zinc-600">Try adjusting filters or search</p>
                            </>
                        )}
                    </div>
                ) : (
                    <AutoSizer
                        renderProp={({ height, width }) => (
                            <List<RowProps>
                                rowCount={filteredItems.length}
                                rowHeight={40}
                                rowComponent={Row as any}
                                rowProps={{
                                    items: filteredItems,
                                    selectedSymbol,
                                    signals: signals as any,
                                    onSelect,
                                    colWidths,
                                    isCompact,
                                    visibleColumns,
                                    columnOrder: orderedVisibleColumns,
                                    addAlert: addAlert as any,
                                    favorites,
                                    toggleFavorite,
                                    preset,
                                    aiInsightSymbols,
                                    onToggleAiInsight,
                                }}
                                style={{ height, width }}
                                className="custom-scrollbar"
                            />
                        )}
                    />
                )}
            </div>
        </div>
    );
});
