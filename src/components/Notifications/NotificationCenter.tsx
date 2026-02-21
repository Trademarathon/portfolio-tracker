"use client";

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bell,
    X,
    Check,
    CheckCheck,
    Trash2,
    Clock,
    AlertTriangle,
    AlertOctagon,
    Info,
    ChevronDown,
    Filter,
    Volume2,
    VolumeX,
    Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdvancedAlerts } from '@/hooks/useAdvancedAlerts';
import { AlertHistory, AlertPriority, PRIORITY_CONFIG } from '@/lib/api/alerts';
import Link from 'next/link';

const priorityIcons: Record<AlertPriority, React.ReactNode> = {
    low: <Info className="h-3.5 w-3.5" />,
    medium: <Bell className="h-3.5 w-3.5" />,
    high: <AlertTriangle className="h-3.5 w-3.5" />,
    critical: <AlertOctagon className="h-3.5 w-3.5" />,
};

function formatTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

interface NotificationCenterProps {
    isOpen: boolean;
    onClose: () => void;
}

interface NotificationGroup {
    id: string;
    representative: AlertHistory;
    items: AlertHistory[];
    count: number;
    unreadCount: number;
    latestTimestamp: number;
}

const GROUP_MERGE_WINDOW_MS = 10 * 60 * 1000;

function alertSymbol(item: AlertHistory): string {
    const data = item.data as Record<string, unknown> | undefined;
    const symbol = data?.symbol;
    return typeof symbol === 'string' ? symbol.toUpperCase() : '';
}

function alertSignature(item: AlertHistory): string {
    return [
        item.priority,
        item.alertName?.trim().toLowerCase() || '',
        alertSymbol(item),
        item.message?.trim().toLowerCase() || '',
        (item.channels || []).slice().sort().join(','),
    ].join('|');
}

function groupSimilarAlerts(items: AlertHistory[]): NotificationGroup[] {
    const groups: NotificationGroup[] = [];

    for (const item of items) {
        const signature = alertSignature(item);
        const previous = groups[groups.length - 1];
        const previousSignature = previous ? alertSignature(previous.representative) : '';
        const withinWindow = previous ? Math.abs(previous.latestTimestamp - item.timestamp) <= GROUP_MERGE_WINDOW_MS : false;

        if (previous && previousSignature === signature && withinWindow) {
            previous.items.push(item);
            previous.count += 1;
            if (!item.acknowledged) previous.unreadCount += 1;
            previous.latestTimestamp = Math.max(previous.latestTimestamp, item.timestamp);
            continue;
        }

        groups.push({
            id: `${item.id || item.alertId || 'history'}-${item.timestamp}`,
            representative: item,
            items: [item],
            count: 1,
            unreadCount: item.acknowledged ? 0 : 1,
            latestTimestamp: item.timestamp,
        });
    }

    return groups;
}

function toNotificationGroups(items: AlertHistory[]): NotificationGroup[] {
    return items.map((item, index) => ({
        id: `${item.id || item.alertId || 'history'}-${item.timestamp}-${index}`,
        representative: item,
        items: [item],
        count: 1,
        unreadCount: item.acknowledged ? 0 : 1,
        latestTimestamp: item.timestamp,
    }));
}

