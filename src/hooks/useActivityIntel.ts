"use client";

import { useEffect, useMemo, useRef } from "react";
import type { UnifiedActivity } from "@/lib/api/transactions";
import type { PortfolioConnection } from "@/lib/api/types";
import { buildAnomalySeed, buildFeeHeatmapData, buildKpiSummary, buildMovementMemory, buildRouteMatrix } from "@/lib/activity/aggregations";
import { enrichActivities } from "@/lib/activity/enrichment";
import type { ActivityIntelResult } from "@/lib/activity/types";

export const ACTIVITY_INTEL_SETTINGS_KEY = "activity_intel_settings_v1";
export const ACTIVITY_MEMORY_SUMMARY_KEY = "activity_movement_memory_v1";

export type ActivityIntelFilters = {
  activityType: "all" | "trades" | "transfers";
  source: string;
  query: string;
  fromMs?: number;
  toMs?: number;
};

type UseActivityIntelOptions = {
  activities: UnifiedActivity[];
  prices: Record<string, number>;
  connections: PortfolioConnection[];
  filters: ActivityIntelFilters;
  loading?: boolean;
};

function matchesType(
  tx: UnifiedActivity,
  filter: ActivityIntelFilters["activityType"]
): boolean {
  if (filter === "all") return true;
  const type = String((tx as any).type || "").toLowerCase();
  const side = String((tx as any).side || "").toLowerCase();
  const isTrade =
    tx.activityType === "trade" ||
    type === "buy" ||
    type === "sell" ||
    side === "buy" ||
    side === "sell" ||
    side === "long" ||
    side === "short";
  const isTransfer =
    tx.activityType === "transfer" ||
    tx.activityType === "internal" ||
    type.includes("deposit") ||
    type.includes("withdraw");
  return filter === "trades" ? isTrade : isTransfer;
}

function createEmptyResult(): ActivityIntelResult {
  return {
    events: [],
    matrix: [],
    memory: [],
    feeDrift: [],
    kpis: {
      movedUsd24h: 0,
      feesUsd24h: 0,
      topRoute: null,
      lastMovementAt: 0,
    },
    anomalySeed: {
      topRoutesByNotional: [],
      topFeeDriftRoutes: [],
      unusualHourMoves: [],
      recurrenceAnomalies: [],
      highConfidenceSamples: [],
    },
  };
}

export function useActivityIntel(options: UseActivityIntelOptions): ActivityIntelResult {
  const { activities, prices, connections, filters, loading } = options;
  const previousStableRef = useRef<ActivityIntelResult>(createEmptyResult());
  const persistHashRef = useRef<string>("");

  const baseEvents = useMemo(
    () => enrichActivities({ activities: activities || [], prices: prices || {}, connections: connections || [] }),
    [activities, prices, connections]
  );

  const filteredEvents = useMemo(() => {
    const query = (filters.query || "").trim().toLowerCase();
    return baseEvents.filter((event) => {
      if (!matchesType(event.raw, filters.activityType)) return false;
      if (filters.source && filters.source !== "all" && event.sourceLabel !== filters.source) return false;
      if (filters.fromMs != null && event.timestamp < filters.fromMs) return false;
      if (filters.toMs != null && event.timestamp > filters.toMs) return false;
      if (!query) return true;
      const haystack = [
        event.asset,
        event.id,
        event.txHash || "",
        event.address || "",
        event.fromLabel,
        event.toLabel,
        event.routeKey,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [baseEvents, filters]);

  const result = useMemo<ActivityIntelResult>(() => {
    const range = { fromMs: filters.fromMs, toMs: filters.toMs };
    const matrix = buildRouteMatrix(filteredEvents, range);
    const feeDrift = buildFeeHeatmapData(filteredEvents, range);
    const memory = buildMovementMemory(filteredEvents, range);
    const kpis = buildKpiSummary(filteredEvents, range);
    const anomalySeed = buildAnomalySeed(filteredEvents, matrix, feeDrift);
    return {
      events: filteredEvents,
      matrix,
      memory,
      feeDrift,
      kpis,
      anomalySeed,
    };
  }, [filteredEvents, filters.fromMs, filters.toMs]);

  const telemetry = useMemo(() => {
    const lowConfidence = result.events.filter((event) => event.valuationConfidence === "low").length;
    const missingMarketPrice = result.events.filter((event) => !event.marketPriceUsdAtEvent).length;
    return {
      updatedAt: Date.now(),
      rows: result.events.length,
      lowConfidence,
      missingMarketPrice,
      lowConfidenceRatio: result.events.length ? lowConfidence / result.events.length : 0,
    };
  }, [result.events]);

  useEffect(() => {
    if ((result.events.length > 0 || !loading) && !(loading && result.events.length === 0)) {
      previousStableRef.current = result;
    }
  }, [result, loading]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (loading) return;
    const summary = {
      updatedAt: Date.now(),
      rowCount: result.memory.length,
      top: result.memory.slice(0, 50),
    };
    const settings = {
      updatedAt: Date.now(),
      filters,
    };
    const hash = JSON.stringify({
      m: summary.rowCount,
      k: result.kpis.lastMovementAt,
      f: filters,
    });
    if (persistHashRef.current === hash) return;
    persistHashRef.current = hash;
    localStorage.setItem(ACTIVITY_MEMORY_SUMMARY_KEY, JSON.stringify(summary));
    localStorage.setItem(ACTIVITY_INTEL_SETTINGS_KEY, JSON.stringify(settings));
  }, [result.memory, result.kpis.lastMovementAt, filters, loading]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("activity_intel_telemetry_v1", JSON.stringify(telemetry));
  }, [telemetry]);

  if (loading && result.events.length === 0 && previousStableRef.current.events.length > 0) {
    return previousStableRef.current;
  }
  return result;
}
