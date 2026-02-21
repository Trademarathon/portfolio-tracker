"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useJournal } from "@/contexts/JournalContext";
import { DateRangeSelector } from "./DateRangeSelector";
import { formatDistanceToNow } from "date-fns";
import {
    Eye,
    EyeOff,
    SlidersHorizontal,
    RefreshCw,
    Zap,
    Radio,
    Bell,
    CheckCircle2,
    AlertCircle,
} from "lucide-react";
import { ComponentSettingsLink } from "@/components/ui/ComponentSettingsLink";

const pageTitles: Record<string, string> = {
    "/journal": "My Home",
    "/journal/dashboard": "Dashboard",
    "/journal/analytics": "Analytics",
    "/journal/calendar": "Calendar",
    "/journal/trades": "Journal",
    "/journal/trades/open": "Open Positions",
    "/journal/reports": "Reports",
    "/journal/reports/tags": "Tags Report",
    "/journal/reports/symbols": "Symbols Report",
    "/journal/reports/pnl-curve": "PnL Curve Report",
    "/journal/reports/risk": "Risk Report",
    "/journal/reports/day-time": "Day & Time Report",
    "/journal/reports/playbook": "Playbook Report",
    "/journal/reports/win-loss": "Win vs Loss Report",
    "/journal/reports/compare": "Compare Report",
    "/journal/reports/options": "Options Report",
    "/journal/preferences": "Preferences",
};

