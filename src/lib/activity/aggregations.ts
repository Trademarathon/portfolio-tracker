import type {
  ActivityAnomalySeed,
  ActivityEventEnriched,
  ActivityKpiSummary,
  FeeDriftRow,
  MovementMemoryRow,
  RouteMatrixRow,
} from "./types";

type RangeOptions = {
  fromMs?: number;
  toMs?: number;
};

function inRange(ts: number, range?: RangeOptions): boolean {
  if (!range) return true;
  if (range.fromMs != null && ts < range.fromMs) return false;
  if (range.toMs != null && ts > range.toMs) return false;
  return true;
}

function toFeeBps(feeUsd: number, notionalUsd: number): number {
  if (!(notionalUsd > 0) || !(feeUsd > 0)) return 0;
  return (feeUsd / notionalUsd) * 10_000;
}

export function buildRouteMatrix(events: ActivityEventEnriched[], range?: RangeOptions): RouteMatrixRow[] {
  const grouped = new Map<string, RouteMatrixRow>();
  for (const event of events) {
    if (!inRange(event.timestamp, range)) continue;
    const key = event.routeKey;
    const notional = Number(event.marketValueUsdAtEvent || 0);
    const feeUsd = Number(event.feeUsd || 0);
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, {
        routeKey: key,
        fromLabel: event.fromLabel,
        toLabel: event.toLabel,
        asset: event.asset,
        count: 1,
        totalAmount: event.amount,
        totalValueUsd: notional,
        totalFeeUsd: feeUsd,
        avgFeeBps: toFeeBps(feeUsd, notional),
        lastAt: event.timestamp,
      });
      continue;
    }
    current.count += 1;
    current.totalAmount += event.amount;
    current.totalValueUsd += notional;
    current.totalFeeUsd += feeUsd;
    current.avgFeeBps = toFeeBps(current.totalFeeUsd, current.totalValueUsd);
    current.lastAt = Math.max(current.lastAt, event.timestamp);
  }

  return Array.from(grouped.values()).sort((a, b) => b.totalValueUsd - a.totalValueUsd);
}

export function buildMovementMemory(events: ActivityEventEnriched[], range?: RangeOptions): MovementMemoryRow[] {
  const grouped = new Map<string, { routeKey: string; timestamps: number[]; amounts: number[]; fees: number[]; prices: number[] }>();
  for (const event of events) {
    if (!inRange(event.timestamp, range)) continue;
    const key = event.routeKey;
    if (!grouped.has(key)) {
      grouped.set(key, { routeKey: key, timestamps: [], amounts: [], fees: [], prices: [] });
    }
    const bucket = grouped.get(key)!;
    bucket.timestamps.push(event.timestamp);
    bucket.amounts.push(event.amount);
    bucket.fees.push(Number(event.feeUsd || 0));
    if (event.marketPriceUsdAtEvent) bucket.prices.push(event.marketPriceUsdAtEvent);
  }

  return Array.from(grouped.values())
    .map((group) => {
      const times = [...group.timestamps].sort((a, b) => b - a);
      const avgAmount = group.amounts.reduce((sum, item) => sum + item, 0) / Math.max(1, group.amounts.length);
      const avgFeeUsd = group.fees.reduce((sum, item) => sum + item, 0) / Math.max(1, group.fees.length);
      const avgMarketPriceUsd =
        group.prices.length > 0 ? group.prices.reduce((sum, item) => sum + item, 0) / group.prices.length : undefined;
      return {
        routeKey: group.routeKey as MovementMemoryRow["routeKey"],
        lastAt: times[0] || 0,
        prevAt: times[1],
        avgAmount,
        avgFeeUsd,
        avgMarketPriceUsd,
        sampleCount: group.timestamps.length,
      };
    })
    .sort((a, b) => b.lastAt - a.lastAt);
}

export function buildKpiSummary(events: ActivityEventEnriched[], range?: RangeOptions): ActivityKpiSummary {
  const now = Date.now();
  const from = range?.fromMs ?? now - 24 * 60 * 60 * 1000;
  const to = range?.toMs ?? now;
  const inWindow = events.filter((event) => event.timestamp >= from && event.timestamp <= to);
  const movedUsd24h = inWindow.reduce((sum, event) => sum + Number(event.marketValueUsdAtEvent || 0), 0);
  const feesUsd24h = inWindow.reduce((sum, event) => sum + Number(event.feeUsd || 0), 0);
  const topRoute = buildRouteMatrix(inWindow)[0] || null;
  const lastMovementAt = inWindow.reduce((max, event) => Math.max(max, event.timestamp), 0);
  return { movedUsd24h, feesUsd24h, topRoute, lastMovementAt };
}

