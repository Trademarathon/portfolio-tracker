"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Zap,
    ChevronDown,
    Activity,
    ArrowUpCircle,
    ArrowDownCircle,
    TrendingUp,
    TrendingDown,
    Flag,
    BarChart3,
    RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMovementAlertsSettings } from "@/contexts/MovementAlertsSettingsContext";
import {
    DEFAULT_MOVEMENT_ALERTS_SETTINGS,
    type MovementAlertsSettings,
} from "@/lib/movementAlertsSettings";

type ThresholdField = {
    key:
        | "imminentMomentum"
        | "breakUp1h"
        | "breakDown1h"
        | "goingUp1h"
        | "goingDown1h"
        | "extreme24hUp"
        | "extreme24hDown";
    label: string;
    min: number;
    max: number;
    step: number;
};

const THRESHOLD_FIELDS: ThresholdField[] = [
    { key: "imminentMomentum", label: "Imminent Momentum", min: 10, max: 120, step: 1 },
    { key: "breakUp1h", label: "Break Up (1h %)", min: 0.1, max: 5, step: 0.1 },
    { key: "breakDown1h", label: "Break Down (1h %)", min: -5, max: -0.1, step: 0.1 },
    { key: "goingUp1h", label: "Going Up (1h %)", min: 0.1, max: 2, step: 0.1 },
    { key: "goingDown1h", label: "Going Down (1h %)", min: -2, max: -0.1, step: 0.1 },
    { key: "extreme24hUp", label: "Extreme Up (24h %)", min: 2, max: 20, step: 1 },
    { key: "extreme24hDown", label: "Extreme Down (24h %)", min: -20, max: -2, step: 1 },
];

const SENSITIVITY_PRESETS: Array<{
    id: "aggressive" | "balanced" | "conservative";
    label: string;
    values: Partial<MovementAlertsSettings>;
}> = [
    {
        id: "aggressive",
        label: "Aggressive",
        values: {
            imminentMomentum: 28,
            breakUp1h: 0.4,
            breakDown1h: -0.4,
            goingUp1h: 0.15,
            goingDown1h: -0.15,
            extreme24hUp: 4,
            extreme24hDown: -4,
            baselineTrendFallback: true,
        },
    },
    {
        id: "balanced",
        label: "Balanced",
        values: {
            imminentMomentum: 45,
            breakUp1h: 0.8,
            breakDown1h: -0.8,
            goingUp1h: 0.3,
            goingDown1h: -0.3,
            extreme24hUp: 6,
            extreme24hDown: -6,
            baselineTrendFallback: false,
        },
    },
    {
        id: "conservative",
        label: "Conservative",
        values: {
            imminentMomentum: 75,
            breakUp1h: 1.4,
            breakDown1h: -1.4,
            goingUp1h: 0.7,
            goingDown1h: -0.7,
            extreme24hUp: 10,
            extreme24hDown: -10,
            baselineTrendFallback: false,
        },
    },
];

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

