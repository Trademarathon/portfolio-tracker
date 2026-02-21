"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiFetch } from '@/lib/api/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar,
    Clock,
    ChevronDown,
    Bell,
    Flame,
    RefreshCw,
    DollarSign,
    BarChart3,
    Briefcase,
    Landmark,
    Coins,
    Globe,
    TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildAIHeaders } from "@/lib/api/ai";

type ImpactLevel = 'low' | 'medium' | 'high' | 'critical';
type EventCategory = 'fed' | 'inflation' | 'employment' | 'gdp' | 'crypto' | 'macro' | 'earnings' | 'geopolitical' | 'other';

interface EconomicEvent {
    id: string;
    title: string;
    description: string;
    timestamp: number;
    category: EventCategory;
    impact: ImpactLevel;
    country?: string;
    actual?: string;
    forecast?: string;
    previous?: string;
    isLive?: boolean;
    source?: string;
}

type CalendarFeedState = 'loading' | 'live' | 'cached' | 'unavailable';

interface CalendarApiEvent {
    id?: string;
    title?: string;
    description?: string;
    timestamp?: number | string;
    category?: string;
    impact?: string;
    country?: string;
    actual?: string;
    forecast?: string;
    previous?: string;
    isLive?: boolean;
}

const CALENDAR_CACHE_KEY = 'tm:calendar:ai-events:v1';
const CALENDAR_CACHE_MAX_AGE_MS = 1000 * 60 * 2;
const MAX_PAST_AGE_MS = 1000 * 60 * 60 * 2;
const MAX_FUTURE_AGE_MS = 1000 * 60 * 60 * 24 * 8;

function normalizeCategory(value?: string): EventCategory {
    const lower = (value || '').toLowerCase();
    if (lower.includes('macro')) return 'macro';
    if (lower.includes('fed') || lower.includes('rate') || lower.includes('interest')) return 'fed';
    if (lower.includes('inflation') || lower.includes('cpi') || lower.includes('pce')) return 'inflation';
    if (lower.includes('employ') || lower.includes('payroll') || lower.includes('jobless')) return 'employment';
    if (lower.includes('gdp')) return 'gdp';
    if (lower.includes('crypto') || lower.includes('bitcoin') || lower.includes('ethereum')) return 'crypto';
    if (lower.includes('earnings')) return 'earnings';
    if (lower.includes('geo') || lower.includes('war')) return 'geopolitical';
    return 'other';
}

function normalizeImpact(value?: string): ImpactLevel {
    const normalized = (value || '').toLowerCase().trim();
    if (normalized === 'critical' || normalized === 'high' || normalized === 'medium' || normalized === 'low') {
        return normalized;
    }
    return 'medium';
}

function readCalendarCache(): { events: EconomicEvent[]; lastUpdated: number } | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(CALENDAR_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { events?: EconomicEvent[]; lastUpdated?: number };
        const events = Array.isArray(parsed.events) ? parsed.events : [];
        const lastUpdated = typeof parsed.lastUpdated === 'number' ? parsed.lastUpdated : 0;
        if (!events.length || !lastUpdated) return null;
        if (Date.now() - lastUpdated > CALENDAR_CACHE_MAX_AGE_MS) return null;
        return { events, lastUpdated };
    } catch {
        return null;
    }
}

function writeCalendarCache(events: EconomicEvent[], lastUpdated: number): void {
    if (typeof window === 'undefined' || !events.length) return;
    try {
        localStorage.setItem(CALENDAR_CACHE_KEY, JSON.stringify({ events, lastUpdated }));
    } catch {
        // Ignore localStorage quota/availability issues.
    }
}

function parseTimestamp(input?: number | string): number | null {
    if (typeof input === 'number' && Number.isFinite(input)) return input;
    if (typeof input === 'string' && input.trim()) {
        const parsed = Date.parse(input);
        if (Number.isFinite(parsed)) return parsed;
    }
    return null;
}

