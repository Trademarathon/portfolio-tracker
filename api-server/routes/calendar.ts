import type { Request, Response } from "express";

interface TEEvent {
  CalendarId?: string;
  Date?: string;
  Country?: string;
  Category?: string;
  Event?: string;
  Actual?: string;
  Forecast?: string;
  Previous?: string;
  Importance?: number;
}

interface EconomicEvent {
  id: string;
  title: string;
  description: string;
  timestamp: number;
  category: string;
  impact: "low" | "medium" | "high" | "critical";
  country?: string;
  actual?: string;
  forecast?: string;
  previous?: string;
  cryptoRelevance?: string;
}

const CALENDAR_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const PAST_WINDOW_MS = 1000 * 60 * 60 * 3;
const FUTURE_WINDOW_MS = 1000 * 60 * 60 * 24 * 8;

let cachedEvents: EconomicEvent[] = [];
let cachedAt = 0;

function mapCategory(cat?: string, eventName?: string): string {
  const lower = `${cat || ""} ${eventName || ""}`.toLowerCase();
  if (lower.includes("interest") || lower.includes("fed") || lower.includes("rate")) return "fed";
  if (lower.includes("cpi") || lower.includes("inflation") || lower.includes("pce")) return "inflation";
  if (lower.includes("employ") || lower.includes("jobless") || lower.includes("payroll") || lower.includes("wage")) return "employment";
  if (lower.includes("gdp")) return "gdp";
  if (lower.includes("crypto") || lower.includes("bitcoin") || lower.includes("ethereum")) return "crypto";
  return "other";
}

function mapImpact(imp?: number): "low" | "medium" | "high" | "critical" {
  const value = Number.isFinite(imp) ? Number(imp) : 0;
  if (value >= 3) return "critical";
  if (value === 2) return "high";
  if (value === 1) return "medium";
  return "low";
}

function parseEventTimestamp(input?: string): number | null {
  if (!input) return null;
  const timestamp = Date.parse(input);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function mapCountryCode(country?: string): string | undefined {
  if (!country) return undefined;
  const normalized = country.trim();
  if (!normalized) return undefined;
  if (/^[A-Z]{2}$/.test(normalized)) return normalized;

  const m: Record<string, string> = {
    "United States": "US",
    "United Kingdom": "UK",
    "Euro Area": "EU",
    "Germany": "DE",
    "France": "FR",
    "Japan": "JP",
    "China": "CN",
    "Australia": "AU",
    "Canada": "CA",
    "India": "IN",
    "Brazil": "BR",
  };
  return m[normalized] || normalized.slice(0, 2).toUpperCase();
}

function formatDateUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeEvents(raw: TEEvent[], nowMs: number): EconomicEvent[] {
  const minTs = nowMs - PAST_WINDOW_MS;
  const maxTs = nowMs + FUTURE_WINDOW_MS;
  const dedupe = new Set<string>();
  const out: EconomicEvent[] = [];

  for (const e of raw) {
    const title = e.Event?.trim();
    if (!title) continue;
    const timestamp = parseEventTimestamp(e.Date);
    if (timestamp == null || timestamp < minTs || timestamp > maxTs) continue;

    const country = mapCountryCode(e.Country);
    const id = (e.CalendarId && e.CalendarId.trim()) || `${title}-${timestamp}`;
    const dedupeKey = `${id}:${timestamp}`;
    if (dedupe.has(dedupeKey)) continue;
    dedupe.add(dedupeKey);

    out.push({
      id,
      title,
      description: e.Category?.trim() || title,
      timestamp,
      category: mapCategory(e.Category, title),
      impact: mapImpact(e.Importance),
      country,
      actual: e.Actual?.trim() || undefined,
      forecast: e.Forecast?.trim() || undefined,
      previous: e.Previous?.trim() || undefined,
      cryptoRelevance: country && ["US", "EU", "JP"].includes(country)
        ? "Major macro event. Expect crypto beta spillover."
        : undefined,
    });
  }

  return out.sort((a, b) => a.timestamp - b.timestamp);
}

function getFreshCache(nowMs: number): EconomicEvent[] {
  if (!cachedEvents.length) return [];
  if (nowMs - cachedAt > CALENDAR_CACHE_TTL_MS) return [];
  return cachedEvents;
}

function sendCachedOrEmpty(res: Response, nowMs: number, reason: string) {
  const fallback = getFreshCache(nowMs);
  if (fallback.length) {
    return res.json({
      success: true,
      stale: true,
      source: "cache",
      reason,
      events: fallback,
      lastUpdated: cachedAt,
    });
  }

  return res.json({
    success: false,
    stale: true,
    source: "unavailable",
    reason,
    events: [],
    lastUpdated: nowMs,
  });
}

export async function calendarHandler(_req: Request, res: Response) {
  try {
    const nowMs = Date.now();
    const fromDate = new Date(nowMs - 1000 * 60 * 60 * 24);
    const toDate = new Date(nowMs + 1000 * 60 * 60 * 24 * 7);

    const from = formatDateUtc(fromDate);
    const to = formatDateUtc(toDate);
    const url = `https://api.tradingeconomics.com/calendar/country/All/${from}/${to}?c=guest:guest&importance=1,2,3&f=json`;

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 9000);

    let fetchRes: globalThis.Response;
    try {
      fetchRes = await fetch(url, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: abortController.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!fetchRes.ok) {
      return sendCachedOrEmpty(res, nowMs, `upstream-${fetchRes.status}`);
    }

    const raw = await fetchRes.json();
    if (!Array.isArray(raw)) {
      return sendCachedOrEmpty(res, nowMs, "invalid-payload");
    }

    const events = normalizeEvents(raw as TEEvent[], nowMs);
    if (!events.length) {
      return sendCachedOrEmpty(res, nowMs, "no-upcoming-events");
    }

    cachedEvents = events;
    cachedAt = nowMs;

    return res.json({
      success: true,
      stale: false,
      source: "tradingeconomics",
      events,
      lastUpdated: nowMs,
    });
  } catch (error) {
    console.error("[Calendar API]", error);
    return sendCachedOrEmpty(res, Date.now(), "fetch-error");
  }
}
