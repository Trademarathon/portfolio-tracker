"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AIRequest, AIResponse, AIFeature } from "./types";
import { runAIRequest, runAIStreamRequest, isFeatureEnabled } from "./orchestrator";
import {
  AI_RUNTIME_CHANGED_EVENT,
  AI_RUNTIME_ENABLED_STORAGE_KEY,
  isAIRuntimeEnabled,
} from "@/lib/ai-runtime";

const FAILED_REQUEST_COOLDOWN_MS = 15_000;
const STREAM_TIMEOUT_MS = 22_000;

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
  const [runtimeEnabled, setRuntimeEnabled] = useState<boolean>(() => isAIRuntimeEnabled());
  const inflight = useRef<Promise<AIResponse> | null>(null);
  const lastKeyRef = useRef<string | null>(null);
  const lastFailureRef = useRef<{ key: string; at: number } | null>(null);
  const contextRef = useRef(context);

  const contextKey = useMemo(() => safeStringify(context), [context]);
  const depsKey = useMemo(() => safeStringify(_deps), [_deps]);
  const requestKey = `${contextKey}|${depsKey}`;
  contextRef.current = context;

  useEffect(() => {
    const syncRuntimeEnabled = () => setRuntimeEnabled(isAIRuntimeEnabled());
    const onStorage = (event: StorageEvent) => {
      if (event.key === AI_RUNTIME_ENABLED_STORAGE_KEY) syncRuntimeEnabled();
    };
    window.addEventListener(AI_RUNTIME_CHANGED_EVENT, syncRuntimeEnabled);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(AI_RUNTIME_CHANGED_EVENT, syncRuntimeEnabled);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !runtimeEnabled || !isFeatureEnabled(feature)) return;
    if (inflight.current) return;
    if (lastKeyRef.current === requestKey) return;
    if (lastFailureRef.current?.key === requestKey) {
      const age = Date.now() - lastFailureRef.current.at;
      if (age < FAILED_REQUEST_COOLDOWN_MS) return;
    }

    let cancelled = false;
    const streamAbort = options?.stream ? new AbortController() : null;
    const streamTimeout =
      streamAbort &&
      setTimeout(() => {
        streamAbort.abort();
      }, STREAM_TIMEOUT_MS);

    setLoading(true);
    setError(null);
    const request: AIRequest = { feature, context: contextRef.current };
    const task: Promise<AIResponse> = (options?.stream
      ? runAIStreamRequest(request, (chunk) => {
          if (cancelled) return;
          setData((prev) => ({
            content: (prev?.content || "") + chunk,
            provider: prev?.provider || "ollama",
            model: prev?.model || "stream",
            cached: false,
            createdAt: prev?.createdAt || Date.now(),
          }));
        }, { signal: streamAbort?.signal })
      : runAIRequest(request));
    inflight.current = task;
    task
      .then((res) => {
        if (cancelled) return;
        lastFailureRef.current = null;
        lastKeyRef.current = requestKey;
        setData(res);
      })
      .catch((err) => {
        if (cancelled) return;
        lastFailureRef.current = { key: requestKey, at: Date.now() };
        const message =
          err instanceof Error && err.name === "AbortError"
            ? "AI request timed out"
            : err instanceof Error
              ? err.message
              : "AI request failed";
        setError(message);
      })
      .finally(() => {
        if (streamTimeout) clearTimeout(streamTimeout);
        if (inflight.current === task) inflight.current = null;
        setLoading(false);
      });

    return () => {
      cancelled = true;
      if (streamTimeout) clearTimeout(streamTimeout);
      streamAbort?.abort();
    };
  }, [feature, enabled, runtimeEnabled, requestKey, contextKey, options?.stream]);

  return { data, loading, error };
}
