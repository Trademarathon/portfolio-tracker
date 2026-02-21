"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
    Bell,
    Activity,
    Calendar,
    TrendingUp,
    TrendingDown,
    Minus,
    LogIn,
    LogOut,
    BadgeCheck,
    PanelLeftClose,
    PanelLeftOpen,
    EyeOff,
    Sparkles,
} from "lucide-react";
import { ToggleTheme } from "@/components/ui/toggle-theme";
import { Switch } from "@/components/ui/switch";
import { memo, useCallback, useEffect, useState, useMemo } from "react";
import { getActiveSession, TradingSession, getSpotPlans } from "@/lib/api/session";
import { loadAlertHistory, AlertHistory, ALERT_HISTORY_KEY } from "@/lib/api/alerts";
import { useMarketActivityGlow } from '@/hooks/useMarketActivityGlow';
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { isBuilder } from "@/lib/user-cloud/config";
import { signOut } from "@/lib/supabase/auth";
import { getValueWithCloud } from "@/lib/supabase/sync";
import { MAIN_SIDEBAR_ITEMS } from "@/lib/nav-definitions";
import { useSidebarSessionIntel } from "@/hooks/useSidebarSessionIntel";
import { useAIInsight } from "@/lib/ai-orchestrator/hooks";
import { getFeatureRolloutPercent, isFeatureEnabled } from "@/lib/ai-orchestrator/orchestrator";
import {
    AI_RUNTIME_CHANGED_EVENT,
    AI_RUNTIME_ENABLED_STORAGE_KEY,
    isAIRuntimeEnabled,
    setAIRuntimeEnabled,
} from "@/lib/ai-runtime";

// ============ TRADING SESSION HOURS CONFIG ============
interface TradingHours {
    name: string;
    shortName: string;
    startHour: number; // UTC
    endHour: number;   // UTC
    color: string;
    gradient: string;
    description: string;
    volatility: 'low' | 'medium' | 'high';
}

const TRADING_SESSIONS: TradingHours[] = [
    {
        name: 'Asia Session',
        shortName: 'ASIA',
        startHour: 0,  // 00:00 UTC (8 AM Tokyo)
        endHour: 8,    // 08:00 UTC
        color: 'rose',
        gradient: 'from-rose-500/20 to-pink-500/10',
        description: 'Tokyo • Singapore • HK',
        volatility: 'low',
    },
    {
        name: 'London Session',
        shortName: 'LONDON',
        startHour: 7,   // 07:00 UTC (8 AM London)
        endHour: 16,    // 16:00 UTC
        color: 'blue',
        gradient: 'from-blue-500/20 to-cyan-500/10',
        description: 'London • Frankfurt',
        volatility: 'medium',
    },
    {
        name: 'New York Session',
        shortName: 'NY',
        startHour: 13,  // 13:00 UTC (9 AM EST)
        endHour: 21,    // 21:00 UTC (5 PM EST)
        color: 'amber',
        gradient: 'from-amber-500/20 to-orange-500/10',
        description: 'NYSE • NASDAQ',
        volatility: 'medium',
    },
    {
        name: 'End Session',
        shortName: 'END',
        startHour: 21,
        endHour: 0,
        color: 'zinc',
        gradient: 'from-zinc-500/10 to-zinc-600/5',
        description: 'Low liquidity',
        volatility: 'low',
    },
];

// Check which trading session we're in
function getTradingSessionForDate(date: Date): TradingHours & { isOverlap: boolean; overlapWith?: string } {
    const utcHour = date.getUTCHours();
    
    // Check for overlaps (multiple sessions active)
    const activeSessions = TRADING_SESSIONS.filter(session => {
        if (session.startHour < session.endHour) {
            return utcHour >= session.startHour && utcHour < session.endHour;
        } else {
            return utcHour >= session.startHour || utcHour < session.endHour;
        }
    });
    
    if (activeSessions.length > 1) {
        // Overlap - prioritize by volatility
        const primary = activeSessions.find(s => s.volatility === 'high' || s.volatility === 'medium') || activeSessions[0];
        const secondary = activeSessions.find(s => s !== primary);
        return { ...primary, isOverlap: true, overlapWith: secondary?.shortName };
    }
    
    return { ...activeSessions[0] || TRADING_SESSIONS[3], isOverlap: false };
}

