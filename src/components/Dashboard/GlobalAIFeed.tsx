"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { NeuralAlphaFeed, type AlphaSignalExport } from "@/components/Dashboard/NeuralAlphaFeed";
import { Position } from "@/lib/api/types";
import { apiFetch } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { streamWithAI, getAIProvider, buildAIHeaders } from "@/lib/api/ai";
import type { AIProvider } from "@/lib/api/ai";
import { useSocialFeed } from "@/hooks/useSocialFeed";
import { getAlertsFeedSettings } from "@/lib/alertsFeedSettings";
import { useScreenerData } from "@/hooks/useScreenerData";
import { getHighVolatilitySignals } from "@/lib/screenerInsights";

const FEED_THROTTLE_MS = 30000;

interface CalendarEvent {
    id: string;
    title: string;
    timestamp: number;
    category?: string;
    impact?: string;
    country?: string;
    actual?: string;
    forecast?: string;
    previous?: string;
    isLive?: boolean;
}

const MAX_ADDITIONAL = 16;
const AI_SUMMARY_CACHE_KEY = "ai_feed_summary_cache_v1";
const AI_SUMMARY_MIN_INTERVAL = 6 * 60 * 1000;
const AI_SUMMARY_TIMEOUT = 12000;

export function GlobalAIFeed({
    className,
    compact = false,
    screenerAdditionalItems = [],
    scope = "overview",
    socialSymbols,
    includeScreenerVolatility = false,
}: {
    className?: string;
    compact?: boolean;
    screenerAdditionalItems?: AlphaSignalExport[];
    scope?: "overview" | "markets" | "spot" | "balances";
    socialSymbols?: string[];
    includeScreenerVolatility?: boolean;
}) {
    const { assets, activities, positions, watchlist } = usePortfolio();
    const screener = useScreenerData({ live: false, enableRestFallback: false });
    const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
    const [aiSummaryItem, setAiSummaryItem] = useState<AlphaSignalExport | null>(null);
    const [aiSummaryEnabled, setAiSummaryEnabled] = useState(false);
    const summaryInFlight = useRef(false);
    const lastSnapshotRef = useRef(0);
    const dataRef = useRef({ assets, activities, positions });
    dataRef.current = { assets, activities, positions };
    const [snapshot, setSnapshot] = useState<{ assets: typeof assets; activities: typeof activities; positions: typeof positions }>({
        assets: Array.isArray(assets) ? assets : [],
        activities: activities ?? [],
        positions: Array.isArray(positions) ? positions : [],
    });

    const toSafeSnapshot = useCallback(() => {
        const d = dataRef.current;
        return {
            assets: Array.isArray(d.assets) ? d.assets : [],
            activities: d.activities ?? [],
            positions: Array.isArray(d.positions) ? d.positions : [],
        };
    }, []);

    useEffect(() => {
        const now = Date.now();
        if (now - lastSnapshotRef.current >= FEED_THROTTLE_MS || lastSnapshotRef.current === 0) {
            lastSnapshotRef.current = now;
            setSnapshot(toSafeSnapshot());
        }
        const id = setInterval(() => {
            lastSnapshotRef.current = Date.now();
            setSnapshot(toSafeSnapshot());
        }, FEED_THROTTLE_MS);
        return () => clearInterval(id);
    }, [toSafeSnapshot]);

    const fetchCalendar = useCallback(async () => {
        try {
            const res = await apiFetch(
                "/api/ai/calendar",
                {
                    method: "POST",
                    cache: "no-store",
                    headers: buildAIHeaders(),
                    body: JSON.stringify({ horizonHours: 48, maxItems: 12 }),
                },
                12_000
            );
            const json = await res.json().catch(() => ({}));
            if (!res.ok) return;

            const rawEvents = Array.isArray((json as any).events)
                ? (json as any).events
                : Array.isArray(json)
                    ? json
                    : [];

            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const endOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2).getTime() - 1;
            const filtered = rawEvents.filter(
                (e: { timestamp: number }) => e.timestamp >= startOfToday && e.timestamp <= endOfTomorrow
            );
            setCalendarEvents(filtered);
        } catch {
            // Keep previous events on transient failures.
        }
    }, []);

    useEffect(() => {
        fetchCalendar();
        const t = setInterval(fetchCalendar, 2 * 60 * 1000);
        return () => clearInterval(t);
    }, [fetchCalendar]);

    useEffect(() => {
        const updateSettings = () => {
            const settings = getAlertsFeedSettings();
            setAiSummaryEnabled(Boolean(settings.enableAISummary));
        };
        updateSettings();
        window.addEventListener("alerts-feed-settings-changed", updateSettings);
        return () => window.removeEventListener("alerts-feed-settings-changed", updateSettings);
    }, []);

    const loadCachedSummary = useCallback(() => {
        if (typeof window === "undefined") return null;
        try {
            const raw = localStorage.getItem(AI_SUMMARY_CACHE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw) as { ts: number; item: AlphaSignalExport };
            if (!parsed?.item || !parsed.ts) return null;
            if (Date.now() - parsed.ts > AI_SUMMARY_MIN_INTERVAL) return null;
            return parsed.item;
        } catch {
            return null;
        }
    }, []);

    const persistSummary = useCallback((item: AlphaSignalExport) => {
        if (typeof window === "undefined") return;
        try {
            localStorage.setItem(AI_SUMMARY_CACHE_KEY, JSON.stringify({ ts: Date.now(), item }));
        } catch {
            // no-op
        }
    }, []);

    const volatilityItems = useMemo((): AlphaSignalExport[] => {
        if (!includeScreenerVolatility || !screener?.tickersList) return [];
        return getHighVolatilitySignals(screener.tickersList).slice(0, 8).map((v) => ({
            id: `vol-${v.symbol}-${v.exchange}`,
            type: "VOLATILITY_ALERT",
            symbol: v.symbol,
            title: `${(v.exchange || "MARKET").toUpperCase()} HIGH VOL`,
            description: v.reason || "High short-term volatility detected.",
            timestamp: v.timestamp,
            priority: "high",
            data: { source: "SCREENER" },
        }));
    }, [includeScreenerVolatility, screener?.tickersList]);

    const buildSummaryContext = useCallback(() => {
        const assetTop = [...(snapshot.assets || [])]
            .sort((a, b) => (b.valueUsd || 0) - (a.valueUsd || 0))
            .slice(0, 6)
            .map((a) => `${a.symbol}:${Math.round(a.valueUsd || 0)}`);
        const posTop = [...(snapshot.positions || [])]
            .sort((a, b) => Math.abs(b.pnl || 0) - Math.abs(a.pnl || 0))
            .slice(0, 5)
            .map((p) => `${p.symbol} ${p.side || ""} pnl ${Math.round(p.pnl || 0)}`);
        const volatilityTop = volatilityItems.slice(0, 4).map((v) => `${v.symbol}:${v.title}`);
        const calendarTop = calendarEvents.slice(0, 4).map((e) => `${e.title} ${e.impact || ""}`);
        return { assetTop, posTop, volatilityTop, calendarTop };
    }, [snapshot.assets, snapshot.positions, volatilityItems, calendarEvents]);

    const generateAISummary = useCallback(async () => {
        if (summaryInFlight.current) return;
        if (includeScreenerVolatility && (!screener?.tickersList || volatilityItems.length === 0)) {
            return;
        }
        summaryInFlight.current = true;
        try {
            const ctx = buildSummaryContext();
            const providerSetting = getAIProvider();
            const resolvedProvider = (providerSetting === "auto" ? "gemini" : providerSetting) as AIProvider;
            const payload = {
                provider: resolvedProvider,
                maxTokens: 140,
                temperature: 0.2,
                messages: [
                    {
                        role: "system" as const,
                        content:
                            "You are a trading assistant. Summarize the current portfolio and market context into 1 short actionable insight (1-2 sentences). Focus on risk and next best action. Do not mention that this is AI."
                    },
                    {
                        role: "user" as const,
                        content: JSON.stringify(ctx),
                    },
                ],
            };

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), AI_SUMMARY_TIMEOUT);
            let buffer = "";
            const seed: AlphaSignalExport = {
                id: `ai-summary-${Date.now()}`,
                type: "AI_SUMMARY",
                symbol: "AI",
                title: "Portfolio Pulse",
                description: "",
                timestamp: Date.now(),
                priority: "medium",
                data: { source: resolvedProvider },
            };
            setAiSummaryItem(seed);

            const response = await streamWithAI(
                { ...payload, jsonMode: false, feature: "ai_feed_summary" },
                {
                    onDelta: (chunk) => {
                        buffer += chunk;
                        setAiSummaryItem((prev) => prev ? { ...prev, description: buffer } : seed);
                    },
                    signal: controller.signal,
                }
            );
            clearTimeout(timeout);

            const content = response.content?.trim();
            if (!content) return;

            const item: AlphaSignalExport = {
                ...seed,
                description: content,
                data: { source: response.provider, model: response.model },
            };
            persistSummary(item);
            setAiSummaryItem(item);
        } catch {
            // keep last known summary
        } finally {
            summaryInFlight.current = false;
        }
    }, [buildSummaryContext, persistSummary]);

    useEffect(() => {
        const cached = loadCachedSummary();
        if (!aiSummaryEnabled) return;
        if (cached) {
            setAiSummaryItem(cached);
            return;
        }
        void generateAISummary();
    }, [generateAISummary, loadCachedSummary, aiSummaryEnabled]);

    const socialTickers = useMemo(() => {
        if (socialSymbols?.length) return socialSymbols;
        if (scope === "spot" || scope === "balances") {
            return (assets || []).map((a) => a.symbol);
        }
        return watchlist || [];
    }, [socialSymbols, assets, watchlist, scope]);

    const socialItems = useSocialFeed({
        symbols: socialTickers,
        scope,
        highVolSymbols: volatilityItems.map((v) => v.symbol),
    });

    const additionalItems = useMemo((): AlphaSignalExport[] => {
        const items: AlphaSignalExport[] = [];
        const now = Date.now();

        if (aiSummaryEnabled && aiSummaryItem) {
            items.push(aiSummaryItem);
        }

        // 1. Economic calendar events
        calendarEvents.slice(0, 8).forEach((e) => {
            const timeStr =
                e.timestamp <= now
                    ? `${Math.floor((now - e.timestamp) / 60000)}m ago`
                    : `in ${Math.floor((e.timestamp - now) / 3600000)}h`;
            const detail = [e.actual && `Actual: ${e.actual}`, e.forecast && `Forecast: ${e.forecast}`]
                .filter(Boolean)
                .join(" · ");
            items.push({
                id: `cal-${e.id}`,
                type: "ECONOMIC_EVENT",
                symbol: e.country || "Global",
                title: e.title,
                description: detail || `${e.impact || "Medium"} impact · ${timeStr}`,
                timestamp: e.timestamp,
                priority: e.impact === "critical" ? "high" : e.impact === "high" ? "medium" : "low",
                data: { price: 0 },
            });
        });

        // 2. Futures positions insights
        (snapshot.positions as Position[]).forEach((pos, i) => {
            const pnl = pos.pnl || 0;
            const pnlPct = pos.entryPrice > 0 ? (pnl / (Math.abs(pos.size) * pos.entryPrice)) * 100 : 0;
            const isProfit = pnl >= 0;
            items.push({
                id: `fut-${pos.symbol}-${i}`,
                type: "FUTURES_INSIGHT",
                symbol: pos.symbol.replace("-PERP", ""),
                title: `${pos.side?.toUpperCase()} ${pos.leverage || 1}x`,
                description: isProfit
                    ? `+${formatPnl(pnl)} (+${pnlPct.toFixed(1)}%). Consider trailing stop.`
                    : `${formatPnl(pnl)} (${pnlPct.toFixed(1)}%). Monitor liquidation risk.`,
                timestamp: now - (i + 1) * 60000,
                priority: Math.abs(pnlPct) > 30 ? "high" : "medium",
                data: { pnlPercent: pnlPct, pnlUsd: pnl },
            });
        });

        // 3. Recent transaction activity (trades + transfers)
        const sortedActivities = [...(snapshot.activities || [])]
            .filter((a) => a.activityType === "trade" || a.activityType === "transfer" || a.activityType === "internal")
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
            .slice(0, 10);

        sortedActivities.forEach((act, i) => {
            const tx = act as { symbol?: string; side?: string; type?: string; amount?: number; price?: number; timestamp?: number; asset?: string };
            const sym = tx.symbol || tx.asset || "?";
            const side = (tx.side || tx.type || "").toLowerCase();
            const isBuy = side === "buy" || side === "long" || tx.type === "Buy";
            const isTransfer = act.activityType === "transfer" || act.activityType === "internal";
            const label = isTransfer ? (tx.type === "Deposit" ? "DEPOSIT" : "WITHDRAW") : (isBuy ? "BUY" : "SELL");
            const priceStr = tx.price ? ` @ $${tx.price.toLocaleString()}` : "";
            items.push({
                id: `trx-${(act as { id?: string }).id || i}`,
                type: "TRX_ACTIVITY",
                symbol: String(sym).replace("/USDT", ""),
                title: label,
                description: `${(tx.amount || 0).toLocaleString()} ${sym}${priceStr}`,
                timestamp: tx.timestamp || now - 86400000,
                priority: "low",
                data: { amount: tx.amount, price: tx.price },
            });
        });

        // 4. AI recommendations based on portfolio
        const totalValue = snapshot.assets.reduce((s, a) => s + (a.valueUsd || 0), 0);
        const stableValue = snapshot.assets
            .filter((a) => ["USDT", "USDC", "DAI"].includes(a.symbol))
            .reduce((s, a) => s + (a.valueUsd || 0), 0);
        const stablePct = totalValue > 0 ? (stableValue / totalValue) * 100 : 0;

        if (stablePct > 80 && totalValue > 100) {
            items.push({
                id: "rec-diversify",
                type: "WHALE_ACCUMULATION",
                symbol: "USDC",
                title: "Diversification",
                description: `${stablePct.toFixed(0)}% in stables. Consider deploying capital into assets for yield.`,
                timestamp: now - 300000,
                priority: "medium",
                data: {},
            });
        }

        // Screener-specific augmentations are injected only from the Screener page.
        const merged = [
            ...items,
            ...(volatilityItems || []),
            ...(socialItems || []),
            ...(screenerAdditionalItems || []),
        ];
        return merged.sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_ADDITIONAL);
    }, [calendarEvents, snapshot, screenerAdditionalItems, volatilityItems, socialItems, aiSummaryItem]);

    return (
        <NeuralAlphaFeed
            className={cn("flex-1 clone-card", className)}
            compact={compact}
            additionalItems={additionalItems}
            variant="global"
        />
    );
}

function formatPnl(n: number): string {
    const sign = n >= 0 ? "+" : "";
    return `${sign}$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
