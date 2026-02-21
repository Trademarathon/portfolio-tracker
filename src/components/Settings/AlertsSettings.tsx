"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bell,
    Volume2,
    VolumeX,
    MessageCircle,
    Send,
    Plus,
    Trash2,
    Edit,
    Check,
    X,
    AlertTriangle,
    AlertOctagon,
    Info,
    Target,
    TrendingUp,
    TrendingDown,
    DollarSign,
    Percent,
    BarChart3,
    Clock,
    Moon,
    Sun,
    Loader2,
    ExternalLink,
    Copy,
    Eye,
    EyeOff,
    ChevronDown,
    ChevronRight,
    Zap,
    Shield,
    RefreshCw,
    TestTube,
    CheckCircle2,
    XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { useAdvancedAlerts } from '@/hooks/useAdvancedAlerts';
import { useAlerts } from '@/hooks/useAlerts';
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import {
    Alert,
    AlertSettings,
    AlertChannel,
    AlertPriority,
    AlertType,
    ALERT_TEMPLATES,
    PRIORITY_CONFIG,
    getAlertTypeLabel,
} from '@/lib/api/alerts';
import Link from 'next/link';
import { MovementAlertsSettings } from './MovementAlertsSettings';
import { AlertsFeedSettings } from './AlertsFeedSettings';
import { loadMemory, saveMemory, MemoryStore } from '@/lib/ai-memory';

// Discord icon
const DiscordIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
);

// Telegram icon
const TelegramIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12a12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472c-.18 1.898-.962 6.502-1.36 8.627c-.168.9-.499 1.201-.82 1.23c-.696.065-1.225-.46-1.9-.902c-1.056-.693-1.653-1.124-2.678-1.8c-1.185-.78-.417-1.21.258-1.91c.177-.184 3.247-2.977 3.307-3.23c.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345c-.48.33-.913.49-1.302.48c-.428-.008-1.252-.241-1.865-.44c-.752-.245-1.349-.374-1.297-.789c.027-.216.325-.437.893-.663c3.498-1.524 5.83-2.529 6.998-3.014c3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
);

// Import sound generator
import { createNotificationSound, SoundType } from '@/hooks/useAdvancedAlerts';

// Sound labels and icons for display
const SOUND_OPTIONS: { id: SoundType; label: string; icon: string }[] = [
    { id: 'default', label: 'Default', icon: '🔔' },
    { id: 'chime', label: 'Chime', icon: '🎵' },
    { id: 'ding', label: 'Ding', icon: '🛎️' },
    { id: 'bell', label: 'Bell', icon: '🔔' },
    { id: 'coin', label: 'Coin', icon: '🪙' },
    { id: 'pop', label: 'Pop', icon: '💥' },
    { id: 'bubble', label: 'Bubble', icon: '🫧' },
    { id: 'whoosh', label: 'Whoosh', icon: '💨' },
    { id: 'success', label: 'Success', icon: '✅' },
    { id: 'alert', label: 'Alert', icon: '⚠️' },
    { id: 'error', label: 'Error', icon: '❌' },
    { id: 'critical', label: 'Critical', icon: '🚨' },
];

// Play test sound using the shared generator
function playTestSound(type: SoundType, volume: number) {
    createNotificationSound(type, volume / 100);
}

