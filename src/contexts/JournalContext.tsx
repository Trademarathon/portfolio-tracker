"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Transaction } from '@/lib/api/types';
import { TradeAnnotation, StrategyTagId } from '@/lib/api/journal-types';
import { Playbook, SpotPlan, PerpPlan, getPlaybooks, getSpotPlans, getPerpPlans } from '@/lib/api/session';
import {
    PlaybookLevelAlert,
    loadPlaybookAlerts,
    syncSpotPlansWithAlerts,
    syncPerpPlansWithAlerts,
    markPlaybookAlertTriggered,
    getPlanProgress,
    getPlanCompletionNotified,
    setPlanCompletionNotified,
} from '@/lib/api/alerts';
import { apiUrl } from '@/lib/api/client';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getValueWithCloud, setValueWithCloud, getValue } from '@/lib/supabase/sync';
import { useSupabaseRealtimeSyncUpdate } from '@/hooks/useSupabaseRealtime';
import { PLAYBOOKS_KEY, SPOT_PLANS_KEY, PERP_PLANS_KEY, SESSION_STORAGE_KEY } from '@/lib/api/session';
import { evaluatePlanRules } from '@/lib/playbook/rule-engine';
import { enrichJournalTrades, normalizeJournalTrade, areJournalTradesEquivalent } from '@/lib/journal/trade-enrichment';
import { getHyperliquidSpotMeta, resolveHyperliquidSymbol } from '@/lib/api/hyperliquid';
import { getRealizedRMultiple, getTradeEntryPrice, getTradeExitPrice, getTradePositionSize } from '@/lib/journal/report-metrics';

// Types
export interface DateRange {
    start: Date | null;
    end: Date | null;
    preset: string;
    mode: 'before' | 'range' | 'after';
    groupBy: 'open' | 'close';
}

export interface JournalFilters {
    status: 'all' | 'open' | 'closed';
    side: 'all' | 'long' | 'short';
    symbols: string[];
    tags: StrategyTagId[];
    exchange: string;
    minPnl: number | null;
    maxPnl: number | null;
    minHoldTime: number | null;
    maxHoldTime: number | null;
    reviewStatus?: 'all' | 'reviewed' | 'unreviewed';
    playbookIds?: string[];
    connectionIds?: string[];
    minEntryPrice?: number | null;
    maxEntryPrice?: number | null;
    minExitPrice?: number | null;
    maxExitPrice?: number | null;
    minRMultiple?: number | null;
    maxRMultiple?: number | null;
    minPositionSize?: number | null;
    maxPositionSize?: number | null;
    minVolume?: number | null;
    maxVolume?: number | null;
    includeSymbols?: string[];
    excludeSymbols?: string[];
    includeTags?: StrategyTagId[];
    excludeTags?: StrategyTagId[];
}

export interface JournalPreferences {
    timeFormat: '12h' | '24h';
    timezone: string;
    breakevenEnabled: boolean;
    breakevenRange: number;
    permanentFiltersEnabled: boolean;
    hideBalances: boolean;
}

export interface JournalTrade extends Transaction {
    entryPrice?: number;
    exitPrice?: number;
    entryTime?: number;
    exitTime?: number;
    holdTime?: number;
    mae?: number;
    mfe?: number;
    realizedPnl?: number;
    fees?: number;
    funding?: number;
    isOpen?: boolean;
    rawSymbol?: string;
    info?: Record<string, unknown>;
    cost?: number;
}

export interface ExchangeSyncDiagnostic {
    status: 'ok' | 'empty' | 'error';
    source: 'journal-sync' | 'cex-trades';
    message?: string;
    trades: number;
    lastSyncAt: number;
}

interface JournalContextType {
    // Data
    trades: JournalTrade[];
    annotations: Record<string, TradeAnnotation>;
    isLoading: boolean;
    isSyncing: boolean;
    lastSyncTime: number | null;

    // Playbooks & Plans
    playbooks: Playbook[];
    spotPlans: SpotPlan[];
    perpPlans: PerpPlan[];
    playbookAlerts: PlaybookLevelAlert[];
    triggeredAlerts: PlaybookLevelAlert[];

    // Real-time status
    realtimeEnabled: boolean;
    setRealtimeEnabled: (enabled: boolean) => void;
    connectedExchanges: string[];
    syncDiagnostics: Record<string, ExchangeSyncDiagnostic>;

    // Date Range
    dateRange: DateRange;
    setDateRange: (range: DateRange) => void;

    // Filters
    filters: JournalFilters;
    setFilters: (filters: JournalFilters) => void;
    permanentFilters: JournalFilters;
    setPermanentFilters: (filters: JournalFilters) => void;

    // Preferences
    preferences: JournalPreferences;
    setPreferences: (prefs: Partial<JournalPreferences>) => void;

    // Filtered trades
    filteredTrades: JournalTrade[];

    // Actions
    syncTrades: () => Promise<void>;
    syncPlaybooks: () => void;
    syncAlerts: () => void;
    checkPriceAlerts: (prices: Record<string, number>) => void;
    addAnnotation: (annotation: TradeAnnotation) => void;
    updateAnnotation: (id: string, annotation: Partial<TradeAnnotation>) => void;
    deleteAnnotation: (id: string) => void;

    // Computed stats
    stats: JournalStats;
}

export interface JournalStats {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    breakevenTrades: number;
    winRate: number;
    totalPnl: number;
    avgPnl: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    largestWin: number;
    largestLoss: number;
    avgHoldTime: number;
    totalVolume: number;
    longCount: number;
    shortCount: number;
}

const JOURNAL_TRADES_KEY = 'journal_trades';
const JOURNAL_ANNOTATIONS_KEY = 'journal_annotations';
const JOURNAL_PREFERENCES_KEY = 'journal_preferences';
const JOURNAL_PERMANENT_FILTERS_KEY = 'journal_permanent_filters';

const defaultFilters: JournalFilters = {
    status: 'all',
    side: 'all',
    symbols: [],
    tags: [],
    exchange: '',
    minPnl: null,
    maxPnl: null,
    minHoldTime: null,
    maxHoldTime: null,
    reviewStatus: 'all',
    playbookIds: [],
    connectionIds: [],
    minEntryPrice: null,
    maxEntryPrice: null,
    minExitPrice: null,
    maxExitPrice: null,
    minRMultiple: null,
    maxRMultiple: null,
    minPositionSize: null,
    maxPositionSize: null,
    minVolume: null,
    maxVolume: null,
    includeSymbols: [],
    excludeSymbols: [],
    includeTags: [],
    excludeTags: [],
};

const defaultPreferences: JournalPreferences = {
    timeFormat: '24h',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    breakevenEnabled: true,
    breakevenRange: 2.5,
    permanentFiltersEnabled: false,
    hideBalances: false,
};

const JournalContext = createContext<JournalContextType | null>(null);

// Sync interval constants
const TRADE_SYNC_INTERVAL = 15000; // 15 seconds for real-time trade updates
const API_RETRY_COOLDOWN_MS = 30000;
const JOURNAL_SYNC_TYPES = new Set(['binance', 'bybit', 'hyperliquid']);
const NON_EXCHANGE_CONNECTION_TYPES = new Set(['wallet', 'evm', 'solana', 'zerion', 'aptos', 'ton', 'manual']);
const REALTIME_SYNC_OPTIONS = {
    mode: 'realtime' as const,
    bybitDaysBack: 7,
    bybitSymbolsLimit: 20,
    bybitPageLimitPerWindow: 3,
};
const MANUAL_SYNC_OPTIONS = {
    mode: 'manual' as const,
    bybitDaysBack: 30,
    bybitSymbolsLimit: 60,
    bybitPageLimitPerWindow: 10,
};