export function buildFeeHeatmapData(events: ActivityEventEnriched[], range?: RangeOptions): FeeDriftRow[] {
  if (!events.length) return [];
  const now = Date.now();
  const rangeFrom = range?.fromMs ?? now - 7 * 24 * 60 * 60 * 1000;
  const rangeTo = range?.toMs ?? now;
  const baselineFrom = rangeFrom - (rangeTo - rangeFrom);
  const baselineTo = rangeFrom;

  const aggregate = (fromMs: number, toMs: number) => {
    const map = new Map<string, { feeUsd: number; notionalUsd: number; sample: number; from: string; to: string; asset: string }>();
    events.forEach((event) => {
      if (event.timestamp < fromMs || event.timestamp > toMs) return;
      const key = event.routeKey;
      if (!map.has(key)) {
        map.set(key, {
          feeUsd: 0,
          notionalUsd: 0,
          sample: 0,
          from: event.fromLabel,
          to: event.toLabel,
          asset: event.asset,
        });
      }
      const row = map.get(key)!;
      row.feeUsd += Number(event.feeUsd || 0);
      row.notionalUsd += Number(event.marketValueUsdAtEvent || 0);
      row.sample += 1;
    });
    return map;
  };

  const currentAgg = aggregate(rangeFrom, rangeTo);
  const baselineAgg = aggregate(baselineFrom, baselineTo);

  return Array.from(currentAgg.entries())
    .map(([routeKey, current]) => {
      const baseline = baselineAgg.get(routeKey);
      const currentFeeBps = toFeeBps(current.feeUsd, current.notionalUsd);
      const baselineFeeBps = baseline ? toFeeBps(baseline.feeUsd, baseline.notionalUsd) : 0;
      return {
        routeKey: routeKey as FeeDriftRow["routeKey"],
        asset: current.asset,
        fromLabel: current.from,
        toLabel: current.to,
        currentFeeBps,
        baselineFeeBps,
        driftBps: currentFeeBps - baselineFeeBps,
        sampleCurrent: current.sample,
        sampleBaseline: baseline?.sample || 0,
      };
    })
    .sort((a, b) => Math.abs(b.driftBps) - Math.abs(a.driftBps));
}

export function buildAnomalySeed(
  events: ActivityEventEnriched[],
  matrix: RouteMatrixRow[],
  feeDrift: FeeDriftRow[]
): ActivityAnomalySeed {
  const hourRouteCount = new Map<string, { hourUtc: number; count: number; routeKey: ActivityEventEnriched["routeKey"]; asset: string }>();
  const recurrence = new Array<{ routeKey: ActivityEventEnriched["routeKey"]; deltaMinutes: number; asset: string }>();
  const samples = new Array<{
    routeKey: ActivityEventEnriched["routeKey"];
    asset: string;
    amount: number;
    marketValueUsdAtEvent?: number;
    feeUsd?: number;
    timestamp: number;
  }>();

  for (const event of events) {
    const date = new Date(event.timestamp);
    const hourUtc = date.getUTCHours();
    const hourKey = `${hourUtc}-${event.routeKey}`;
    if (!hourRouteCount.has(hourKey)) {
      hourRouteCount.set(hourKey, { hourUtc, count: 0, routeKey: event.routeKey, asset: event.asset });
    }
    hourRouteCount.get(hourKey)!.count += 1;

    if ((event.lastSimilarDeltaMinutes || 0) > 0 && (event.lastSimilarDeltaMinutes || 0) < 60) {
      recurrence.push({
        routeKey: event.routeKey,
        deltaMinutes: event.lastSimilarDeltaMinutes || 0,
        asset: event.asset,
      });
    }

    if (event.valuationConfidence === "high") {
      samples.push({
        routeKey: event.routeKey,
        asset: event.asset,
        amount: event.amount,
        marketValueUsdAtEvent: event.marketValueUsdAtEvent,
        feeUsd: event.feeUsd,
        timestamp: event.timestamp,
      });
    }
  }

  const unusualHourMoves = Array.from(hourRouteCount.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    topRoutesByNotional: matrix.slice(0, 5),
    topFeeDriftRoutes: feeDrift.slice(0, 5),
    unusualHourMoves,
    recurrenceAnomalies: recurrence.slice(0, 8),
    highConfidenceSamples: samples.slice(0, 8),
  };
}
