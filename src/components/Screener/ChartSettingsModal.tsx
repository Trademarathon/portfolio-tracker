"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Settings2, Palette, BarChart, Activity, Monitor, Sparkles, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface ChartSettings {
    theme: 'light' | 'dark';
    interval: string;
    style: string;
    studies: string[];
    show_top_toolbar: boolean;
    show_side_toolbar: boolean;
    show_legend: boolean;
    backgroundColor: string;
    gridColor: string;
    upColor: string;
    downColor: string;
    vertGridColor: string;
    horzGridColor: string;
    timezone: string;
    withdateranges: boolean;
    allow_symbol_change: boolean;
    save_image: boolean;
    details: boolean;
    hotlist: boolean;
    calendar: boolean;
    show_popup_button: boolean;
    align_orders_right: boolean;
    align_positions_right: boolean;
    plot_liquidation: boolean;
    hide_reverse_position_button: boolean;
    wickUpColor: string;
    wickDownColor: string;
    apply_color_scheme_to_ui: boolean;
    align_designer_orders_opposite: boolean;
    show_fills_on_charts: boolean;
    size_on_fill_markers: boolean;
    show_pnl_for_reduce_orders: boolean;
    show_vert_grid: boolean;
    show_horz_grid: boolean;
    show_right_toolbar: boolean;
    uiAccentColor: string;
    uiBorderColor: string;
    uiBackgroundColor: string;
    uiSecondaryColor: string;
}

const DEFAULT_TV_COLORS = {
    upColor: "#6CCF84",
    downColor: "#A376EC",
    wickUpColor: "#6CCF84",
    wickDownColor: "#A376EC",
};

/** Normalize hex color so # is present and chart/color inputs stay in sync (e.g. "141310" -> "#141310"). */
function normalizeColorInput(key: string, value: unknown): unknown {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    if (!trimmed) return value;
    // Already has # — keep as-is (allow short hex while typing)
    if (trimmed.startsWith("#")) return trimmed;
    // Valid hex without # — prepend # so type="color" and chart accept it
    if (/^[0-9A-Fa-f]{3,8}$/.test(trimmed)) return "#" + trimmed;
    return value;
}

const DEFAULT_SETTINGS: ChartSettings = {
    theme: 'dark',
    interval: '60',
    style: '2', // 2 = Line Chart
    studies: ['Volume@tv-basicstudies', 'ATR@tv-basicstudies'],
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
    uiAccentColor: "#6366f1", // Indigo
    uiBorderColor: "rgba(255, 255, 255, 0.1)",
    uiBackgroundColor: "#0c0c0e",
    uiSecondaryColor: "rgba(255, 255, 255, 0.05)",
};

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

