"use client";

import React, { useState, useEffect } from "react";
import { Alert, useAlerts, AlertCondition, AlertConditionType, AlertConditionOperator } from "@/hooks/useAlerts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
    Bell,
    X,
    Trash2,
    Plus,
    History as HistoryIcon,
    Pencil,
    ChevronDown,
    ChevronRight,
    LayoutTemplate,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { SCREENER_ALERT_PRESETS } from "@/lib/screenerAlertPresets";

const SCREENER_ALERT_SETTINGS_KEY = "screener_alert_settings";

interface ScreenerAlertSettings {
    browserNotifications: boolean;
}

const EXCHANGE_BADGES: Record<string, { label: string; className: string }> = {
    binance: { label: "BIN", className: "bg-amber-500/20 text-amber-400 border-amber-500/40" },
    hyperliquid: { label: "HL", className: "bg-purple-500/20 text-purple-400 border-purple-500/40" },
    bybit: { label: "BY", className: "bg-orange-500/20 text-orange-400 border-orange-500/40" },
};

// Orion-style condition types; "outside" uses en-dash for readability
const fmtOutsidePct = (c: AlertCondition) => `outside ${c.targetMin ?? 0}%–${c.targetMax ?? 0}%`;
const CONDITION_TYPES: { value: AlertConditionType | string; label: string; format: (c: AlertCondition) => string }[] = [
    { value: "trd_15m", label: "TRD 15M", format: c => `${c.operator === "lt" ? "<" : ">"} ${c.target?.toLocaleString()}` },
    { value: "chg_15m", label: "CHG % 15M", format: c => c.operator === "outside" ? fmtOutsidePct(c) : `${c.operator === "lt" ? "<" : ">"} ${c.target}%` },
    { value: "chg_5m", label: "CHG % 5M", format: c => c.operator === "outside" ? fmtOutsidePct(c) : `${c.operator === "lt" ? "<" : ">"} ${c.target}%` },
    { value: "rvol", label: "RVOL", format: c => `> ${(c.target ?? 0).toFixed(2)}x` },
    { value: "oi", label: "OI", format: c => `> $${(c.target ?? 0) >= 1 ? (c.target ?? 0).toFixed(2) + "M" : ((c.target ?? 0) * 1000).toFixed(2) + "K"}` },
    { value: "oi_chg_15m", label: "OI CHG % 15M", format: c => c.operator === "outside" ? fmtOutsidePct(c) : `${c.operator === "lt" ? "<" : ">"} ${c.target}%` },
    { value: "oi_chg_1h", label: "OI CHG % 1h", format: c => c.operator === "outside" ? fmtOutsidePct(c) : `${c.operator === "lt" ? "<" : ">"} ${c.target}%` },
    { value: "vlt_15m", label: "VLT 15M", format: c => `> ${c.target}%` },
    { value: "funding", label: "FUNDING", format: c => `${c.operator === "lt" ? "<" : ">"} ${(c.target ?? 0) >= 0 ? "+" : ""}${(c.target ?? 0).toFixed(4)}%` },
    { value: "price_above", label: "Price Above", format: c => `> $${c.target?.toLocaleString()}` },
    { value: "price_below", label: "Price Below", format: c => `< $${c.target?.toLocaleString()}` },
    { value: "cvd_15m", label: "CVD 15M", format: c => c.operator === "outside" ? `outside $${((c.targetMin ?? 0) / 1000).toFixed(2)}M–$${((c.targetMax ?? 0) / 1000).toFixed(2)}M` : `${c.operator === "lt" ? "<" : ">"} $${(c.target ?? 0) >= 1000 ? ((c.target ?? 0) / 1000).toFixed(2) + "M" : (c.target ?? 0) + "K"}` },
    { value: "mcap", label: "MCAP", format: c => c.operator === "outside" ? `outside $${(c.targetMin ?? 0)}M–$${(c.targetMax ?? 0)}M` : `${c.operator === "lt" ? "<" : ">"} $${(c.target ?? 0).toFixed(2)}M` },
];

const SOUND_OPTIONS = [
    { value: "none", label: "None" },
    { value: "bell", label: "Bell" },
    { value: "crypto", label: "Hacker Synth" },
];

function formatConditionDisplay(c: AlertCondition, logic: string): string {
    const meta = CONDITION_TYPES.find(t => t.value === c.type);
    const condStr = meta ? `${meta.label} ${meta.format(c)}` : `${c.type} ${c.target}`;
    return condStr;
}

function formatAlertScope(alert: Alert): string {
    if (alert.symbols?.length) return alert.symbols.join(" / ");
    return alert.symbol === "GLOBAL" ? "All Symbols" : alert.symbol;
}

