import { NextResponse } from "next/server";

type CalendarEvent = {
  id: string;
  title: string;
  timestamp: number;
  impact: "critical" | "high" | "medium" | "low";
  category: "crypto" | "macro";
  country?: string;
  isLive?: boolean;
  source: "gemini";
};

const CACHE_TTL_MS = 90_000;
let cache: { ts: number; events: CalendarEvent[] } | null = null;

function parseEvents(raw: unknown): CalendarEvent[] {
  if (!Array.isArray(raw)) return [];
  const now = Date.now();
  return raw
    .map((e) => ({
      id: String(e.id || `${e.title}-${e.timestamp}`),
      title: String(e.title || "Event"),
      timestamp: Number(e.timestamp || 0),
      impact: (String(e.impact || "medium").toLowerCase() as CalendarEvent["impact"]) || "medium",
      category: (String(e.category || "crypto").toLowerCase() as CalendarEvent["category"]) || "crypto",
      country: e.country ? String(e.country) : undefined,
      isLive: Boolean(e.isLive),
      source: "gemini" as const,
    }))
    .filter((e) => Number.isFinite(e.timestamp) && e.timestamp > now - 6 * 60 * 60 * 1000)
    .sort((a, b) => a.timestamp - b.timestamp);
}

export async function POST(req: Request) {
  const headers = req.headers;
  const geminiKey = headers.get("x-gemini-api-key") || "";
  if (!geminiKey) {
    return NextResponse.json({ events: [], stale: true, error: "Missing Gemini API key" }, { status: 200 });
  }

  const { horizonHours = 48, maxItems = 12 } = (await req.json().catch(() => ({}))) as {
    horizonHours?: number;
    maxItems?: number;
  };

  const now = Date.now();
  if (cache && now - cache.ts < CACHE_TTL_MS) {
    return NextResponse.json({ events: cache.events, stale: false, lastUpdated: cache.ts }, { status: 200 });
  }

  const system = [
    "You are an economic calendar generator focused on crypto markets.",
    "Return JSON array only. No markdown.",
    "Include crypto events (token unlocks, network upgrades, ETF/treasury flows, major launches).",
    "Include only major macro events: FOMC, CPI, NFP, rate decisions.",
    "Each item: {id,title,timestamp,impact,category,country?,isLive?}.",
    "timestamp is epoch milliseconds for the event time.",
    `Horizon: next ${horizonHours} hours. Max ${maxItems} items.`,
  ].join("\n");

  const body = {
    contents: [
      { role: "user", parts: [{ text: system }] },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 512,
      responseMimeType: "application/json",
    },
  };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${geminiKey}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    );
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();
    const text =
      json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") ||
      "[]";
    const parsed = parseEvents(JSON.parse(text));
    cache = { ts: Date.now(), events: parsed };
    return NextResponse.json({ events: parsed, stale: false, lastUpdated: cache.ts }, { status: 200 });
  } catch {
    if (cache) {
      return NextResponse.json({ events: cache.events, stale: true, lastUpdated: cache.ts }, { status: 200 });
    }
    return NextResponse.json({ events: [], stale: true, lastUpdated: Date.now() }, { status: 200 });
  }
}