type RuntimeConnection = {
    type?: string;
    apiKey?: string;
    secret?: string;
    walletAddress?: string;
    enabled?: boolean;
};

function normalizeExchange(value: unknown): string {
    return String(value || '').toLowerCase().trim();
}

function extractMessageFromPayload(payload: unknown): string | undefined {
    if (!payload || typeof payload !== 'object') return undefined;
    const obj = payload as Record<string, any>;
    const candidates: unknown[] = [
        obj.error,
        obj.message,
        obj.details,
        obj.hint,
        obj?.diagnostics?.message,
        Array.isArray(obj?.diagnostics?.errors) && obj.diagnostics.errors.length > 0
            ? String(obj.diagnostics.errors[0])
            : undefined,
    ];
    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    }
    return undefined;
}

function sanitizeDiagnosticMessage(raw: unknown): string | undefined {
    if (raw === null || raw === undefined) return undefined;
    let text = String(raw).trim();
    if (!text) return undefined;

    if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
        try {
            const parsed = JSON.parse(text);
            const extracted = extractMessageFromPayload(parsed);
            if (extracted) text = extracted;
        } catch {
            // Keep original text if JSON parse fails.
        }
    }

    text = text.replace(/\s+/g, ' ').trim();
    if (!text) return undefined;

    if (/<!doctype html|<html|<head|<body|<script/i.test(text)) {
        return 'Service unavailable (received HTML response).';
    }

    const maxLen = 220;
    if (text.length > maxLen) return `${text.slice(0, maxLen - 3)}...`;
    return text;
}

function extractDiagnosticMessage(rawDiag: unknown): string | undefined {
    if (!rawDiag || typeof rawDiag !== 'object') return undefined;
    const diag = rawDiag as Record<string, unknown>;
    const rawMessage =
        typeof diag.message === 'string'
            ? diag.message
            : Array.isArray(diag.errors) && diag.errors.length > 0
                ? String(diag.errors[0])
                : undefined;
    return sanitizeDiagnosticMessage(rawMessage);
}

async function readResponseErrorMessage(res: Response): Promise<string> {
    const fallback = `HTTP ${res.status}`;
    const contentType = res.headers.get('content-type') || '';
    try {
        if (contentType.includes('application/json')) {
            const payload = await res.json();
            return sanitizeDiagnosticMessage(extractMessageFromPayload(payload) || fallback) || fallback;
        }
        const text = await res.text();
        return sanitizeDiagnosticMessage(text) || fallback;
    } catch {
        return fallback;
    }
}

function isHyperliquidIndexSymbol(value: unknown): boolean {
    const s = String(value || '').trim();
    return /^@?\d+$/.test(s);
}

function normalizeAndEnrichTrades(rawTrades: unknown[]): JournalTrade[] {
    return enrichJournalTrades(rawTrades) as JournalTrade[];
}

function mergeJournalTrades(existing: JournalTrade[], incoming: JournalTrade[]): JournalTrade[] {
    if (incoming.length === 0) return existing;
    const tradeMap = new Map(existing.map((t) => [t.id, t]));
    incoming.forEach((trade) => tradeMap.set(trade.id, trade));
    const enriched = normalizeAndEnrichTrades(Array.from(tradeMap.values()));
    return areJournalTradesEquivalent(existing as any, enriched as any) ? existing : enriched;
}

function getJournalConnectionConfig(connections: RuntimeConnection[]) {
    const enabled = (Array.isArray(connections) ? connections : []).filter((c) => c?.enabled !== false);
    const keys: Record<string, string> = {};
    const connectedSet = new Set<string>();
    const fallbackCexConnections: RuntimeConnection[] = [];

    enabled.forEach((conn) => {
        const type = normalizeExchange(conn.type);
        if (!type) return;

        if (JOURNAL_SYNC_TYPES.has(type)) {
            if (type === 'binance' && conn.apiKey && conn.secret) {
                keys.binanceApiKey = conn.apiKey;
                keys.binanceSecret = conn.secret;
                connectedSet.add('binance');
            } else if (type === 'bybit' && conn.apiKey && conn.secret) {
                keys.bybitApiKey = conn.apiKey;
                keys.bybitSecret = conn.secret;
                connectedSet.add('bybit');
            } else if (type === 'hyperliquid' && conn.walletAddress) {
                keys.hyperliquidWallet = conn.walletAddress;
                connectedSet.add('hyperliquid');
            }
        }

        if (!NON_EXCHANGE_CONNECTION_TYPES.has(type) && type !== 'hyperliquid' && conn.apiKey && conn.secret) {
            fallbackCexConnections.push(conn);
            connectedSet.add(type);
        }
    });

    return {
        keys,
        fallbackCexConnections,
        configuredExchanges: Array.from(connectedSet),
    };
}

function readRuntimeConnectionsFromStorage(): RuntimeConnection[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem('portfolio_connections');
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

async function fetchFallbackTrades(
    connections: RuntimeConnection[],
    skipExchanges: Set<string> = new Set<string>()
): Promise<{ trades: JournalTrade[]; exchanges: string[]; diagnostics: Record<string, ExchangeSyncDiagnostic> }> {
    if (!Array.isArray(connections) || connections.length === 0) return { trades: [], exchanges: [], diagnostics: {} };

    const exchangesWithData = new Set<string>();
    const diagnostics: Record<string, ExchangeSyncDiagnostic> = {};
    const results = await Promise.allSettled(
        connections.map(async (conn) => {
            const exchange = normalizeExchange(conn.type);
            if (!exchange || !conn.apiKey || !conn.secret) return [];
            if (skipExchanges.has(exchange)) return [];
            try {
                const res = await fetch(apiUrl('/api/cex/trades'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        exchange,
                        exchangeId: exchange,
                        apiKey: conn.apiKey,
                        secret: conn.secret,
                    }),
                });
                if (!res.ok) {
                    const rawError = await readResponseErrorMessage(res);
                    diagnostics[exchange] = {
                        status: 'error',
                        source: 'cex-trades',
                        message: sanitizeDiagnosticMessage(rawError) || `HTTP ${res.status}`,
                        trades: 0,
                        lastSyncAt: Date.now(),
                    };
                    return [];
                }

                const json = await res.json().catch(() => ({}));
                const list = Array.isArray(json?.trades) ? json.trades : [];
                if (list.length > 0) exchangesWithData.add(exchange);
                diagnostics[exchange] = {
                    status: list.length > 0 ? 'ok' : 'empty',
                    source: 'cex-trades',
                    message: sanitizeDiagnosticMessage(
                        Array.isArray(json?.diagnostics?.errors) && json.diagnostics.errors.length > 0
                            ? String(json.diagnostics.errors[0])
                            : undefined
                    ),
                    trades: list.length,
                    lastSyncAt: Date.now(),
                };

                return list.map((t: any) => toJournalTrade({ ...t, exchange: t.exchange || exchange }));
            } catch (e) {
                diagnostics[exchange] = {
                    status: 'error',
                    source: 'cex-trades',
                    message: sanitizeDiagnosticMessage(e instanceof Error ? e.message : String(e)),
                    trades: 0,
                    lastSyncAt: Date.now(),
                };
                return [];
            }
        })
    );

    const trades = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
    return { trades, exchanges: Array.from(exchangesWithData), diagnostics };
}

