"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useJournal } from "@/contexts/JournalContext";
import { usePlaybookAlerts } from "@/hooks/usePlaybookAlerts";
import { PlaybookLevelAlert } from "@/lib/api/alerts";
import { formatDistanceToNow } from "date-fns";
import { Bell, BellRing, Zap, Target, Shield, TrendingUp, TrendingDown, X, Settings } from "lucide-react";

interface AlertItemProps {
    alert: PlaybookLevelAlert;
    currentPrice?: number;
}

function AlertItem({ alert, currentPrice }: AlertItemProps) {
    const distance = currentPrice 
        ? ((currentPrice - alert.levelValue) / alert.levelValue) * 100 
        : null;
    
    const isNearby = distance !== null && Math.abs(distance) < 2;
    
    const getAlertIcon = () => {
        switch (alert.levelType) {
            case 'target':
                return <Target className="w-3.5 h-3.5 text-emerald-400" />;
            case 'stop':
                return <Shield className="w-3.5 h-3.5 text-rose-400" />;
            default:
                return distance && distance > 0 
                    ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    : <TrendingDown className="w-3.5 h-3.5 text-rose-400" />;
        }
    };
    
    const getPriorityColor = () => {
        switch (alert.priority) {
            case 'critical':
                return 'border-rose-500/50 bg-rose-500/5';
            case 'high':
                return 'border-amber-500/50 bg-amber-500/5';
            case 'medium':
                return 'border-blue-500/50 bg-blue-500/5';
            default:
                return 'border-zinc-700/50 bg-zinc-800/30';
        }
    };
    
    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className={cn(
                "p-3 rounded-xl border transition-all",
                getPriorityColor(),
                isNearby && "ring-1 ring-amber-500/50 animate-pulse"
            )}
        >
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    {getAlertIcon()}
                    <span className="text-xs font-bold text-white">{alert.symbol}</span>
                    <span className="text-[10px] text-zinc-500 uppercase">{alert.levelType}</span>
                </div>
                <span className={cn(
                    "text-[10px] font-bold uppercase",
                    alert.priority === 'critical' && "text-rose-400",
                    alert.priority === 'high' && "text-amber-400",
                    alert.priority === 'medium' && "text-blue-400",
                    alert.priority === 'low' && "text-zinc-400"
                )}>
                    {alert.priority}
                </span>
            </div>
            
            <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-zinc-300">
                    ${alert.levelValue.toFixed(2)}
                </span>
                {currentPrice && (
                    <span className={cn(
                        "text-xs",
                        Math.abs(distance!) < 1 ? "text-amber-400 font-bold" :
                        distance! > 0 ? "text-emerald-400" : "text-rose-400"
                    )}>
                        {distance! > 0 ? '+' : ''}{distance!.toFixed(2)}%
                    </span>
                )}
            </div>
            
            <div className="flex items-center gap-2 mt-2 text-[10px] text-zinc-500">
                <span>{alert.alertType.replace('_', ' ')}</span>
                <span>•</span>
                <span>{alert.planType}</span>
            </div>
        </motion.div>
    );
}

interface TriggeredAlertProps {
    alert: PlaybookLevelAlert & { triggeredAt?: number };
    currentPrice?: number;
}

function TriggeredAlert({ alert }: TriggeredAlertProps) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30"
        >
            <div className="flex items-center gap-2 mb-1">
                <BellRing className="w-4 h-4 text-amber-400 animate-pulse" />
                <span className="text-xs font-bold text-amber-400">TRIGGERED</span>
            </div>
            <p className="text-sm text-white font-medium">
                {alert.symbol} {alert.alertType.replace('_', ' ')} at {alert.levelType}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
                Level: ${alert.levelValue.toFixed(2)}
            </p>
            {alert.lastTriggered && (
                <p className="text-[10px] text-zinc-500 mt-2">
                    {formatDistanceToNow(alert.lastTriggered, { addSuffix: true })}
                </p>
            )}
        </motion.div>
    );
}

export function RealTimeAlertsPanel() {
    const { playbookAlerts, triggeredAlerts, realtimeEnabled } = useJournal();
    const { isMonitoring, setIsMonitoring, currentPrices, activeSymbols } = usePlaybookAlerts();
    const [showAll, setShowAll] = useState(false);
    
    const enabledAlerts = playbookAlerts.filter(a => a.enabled && !a.triggered);
    const displayAlerts = showAll ? enabledAlerts : enabledAlerts.slice(0, 5);
    
    return (
        <div className="p-4 rounded-2xl bg-zinc-900/40 border border-white/10">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        isMonitoring ? "bg-emerald-500/20" : "bg-white/[0.04] border border-white/10"
                    )}>
                        {isMonitoring ? (
                            <Zap className="w-4 h-4 text-emerald-400" />
                        ) : (
                            <Bell className="w-4 h-4 text-zinc-500" />
                        )}
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-white">Playbook Alerts</h3>
                        <p className="text-[10px] text-zinc-500">
                            {enabledAlerts.length} active • {activeSymbols.length} symbols
                        </p>
                    </div>
                </div>
                
                <button
                    onClick={() => setIsMonitoring(!isMonitoring)}
                    className={cn(
                        "p-2 rounded-lg transition-colors border border-white/10",
                        isMonitoring 
                            ? "bg-emerald-500/10 text-emerald-400" 
                            : "bg-white/[0.04] text-zinc-400 hover:text-white"
                    )}
                >
                    <Settings className="w-4 h-4" />
                </button>
            </div>
            
            {/* Triggered Alerts */}
            {triggeredAlerts.length > 0 && (
                <div className="mb-4 space-y-2">
                <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-bold mb-2">
                    Recently Triggered
                </p>
                <AnimatePresence>
                        {triggeredAlerts.slice(0, 3).map(alert => (
                            <TriggeredAlert key={alert.id} alert={alert} />
                        ))}
                    </AnimatePresence>
                </div>
            )}
            
            {/* Active Alerts */}
            <div className="space-y-2">
                <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-bold mb-2">
                    Watching
                </p>
                
                {displayAlerts.length > 0 ? (
                    <AnimatePresence>
                        {displayAlerts.map(alert => (
                            <AlertItem 
                                key={alert.id} 
                                alert={alert}
                                currentPrice={currentPrices[alert.symbol] || currentPrices[`${alert.symbol}USDT`]}
                            />
                        ))}
                    </AnimatePresence>
                ) : (
                    <div className="py-6 text-center text-zinc-500 text-xs">
                        No active alerts. Create spot or perp plans to generate alerts.
                    </div>
                )}
                
                {enabledAlerts.length > 5 && !showAll && (
                    <button
                        onClick={() => setShowAll(true)}
                        className="w-full py-2 text-xs text-zinc-400 hover:text-white transition-colors"
                    >
                        Show {enabledAlerts.length - 5} more alerts
                    </button>
                )}
            </div>
            
            {/* Status */}
            <div className="mt-4 pt-4 border-t border-zinc-800">
                <div className="flex items-center justify-between text-[10px]">
                    <span className="text-zinc-500">Monitoring</span>
                    <div className="flex items-center gap-2">
                        {isMonitoring ? (
                            <>
                                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                                <span className="text-emerald-400">Active</span>
                            </>
                        ) : (
                            <>
                                <span className="w-2 h-2 bg-zinc-600 rounded-full" />
                                <span className="text-zinc-500">Paused</span>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
