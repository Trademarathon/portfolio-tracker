"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Filter, Save, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";

export interface ScreenerFilter {
    id: string;
    metric: string;
    label: string;
    operator: "gt" | "lt" | "gte" | "lte";
    value: number;
}

// Grouped metric categories (reference: Core, CHANGE %, Volume, Trades, Volatility, OI CHANGE %, etc.)
const FILTER_METRICS: { category: string; options: { key: string; label: string; unit?: string }[] }[] = [
    { category: "Core", options: [{ key: "price", label: "Price", unit: "$" }, { key: "openInterest", label: "OI $", unit: "$" }, { key: "fundingRate", label: "Funding", unit: "%" }, { key: "rvol", label: "RVOL", unit: "x" }, { key: "mcap", label: "MCAP", unit: "$" }, { key: "momentumScore", label: "Momentum", unit: "x" }] },
    { category: "CHANGE %", options: [{ key: "change5m", label: "CHG % (5m)" }, { key: "change15m", label: "CHG % (15m)" }, { key: "change1h", label: "CHG % (1h)" }, { key: "change4h", label: "CHG % (4h)" }, { key: "change8h", label: "CHG % (8h)" }, { key: "change12h", label: "CHG % (12h)" }, { key: "change24h", label: "CHG % (1d)" }] },
    { category: "CHANGE $", options: [{ key: "changeUsd5m", label: "CHG $ (5m)" }, { key: "changeUsd15m", label: "CHG $ (15m)" }, { key: "changeUsd1h", label: "CHG $ (1h)" }, { key: "changeUsd4h", label: "CHG $ (4h)" }, { key: "changeUsd8h", label: "CHG $ (8h)" }, { key: "changeUsd12h", label: "CHG $ (12h)" }, { key: "changeUsd1d", label: "CHG $ (1d)" }] },
    { category: "Volume", options: [{ key: "volume5m", label: "Vol (5m)", unit: "$" }, { key: "volume15m", label: "Vol (15m)", unit: "$" }, { key: "volume1h", label: "Vol (1h)", unit: "$" }, { key: "volume4h", label: "Vol (4h)", unit: "$" }, { key: "volume8h", label: "Vol (8h)", unit: "$" }, { key: "volume12h", label: "Vol (12h)", unit: "$" }, { key: "volume24h", label: "Vol (1d)", unit: "$" }] },
    { category: "Trades", options: [{ key: "trades5m", label: "Trd (5m)" }, { key: "trades15m", label: "Trd (15m)" }, { key: "trades1h", label: "Trd (1h)" }, { key: "trades4h", label: "Trd (4h)" }, { key: "trades8h", label: "Trd (8h)" }, { key: "trades12h", label: "Trd (12h)" }, { key: "trades1d", label: "Trd (1d)" }] },
    { category: "Volatility", options: [{ key: "volatility5m", label: "Vlt (5m)", unit: "%" }, { key: "volatility15m", label: "Vlt (15m)", unit: "%" }, { key: "volatility1h", label: "Vlt (1h)", unit: "%" }, { key: "volatility4h", label: "Vlt (4h)", unit: "%" }, { key: "volatility8h", label: "Vlt (8h)", unit: "%" }, { key: "volatility12h", label: "Vlt (12h)", unit: "%" }, { key: "volatility1d", label: "Vlt (1d)", unit: "%" }] },
    { category: "OI CHANGE %", options: [{ key: "oiChange5m", label: "OI CHG % (5m)" }, { key: "oiChange15m", label: "OI CHG % (15m)" }, { key: "oiChange1h", label: "OI CHG % (1h)" }, { key: "oiChange4h", label: "OI CHG % (4h)" }, { key: "oiChange8h", label: "OI CHG % (8h)" }, { key: "oiChange12h", label: "OI CHG % (12h)" }, { key: "oiChange1d", label: "OI CHG % (1d)" }] },
    { category: "OI CHANGE $", options: [{ key: "oiChangeUsd5m", label: "OI CHG $ (5m)" }, { key: "oiChangeUsd15m", label: "OI CHG $ (15m)" }, { key: "oiChangeUsd1h", label: "OI CHG $ (1h)" }, { key: "oiChangeUsd4h", label: "OI CHG $ (4h)" }, { key: "oiChangeUsd8h", label: "OI CHG $ (8h)" }, { key: "oiChangeUsd12h", label: "OI CHG $ (12h)" }, { key: "oiChangeUsd1d", label: "OI CHG $ (1d)" }] },
    { category: "CVD", options: [{ key: "cvd5m", label: "CVD (5m)" }, { key: "cvd15m", label: "CVD (15m)" }, { key: "cvd1h", label: "CVD (1h)" }, { key: "cvd4h", label: "CVD (4h)" }, { key: "cvd8h", label: "CVD (8h)" }, { key: "cvd12h", label: "CVD (12h)" }, { key: "cvd1d", label: "CVD (1d)" }] },
    { category: "VOL CHANGE %", options: [{ key: "volChgPct5m", label: "VOL CHG % (5m)" }, { key: "volChgPct15m", label: "VOL CHG % (15m)" }, { key: "volChgPct1h", label: "VOL CHG % (1h)" }, { key: "volChgPct4h", label: "VOL CHG % (4h)" }, { key: "volChgPct8h", label: "VOL CHG % (8h)" }, { key: "volChgPct12h", label: "VOL CHG % (12h)" }, { key: "volChgPct1d", label: "VOL CHG % (1d)" }] },
    { category: "VOL CHANGE $", options: [{ key: "volChgUsd5m", label: "VOL CHG $ (5m)" }, { key: "volChgUsd15m", label: "VOL CHG $ (15m)" }, { key: "volChgUsd1h", label: "VOL CHG $ (1h)" }, { key: "volChgUsd4h", label: "VOL CHG $ (4h)" }, { key: "volChgUsd8h", label: "VOL CHG $ (8h)" }, { key: "volChgUsd12h", label: "VOL CHG $ (12h)" }, { key: "volChgUsd1d", label: "VOL CHG $ (1d)" }] },
    { category: "BTC CORR", options: [{ key: "btcCorr5m", label: "COR (5m)" }, { key: "btcCorr15m", label: "COR (15m)" }, { key: "btcCorr1h", label: "COR (1h)" }, { key: "btcCorr4h", label: "COR (4h)" }, { key: "btcCorr8h", label: "COR (8h)" }, { key: "btcCorr12h", label: "COR (12h)" }, { key: "btcCorr1d", label: "COR (1d)" }] },
];

