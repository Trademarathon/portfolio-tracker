import { NextResponse } from "next/server";
import {
  executeAIChat,
  resolveAICredentialsFromHeaders,
} from "@/lib/server/ai-gateway";

type CalendarEvent = {
  id: string;
  title: string;
  timestamp: number;
  impact: "critical" | "high" | "medium" | "low";
  category: "crypto" | "macro";
  country?: string;
  isLive?: boolean;
  source: "openai" | "gemini" | "ollama";
};

const CACHE_TTL_MS = 90_000;
let cache: { ts: number; events: CalendarEvent[] } | null = null;

function extractJsonPayload(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return [];
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "");
    try {
      return JSON.parse(fenced);
    } catch {
      const arrayMatch = fenced.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        try {
          return JSON.parse(arrayMatch[0]);
        } catch {
          return [];
        }
      }
      return [];
    }
  }
}

function parseEvents(
  raw: unknown,
  source: "openai" | "gemini" | "ollama"
): CalendarEvent[] {
  const input =
    raw && typeof raw === "object" && Array.isArray((raw as { events?: unknown }).events)
      ? (raw as { events: unknown[] }).events
      : raw;
  if (!Array.isArray(input)) return [];
  const now = Date.now();
  return input
    .map((e) => ({
      id: String(e.id || `${e.title}-${e.timestamp}`),
      title: String(e.title || "Event"),
      timestamp: Number(e.timestamp || 0),
      impact: (String(e.impact || "medium").toLowerCase() as CalendarEvent["impact"]) || "medium",
      category: (String(e.category || "crypto").toLowerCase() as CalendarEvent["category"]) || "crypto",
      country: e.country ? String(e.country) : undefined,
      isLive: Boolean(e.isLive),
      source,
    }))
    .filter((e) => Number.isFinite(e.timestamp) && e.timestamp > now - 6 * 60 * 60 * 1000)
    .sort((a, b) => a.timestamp - b.timestamp);
}

export async function POST(req: Request) {
  const creds = resolveAICredentialsFromHeaders((name) => req.headers.get(name));

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

  try {
    const aiResult = await executeAIChat(
      {
        provider: "auto",
        temperature: 0.2,
        maxTokens: 700,
        jsonMode: true,
        messages: [{ role: "user", content: system }],
      },
      creds
    );
    if (!aiResult.ok) {
      if (cache) {
        return NextResponse.json(
          {
            events: cache.events,
            stale: true,
            lastUpdated: cache.ts,
            error: aiResult.error,
          },
          { status: 200 }
        );
      }
      return NextResponse.json(
        { events: [], stale: true, lastUpdated: Date.now(), error: aiResult.error },
        { status: 200 }
      );
    }

    const parsed = parseEvents(extractJsonPayload(aiResult.content), aiResult.provider);
    cache = { ts: Date.now(), events: parsed };
    return NextResponse.json({ events: parsed, stale: false, lastUpdated: cache.ts }, { status: 200 });
  } catch (error) {
    if (cache) {
      return NextResponse.json(
        {
          events: cache.events,
          stale: true,
          lastUpdated: cache.ts,
          error: error instanceof Error ? error.message : "AI calendar failed",
        },
        { status: 200 }
      );
    }
    return NextResponse.json(
      {
        events: [],
        stale: true,
        lastUpdated: Date.now(),
        error: error instanceof Error ? error.message : "AI calendar failed",
      },
      { status: 200 }
    );
  }
}
