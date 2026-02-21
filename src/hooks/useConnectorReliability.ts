"use client";

import { useMemo } from "react";
import type { PortfolioConnection } from "@/lib/api/types";
import type { WebSocketConnectionInfo } from "@/lib/api/websocket-types";

export type ConnectorReliabilityState = "ready" | "degraded" | "backfilling" | "down";

export type ConnectorHealth = {
  id: string;
  name: string;
  type: string;
  state: ConnectorReliabilityState;
  lastUpdateMs?: number;
  error?: string;
};

export type ConnectorReliabilitySummary = {
  state: ConnectorReliabilityState;
  label: string;
  counts: {
    total: number;
    ready: number;
    degraded: number;
    backfilling: number;
    down: number;
  };
  lastUpdateMs?: number;
  usingSnapshot: boolean;
  connectors: ConnectorHealth[];
};

type ReliabilityInput = {
  connections: PortfolioConnection[];
  wsConnectionStatus?: Map<string, WebSocketConnectionInfo>;
  connectionErrors?: Record<string, string>;
  loading?: boolean;
  dataPoints?: number;
  usingSnapshot?: boolean;
};

function toMillis(input: unknown): number | undefined {
  if (!input) return undefined;
  if (typeof input === "number") return Number.isFinite(input) ? input : undefined;
  const date = new Date(String(input));
  const value = date.getTime();
  return Number.isFinite(value) ? value : undefined;
}

function getConnectorState({
  hasError,
  wsStatus,
  loading,
  hasData,
}: {
  hasError: boolean;
  wsStatus?: string;
  loading: boolean;
  hasData: boolean;
}): ConnectorReliabilityState {
  const isConnected = wsStatus === "connected";
  const isConnecting = wsStatus === "connecting" || wsStatus === "reconnecting";

  if (hasError && !isConnected) return "down";
  if (isConnected && !hasError) return "ready";
  if (isConnecting || (loading && !hasData)) return "backfilling";
  if (hasError || !isConnected) return hasData ? "degraded" : "down";
  return "degraded";
}

function labelForState(state: ConnectorReliabilityState): string {
  if (state === "ready") return "Live";
  if (state === "degraded") return "Degraded";
  if (state === "backfilling") return "Backfilling";
  return "Down";
}

export function useConnectorReliability(input: ReliabilityInput): ConnectorReliabilitySummary {
  const {
    connections,
    wsConnectionStatus,
    connectionErrors,
    loading = false,
    dataPoints = 0,
    usingSnapshot = false,
  } = input;

  return useMemo(() => {
    const enabled = (connections || []).filter((connection) => connection.enabled !== false);
    const hasData = dataPoints > 0;

    const connectors: ConnectorHealth[] = enabled.map((connection) => {
      const ws = wsConnectionStatus?.get(connection.id);
      const error = connectionErrors?.[connection.id] || ws?.error;
      const lastUpdateMs =
        toMillis(ws?.lastUpdate) ??
        toMillis(connection.lastFetchTime) ??
        undefined;
      const state = getConnectorState({
        hasError: Boolean(error),
        wsStatus: ws?.status,
        loading,
        hasData,
      });

      return {
        id: connection.id,
        name: connection.displayName || connection.name || connection.id,
        type: connection.type,
        state,
        lastUpdateMs,
        error: error || undefined,
      };
    });

    const counts = {
      total: connectors.length,
      ready: connectors.filter((item) => item.state === "ready").length,
      degraded: connectors.filter((item) => item.state === "degraded").length,
      backfilling: connectors.filter((item) => item.state === "backfilling").length,
      down: connectors.filter((item) => item.state === "down").length,
    };

    const lastUpdateMs = connectors.reduce<number | undefined>((latest, item) => {
      if (!item.lastUpdateMs) return latest;
      if (!latest) return item.lastUpdateMs;
      return Math.max(latest, item.lastUpdateMs);
    }, undefined);

    let state: ConnectorReliabilityState = "ready";
    if (counts.total === 0) {
      state = hasData ? "ready" : "down";
    } else if ((loading && !hasData) || (usingSnapshot && !hasData)) {
      state = "backfilling";
    } else if (counts.down === counts.total && !hasData) {
      state = "down";
    } else if (counts.degraded > 0 || counts.down > 0 || usingSnapshot) {
      state = "degraded";
    } else if (counts.backfilling > 0 && !hasData) {
      state = "backfilling";
    } else {
      state = "ready";
    }

    return {
      state,
      label: labelForState(state),
      counts,
      lastUpdateMs,
      usingSnapshot,
      connectors,
    };
  }, [connections, wsConnectionStatus, connectionErrors, loading, dataPoints, usingSnapshot]);
}

type ScreenerReliabilityInput = {
  connectionStatus: Record<string, boolean>;
  totalRows: number;
  liveRows: number;
  loading?: boolean;
  usingSnapshot?: boolean;
  lastUpdateMs?: number;
};

export function buildScreenerReliability(input: ScreenerReliabilityInput): ConnectorReliabilitySummary {
  const {
    connectionStatus,
    totalRows,
    liveRows,
    loading = false,
    usingSnapshot = false,
    lastUpdateMs,
  } = input;
  const names = Object.keys(connectionStatus || {});
  const connectors: ConnectorHealth[] = names.map((name) => {
    const connected = Boolean(connectionStatus[name]);
    const state: ConnectorReliabilityState = connected
      ? "ready"
      : liveRows > 0
        ? "degraded"
        : loading
          ? "backfilling"
          : "down";
    return {
      id: name,
      name: name.toUpperCase(),
      type: "exchange",
      state,
      lastUpdateMs,
      error: connected ? undefined : "No live stream",
    };
  });

  const counts = {
    total: connectors.length,
    ready: connectors.filter((item) => item.state === "ready").length,
    degraded: connectors.filter((item) => item.state === "degraded").length,
    backfilling: connectors.filter((item) => item.state === "backfilling").length,
    down: connectors.filter((item) => item.state === "down").length,
  };

  let state: ConnectorReliabilityState = "ready";
  if (counts.total === 0 || (counts.down === counts.total && liveRows === 0)) {
    state = loading ? "backfilling" : "down";
  } else if ((loading && liveRows === 0) || usingSnapshot) {
    state = "backfilling";
  } else if (counts.down > 0 || counts.degraded > 0 || liveRows < Math.max(5, Math.floor(totalRows * 0.25))) {
    state = "degraded";
  }

  return {
    state,
    label: labelForState(state),
    counts,
    lastUpdateMs,
    usingSnapshot,
    connectors,
  };
}