export function JournalHeader() {
    const pathname = usePathname();
    const { 
        preferences, 
        setPreferences, 
        syncTrades, 
        isLoading, 
        isSyncing,
        lastSyncTime,
        realtimeEnabled,
        setRealtimeEnabled,
        connectedExchanges,
        syncDiagnostics,
        playbookAlerts,
        triggeredAlerts,
    } = useJournal();
    const [showFilters, setShowFilters] = useState(false);
    const [showSyncStatus, setShowSyncStatus] = useState(false);
    const [, forceUpdate] = useState(0);
    
    const title = pageTitles[pathname] || "Journal";
    
    // Update relative time display
    useEffect(() => {
        const interval = setInterval(() => forceUpdate(n => n + 1), 10000);
        return () => clearInterval(interval);
    }, []);
    
    const enabledAlerts = playbookAlerts.filter(a => a.enabled && !a.triggered).length;
    const recentTriggered = triggeredAlerts.length;
    const syncErrorCount = Object.values(syncDiagnostics).filter((diag) => diag.status === 'error').length;

    return (
        <header className="sticky top-0 z-30 border-b border-white/[0.04] px-4 md:px-6 lg:px-8 py-3 bg-[#141310]/90 backdrop-blur-sm">
            <div className="tm-page-header neo-header">
            {/* Page Title with Sync Status */}
            <div className="tm-page-header-main">
                <h1 className="tm-page-title title-lg">{title}</h1>
                
                {/* Real-time indicator */}
                {realtimeEnabled && (
                    <div className="neo-chip neo-float text-sky-300">
                        <div className="relative">
                            <Radio className="w-4 h-4 text-[var(--neo-live)]" />
                            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[var(--neo-live)] rounded-full animate-pulse" />
                        </div>
                        <span className="text-xs">Live</span>
                    </div>
                )}
                
                {/* Last sync time */}
                {lastSyncTime && (
                    <span className="text-xs neo-muted">
                        Synced {formatDistanceToNow(lastSyncTime, { addSuffix: true })}
                    </span>
                )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
                {/* Connected Exchanges Badge */}
                {connectedExchanges.length > 0 && (
                    <div 
                        className="relative"
                        onMouseEnter={() => setShowSyncStatus(true)}
                        onMouseLeave={() => setShowSyncStatus(false)}
                    >
                        <div className="neo-chip text-zinc-400">
                            {syncErrorCount > 0 ? (
                                <AlertCircle className="w-4 h-4 text-amber-400" />
                            ) : (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            )}
                            <span className="text-xs">{connectedExchanges.length} exchange{connectedExchanges.length > 1 ? 's' : ''}</span>
                            {syncErrorCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                                    {syncErrorCount} issue{syncErrorCount > 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                        
                        {/* Exchanges dropdown */}
                        <AnimatePresence>
                            {showSyncStatus && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                className="absolute top-full right-0 mt-2 w-48 p-3 rounded-xl bg-zinc-900/95 border neo-border shadow-xl z-50 backdrop-blur-md"
                                >
                                    <p className="text-xs text-zinc-500 mb-2">Connected Exchanges</p>
                                    <div className="space-y-1">
                                        {connectedExchanges.map((ex, index) => (
                                            <div key={`${ex}-${index}`} className="py-1">
                                                <div className="flex items-center gap-2">
                                                    {syncDiagnostics[ex]?.status === 'error' ? (
                                                        <AlertCircle className="w-3 h-3 text-amber-400" />
                                                    ) : (
                                                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                                    )}
                                                    <span className="text-xs text-white capitalize">{ex}</span>
                                                </div>
                                                {syncDiagnostics[ex]?.message && (
                                                    <p className="text-[10px] text-amber-500 mt-1 pl-5 max-w-[170px] truncate" title={syncDiagnostics[ex]?.message}>
                                                        {syncDiagnostics[ex]?.message}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
                
                {/* Alerts Badge */}
                <div className="neo-chip">
                    <Bell className={cn(
                        "w-4 h-4",
                        recentTriggered > 0 ? "text-amber-400" : "text-zinc-400"
                    )} />
                    <span className="text-xs text-zinc-400">
                        {enabledAlerts} active
                    </span>
                    {recentTriggered > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                            {recentTriggered} triggered
                        </span>
                    )}
                </div>
                
                {/* Date Range Selector */}
                <DateRangeSelector />

                <ComponentSettingsLink tab="journal" size="xs" title="Journal settings" className="ml-1" />

                {/* Hide Balances */}
                <button
                    onClick={() => setPreferences({ hideBalances: !preferences.hideBalances })}
                    className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border border-transparent",
                        preferences.hideBalances
                            ? "bg-zinc-800 text-zinc-300 border-white/[0.1]"
                            : "bg-zinc-800/50 text-zinc-400 hover:text-white border-white/[0.08]"
                    )}
                >
                    {preferences.hideBalances ? (
                        <EyeOff className="w-4 h-4" />
                    ) : (
                        <Eye className="w-4 h-4" />
                    )}
                </button>

                {/* Real-time Toggle */}
                <button
                    onClick={() => setRealtimeEnabled(!realtimeEnabled)}
                    className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border border-transparent",
                        realtimeEnabled
                            ? "bg-sky-500/20 text-sky-300 border-sky-500/35"
                            : "bg-zinc-800/50 text-zinc-400 hover:text-white border-white/[0.08]"
                    )}
                >
                    <Zap className={cn("w-4 h-4", realtimeEnabled && "animate-pulse")} />
                    <span className="hidden xl:inline">{realtimeEnabled ? 'Live' : 'Paused'}</span>
                </button>

                {/* Permanent Filters */}
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border border-transparent",
                        preferences.permanentFiltersEnabled
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/35"
                            : "bg-zinc-800/50 text-zinc-400 hover:text-white border-white/[0.08]"
                    )}
                >
                    <SlidersHorizontal className="w-4 h-4" />
                </button>

                {/* Sync Button */}
                <button
                    onClick={syncTrades}
                    disabled={isLoading || isSyncing}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/18 border border-emerald-500/26 text-emerald-300 text-sm font-medium hover:bg-emerald-500/25 transition-all disabled:opacity-50"
                >
                    <RefreshCw className={cn("w-4 h-4", (isLoading || isSyncing) && "animate-spin")} />
                    <span className="hidden xl:inline">Sync</span>
                </button>
            </div>

            {/* Filters Dropdown */}
            <AnimatePresence>
                {showFilters && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full right-6 mt-2 w-80 p-4 rounded-xl bg-zinc-900/95 border neo-border shadow-xl z-50 backdrop-blur-md"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-sm font-bold text-white">Permanent Filters</span>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={preferences.permanentFiltersEnabled}
                                    onChange={(e) => setPreferences({ permanentFiltersEnabled: e.target.checked })}
                                    className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500"
                                />
                                <span className="text-xs text-zinc-400">Enabled</span>
                            </label>
                        </div>
                        <p className="text-xs text-zinc-500">
                            Configure permanent filters in the Preferences page.
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
            </div>
        </header>
    );
}
