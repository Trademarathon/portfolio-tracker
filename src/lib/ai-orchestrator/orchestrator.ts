"use client";

import { chatWithAI, streamWithAI } from "@/lib/api/ai";
import { FEATURE_CONFIG } from "./registry";
import type { AIRequest, AIResponse, AIFeature } from "./types";

const CACHE_KEY = "ai_orchestrator_cache_v1";
const BUDGET_KEY = "ai_orchestrator_budget_v1";
const AUDIT_KEY = "ai_orchestrator_audit_v1";

type CacheEntry = {
  createdAt: number;
  response: AIResponse;
  hash: string;
};

type BudgetState = Record<
  AIFeature,
  {
    date: string;
    count: number;
  }
>;

const inflight = new Map<string, Promise<AIResponse>>();

function hashString(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function loadCache(): Record<string, CacheEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, CacheEntry>) : {};
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, CacheEntry>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

function loadBudget(): BudgetState {
  if (typeof window === "undefined") return {} as BudgetState;
  try {
    const raw = localStorage.getItem(BUDGET_KEY);
    return raw ? (JSON.parse(raw) as BudgetState) : ({} as BudgetState);
  } catch {
    return {} as BudgetState;
  }
}

function saveBudget(budget: BudgetState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(BUDGET_KEY, JSON.stringify(budget));
}

function appendAudit(entry: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(AUDIT_KEY);
    const parsed: Array<Record<string, unknown>> = raw ? JSON.parse(raw) : [];
    parsed.push(entry);
    localStorage.setItem(AUDIT_KEY, JSON.stringify(parsed.slice(-200)));
  } catch {
    // ignore
  }
}

export function isFeatureEnabled(feature: AIFeature): boolean {
  if (typeof window === "undefined") return true;
  const key = `ai_feature_enabled_${feature}`;
  const raw = localStorage.getItem(key);
  return raw !== "0";
}

export function setFeatureEnabled(feature: AIFeature, enabled: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`ai_feature_enabled_${feature}`, enabled ? "1" : "0");
  window.dispatchEvent(new Event("ai-feature-toggles-changed"));
}

function checkBudget(feature: AIFeature, maxPerDay: number): boolean {
  const budget = loadBudget();
  const today = new Date().toISOString().slice(0, 10);
  const current = budget[feature];
  if (!current || current.date !== today) {
    budget[feature] = { date: today, count: 0 };
  }
  if (budget[feature].count >= maxPerDay) {
    saveBudget(budget);
    return false;
  }
  budget[feature].count += 1;
  saveBudget(budget);
  return true;
}

export async function runAIRequest(request: AIRequest): Promise<AIResponse> {
  const config = FEATURE_CONFIG[request.feature];
  const contextStr = JSON.stringify(request.context || {});
  const hash = hashString(`${request.feature}:${contextStr}`);
  const cacheKey = `${request.feature}:${hash}`;
  const cache = loadCache();
  const cached = cache[cacheKey];
  if (cached && Date.now() - cached.createdAt < config.ttlMs) {
    return { ...cached.response, cached: true };
  }

  if (!checkBudget(request.feature, config.maxPerDay)) {
    const fallback: AIResponse = {
      content: config.fallback(request.context),
      provider: "openai",
      model: "fallback",
      cached: false,
      createdAt: Date.now(),
    };
    return fallback;
  }

  const inflightKey = cacheKey;
  if (inflight.has(inflightKey)) return inflight.get(inflightKey)!;

  const task = (async () => {
    const prompt = config.prompt(request.context);
    const response = await chatWithAI({
      feature: request.feature,
      maxTokens: request.maxTokens ?? config.maxTokens,
      temperature: request.temperature ?? config.temperature,
      messages: [
        {
          role: "system",
          content:
            "You are a trading desk assistant. Output 1–2 concise sentences. No disclaimers. No mentions of AI.",
        },
        { role: "user", content: prompt },
      ],
    });
    const enriched: AIResponse = {
      content: response.content,
      provider: response.provider,
      model: response.model,
      usage: response.usage,
      cached: false,
      createdAt: Date.now(),
    };
    cache[cacheKey] = { createdAt: Date.now(), response: enriched, hash };
    saveCache(cache);
    appendAudit({
      feature: request.feature,
      createdAt: enriched.createdAt,
      provider: enriched.provider,
      model: enriched.model,
      cached: false,
    });
    return enriched;
  })();

  inflight.set(inflightKey, task);
  try {
    return await task;
  } finally {
    inflight.delete(inflightKey);
  }
}

export async function runAIStreamRequest(
  request: AIRequest,
  onDelta: (chunk: string) => void
): Promise<AIResponse> {
  const config = FEATURE_CONFIG[request.feature];
  const contextStr = JSON.stringify(request.context || {});
  const hash = hashString(`${request.feature}:${contextStr}`);
  const cacheKey = `${request.feature}:${hash}`;
  const cache = loadCache();
  const cached = cache[cacheKey];
  if (cached && Date.now() - cached.createdAt < config.ttlMs) {
    onDelta(cached.response.content || "");
    return { ...cached.response, cached: true };
  }

  if (!checkBudget(request.feature, config.maxPerDay)) {
    const fallback: AIResponse = {
      content: config.fallback(request.context),
      provider: "openai",
      model: "fallback",
      cached: false,
      createdAt: Date.now(),
    };
    onDelta(fallback.content);
    return fallback;
  }

  const prompt = config.prompt(request.context);
  const response = await streamWithAI(
    {
      feature: request.feature,
      maxTokens: request.maxTokens ?? config.maxTokens,
      temperature: request.temperature ?? config.temperature,
      messages: [
        {
          role: "system",
          content:
            "You are a trading desk assistant. Output 1–2 concise sentences. No disclaimers. No mentions of AI.",
        },
        { role: "user", content: prompt },
      ],
    },
    { onDelta }
  );

  const enriched: AIResponse = {
    content: response.content,
    provider: response.provider,
    model: response.model,
    usage: response.usage,
    cached: false,
    createdAt: Date.now(),
  };
  cache[cacheKey] = { createdAt: Date.now(), response: enriched, hash };
  saveCache(cache);
  appendAudit({
    feature: request.feature,
    createdAt: enriched.createdAt,
    provider: enriched.provider,
    model: enriched.model,
    cached: false,
  });
  return enriched;
}