export function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
    const { 
        history, 
        unreadCount, 
        acknowledgeHistory, 
        acknowledgeAll, 
        clearHistory,
        settings,
        updateSettings,
    } = useAdvancedAlerts();
    
    const [filter, setFilter] = useState<AlertPriority | 'all'>('all');
    const [showFilters, setShowFilters] = useState(false);
    
    const filteredHistory = filter === 'all' 
        ? history 
        : history.filter(h => h.priority === filter);
    
    const groupedItems = React.useMemo(
        () => (settings.groupSimilarAlerts ? groupSimilarAlerts(filteredHistory) : toNotificationGroups(filteredHistory)),
        [filteredHistory, settings.groupSimilarAlerts]
    );

    const groupedHistory = React.useMemo(() => {
        const today: NotificationGroup[] = [];
        const yesterday: NotificationGroup[] = [];
        const older: NotificationGroup[] = [];
        
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const yesterdayStart = todayStart - 86400000;
        
        for (const group of groupedItems) {
            if (group.latestTimestamp >= todayStart) {
                today.push(group);
            } else if (group.latestTimestamp >= yesterdayStart) {
                yesterday.push(group);
            } else {
                older.push(group);
            }
        }
        
        return { today, yesterday, older };
    }, [groupedItems]);

    const getHistoryKey = useCallback((item: NotificationGroup, index: number) => {
        const trimmedId = (item.id || "").trim();
        if (trimmedId) return trimmedId;
        // Fallback for legacy history entries missing an id.
        // Include index to guarantee uniqueness within a rendered list.
        return `${item.representative.alertId || "alert"}-${item.latestTimestamp || 0}-${index}`;
    }, []);
    
    if (!isOpen) return null;
    
    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />
            <motion.div
                initial={{ opacity: 0, x: 300 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 300 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="tm-notif-shell fixed right-0 top-0 bottom-0 w-full max-w-md z-[101] border-l border-white/10 shadow-2xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="tm-notif-header p-4 border-b border-white/10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="tm-notif-bell-wrap p-2 rounded-xl text-cyan-300">
                                    <Bell size={20} />
                                </div>
                                {unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white px-1">
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                )}
                            </div>
                            <div>
                                <h2 className="text-base font-black text-white">Notification Center</h2>
                                <p className="text-[10px] text-zinc-500">
                                    {settings.groupSimilarAlerts
                                        ? `${groupedItems.length} stacks • ${history.length} alerts • ${unreadCount} unread`
                                        : `${history.length} alerts • ${unreadCount} unread`}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                    
                    {/* Actions Bar */}
                    <div className="tm-notif-actions flex items-center gap-2 mt-3">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={cn(
                                "tm-notif-action-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors",
                                showFilters 
                                    ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                                    : "bg-white/5 text-zinc-400 hover:text-white"
                            )}
                        >
                            <Filter size={12} />
                            Filter
                            <ChevronDown size={10} className={cn("transition-transform", showFilters && "rotate-180")} />
                        </button>

                        <button
                            onClick={() => updateSettings({ groupSimilarAlerts: !settings.groupSimilarAlerts })}
                            className={cn(
                                "tm-notif-action-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors",
                                settings.groupSimilarAlerts
                                    ? "bg-cyan-500/16 text-cyan-300 border border-cyan-500/35"
                                    : "bg-white/5 text-zinc-400 hover:text-white"
                            )}
                            title="Toggle grouping for similar notifications"
                        >
                            {settings.groupSimilarAlerts ? 'Grouping: ON' : 'Grouping: OFF'}
                        </button>
                        
                        {unreadCount > 0 && (
                            <button
                                onClick={acknowledgeAll}
                                className="tm-notif-action-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-zinc-400 hover:text-white text-[10px] font-bold transition-colors"
                            >
                                <CheckCheck size={12} />
                                Mark All Read
                            </button>
                        )}
                        
                        {history.length > 0 && (
                            <button
                                onClick={clearHistory}
                                className="tm-notif-action-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-zinc-400 hover:text-rose-400 text-[10px] font-bold transition-colors ml-auto"
                            >
                                <Trash2 size={12} />
                                Clear All
                            </button>
                        )}
                    </div>
                    
                    {/* Filter Pills */}
                    <AnimatePresence>
                        {showFilters && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
                                    {(['all', 'critical', 'high', 'medium', 'low'] as const).map((priority) => (
                                        <button
                                            key={priority}
                                            onClick={() => setFilter(priority)}
                                            className={cn(
                                                "px-3 py-1 rounded-full text-[10px] font-bold transition-all",
                                                filter === priority
                                                    ? priority === 'all'
                                                        ? "bg-white text-black"
                                                        : cn(PRIORITY_CONFIG[priority].bgColor, PRIORITY_CONFIG[priority].color)
                                                    : "bg-white/5 text-zinc-500 hover:text-white"
                                            )}
                                        >
                                            {priority === 'all' ? 'All' : priority.charAt(0).toUpperCase() + priority.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                
                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {groupedItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center p-6">
                            <div className="p-4 rounded-2xl bg-zinc-800/30 border border-white/5 mb-4">
                                <Bell size={32} className="text-zinc-600" />
                            </div>
                            <h3 className="text-sm font-bold text-zinc-400 mb-1">No Notifications</h3>
                            <p className="text-[11px] text-zinc-600 max-w-[200px]">
                                {filter === 'all' 
                                    ? "Your alert history will appear here when alerts are triggered"
                                    : `No ${filter} priority alerts found`
                                }
                            </p>
                        </div>
                    ) : (
                        <div className="p-4 space-y-4">
                            {/* Today */}
                            {groupedHistory.today.length > 0 && (
                                <div>
                                    <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Today</h4>
                                    <div className="space-y-2">
                                        {groupedHistory.today.map((item, index) => (
                                            <NotificationItem
                                                key={getHistoryKey(item, index)}
                                                group={item}
                                                onAcknowledge={() => {
                                                    item.items
                                                        .filter((h) => !h.acknowledged)
                                                        .forEach((h) => {
                                                            if (h.id) acknowledgeHistory(h.id);
                                                        });
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {/* Yesterday */}
                            {groupedHistory.yesterday.length > 0 && (
                                <div>
                                    <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Yesterday</h4>
                                    <div className="space-y-2">
                                        {groupedHistory.yesterday.map((item, index) => (
                                            <NotificationItem
                                                key={getHistoryKey(item, index)}
                                                group={item}
                                                onAcknowledge={() => {
                                                    item.items
                                                        .filter((h) => !h.acknowledged)
                                                        .forEach((h) => {
                                                            if (h.id) acknowledgeHistory(h.id);
                                                        });
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {/* Older */}
                            {groupedHistory.older.length > 0 && (
                                <div>
                                    <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Earlier</h4>
                                    <div className="space-y-2">
                                        {groupedHistory.older.map((item, index) => (
                                            <NotificationItem
                                                key={getHistoryKey(item, index)}
                                                group={item}
                                                onAcknowledge={() => {
                                                    item.items
                                                        .filter((h) => !h.acknowledged)
                                                        .forEach((h) => {
                                                            if (h.id) acknowledgeHistory(h.id);
                                                        });
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
                {/* Footer */}
                <div className="tm-notif-footer p-4 border-t border-white/10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {settings.soundEnabled ? (
                                <Volume2 size={14} className="text-emerald-400" />
                            ) : (
                                <VolumeX size={14} className="text-zinc-500" />
                            )}
                            <span className="text-[10px] text-zinc-500">
                                Sound {settings.soundEnabled ? 'On' : 'Off'}
                            </span>
                        </div>
                        <Link
                            href="/settings?tab=alerts"
                            className="flex items-center gap-1.5 text-[10px] text-indigo-400 hover:text-indigo-300 font-bold transition-colors"
                        >
                            <Settings size={12} />
                            Configure Alerts
                        </Link>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

function NotificationItem({ group, onAcknowledge }: { group: NotificationGroup; onAcknowledge: () => void }) {
    const item = group.representative;
    const config = PRIORITY_CONFIG[item.priority];
    const itemSymbol = alertSymbol(item);
    const channels = Array.from(new Set(group.items.flatMap((h) => h.channels || [])));
    const isRead = group.unreadCount === 0;
    
    return (
        <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.985 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -1.5 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
                "tm-notif-item relative p-3 rounded-xl border transition-all",
                isRead
                    ? "tm-notif-item-read bg-white/[0.02] border-white/5"
                    : cn(config.bgColor, "tm-notif-item-unread border-white/10"),
                !isRead && "ring-1 ring-inset",
                !isRead && item.priority === 'critical' && "ring-rose-500/30",
                !isRead && item.priority === 'high' && "ring-amber-500/30",
                !isRead && item.priority === 'medium' && "ring-blue-500/30",
            )}
        >
            <div className="flex items-start gap-3">
                {/* Priority Icon */}
                <div className={cn(
                    "p-1.5 rounded-lg shrink-0 mt-0.5",
                    config.bgColor,
                    config.color
                )}>
                    {priorityIcons[item.priority]}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                        <h5 className={cn(
                            "text-[12px] font-black truncate tracking-[0.01em]",
                            isRead ? "text-zinc-400" : "text-white"
                        )}>
                            {item.alertName}
                        </h5>
                        <span className="text-[9px] text-zinc-600 shrink-0 flex items-center gap-1">
                            <Clock size={10} />
                            {formatTimeAgo(group.latestTimestamp)}
                        </span>
                    </div>
                    
                    <p className={cn(
                        "text-[11px] leading-snug",
                        isRead ? "text-zinc-600" : "text-zinc-400"
                    )}>
                        {item.message}
                    </p>
                    
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {channels.slice(0, 4).map((channel, index) => (
                            <span
                                key={`${channel || 'channel'}-${index}`}
                                className="px-1.5 py-0.5 rounded bg-white/5 text-[8px] font-bold text-zinc-500 uppercase tracking-wide"
                            >
                                {channel.replace('_', ' ')}
                            </span>
                        ))}
                        
                        {channels.length > 4 && (
                            <span className="px-1.5 py-0.5 rounded bg-white/5 text-[8px] font-bold text-zinc-500">
                                +{channels.length - 4}
                            </span>
                        )}

                        {itemSymbol && (
                            <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-[8px] font-bold text-indigo-400 border border-indigo-500/20">
                                {itemSymbol}
                            </span>
                        )}

                        {group.count > 1 && (
                            <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-[8px] font-bold text-cyan-300 border border-cyan-500/20">
                                {group.count}x
                            </span>
                        )}
                    </div>
                </div>
                
                {/* Acknowledge Button */}
                {!isRead && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onAcknowledge();
                        }}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-emerald-400 transition-colors shrink-0"
                        title="Mark as read"
                    >
                        <Check size={14} />
                    </button>
                )}
            </div>
            
            {/* Unread indicator */}
            {!isRead && (
                <div className={cn(
                    "absolute top-3 left-0 w-1 h-4 rounded-r",
                    item.priority === 'critical' && "bg-rose-500",
                    item.priority === 'high' && "bg-amber-500",
                    item.priority === 'medium' && "bg-blue-500",
                    item.priority === 'low' && "bg-zinc-500",
                )} />
            )}
        </motion.div>
    );
}

// Bell button for triggering the notification center
export function NotificationBell() {
    const [isOpen, setIsOpen] = useState(false);
    const { unreadCount } = useAdvancedAlerts();
    
    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="tm-notif-bell-btn relative p-2 rounded-xl text-zinc-400 hover:text-white transition-colors"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white px-1"
                    >
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </motion.span>
                )}
            </button>
            
            <NotificationCenter isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </>
    );
}