export function AlertsSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { alerts, signals, removeAlert, toggleAlert, addAlert, updateAlert, clearSignals } = useAlerts();
    const [view, setView] = useState<"list" | "create" | "edit">("list");
    const [activeTab, setActiveTab] = useState<"active" | "history">("active");
    const [editingId, setEditingId] = useState<string | null>(null);

    const [settings, setSettings] = useState<ScreenerAlertSettings>({ browserNotifications: false });
    const [alertName, setAlertName] = useState("");
    const [symbol, setSymbol] = useState("");
    const [symbolsInput, setSymbolsInput] = useState("");
    const [exchange, setExchange] = useState<"binance" | "hyperliquid" | "bybit">("binance");
    const [logic, setLogic] = useState<"AND" | "OR">("AND");
    const [repeat, setRepeat] = useState(false);
    const [sound, setSound] = useState(false);
    const [conditions, setConditions] = useState<AlertCondition[]>([{ type: "trd_15m", target: 0, operator: "gt" }]);
    const [presetsOpen, setPresetsOpen] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem(SCREENER_ALERT_SETTINGS_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setSettings(prev => ({ ...prev, ...parsed }));
            } catch {}
        }
    }, []);

    const saveSettings = (updates: Partial<ScreenerAlertSettings>) => {
        const next = { ...settings, ...updates };
        setSettings(next);
        localStorage.setItem(SCREENER_ALERT_SETTINGS_KEY, JSON.stringify(next));
    };

    const resetForm = () => {
        setAlertName("");
        setSymbol("");
        setSymbolsInput("");
        setConditions([{ type: "trd_15m", target: 0, operator: "gt" }]);
        setRepeat(false);
        setSound(false);
        setEditingId(null);
    };

    const createFromPreset = (preset: (typeof SCREENER_ALERT_PRESETS)[0]) => {
        const conditions: AlertCondition[] = preset.conditions.map(c => ({
            type: c.type as AlertCondition["type"],
            operator: (c.operator ?? "gt") as AlertCondition["operator"],
            target: c.target ?? 0,
            targetMin: c.targetMin,
            targetMax: c.targetMax,
        }));
        const symbolOrGlobal = preset.symbols?.length ? preset.symbols[0] : preset.symbol;
        const count = alerts.filter(a => a.name === preset.name).length;
        const name = count === 0 ? preset.name : `${preset.name} (${count + 1})`;
        addAlert(symbolOrGlobal, conditions, preset.logic, {
            name,
            exchange: preset.exchange,
            repeat: preset.repeat,
            sound: preset.sound,
            symbols: preset.symbols,
        });
        setView("list");
    };

    const handleCreate = () => {
        const validConditions = conditions.filter(c => (c.operator === "outside" ? (c.targetMin != null && c.targetMax != null) : c.target !== undefined && c.target !== null));
        if (validConditions.length === 0) return;
        const raw = symbolsInput?.trim().split(/[\s,]+/).filter(Boolean) || [];
        const syms = raw.map(s => (s.toUpperCase().endsWith("USDT") ? s.toUpperCase() : s.toUpperCase() + "USDT"));
        const symbolOrGlobal = syms.length ? syms[0] : (symbol?.trim() || "GLOBAL");
        addAlert(symbolOrGlobal, validConditions, logic, {
            name: alertName || undefined,
            exchange,
            repeat,
            sound,
            symbols: syms.length ? syms : undefined,
        });
        setView("list");
        resetForm();
    };

    const startEdit = (alert: Alert) => {
        setEditingId(alert.id);
        setAlertName(alert.name || "");
        setSymbol(alert.symbol === "GLOBAL" ? "" : alert.symbol);
        setSymbolsInput(alert.symbols?.join(", ") || "");
        setExchange((alert.exchange as any) || "binance");
        setLogic(alert.logic);
        setRepeat(!!alert.repeat);
        setSound(!!alert.sound);
        setConditions(alert.conditions.length ? alert.conditions : [{ type: "trd_15m", target: 0, operator: "gt" }]);
        setView("edit");
    };

    const handleUpdate = () => {
        if (!editingId) return;
        const validConditions = conditions.filter(c => (c.operator === "outside" ? (c.targetMin != null && c.targetMax != null) : c.target !== undefined && c.target !== null));
        if (validConditions.length === 0) return;
        const raw = symbolsInput?.trim().split(/[\s,]+/).filter(Boolean) || [];
        const syms = raw.map(s => (s.toUpperCase().endsWith("USDT") ? s.toUpperCase() : s.toUpperCase() + "USDT"));
        updateAlert(editingId, {
            name: alertName || undefined,
            symbol: syms.length ? syms[0] : symbol || "GLOBAL",
            symbols: syms.length ? syms : undefined,
            exchange,
            conditions: validConditions,
            logic,
            repeat,
            sound,
        });
        setView("list");
        resetForm();
    };

    const updateCondition = (index: number, updates: Partial<AlertCondition>) => {
        setConditions(prev => prev.map((c, i) => (i === index ? { ...c, ...updates } : c)));
    };

    const addCondition = () => {
        setConditions(prev => [...prev, { type: "trd_15m", target: 0, operator: "gt" }]);
    };

    const removeCondition = (index: number) => {
        setConditions(prev => prev.filter((_, i) => i !== index));
    };

    const getLogicSummary = () => {
        return conditions
            .map(c => {
                const meta = CONDITION_TYPES.find(t => t.value === c.type);
                return meta ? `${meta.label} ${meta.format(c)}` : "";
            })
            .filter(Boolean)
            .join(` ${logic} `);
    };

    const supportsOperator = (t: string) => ["chg_15m", "chg_5m", "oi_chg_15m", "oi_chg_1h", "funding", "price_above", "price_below", "cvd_15m", "mcap"].includes(t);

    const ConditionForm = (cond: AlertCondition, i: number) => (
        <div key={i} className="flex gap-2 items-center flex-wrap">
            <Select value={cond.type} onValueChange={v => updateCondition(i, { type: v as any, operator: supportsOperator(v) ? (cond.operator || "gt") : undefined })}>
                <SelectTrigger className="h-8 flex-1 min-w-[120px] bg-muted/30 border-border text-[10px] font-bold text-foreground rounded">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                    {CONDITION_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value} className="text-[10px]">
                            {t.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {supportsOperator(cond.type) && (
                <Select value={cond.operator || "gt"} onValueChange={v => updateCondition(i, { operator: v as AlertConditionOperator })}>
                    <SelectTrigger className="h-8 w-20 bg-muted/30 border-border text-[10px] font-bold rounded">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="gt">&gt;</SelectItem>
                        <SelectItem value="lt">&lt;</SelectItem>
                        <SelectItem value="outside">outside</SelectItem>
                    </SelectContent>
                </Select>
            )}
            {cond.operator === "outside" && supportsOperator(cond.type) ? (
                <div className="flex gap-1 items-center">
                    <Input type="number" step={0.01} value={cond.targetMin ?? ""} onChange={e => updateCondition(i, { targetMin: parseFloat(e.target.value) || 0 })} className="h-8 w-16 bg-muted/30 border-border text-[10px] rounded" placeholder="Min %" />
                    <span className="text-[10px] text-muted-foreground">-</span>
                    <Input type="number" step={0.01} value={cond.targetMax ?? ""} onChange={e => updateCondition(i, { targetMax: parseFloat(e.target.value) || 0 })} className="h-8 w-16 bg-muted/30 border-border text-[10px] rounded" placeholder="Max %" />
                </div>
            ) : (
                <Input type="number" step={cond.type === "oi" || cond.type === "mcap" ? 0.1 : cond.type === "cvd_15m" ? 1 : 0.01} value={cond.target ?? ""} onChange={e => updateCondition(i, { target: parseFloat(e.target.value) || 0 })} className="h-8 w-20 bg-muted/30 border-border text-[10px] font-mono rounded" placeholder={cond.type === "oi" || cond.type === "mcap" ? "M (e.g. 20)" : cond.type === "cvd_15m" ? "K (e.g. 500)" : "Value"} />
            )}
            {conditions.length > 1 && (
                <button onClick={() => removeCondition(i)} className="p-1 hover:text-destructive text-muted-foreground">
                    <Trash2 className="h-3 w-3" />
                </button>
            )}
        </div>
    );

    return (
        <AnimatePresence>
            {open && (
                <motion.div initial={{ x: 400 }} animate={{ x: 0 }} exit={{ x: 400 }} className="fixed right-0 top-0 h-screen w-[400px] bg-card border-l border-border z-[100] shadow-2xl flex flex-col pt-16">
                    <div className="p-4 flex items-center justify-between border-b border-border">
                        <div className="flex items-center gap-2">
                            <h2 className="text-[15px] font-black text-foreground uppercase tracking-tight">Alerts</h2>
                            <span className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-500 uppercase tracking-wider" title="Real-time data">
                                <span className="relative flex h-1.5 w-1.5">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                </span>
                                Live
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {view === "list" && (
                                <Button onClick={() => { resetForm(); setView("create"); }} variant="outline" size="sm" className="h-7 px-3 bg-muted/30 border-border text-[10px] font-bold text-muted-foreground gap-1.5 hover:bg-muted/50 hover:text-foreground">
                                    <Plus className="h-3 w-3" /> Add
                                </Button>
                            )}
                            <button onClick={onClose} className="p-1 hover:text-foreground text-muted-foreground transition-colors">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    <ScrollArea className="flex-1">
                        <div className="p-4 space-y-6">
                            {view === "list" ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-4 border-b border-border pb-2">
                                        <button onClick={() => setActiveTab("active")} className={cn("text-[11px] font-bold uppercase tracking-wider pb-2 px-1 transition-all", activeTab === "active" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground")}>
                                            Active ({alerts.filter(a => a.active).length}/{alerts.length})
                                        </button>
                                        <button onClick={() => setActiveTab("history")} className={cn("text-[11px] font-bold uppercase tracking-wider pb-2 px-1 transition-all", activeTab === "history" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground")}>
                                            History ({signals.length})
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between py-1">
                                        <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-tight">Browser notifications</span>
                                        <Switch checked={settings.browserNotifications} onCheckedChange={v => { saveSettings({ browserNotifications: v }); if (v && "Notification" in window && Notification.permission === "default") Notification.requestPermission(); }} className="scale-75 data-[state=checked]:bg-primary" />
                                    </div>

                                    {activeTab === "active" ? (
                                        <div className="space-y-3 pt-2">
                                            <div className="border border-border rounded-xl overflow-hidden bg-muted/10">
                                                <button type="button" onClick={() => setPresetsOpen(!presetsOpen)} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/20 transition-colors">
                                                    <LayoutTemplate className="h-3.5 w-3.5 text-muted-foreground" />
                                                    <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">Presets</span>
                                                    {presetsOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto" />}
                                                </button>
                                                <AnimatePresence>
                                                    {presetsOpen && (
                                                        <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                                                            <div className="px-3 pb-3 pt-0 grid grid-cols-1 gap-1.5 max-h-[240px] overflow-y-auto">
                                                                {SCREENER_ALERT_PRESETS.map(preset => (
                                                                    <button
                                                                        key={preset.id}
                                                                        type="button"
                                                                        onClick={() => createFromPreset(preset)}
                                                                        className="text-left px-2.5 py-2 rounded-lg bg-muted/20 hover:bg-muted/40 border border-transparent hover:border-border text-[10px] font-bold text-foreground transition-colors"
                                                                        title={preset.description}
                                                                    >
                                                                        {preset.name}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>

                                            {alerts.length === 0 ? (
                                                <div className="py-20 flex flex-col items-center justify-center opacity-60 gap-4">
                                                    <Bell className="h-10 w-10 text-muted-foreground" />
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">No Alerts Configured</p>
                                                    <Button variant="outline" size="sm" onClick={() => setView("create")} className="text-[10px]">Add Alert</Button>
                                                </div>
                                            ) : (
                                                alerts.map(alert => {
                                                    const badge = EXCHANGE_BADGES[alert.exchange || "binance"] || EXCHANGE_BADGES.binance;
                                                    return (
                                                        <div key={alert.id} className="bg-muted/20 border border-border rounded-xl p-3 group hover:bg-muted/30 transition-all">
                                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded border", badge.className)}>{badge.label}</span>
                                                                    <span className="text-[12px] font-bold text-foreground">{alert.name || "Unnamed"}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <button onClick={() => startEdit(alert)} className="p-1.5 hover:text-primary text-muted-foreground" title="Edit">
                                                                        <Pencil className="h-3.5 w-3.5" />
                                                                    </button>
                                                                    <Switch checked={alert.active} onCheckedChange={() => toggleAlert(alert.id)} className="scale-75 data-[state=checked]:bg-primary" />
                                                                    <button onClick={() => removeAlert(alert.id)} className="p-1.5 hover:text-destructive text-muted-foreground" title="Delete">
                                                                        <X className="h-3.5 w-3.5" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <p className="text-[10px] text-muted-foreground font-bold mb-1">{formatAlertScope(alert)}</p>
                                                            <p className="text-[9px] text-muted-foreground mb-2">1 group • {alert.conditions.length} conditions</p>
                                                            <p className="text-[10px] font-mono text-foreground/90 break-all">
                                                                ({alert.conditions.map((c, i) => formatConditionDisplay(c, alert.logic)).join(` ${alert.logic} `)})
                                                            </p>
                                                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                                                                <span className="text-[9px] font-bold text-muted-foreground">Triggered {(alert.triggeredCount || 0)}x</span>
                                                                {alert.repeat && <span className="text-[8px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-bold">Repeating</span>}
                                                                {alert.sound && <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">Sound</span>}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-2 pt-2">
                                            {signals.length === 0 ? (
                                                <div className="py-20 flex flex-col items-center justify-center opacity-60 gap-4">
                                                    <HistoryIcon className="h-10 w-10 text-muted-foreground" />
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">No Signals Yet</p>
                                                    <Button variant="ghost" size="sm" onClick={clearSignals} className="text-[10px]">Clear History</Button>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Recent signals</span>
                                                        <Button variant="ghost" size="sm" onClick={clearSignals} className="h-6 text-[9px] text-muted-foreground">Clear</Button>
                                                    </div>
                                                    {signals.slice(0, 20).map((s, i) => (
                                                        <div key={s.id || i} className="bg-muted/20 border border-border rounded-lg p-2 space-y-1">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[10px] font-bold text-foreground font-mono">{s.symbol}</span>
                                                                <span className="text-[9px] text-muted-foreground">{new Date(s.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                                            </div>
                                                            <p className="text-[9px] text-muted-foreground line-clamp-2">{s.message}</p>
                                                        </div>
                                                    ))}
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <div className="space-y-2.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Exchange</label>
                                        <div className="flex gap-2">
                                            {(["binance", "hyperliquid", "bybit"] as const).map(ex => (
                                                <Button key={ex} onClick={() => setExchange(ex)} variant="outline" className={cn("h-8 flex-1 text-[11px] font-bold border-border transition-all rounded", exchange === ex ? (ex === "binance" ? "bg-amber-500/10 text-amber-500 border-amber-500/40" : ex === "hyperliquid" ? "bg-purple-500/10 text-purple-500 border-purple-500/40" : "bg-orange-500/10 text-orange-500 border-orange-500/40") : "bg-transparent text-muted-foreground hover:text-foreground")}>
                                                    {ex === "bybit" ? "Bybit" : ex === "binance" ? "Binance" : "Hyperliquid"}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <Input placeholder="Alert name" value={alertName} onChange={e => setAlertName(e.target.value)} className="h-9 bg-muted/30 border-border text-[11px] font-bold text-foreground placeholder:text-muted-foreground focus:bg-muted/50 rounded" />
                                        <Input placeholder="Symbols (comma-separated, empty = All)" value={symbolsInput} onChange={e => setSymbolsInput(e.target.value)} className="h-9 bg-muted/30 border-border text-[11px] font-mono text-foreground placeholder:text-muted-foreground focus:bg-muted/50 rounded" />
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Conditions</label>
                                        <div className="bg-card/50 border border-border rounded-xl overflow-hidden">
                                            <div className="bg-muted/30 px-3 py-2 border-b border-border flex items-center justify-between">
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase">Logic</span>
                                                <Select value={logic} onValueChange={v => setLogic(v as "AND" | "OR")}>
                                                    <SelectTrigger className="h-7 w-24 bg-transparent border-0 text-[10px] font-bold">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="AND">AND</SelectItem>
                                                        <SelectItem value="OR">OR</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="p-3 space-y-3">
                                                {conditions.map((cond, i) => ConditionForm(cond, i))}
                                                <button onClick={addCondition} className="w-full py-2 border border-dashed border-border rounded text-[9px] font-bold text-muted-foreground hover:text-foreground hover:border-border transition-all">
                                                    + Add {logic} condition
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-muted/30 border border-border rounded-xl p-3 space-y-2">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Triggers when</p>
                                        <div className="flex items-center gap-2">
                                            <div className="h-1 w-1 rounded-full bg-primary" />
                                            <p className="text-[11px] font-bold text-foreground font-mono tracking-tight break-all">{getLogicSummary() || "—"}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4 pt-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] text-muted-foreground font-bold uppercase">Repeating</span>
                                            <Switch checked={repeat} onCheckedChange={setRepeat} className="data-[state=checked]:bg-primary" />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] text-muted-foreground font-bold uppercase">Sound</span>
                                            <Switch checked={sound} onCheckedChange={setSound} className="data-[state=checked]:bg-primary" />
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2 pt-4">
                                        <Button onClick={view === "edit" ? handleUpdate : handleCreate} className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-tight text-xs rounded-xl border border-border">
                                            {view === "edit" ? "Update Alert" : "Create Alert"}
                                        </Button>
                                        <Button onClick={() => { setView("list"); resetForm(); }} variant="ghost" className="w-full h-10 text-muted-foreground hover:text-foreground bg-muted/30 text-xs font-bold uppercase rounded-xl">
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