function toJournalTrade(t: any): JournalTrade {
    return normalizeJournalTrade(t) as JournalTrade;
}

export function JournalProvider({ children }: { children: React.ReactNode }) {
    const { user, cloudSyncEnabled } = useSupabaseAuth();
    const [trades, setTrades] = useState<JournalTrade[]>([]);
    const [annotations, setAnnotations] = useState<Record<string, TradeAnnotation>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

    // Playbooks & Plans
    const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
    const [spotPlans, setSpotPlans] = useState<SpotPlan[]>([]);
    const [perpPlans, setPerpPlans] = useState<PerpPlan[]>([]);
    const [playbookAlerts, setPlaybookAlerts] = useState<PlaybookLevelAlert[]>([]);
    const [triggeredAlerts, setTriggeredAlerts] = useState<PlaybookLevelAlert[]>([]);

    // Real-time status
    const [realtimeEnabled, setRealtimeEnabled] = useState(true);
    const [connectedExchanges, setConnectedExchanges] = useState<string[]>([]);
    const [syncDiagnostics, setSyncDiagnostics] = useState<Record<string, ExchangeSyncDiagnostic>>({});

    const [dateRange, setDateRange] = useState<DateRange>({
        start: null,
        end: null,
        preset: 'all',
        mode: 'range',
        groupBy: 'open',
    });
    const [filters, setFilters] = useState<JournalFilters>(defaultFilters);
    const [permanentFilters, setPermanentFilters] = useState<JournalFilters>(defaultFilters);
    const [preferences, setPreferencesState] = useState<JournalPreferences>(defaultPreferences);

    // Refs for intervals
    const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastPricesRef = useRef<Record<string, number>>({});
    const blockedRuleEventAtRef = useRef<Record<string, number>>({});
    const apiUnavailableUntilRef = useRef(0);
    const apiUnavailableNotifiedRef = useRef(false);

    // Cache-first journal bootstrap: render local snapshot immediately, then hydrate from cloud.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        let cancelled = false;

        const applyLocalSnapshot = () => {
            const savedTrades = localStorage.getItem(JOURNAL_TRADES_KEY);
            const savedAnnotations = localStorage.getItem(JOURNAL_ANNOTATIONS_KEY);
            const savedPrefs = localStorage.getItem(JOURNAL_PREFERENCES_KEY);
            const savedPermanentFilters = localStorage.getItem(JOURNAL_PERMANENT_FILTERS_KEY);

            if (savedTrades) {
                try {
                    const parsed = JSON.parse(savedTrades);
                    setTrades(normalizeAndEnrichTrades(Array.isArray(parsed) ? parsed : []));
                } catch { }
            }
            if (savedAnnotations) {
                try { setAnnotations(JSON.parse(savedAnnotations)); } catch { }
            }
            if (savedPrefs) {
                try { setPreferencesState({ ...defaultPreferences, ...JSON.parse(savedPrefs) }); } catch { }
            }
            if (savedPermanentFilters) {
                try { setPermanentFilters({ ...defaultFilters, ...JSON.parse(savedPermanentFilters) }); } catch { }
            }

            setPlaybooks(getPlaybooks());
            setSpotPlans(getSpotPlans());
            setPerpPlans(getPerpPlans());
            setPlaybookAlerts(loadPlaybookAlerts());
        };

        const hydrateFromCloud = async () => {
            try {
                const [savedTrades, savedAnnotations, savedPrefs, savedPermanentFilters] = await Promise.all([
                    getValueWithCloud(JOURNAL_TRADES_KEY, user?.id ?? null, cloudSyncEnabled),
                    getValueWithCloud(JOURNAL_ANNOTATIONS_KEY, user?.id ?? null, cloudSyncEnabled),
                    getValueWithCloud(JOURNAL_PREFERENCES_KEY, user?.id ?? null, cloudSyncEnabled),
                    getValueWithCloud(JOURNAL_PERMANENT_FILTERS_KEY, user?.id ?? null, cloudSyncEnabled),
                ]);
                if (cancelled) return;

                if (savedTrades) {
                    try {
                        const parsed = JSON.parse(savedTrades);
                        setTrades(normalizeAndEnrichTrades(Array.isArray(parsed) ? parsed : []));
                    } catch { }
                }
                if (savedAnnotations) {
                    try { setAnnotations(JSON.parse(savedAnnotations)); } catch { }
                }
                if (savedPrefs) {
                    try { setPreferencesState({ ...defaultPreferences, ...JSON.parse(savedPrefs) }); } catch { }
                }
                if (savedPermanentFilters) {
                    try { setPermanentFilters({ ...defaultFilters, ...JSON.parse(savedPermanentFilters) }); } catch { }
                }

                if (user?.id && cloudSyncEnabled) {
                    const [playbooksRaw, spotRaw, perpRaw, sessionsRaw] = await Promise.all([
                        getValue(PLAYBOOKS_KEY),
                        getValue(SPOT_PLANS_KEY),
                        getValue(PERP_PLANS_KEY),
                        getValue(SESSION_STORAGE_KEY),
                    ]);
                    if (cancelled) return;
                    if (playbooksRaw) try { localStorage.setItem(PLAYBOOKS_KEY, playbooksRaw); } catch { }
                    if (spotRaw) try { localStorage.setItem(SPOT_PLANS_KEY, spotRaw); } catch { }
                    if (perpRaw) try { localStorage.setItem(PERP_PLANS_KEY, perpRaw); } catch { }
                    if (sessionsRaw) try { localStorage.setItem(SESSION_STORAGE_KEY, sessionsRaw); } catch { }
                }

                setPlaybooks(getPlaybooks());
                setSpotPlans(getSpotPlans());
                setPerpPlans(getPerpPlans());
                setPlaybookAlerts(loadPlaybookAlerts());
            } catch (e) {
                console.error('Failed to hydrate journal data:', e);
            }
        };

        applyLocalSnapshot();
        setIsLoading(false);
        void hydrateFromCloud();

        return () => {
            cancelled = true;
        };
    }, [user?.id, cloudSyncEnabled]);

    const handleRealtimeSyncUpdate = useCallback(
        async (key: string) => {
            if (
                key !== JOURNAL_TRADES_KEY &&
                key !== JOURNAL_ANNOTATIONS_KEY &&
                key !== JOURNAL_PREFERENCES_KEY &&
                key !== JOURNAL_PERMANENT_FILTERS_KEY
            )
                return;
            const saved = await getValueWithCloud(key, user?.id ?? null, cloudSyncEnabled);
            if (!saved) return;
            try {
                if (key === JOURNAL_TRADES_KEY) {
                    const parsed = JSON.parse(saved);
                    setTrades(normalizeAndEnrichTrades(Array.isArray(parsed) ? parsed : []));
                }
                else if (key === JOURNAL_ANNOTATIONS_KEY) setAnnotations(JSON.parse(saved));
                else if (key === JOURNAL_PREFERENCES_KEY)
                    setPreferencesState((prev) => ({ ...defaultPreferences, ...prev, ...JSON.parse(saved) }));
                else if (key === JOURNAL_PERMANENT_FILTERS_KEY) setPermanentFilters({ ...defaultFilters, ...JSON.parse(saved) });
            } catch { }
        },
        [user?.id, cloudSyncEnabled]
    );
    useSupabaseRealtimeSyncUpdate(handleRealtimeSyncUpdate);

    // Listen for playbook and plan updates
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleSpotPlansUpdate = () => {
            setSpotPlans(getSpotPlans());
            // Auto-sync alerts when plans change
            syncSpotPlansWithAlerts();
            setPlaybookAlerts(loadPlaybookAlerts());
        };

        const handlePerpPlansUpdate = () => {
            setPerpPlans(getPerpPlans());
            // Auto-sync alerts when plans change
            syncPerpPlansWithAlerts();
            setPlaybookAlerts(loadPlaybookAlerts());
        };

        const handlePlaybookAlertsUpdate = () => {
            setPlaybookAlerts(loadPlaybookAlerts());
        };

        const handleSyncPlaybookAlerts = () => {
            syncSpotPlansWithAlerts();
            syncPerpPlansWithAlerts();
            setPlaybookAlerts(loadPlaybookAlerts());
        };

        window.addEventListener('spot-plans-updated', handleSpotPlansUpdate);
        window.addEventListener('perp-plans-updated', handlePerpPlansUpdate);
        window.addEventListener('playbook-alerts-updated', handlePlaybookAlertsUpdate);
        window.addEventListener('sync-playbook-alerts', handleSyncPlaybookAlerts);

        return () => {
            window.removeEventListener('spot-plans-updated', handleSpotPlansUpdate);
            window.removeEventListener('perp-plans-updated', handlePerpPlansUpdate);
            window.removeEventListener('playbook-alerts-updated', handlePlaybookAlertsUpdate);
            window.removeEventListener('sync-playbook-alerts', handleSyncPlaybookAlerts);
        };
    }, []);

    // Real-time trade sync
    const isSyncingRef = useRef(false);
    useEffect(() => {
        if (!realtimeEnabled || typeof window === 'undefined') {
            if (syncIntervalRef.current) {
                clearInterval(syncIntervalRef.current);
                syncIntervalRef.current = null;
            }
            return;
        }

        // Start periodic sync
        const syncRealtime = async () => {
            if (isSyncingRef.current) return;
            if (Date.now() < apiUnavailableUntilRef.current) return;

            const connections = readRuntimeConnectionsFromStorage();

            const { keys, fallbackCexConnections, configuredExchanges } = getJournalConnectionConfig(connections);

            // Update connected exchanges from configured connections immediately.
            if (configuredExchanges.length > 0) {
                setConnectedExchanges(configuredExchanges);
            }

            // Skip sync if no exchange credentials/wallets are configured.
            if (Object.keys(keys).length === 0 && fallbackCexConnections.length === 0) return;

            isSyncingRef.current = true;
            setIsSyncing(true);
            try {
                const discoveredExchanges = new Set<string>();
                const journalSyncedExchanges = new Set<string>();
                const exchangeDiagnostics: Record<string, ExchangeSyncDiagnostic> = {};
                const syncStartedAt = Date.now();
                const requestedJournalExchanges = [
                    keys.binanceApiKey ? 'binance' : '',
                    keys.bybitApiKey ? 'bybit' : '',
                    keys.hyperliquidWallet ? 'hyperliquid' : '',
                ].map((ex) => normalizeExchange(ex)).filter(Boolean);

                if (Object.keys(keys).length > 0) {
                    try {
                        const ctrl = new AbortController();
                        const timeoutId = setTimeout(() => ctrl.abort(), 4500);
                        const res = await fetch(apiUrl('/api/journal/sync'), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ keys, options: REALTIME_SYNC_OPTIONS }),
                            signal: ctrl.signal,
                        }).finally(() => clearTimeout(timeoutId));

                        if (res.ok) {
                            apiUnavailableUntilRef.current = 0;
                            apiUnavailableNotifiedRef.current = false;
                            const data = await res.json();
                            const syncedTrades = Array.isArray(data?.trades)
                                ? normalizeAndEnrichTrades(data.trades)
                                : [];
                            const tradeCounts: Record<string, number> = {};
                            syncedTrades.forEach((trade: JournalTrade) => {
                                const exchange = normalizeExchange(trade.exchange);
                                if (!exchange) return;
                                tradeCounts[exchange] = (tradeCounts[exchange] || 0) + 1;
                            });

                            if (syncedTrades.length > 0) {
                                setTrades((prev) => mergeJournalTrades(prev, syncedTrades));
                                setLastSyncTime(Date.now());
                            }

                            if (Array.isArray(data?.exchanges)) {
                                data.exchanges
                                    .map((ex: unknown) => normalizeExchange(ex))
                                    .filter(Boolean)
                                    .forEach((ex: string) => {
                                        discoveredExchanges.add(ex);
                                        journalSyncedExchanges.add(ex);
                                    });
                            }

                            if (data?.diagnostics && typeof data.diagnostics === 'object') {
                                Object.entries(data.diagnostics as Record<string, any>).forEach(([rawExchange, rawDiag]) => {
                                    const exchange = normalizeExchange(rawExchange);
                                    if (!exchange) return;
                                    const normalizedStatus = normalizeExchange(rawDiag?.status);
                                    exchangeDiagnostics[exchange] = {
                                        status: normalizedStatus === 'error' ? 'error' : normalizedStatus === 'ok' ? 'ok' : 'empty',
                                        source: 'journal-sync',
                                        message: extractDiagnosticMessage(rawDiag),
                                        trades: Number(rawDiag?.trades || tradeCounts[exchange] || 0),
                                        lastSyncAt: syncStartedAt,
                                    };
                                });
                            }

                            requestedJournalExchanges.forEach((exchange) => {
                                if (!exchangeDiagnostics[exchange]) {
                                    const count = tradeCounts[exchange] || 0;
                                    exchangeDiagnostics[exchange] = {
                                        status: count > 0 ? 'ok' : 'empty',
                                        source: 'journal-sync',
                                        trades: count,
                                        lastSyncAt: syncStartedAt,
                                    };
                                }
                            });
                        } else {
                            const rawError = await readResponseErrorMessage(res);
                            requestedJournalExchanges.forEach((exchange) => {
                                exchangeDiagnostics[exchange] = {
                                    status: 'error',
                                    source: 'journal-sync',
                                    message: sanitizeDiagnosticMessage(rawError) || `HTTP ${res.status}`,
                                    trades: 0,
                                    lastSyncAt: syncStartedAt,
                                };
                            });
                            apiUnavailableUntilRef.current = Date.now() + API_RETRY_COOLDOWN_MS;
                        }
                    } catch (syncError) {
                        const message = sanitizeDiagnosticMessage(syncError instanceof Error ? syncError.message : String(syncError));
                        requestedJournalExchanges.forEach((exchange) => {
                            exchangeDiagnostics[exchange] = {
                                status: 'error',
                                source: 'journal-sync',
                                message,
                                trades: 0,
                                lastSyncAt: syncStartedAt,
                            };
                        });
                        console.warn('Real-time journal sync request failed, using direct CEX fallback:', syncError);
                    }
                }

                const fallbackConnections = fallbackCexConnections.filter((conn) => {
                    const exchange = normalizeExchange(conn.type);
                    if (!exchange) return false;
                    if (JOURNAL_SYNC_TYPES.has(exchange) && requestedJournalExchanges.includes(exchange)) return false;
                    return true;
                });

                if (fallbackConnections.length > 0) {
                    const fallback = await fetchFallbackTrades(fallbackConnections, journalSyncedExchanges);
                    if (fallback.trades.length > 0) {
                        setTrades((prev) => mergeJournalTrades(prev, fallback.trades));
                        setLastSyncTime(Date.now());
                    }
                    fallback.exchanges.forEach((ex) => discoveredExchanges.add(ex));
                    Object.entries(fallback.diagnostics).forEach(([exchange, diag]) => {
                        exchangeDiagnostics[exchange] = diag;
                    });
                }

                if (Object.keys(exchangeDiagnostics).length > 0) {
                    setSyncDiagnostics(exchangeDiagnostics);
                }

                const nextConnected = Array.from(
                    new Set([
                        ...configuredExchanges,
                        ...Array.from(discoveredExchanges),
                    ])
                );
                if (nextConnected.length > 0) {
                    setConnectedExchanges(nextConnected);
                }
            } catch (e) {
                apiUnavailableUntilRef.current = Date.now() + API_RETRY_COOLDOWN_MS;
                const message = e instanceof Error ? e.message : String(e);
                const isNetworkUnavailable =
                    message.includes('Failed to fetch') ||
                    message.includes('NetworkError') ||
                    message.includes('Load failed') ||
                    message.includes('timed out') ||
                    message.includes('AbortError');
                if (!isNetworkUnavailable || !apiUnavailableNotifiedRef.current) {
                    console.warn('Real-time sync unavailable:', message);
                }
                apiUnavailableNotifiedRef.current = true;
            } finally {
                isSyncingRef.current = false;
                setIsSyncing(false);
            }
        };

        // Initial sync
        syncRealtime();

        // Periodic sync
        syncIntervalRef.current = setInterval(syncRealtime, TRADE_SYNC_INTERVAL);

        return () => {
            if (syncIntervalRef.current) {
                clearInterval(syncIntervalRef.current);
            }
        };
    }, [realtimeEnabled]);

    // Listen for real-time trade events
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleNewTrade = (event: CustomEvent) => {
            const newTrade = event.detail as JournalTrade;
            setTrades((prev) => mergeJournalTrades(prev, [newTrade]));
            setLastSyncTime(Date.now());

            // Dispatch event for notifications
            window.dispatchEvent(new CustomEvent('journal-trade-received', { detail: newTrade }));
        };

        const handleTradeUpdate = (event: CustomEvent) => {
            const updatedTrade = event.detail as JournalTrade;
            setTrades((prev) => mergeJournalTrades(prev, [updatedTrade]));
        };

        window.addEventListener('journal-new-trade', handleNewTrade as EventListener);
        window.addEventListener('journal-trade-update', handleTradeUpdate as EventListener);

        return () => {
            window.removeEventListener('journal-new-trade', handleNewTrade as EventListener);
            window.removeEventListener('journal-trade-update', handleTradeUpdate as EventListener);
        };
    }, []);

    // Resolve Hyperliquid index aliases (e.g. @142) into readable symbols when metadata is available.
    useEffect(() => {
        const hasUnresolvedHyperliquidSymbols = trades.some((trade) => {
            const exchange = normalizeExchange(trade.exchange);
            if (exchange !== 'hyperliquid') return false;
            return isHyperliquidIndexSymbol(trade.symbol) || isHyperliquidIndexSymbol(trade.rawSymbol);
        });

        if (!hasUnresolvedHyperliquidSymbols) return;

        let cancelled = false;
        (async () => {
            const spotMeta = await getHyperliquidSpotMeta();
            if (cancelled || !spotMeta) return;

            setTrades((prev) => {
                let changed = false;
                const next = prev.map((trade) => {
                    const exchange = normalizeExchange(trade.exchange);
                    if (exchange !== 'hyperliquid') return trade;

                    const rawCandidate = String(trade.rawSymbol || trade.symbol || '').trim();
                    if (!isHyperliquidIndexSymbol(rawCandidate) && !isHyperliquidIndexSymbol(trade.symbol)) {
                        return trade;
                    }

                    const resolved = resolveHyperliquidSymbol(rawCandidate || String(trade.symbol || ''), spotMeta);
                    if (!resolved || isHyperliquidIndexSymbol(resolved)) return trade;

                    changed = true;
                    return {
                        ...trade,
                        symbol: resolved,
                        rawSymbol: rawCandidate || trade.rawSymbol || trade.symbol,
                    };
                });

                return changed ? normalizeAndEnrichTrades(next) : prev;
            });
        })();

        return () => {
            cancelled = true;
        };
    }, [trades]);

    // Persist trades
    useEffect(() => {
        if (typeof window === 'undefined' || isLoading) return;
        const raw = JSON.stringify(trades);
        localStorage.setItem(JOURNAL_TRADES_KEY, raw);
        setValueWithCloud(JOURNAL_TRADES_KEY, raw, user?.id ?? null, cloudSyncEnabled);
    }, [trades, isLoading, user?.id, cloudSyncEnabled]);

    // Persist annotations
    useEffect(() => {
        if (typeof window === 'undefined' || isLoading) return;
        const raw = JSON.stringify(annotations);
        localStorage.setItem(JOURNAL_ANNOTATIONS_KEY, raw);
        setValueWithCloud(JOURNAL_ANNOTATIONS_KEY, raw, user?.id ?? null, cloudSyncEnabled);
    }, [annotations, isLoading, user?.id, cloudSyncEnabled]);

    // Persist preferences
    useEffect(() => {
        if (typeof window === 'undefined' || isLoading) return;
        const raw = JSON.stringify(preferences);
        localStorage.setItem(JOURNAL_PREFERENCES_KEY, raw);
        setValueWithCloud(JOURNAL_PREFERENCES_KEY, raw, user?.id ?? null, cloudSyncEnabled);
    }, [preferences, isLoading, user?.id, cloudSyncEnabled]);

    // Persist permanent filters
    useEffect(() => {
        if (typeof window === 'undefined' || isLoading) return;
        const raw = JSON.stringify(permanentFilters);
        localStorage.setItem(JOURNAL_PERMANENT_FILTERS_KEY, raw);
        setValueWithCloud(JOURNAL_PERMANENT_FILTERS_KEY, raw, user?.id ?? null, cloudSyncEnabled);
    }, [permanentFilters, isLoading, user?.id, cloudSyncEnabled]);

    const setPreferences = useCallback((prefs: Partial<JournalPreferences>) => {
        setPreferencesState(prev => ({ ...prev, ...prefs }));
    }, []);

    const syncTrades = useCallback(async () => {
        setIsSyncing(true);
        try {
            const connections = readRuntimeConnectionsFromStorage();

            const { keys, fallbackCexConnections, configuredExchanges } = getJournalConnectionConfig(connections);

            // Update connected exchanges immediately
            if (configuredExchanges.length > 0) {
                setConnectedExchanges(configuredExchanges);
            }

            // Only sync if we have at least one connected exchange with valid credentials/wallet.
            if (Object.keys(keys).length === 0 && fallbackCexConnections.length === 0) {
                console.log('[Journal] No connected exchanges found');
                setIsSyncing(false);
                return;
            }

            const discoveredExchanges = new Set<string>();
            const journalSyncedExchanges = new Set<string>();
            const exchangeDiagnostics: Record<string, ExchangeSyncDiagnostic> = {};
            const syncStartedAt = Date.now();
            const requestedJournalExchanges = [
                keys.binanceApiKey ? 'binance' : '',
                keys.bybitApiKey ? 'bybit' : '',
                keys.hyperliquidWallet ? 'hyperliquid' : '',
            ].map((ex) => normalizeExchange(ex)).filter(Boolean);

            if (Object.keys(keys).length > 0) {
                const res = await fetch(apiUrl('/api/journal/sync'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ keys, options: MANUAL_SYNC_OPTIONS }),
                });

                if (res.ok) {
                    const data = await res.json();
                    const processedTrades: JournalTrade[] = Array.isArray(data?.trades)
                        ? normalizeAndEnrichTrades(data.trades)
                        : [];
                    const tradeCounts: Record<string, number> = {};
                    processedTrades.forEach((trade) => {
                        const exchange = normalizeExchange(trade.exchange);
                        if (!exchange) return;
                        tradeCounts[exchange] = (tradeCounts[exchange] || 0) + 1;
                    });

                    if (processedTrades.length > 0) {
                        setTrades((prev) => mergeJournalTrades(prev, processedTrades));
                        setLastSyncTime(Date.now());
                    }

                    if (Array.isArray(data?.exchanges)) {
                        data.exchanges
                            .map((ex: unknown) => normalizeExchange(ex))
                            .filter(Boolean)
                            .forEach((ex: string) => {
                                discoveredExchanges.add(ex);
                                journalSyncedExchanges.add(ex);
                            });
                    }

                    if (data?.diagnostics && typeof data.diagnostics === 'object') {
                        Object.entries(data.diagnostics as Record<string, any>).forEach(([rawExchange, rawDiag]) => {
                            const exchange = normalizeExchange(rawExchange);
                            if (!exchange) return;
                            const normalizedStatus = normalizeExchange(rawDiag?.status);
                            exchangeDiagnostics[exchange] = {
                                status: normalizedStatus === 'error' ? 'error' : normalizedStatus === 'ok' ? 'ok' : 'empty',
                                source: 'journal-sync',
                                message: extractDiagnosticMessage(rawDiag),
                                trades: Number(rawDiag?.trades || tradeCounts[exchange] || 0),
                                lastSyncAt: syncStartedAt,
                            };
                        });
                    }

                    requestedJournalExchanges.forEach((exchange) => {
                        if (!exchangeDiagnostics[exchange]) {
                            const count = tradeCounts[exchange] || 0;
                            exchangeDiagnostics[exchange] = {
                                status: count > 0 ? 'ok' : 'empty',
                                source: 'journal-sync',
                                trades: count,
                                lastSyncAt: syncStartedAt,
                            };
                        }
                    });
                } else {
                    const rawError = await readResponseErrorMessage(res);
                    requestedJournalExchanges.forEach((exchange) => {
                        exchangeDiagnostics[exchange] = {
                            status: 'error',
                            source: 'journal-sync',
                            message: sanitizeDiagnosticMessage(rawError) || `HTTP ${res.status}`,
                            trades: 0,
                            lastSyncAt: syncStartedAt,
                        };
                    });
                }
            }

            const fallbackConnections = fallbackCexConnections.filter((conn) => {
                const exchange = normalizeExchange(conn.type);
                if (!exchange) return false;
                if (JOURNAL_SYNC_TYPES.has(exchange) && requestedJournalExchanges.includes(exchange)) return false;
                return true;
            });

            if (fallbackConnections.length > 0) {
                const fallback = await fetchFallbackTrades(fallbackConnections, journalSyncedExchanges);
                if (fallback.trades.length > 0) {
                    setTrades((prev) => mergeJournalTrades(prev, fallback.trades));
                    setLastSyncTime(Date.now());
                }
                fallback.exchanges.forEach((ex) => discoveredExchanges.add(ex));
                Object.entries(fallback.diagnostics).forEach(([exchange, diag]) => {
                    exchangeDiagnostics[exchange] = diag;
                });
            }

            if (Object.keys(exchangeDiagnostics).length > 0) {
                setSyncDiagnostics(exchangeDiagnostics);
            }

            const nextConnected = Array.from(
                new Set([
                    ...configuredExchanges,
                    ...Array.from(discoveredExchanges),
                ])
            );
            if (nextConnected.length > 0) {
                setConnectedExchanges(nextConnected);
            }
        } catch (e) {
            console.error('Failed to sync trades:', e);
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('app-notify', { detail: { type: 'error', title: 'Journal sync failed', message: 'Could not load trades. Check API server and retry.', duration: 5000 } }));
            }
        }
        setIsSyncing(false);
    }, []);

    // Sync playbooks from storage
    const syncPlaybooks = useCallback(() => {
        setPlaybooks(getPlaybooks());
        setSpotPlans(getSpotPlans());
        setPerpPlans(getPerpPlans());
    }, []);

    // Sync alerts
    const syncAlerts = useCallback(() => {
        syncSpotPlansWithAlerts();
        syncPerpPlansWithAlerts();
        setPlaybookAlerts(loadPlaybookAlerts());
    }, []);

    // Check price alerts against current prices
    const checkPriceAlerts = useCallback((prices: Record<string, number>) => {
        lastPricesRef.current = prices;

        const alerts = loadPlaybookAlerts();
        const spotPlanById = new Map(spotPlans.map((plan) => [plan.id, plan]));
        const perpPlanById = new Map(perpPlans.map((plan) => [plan.id, plan]));
        const newTriggered: PlaybookLevelAlert[] = [];
        let hasChanges = false;

        alerts.forEach(alert => {
            if (!alert.enabled || alert.triggered) return;

            // Find price for this symbol
            const symbolVariants = [
                alert.symbol,
                alert.symbol.toUpperCase(),
                `${alert.symbol}USDT`,
                `${alert.symbol}/USDT`,
            ];

            let currentPrice: number | null = null;
            for (const variant of symbolVariants) {
                if (prices[variant]) {
                    currentPrice = prices[variant];
                    break;
                }
            }

            if (currentPrice === null) return;

            const levelValue = alert.levelValue;
            const threshold = levelValue * 0.001; // 0.1% threshold

            let triggered = false;

            switch (alert.alertType) {
                case 'touch':
                    // Price touched the level (within threshold)
                    triggered = Math.abs(currentPrice - levelValue) <= threshold;
                    break;
                case 'break_above':
                    // Price broke above the level
                    triggered = currentPrice > levelValue;
                    break;
                case 'break_below':
                    // Price broke below the level
                    triggered = currentPrice < levelValue;
                    break;
                case 'reject':
                    // Price touched and moved away (requires previous price)
                    // Simplified: just check if price is near level
                    triggered = Math.abs(currentPrice - levelValue) <= threshold * 2;
                    break;
            }

            if (triggered) {
                const plan = alert.planType === 'perp'
                    ? perpPlanById.get(alert.planId)
                    : spotPlanById.get(alert.planId);
                const exchange = connectedExchanges[0] || 'binance';

                if (plan) {
                    const ruleResult = evaluatePlanRules({
                        plan,
                        alert,
                        currentPrice,
                        exchange,
                    });
                    if (!ruleResult.pass) {
                        const now = Date.now();
                        const lastBlockedAt = blockedRuleEventAtRef.current[alert.id] || 0;
                        if (now - lastBlockedAt > 30000) {
                            blockedRuleEventAtRef.current[alert.id] = now;
                            window.dispatchEvent(new CustomEvent('playbook-rule-blocked', {
                                detail: {
                                    alert,
                                    exchange,
                                    currentPrice,
                                    blockedReasons: ruleResult.blockedReasons,
                                    warnings: ruleResult.warnings,
                                    mode: ruleResult.mode,
                                    message: `${alert.symbol} blocked by plan rules`,
                                    timestamp: now,
                                },
                            }));
                        }
                        return;
                    }
                }

                markPlaybookAlertTriggered(alert.id);
                newTriggered.push({ ...alert, triggered: true, lastTriggered: Date.now() });
                hasChanges = true;

                window.dispatchEvent(new CustomEvent('playbook-alert-triggered', {
                    detail: {
                        alert,
                        currentPrice,
                        exchange,
                        message: `${alert.symbol} ${alert.alertType.replace('_', ' ')} at ${alert.levelType} (${levelValue.toFixed(2)})`,
                    }
                }));

                const progress = getPlanProgress(alert.planId);
                if (progress) {
                    if (progress.allDone && !getPlanCompletionNotified(alert.planId, 'full')) {
                        setPlanCompletionNotified(alert.planId, 'full');
                        window.dispatchEvent(new CustomEvent('playbook-plan-complete', {
                            detail: { progress, exchange }
                        }));
                    } else if (progress.buyPhaseDone && !getPlanCompletionNotified(alert.planId, 'buy_phase')) {
                        setPlanCompletionNotified(alert.planId, 'buy_phase');
                        window.dispatchEvent(new CustomEvent('playbook-buy-phase-done', {
                            detail: { progress, exchange }
                        }));
                    }
                }
            }
        });

        if (hasChanges) {
            setPlaybookAlerts(loadPlaybookAlerts());
            setTriggeredAlerts(prev => [...newTriggered, ...prev].slice(0, 50)); // Keep last 50
        }
    }, [connectedExchanges, perpPlans, spotPlans]);

    const addAnnotation = useCallback((annotation: TradeAnnotation) => {
        setAnnotations(prev => ({
            ...prev,
            [annotation.tradeId]: annotation,
        }));
    }, []);

    const updateAnnotation = useCallback((id: string, update: Partial<TradeAnnotation>) => {
        setAnnotations(prev => {
            const existing = prev[id];
            if (!existing) return prev;
            return {
                ...prev,
                [id]: { ...existing, ...update, updatedAt: Date.now() },
            };
        });
    }, []);

    const deleteAnnotation = useCallback((id: string) => {
        setAnnotations(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
    }, []);

    // Apply filters to trades
    const filteredTrades = useMemo(() => {
        let result = [...trades];

        // Apply permanent filters if enabled
        const activeFilters = preferences.permanentFiltersEnabled
            ? { ...permanentFilters, ...filters }
            : filters;

        // Status filter
        if (activeFilters.status === 'open') {
            result = result.filter(t => t.isOpen);
        } else if (activeFilters.status === 'closed') {
            result = result.filter(t => !t.isOpen);
        }

        // Side filter
        if (activeFilters.side === 'long') {
            result = result.filter(t => t.side === 'buy' || (t.side as string) === 'long');
        } else if (activeFilters.side === 'short') {
            result = result.filter(t => t.side === 'sell' || (t.side as string) === 'short');
        }

        const normalizeSymbolKey = (value: unknown) => String(value || '').trim().toUpperCase();
        const includeSymbols = new Set(
            [...(activeFilters.symbols || []), ...(activeFilters.includeSymbols || [])]
                .map(normalizeSymbolKey)
                .filter(Boolean)
        );
        const excludeSymbols = new Set((activeFilters.excludeSymbols || []).map(normalizeSymbolKey).filter(Boolean));

        if (includeSymbols.size > 0) {
            result = result.filter(t => includeSymbols.has(normalizeSymbolKey(t.symbol)));
        }
        if (excludeSymbols.size > 0) {
            result = result.filter(t => !excludeSymbols.has(normalizeSymbolKey(t.symbol)));
        }

        // Exchange filter
        if (activeFilters.exchange) {
            const normalizedFilterExchange = normalizeExchange(activeFilters.exchange);
            result = result.filter(t => normalizeExchange(t.exchange) === normalizedFilterExchange);
        }

        const includeTags = new Set<StrategyTagId>([
            ...(activeFilters.tags || []),
            ...(activeFilters.includeTags || []),
        ]);
        const excludeTags = new Set<StrategyTagId>(activeFilters.excludeTags || []);

        // Tags filter (from annotations)
        if (includeTags.size > 0) {
            result = result.filter(t => {
                const ann = annotations[t.id];
                return !!ann?.strategyTag && includeTags.has(ann.strategyTag);
            });
        }
        if (excludeTags.size > 0) {
            result = result.filter(t => {
                const ann = annotations[t.id];
                return !ann?.strategyTag || !excludeTags.has(ann.strategyTag);
            });
        }

        // Reviewed / unreviewed filter
        if (activeFilters.reviewStatus === 'reviewed') {
            result = result.filter(t => annotations[t.id]?.reviewed === true);
        } else if (activeFilters.reviewStatus === 'unreviewed') {
            result = result.filter(t => annotations[t.id]?.reviewed !== true);
        }

        // Playbook assignment filter
        if ((activeFilters.playbookIds || []).length > 0) {
            const selectedPlaybooks = new Set((activeFilters.playbookIds || []).map((value) => String(value)));
            result = result.filter(t => {
                const playbookId = annotations[t.id]?.playbookId;
                return !!playbookId && selectedPlaybooks.has(String(playbookId));
            });
        }

        // Account / connection filter
        if ((activeFilters.connectionIds || []).length > 0) {
            const selectedConnections = new Set((activeFilters.connectionIds || []).map((value) => String(value)));
            result = result.filter(t => {
                const connectionId = String((t as unknown as { connectionId?: unknown }).connectionId || '');
                return connectionId.length > 0 && selectedConnections.has(connectionId);
            });
        }

        // PnL filters
        if (activeFilters.minPnl !== null) {
            result = result.filter(t => (t.realizedPnl || 0) >= activeFilters.minPnl!);
        }
        if (activeFilters.maxPnl !== null) {
            result = result.filter(t => (t.realizedPnl || 0) <= activeFilters.maxPnl!);
        }

        // Hold time filters
        if (activeFilters.minHoldTime !== null) {
            result = result.filter(t => (t.holdTime || 0) >= activeFilters.minHoldTime!);
        }
        if (activeFilters.maxHoldTime !== null) {
            result = result.filter(t => (t.holdTime || 0) <= activeFilters.maxHoldTime!);
        }

        // Entry / exit price filters
        if (activeFilters.minEntryPrice !== null && activeFilters.minEntryPrice !== undefined) {
            result = result.filter(t => getTradeEntryPrice(t) >= activeFilters.minEntryPrice!);
        }
        if (activeFilters.maxEntryPrice !== null && activeFilters.maxEntryPrice !== undefined) {
            result = result.filter(t => getTradeEntryPrice(t) <= activeFilters.maxEntryPrice!);
        }
        if (activeFilters.minExitPrice !== null && activeFilters.minExitPrice !== undefined) {
            result = result.filter(t => getTradeExitPrice(t) >= activeFilters.minExitPrice!);
        }
        if (activeFilters.maxExitPrice !== null && activeFilters.maxExitPrice !== undefined) {
            result = result.filter(t => getTradeExitPrice(t) <= activeFilters.maxExitPrice!);
        }

        // Position size / volume filters
        if (activeFilters.minPositionSize !== null && activeFilters.minPositionSize !== undefined) {
            result = result.filter(t => getTradePositionSize(t) >= activeFilters.minPositionSize!);
        }
        if (activeFilters.maxPositionSize !== null && activeFilters.maxPositionSize !== undefined) {
            result = result.filter(t => getTradePositionSize(t) <= activeFilters.maxPositionSize!);
        }
        if (activeFilters.minVolume !== null && activeFilters.minVolume !== undefined) {
            result = result.filter(t => {
                const volume = Math.abs((t.cost ?? t.price * t.amount) || 0);
                return volume >= activeFilters.minVolume!;
            });
        }
        if (activeFilters.maxVolume !== null && activeFilters.maxVolume !== undefined) {
            result = result.filter(t => {
                const volume = Math.abs((t.cost ?? t.price * t.amount) || 0);
                return volume <= activeFilters.maxVolume!;
            });
        }

        // Realized R-multiple filters (strict stop-based risk)
        if (activeFilters.minRMultiple !== null && activeFilters.minRMultiple !== undefined) {
            result = result.filter(t => {
                const r = getRealizedRMultiple(t, annotations[t.id]);
                return r !== null && r >= activeFilters.minRMultiple!;
            });
        }
        if (activeFilters.maxRMultiple !== null && activeFilters.maxRMultiple !== undefined) {
            result = result.filter(t => {
                const r = getRealizedRMultiple(t, annotations[t.id]);
                return r !== null && r <= activeFilters.maxRMultiple!;
            });
        }

        // Apply breakeven filter
        if (preferences.breakevenEnabled) {
            result = result.map(t => {
                const currentPnl = t.realizedPnl || 0;
                // Only modify if it needs to be zeroed out AND isn't already 0
                if (Math.abs(currentPnl) <= preferences.breakevenRange && currentPnl !== 0) {
                    return { ...t, realizedPnl: 0 };
                }
                return t;
            });
        }

        // Date range filtering / preset logic
        const getTradeTime = (t: JournalTrade) => {
            const entry = t.entryTime ?? t.timestamp;
            const exit = t.exitTime ?? t.timestamp;
            return dateRange.groupBy === 'close' ? exit : entry;
        };

        const preset = dateRange.preset;
        const lastN = preset === 'last25' ? 25 : preset === 'last100' ? 100 : null;
        if (lastN) {
            // last N trades by selected grouping time, newest first
            result.sort((a, b) => getTradeTime(b) - getTradeTime(a));
            result = result.slice(0, lastN);
        } else if (preset !== 'all') {
            // Other presets are encoded as start/end already.
            // Fall through to dateMode filter.
        }

        if (!lastN && preset !== 'all' && (dateRange.start || dateRange.end)) {
            const startMs = dateRange.start?.getTime() ?? null;
            const endMs = dateRange.end?.getTime() ?? null;
            const boundStart = startMs ?? endMs;
            const boundEnd = endMs ?? startMs;

            if (dateRange.mode === 'before' && boundEnd !== null) {
                result = result.filter(t => getTradeTime(t) <= boundEnd);
            } else if (dateRange.mode === 'after' && boundStart !== null) {
                result = result.filter(t => getTradeTime(t) >= boundStart);
            } else if (dateRange.mode === 'range') {
                if (startMs !== null) result = result.filter(t => getTradeTime(t) >= startMs);
                if (endMs !== null) result = result.filter(t => getTradeTime(t) <= endMs);
            }
        }

        // Sort by timestamp descending
        result.sort((a, b) => getTradeTime(b) - getTradeTime(a));

        return result;
    }, [trades, filters, permanentFilters, preferences, dateRange, annotations]);

    // Calculate stats
    const stats = useMemo((): JournalStats => {
        const closedTrades = filteredTrades.filter(t => !t.isOpen);

        const wins = closedTrades.filter(t => (t.realizedPnl || 0) > 0);
        const losses = closedTrades.filter(t => (t.realizedPnl || 0) < 0);
        const breakevens = closedTrades.filter(t => (t.realizedPnl || 0) === 0);

        const totalPnl = closedTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
        const totalWins = wins.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
        const totalLosses = Math.abs(losses.reduce((sum, t) => sum + (t.realizedPnl || 0), 0));

        const avgHoldTime = closedTrades.length > 0
            ? closedTrades.reduce((sum, t) => sum + (t.holdTime || 0), 0) / closedTrades.length
            : 0;

        const totalVolume = closedTrades.reduce((sum, t) => sum + (t.amount * t.price), 0);

        const longs = closedTrades.filter(t => t.side === 'buy' || (t.side as string) === 'long');
        const shorts = closedTrades.filter(t => t.side === 'sell' || (t.side as string) === 'short');

        return {
            totalTrades: closedTrades.length,
            winningTrades: wins.length,
            losingTrades: losses.length,
            breakevenTrades: breakevens.length,
            winRate: wins.length + losses.length > 0 ? (wins.length / (wins.length + losses.length)) * 100 : 0,
            totalPnl,
            avgPnl: closedTrades.length > 0 ? totalPnl / closedTrades.length : 0,
            avgWin: wins.length > 0 ? totalWins / wins.length : 0,
            avgLoss: losses.length > 0 ? totalLosses / losses.length : 0,
            profitFactor: totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0,
            largestWin: wins.length > 0 ? Math.max(...wins.map(t => t.realizedPnl || 0)) : 0,
            largestLoss: losses.length > 0 ? Math.min(...losses.map(t => t.realizedPnl || 0)) : 0,
            avgHoldTime,
            totalVolume,
            longCount: longs.length,
            shortCount: shorts.length,
        };
    }, [filteredTrades]);

    const value: JournalContextType = {
        trades,
        annotations,
        isLoading,
        isSyncing,
        lastSyncTime,

        // Playbooks & Plans
        playbooks,
        spotPlans,
        perpPlans,
        playbookAlerts,
        triggeredAlerts,

        // Real-time status
        realtimeEnabled,
        setRealtimeEnabled,
        connectedExchanges,
        syncDiagnostics,

        dateRange,
        setDateRange,
        filters,
        setFilters,
        permanentFilters,
        setPermanentFilters,
        preferences,
        setPreferences,
        filteredTrades,
        syncTrades,
        syncPlaybooks,
        syncAlerts,
        checkPriceAlerts,
        addAnnotation,
        updateAnnotation,
        deleteAnnotation,
        stats,
    };

    return (
        <JournalContext.Provider value={value}>
            {children}
        </JournalContext.Provider>
    );
}

export function useJournal() {
    const context = useContext(JournalContext);
    if (!context) {
        throw new Error('useJournal must be used within a JournalProvider');
    }
    return context;
}

// Helper hooks
export function useJournalStats() {
    const { stats } = useJournal();
    return stats;
}

export function useJournalTrades() {
    const { filteredTrades, isLoading } = useJournal();
    return { trades: filteredTrades, isLoading };
}
