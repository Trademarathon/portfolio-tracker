"use client";

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Target,
    TrendingUp,
    TrendingDown,
    DollarSign,
    Percent,
    BarChart3,
    Bell,
    Volume2,
    MessageCircle,
    Send,
    AlertTriangle,
    AlertOctagon,
    Info,
    Plus,
    Search,
    BookOpen,
    Crosshair,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdvancedAlerts } from '@/hooks/useAdvancedAlerts';
import {
    Alert,
    AlertChannel,
    AlertPriority,
    AlertType,
    AlertCondition,
    ALERT_TEMPLATES,
    PRIORITY_CONFIG,
    getAlertTypeLabel,
} from '@/lib/api/alerts';

interface CreateAlertModalProps {
    isOpen: boolean;
    onClose: () => void;
    defaultSymbol?: string;
    defaultPrice?: number;
}

// Icons for alert types
const alertTypeIcons: Record<AlertType, React.ReactNode> = {
    price_above: <TrendingUp className="h-4 w-4" />,
    price_below: <TrendingDown className="h-4 w-4" />,
    price_cross: <Target className="h-4 w-4" />,
    percent_change: <Percent className="h-4 w-4" />,
    volume_spike: <BarChart3 className="h-4 w-4" />,
    oi_change: <BarChart3 className="h-4 w-4" />,
    funding_rate: <Percent className="h-4 w-4" />,
    liquidation: <AlertTriangle className="h-4 w-4" />,
    position_pnl: <DollarSign className="h-4 w-4" />,
    order_filled: <Target className="h-4 w-4" />,
    whale_alert: <AlertOctagon className="h-4 w-4" />,
    portfolio_change: <DollarSign className="h-4 w-4" />,
    // AI Feed Alert Types
    ai_take_profit: <Target className="h-4 w-4" />,
    ai_stop_loss: <AlertTriangle className="h-4 w-4" />,
    ai_dca_opportunity: <TrendingDown className="h-4 w-4" />,
    ai_sell_signal: <TrendingUp className="h-4 w-4" />,
    ai_price_memory: <Bell className="h-4 w-4" />,
    ai_whale_activity: <AlertOctagon className="h-4 w-4" />,
    ai_concentration_risk: <AlertTriangle className="h-4 w-4" />,
    ai_transfer: <DollarSign className="h-4 w-4" />,
    // Playbook Level Alert Types
    playbook_level_touch: <BookOpen className="h-4 w-4" />,
    playbook_level_break: <Crosshair className="h-4 w-4" />,
    playbook_level_reject: <BookOpen className="h-4 w-4" />,
    playbook_entry_zone: <Target className="h-4 w-4" />,
    playbook_target_hit: <TrendingUp className="h-4 w-4" />,
    playbook_stop_hit: <AlertTriangle className="h-4 w-4" />,
};

// Priority icons
const priorityIcons: Record<AlertPriority, React.ReactNode> = {
    low: <Info className="h-4 w-4" />,
    medium: <Bell className="h-4 w-4" />,
    high: <AlertTriangle className="h-4 w-4" />,
    critical: <AlertOctagon className="h-4 w-4" />,
};

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