const OPERATORS: { value: ScreenerFilter["operator"]; label: string }[] = [
    { value: "gt", label: ">" },
    { value: "gte", label: "≥" },
    { value: "lt", label: "<" },
    { value: "lte", label: "≤" },
];

function formatFilterDisplay(f: ScreenerFilter): string {
    const meta = FILTER_METRICS.flatMap(g => g.options).find(o => o.key === f.metric);
    const label = meta?.label || f.label;
    const op = f.operator === "gt" ? ">" : f.operator === "gte" ? "≥" : f.operator === "lt" ? "<" : "≤";
    const val = f.metric === "fundingRate"
        ? f.value + "%"
        : f.metric === "rvol" || f.metric === "momentumScore"
            ? `${f.value.toFixed(2)}x`
            : f.value >= 1e6
                ? (f.value / 1e6).toFixed(0) + "M"
                : f.value >= 1e3
                    ? (f.value / 1e3).toFixed(0) + "K"
                    : f.value;
    return `${label} ${op} ${val}`;
}

export function FiltersPanel({
    open,
    onClose,
    filters,
    onFiltersChange,
    onSaveAsPreset,
}: {
    open: boolean;
    onClose: () => void;
    filters: ScreenerFilter[];
    onFiltersChange: (f: ScreenerFilter[]) => void;
    onSaveAsPreset?: () => void;
}) {
    const [selectedMetric, setSelectedMetric] = useState(FILTER_METRICS[0]!.options[0]!.key);
    const [operator, setOperator] = useState<ScreenerFilter["operator"]>("gt");
    const [value, setValue] = useState("");
    const panelRef = useRef<HTMLDivElement>(null);

    const addFilter = () => {
        const num = parseFloat(value);
        if (Number.isNaN(num)) return;
        const finalVal = num;
        const meta = FILTER_METRICS.flatMap(g => g.options).find(o => o.key === selectedMetric);
        const newFilter: ScreenerFilter = {
            id: Math.random().toString(36).substr(2, 9),
            metric: selectedMetric,
            label: meta?.label || selectedMetric,
            operator,
            value: finalVal,
        };
        onFiltersChange([...filters, newFilter]);
        setValue("");
    };

    const removeFilter = (id: string) => {
        onFiltersChange(filters.filter(f => f.id !== id));
    };

    const clearAll = () => {
        onFiltersChange([]);
    };

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
                        onClick={onClose}
                        aria-hidden="true"
                    />
                    <motion.div
                        ref={panelRef}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="absolute right-0 top-full mt-1 w-[320px] max-w-[calc(100vw-2rem)] bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                    <div className="p-4 border-b border-border flex items-center justify-between">
                        <h3 className="text-[12px] font-bold text-foreground uppercase tracking-tight">Filters</h3>
                        <button onClick={onClose} className="p-1 hover:text-foreground text-muted-foreground transition-colors">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <ScrollArea className="max-h-[400px]">
                        <div className="p-4 space-y-4">
                            {filters.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Active filters</span>
                                        <button onClick={clearAll} className="text-[10px] font-bold text-primary hover:underline">
                                            Clear all
                                        </button>
                                    </div>
                                    <div className="space-y-1.5">
                                        {filters.map(f => (
                                            <div key={f.id} className="flex items-center justify-between py-1.5 px-2 bg-muted/20 rounded-lg group">
                                                <span className="text-[11px] font-mono text-foreground truncate">{formatFilterDisplay(f)}</span>
                                                <button onClick={() => removeFilter(f.id)} className="p-1 hover:text-destructive text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3 pt-2 border-t border-border">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">Add filter</span>
                                <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                                    <SelectTrigger className="h-9 bg-muted/30 border-border text-[11px] font-bold text-foreground">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border max-h-[300px]">
                                        {FILTER_METRICS.map(group => (
                                            <div key={group.category}>
                                                <div className="px-2 py-1.5 text-[9px] font-black text-muted-foreground uppercase tracking-widest">{group.category}</div>
                                                {group.options.map(opt => (
                                                    <SelectItem key={opt.key} value={opt.key} className="text-[11px] font-bold py-2 data-[highlighted]:bg-primary/20">
                                                        {opt.label}
                                                    </SelectItem>
                                                ))}
                                            </div>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <div className="flex gap-2">
                                    <Select value={operator} onValueChange={v => setOperator(v as ScreenerFilter["operator"])}>
                                        <SelectTrigger className="h-9 w-16 bg-muted/30 border-border text-[11px] font-bold">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {OPERATORS.map(o => (
                                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Input
                                        type="number"
                                        step={selectedMetric === "fundingRate" ? 0.0001 : selectedMetric === "openInterest" || selectedMetric.includes("volume") ? 1000 : 0.01}
                                        placeholder="Value"
                                        value={value}
                                        onChange={e => setValue(e.target.value)}
                                        className="h-9 flex-1 bg-muted/30 border-border text-[11px] font-mono"
                                    />
                                </div>
                                <Button onClick={addFilter} className="w-full h-9 bg-primary hover:bg-primary/90 text-primary-foreground text-[11px] font-bold">
                                    Add Filter
                                </Button>
                                {onSaveAsPreset && (
                                    <Button
                                        variant="outline"
                                        onClick={onSaveAsPreset}
                                        disabled={filters.length === 0}
                                        className="w-full h-9 border-white/10 text-[11px] font-bold"
                                        title={filters.length === 0 ? "Add at least one filter to save as preset" : "Save current filters as a preset"}
                                    >
                                        <Save className="h-3 w-3 mr-1.5" />
                                        Save as preset
                                    </Button>
                                )}
                            </div>
                        </div>
                    </ScrollArea>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
