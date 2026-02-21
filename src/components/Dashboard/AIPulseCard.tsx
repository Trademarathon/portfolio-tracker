"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import type { AIResponse } from "@/lib/ai-orchestrator/types";

export function AIPulseCard({
  title,
  badge = "AI-Pulse",
  response,
  loading,
  error,
  feature,
  className,
}: {
  title: string;
  badge?: string;
  response: AIResponse | null;
  loading?: boolean;
  error?: string | null;
  feature?: string;
  className?: string;
}) {
  const [feedbackState, setFeedbackState] = useState<"idle" | "sending" | "helpful" | "wrong" | "unsafe" | "error">("idle");
  const text = response?.content || "";
  const structured = response?.structured;
  const verdict = response?.signalMeta?.verdict || null;
  const severity = response?.signalMeta?.severity || null;
  const policyReasons = response?.signalMeta?.policy?.reasons || [];
  const confidencePct =
    typeof structured?.confidence === "number"
      ? Math.round(Math.min(1, Math.max(0, structured.confidence)) * 100)
      : null;
  const freshness =
    typeof structured?.expiresAt === "number"
      ? structured.expiresAt > Date.now()
        ? "Fresh"
        : "Stale"
      : null;
  const status = response?.contractStatus || null;
  const isBlocked = verdict === "block";
  const snapshotTs = response?.contextMeta?.snapshotTs;
  const asOfTime = snapshotTs
    ? new Date(snapshotTs).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const sourceIds = response?.contextMeta?.sourceIds || [];
  const sourcePreview =
    sourceIds.length > 0
      ? sourceIds.length <= 2
        ? sourceIds.join(", ")
        : `${sourceIds.slice(0, 2).join(", ")} +${sourceIds.length - 2}`
      : null;
  const displayText = loading
    ? "Generating insight…"
    : (isBlocked ? text || "Signal blocked by policy." : text) || error || "No insight yet.";

  const submitFeedback = useCallback(
    async (feedback: "helpful" | "wrong" | "unsafe") => {
      if (!response || loading || feedbackState === "sending") return;
      setFeedbackState("sending");
      try {
        const payload = {
          signalId: `${feature || title}:${response.createdAt}`,
          feature: feature || title,
          verdict: response.signalMeta?.verdict || "",
          severity: response.signalMeta?.severity || "",
          feedback,
          source: "ai-pulse-card",
          timestamp: Date.now(),
        };
        const res = await fetch("/api/ai/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("feedback failed");
        setFeedbackState(feedback);
      } catch {
        setFeedbackState("error");
      }
    },
    [response, loading, feedbackState, feature, title]
  );

  return (
    <div className={cn("rounded-2xl border border-white/10 bg-black/30 p-4 space-y-2", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-cyan-500/15 flex items-center justify-center text-cyan-300">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">{title}</div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-400">{badge}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {severity && (
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wide",
                severity === "info" && "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
                severity === "warning" && "border-amber-500/30 bg-amber-500/10 text-amber-300",
                severity === "critical" && "border-rose-500/30 bg-rose-500/10 text-rose-300"
              )}
              title="Risk severity"
            >
              {severity}
            </span>
          )}
          {verdict && (
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wide",
                verdict === "allow" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
                verdict === "warn" && "border-amber-500/30 bg-amber-500/10 text-amber-300",
                verdict === "block" && "border-rose-500/30 bg-rose-500/10 text-rose-300"
              )}
              title="Policy verdict"
            >
              {verdict}
            </span>
          )}
          {status && (
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wide",
                status === "validated" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
                status === "repaired" && "border-amber-500/30 bg-amber-500/10 text-amber-300",
                status === "fallback" && "border-rose-500/30 bg-rose-500/10 text-rose-300"
              )}
              title="Contract quality status"
            >
              {status}
            </span>
          )}
          {response?.cached && (
            <span className="text-[10px] text-zinc-500">Cached</span>
          )}
        </div>
      </div>
      <div className={cn(
        "text-[12px] leading-relaxed",
        loading ? "text-zinc-300 animate-pulse" : error && !text ? "text-amber-300" : "text-zinc-300"
      )}>
        {displayText}
      </div>
      {isBlocked && policyReasons.length > 0 && (
        <div className="rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[10px] text-rose-200">
          Why blocked: {policyReasons.map((reason) => reason.replace(/_/g, " ")).join(", ")}
        </div>
      )}
      {(confidencePct !== null || freshness || asOfTime || sourcePreview) && (
        <div className="flex items-center gap-2 text-[10px] text-zinc-400">
          {confidencePct !== null && (
            <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5">
              Confidence {confidencePct}%
            </span>
          )}
          {freshness && (
            <span
              className={cn(
                "rounded border px-1.5 py-0.5",
                freshness === "Fresh"
                  ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
              )}
            >
              {freshness}
            </span>
          )}
          {asOfTime && (
            <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5">
              As of {asOfTime}
            </span>
          )}
          {sourcePreview && (
            <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5">
              Src {sourcePreview}
            </span>
          )}
        </div>
      )}
      {!loading && response && (
        <div className="flex items-center gap-1.5 text-[10px]">
          <button
            type="button"
            onClick={() => void submitFeedback("helpful")}
            className={cn(
              "rounded border px-2 py-0.5",
              feedbackState === "helpful"
                ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-200"
                : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
            )}
          >
            Helpful
          </button>
          <button
            type="button"
            onClick={() => void submitFeedback("wrong")}
            className={cn(
              "rounded border px-2 py-0.5",
              feedbackState === "wrong"
                ? "border-amber-500/40 bg-amber-500/20 text-amber-200"
                : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
            )}
          >
            Wrong
          </button>
          <button
            type="button"
            onClick={() => void submitFeedback("unsafe")}
            className={cn(
              "rounded border px-2 py-0.5",
              feedbackState === "unsafe"
                ? "border-rose-500/40 bg-rose-500/20 text-rose-200"
                : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
            )}
          >
            Unsafe
          </button>
          {feedbackState === "sending" && <span className="text-zinc-500">Sending...</span>}
          {feedbackState === "error" && <span className="text-rose-300">Failed</span>}
        </div>
      )}
    </div>
  );
}