export function CreateAlertModal({ isOpen, onClose, defaultSymbol = '', defaultPrice = 0 }: CreateAlertModalProps) {
    const { addAlert, settings } = useAdvancedAlerts();
    
    // Form state
    const [name, setName] = useState('');
    const [symbol, setSymbol] = useState(defaultSymbol);
    const [alertType, setAlertType] = useState<AlertType>('price_above');
    const [operator, setOperator] = useState<AlertCondition['operator']>('gte');
    const [value, setValue] = useState(defaultPrice || 0);
    const [priority, setPriority] = useState<AlertPriority>('critical');
    const [channels, setChannels] = useState<AlertChannel[]>(['in_app', 'browser', 'sound']);
    const [cooldown, setCooldown] = useState(5);
    const [step, setStep] = useState(1);
    
    // Toggle channel
    const toggleChannel = (channel: AlertChannel) => {
        setChannels(prev => 
            prev.includes(channel) 
                ? prev.filter(c => c !== channel)
                : [...prev, channel]
        );
    };
    
    // Create alert
    const handleCreate = useCallback(() => {
        if (!name.trim() || !symbol.trim()) return;
        
        const condition: AlertCondition = {
            type: alertType,
            symbol: symbol.toUpperCase(),
            operator,
            value,
        };
        
        addAlert({
            name: name.trim(),
            conditions: [condition],
            logic: 'AND',
            channels,
            priority,
            enabled: true,
            cooldown,
        });
        
        onClose();
        
        // Reset form
        setName('');
        setSymbol('');
        setAlertType('price_above');
        setValue(0);
        setPriority('critical');
        setChannels(['in_app', 'browser', 'sound']);
        setStep(1);
    }, [name, symbol, alertType, operator, value, priority, channels, cooldown, addAlert, onClose]);
    
    if (!isOpen) return null;
    
    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-lg bg-gradient-to-b from-zinc-900 to-black border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="p-5 border-b border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                                <Target size={20} />
                            </div>
                            <div>
                                <h2 className="text-base font-black text-white">Create Alert</h2>
                                <p className="text-[10px] text-zinc-500">Step {step} of 2</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="h-1 bg-zinc-800">
                        <div 
                            className="h-full bg-emerald-500 transition-all duration-300"
                            style={{ width: `${(step / 2) * 100}%` }}
                        />
                    </div>
                    
                    {/* Content */}
                    <div className="p-5 space-y-5">
                        {step === 1 && (
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="space-y-5"
                            >
                                {/* Name */}
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">
                                        Alert Name
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="e.g., BTC breaks 50k"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                                    />
                                </div>
                                
                                {/* Symbol */}
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">
                                        Symbol
                                    </label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                                        <input
                                            type="text"
                                            value={symbol}
                                            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                                            placeholder="BTC, ETH, SOL..."
                                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                                        />
                                    </div>
                                </div>
                                
                                {/* Alert Type */}
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">
                                        Alert Type
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(['price_above', 'price_below', 'percent_change', 'volume_spike'] as AlertType[]).map((type) => (
                                            <button
                                                key={type}
                                                onClick={() => setAlertType(type)}
                                                className={cn(
                                                    "flex items-center gap-2 p-3 rounded-xl border transition-all",
                                                    alertType === type
                                                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                                        : "bg-white/5 border-white/5 text-zinc-400 hover:text-white hover:border-white/10"
                                                )}
                                            >
                                                {alertTypeIcons[type]}
                                                <span className="text-xs font-bold">{getAlertTypeLabel(type)}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                
                                {/* Value */}
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">
                                        {alertType === 'percent_change' ? 'Percent (%)' : 
                                         alertType === 'volume_spike' ? 'Volume Increase (%)' : 
                                         'Price Target ($)'}
                                    </label>
                                    <input
                                        type="number"
                                        value={value}
                                        onChange={(e) => setValue(parseFloat(e.target.value) || 0)}
                                        placeholder="Enter value"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                                    />
                                </div>
                            </motion.div>
                        )}
                        
                        {step === 2 && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="space-y-5"
                            >
                                {/* Priority */}
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">
                                        Priority
                                    </label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {(['low', 'medium', 'high', 'critical'] as AlertPriority[]).map((p) => {
                                            const config = PRIORITY_CONFIG[p];
                                            return (
                                                <button
                                                    key={p}
                                                    onClick={() => setPriority(p)}
                                                    className={cn(
                                                        "flex flex-col items-center gap-1 p-3 rounded-xl border transition-all",
                                                        priority === p
                                                            ? cn(config.bgColor, "border-current", config.color)
                                                            : "bg-white/5 border-white/5 text-zinc-400 hover:text-white"
                                                    )}
                                                >
                                                    {priorityIcons[p]}
                                                    <span className="text-[10px] font-bold capitalize">{p}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                
                                {/* Channels */}
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">
                                        Delivery Channels
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => toggleChannel('in_app')}
                                            className={cn(
                                                "flex items-center gap-2 p-3 rounded-xl border transition-all",
                                                channels.includes('in_app')
                                                    ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                                                    : "bg-white/5 border-white/5 text-zinc-500"
                                            )}
                                        >
                                            <Bell size={16} />
                                            <span className="text-xs font-bold">In-App</span>
                                        </button>
                                        
                                        <button
                                            onClick={() => toggleChannel('browser')}
                                            className={cn(
                                                "flex items-center gap-2 p-3 rounded-xl border transition-all",
                                                channels.includes('browser')
                                                    ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                                                    : "bg-white/5 border-white/5 text-zinc-500"
                                            )}
                                        >
                                            <MessageCircle size={16} />
                                            <span className="text-xs font-bold">Browser</span>
                                        </button>
                                        
                                        <button
                                            onClick={() => toggleChannel('sound')}
                                            className={cn(
                                                "flex items-center gap-2 p-3 rounded-xl border transition-all",
                                                channels.includes('sound')
                                                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                                                    : "bg-white/5 border-white/5 text-zinc-500"
                                            )}
                                        >
                                            <Volume2 size={16} />
                                            <span className="text-xs font-bold">Sound</span>
                                        </button>
                                        
                                        <button
                                            onClick={() => toggleChannel('discord')}
                                            disabled={!settings.discordEnabled}
                                            className={cn(
                                                "flex items-center gap-2 p-3 rounded-xl border transition-all",
                                                channels.includes('discord')
                                                    ? "bg-[#5865F2]/10 border-[#5865F2]/30 text-[#5865F2]"
                                                    : "bg-white/5 border-white/5 text-zinc-500",
                                                !settings.discordEnabled && "opacity-50 cursor-not-allowed"
                                            )}
                                        >
                                            <DiscordIcon />
                                            <span className="text-xs font-bold">Discord</span>
                                        </button>
                                        
                                        <button
                                            onClick={() => toggleChannel('telegram')}
                                            disabled={!settings.telegramEnabled}
                                            className={cn(
                                                "flex items-center gap-2 p-3 rounded-xl border transition-all col-span-2",
                                                channels.includes('telegram')
                                                    ? "bg-[#0088cc]/10 border-[#0088cc]/30 text-[#0088cc]"
                                                    : "bg-white/5 border-white/5 text-zinc-500",
                                                !settings.telegramEnabled && "opacity-50 cursor-not-allowed"
                                            )}
                                        >
                                            <TelegramIcon />
                                            <span className="text-xs font-bold">Telegram</span>
                                        </button>
                                    </div>
                                    
                                    {(!settings.discordEnabled || !settings.telegramEnabled) && (
                                        <p className="text-[10px] text-zinc-600 mt-2">
                                            Configure Discord/Telegram in Settings → Alerts to enable
                                        </p>
                                    )}
                                </div>
                                
                                {/* Cooldown */}
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">
                                        Cooldown: {cooldown} minutes
                                    </label>
                                    <input
                                        type="range"
                                        min="1"
                                        max="60"
                                        value={cooldown}
                                        onChange={(e) => setCooldown(parseInt(e.target.value))}
                                        className="w-full h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-emerald-500"
                                    />
                                    <div className="flex justify-between text-[9px] text-zinc-600 mt-1">
                                        <span>1 min</span>
                                        <span>30 min</span>
                                        <span>60 min</span>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </div>
                    
                    {/* Footer */}
                    <div className="p-5 border-t border-white/10 flex items-center justify-between">
                        {step === 1 ? (
                            <>
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 rounded-xl bg-white/5 text-zinc-400 hover:text-white text-xs font-bold transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => setStep(2)}
                                    disabled={!name.trim() || !symbol.trim()}
                                    className={cn(
                                        "px-6 py-2 rounded-xl text-xs font-bold transition-all",
                                        name.trim() && symbol.trim()
                                            ? "bg-emerald-500 text-white hover:bg-emerald-600"
                                            : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                                    )}
                                >
                                    Next
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => setStep(1)}
                                    className="px-4 py-2 rounded-xl bg-white/5 text-zinc-400 hover:text-white text-xs font-bold transition-colors"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleCreate}
                                    disabled={channels.length === 0}
                                    className={cn(
                                        "flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold transition-all",
                                        channels.length > 0
                                            ? "bg-emerald-500 text-white hover:bg-emerald-600"
                                            : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                                    )}
                                >
                                    <Plus size={14} />
                                    Create Alert
                                </button>
                            </>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
