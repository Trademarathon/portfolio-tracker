"use client";

import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import type { AIResponse } from "@/lib/ai-orchestrator/types";

export function AIPulseCard({
  title,
  badge = "AI-Pulse",
  response,
  loading,
  className,
}: {
  title: string;
  badge?: string;
  response: AIResponse | null;
  loading?: boolean;
  className?: string;
}) {
  const text = response?.content || "";
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
        {response?.cached && (
          <span className="text-[10px] text-zinc-500">Cached</span>
        )}
      </div>
      <div className={cn("text-[12px] leading-relaxed text-zinc-300", loading && "animate-pulse")}>
        {loading ? "Generating insight…" : text || "No insight yet."}
      </div>
    </div>
  );
}
