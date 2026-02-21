import type { ActivityEventEnriched, FeeDriftRow, MovementMemoryRow, RouteMatrixRow } from "./types";

export type ActivityAIContextMode = "overview" | "route_health" | "fee_drift" | "memory_signal";

type BuildActivityAIContextOptions = {
  mode: ActivityAIContextMode;
  events: ActivityEventEnriched[];
  matrix: RouteMatrixRow[];
  feeDrift: FeeDriftRow[];
  memory: MovementMemoryRow[];
  range: { fromMs?: number; toMs?: number };
  filters: { source: string; activityType: string; query: string };
};

function compactNumber(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function buildActivityAIContext(options: BuildActivityAIContextOptions): Record<string, unknown> {
  const { mode, events, matrix, feeDrift, memory, range, filters } = options;
  const now = Date.now();
  const recent = events.filter((event) => now - event.timestamp <= 24 * 60 * 60 * 1000);

  const base = {
    mode,
    eventCount: events.length,
    movedUsd24h: compactNumber(recent.reduce((sum, event) => sum + Number(event.marketValueUsdAtEvent || 0), 0)),
    feeUsd24h: compactNumber(recent.reduce((sum, event) => sum + Number(event.feeUsd || 0), 0)),
    topRoutes: matrix.slice(0, 5).map((row) => ({
      route: row.routeKey,
      valueUsd: compactNumber(row.totalValueUsd),
      feeUsd: compactNumber(row.totalFeeUsd),
      avgFeeBps: compactNumber(row.avgFeeBps),
      count: row.count,
    })),
    range,
    filters,
  };

  if (mode === "route_health") {
    return {
      ...base,
      routes: matrix.slice(0, 8).map((row) => ({
        route: row.routeKey,
        count: row.count,
        valueUsd: compactNumber(row.totalValueUsd),
        feeUsd: compactNumber(row.totalFeeUsd),
        avgFeeBps: compactNumber(row.avgFeeBps),
        lastAt: row.lastAt,
      })),
    };
  }

  if (mode === "fee_drift") {
    return {
      ...base,
      feeDrift: feeDrift.slice(0, 8).map((row) => ({
        route: row.routeKey,
        currentFeeBps: compactNumber(row.currentFeeBps),
        baselineFeeBps: compactNumber(row.baselineFeeBps),
        driftBps: compactNumber(row.driftBps),
        sampleCurrent: row.sampleCurrent,
        sampleBaseline: row.sampleBaseline,
      })),
    };
  }

  if (mode === "memory_signal") {
    return {
      ...base,
      memory: memory.slice(0, 8).map((row) => ({
        route: row.routeKey,
        lastAt: row.lastAt,
        prevAt: row.prevAt,
        avgAmount: compactNumber(row.avgAmount),
        avgFeeUsd: compactNumber(row.avgFeeUsd),
        avgMarketPriceUsd: compactNumber(row.avgMarketPriceUsd || 0),
        sampleCount: row.sampleCount,
      })),
      recentRecurrence: events
        .filter((event) => (event.lastSimilarDeltaMinutes || 0) > 0 && (event.lastSimilarDeltaMinutes || 0) < 60)
        .slice(0, 6)
        .map((event) => ({
          route: event.routeKey,
          asset: event.asset,
          deltaMinutes: event.lastSimilarDeltaMinutes,
          amount: compactNumber(event.amount),
        })),
    };
  }

  return {
    ...base,
    anomalies: events
      .filter((event) => (event.feeUsd || 0) > 0 && (event.marketValueUsdAtEvent || 0) > 0)
      .map((event) => ({
        route: event.routeKey,
        feeBps: compactNumber(((event.feeUsd || 0) / Math.max(1, event.marketValueUsdAtEvent || 0)) * 10_000),
        confidence: event.valuationConfidence,
        timestamp: event.timestamp,
      }))
      .slice(0, 8),
  };
}
