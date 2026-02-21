"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Zap, ChevronDown, Activity, ArrowUpCircle, ArrowDownCircle, TrendingUp, TrendingDown, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMovementAlertsSettings } from "@/contexts/MovementAlertsSettingsContext";
import type { MovementAlertsSettings } from "@/lib/movementAlertsSettings";

export function MovementAlertsSettings() {
    const [expanded, setExpanded] = useState(false);
    const { settings, saveSettings } = useMovementAlertsSettings();

    const update = (partial: Partial<MovementAlertsSettings>) => {
        saveSettings(partial);
    };

    const thresholdFields = [
        { key: "imminentMomentum" as const, label: "Imminent Momentum", min: 50, max: 120, step: 5 },
        { key: "breakUp1h" as const, label: "Break Up (1h %)", min: 0.5, max: 5, step: 0.1 },
        { key: "breakDown1h" as const, label: "Break Down (1h %)", min: -5, max: -0.5, step: 0.1 },
        { key: "goingUp1h" as const, label: "Going Up (1h %)", min: 0.3, max: 2, step: 0.1 },
        { key: "goingDown1h" as const, label: "Going Down (1h %)", min: -2, max: -0.3, step: 0.1 },
        { key: "extreme24hUp" as const, label: "Extreme Up (24h %)", min: 5, max: 20, step: 1 },
        { key: "extreme24hDown" as const, label: "Extreme Down (24h %)", min: -20, max: -5, step: 1 },
    ];

    return (
        <Card className="bg-card/50 backdrop-blur-xl border-border overflow-hidden">
            <button onClick={() => setExpanded(!expanded)} className="w-full">
                <CardHeader className="hover:bg-white/[0.02] transition-colors cursor-pointer">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                                <Zap size={18} />
                            </div>
                            <div className="text-left">
                                <CardTitle className="text-base">Live Movement Alerts</CardTitle>
                                <CardDescription className="text-xs">
                                    CoinPush-style thresholds · Custom alerts ready
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
                            <ChevronDown
                                className={cn(
                                    "h-5 w-5 text-zinc-500 transition-transform",
                                    expanded && "rotate-180"
                                )}
                            />
                        </div>
                    </div>
                </CardHeader>
            </button>

            {expanded && (
                <CardContent className="space-y-6 pt-0 pb-6">
                    {/* UI options */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    </div>

                    {/* Thresholds */}
                    <div>
                        <Label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 block">
                            Detection thresholds
                        </Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {thresholdFields.map(({ key, label, min, max, step }) => (
                                <div key={key} className="space-y-1">
                                    <Label className="text-[11px] text-zinc-400">{label}</Label>
                                    <input
                                        type="number"
                                        value={settings[key]}
                                        onChange={(e) =>
                                            update({
                                                [key]: parseFloat(e.target.value) || 0,
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

                    {/* Timing */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                            <Label className="text-[11px] text-zinc-400">Dedupe window (min)</Label>
                            <input
                                type="number"
                                value={settings.dedupeWindowMinutes}
                                onChange={(e) =>
                                    update({
                                        dedupeWindowMinutes: Math.max(1, parseInt(e.target.value) || 7),
                                    })
                                }
                                min={1}
                                max={60}
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
                                        maxAgeMinutes: Math.max(5, parseInt(e.target.value) || 45),
                                    })
                                }
                                min={5}
                                max={120}
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
                                        maxAlertsShown: Math.max(4, Math.min(30, parseInt(e.target.value) || 8)),
                                    })
                                }
                                min={4}
                                max={30}
                                className="w-full px-3 py-2 rounded-lg bg-zinc-900/80 border border-white/5 text-xs font-mono text-white focus:border-amber-500/50"
                            />
                        </div>
                    </div>

                    {/* Alert type toggles */}
                    <div>
                        <Label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 block">
                            Alert types (for custom alerts future)
                        </Label>
                        <div className="flex flex-wrap gap-2">
                            {(
                                [
                                    ["imminentMovement", "Imminent", Activity],
                                    ["breakUp", "Break Up", ArrowUpCircle],
                                    ["breakDown", "Break Down", ArrowDownCircle],
                                    ["goingUp", "Going Up", TrendingUp],
                                    ["goingDown", "Going Down", TrendingDown],
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
