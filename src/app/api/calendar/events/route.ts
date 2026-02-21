import { NextResponse } from "next/server";

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

interface CalendarEvent {
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
}

const CALENDAR_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const PAST_WINDOW_MS = 1000 * 60 * 60 * 3;
const FUTURE_WINDOW_MS = 1000 * 60 * 60 * 24 * 8;

let cachedEvents: CalendarEvent[] = [];
let cachedAt = 0;

function mapImpact(value?: number): "low" | "medium" | "high" | "critical" {
  const importance = Number.isFinite(value) ? Number(value) : 0;
  if (importance >= 3) return "critical";
  if (importance === 2) return "high";
  if (importance === 1) return "medium";
  return "low";
}

function mapCategory(category?: string, eventName?: string): string {
  const lower = `${category || ""} ${eventName || ""}`.toLowerCase();
  if (lower.includes("interest") || lower.includes("fed") || lower.includes("rate")) return "fed";
  if (lower.includes("cpi") || lower.includes("inflation") || lower.includes("pce")) return "inflation";
  if (lower.includes("employ") || lower.includes("jobless") || lower.includes("payroll") || lower.includes("wage")) return "employment";
  if (lower.includes("gdp")) return "gdp";
  if (lower.includes("crypto") || lower.includes("bitcoin") || lower.includes("ethereum")) return "crypto";
  return "other";
}

function mapCountryCode(country?: string): string | undefined {
  if (!country) return undefined;
  const normalized = country.trim();
  if (!normalized) return undefined;
  if (/^[A-Z]{2}$/.test(normalized)) return normalized;

  const map: Record<string, string> = {
    "United States": "US",
    "United Kingdom": "UK",
    "Euro Area": "EU",
    Germany: "DE",
    France: "FR",
    Japan: "JP",
    China: "CN",
    Australia: "AU",
    Canada: "CA",
    India: "IN",
    Brazil: "BR",
  };
  return map[normalized] || normalized.slice(0, 2).toUpperCase();
}

function parseTimestamp(input?: string): number | null {
  if (!input) return null;
  const ts = Date.parse(input);
  return Number.isFinite(ts) ? ts : null;
}

function formatDateUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeEvents(raw: TEEvent[], nowMs: number): CalendarEvent[] {
  const minTs = nowMs - PAST_WINDOW_MS;
  const maxTs = nowMs + FUTURE_WINDOW_MS;
  const dedupe = new Set<string>();
  const events: CalendarEvent[] = [];

  for (const event of raw) {
    const title = event.Event?.trim();
    if (!title) continue;
    const timestamp = parseTimestamp(event.Date);
    if (timestamp == null || timestamp < minTs || timestamp > maxTs) continue;

    const id = (event.CalendarId && event.CalendarId.trim()) || `${title}-${timestamp}`;
    const dedupeKey = `${id}:${timestamp}`;
    if (dedupe.has(dedupeKey)) continue;
    dedupe.add(dedupeKey);

    events.push({
      id,
      title,
      description: event.Category?.trim() || title,
      timestamp,
      category: mapCategory(event.Category, title),
      impact: mapImpact(event.Importance),
      country: mapCountryCode(event.Country),
      actual: event.Actual?.trim() || undefined,
      forecast: event.Forecast?.trim() || undefined,
      previous: event.Previous?.trim() || undefined,
    });
  }

  return events.sort((a, b) => a.timestamp - b.timestamp);
}

function buildCachedOrUnavailable(nowMs: number, reason: string) {
  if (cachedEvents.length > 0 && nowMs - cachedAt <= CALENDAR_CACHE_TTL_MS) {
    return {
      success: true,
      stale: true,
      source: "cache",
      reason,
      events: cachedEvents,
      lastUpdated: cachedAt,
    };
  }

  return {
    success: false,
    stale: true,
    source: "unavailable",
    reason,
    events: [] as CalendarEvent[],
    lastUpdated: nowMs,
  };
}

export async function GET() {
  const nowMs = Date.now();

  try {
    const from = formatDateUtc(new Date(nowMs - 1000 * 60 * 60 * 24));
    const to = formatDateUtc(new Date(nowMs + 1000 * 60 * 60 * 24 * 7));
    const url = `https://api.tradingeconomics.com/calendar/country/All/${from}/${to}?c=guest:guest&importance=1,2,3&f=json`;

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 9000);
    let response: globalThis.Response;

    try {
      response = await fetch(url, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: abortController.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return NextResponse.json(buildCachedOrUnavailable(nowMs, `upstream-${response.status}`), { status: 200 });
    }

    const payload = await response.json();
    if (!Array.isArray(payload)) {
      return NextResponse.json(buildCachedOrUnavailable(nowMs, "invalid-payload"), { status: 200 });
    }

    const events = normalizeEvents(payload as TEEvent[], nowMs);
    if (!events.length) {
      return NextResponse.json(buildCachedOrUnavailable(nowMs, "no-upcoming-events"), { status: 200 });
    }

    cachedEvents = events;
    cachedAt = nowMs;

    return NextResponse.json({
      success: true,
      stale: false,
      source: "tradingeconomics",
      events,
      lastUpdated: nowMs,
    });
  } catch (error) {
    console.error("[Next Calendar Route]", error);
    return NextResponse.json(buildCachedOrUnavailable(nowMs, "fetch-error"), { status: 200 });
  }
}

