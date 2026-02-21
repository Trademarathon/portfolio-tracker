"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    CheckCircle2,
    AlertTriangle,
    Info,
    Target,
    TrendingUp,
    TrendingDown,
    Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { loadAlertSettings } from '@/lib/api/alerts';

export type NotificationType = 'success' | 'error' | 'info' | 'warning' | 'alert' | 'trade' | 'terminal';

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    duration?: number;
    symbol?: string;
    side?: 'long' | 'short' | 'buy' | 'sell';
}

interface NotificationContextType {
    notify: (notification: Omit<Notification, 'id'>) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const lastNotificationRef = useRef<Record<string, number>>({});

    const notify = useCallback((n: Omit<Notification, 'id'>) => {
        let allowGrouping = true;
        try {
            allowGrouping = loadAlertSettings().groupSimilarAlerts;
        } catch {
            // Keep safe default
        }
        if (allowGrouping) {
            const now = Date.now();
            const dedupeKey = `${n.type}|${n.title}|${n.message}|${n.symbol || ''}|${n.side || ''}`;
            const lastTs = lastNotificationRef.current[dedupeKey] || 0;
            if (now - lastTs < 2500) return;
            lastNotificationRef.current[dedupeKey] = now;
        }

        const id = Math.random().toString(36).substring(2, 9);
        const newNotification = { ...n, id };
        setNotifications((prev) => [...prev, newNotification]);

        if (n.duration !== 0) {
            setTimeout(() => {
                setNotifications((prev) => prev.filter((item) => item.id !== id));
            }, n.duration || 5000);
        }
    }, []);

    // Also support global events for components that can't use hooks (like raw API listeners)
    useEffect(() => {
        const handleNotifyEvent = (e: any) => {
            if (e.detail) notify(e.detail);
        };
        window.addEventListener('app-notify', handleNotifyEvent);
        return () => window.removeEventListener('app-notify', handleNotifyEvent);
    }, [notify]);

    return (
        <NotificationContext.Provider value={{ notify }}>
            {children}
            <div className="tm-notify-stack fixed bottom-4 right-4 z-[9999] flex flex-col gap-2.5 pointer-events-none w-full max-w-[360px]">
                <AnimatePresence mode="popLayout">
                    {notifications.map((n) => (
                        <NotificationItem
                            key={n.id}
                            notification={n}
                            onClose={() => setNotifications(prev => prev.filter(item => item.id !== n.id))}
                        />
                    ))}
                </AnimatePresence>
            </div>
        </NotificationContext.Provider>
    );
};

const NotificationItem = ({ notification: n, onClose }: { notification: Notification, onClose: () => void }) => {
    const iconMap = {
        success: <CheckCircle2 className="text-emerald-400" size={18} />,
        error: <X className="text-rose-400" size={18} />,
        warning: <AlertTriangle className="text-amber-400" size={18} />,
        info: <Info className="text-blue-400" size={18} />,
        alert: <Target className="text-indigo-400" size={18} />,
        trade: n.side === 'long' || n.side === 'buy' ? <TrendingUp className="text-emerald-400" size={18} /> : <TrendingDown className="text-rose-400" size={18} />,
        terminal: <Activity className="text-purple-400" size={18} />
    };

    const bgColorMap = {
        success: 'bg-emerald-500/10 border-emerald-500/20',
        error: 'bg-rose-500/10 border-rose-500/20',
        warning: 'bg-amber-500/10 border-amber-500/20',
        info: 'bg-blue-500/10 border-blue-500/20',
        alert: 'bg-indigo-500/10 border-indigo-500/20',
        trade: (n.side === 'long' || n.side === 'buy') ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20',
        terminal: 'bg-purple-500/10 border-purple-500/20'
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: 24, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94, x: 16 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
                "tm-notify-toast pointer-events-auto relative overflow-hidden rounded-xl border backdrop-blur-xl p-3 shadow-2xl flex gap-3",
                bgColorMap[n.type]
            )}
        >
            {/* Animated Progress Bar */}
            {n.duration !== 0 && (
                <motion.div
                    initial={{ scaleX: 1 }}
                    animate={{ scaleX: 0 }}
                    transition={{ duration: (n.duration || 5000) / 1000, ease: 'linear' }}
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10 origin-left"
                />
            )}

            <div className="shrink-0 mt-0.5">
                {iconMap[n.type]}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.11em] text-white/90 truncate">
                        {n.title}
                    </h4>
                    <button
                        onClick={onClose}
                        className="text-white/30 hover:text-white transition-colors rounded"
                    >
                        <X size={14} />
                    </button>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                    {n.message}
                </p>
                {n.symbol && (
                    <div className="mt-2 flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] font-black text-indigo-400 border border-indigo-500/20">
                            {n.symbol}
                        </span>
                        {n.side && (
                            <span className={cn(
                                "text-[9px] font-black uppercase",
                                (n.side === 'long' || n.side === 'buy') ? "text-emerald-400" : "text-rose-400"
                            )}>
                                {n.side}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Terminal Scanline Effect */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-white/5 to-transparent h-1/2 -translate-y-full animate-[scan_2s_linear_infinite]" />
        </motion.div>
    );
};
