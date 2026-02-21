"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/api/client";
import { TradingSession } from "@/lib/api/session";
import { SidebarEconomicEvent, SidebarRiskState, SidebarSessionIntel } from "@/lib/types/sidebar-session";

type TradingHoursLike = {
  name: string;
  shortName: string;
  isOverlap: boolean;
  overlapWith?: string;
};

type CalendarApiEvent = {
  id?: string;
  title?: string;
  event?: string;
  timestamp?: number | string;
  date?: number | string;
  impact?: string;
  country?: string;
  isLive?: boolean;
  actual?: string;
};

const POLL_MS = 60_000;
const CACHE_TTL_MS = 30_000;

let cachedEvents: CalendarApiEvent[] = [];
let lastFetchAt = 0;

function toImpact(value?: string): SidebarEconomicEvent["impact"] {
  const v = String(value || "medium").toLowerCase();
  if (v === "critical") return "critical";
  if (v === "high") return "high";
  if (v === "low") return "low";
  return "medium";
}

function toTimestamp(raw: CalendarApiEvent): number {
  const direct = Number(raw.timestamp ?? raw.date ?? 0);
  if (Number.isFinite(direct) && direct > 0) return direct;
  return Date.now();
}

function normalizeEvent(raw: CalendarApiEvent, now: number): SidebarEconomicEvent {
  const timestamp = toTimestamp(raw);
  const minutesToEvent = Math.round((timestamp - now) / 60_000);
  const fallbackLive = minutesToEvent <= 0 && minutesToEvent >= -60;
  return {
    id: String(raw.id || raw.title || raw.event || timestamp),
    title: String(raw.title || raw.event || "Economic Event"),
    country: raw.country ? String(raw.country) : undefined,
    impact: toImpact(raw.impact),
    timestamp,
    isLive: Boolean(raw.isLive) || fallbackLive,
    minutesToEvent,
  };
}

function pickNextEvent(all: SidebarEconomicEvent[], now: number): SidebarEconomicEvent | null {
  if (!all.length) return null;
  const upcoming = all
    .filter((e) => e.timestamp >= now - 60 * 60_000)
    .sort((a, b) => a.timestamp - b.timestamp);
  if (!upcoming.length) return null;

  const highPriority = upcoming.find((e) => e.impact === "critical" || e.impact === "high");
  return highPriority || upcoming[0] || null;
}

function deriveRiskState(
  nextEvent: SidebarEconomicEvent | null,
  isHighVolumeActivity: boolean,
  isOverlap: boolean
): SidebarRiskState {
  if (nextEvent?.isLive) return "live";
  if (nextEvent && (nextEvent.impact === "high" || nextEvent.impact === "critical") && nextEvent.minutesToEvent <= 10 && nextEvent.minutesToEvent >= -10) {
    return "imminent";
  }
  if (nextEvent && (nextEvent.impact === "high" || nextEvent.impact === "critical") && nextEvent.minutesToEvent <= 30 && nextEvent.minutesToEvent >= -30) {
    return "watch";
  }
  if (isOverlap && isHighVolumeActivity) return "active";
  if (!isHighVolumeActivity) return "low";
  return "safe";
}

function recommendationForRisk(riskState: SidebarRiskState): string {
  switch (riskState) {
    case "live":
      return "Event live - avoid new entries";
    case "imminent":
    case "watch":
      return "High-impact event soon - reduce size";
    case "active":
      return "Active session - trade only edge levels";
    case "low":
      return "Low volatility - normal size";
    default:
      return "No major event soon";
  }
}

export function useSidebarSessionIntel(params: {
  activeSession?: TradingSession | null;
  isHighVolumeActivity: boolean;
  tradingHours: TradingHoursLike;
  enabled?: boolean;
}): SidebarSessionIntel {
  const { isHighVolumeActivity, tradingHours, enabled = true } = params;
  const [nextEvent, setNextEvent] = useState<SidebarEconomicEvent | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number>(Date.now());

  const fetchEvents = useCallback(async () => {
    if (!enabled) return;
    const now = Date.now();
    if (cachedEvents.length > 0 && now - lastFetchAt < CACHE_TTL_MS) {
      const normalized = cachedEvents.map((e) => normalizeEvent(e, now));
      setNextEvent(pickNextEvent(normalized, now));
      setUpdatedAt(now);
      return;
    }

    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 7_000);
    try {
      const res = await fetch(apiUrl("/api/calendar/events"), {
        cache: "no-store",
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`Calendar fetch failed: ${res.status}`);
      const json = await res.json();
      const rows = Array.isArray(json?.events) ? (json.events as CalendarApiEvent[]) : [];
      cachedEvents = rows;
      lastFetchAt = Date.now();

      const normalized = rows.map((e) => normalizeEvent(e, now));
      setNextEvent(pickNextEvent(normalized, now));
      setUpdatedAt(Date.now());
    } catch {
      // Keep previous cached events if fetch fails.
      if (cachedEvents.length > 0) {
        const normalized = cachedEvents.map((e) => normalizeEvent(e, now));
        setNextEvent(pickNextEvent(normalized, now));
      } else {
        setNextEvent(null);
      }
      setUpdatedAt(Date.now());
    } finally {
      clearTimeout(timeoutId);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    fetchEvents();
    const timer = setInterval(fetchEvents, POLL_MS);
    return () => clearInterval(timer);
  }, [fetchEvents, enabled]);

  const riskState = useMemo(
    () => deriveRiskState(nextEvent, isHighVolumeActivity, tradingHours.isOverlap),
    [nextEvent, isHighVolumeActivity, tradingHours.isOverlap]
  );

  return useMemo(
    () => ({
      sessionName: tradingHours.name,
      sessionShortName: tradingHours.shortName,
      isOverlap: tradingHours.isOverlap,
      overlapWith: tradingHours.overlapWith,
      nextEvent,
      riskState,
      recommendation: recommendationForRisk(riskState),
      updatedAt,
    }),
    [tradingHours.name, tradingHours.shortName, tradingHours.isOverlap, tradingHours.overlapWith, nextEvent, riskState, updatedAt]
  );
}

