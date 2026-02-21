"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Rss, ChevronDown, Sparkles, Activity, ShoppingCart, PieChart, RotateCcw, Target, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    getAlertsFeedSettings,
    saveAlertsFeedSettings,
    applyRecommendedSettings,
    type AlertsFeedSettings,
} from "@/lib/alertsFeedSettings";

export function AlertsFeedSettings() {
    const [expanded, setExpanded] = useState(false);
    const [settings, setSettingsState] = useState<AlertsFeedSettings>(getAlertsFeedSettings());

    useEffect(() => {
        const handler = () => setSettingsState(getAlertsFeedSettings());
        window.addEventListener("alerts-feed-settings-changed", handler);
        return () => window.removeEventListener("alerts-feed-settings-changed", handler);
    }, []);

    const update = (partial: Partial<AlertsFeedSettings>) => {
        const next = { ...settings, ...partial };
        setSettingsState(next);
        saveAlertsFeedSettings(next);
    };

    return (
        <Card className="bg-card/50 backdrop-blur-xl border-border overflow-hidden">
            <button onClick={() => setExpanded(!expanded)} className="w-full">
                <CardHeader className="hover:bg-white/[0.02] transition-colors cursor-pointer">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
                                <Rss size={18} />
                            </div>
                            <div className="text-left">
                                <CardTitle className="text-base">Alerts Feed Widget</CardTitle>
                                <CardDescription className="text-xs">
                                    AI insights · Movement alerts · Order recommendations
                                </CardDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Switch
                                checked={settings.enabled}
                                onCheckedChange={(v) => update({ enabled: v })}
                                onClick={(e) => e.stopPropagation()}
                                className="data-[state=checked]:bg-cyan-500"
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
                    {/* Recommended settings button */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => applyRecommendedSettings()}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold hover:bg-cyan-500/20 transition-colors"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Apply recommended settings
                        </button>
                    </div>

                    {/* Source toggles */}
                    <div>
                        <Label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 block">
                            Feed sources
                        </Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {([
                            ["showAIInsights", "AI insights", Sparkles],
                                ["showMovementAlerts", "Movement alerts", Activity],
                                ["showOrderRecommendations", "Order recommendations", ShoppingCart],
                                ["showPortfolioAlerts", "Portfolio alerts", PieChart],
                                ["showPlaybookAlerts", "Playbook alerts", Target],
                                ["includeScreenerAlertsAllSymbols", "Include screener alerts (all symbols)", BarChart3],
                                ["enableAISummary", "AI summary card", Sparkles],
                            ] as const).map(([key, label, Icon]) => (
                                <div
                                    key={key}
                                    className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5"
                                >
                                    <div className="flex items-center gap-2">
                                        <Icon className="w-4 h-4 text-cyan-400" />
                                        <span className="text-sm font-bold text-white">{label}</span>
                                    </div>
                                    <Switch
                                        checked={settings[key]}
                                        onCheckedChange={(v) => update({ [key]: v })}
                                        className="data-[state=checked]:bg-cyan-500"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Limits */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                            <Label className="text-[11px] text-zinc-400">Max items</Label>
                            <input
                                type="number"
                                value={settings.maxItems}
                                onChange={(e) =>
                                    update({
                                        maxItems: Math.max(4, Math.min(20, parseInt(e.target.value) || 10)),
                                    })
                                }
                                min={4}
                                max={20}
                                className="w-full px-3 py-2 rounded-lg bg-zinc-900/80 border border-white/5 text-xs font-mono text-white focus:border-cyan-500/50"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[11px] text-zinc-400">AI insights limit</Label>
                            <input
                                type="number"
                                value={settings.aiInsightsLimit}
                                onChange={(e) =>
                                    update({
                                        aiInsightsLimit: Math.max(2, Math.min(10, parseInt(e.target.value) || 5)),
                                    })
                                }
                                min={2}
                                max={10}
                                className="w-full px-3 py-2 rounded-lg bg-zinc-900/80 border border-white/5 text-xs font-mono text-white focus:border-cyan-500/50"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[11px] text-zinc-400">Movement alerts limit</Label>
                            <input
                                type="number"
                                value={settings.movementAlertsLimit}
                                onChange={(e) =>
                                    update({
                                        movementAlertsLimit: Math.max(2, Math.min(10, parseInt(e.target.value) || 5)),
                                    })
                                }
                                min={2}
                                max={10}
                                className="w-full px-3 py-2 rounded-lg bg-zinc-900/80 border border-white/5 text-xs font-mono text-white focus:border-cyan-500/50"
                            />
                        </div>
                    </div>

                    {/* UI options */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {([
                            ["showTimestamps", "Show timestamps", "Display relative time on each item"],
                            ["glowNewItems", "Glow new items", "Highlight recent items with glow"],
                            ["animateNewItems", "Animate new items", "Smooth entrance animation"],
                        ] as const).map(([key, label, desc]) => (
                            <div
                                key={key}
                                className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5"
                            >
                                <div>
                                    <span className="text-sm font-bold text-white">{label}</span>
                                    <p className="text-[10px] text-zinc-500">{desc}</p>
                                </div>
                                <Switch
                                    checked={settings[key]}
                                    onCheckedChange={(v) => update({ [key]: v })}
                                    className="data-[state=checked]:bg-cyan-500"
                                />
                            </div>
                        ))}
                    </div>

                    {/* Min priority */}
                    <div className="space-y-2">
                        <Label className="text-[11px] text-zinc-400">Minimum priority</Label>
                        <div className="flex gap-2">
                            {(["low", "medium", "high"] as const).map((p) => (
                                <button
                                    key={p}
                                    onClick={() => update({ minPriority: p })}
                                    className={cn(
                                        "px-3 py-2 rounded-lg text-xs font-bold capitalize transition-colors",
                                        settings.minPriority === p
                                            ? "bg-cyan-500/20 border border-cyan-500/30 text-cyan-400"
                                            : "bg-zinc-900/50 border border-white/5 text-zinc-500 hover:text-zinc-300"
                                    )}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>
                </CardContent>
            )}
        </Card>
    );
}