export function AlertsSettings() {
    const {
        alerts,
        history,
        settings,
        updateSettings,
        addAlert,
        updateAlert,
        deleteAlert,
        toggleAlert,
        testConnection,
    } = useAdvancedAlerts();
    
    const [showDiscordSecret, setShowDiscordSecret] = useState(false);
    const [showTelegramSecret, setShowTelegramSecret] = useState(false);
    const [testingDiscord, setTestingDiscord] = useState(false);
    const [testingTelegram, setTestingTelegram] = useState(false);
    const [discordTestResult, setDiscordTestResult] = useState<{ success: boolean; error?: string } | null>(null);
    const [telegramTestResult, setTelegramTestResult] = useState<{ success: boolean; error?: string } | null>(null);
    const [showCreateAlert, setShowCreateAlert] = useState(false);
    const [expandedSection, setExpandedSection] = useState<string | null>('channels');
    const screenerAlerts = useAlerts();
    const { user, cloudSyncEnabled } = useSupabaseAuth();
    const [alertsMemory, setAlertsMemory] = useState<MemoryStore | null>(null);
    const [memoryLoading, setMemoryLoading] = useState(false);

    useEffect(() => {
        let active = true;
        setMemoryLoading(true);
        loadMemory("alerts", user?.id ?? null, cloudSyncEnabled)
            .then((mem) => {
                if (active) setAlertsMemory(mem);
            })
            .finally(() => {
                if (active) setMemoryLoading(false);
            });
        return () => { active = false; };
    }, [user?.id, cloudSyncEnabled]);

    const persistAlertsMemory = (next: MemoryStore) => {
        setAlertsMemory(next);
        saveMemory("alerts", next, user?.id ?? null, cloudSyncEnabled).catch(() => {});
    };

    const clearMemoryEntry = (scope: "dismissed" | "cooldowns", id: string) => {
        if (!alertsMemory) return;
        const next: MemoryStore = {
            ...alertsMemory,
            updatedAt: Date.now(),
            dismissed: { ...alertsMemory.dismissed },
            cooldowns: { ...alertsMemory.cooldowns },
        };
        if (scope === "dismissed") delete next.dismissed[id];
        else delete next.cooldowns[id];
        persistAlertsMemory(next);
    };

    const clearAllMemory = () => {
        if (!alertsMemory) return;
        persistAlertsMemory({
            ...alertsMemory,
            updatedAt: Date.now(),
            dismissed: {},
            cooldowns: {},
        });
    };

    const formatRelative = (ts?: number) => {
        if (!ts) return "—";
        const diff = Date.now() - ts;
        if (diff < 60_000) return "just now";
        if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
        if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
        return `${Math.floor(diff / 86_400_000)}d ago`;
    };

    const formatUntil = (ts?: number) => {
        if (!ts) return "—";
        const diff = ts - Date.now();
        if (diff <= 0) return "expired";
        if (diff < 60_000) return "in <1m";
        if (diff < 3_600_000) return `in ${Math.floor(diff / 60_000)}m`;
        if (diff < 86_400_000) return `in ${Math.floor(diff / 3_600_000)}h`;
        return `in ${Math.floor(diff / 86_400_000)}d`;
    };
    
    // Test Discord
    const handleTestDiscord = async () => {
        setTestingDiscord(true);
        setDiscordTestResult(null);
        try {
            const result = await testConnection('discord');
            setDiscordTestResult(result);
        } catch (error: any) {
            setDiscordTestResult({ success: false, error: error.message });
        }
        setTestingDiscord(false);
    };
    
    // Test Telegram
    const handleTestTelegram = async () => {
        setTestingTelegram(true);
        setTelegramTestResult(null);
        try {
            const result = await testConnection('telegram');
            setTelegramTestResult(result);
        } catch (error: any) {
            setTelegramTestResult({ success: false, error: error.message });
        }
        setTestingTelegram(false);
    };
    
    return (
        <div className="space-y-6">
            {/* Live Movement Alerts (CoinPush-style) */}
            <MovementAlertsSettings />

            {/* Alerts Feed Widget */}
            <AlertsFeedSettings />

            {/* Delivery Channels Section */}
            <Card className="bg-card/50 backdrop-blur-xl border-border overflow-hidden">
                <button
                    onClick={() => setExpandedSection(expandedSection === 'channels' ? null : 'channels')}
                    className="w-full"
                >
                    <CardHeader className="hover:bg-white/[0.02] transition-colors cursor-pointer">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                                    <Bell size={18} />
                                </div>
                                <div className="text-left">
                                    <CardTitle className="text-base">Delivery Channels</CardTitle>
                                    <CardDescription className="text-xs">Configure how you receive alerts</CardDescription>
                                </div>
                            </div>
                            <ChevronDown className={cn(
                                "h-5 w-5 text-zinc-500 transition-transform",
                                expandedSection === 'channels' && "rotate-180"
                            )} />
                        </div>
                    </CardHeader>
                </button>
                
                <AnimatePresence>
                    {expandedSection === 'channels' && (
                        <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="overflow-hidden"
                        >
                            <CardContent className="space-y-6 pt-0">
                                {/* In-App & Browser */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* In-App Notifications */}
                                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                                                    <Bell size={18} />
                                                </div>
                                                <div>
                                                    <span className="text-sm font-bold text-white">In-App Notifications</span>
                                                    <p className="text-[10px] text-zinc-500">Toast notifications in the app</p>
                                                </div>
                                            </div>
                                            <Switch
                                                checked={settings.inAppEnabled}
                                                onCheckedChange={(v) => updateSettings({ inAppEnabled: v })}
                                                className="data-[state=checked]:bg-indigo-500"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between pt-3 border-t border-white/5">
                                            <span className="text-[11px] text-zinc-400">Show in Notification Center</span>
                                            <Switch
                                                checked={settings.showInNotificationCenter}
                                                onCheckedChange={(v) => updateSettings({ showInNotificationCenter: v })}
                                                className="data-[state=checked]:bg-indigo-500 h-4 w-7"
                                                disabled={!settings.inAppEnabled}
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* Browser Notifications */}
                                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                                    <ExternalLink size={18} />
                                                </div>
                                                <div>
                                                    <span className="text-sm font-bold text-white">Browser Notifications</span>
                                                    <p className="text-[10px] text-zinc-500">Desktop push notifications</p>
                                                </div>
                                            </div>
                                            <Switch
                                                checked={settings.browserEnabled}
                                                onCheckedChange={(v) => updateSettings({ browserEnabled: v })}
                                                className="data-[state=checked]:bg-blue-500"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between pt-3 border-t border-white/5">
                                            <span className="text-[11px] text-zinc-400">Request permission on startup</span>
                                            <Switch
                                                checked={settings.requestPermissionOnStartup}
                                                onCheckedChange={(v) => updateSettings({ requestPermissionOnStartup: v })}
                                                className="data-[state=checked]:bg-blue-500 h-4 w-7"
                                                disabled={!settings.browserEnabled}
                                            />
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Sound */}
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                                                {settings.soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                                            </div>
                                            <div>
                                                <span className="text-sm font-bold text-white">Sound Alerts</span>
                                                <p className="text-[10px] text-zinc-500">Audio notification on alert trigger</p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={settings.soundEnabled}
                                            onCheckedChange={(v) => updateSettings({ soundEnabled: v })}
                                            className="data-[state=checked]:bg-amber-500"
                                        />
                                    </div>
                                    
                                    {settings.soundEnabled && (
                                        <div className="space-y-4 pt-3 border-t border-white/5">
                                            <div>
                                                <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">
                                                    Volume: {settings.soundVolume}%
                                                </label>
                                                <div className="relative w-full h-6 flex items-center">
                                                    {/* Track Background */}
                                                    <div className="absolute w-full h-2 bg-zinc-800 rounded-full" />
                                                    {/* Track Fill */}
                                                    <div 
                                                        className="absolute h-2 bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all"
                                                        style={{ width: `${settings.soundVolume}%` }}
                                                    />
                                                    {/* Slider Input */}
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="100"
                                                        value={settings.soundVolume}
                                                        onChange={(e) => updateSettings({ soundVolume: parseInt(e.target.value) })}
                                                        className="absolute w-full h-2 opacity-0 cursor-pointer z-10"
                                                    />
                                                    {/* Custom Thumb */}
                                                    <div 
                                                        className="absolute w-4 h-4 bg-amber-400 rounded-full shadow-lg shadow-amber-500/30 border-2 border-white/20 pointer-events-none transition-all hover:scale-110"
                                                        style={{ 
                                                            left: `calc(${settings.soundVolume}% - 8px)`,
                                                            transform: 'translateX(0)'
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                            
                                            <div>
                                                <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">
                                                    Sound Type
                                                </label>
                                                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                                                    {SOUND_OPTIONS.map((sound) => (
                                                        <button
                                                            key={sound.id}
                                                            onClick={() => {
                                                                updateSettings({ soundFile: sound.id });
                                                                // Play preview sound
                                                                playTestSound(sound.id, settings.soundVolume);
                                                            }}
                                                            className={cn(
                                                                "flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-[10px] font-bold transition-all",
                                                                settings.soundFile === sound.id
                                                                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 ring-1 ring-amber-500/20"
                                                                    : "bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border border-transparent"
                                                            )}
                                                        >
                                                            <span className="text-lg">{sound.icon}</span>
                                                            <span>{sound.label}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                                <p className="text-[9px] text-zinc-600 mt-2">Click any sound to preview and select it</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Discord Integration */}
                                <div className="p-4 bg-gradient-to-br from-[#5865F2]/10 to-transparent rounded-2xl border border-[#5865F2]/20">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-[#5865F2]/20 text-[#5865F2]">
                                                <DiscordIcon />
                                            </div>
                                            <div>
                                                <span className="text-sm font-bold text-white">Discord Webhook</span>
                                                <p className="text-[10px] text-zinc-500">Send alerts to a Discord channel</p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={settings.discordEnabled}
                                            onCheckedChange={(v) => updateSettings({ discordEnabled: v })}
                                            className="data-[state=checked]:bg-[#5865F2]"
                                        />
                                    </div>
                                    
                                    {settings.discordEnabled && (
                                        <div className="space-y-4 pt-3 border-t border-white/5">
                                            <div>
                                                <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">
                                                    Webhook URL
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type={showDiscordSecret ? "text" : "password"}
                                                        value={settings.discordWebhookUrl}
                                                        onChange={(e) => updateSettings({ discordWebhookUrl: e.target.value })}
                                                        placeholder="https://discord.com/api/webhooks/..."
                                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#5865F2]/50 pr-10"
                                                    />
                                                    <button
                                                        onClick={() => setShowDiscordSecret(!showDiscordSecret)}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                                                    >
                                                        {showDiscordSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={settings.discordMentionOnCritical}
                                                        onChange={(e) => updateSettings({ discordMentionOnCritical: e.target.checked })}
                                                        className="rounded border-zinc-600"
                                                    />
                                                    <span className="text-[11px] text-zinc-400">@mention role on critical alerts</span>
                                                </div>
                                                
                                                <button
                                                    onClick={handleTestDiscord}
                                                    disabled={testingDiscord || !settings.discordWebhookUrl}
                                                    className={cn(
                                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                                                        testingDiscord
                                                            ? "bg-zinc-700 text-zinc-400 cursor-not-allowed"
                                                            : "bg-[#5865F2]/20 text-[#5865F2] hover:bg-[#5865F2]/30"
                                                    )}
                                                >
                                                    {testingDiscord ? (
                                                        <Loader2 size={12} className="animate-spin" />
                                                    ) : (
                                                        <TestTube size={12} />
                                                    )}
                                                    Test Connection
                                                </button>
                                            </div>
                                            
                                            {discordTestResult && (
                                                <div className={cn(
                                                    "flex items-center gap-2 p-2 rounded-lg text-[11px]",
                                                    discordTestResult.success
                                                        ? "bg-emerald-500/10 text-emerald-400"
                                                        : "bg-rose-500/10 text-rose-400"
                                                )}>
                                                    {discordTestResult.success ? (
                                                        <>
                                                            <CheckCircle2 size={14} />
                                                            Connection successful! Check your Discord channel.
                                                        </>
                                                    ) : (
                                                        <>
                                                            <XCircle size={14} />
                                                            {discordTestResult.error}
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                
                                {/* Telegram Integration */}
                                <div className="p-4 bg-gradient-to-br from-[#0088cc]/10 to-transparent rounded-2xl border border-[#0088cc]/20">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-[#0088cc]/20 text-[#0088cc]">
                                                <TelegramIcon />
                                            </div>
                                            <div>
                                                <span className="text-sm font-bold text-white">Telegram Bot</span>
                                                <p className="text-[10px] text-zinc-500">Send alerts via Telegram bot</p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={settings.telegramEnabled}
                                            onCheckedChange={(v) => updateSettings({ telegramEnabled: v })}
                                            className="data-[state=checked]:bg-[#0088cc]"
                                        />
                                    </div>
                                    
                                    {settings.telegramEnabled && (
                                        <div className="space-y-4 pt-3 border-t border-white/5">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">
                                                        Bot Token
                                                    </label>
                                                    <div className="relative">
                                                        <input
                                                            type={showTelegramSecret ? "text" : "password"}
                                                            value={settings.telegramBotToken}
                                                            onChange={(e) => updateSettings({ telegramBotToken: e.target.value })}
                                                            placeholder="123456:ABC-DEF..."
                                                            className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#0088cc]/50 pr-10"
                                                        />
                                                        <button
                                                            onClick={() => setShowTelegramSecret(!showTelegramSecret)}
                                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                                                        >
                                                            {showTelegramSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                                                        </button>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">
                                                        Chat ID
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={settings.telegramChatId}
                                                        onChange={(e) => updateSettings({ telegramChatId: e.target.value })}
                                                        placeholder="Your chat ID or group ID"
                                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#0088cc]/50"
                                                    />
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={settings.telegramSilent}
                                                        onChange={(e) => updateSettings({ telegramSilent: e.target.checked })}
                                                        className="rounded border-zinc-600"
                                                    />
                                                    <span className="text-[11px] text-zinc-400">Send silently (no notification sound)</span>
                                                </div>
                                                
                                                <button
                                                    onClick={handleTestTelegram}
                                                    disabled={testingTelegram || !settings.telegramBotToken || !settings.telegramChatId}
                                                    className={cn(
                                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                                                        testingTelegram
                                                            ? "bg-zinc-700 text-zinc-400 cursor-not-allowed"
                                                            : "bg-[#0088cc]/20 text-[#0088cc] hover:bg-[#0088cc]/30"
                                                    )}
                                                >
                                                    {testingTelegram ? (
                                                        <Loader2 size={12} className="animate-spin" />
                                                    ) : (
                                                        <TestTube size={12} />
                                                    )}
                                                    Test Connection
                                                </button>
                                            </div>
                                            
                                            {telegramTestResult && (
                                                <div className={cn(
                                                    "flex items-center gap-2 p-2 rounded-lg text-[11px]",
                                                    telegramTestResult.success
                                                        ? "bg-emerald-500/10 text-emerald-400"
                                                        : "bg-rose-500/10 text-rose-400"
                                                )}>
                                                    {telegramTestResult.success ? (
                                                        <>
                                                            <CheckCircle2 size={14} />
                                                            Connection successful! Check your Telegram.
                                                        </>
                                                    ) : (
                                                        <>
                                                            <XCircle size={14} />
                                                            {telegramTestResult.error}
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                            
                                            <div className="p-3 bg-zinc-800/50 rounded-lg">
                                                <p className="text-[10px] text-zinc-500 leading-relaxed">
                                                    <strong className="text-zinc-400">How to get your Chat ID:</strong><br/>
                                                    1. Start a chat with <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="text-[#0088cc] hover:underline">@userinfobot</a><br/>
                                                    2. It will reply with your Chat ID<br/>
                                                    3. For groups, add the bot and use the group ID (starts with -)
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Card>
            
            {/* Quiet Hours Section */}
            <Card className="bg-card/50 backdrop-blur-xl border-border overflow-hidden">
                <button
                    onClick={() => setExpandedSection(expandedSection === 'quiet' ? null : 'quiet')}
                    className="w-full"
                >
                    <CardHeader className="hover:bg-white/[0.02] transition-colors cursor-pointer">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
                                    <Moon size={18} />
                                </div>
                                <div className="text-left">
                                    <CardTitle className="text-base">Quiet Hours & Throttling</CardTitle>
                                    <CardDescription className="text-xs">Control when and how often you receive alerts</CardDescription>
                                </div>
                            </div>
                            <ChevronDown className={cn(
                                "h-5 w-5 text-zinc-500 transition-transform",
                                expandedSection === 'quiet' && "rotate-180"
                            )} />
                        </div>
                    </CardHeader>
                </button>
                
                <AnimatePresence>
                    {expandedSection === 'quiet' && (
                        <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="overflow-hidden"
                        >
                            <CardContent className="space-y-4 pt-0">
                                {/* Quiet Hours */}
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                                                <Moon size={18} />
                                            </div>
                                            <div>
                                                <span className="text-sm font-bold text-white">Quiet Hours</span>
                                                <p className="text-[10px] text-zinc-500">Pause non-critical alerts during sleep</p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={settings.quietHoursEnabled}
                                            onCheckedChange={(v) => updateSettings({ quietHoursEnabled: v })}
                                            className="data-[state=checked]:bg-purple-500"
                                        />
                                    </div>
                                    
                                    {settings.quietHoursEnabled && (
                                        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/5">
                                            <div>
                                                <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">
                                                    Start Time
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <Moon size={14} className="text-purple-400" />
                                                    <input
                                                        type="time"
                                                        value={settings.quietHoursStart}
                                                        onChange={(e) => updateSettings({ quietHoursStart: e.target.value })}
                                                        className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">
                                                    End Time
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <Sun size={14} className="text-amber-400" />
                                                    <input
                                                        type="time"
                                                        value={settings.quietHoursEnd}
                                                        onChange={(e) => updateSettings({ quietHoursEnd: e.target.value })}
                                                        className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Cooldown */}
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2 rounded-lg bg-zinc-500/10 text-zinc-400">
                                            <Clock size={18} />
                                        </div>
                                        <div>
                                            <span className="text-sm font-bold text-white">Alert Cooldown</span>
                                            <p className="text-[10px] text-zinc-500">
                                                Minimum {settings.alertCooldownMinutes} minutes between repeated alerts
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="relative w-full h-6 flex items-center">
                                        {/* Track Background */}
                                        <div className="absolute w-full h-2 bg-zinc-800 rounded-full" />
                                        {/* Track Fill */}
                                        <div 
                                            className="absolute h-2 bg-gradient-to-r from-zinc-600 to-zinc-400 rounded-full transition-all"
                                            style={{ width: `${((settings.alertCooldownMinutes - 1) / 59) * 100}%` }}
                                        />
                                        {/* Slider Input */}
                                        <input
                                            type="range"
                                            min="1"
                                            max="60"
                                            value={settings.alertCooldownMinutes}
                                            onChange={(e) => updateSettings({ alertCooldownMinutes: parseInt(e.target.value) })}
                                            className="absolute w-full h-2 opacity-0 cursor-pointer z-10"
                                        />
                                        {/* Custom Thumb */}
                                        <div 
                                            className="absolute w-4 h-4 bg-zinc-400 rounded-full shadow-lg border-2 border-white/20 pointer-events-none transition-all"
                                            style={{ 
                                                left: `calc(${((settings.alertCooldownMinutes - 1) / 59) * 100}% - 8px)`,
                                            }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-[9px] text-zinc-600 mt-2">
                                        <span>1 min</span>
                                        <span>30 min</span>
                                        <span>60 min</span>
                                    </div>
                                </div>
                                
                                {/* Group Similar */}
                                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-zinc-500/10 text-zinc-400">
                                            <Zap size={18} />
                                        </div>
                                        <div>
                                            <span className="text-sm font-bold text-white">Group Similar Alerts</span>
                                            <p className="text-[10px] text-zinc-500">Combine repeated alerts in Notification Center and toasts</p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={settings.groupSimilarAlerts}
                                        onCheckedChange={(v) => updateSettings({ groupSimilarAlerts: v })}
                                    />
                                </div>
                            </CardContent>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Card>
            
            {/* Active Alerts Section */}
            <Card className="bg-card/50 backdrop-blur-xl border-border overflow-hidden">
                <button
                    onClick={() => setExpandedSection(expandedSection === 'alerts' ? null : 'alerts')}
                    className="w-full"
                >
                    <CardHeader className="hover:bg-white/[0.02] transition-colors cursor-pointer">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                                    <Target size={18} />
                                </div>
                                <div className="text-left">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        Active Alerts
                                        {alerts.filter(a => a.enabled).length > 0 && (
                                            <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                                                {alerts.filter(a => a.enabled).length}
                                            </span>
                                        )}
                                    </CardTitle>
                                    <CardDescription className="text-xs">Manage your price and portfolio alerts</CardDescription>
                                </div>
                            </div>
                            <ChevronDown className={cn(
                                "h-5 w-5 text-zinc-500 transition-transform",
                                expandedSection === 'alerts' && "rotate-180"
                            )} />
                        </div>
                    </CardHeader>
                </button>
                
                <AnimatePresence>
                    {expandedSection === 'alerts' && (
                        <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="overflow-hidden"
                        >
                            <CardContent className="pt-0">
                                {alerts.length === 0 ? (
                                    <div className="text-center py-8">
                                        <div className="p-4 rounded-2xl bg-zinc-800/30 border border-white/5 inline-block mb-4">
                                            <Target size={32} className="text-zinc-600" />
                                        </div>
                                        <h3 className="text-sm font-bold text-zinc-400 mb-1">No Alerts Configured</h3>
                                        <p className="text-[11px] text-zinc-600 max-w-[250px] mx-auto mb-4">
                                            Create price alerts to get notified when your targets are reached
                                        </p>
                                        <button
                                            onClick={() => setShowCreateAlert(true)}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                        >
                                            <Plus size={14} />
                                            <span className="text-[11px] font-bold">Create Alert</span>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
                                                {alerts.length} alert{alerts.length !== 1 ? 's' : ''} configured
                                            </span>
                                            <button
                                                onClick={() => setShowCreateAlert(true)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-[10px] font-bold transition-colors"
                                            >
                                                <Plus size={12} />
                                                Add Alert
                                            </button>
                                        </div>
                                        
                                        {alerts.map((alert) => (
                                            <AlertItem
                                                key={alert.id}
                                                alert={alert}
                                                onToggle={() => toggleAlert(alert.id)}
                                                onDelete={() => deleteAlert(alert.id)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Card>

            {/* Screener Alerts Section */}
            <Card className="bg-card/50 backdrop-blur-xl border-border overflow-hidden">
                <button
                    onClick={() => setExpandedSection(expandedSection === 'screener' ? null : 'screener')}
                    className="w-full"
                >
                    <CardHeader className="hover:bg-white/[0.02] transition-colors cursor-pointer">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                                    <BarChart3 size={18} />
                                </div>
                                <div className="text-left">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        Screener Alerts
                                        {screenerAlerts.alerts.filter((a: { active: boolean }) => a.active).length > 0 && (
                                            <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                                                {screenerAlerts.alerts.filter((a: { active: boolean }) => a.active).length}
                                            </span>
                                        )}
                                    </CardTitle>
                                    <CardDescription className="text-xs">Alerts from the Screener / Watchlist page</CardDescription>
                                </div>
                            </div>
                            <ChevronDown className={cn(
                                "h-5 w-5 text-zinc-500 transition-transform",
                                expandedSection === 'screener' && "rotate-180"
                            )} />
                        </div>
                    </CardHeader>
                </button>
                <AnimatePresence>
                    {expandedSection === 'screener' && (
                        <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="overflow-hidden"
                        >
                            <CardContent className="pt-0">
                                {screenerAlerts.alerts.length === 0 ? (
                                    <div className="text-center py-8">
                                        <div className="p-4 rounded-2xl bg-zinc-800/30 border border-white/5 inline-block mb-4">
                                            <BarChart3 size={32} className="text-zinc-600" />
                                        </div>
                                        <h3 className="text-sm font-bold text-zinc-400 mb-1">No Screener Alerts</h3>
                                        <p className="text-[11px] text-zinc-600 max-w-[280px] mx-auto mb-4">
                                            Add alerts from the Watchlist (Screener) page. They will appear here and in the main Notification Center when they fire.
                                        </p>
                                        <Link
                                            href="/watchlist"
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-colors"
                                        >
                                            <ExternalLink size={14} />
                                            <span className="text-[11px] font-bold">Open Watchlist</span>
                                        </Link>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
                                                {screenerAlerts.alerts.length} screener alert{screenerAlerts.alerts.length !== 1 ? 's' : ''}
                                            </span>
                                            <Link
                                                href="/watchlist"
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-[10px] font-bold transition-colors"
                                            >
                                                <ExternalLink size={12} />
                                                Add in Watchlist
                                            </Link>
                                        </div>
                                        {screenerAlerts.alerts.map((alert: { id: string; name?: string; symbol: string; symbols?: string[]; active: boolean; conditions: unknown[]; logic: string }) => (
                                            <div
                                                key={alert.id}
                                                className={cn(
                                                    "p-3 rounded-xl border transition-all flex items-center gap-3",
                                                    alert.active ? "bg-white/5 border-white/10" : "bg-zinc-900/50 border-zinc-800 opacity-60"
                                                )}
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-[12px] font-bold text-white truncate">{alert.name || 'Unnamed'}</div>
                                                    <div className="text-[10px] text-zinc-500 font-mono">
                                                        {alert.symbols?.length ? alert.symbols.join(', ') : alert.symbol === 'GLOBAL' ? 'All symbols' : alert.symbol}
                                                    </div>
                                                    <div className="text-[9px] text-zinc-600 mt-0.5">{alert.conditions.length} condition(s) · {alert.logic}</div>
                                                </div>
                                                <Switch
                                                    checked={alert.active}
                                                    onCheckedChange={() => screenerAlerts.toggleAlert(alert.id)}
                                                    className="data-[state=checked]:bg-amber-500 scale-90"
                                                />
                                                <button
                                                    onClick={() => screenerAlerts.removeAlert(alert.id)}
                                                    className="p-1.5 rounded-lg text-zinc-500 hover:text-destructive hover:bg-white/5 transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Card>
            
            {/* AI Feed Alerts Section */}
            <Card className="bg-card/50 backdrop-blur-xl border-border overflow-hidden">
                <button
                    onClick={() => setExpandedSection(expandedSection === 'aifeed' ? null : 'aifeed')}
                    className="w-full"
                >
                    <CardHeader className="hover:bg-white/[0.02] transition-colors cursor-pointer">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 text-purple-400">
                                    <Zap size={18} />
                                </div>
                                <div className="text-left">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        AI Feed Alerts
                                        {settings.aiFeedAlertsEnabled && (
                                            <span className="px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-[10px] font-bold">
                                                LIVE
                                            </span>
                                        )}
                                    </CardTitle>
                                    <CardDescription className="text-xs">Get notified on AI-generated trading signals</CardDescription>
                                </div>
                            </div>
                            <ChevronDown className={cn(
                                "h-5 w-5 text-zinc-500 transition-transform",
                                expandedSection === 'aifeed' && "rotate-180"
                            )} />
                        </div>
                    </CardHeader>
                </button>
                
                <AnimatePresence>
                    {expandedSection === 'aifeed' && (
                        <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="overflow-hidden"
                        >
                            <CardContent className="space-y-5 pt-0">
                                {/* Master Toggle */}
                                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 rounded-2xl border border-purple-500/20">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                                            <Zap size={18} />
                                        </div>
                                        <div>
                                            <span className="text-sm font-bold text-white">Enable AI Feed Alerts</span>
                                            <p className="text-[10px] text-zinc-500">Send notifications for Neural Alpha signals</p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={settings.aiFeedAlertsEnabled}
                                        onCheckedChange={(v) => updateSettings({ aiFeedAlertsEnabled: v })}
                                        className="data-[state=checked]:bg-purple-500"
                                    />
                                </div>
                                
                                {settings.aiFeedAlertsEnabled && (
                                    <>
                                        {/* Signal Types */}
                                        <div>
                                            <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-3 block">
                                                Signal Types to Alert
                                            </label>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-base">🎯</span>
                                                        <span className="text-xs font-bold text-white">Take Profit</span>
                                                    </div>
                                                    <Switch
                                                        checked={settings.aiFeedAlertTypes?.takeProfit ?? true}
                                                        onCheckedChange={(v) => updateSettings({ 
                                                            aiFeedAlertTypes: { ...settings.aiFeedAlertTypes, takeProfit: v }
                                                        })}
                                                        className="h-4 w-7 data-[state=checked]:bg-emerald-500"
                                                    />
                                                </div>
                                                
                                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-base">🛑</span>
                                                        <span className="text-xs font-bold text-white">Stop Loss</span>
                                                    </div>
                                                    <Switch
                                                        checked={settings.aiFeedAlertTypes?.stopLoss ?? true}
                                                        onCheckedChange={(v) => updateSettings({ 
                                                            aiFeedAlertTypes: { ...settings.aiFeedAlertTypes, stopLoss: v }
                                                        })}
                                                        className="h-4 w-7 data-[state=checked]:bg-rose-500"
                                                    />
                                                </div>
                                                
                                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-base">💰</span>
                                                        <span className="text-xs font-bold text-white">DCA Opportunity</span>
                                                    </div>
                                                    <Switch
                                                        checked={settings.aiFeedAlertTypes?.dcaOpportunity ?? true}
                                                        onCheckedChange={(v) => updateSettings({ 
                                                            aiFeedAlertTypes: { ...settings.aiFeedAlertTypes, dcaOpportunity: v }
                                                        })}
                                                        className="h-4 w-7 data-[state=checked]:bg-blue-500"
                                                    />
                                                </div>
                                                
                                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-base">📈</span>
                                                        <span className="text-xs font-bold text-white">Sell Signals</span>
                                                    </div>
                                                    <Switch
                                                        checked={settings.aiFeedAlertTypes?.sellSignal ?? true}
                                                        onCheckedChange={(v) => updateSettings({ 
                                                            aiFeedAlertTypes: { ...settings.aiFeedAlertTypes, sellSignal: v }
                                                        })}
                                                        className="h-4 w-7 data-[state=checked]:bg-amber-500"
                                                    />
                                                </div>
                                                
                                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-base">🧠</span>
                                                        <span className="text-xs font-bold text-white">Price Memory</span>
                                                    </div>
                                                    <Switch
                                                        checked={settings.aiFeedAlertTypes?.priceMemory ?? true}
                                                        onCheckedChange={(v) => updateSettings({ 
                                                            aiFeedAlertTypes: { ...settings.aiFeedAlertTypes, priceMemory: v }
                                                        })}
                                                        className="h-4 w-7 data-[state=checked]:bg-purple-500"
                                                    />
                                                </div>
                                                
                                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-base">🐋</span>
                                                        <span className="text-xs font-bold text-white">Whale Activity</span>
                                                    </div>
                                                    <Switch
                                                        checked={settings.aiFeedAlertTypes?.whaleActivity ?? false}
                                                        onCheckedChange={(v) => updateSettings({ 
                                                            aiFeedAlertTypes: { ...settings.aiFeedAlertTypes, whaleActivity: v }
                                                        })}
                                                        className="h-4 w-7 data-[state=checked]:bg-cyan-500"
                                                    />
                                                </div>
                                                
                                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-base">⚠️</span>
                                                        <span className="text-xs font-bold text-white">Concentration Risk</span>
                                                    </div>
                                                    <Switch
                                                        checked={settings.aiFeedAlertTypes?.concentrationRisk ?? true}
                                                        onCheckedChange={(v) => updateSettings({ 
                                                            aiFeedAlertTypes: { ...settings.aiFeedAlertTypes, concentrationRisk: v }
                                                        })}
                                                        className="h-4 w-7 data-[state=checked]:bg-orange-500"
                                                    />
                                                </div>
                                                
                                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-base">↔️</span>
                                                        <span className="text-xs font-bold text-white">Transfers</span>
                                                    </div>
                                                    <Switch
                                                        checked={settings.aiFeedAlertTypes?.transfers ?? false}
                                                        onCheckedChange={(v) => updateSettings({ 
                                                            aiFeedAlertTypes: { ...settings.aiFeedAlertTypes, transfers: v }
                                                        })}
                                                        className="h-4 w-7 data-[state=checked]:bg-indigo-500"
                                                    />
                                                </div>

                                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-base">𝕏</span>
                                                        <span className="text-xs font-bold text-white">Social mentions</span>
                                                    </div>
                                                    <Switch
                                                        checked={settings.aiFeedAlertTypes?.social ?? false}
                                                        onCheckedChange={(v) => updateSettings({ 
                                                            aiFeedAlertTypes: { ...settings.aiFeedAlertTypes, social: v }
                                                        })}
                                                        className="h-4 w-7 data-[state=checked]:bg-indigo-500"
                                                    />
                                                </div>

                                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-base">📋</span>
                                                        <span className="text-xs font-bold text-white">Playbook levels</span>
                                                    </div>
                                                    <Switch
                                                        checked={settings.aiFeedAlertTypes?.playbookLevels ?? true}
                                                        onCheckedChange={(v) => updateSettings({ 
                                                            aiFeedAlertTypes: { ...settings.aiFeedAlertTypes, playbookLevels: v }
                                                        })}
                                                        className="h-4 w-7 data-[state=checked]:bg-indigo-500"
                                                    />
                                                </div>

                                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-base">🎯</span>
                                                        <span className="text-xs font-bold text-white">Composite triggers</span>
                                                    </div>
                                                    <Switch
                                                        checked={settings.aiFeedAlertTypes?.playbookCompositeTriggers ?? true}
                                                        onCheckedChange={(v) => updateSettings({ 
                                                            aiFeedAlertTypes: { ...settings.aiFeedAlertTypes, playbookCompositeTriggers: v }
                                                        })}
                                                        className="h-4 w-7 data-[state=checked]:bg-emerald-500"
                                                    />
                                                </div>

                                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-base">✅</span>
                                                        <span className="text-xs font-bold text-white">Value acceptance</span>
                                                    </div>
                                                    <Switch
                                                        checked={settings.aiFeedAlertTypes?.playbookValueAcceptance ?? true}
                                                        onCheckedChange={(v) => updateSettings({ 
                                                            aiFeedAlertTypes: { ...settings.aiFeedAlertTypes, playbookValueAcceptance: v }
                                                        })}
                                                        className="h-4 w-7 data-[state=checked]:bg-emerald-500"
                                                    />
                                                </div>

                                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-base">⚠️</span>
                                                        <span className="text-xs font-bold text-white">No order at level</span>
                                                    </div>
                                                    <Switch
                                                        checked={settings.aiFeedAlertTypes?.levelNoOrderWarning ?? true}
                                                        onCheckedChange={(v) => updateSettings({ 
                                                            aiFeedAlertTypes: { ...settings.aiFeedAlertTypes, levelNoOrderWarning: v }
                                                        })}
                                                        className="h-4 w-7 data-[state=checked]:bg-amber-500"
                                                    />
                                                </div>

                                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-base">📌</span>
                                                        <span className="text-xs font-bold text-white">Handbook warnings (Perp)</span>
                                                    </div>
                                                    <Switch
                                                        checked={settings.aiFeedAlertTypes?.playbookRuleWarning ?? true}
                                                        onCheckedChange={(v) => updateSettings({ 
                                                            aiFeedAlertTypes: { ...settings.aiFeedAlertTypes, playbookRuleWarning: v }
                                                        })}
                                                        className="h-4 w-7 data-[state=checked]:bg-amber-500"
                                                    />
                                                </div>

                                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-base">📓</span>
                                                        <span className="text-xs font-bold text-white">Journal reminder</span>
                                                    </div>
                                                    <Switch
                                                        checked={settings.aiFeedAlertTypes?.journalReminder ?? true}
                                                        onCheckedChange={(v) => updateSettings({ 
                                                            aiFeedAlertTypes: { ...settings.aiFeedAlertTypes, journalReminder: v }
                                                        })}
                                                        className="h-4 w-7 data-[state=checked]:bg-amber-500"
                                                    />
                                                </div>

                                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-base">🛡️</span>
                                                        <span className="text-xs font-bold text-white">Perp stop-loss reminder</span>
                                                    </div>
                                                    <Switch
                                                        checked={settings.aiFeedAlertTypes?.perpStoplossReminder ?? true}
                                                        onCheckedChange={(v) => updateSettings({ 
                                                            aiFeedAlertTypes: { ...settings.aiFeedAlertTypes, perpStoplossReminder: v }
                                                        })}
                                                        className="h-4 w-7 data-[state=checked]:bg-rose-500"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Minimum Priority */}
                                        <div>
                                            <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">
                                                Minimum Priority to Alert
                                            </label>
                                            <div className="flex gap-2">
                                                {(['low', 'medium', 'high'] as const).map((priority) => (
                                                    <button
                                                        key={priority}
                                                        onClick={() => updateSettings({ aiFeedMinPriority: priority })}
                                                        className={cn(
                                                            "flex-1 px-4 py-2 rounded-xl text-xs font-bold transition-all capitalize",
                                                            settings.aiFeedMinPriority === priority
                                                                ? priority === 'high' 
                                                                    ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                                                    : priority === 'medium'
                                                                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                                                        : "bg-zinc-500/20 text-zinc-400 border border-zinc-500/30"
                                                                : "bg-white/5 text-zinc-500 border border-transparent hover:text-white"
                                                        )}
                                                    >
                                                        {priority}
                                                    </button>
                                                ))}
                                            </div>
                                            <p className="text-[10px] text-zinc-600 mt-2">
                                                {settings.aiFeedMinPriority === 'high' && "Only critical signals (50%+ profit, major risks)"}
                                                {settings.aiFeedMinPriority === 'medium' && "Important signals (30%+ profit, DCA opportunities)"}
                                                {settings.aiFeedMinPriority === 'low' && "All signals including minor recommendations"}
                                            </p>
                                        </div>

                                        {/* AI Feed Cooldowns */}
                                        <div>
                                            <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">
                                                AI Feed Cooldowns (hours)
                                            </label>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                                                    <div className="text-[11px] text-zinc-400 mb-2">Default signals</div>
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        max={72}
                                                        value={settings.aiFeedCooldownHoursDefault ?? 6}
                                                        onChange={(e) => updateSettings({ aiFeedCooldownHoursDefault: Math.max(1, Number(e.target.value || 1)) })}
                                                        className="h-8 text-xs"
                                                    />
                                                </div>
                                                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                                                    <div className="text-[11px] text-zinc-400 mb-2">Price Memory</div>
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        max={168}
                                                        value={settings.aiFeedCooldownHoursPriceMemory ?? 12}
                                                        onChange={(e) => updateSettings({ aiFeedCooldownHoursPriceMemory: Math.max(1, Number(e.target.value || 1)) })}
                                                        className="h-8 text-xs"
                                                    />
                                                </div>
                                                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                                                    <div className="text-[11px] text-zinc-400 mb-2">Perp stop‑loss</div>
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        max={24}
                                                        value={settings.aiFeedCooldownHoursPerpStoploss ?? 2}
                                                        onChange={(e) => updateSettings({ aiFeedCooldownHoursPerpStoploss: Math.max(1, Number(e.target.value || 1)) })}
                                                        className="h-8 text-xs"
                                                    />
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-zinc-600 mt-2">
                                                Cooldowns prevent repeated alerts for the same signal within the set window.
                                            </p>
                                        </div>
                                        
                                        {/* Delivery Channels for AI Feed */}
                                        <div>
                                            <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">
                                                AI Feed Delivery Channels
                                            </label>
                                            <div className="flex flex-wrap gap-2">
                                                {[
                                                    { id: 'in_app' as const, label: 'In-App', icon: <Bell size={14} />, color: 'indigo' },
                                                    { id: 'browser' as const, label: 'Browser', icon: <ExternalLink size={14} />, color: 'blue' },
                                                    { id: 'sound' as const, label: 'Sound', icon: <Volume2 size={14} />, color: 'amber' },
                                                    { id: 'discord' as const, label: 'Discord', icon: <DiscordIcon />, color: '[#5865F2]', disabled: !settings.discordEnabled },
                                                    { id: 'telegram' as const, label: 'Telegram', icon: <TelegramIcon />, color: '[#0088cc]', disabled: !settings.telegramEnabled },
                                                ].map((channel) => {
                                                    const isActive = settings.aiFeedChannels?.includes(channel.id);
                                                    return (
                                                        <button
                                                            key={channel.id}
                                                            onClick={() => {
                                                                const current = settings.aiFeedChannels || ['in_app', 'browser', 'sound'];
                                                                const updated = isActive
                                                                    ? current.filter(c => c !== channel.id)
                                                                    : [...current, channel.id];
                                                                updateSettings({ aiFeedChannels: updated as any });
                                                            }}
                                                            disabled={channel.disabled}
                                                            className={cn(
                                                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                                                                isActive
                                                                    ? `bg-${channel.color}-500/20 text-${channel.color}-400 border border-${channel.color}-500/30`
                                                                    : "bg-white/5 text-zinc-500 border border-transparent",
                                                                channel.disabled && "opacity-50 cursor-not-allowed"
                                                            )}
                                                            style={isActive ? {
                                                                backgroundColor: channel.color === '[#5865F2]' ? 'rgba(88, 101, 242, 0.2)' 
                                                                    : channel.color === '[#0088cc]' ? 'rgba(0, 136, 204, 0.2)' 
                                                                    : undefined,
                                                                color: channel.color === '[#5865F2]' ? '#5865F2' 
                                                                    : channel.color === '[#0088cc]' ? '#0088cc' 
                                                                    : undefined,
                                                                borderColor: channel.color === '[#5865F2]' ? 'rgba(88, 101, 242, 0.3)' 
                                                                    : channel.color === '[#0088cc]' ? 'rgba(0, 136, 204, 0.3)' 
                                                                    : undefined,
                                                            } : undefined}
                                                        >
                                                            {channel.icon}
                                                            {channel.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            {(!settings.discordEnabled || !settings.telegramEnabled) && (
                                                <p className="text-[10px] text-zinc-600 mt-2">
                                                    Enable Discord/Telegram in Delivery Channels above to use them here
                                                </p>
                                            )}
                                        </div>

                                        {/* AI Feed Memory Panel */}
                                        <div className="mt-2">
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">
                                                    AI Feed Memory (per-signal)
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={clearAllMemory}
                                                    className="text-[10px] font-bold text-rose-400 hover:text-rose-300"
                                                >
                                                    Clear All
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                                                    <div className="text-[11px] text-zinc-400 mb-2">Dismissed</div>
                                                    {memoryLoading ? (
                                                        <div className="text-[11px] text-zinc-500">Loading…</div>
                                                    ) : (
                                                        <div className="space-y-2 max-h-40 overflow-auto">
                                                            {alertsMemory && Object.keys(alertsMemory.dismissed).length > 0 ? (
                                                                Object.values(alertsMemory.dismissed)
                                                                    .sort((a, b) => (b.dismissedAt || 0) - (a.dismissedAt || 0))
                                                                    .map((entry) => (
                                                                        <div key={`dismissed-${entry.id}`} className="flex items-center justify-between text-[11px] text-zinc-400">
                                                                            <div className="min-w-0">
                                                                                <div className="text-zinc-200 font-semibold truncate">{entry.type || "Signal"}</div>
                                                                                <div className="text-[10px] text-zinc-500 truncate">{entry.symbol || entry.id}</div>
                                                                                <div className="text-[10px] text-zinc-600">{formatRelative(entry.dismissedAt)}</div>
                                                                            </div>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => clearMemoryEntry("dismissed", entry.id)}
                                                                                className="text-[10px] text-zinc-500 hover:text-rose-400"
                                                                            >
                                                                                Clear
                                                                            </button>
                                                                        </div>
                                                                    ))
                                                            ) : (
                                                                <div className="text-[11px] text-zinc-500">None</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                                                    <div className="text-[11px] text-zinc-400 mb-2">Cooldowns</div>
                                                    {memoryLoading ? (
                                                        <div className="text-[11px] text-zinc-500">Loading…</div>
                                                    ) : (
                                                        <div className="space-y-2 max-h-40 overflow-auto">
                                                            {alertsMemory && Object.keys(alertsMemory.cooldowns).length > 0 ? (
                                                                Object.values(alertsMemory.cooldowns)
                                                                    .sort((a, b) => (b.cooldownUntil || 0) - (a.cooldownUntil || 0))
                                                                    .map((entry) => (
                                                                        <div key={`cooldown-${entry.id}`} className="flex items-center justify-between text-[11px] text-zinc-400">
                                                                            <div className="min-w-0">
                                                                                <div className="text-zinc-200 font-semibold truncate">{entry.type || "Signal"}</div>
                                                                                <div className="text-[10px] text-zinc-500 truncate">{entry.symbol || entry.id}</div>
                                                                                <div className="text-[10px] text-zinc-600">Ends {formatUntil(entry.cooldownUntil)}</div>
                                                                            </div>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => clearMemoryEntry("cooldowns", entry.id)}
                                                                                className="text-[10px] text-zinc-500 hover:text-amber-400"
                                                                            >
                                                                                Clear
                                                                            </button>
                                                                        </div>
                                                                    ))
                                                            ) : (
                                                                <div className="text-[11px] text-zinc-500">None</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-zinc-600 mt-2">
                                                Memory prevents repeated alerts. Clearing resets suppression immediately.
                                            </p>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Card>
            
            {/* Alert Templates Section */}
            <Card className="bg-card/50 backdrop-blur-xl border-border overflow-hidden">
                <button
                    onClick={() => setExpandedSection(expandedSection === 'templates' ? null : 'templates')}
                    className="w-full"
                >
                    <CardHeader className="hover:bg-white/[0.02] transition-colors cursor-pointer">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
                                    <Zap size={18} />
                                </div>
                                <div className="text-left">
                                    <CardTitle className="text-base">Quick Alert Templates</CardTitle>
                                    <CardDescription className="text-xs">Pre-configured alerts for common scenarios</CardDescription>
                                </div>
                            </div>
                            <ChevronDown className={cn(
                                "h-5 w-5 text-zinc-500 transition-transform",
                                expandedSection === 'templates' && "rotate-180"
                            )} />
                        </div>
                    </CardHeader>
                </button>
                
                <AnimatePresence>
                    {expandedSection === 'templates' && (
                        <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="overflow-hidden"
                        >
                            <CardContent className="pt-0">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {ALERT_TEMPLATES.map((template) => (
                                        <button
                                            key={template.id}
                                            onClick={() => {
                                                // Would open create alert modal with template
                                                setShowCreateAlert(true);
                                            }}
                                            className="p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all text-left group"
                                        >
                                            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 inline-block mb-2 group-hover:scale-110 transition-transform">
                                                <Target size={16} />
                                            </div>
                                            <h4 className="text-xs font-bold text-white mb-1">{template.name}</h4>
                                            <p className="text-[10px] text-zinc-500 leading-relaxed">{template.description}</p>
                                        </button>
                                    ))}
                                </div>
                            </CardContent>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Card>
            
            {/* Statistics Section */}
            <Card className="bg-card/50 backdrop-blur-xl border-border">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-zinc-500/20 text-zinc-400">
                            <BarChart3 size={18} />
                        </div>
                        <div>
                            <CardTitle className="text-base">Alert Statistics</CardTitle>
                            <CardDescription className="text-xs">Overview of your alert activity</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-white/5 rounded-xl border border-white/5 text-center">
                            <div className="text-2xl font-black text-white mb-1">{alerts.length}</div>
                            <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Total Alerts</div>
                        </div>
                        <div className="p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-center">
                            <div className="text-2xl font-black text-emerald-400 mb-1">{alerts.filter(a => a.enabled).length}</div>
                            <div className="text-[10px] text-emerald-500/70 uppercase font-bold tracking-wider">Active</div>
                        </div>
                        <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/20 text-center">
                            <div className="text-2xl font-black text-blue-400 mb-1">{history.length}</div>
                            <div className="text-[10px] text-blue-500/70 uppercase font-bold tracking-wider">Triggered (24h)</div>
                        </div>
                        <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/20 text-center">
                            <div className="text-2xl font-black text-amber-400 mb-1">
                                {history.filter(h => !h.acknowledged).length}
                            </div>
                            <div className="text-[10px] text-amber-500/70 uppercase font-bold tracking-wider">Unread</div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// Alert Item Component
function AlertItem({ 
    alert, 
    onToggle, 
    onDelete 
}: { 
    alert: Alert; 
    onToggle: () => void; 
    onDelete: () => void;
}) {
    const priorityConfig = PRIORITY_CONFIG[alert.priority];
    const condition = alert.conditions[0];
    
    return (
        <div className={cn(
            "p-3 rounded-xl border transition-all",
            alert.enabled 
                ? "bg-white/5 border-white/10" 
                : "bg-zinc-900/50 border-zinc-800 opacity-60"
        )}>
            <div className="flex items-center gap-3">
                {/* Priority indicator */}
                <div className={cn(
                    "p-2 rounded-lg",
                    priorityConfig.bgColor,
                    priorityConfig.color
                )}>
                    <Target size={16} />
                </div>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <h4 className="text-xs font-bold text-white truncate">{alert.name}</h4>
                        {condition?.symbol && (
                            <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-[9px] font-bold text-indigo-400 border border-indigo-500/20">
                                {condition.symbol}
                            </span>
                        )}
                    </div>
                    <p className="text-[10px] text-zinc-500">
                        {condition && `${getAlertTypeLabel(condition.type)} ${condition.operator} ${condition.value}`}
                        {alert.triggerCount > 0 && ` • Triggered ${alert.triggerCount}x`}
                    </p>
                </div>
                
                {/* Channels */}
                <div className="flex items-center gap-1">
                    {alert.channels.includes('in_app') && <Bell size={12} className="text-zinc-500" />}
                    {alert.channels.includes('discord') && <DiscordIcon />}
                    {alert.channels.includes('telegram') && <TelegramIcon />}
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-2">
                    <Switch
                        checked={alert.enabled}
                        onCheckedChange={onToggle}
                        className="h-4 w-7"
                    />
                    <button
                        onClick={onDelete}
                        className="p-1.5 rounded-lg hover:bg-rose-500/10 text-zinc-500 hover:text-rose-400 transition-colors"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}