export function ChartSettingsModal({
    onSettingsChange
}: {
    onSettingsChange: (settings: ChartSettings) => void
}) {
    const [settings, setSettings] = useState<ChartSettings>(DEFAULT_SETTINGS);

    useEffect(() => {
        const saved = localStorage.getItem('global_tv_settings');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Migration: apply minimal chart defaults
                if ((parsed.tv_settings_version ?? 0) < 2) {
                    const minimal = { show_top_toolbar: false, show_side_toolbar: false, show_right_toolbar: false, show_legend: false, withdateranges: false, allow_symbol_change: false, save_image: false, details: false, hotlist: false, calendar: false, show_popup_button: false, show_vert_grid: false, show_horz_grid: false, tv_settings_version: 2 };
                    const migrated = { ...parsed, ...minimal };
                    localStorage.setItem('global_tv_settings', JSON.stringify(migrated));
                    setSettings({ ...DEFAULT_SETTINGS, ...migrated });
                } else {
                    setSettings({ ...DEFAULT_SETTINGS, ...parsed });
                }
            } catch (e) {
                console.error("Failed to parse TV settings", e);
            }
        }
    }, []);

    const COLOR_KEYS: (keyof ChartSettings)[] = [
        'backgroundColor', 'gridColor', 'upColor', 'downColor', 'vertGridColor', 'horzGridColor',
        'wickUpColor', 'wickDownColor', 'uiAccentColor', 'uiBorderColor', 'uiBackgroundColor', 'uiSecondaryColor',
    ];
    const updateSetting = (key: keyof ChartSettings, value: any) => {
        const normalized = COLOR_KEYS.includes(key) ? normalizeColorInput(key, value) : value;
        const newSettings = { ...settings, [key]: normalized };
        setSettings(newSettings);
        localStorage.setItem('global_tv_settings', JSON.stringify(newSettings));
        onSettingsChange(newSettings);
        // Dispatch event for real-time synchronization across components
        window.dispatchEvent(new Event('settings-changed'));
    };

    const toggleIndicator = (value: string) => {
        const newStudies = settings.studies.includes(value)
            ? settings.studies.filter(s => s !== value)
            : [...settings.studies, value];
        updateSetting('studies', newStudies);
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10 shadow-xl backdrop-blur-md border border-white/5">
                    <Settings2 className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px] bg-[#0c0c0e]/95 backdrop-blur-2xl border-white/10 text-white shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                            <Monitor className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-lg font-black tracking-tight uppercase italic text-white/90">Chart Engine</span>
                            <p className="text-[10px] text-zinc-500 font-bold tracking-[0.2em] mt-0.5">Custom Visualization Core</p>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="visual" className="mt-6">
                    <TabsList className="grid grid-cols-4 bg-white/5 w-full h-10 p-1">
                        <TabsTrigger value="visual" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-indigo-600">
                            <Palette size={12} /> Visuals
                        </TabsTrigger>
                        <TabsTrigger value="indicators" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-indigo-600">
                            <Activity size={12} /> Analysis
                        </TabsTrigger>
                        <TabsTrigger value="trading" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-indigo-600">
                            <Sparkles size={12} /> Trading
                        </TabsTrigger>
                        <TabsTrigger value="layout" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-indigo-600">
                            <BarChart size={12} /> UI
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="visual" className="space-y-6 pt-6 animate-in slide-in-from-right-2 duration-300 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                        <div className="space-y-3">
                            <Label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Render Style</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
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
                                ].map((s) => (
                                    <button
                                        key={s.id}
                                        onClick={() => updateSetting('style', s.id)}
                                        className={cn(
                                            "px-2 py-2 rounded-lg text-[10px] font-black border transition-all uppercase tracking-tighter",
                                            settings.style === s.id ? "bg-indigo-500 text-white border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.4)]" : "bg-white/5 border-white/5 text-zinc-500 hover:text-zinc-300"
                                        )}
                                    >
                                        {s.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Background Presets</Label>
                            <div className="flex flex-wrap gap-2">
                                {BG_PRESETS.map((bg) => (
                                    <button
                                        key={bg.value}
                                        onClick={() => updateSetting('backgroundColor', bg.value)}
                                        className={cn(
                                            "w-8 h-8 rounded-full border-2 transition-all",
                                            settings.backgroundColor === bg.value ? "border-indigo-500 scale-110" : "border-white/10"
                                        )}
                                        style={{ backgroundColor: bg.value }}
                                        title={bg.label}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                            {[
                                { label: 'Body Up', key: 'upColor' },
                                { label: 'Wick Up', key: 'wickUpColor' },
                                { label: 'Body Down', key: 'downColor' },
                                { label: 'Wick Down', key: 'wickDownColor' },
                            ].map((c) => (
                                <div key={c.key} className="flex items-center justify-between">
                                    <Label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">{c.label}</Label>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => updateSetting(c.key as any, DEFAULT_TV_COLORS[c.key as keyof typeof DEFAULT_TV_COLORS])}
                                            className="text-[10px] font-black text-zinc-500 hover:text-white uppercase"
                                        >
                                            Reset
                                        </button>
                                        <input
                                            type="color"
                                            value={(settings as any)[c.key]}
                                            onChange={(e) => updateSetting(c.key as any, e.target.value)}
                                            className="w-10 h-10 rounded bg-transparent border-none cursor-pointer p-0"
                                        />
                                        <input
                                            type="text"
                                            value={(settings as any)[c.key]}
                                            onChange={(e) => {
                                                const val = normalizeColorInput(c.key, e.target.value) as string;
                                                if (val) updateSetting(c.key as any, val);
                                            }}
                                            className="text-xs font-mono text-zinc-400 uppercase w-[80px] bg-black/40 border border-white/5 rounded px-2 py-1 outline-none focus:border-indigo-500/50"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                            {[
                                { label: 'Vertical Grid', colorKey: 'vertGridColor', showKey: 'show_vert_grid' },
                                { label: 'Horizontal Grid', colorKey: 'horzGridColor', showKey: 'show_horz_grid' },
                            ].map((g) => (
                                <div key={g.colorKey} className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">{g.label}</Label>
                                        <Switch
                                            checked={(settings as any)[g.showKey]}
                                            onCheckedChange={(v) => updateSetting(g.showKey as any, v)}
                                            className="data-[state=checked]:bg-indigo-500 h-4 w-8"
                                        />
                                    </div>
                                    <div className={cn("flex items-center gap-3 transition-opacity", !(settings as any)[g.showKey] && "opacity-30 pointer-events-none")}>
                                        <input
                                            type="color"
                                            value={(settings as any)[g.colorKey]}
                                            onChange={(e) => updateSetting(g.colorKey as any, e.target.value)}
                                            className="w-full h-8 rounded bg-transparent border-none cursor-pointer p-0"
                                        />
                                        <input
                                            type="text"
                                            value={(settings as any)[g.colorKey]}
                                            onChange={(e) => updateSetting(g.colorKey as any, e.target.value)}
                                            className="text-xs font-mono text-zinc-400 uppercase w-[100px] bg-black/40 border border-white/5 rounded px-2 py-1 outline-none focus:border-indigo-500/50"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Base Theme</Label>
                                <Select value={settings.theme} onValueChange={(v) => updateSetting('theme', v)}>
                                    <SelectTrigger className="bg-white/5 border-white/10 h-10">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#141310] border-white/10 text-white">
                                        <SelectItem value="dark">Stealth Dark</SelectItem>
                                        <SelectItem value="light">Classic Light</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Default Interval</Label>
                                <Select value={settings.interval} onValueChange={(v) => updateSetting('interval', v)}>
                                    <SelectTrigger className="bg-white/5 border-white/10 h-10">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#141310] border-white/10 text-white">
                                        <SelectItem value="1">1M</SelectItem>
                                        <SelectItem value="15">15M</SelectItem>
                                        <SelectItem value="60">1H</SelectItem>
                                        <SelectItem value="240">4H</SelectItem>
                                        <SelectItem value="D">Daily</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="indicators" className="space-y-4 pt-6 animate-in slide-in-from-right-2 duration-300">
                        <div className="grid grid-cols-1 gap-2 border border-white/5 rounded-2xl p-4 bg-black/40 max-h-[250px] overflow-auto custom-scrollbar">
                            {INDICATORS.map((ind) => (
                                <div
                                    key={ind.value}
                                    onClick={() => toggleIndicator(ind.value)}
                                    className={cn(
                                        "group flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all",
                                        settings.studies.includes(ind.value) ? "bg-indigo-500/10 border-indigo-500/30" : "bg-white/5 border-transparent hover:bg-white/10"
                                    )}
                                >
                                    <span className={cn("text-xs font-bold", settings.studies.includes(ind.value) ? "text-indigo-300" : "text-zinc-400 group-hover:text-white")}>
                                        {ind.label}
                                    </span>
                                    {settings.studies.includes(ind.value) && (
                                        <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </TabsContent>

                    <TabsContent value="trading" className="space-y-4 pt-6 animate-in slide-in-from-right-2 duration-300 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                        <div className="space-y-3 bg-white/5 p-5 rounded-2xl border border-white/5">
                            {[
                                { key: 'align_orders_right', label: 'Align orders to the right' },
                                { key: 'align_positions_right', label: 'Align positions to the right' },
                                { key: 'plot_liquidation', label: 'Plot liquidation' },
                                { key: 'hide_reverse_position_button', label: 'Hide reverse position' },
                                { key: 'apply_color_scheme_to_ui', label: 'Apply color to UI' },
                                { key: 'align_designer_orders_opposite', label: 'Align Designer orders' },
                                { key: 'show_fills_on_charts', label: 'Show fills' },
                                { key: 'size_on_fill_markers', label: 'Size on fill markers' },
                                { key: 'show_pnl_for_reduce_orders', label: 'Show PNL for reduce' },
                            ].map((item) => (
                                <div key={item.key} className="flex items-center justify-between">
                                    <Label htmlFor={item.key} className="text-xs font-bold text-zinc-300">{item.label}</Label>
                                    <Switch
                                        id={item.key}
                                        checked={(settings as any)[item.key]}
                                        onCheckedChange={(v) => updateSetting(item.key as any, v)}
                                        className="data-[state=checked]:bg-indigo-500"
                                    />
                                </div>
                            ))}
                        </div>
                    </TabsContent>

                    <TabsContent value="layout" className="space-y-4 pt-6 animate-in slide-in-from-right-2 duration-300">
                        <div className="space-y-3 bg-white/5 p-5 rounded-2xl border border-white/5">
                            <Label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-4 inline-block">Pro Theme Engine</Label>
                            <div className="grid grid-cols-1 gap-4">
                                {[
                                    { label: 'Accent Color', key: 'uiAccentColor' },
                                    { label: 'Border Color', key: 'uiBorderColor' },
                                    { label: 'Surface Background', key: 'uiBackgroundColor' },
                                    { label: 'Secondary Surface', key: 'uiSecondaryColor' },
                                ].map((c) => (
                                    <div key={c.key} className="flex items-center justify-between">
                                        <Label className="text-[10px] text-zinc-300 font-bold uppercase tracking-tight">{c.label}</Label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="color"
                                                value={(settings as any)[c.key]}
                                                onChange={(e) => updateSetting(c.key as any, e.target.value)}
                                                className="w-8 h-8 rounded-lg bg-transparent border-none cursor-pointer p-0"
                                            />
                                            <input
                                                type="text"
                                                value={(settings as any)[c.key]}
                                                onChange={(e) => updateSetting(c.key as any, e.target.value)}
                                                className="text-[10px] font-mono text-zinc-400 uppercase w-[90px] bg-black/40 border border-white/5 rounded px-2 py-1.5 outline-none"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3 bg-white/5 p-5 rounded-2xl border border-white/5">
                            {[
                                { id: "top-toolbar", label: "Header Toolbar", key: "show_top_toolbar" },
                                { id: "side-toolbar", label: "Drawing Panel", key: "show_side_toolbar" },
                                { id: "legend", label: "Symbol Details", key: "show_legend" },
                                { id: "withdateranges", label: "Show Date Ranges", key: "withdateranges" },
                                { id: "allow_symbol_change", label: "Allow Symbol Search", key: "allow_symbol_change" },
                                { id: "save_image", label: "Enable Save Image", key: "save_image" },
                                { id: "right-toolbar", label: "Right Sidebar (Widgets)", key: "show_right_toolbar" },
                                { id: "details", label: "Show Asset Details", key: "details" },
                                { id: "hotlist", label: "Show Hotlist", key: "hotlist" },
                                { id: "calendar", label: "Show Economic Calendar", key: "calendar" },
                                { id: "show_popup_button", label: "Enable Popup Mode", key: "show_popup_button" },
                            ].map((item) => (
                                <div key={item.id} className="flex items-center justify-between">
                                    <Label htmlFor={item.id} className="text-xs font-bold text-zinc-300">{item.label}</Label>
                                    <Switch
                                        id={item.id}
                                        checked={(settings as any)[item.key]}
                                        onCheckedChange={(v) => updateSetting(item.key as any, v)}
                                        className="data-[state=checked]:bg-indigo-500"
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center gap-3">
                            <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" />
                            <p className="text-[10px] text-zinc-400 font-medium leading-relaxed">Changes are synchronized across all chart modules for a consistent analytical environment.</p>
                        </div>
                    </TabsContent>
                </Tabs>

                <div className="flex flex-col gap-3 pt-6 border-t border-white/5">
                    <Link
                        href="/settings?tab=general"
                        className="inline-flex items-center gap-2 text-[10px] font-bold text-zinc-500 hover:text-indigo-400 uppercase tracking-widest"
                    >
                        <ExternalLink className="h-3 w-3" />
                        Open full settings
                    </Link>
                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            onClick={() => { localStorage.removeItem('global_tv_settings'); window.location.reload(); }}
                            className="flex-1 border-white/5 bg-transparent hover:bg-white/5 text-[10px] font-black uppercase tracking-widest text-zinc-500 h-10"
                        >
                            Reset Defaults
                        </Button>
                        <Button
                            onClick={() => window.location.reload()}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-[10px] font-black uppercase tracking-widest h-10"
                        >
                            Apply Changes
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