export function MovementAlertsSettings() {
    const [expanded, setExpanded] = useState(false);
    const { settings, saveSettings } = useMovementAlertsSettings();

    const update = (partial: Partial<MovementAlertsSettings>) => {
        saveSettings(partial);
    };

    const applyThresholdPreset = (presetId: "aggressive" | "balanced" | "conservative") => {
        const preset = SENSITIVITY_PRESETS.find((item) => item.id === presetId);
        if (!preset) return;
        saveSettings(preset.values);
    };

    const resetToDefaults = () => {
        saveSettings({
            ...DEFAULT_MOVEMENT_ALERTS_SETTINGS,
            types: { ...DEFAULT_MOVEMENT_ALERTS_SETTINGS.types },
        });
    };

    return (
        <Card className="bg-card/50 backdrop-blur-xl border-border overflow-hidden">
            <CardHeader
                className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => setExpanded(!expanded)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setExpanded((prev) => !prev);
                    }
                }}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                            <Zap size={18} />
                        </div>
                        <div className="text-left">
                            <CardTitle className="text-base">Live Movement Alerts</CardTitle>
                            <CardDescription className="text-xs">
                                Thresholds are applied exactly in the feed
                            </CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Switch
                            checked={settings.enabled}
                            onCheckedChange={(v) => update({ enabled: v })}
                            onClick={(e) => e.stopPropagation()}
                            className="data-[state=checked]:bg-amber-500"
                        />
                        <ChevronDown className={cn("h-5 w-5 text-zinc-500 transition-transform", expanded && "rotate-180")} />
                    </div>
                </div>
            </CardHeader>

            {expanded && (
                <CardContent className="space-y-6 pt-0 pb-6">
                    <div className="flex flex-wrap items-center gap-2">
                        {SENSITIVITY_PRESETS.map((preset) => (
                            <button
                                key={preset.id}
                                type="button"
                                onClick={() => applyThresholdPreset(preset.id)}
                                className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10 transition-colors"
                            >
                                {preset.label}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={resetToDefaults}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-rose-500/10 border border-rose-500/25 text-rose-300 hover:bg-rose-500/15 transition-colors"
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Reset Defaults
                        </button>
                    </div>

                    <div className="p-3 rounded-xl border border-cyan-400/20 bg-cyan-500/10 text-[10px] leading-relaxed text-zinc-300">
                        This section controls the same movement feed you see on Overview. Markets scope (search, preset,
                        exchange, filters) also narrows which symbols appear there.
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="text-sm font-bold text-white">Glow new alerts</span>
                                    <p className="text-[10px] text-zinc-500">Highlight recent alerts with glow</p>
                                </div>
                                <Switch
                                    checked={settings.glowNewAlerts}
                                    onCheckedChange={(v) => update({ glowNewAlerts: v })}
                                    className="data-[state=checked]:bg-amber-500"
                                />
                            </div>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="text-sm font-bold text-white">Animate new alerts</span>
                                    <p className="text-[10px] text-zinc-500">Smooth entrance animation</p>
                                </div>
                                <Switch
                                    checked={settings.animateNewAlerts}
                                    onCheckedChange={(v) => update({ animateNewAlerts: v })}
                                    className="data-[state=checked]:bg-amber-500"
                                />
                            </div>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="text-sm font-bold text-white">Baseline trend fallback</span>
                                    <p className="text-[10px] text-zinc-500">Add low-priority trend signals in quiet markets</p>
                                </div>
                                <Switch
                                    checked={settings.baselineTrendFallback}
                                    onCheckedChange={(v) => update({ baselineTrendFallback: v })}
                                    className="data-[state=checked]:bg-amber-500"
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <Label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 block">
                            Detection thresholds
                        </Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {THRESHOLD_FIELDS.map(({ key, label, min, max, step }) => (
                                <div key={key} className="space-y-1">
                                    <Label className="text-[11px] text-zinc-400">{label}</Label>
                                    <input
                                        type="number"
                                        value={settings[key]}
                                        onChange={(e) =>
                                            update({
                                                [key]: clamp(parseFloat(e.target.value) || 0, min, max),
                                            } as Partial<MovementAlertsSettings>)
                                        }
                                        min={min}
                                        max={max}
                                        step={step}
                                        className="w-full px-3 py-2 rounded-lg bg-zinc-900/80 border border-white/5 text-xs font-mono text-white focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                            <Label className="text-[11px] text-zinc-400">Dedupe window (min)</Label>
                            <input
                                type="number"
                                value={settings.dedupeWindowMinutes}
                                onChange={(e) =>
                                    update({
                                        dedupeWindowMinutes: clamp(parseInt(e.target.value) || 1, 1, 120),
                                    })
                                }
                                min={1}
                                max={120}
                                className="w-full px-3 py-2 rounded-lg bg-zinc-900/80 border border-white/5 text-xs font-mono text-white focus:border-amber-500/50"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[11px] text-zinc-400">Max age (min)</Label>
                            <input
                                type="number"
                                value={settings.maxAgeMinutes}
                                onChange={(e) =>
                                    update({
                                        maxAgeMinutes: clamp(parseInt(e.target.value) || 5, 5, 240),
                                    })
                                }
                                min={5}
                                max={240}
                                className="w-full px-3 py-2 rounded-lg bg-zinc-900/80 border border-white/5 text-xs font-mono text-white focus:border-amber-500/50"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[11px] text-zinc-400">Max alerts shown</Label>
                            <input
                                type="number"
                                value={settings.maxAlertsShown}
                                onChange={(e) =>
                                    update({
                                        maxAlertsShown: clamp(parseInt(e.target.value) || 4, 4, 40),
                                    })
                                }
                                min={4}
                                max={40}
                                className="w-full px-3 py-2 rounded-lg bg-zinc-900/80 border border-white/5 text-xs font-mono text-white focus:border-amber-500/50"
                            />
                        </div>
                    </div>

                    <div>
                        <Label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 block">
                            Enabled signal families
                        </Label>
                        <div className="flex flex-wrap gap-2">
                            {(
                                [
                                    ["imminentMovement", "Imminent", Activity],
                                    ["breakUp", "Break Up", ArrowUpCircle],
                                    ["breakDown", "Break Down", ArrowDownCircle],
                                    ["goingUp", "Going Up", TrendingUp],
                                    ["goingDown", "Going Down", TrendingDown],
                                    ["suddenVolume", "Volume", BarChart3],
                                    ["extremeUp", "Extreme Up", Flag],
                                    ["extremeDown", "Extreme Down", Flag],
                                ] as const
                            ).map(([key, label, Icon]) => (
                                <label
                                    key={key}
                                    className={cn(
                                        "inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors",
                                        settings.types[key]
                                            ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                                            : "bg-zinc-900/50 border-white/5 text-zinc-500"
                                    )}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    <span className="text-[11px] font-bold">{label}</span>
                                    <input
                                        type="checkbox"
                                        checked={settings.types[key]}
                                        onChange={(e) =>
                                            update({
                                                types: { ...settings.types, [key]: e.target.checked },
                                            })
                                        }
                                        className="sr-only"
                                    />
                                </label>
                            ))}
                        </div>
                    </div>
                </CardContent>
            )}
        </Card>
    );
}