const SESSION_VISUALS = {
    live: {
        card: "bg-gradient-to-br from-emerald-500/18 via-emerald-500/8 to-transparent border-emerald-400/30 hover:border-emerald-300/45",
        glow: "bg-emerald-400/35",
        shimmer: "bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent",
        highlight: "text-emerald-300",
    },
    amber: {
        card: "bg-gradient-to-br from-amber-500/18 via-amber-500/8 to-transparent border-amber-400/30 hover:border-amber-300/45",
        glow: "bg-amber-400/35",
        shimmer: "bg-gradient-to-r from-transparent via-amber-300/35 to-transparent",
        highlight: "text-amber-300",
    },
    blue: {
        card: "bg-gradient-to-br from-blue-500/18 via-blue-500/8 to-transparent border-blue-400/30 hover:border-blue-300/45",
        glow: "bg-blue-400/35",
        shimmer: "bg-gradient-to-r from-transparent via-blue-300/35 to-transparent",
        highlight: "text-blue-300",
    },
    rose: {
        card: "bg-gradient-to-br from-rose-500/18 via-rose-500/8 to-transparent border-rose-400/30 hover:border-rose-300/45",
        glow: "bg-rose-400/35",
        shimmer: "bg-gradient-to-r from-transparent via-rose-300/35 to-transparent",
        highlight: "text-rose-300",
    },
    zinc: {
        card: "bg-gradient-to-br from-zinc-700/18 via-zinc-700/8 to-transparent border-zinc-500/25 hover:border-zinc-400/40",
        glow: "bg-zinc-500/30",
        shimmer: "bg-gradient-to-r from-transparent via-zinc-300/20 to-transparent",
        highlight: "text-zinc-300",
    },
} as const;

import { NavItem } from "@/components/ui/NavItem";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { NotificationBell } from "@/components/Notifications/NotificationCenter";

interface SidebarProps {
    className?: string;
    onClose?: () => void; // For mobile close
    collapsed?: boolean;
    hidden?: boolean;
    autoHide?: boolean;
    onToggleCollapsed?: () => void;
    onToggleHidden?: () => void;
    onToggleAutoHide?: () => void;
    onOpen?: () => void;
}

