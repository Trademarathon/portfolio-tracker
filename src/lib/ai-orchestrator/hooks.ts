"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AIRequest, AIResponse, AIFeature } from "./types";
import { runAIRequest, runAIStreamRequest, isFeatureEnabled } from "./orchestrator";

const FAILED_REQUEST_COOLDOWN_MS = 15_000;

const safeStringify = (value: unknown) => {
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
};

export function useAIInsight(
  feature: AIFeature,
  context: Record<string, unknown>,
  _deps: unknown[] = [],
  enabled = true,
  options?: { stream?: boolean }
): { data: AIResponse | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<AIResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef<Promise<AIResponse> | null>(null);
  const lastKeyRef = useRef<string | null>(null);
  const lastFailureRef = useRef<{ key: string; at: number } | null>(null);
  const contextRef = useRef(context);

  const contextKey = useMemo(() => safeStringify(context), [context]);
  contextRef.current = context;

  useEffect(() => {
    if (!enabled || !isFeatureEnabled(feature)) return;
    if (inflight.current) return;
    if (lastKeyRef.current === contextKey) return;
    if (lastFailureRef.current?.key === contextKey) {
      const age = Date.now() - lastFailureRef.current.at;
      if (age < FAILED_REQUEST_COOLDOWN_MS) return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    const request: AIRequest = { feature, context: contextRef.current };
    const task: Promise<AIResponse> = (options?.stream
      ? runAIStreamRequest(request, (chunk) => {
          if (cancelled) return;
          setData((prev) => ({
            content: (prev?.content || "") + chunk,
            provider: prev?.provider || "gemini",
            model: prev?.model || "stream",
            cached: false,
            createdAt: prev?.createdAt || Date.now(),
          }));
        })
      : runAIRequest(request));
    inflight.current = task;
    task
      .then((res) => {
        if (cancelled) return;
        lastFailureRef.current = null;
        lastKeyRef.current = contextKey;
        setData(res);
      })
      .catch((err) => {
        if (cancelled) return;
        lastFailureRef.current = { key: contextKey, at: Date.now() };
        setError(err instanceof Error ? err.message : "AI request failed");
      })
      .finally(() => {
        if (inflight.current === task) inflight.current = null;
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [feature, enabled, contextKey, options?.stream]);

  return { data, loading, error };
}
