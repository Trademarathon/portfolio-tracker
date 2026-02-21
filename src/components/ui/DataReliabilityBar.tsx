"use client";

import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import type { ConnectorReliabilitySummary } from "@/hooks/useConnectorReliability";

type DataReliabilityBarProps = {
  summary: ConnectorReliabilitySummary;
  title?: string;
  className?: string;
  onRetry?: () => void;
};

function tone(state: ConnectorReliabilitySummary["state"]) {
  if (state === "ready") {
    return {
      container: "border-emerald-500/25 bg-emerald-500/8",
      dot: "bg-emerald-400",
      text: "text-emerald-300",
      icon: CheckCircle2,
    };
  }
  if (state === "backfilling") {
    return {
      container: "border-sky-500/25 bg-sky-500/8",
      dot: "bg-sky-400",
      text: "text-sky-300",
      icon: Loader2,
    };
  }
  if (state === "degraded") {
    return {
      container: "border-amber-500/25 bg-amber-500/8",
      dot: "bg-amber-400",
      text: "text-amber-300",
      icon: AlertCircle,
    };
  }
  return {
    container: "border-rose-500/25 bg-rose-500/8",
    dot: "bg-rose-400",
    text: "text-rose-300",
    icon: AlertCircle,
  };
}

function relativeTime(ms?: number): string {
  if (!ms) return "never";
  const delta = Math.max(0, Date.now() - ms);
  if (delta < 1000) return "just now";
  if (delta < 60_000) return `${Math.floor(delta / 1000)}s ago`;
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  return `${Math.floor(delta / 3_600_000)}h ago`;
}

export function DataReliabilityBar({
  summary,
  title = "Data Reliability",
  className,
  onRetry,
}: DataReliabilityBarProps) {
  const theme = tone(summary.state);
  const Icon = theme.icon;
  const details = [
    `${summary.counts.ready} live`,
    `${summary.counts.degraded + summary.counts.backfilling} recovering`,
    `${summary.counts.down} down`,
  ];

  return (
    <div className={cn("rounded-xl border px-3 py-2", theme.container, className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn("h-2 w-2 rounded-full", theme.dot)} />
          <Icon className={cn("h-3.5 w-3.5", theme.text, summary.state === "backfilling" && "animate-spin")} />
          <span className="text-xs font-semibold text-zinc-100">{title}</span>
          <span className={cn("text-xs font-semibold", theme.text)}>{summary.label}</span>
          <span className="text-[11px] text-zinc-400 truncate">
            {details.join(" · ")} · last update {relativeTime(summary.lastUpdateMs)}
            {summary.usingSnapshot ? " · snapshot active" : ""}
          </span>
        </div>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-zinc-200 hover:bg-white/10"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        ) : null}
      </div>
      {summary.connectors.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {summary.connectors.map((connector) => (
            <span
              key={connector.id}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                connector.state === "ready" && "border-emerald-500/30 text-emerald-300 bg-emerald-500/10",
                connector.state === "degraded" && "border-amber-500/30 text-amber-300 bg-amber-500/10",
                connector.state === "backfilling" && "border-sky-500/30 text-sky-300 bg-sky-500/10",
                connector.state === "down" && "border-rose-500/30 text-rose-300 bg-rose-500/10"
              )}
              title={connector.error || connector.name}
            >
              {connector.name}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