const Sidebar = memo(({ 
    className, 
    onClose,
    collapsed = false,
    hidden = false,
    autoHide = false,
    onToggleCollapsed,
    onToggleHidden,
    onToggleAutoHide,
    onOpen: _onOpen,
}: SidebarProps) => {
    const pathname = usePathname();
    const router = useRouter();
    const { wsConnectionStatus } = usePortfolio();
    const [pendingHref, setPendingHref] = useState<string | null>(null);
    const [activeSession, setActiveSession] = useState<TradingSession | null>(null);
    const [activeSpotPlans, setActiveSpotPlans] = useState<number>(0);
    const [sessionTimer, setSessionTimer] = useState<string>('00:00:00');
    // Hydration-safe defaults: render stable text on server, fill after mount
    const [mounted, setMounted] = useState(false);
    const [tradingHours, setTradingHours] = useState<TradingHours & { isOverlap: boolean; overlapWith?: string }>(() => ({
        ...TRADING_SESSIONS[3],
        isOverlap: false,
    }));
    const isHighVolumeActivity = useMarketActivityGlow(); // Glow only when real market volume + trade activity are high
    const { user, cloudSyncEnabled, clearSessionImmediate } = useSupabaseAuth();
    // Initialize from storage so Market Session alert count is stable across navigation (no flash of 0)
    const [recentAlerts, setRecentAlerts] = useState<AlertHistory[]>([]);
    const [currentTime, setCurrentTime] = useState<Date | null>(null);
    const [sessionAdvisoryEnabled, setSessionAdvisoryEnabled] = useState(true);
    const [aiRuntimeEnabled, setAiRuntimeEnabledState] = useState<boolean>(() => isAIRuntimeEnabled());
    const sessionIntel = useSidebarSessionIntel({
        activeSession,
        isHighVolumeActivity,
        tradingHours,
        enabled: !collapsed && !hidden,
    });
    const unacknowledgedAlertCount = useMemo(
        () => recentAlerts.filter((a) => !a.acknowledged).length,
        [recentAlerts]
    );

    const formatEventCountdown = useCallback((minutesToEvent: number, isLive: boolean) => {
        if (isLive) return "LIVE";
        if (minutesToEvent <= 0) return "Now";
        if (minutesToEvent < 60) return `in ${minutesToEvent}m`;
        const hours = Math.floor(minutesToEvent / 60);
        const mins = minutesToEvent % 60;
        return mins > 0 ? `in ${hours}h ${mins}m` : `in ${hours}h`;
    }, []);

    const riskStyles = useMemo(() => {
        const map = {
            live: {
                row: "bg-rose-500/10 border-rose-400/30 text-rose-300",
                chip: "bg-rose-500/20 text-rose-300",
                recommendation: "text-rose-300",
            },
            imminent: {
                row: "bg-amber-500/10 border-amber-400/30 text-amber-300",
                chip: "bg-amber-500/20 text-amber-300",
                recommendation: "text-amber-300",
            },
            watch: {
                row: "bg-amber-500/10 border-amber-500/20 text-amber-300",
                chip: "bg-amber-500/20 text-amber-300",
                recommendation: "text-amber-300",
            },
            active: {
                row: "bg-emerald-500/10 border-emerald-500/25 text-emerald-300",
                chip: "bg-emerald-500/20 text-emerald-300",
                recommendation: "text-emerald-300",
            },
            low: {
                row: "bg-zinc-700/20 border-zinc-600/30 text-zinc-400",
                chip: "bg-zinc-700/50 text-zinc-400",
                recommendation: "text-zinc-400",
            },
            safe: {
                row: "bg-blue-500/10 border-blue-500/20 text-blue-300",
                chip: "bg-blue-500/20 text-blue-300",
                recommendation: "text-blue-300",
            },
        } as const;
        return map[sessionIntel.riskState] || map.safe;
    }, [sessionIntel.riskState]);
    const sessionVisualTone = activeSession
        ? "live"
        : ((tradingHours.color in SESSION_VISUALS ? tradingHours.color : "zinc") as keyof typeof SESSION_VISUALS);
    const sessionVisual = SESSION_VISUALS[sessionVisualTone];
    const refreshSessionAdvisoryEnabled = useCallback(() => {
        const enabled = isFeatureEnabled("session_advisory");
        const rolloutPercent = getFeatureRolloutPercent("session_advisory");
        setSessionAdvisoryEnabled(aiRuntimeEnabled && enabled && rolloutPercent > 0);
    }, [aiRuntimeEnabled]);
    const sessionAIContext = useMemo(() => {
        const riskSeverity =
            sessionIntel.riskState === "live" || sessionIntel.riskState === "imminent"
                ? "critical"
                : sessionIntel.riskState === "watch" || sessionIntel.riskState === "active"
                    ? "warning"
                    : "info";
        const nextEvent = sessionIntel.nextEvent
            ? {
                id: sessionIntel.nextEvent.id,
                title: sessionIntel.nextEvent.title,
                impact: sessionIntel.nextEvent.impact,
                minutesToEvent: sessionIntel.nextEvent.minutesToEvent,
                isLive: sessionIntel.nextEvent.isLive,
            }
            : null;
        return {
            snapshotTs: sessionIntel.updatedAt || Date.now(),
            source: "sidebar-session",
            sources: ["session-clock", "calendar-events"],
            dataCoverage: nextEvent ? 0.92 : 0.72,
            riskSeverity,
            session: {
                name: tradingHours.name,
                shortName: tradingHours.shortName,
                isOverlap: tradingHours.isOverlap,
                overlapWith: tradingHours.overlapWith || null,
                recommendation: sessionIntel.recommendation,
                riskState: sessionIntel.riskState,
            },
            activeTradeSession: activeSession
                ? {
                    bias: activeSession.bias || "neutral",
                    risk: activeSession.risk || "normal",
                    horizon: activeSession.horizon || "unknown",
                    live: true,
                }
                : { live: false },
            nextEvent,
            openPlanCount: activeSpotPlans,
            unacknowledgedAlertCount,
            riskSignals: nextEvent
                ? [
                    {
                        rule: "event_window",
                        severity: riskSeverity,
                        verdict: riskSeverity === "info" ? "allow" : "warn",
                        evidence: [
                            `${nextEvent.title} impact ${nextEvent.impact}`,
                            nextEvent.isLive
                                ? "Event is currently live"
                                : `Event in ${Math.max(0, nextEvent.minutesToEvent)} minutes`,
                        ],
                    },
                ]
                : [
                    {
                        rule: "session_flow",
                        severity: riskSeverity,
                        verdict: riskSeverity === "info" ? "allow" : "warn",
                        evidence: [sessionIntel.recommendation],
                    },
                ],
        };
    }, [
        sessionIntel.updatedAt,
        sessionIntel.nextEvent,
        sessionIntel.recommendation,
        sessionIntel.riskState,
        tradingHours.name,
        tradingHours.shortName,
        tradingHours.isOverlap,
        tradingHours.overlapWith,
        activeSession,
        activeSpotPlans,
        unacknowledgedAlertCount,
    ]);
    const { data: sessionAdvisory, loading: sessionAdvisoryLoading } = useAIInsight(
        "session_advisory",
        sessionAIContext,
        [
            sessionIntel.updatedAt,
            sessionIntel.riskState,
            sessionIntel.nextEvent?.id || "none",
            sessionIntel.nextEvent?.minutesToEvent ?? -999,
            tradingHours.shortName,
            tradingHours.isOverlap,
            activeSession?.bias || "neutral",
            activeSession?.risk || "normal",
            activeSpotPlans,
            unacknowledgedAlertCount,
        ],
        !collapsed && !hidden && mounted && sessionAdvisoryEnabled
    );
    const sessionAdvisoryBlocked = sessionAdvisory?.signalMeta?.verdict === "block";
    const sessionAdvisoryText = sessionAdvisoryLoading
        ? "Analyzing session risk..."
        : sessionAdvisoryBlocked
            ? sessionIntel.recommendation
            : sessionAdvisory?.content || sessionIntel.recommendation;
    const setAiRuntimeEnabled = useCallback((enabled: boolean) => {
        setAiRuntimeEnabledState(enabled);
        setAIRuntimeEnabled(enabled);
    }, []);

    useEffect(() => {
        setMounted(true);
        setCurrentTime(new Date());
    }, []);

    useEffect(() => {
        const syncRuntime = () => setAiRuntimeEnabledState(isAIRuntimeEnabled());
        const onStorage = (event: StorageEvent) => {
            if (event.key === AI_RUNTIME_ENABLED_STORAGE_KEY) syncRuntime();
        };
        syncRuntime();
        window.addEventListener(AI_RUNTIME_CHANGED_EVENT, syncRuntime);
        window.addEventListener("storage", onStorage);
        return () => {
            window.removeEventListener(AI_RUNTIME_CHANGED_EVENT, syncRuntime);
            window.removeEventListener("storage", onStorage);
        };
    }, []);

    useEffect(() => {
        refreshSessionAdvisoryEnabled();
        window.addEventListener("ai-feature-toggles-changed", refreshSessionAdvisoryEnabled);
        return () => window.removeEventListener("ai-feature-toggles-changed", refreshSessionAdvisoryEnabled);
    }, [refreshSessionAdvisoryEnabled]);
    // Lightweight on-demand prefetch only (avoid preloading every route in desktop webview)
    const prefetchRoute = useCallback((href: string) => {
        router.prefetch(href);
    }, [router]);

    // Load and sync active session
    useEffect(() => {
        const loadSession = () => {
            setActiveSession(getActiveSession());
            const plans = getSpotPlans();
            setActiveSpotPlans(plans.filter(p => p.isActive).length);
        };
        
        loadSession();
        
        // Listen for session updates
        const handleSessionUpdate = () => loadSession();
        window.addEventListener('storage', handleSessionUpdate);
        window.addEventListener('spot-plans-updated', handleSessionUpdate);
        
        return () => {
            window.removeEventListener('storage', handleSessionUpdate);
            window.removeEventListener('spot-plans-updated', handleSessionUpdate);
        };
    }, []);

    // Live session timer + trading hours update
    useEffect(() => {
        const updateAll = () => {
            // Update session timer
            if (activeSession?.startTime) {
                const elapsed = Date.now() - activeSession.startTime;
                const hours = Math.floor(elapsed / 3600000);
                const minutes = Math.floor((elapsed % 3600000) / 60000);
                const seconds = Math.floor((elapsed % 60000) / 1000);
                setSessionTimer(
                    `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
                );
            } else {
                setSessionTimer('00:00:00');
            }
            
            // Update trading hours:
            // - If a live session is running, keep the card synced to the session start-time
            //   (otherwise it can drift into the next market session and look wrong).
            const sessionDate = activeSession?.startTime ? new Date(activeSession.startTime) : new Date();
            setTradingHours(getTradingSessionForDate(sessionDate));
            setCurrentTime(new Date());
        };
        
        updateAll();
        const interval = setInterval(updateAll, 1000);
        return () => clearInterval(interval);
    }, [activeSession?.startTime]);

    // Load recent alerts (and sync when history is cleared elsewhere, e.g. Notification Center).
    // When cloud sync is on, use cloud as source of truth so count is stable across tabs/navigation.
    const HISTORY_SYNC_EVENT = 'advanced-alerts-history-synced';
    useEffect(() => {
        const applyHistory = (history: AlertHistory[]) => {
            const recent = history
                .filter(a => Date.now() - a.timestamp < 86400000)
                .sort((a, b) => {
                    if (!a.acknowledged && b.acknowledged) return -1;
                    if (a.acknowledged && !b.acknowledged) return 1;
                    return b.timestamp - a.timestamp;
                })
                .slice(0, 5);
            setRecentAlerts(recent);
        };

        const loadRecentAlerts = () => {
            if (user?.id && cloudSyncEnabled) {
                getValueWithCloud(ALERT_HISTORY_KEY, user.id, true).then((raw) => {
                    if (!raw) {
                        applyHistory(loadAlertHistory());
                        return;
                    }
                    try {
                        const parsed = JSON.parse(raw) as AlertHistory[];
                        applyHistory(Array.isArray(parsed) ? parsed : []);
                    } catch {
                        applyHistory(loadAlertHistory());
                    }
                });
            } else {
                applyHistory(loadAlertHistory());
            }
        };

        loadRecentAlerts();
        const interval = setInterval(loadRecentAlerts, 30000); // Refresh every 30s
        window.addEventListener('alert-triggered', loadRecentAlerts);
        window.addEventListener(HISTORY_SYNC_EVENT, loadRecentAlerts);

        return () => {
            clearInterval(interval);
            window.removeEventListener('alert-triggered', loadRecentAlerts);
            window.removeEventListener(HISTORY_SYNC_EVENT, loadRecentAlerts);
        };
    }, [user?.id, cloudSyncEnabled]);

    // Keep UI feedback instant while Link handles route transition.
    const handleNavClick = useCallback((_e: React.MouseEvent, href: string) => {
        setPendingHref(href);
        onClose?.();
        setTimeout(() => setPendingHref(null), 250);
    }, [onClose]);

    // Memoize status calculation
    const { systemStatus, connectedCount, totalConnections } = useMemo(() => {
        const statusArray = Array.from(wsConnectionStatus?.values() || []);
        const total = statusArray.length;
        const connected = statusArray.filter(s => s.status === 'connected').length;
        
        let status: 'online' | 'partial' | 'offline' = 'offline';
        if (total > 0) {
            if (connected === total) status = 'online';
            else if (connected > 0) status = 'partial';
        } else {
            status = 'online';
        }
        
        return { systemStatus: status, connectedCount: connected, totalConnections: total };
    }, [wsConnectionStatus]);

    return (
        <div className={cn(
            "relative h-screen border-r border-white/10 flex flex-col z-50 rounded-none clone-divider clone-noise font-dm-sans",
            "bg-[linear-gradient(180deg,#070a12_0%,#060911_44%,#05080f_100%)]",
            collapsed ? "w-[72px]" : "w-64",
            className
        )}>
            {/* Accent rail */}
            <div className="absolute left-0 top-0 h-full w-[2px] bg-gradient-to-b from-emerald-400/60 via-transparent to-indigo-500/40" />
            <motion.div
                className="pointer-events-none absolute -left-16 top-[-3rem] h-44 w-44 rounded-full bg-cyan-500/12 blur-3xl"
                animate={{ opacity: [0.2, 0.46, 0.2], x: [0, 14, 0], y: [0, 10, 0] }}
                transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
                className="pointer-events-none absolute right-[-3.25rem] top-20 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl"
                animate={{ opacity: [0.14, 0.32, 0.14], x: [0, -18, 0], y: [0, 12, 0] }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_40%_at_20%_0%,rgba(56,189,248,0.06),rgba(0,0,0,0))]" />

            <div className="relative z-10 p-4">
                <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                    <div className="flex items-center justify-between">
                    <Link href="/" prefetch={false} className="flex items-center gap-3 group">
                        {!collapsed ? (
                            <div className="relative h-10 w-36 overflow-hidden">
                                <Image
                                    src="/trade-marathon-logo.png"
                                    alt="Trade Marathon®"
                                    fill
                                    sizes="144px"
                                    className="object-contain filter dark:brightness-110"
                                    priority
                                />
                            </div>
                        ) : (
                            <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center">
                                <span className="text-white font-black text-lg tracking-tighter italic">T</span>
                            </div>
                        )}
                    </Link>
                    {!collapsed && (
                        <div className="flex items-center gap-1">
                            <NotificationBell />
                            {user && isBuilder(user) && (
                                <span className="flex items-center justify-center rounded-full bg-amber-400/20 text-amber-400" title="Admin account">
                                    <BadgeCheck className="h-5 w-5" strokeWidth={2.5} />
                                </span>
                            )}
                        </div>
                    )}
                </div>
                    {!collapsed && (
                        <div className="mt-3 flex items-center justify-between">
                            <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-400/25 bg-amber-500/12 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-amber-300">
                                <Sparkles className="h-2.5 w-2.5" />
                                Early beta
                            </span>
                            <span className="text-[9px] uppercase tracking-[0.18em] text-zinc-500">
                                Control Deck
                            </span>
                        </div>
                    )}
                </div>

                <nav className="relative mb-6 space-y-1.5">
                    {!collapsed && (
                        <p className="px-2 pb-1 text-[9px] font-black uppercase tracking-[0.24em] text-zinc-500">
                            Navigation
                        </p>
                    )}
                    {MAIN_SIDEBAR_ITEMS.map((item, index) => (
                        <motion.div
                            key={item.href}
                            initial={!collapsed ? { opacity: 0, x: -10 } : false}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.25, delay: Math.min(index * 0.025, 0.2), ease: [0.22, 1, 0.36, 1] }}
                        >
                            <NavItem
                                item={item}
                                variant="main"
                                isActive={pathname === item.href || pendingHref === item.href}
                                isPending={pendingHref === item.href}
                                onClick={handleNavClick}
                                onPrefetch={prefetchRoute}
                                collapsed={collapsed}
                            />
                        </motion.div>
                    ))}
                    {!user ? (
                        <motion.div
                            initial={!collapsed ? { opacity: 0, x: -10 } : false}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.25, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        >
                            <NavItem
                                key="/login"
                                item={{ href: "/login", title: "Sign in", icon: LogIn }}
                                variant="main"
                                isActive={pathname === "/login" || pendingHref === "/login"}
                                isPending={pendingHref === "/login"}
                                onClick={handleNavClick}
                                onPrefetch={prefetchRoute}
                                collapsed={collapsed}
                            />
                        </motion.div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => { clearSessionImmediate(); void signOut(); }}
                            className={cn(
                                "group relative isolate flex items-center gap-3 rounded-xl border transition-all duration-200 w-full",
                                collapsed ? "justify-center px-3 py-2.5" : "px-3 py-2.5",
                                "border-transparent text-zinc-400 hover:text-zinc-200 hover:border-white/10 hover:bg-white/[0.04]"
                            )}
                            title={collapsed ? "Sign out" : undefined}
                        >
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/8 bg-white/[0.02] group-hover:border-white/20 group-hover:bg-white/[0.06] transition-all">
                                <LogOut className="h-4 w-4 shrink-0 text-zinc-500 group-hover:text-zinc-300" />
                            </span>
                            {!collapsed && <span className="text-[13px] font-medium tracking-[0.01em]">Sign out</span>}
                        </button>
                    )}
                </nav>

                {!collapsed && (
                    <div className="mb-2 rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-3">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-[9px] font-black uppercase tracking-[0.24em] text-zinc-500">AI Engine</p>
                            <span
                                className={cn(
                                    "rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em]",
                                    aiRuntimeEnabled
                                        ? "border-emerald-500/35 bg-emerald-500/12 text-emerald-300"
                                        : "border-zinc-500/30 bg-zinc-500/10 text-zinc-400"
                                )}
                            >
                                {aiRuntimeEnabled ? "On" : "Off"}
                            </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                            <p className="text-[10px] leading-relaxed text-zinc-400">
                                Pause all AI insights to reduce load and keep the app stable.
                            </p>
                            <Switch
                                checked={aiRuntimeEnabled}
                                onCheckedChange={(v) => setAiRuntimeEnabled(v)}
                                aria-label="Toggle AI engine"
                            />
                        </div>
                    </div>
                )}

                {!collapsed && (
                    <div className="mb-2 rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-3">
                        <p className="mb-3 text-[9px] font-black uppercase tracking-[0.24em] text-zinc-500">Theme</p>
                        <ToggleTheme className="border-white/10 bg-zinc-900/50" />
                    </div>
                )}
            </div>

            <div className={cn("relative z-10 mt-auto border-t border-white/10 bg-gradient-to-t from-black/35 to-transparent", collapsed ? "p-2 space-y-2" : "p-4 space-y-3")}>
                <div className={cn("flex items-center gap-2", collapsed ? "justify-center" : "justify-between")}>
                    <button
                        onClick={() => onToggleCollapsed?.()}
                        className={cn(
                            "inline-flex items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200 transition-all",
                            collapsed ? "w-10 h-10" : "px-2.5 py-1.5 gap-1.5"
                        )}
                        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                        {!collapsed && <span className="text-[9px] font-black uppercase tracking-[0.18em]">Dock</span>}
                    </button>
                    {!collapsed && (
                        <button
                            onClick={() => onToggleAutoHide?.()}
                            className={cn(
                                "px-2.5 py-1.5 rounded-xl border transition-all text-[9px] font-black uppercase tracking-[0.18em]",
                                autoHide
                                    ? "text-emerald-300 border-emerald-400/35 bg-emerald-500/12"
                                    : "text-zinc-400 border-white/12 bg-white/[0.04] hover:bg-white/[0.08]"
                            )}
                            title="Auto-hide: collapse when not hovered"
                        >
                            Auto-hide {autoHide ? "On" : "Off"}
                        </button>
                    )}
                    <button
                        onClick={() => onToggleHidden?.()}
                        className={cn(
                            "inline-flex items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200 transition-all",
                            collapsed ? "w-10 h-10" : "px-2.5 py-1.5 gap-1.5"
                        )}
                        title="Hide sidebar"
                    >
                        {collapsed ? <EyeOff className="h-4 w-4" /> : <><EyeOff className="h-3.5 w-3.5" /><span className="text-[9px] font-black uppercase tracking-[0.18em]">Hide</span></>}
                    </button>
                </div>

                {!collapsed && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <Link
                            href="/playbook"
                            prefetch={false}
                            className={cn(
                                "relative flex flex-col group p-3 rounded-2xl border transition-all cursor-pointer overflow-hidden clone-wallet-card clone-noise",
                                "bg-zinc-950/70 hover:bg-zinc-900/75",
                                sessionVisual.card
                            )}
                        >
                            {(activeSession || isHighVolumeActivity) && (
                                <>
                                    <div className={cn("absolute -inset-1 rounded-xl blur-xl animate-ai-glow", sessionVisual.glow)} />
                                    <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                                        <div className={cn("absolute inset-0 w-[200%] opacity-30 animate-shimmer-slide", sessionVisual.shimmer)} />
                                    </div>
                                </>
                            )}
                            
                            <div className="relative mb-1 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="relative w-2 h-2">
                                        {(activeSession || isHighVolumeActivity) && (
                                            <div className={cn("absolute inset-0 rounded-full animate-ping opacity-40", sessionVisual.glow)} />
                                        )}
                                        <div className={cn(
                                            "relative w-2 h-2 rounded-full",
                                            activeSession
                                                ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]"
                                                : sessionVisualTone === "amber"
                                                    ? "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.55)]"
                                                    : sessionVisualTone === "blue"
                                                        ? "bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.55)]"
                                                        : sessionVisualTone === "rose"
                                                            ? "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.55)]"
                                                            : "bg-zinc-500"
                                        )} />
                                    </div>
                                    <span className={cn(
                                        "text-[8px] font-black uppercase tracking-[0.14em]",
                                        activeSession ? "text-emerald-400" : "text-zinc-500"
                                    )}>
                                        {activeSession ? 'Live Session' : 'Market Session'}
                                    </span>
                                </div>
                                
                                <span className={cn(
                                    "px-1.5 py-0.5 rounded text-[8px] font-mono font-bold",
                                    activeSession ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-700/50 text-zinc-400"
                                )} suppressHydrationWarning>
                                    {activeSession
                                        ? sessionTimer
                                        : mounted && currentTime
                                            ? currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
                                            : '--:--'}
                                </span>
                            </div>

                            <div className="relative flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <span className={cn("text-sm font-black uppercase tracking-wide", activeSession ? "text-white" : sessionVisual.highlight)}>
                                        {tradingHours.name.replace(' Session', '')}
                                    </span>
                                    {tradingHours.isOverlap && !activeSession && (
                                        <span className="px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400 text-[8px] font-bold">
                                            +{tradingHours.overlapWith}
                                        </span>
                                    )}
                                </div>
                                {activeSession?.bias && (
                                    <span className={cn(
                                        "flex items-center gap-1",
                                        activeSession.bias === 'long' ? "text-emerald-400" :
                                        activeSession.bias === 'short' ? "text-rose-400" :
                                        "text-zinc-400"
                                    )}>
                                        {activeSession.bias === 'long' ? <TrendingUp className="w-4 h-4" /> :
                                        activeSession.bias === 'short' ? <TrendingDown className="w-4 h-4" /> :
                                        <Minus className="w-4 h-4" />}
                                    </span>
                                )}
                            </div>
                            
                            <div className="relative flex items-center gap-2 mb-2">
                                <span className="text-[9px] text-zinc-500">
                                    {tradingHours.description}
                                </span>
                                {activeSpotPlans > 0 && (
                                    <span className="text-[9px] text-zinc-400 font-medium">
                                        • {activeSpotPlans} plan{activeSpotPlans > 1 ? 's' : ''}
                                    </span>
                                )}
                            </div>

                            <div className={cn("relative flex items-center justify-between gap-2 mb-2 px-2 py-1.5 rounded-xl border", riskStyles.row)}>
                                <div className="min-w-0 flex-1 flex items-center gap-1.5">
                                    <Calendar className={cn("w-3 h-3 shrink-0", sessionIntel.riskState === "live" && "animate-pulse")} />
                                    <span className="text-[9px] font-semibold truncate">
                                        {sessionIntel.nextEvent?.title || "No major event soon"}
                                    </span>
                                </div>
                                {sessionIntel.nextEvent && (
                                    <>
                                        <span className={cn("text-[8px] px-1.5 py-0.5 rounded uppercase font-bold", riskStyles.chip)}>
                                            {sessionIntel.nextEvent.impact.toUpperCase()}
                                        </span>
                                        <span className={cn("text-[8px] font-bold", sessionIntel.riskState === "live" && "animate-pulse")}>
                                            {formatEventCountdown(sessionIntel.nextEvent.minutesToEvent, sessionIntel.nextEvent.isLive)}
                                        </span>
                                    </>
                                )}
                            </div>

                            <div className="relative flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1 min-w-0">
                                    <Activity className={cn("w-2.5 h-2.5 shrink-0", riskStyles.recommendation, sessionIntel.riskState === "live" && "animate-pulse")} />
                                    <span className={cn("text-[8px] font-bold uppercase tracking-wide truncate", riskStyles.recommendation)}>
                                        {sessionIntel.recommendation}
                                    </span>
                                </div>
                                {mounted && unacknowledgedAlertCount > 0 && (
                                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-500/20 shrink-0 border border-rose-500/30">
                                        <Bell className={cn("w-2.5 h-2.5 text-rose-400", sessionIntel.riskState === "live" ? "animate-pulse" : "")} />
                                        <span className="text-[8px] font-bold text-rose-400">
                                            {unacknowledgedAlertCount}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {sessionAdvisoryEnabled && (
                                <div className="relative mt-2 rounded-xl border border-white/10 bg-black/30 px-2 py-1.5">
                                <div className="mb-1 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1 min-w-0">
                                        <Sparkles className="w-2.5 h-2.5 text-cyan-300 shrink-0" />
                                        <span className="text-[8px] font-black uppercase tracking-[0.14em] text-cyan-300 truncate">
                                            AI Session Advisory
                                        </span>
                                    </div>
                                    {sessionAdvisory?.signalMeta?.verdict &&
                                        sessionAdvisory.signalMeta.verdict !== "block" && (
                                        <span
                                            className={cn(
                                                "text-[8px] px-1.5 py-0.5 rounded border uppercase font-bold shrink-0",
                                                sessionAdvisory.signalMeta.verdict === "allow" &&
                                                    "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
                                                sessionAdvisory.signalMeta.verdict === "warn" &&
                                                    "border-amber-500/30 bg-amber-500/10 text-amber-300"
                                            )}
                                        >
                                            {sessionAdvisory.signalMeta.verdict}
                                        </span>
                                    )}
                                </div>
                                <p className="text-[8px] leading-relaxed text-zinc-300 line-clamp-2">
                                    {sessionAdvisoryText}
                                </p>
                                </div>
                            )}
                        </Link>
                    </motion.div>
                )}

                {!collapsed && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
                        className="relative flex items-center group pt-2 pb-2 pl-2 pr-2"
                    >
                        <div className="absolute -left-1 z-10 w-12 h-12 rounded-full border border-white/10 bg-[#0E0E11] flex items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.8)] ring-4 ring-sidebar">
                            <span className="text-white font-black text-lg tracking-tighter italic">N</span>
                            <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-sidebar ${systemStatus === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                                systemStatus === 'partial' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' :
                                    'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
                                }`} />
                        </div>

                        <div className="flex-1 pl-12 pr-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-2xl transition-all hover:bg-white/[0.06] clone-wallet-card clone-noise">
                            <p className="mb-1 text-[9px] font-black uppercase tracking-[0.22em] text-amber-300/90 leading-none">
                                System Status
                            </p>
                            <p className="text-sm font-black text-zinc-100 leading-none tracking-tight">
                                {connectedCount}/{totalConnections || 1} Connected
                            </p>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
});

export default Sidebar;