const categoryIcons: Record<EventCategory, React.ReactNode> = {
    fed: <Landmark className="h-3.5 w-3.5" />,
    inflation: <TrendingUp className="h-3.5 w-3.5" />,
    employment: <Briefcase className="h-3.5 w-3.5" />,
    gdp: <BarChart3 className="h-3.5 w-3.5" />,
    crypto: <Coins className="h-3.5 w-3.5" />,
    macro: <Globe className="h-3.5 w-3.5" />,
    earnings: <DollarSign className="h-3.5 w-3.5" />,
    geopolitical: <Globe className="h-3.5 w-3.5" />,
    other: <Calendar className="h-3.5 w-3.5" />,
};

const categoryColors: Record<EventCategory, { bg: string; text: string }> = {
    fed: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
    inflation: { bg: 'bg-rose-500/10', text: 'text-rose-400' },
    employment: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
    gdp: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
    crypto: { bg: 'bg-purple-500/10', text: 'text-purple-400' },
    macro: { bg: 'bg-indigo-500/10', text: 'text-indigo-400' },
    earnings: { bg: 'bg-cyan-500/10', text: 'text-cyan-400' },
    geopolitical: { bg: 'bg-orange-500/10', text: 'text-orange-400' },
    other: { bg: 'bg-zinc-500/10', text: 'text-zinc-400' },
};

const impactColors: Record<ImpactLevel, { bg: string; text: string; label: string }> = {
    low: { bg: 'bg-zinc-500/20', text: 'text-zinc-400', label: 'Low' },
    medium: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Medium' },
    high: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'High' },
    critical: { bg: 'bg-rose-500/20', text: 'text-rose-400', label: 'Critical' },
};

function formatTimeUntil(timestamp: number): string {
    const now = Date.now();
    const diff = timestamp - now;
    if (diff < 0) {
        const absDiff = Math.abs(diff);
        if (absDiff < 3600000) return `${Math.floor(absDiff / 60000)}m ago`;
        if (absDiff < 86400000) return `${Math.floor(absDiff / 3600000)}h ago`;
        return `${Math.floor(absDiff / 86400000)}d ago`;
    }
    if (diff < 3600000) return `in ${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `in ${Math.floor(diff / 3600000)}h`;
    return `in ${Math.floor(diff / 86400000)}d`;
}

function formatEventDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === now.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatEventTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function EventCard({ event, compact = false }: { event: EconomicEvent; compact?: boolean }) {
    const [expanded, setExpanded] = useState(false);
    const categoryColor = categoryColors[event.category];
    const impactColor = impactColors[event.impact];
    const isPast = event.timestamp < Date.now();
    const isHighlight = event.impact === 'high' || event.impact === 'critical';

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                "relative rounded-xl border transition-all overflow-hidden",
                event.isLive && "bg-gradient-to-r from-amber-500/10 to-rose-500/10 border-amber-500/30",
                !event.isLive && isPast && "bg-zinc-900/20 border-zinc-800/40 opacity-50",
                !event.isLive && !isPast && isHighlight && "animate-economic-event-glow bg-amber-500/5 border-amber-500/30 hover:border-amber-500/40",
                !event.isLive && !isPast && !isHighlight && "bg-zinc-900/30 border-zinc-800/50 opacity-60 hover:opacity-75"
            )}
        >
            <div className={cn("p-3 cursor-pointer", compact && "p-2.5")} onClick={() => setExpanded(!expanded)}>
                <div className="flex items-start gap-3">
                    <div className={cn(
                        "p-2 rounded-lg shrink-0",
                        isHighlight && categoryColor.bg,
                        isHighlight && categoryColor.text,
                        !isHighlight && "bg-zinc-800/50 text-zinc-500"
                    )}>
                        {categoryIcons[event.category]}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                            <h4 className={cn(
                                "font-bold truncate text-sm",
                                isHighlight && "text-white",
                                !isHighlight && (isPast ? "text-zinc-600" : "text-zinc-500")
                            )}>
                                {event.title}
                            </h4>
                            <ChevronDown className={cn("h-4 w-4", isHighlight ? "text-zinc-500" : "text-zinc-600", expanded && "rotate-180")} />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn("text-[10px] flex items-center gap-1", isHighlight ? "text-zinc-500" : "text-zinc-600")}>
                                <Clock className="h-3 w-3" />
                                {formatTimeUntil(event.timestamp)}
                            </span>
                            {event.source && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-white/5 text-zinc-400">
                                    {event.source === "gemini" ? "AI Calendar" : event.source}
                                </span>
                            )}
                            {event.country && (
                                <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-bold", isHighlight ? "bg-white/5 text-zinc-500" : "bg-zinc-800/50 text-zinc-600")}>
                                    {event.country}
                                </span>
                            )}
                            <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-bold", impactColor.bg, impactColor.text)}>
                                {impactColor.label}
                            </span>
                        </div>
                        {(event.actual || event.forecast) && (
                            <div className="flex items-center gap-3 mt-2">
                                {event.actual && (
                                    <div className="flex items-center gap-1">
                                        <span className="text-[9px] text-zinc-600 uppercase">Actual:</span>
                                        <span className={cn("text-[10px] font-bold", isHighlight ? "text-emerald-400" : "text-zinc-500")}>{event.actual}</span>
                                    </div>
                                )}
                                {event.forecast && (
                                    <div className="flex items-center gap-1">
                                        <span className="text-[9px] text-zinc-600 uppercase">Forecast:</span>
                                        <span className={cn("text-[10px] font-bold", isHighlight ? "text-zinc-400" : "text-zinc-600")}>{event.forecast}</span>
                                    </div>
                                )}
                                {event.previous && (
                                    <div className="flex items-center gap-1">
                                        <span className="text-[9px] text-zinc-600 uppercase">Prev:</span>
                                        <span className={cn("text-[10px] font-bold", isHighlight ? "text-zinc-500" : "text-zinc-600")}>{event.previous}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="px-3 pb-3 pt-0 border-t border-white/5">
                            <p className="text-[11px] text-zinc-500 leading-relaxed mt-2">
                                {event.description}
                            </p>
                            <div className="flex items-center justify-between mt-3">
                                <span className="text-[9px] text-zinc-600">
                                    {formatEventDate(event.timestamp)} at {formatEventTime(event.timestamp)}
                                </span>
                                <button className="flex items-center gap-1 text-[9px] text-indigo-400 hover:text-indigo-300 font-bold">
                                    <Bell className="h-3 w-3" />
                                    Set Alert
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

function mapApiEvent(raw: CalendarApiEvent): EconomicEvent | null {
    const timestamp = parseTimestamp(raw.timestamp);
    if (timestamp == null) return null;

    const now = Date.now();
    const minTimestamp = now - MAX_PAST_AGE_MS;
    const maxTimestamp = now + MAX_FUTURE_AGE_MS;
    if (timestamp < minTimestamp || timestamp > maxTimestamp) return null;

    const title = (raw.title || '').trim();
    if (!title) return null;

    const oneHourAgo = now - 60 * 60 * 1000;
    const country = raw.country?.trim();
    const actual = raw.actual?.trim();
    const forecast = raw.forecast?.trim();
    const previous = raw.previous?.trim();
    const isLive = typeof raw.isLive === 'boolean'
        ? raw.isLive
        : timestamp <= now && timestamp > oneHourAgo && Boolean(actual);

    return {
        id: (raw.id || `${title}-${timestamp}`).trim(),
        title,
        description: (raw.description || title).trim(),
        timestamp,
        category: normalizeCategory(raw.category),
        impact: normalizeImpact(raw.impact),
        country: country ? country.toUpperCase().slice(0, 3) : undefined,
        actual: actual || undefined,
        forecast: forecast || undefined,
        previous: previous || undefined,
        isLive,
        source: (raw as any).source ? String((raw as any).source) : undefined,
    };
}

function normalizeApiEvents(rawEvents: CalendarApiEvent[]): EconomicEvent[] {
    const dedupe = new Set<string>();
    const parsed = rawEvents
        .map(mapApiEvent)
        .filter((event): event is EconomicEvent => event !== null)
        .filter((event) => {
            const key = `${event.id}:${event.timestamp}`;
            if (dedupe.has(key)) return false;
            dedupe.add(key);
            return true;
        })
        .sort((a, b) => a.timestamp - b.timestamp);
    return parsed;
}

interface EconomicCalendarProps {
    className?: string;
    compact?: boolean;
    maxEvents?: number;
}

export function EconomicCalendar({ className, compact = false, maxEvents = 6 }: EconomicCalendarProps) {
    const [events, setEvents] = useState<EconomicEvent[]>([]);
    const [filter, setFilter] = useState<'all' | 'high' | 'crypto'>('all');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showAll, setShowAll] = useState(false);
    const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
    const [feedState, setFeedState] = useState<CalendarFeedState>('loading');

    const fetchEvents = useCallback(async () => {
        const nowMs = Date.now();
        try {
            const res = await apiFetch(
                '/api/ai/calendar',
                {
                    method: 'POST',
                    cache: 'no-store',
                    headers: buildAIHeaders(),
                    body: JSON.stringify({ horizonHours: 48, maxItems: 12 }),
                },
                12_000
            );
            const json = await res.json().catch(() => ({}));

            const rawEvents: CalendarApiEvent[] = Array.isArray((json as any).events)
                ? (json as any).events
                : Array.isArray(json)
                    ? json
                    : [];
            const normalized = normalizeApiEvents(rawEvents);
            const apiLastUpdated = typeof (json as any).lastUpdated === 'number'
                ? (json as any).lastUpdated
                : nowMs;
            const apiStale = Boolean((json as any).stale);

            if (res.ok && normalized.length > 0) {
                setEvents(normalized);
                setLastFetchedAt(apiLastUpdated);
                setFeedState(apiStale ? 'cached' : 'live');
                writeCalendarCache(normalized, apiLastUpdated);
                return;
            }

            const cached = readCalendarCache();
            if (cached && cached.events.length > 0) {
                setEvents(cached.events);
                setLastFetchedAt(cached.lastUpdated);
                setFeedState('cached');
                return;
            }

            setEvents([]);
            setLastFetchedAt(apiLastUpdated || null);
            setFeedState('unavailable');
        } catch {
            const cached = readCalendarCache();
            if (cached && cached.events.length > 0) {
                setEvents(cached.events);
                setLastFetchedAt(cached.lastUpdated);
                setFeedState('cached');
            } else {
                setEvents([]);
                setLastFetchedAt(null);
                setFeedState('unavailable');
            }
        }
    }, []);

    useEffect(() => {
        const cached = readCalendarCache();
        if (cached && cached.events.length > 0) {
            setEvents(cached.events);
            setLastFetchedAt(cached.lastUpdated);
            setFeedState('cached');
        }

        fetchEvents();
        const t = setInterval(fetchEvents, 90 * 1000);
        return () => clearInterval(t);
    }, [fetchEvents]);

    const { displayedEvents, totalFiltered } = useMemo(() => {
        let filtered = events;
        if (filter === 'high') filtered = filtered.filter((e) => e.impact === 'high' || e.impact === 'critical');
        else if (filter === 'crypto') filtered = filtered.filter((e) => e.category === 'crypto');
        return {
            displayedEvents: showAll ? filtered : filtered.slice(0, maxEvents),
            totalFiltered: filtered.length,
        };
    }, [events, filter, showAll, maxEvents]);

    const upcomingHighImpact = events.filter(
        (e) => (e.impact === 'high' || e.impact === 'critical') && e.timestamp > Date.now()
    ).length;

    const statusMeta = useMemo(() => {
        if (feedState === 'live') return { label: 'Verified', className: 'text-emerald-400' };
        if (feedState === 'cached') return { label: 'Cached', className: 'text-amber-400' };
        if (feedState === 'unavailable') return { label: 'Unavailable', className: 'text-rose-400' };
        return { label: 'Loading...', className: 'text-zinc-500' };
    }, [feedState]);

    return (
        <div className={cn(
            "w-full rounded-xl bg-gradient-to-br from-zinc-950/90 to-zinc-900/90 border-white/10 overflow-hidden flex flex-col",
            compact ? "min-h-[290px]" : "min-h-[360px]",
            className
        )}>
            <div className={cn(
                "border-b border-white/5 bg-white/[0.02]",
                compact ? "p-3" : "p-4"
            )}>
                <div className={cn(
                    "flex items-center justify-between",
                    compact ? "mb-2.5" : "mb-3"
                )}>
                    <div className="flex items-center gap-2">
                        <div className={cn(
                            "rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20",
                            compact ? "p-1.5" : "p-2"
                        )}>
                            <Calendar className="h-4 w-4 text-amber-400" />
                        </div>
                        <div>
                            <h3 className={cn(
                                "font-black text-white",
                                compact ? "text-xs" : "text-sm"
                            )}>
                                Economic Calendar
                            </h3>
                            {!compact && <p className="text-[10px] text-zinc-500">Market-moving events</p>}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {upcomingHighImpact > 0 && (
                            <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-[9px] font-bold">
                                <Flame className="h-3 w-3" />
                                {upcomingHighImpact} High Impact
                            </span>
                        )}
                        <button
                            onClick={() => {
                                setIsRefreshing(true);
                                fetchEvents().then(() => setIsRefreshing(false));
                            }}
                            className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-white transition-colors"
                        >
                            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {[
                        { id: 'all' as const, label: 'All Events' },
                        { id: 'high' as const, label: 'High Impact' },
                        { id: 'crypto' as const, label: 'Crypto' },
                    ].map((f) => (
                        <button
                            key={f.id}
                            onClick={() => setFilter(f.id)}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                                filter === f.id ? "bg-white text-black" : "bg-white/5 text-zinc-500 hover:text-white"
                            )}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className={cn(
                "flex-1 min-h-0 overflow-y-auto space-y-2",
                compact ? "p-3" : "p-4"
            )}>
                {displayedEvents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-8 flex-1">
                        <Calendar className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
                        <p className="text-xs text-zinc-600 mb-1">
                            {feedState === 'unavailable' ? 'No verified calendar feed available' : 'No events in this range'}
                        </p>
                        {lastFetchedAt && (
                            <p className="text-[10px] text-zinc-600 mb-3">
                                Last synced {formatTimeUntil(lastFetchedAt)}
                            </p>
                        )}
                        <button
                            onClick={() => {
                                setIsRefreshing(true);
                                fetchEvents().then(() => setIsRefreshing(false));
                            }}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-bold hover:bg-emerald-500/30 transition-colors"
                        >
                            Retry AI feed
                        </button>
                    </div>
                ) : (
                    <>
                        {displayedEvents.map((event) => (
                            <EventCard key={event.id} event={event} compact={compact} />
                        ))}
                        {!showAll && totalFiltered > maxEvents && (
                            <button
                                onClick={() => setShowAll(true)}
                                className="w-full py-2 text-center text-[11px] font-bold text-zinc-500 hover:text-white bg-white/[0.02] rounded-xl hover:bg-white/5 transition-colors"
                            >
                                Show {totalFiltered - maxEvents} more events
                            </button>
                        )}
                    </>
                )}
            </div>

            <div className={cn(
                "border-t border-white/5 bg-black/20 flex items-center justify-between",
                compact ? "px-3 py-2.5" : "px-4 py-3"
            )}>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-rose-500" />
                        <span className="text-[9px] text-zinc-600">Critical</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="text-[9px] text-zinc-600">High</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-[9px] text-zinc-600">Medium</span>
                    </div>
                </div>
                <span className={cn("text-[9px] font-bold", statusMeta.className)}>
                    {statusMeta.label}
                </span>
            </div>
        </div>
    );
}

// Default export to keep Next/Turbopack dynamic imports stable.
export default EconomicCalendar;
