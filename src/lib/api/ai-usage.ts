"use client";

export type AIUsageProvider = "openai" | "gemini" | "ollama";

export interface AIUsageTotals {
  count: number;
  lastUsed: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AIUsageStats {
  providers: Record<AIUsageProvider, AIUsageTotals>;
  features: Record<string, AIUsageTotals>;
  models: Record<string, AIUsageTotals>;
}

const STORAGE_KEY = "ai_usage_stats_v1";

const DEFAULT_TOTALS: AIUsageTotals = {
  count: 0,
  lastUsed: 0,
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
};

function cloneTotals(base?: AIUsageTotals): AIUsageTotals {
  return {
    count: base?.count ?? 0,
    lastUsed: base?.lastUsed ?? 0,
    promptTokens: base?.promptTokens ?? 0,
    completionTokens: base?.completionTokens ?? 0,
    totalTokens: base?.totalTokens ?? 0,
  };
}

export function loadAIUsageStats(): AIUsageStats {
  if (typeof window === "undefined") {
    return {
      providers: { openai: cloneTotals(), gemini: cloneTotals(), ollama: cloneTotals() },
      features: {},
      models: {},
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("empty");
    const parsed = JSON.parse(raw) as AIUsageStats;
    return {
      providers: {
        openai: cloneTotals(parsed.providers?.openai),
        gemini: cloneTotals(parsed.providers?.gemini),
        ollama: cloneTotals(parsed.providers?.ollama),
      },
      features: parsed.features || {},
      models: parsed.models || {},
    };
  } catch {
    return {
      providers: { openai: cloneTotals(), gemini: cloneTotals(), ollama: cloneTotals() },
      features: {},
      models: {},
    };
  }
}

function saveAIUsageStats(stats: AIUsageStats) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  window.dispatchEvent(new Event("ai-usage-changed"));
}

function extractTokens(provider: AIUsageProvider, usage?: unknown): AIUsageTotals {
  const totals = cloneTotals();
  if (!usage || typeof usage !== "object") return totals;

  if (provider === "openai") {
    const u = usage as { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    totals.promptTokens = Number(u.prompt_tokens || 0);
    totals.completionTokens = Number(u.completion_tokens || 0);
    totals.totalTokens = Number(u.total_tokens || 0);
    return totals;
  }

  if (provider === "gemini") {
    const u = usage as { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
    totals.promptTokens = Number(u.promptTokenCount || 0);
    totals.completionTokens = Number(u.candidatesTokenCount || 0);
    totals.totalTokens = Number(u.totalTokenCount || 0);
    return totals;
  }

  if (provider === "ollama") {
    const u = usage as { promptEvalCount?: number; evalCount?: number };
    totals.promptTokens = Number(u.promptEvalCount || 0);
    totals.completionTokens = Number(u.evalCount || 0);
    totals.totalTokens = totals.promptTokens + totals.completionTokens;
    return totals;
  }

  return totals;
}

function bumpTotals(target: AIUsageTotals, delta: AIUsageTotals) {
  target.count += 1;
  target.lastUsed = Date.now();
  target.promptTokens += delta.promptTokens || 0;
  target.completionTokens += delta.completionTokens || 0;
  target.totalTokens += delta.totalTokens || 0;
}

export function recordAIUsage(params: {
  provider: AIUsageProvider;
  feature: string;
  model?: string;
  usage?: unknown;
}) {
  if (typeof window === "undefined") return;
  const stats = loadAIUsageStats();
  const delta = extractTokens(params.provider, params.usage);

  bumpTotals(stats.providers[params.provider], delta);

  const featureKey = params.feature || "unknown";
  if (!stats.features[featureKey]) stats.features[featureKey] = cloneTotals();
  bumpTotals(stats.features[featureKey], delta);

  if (params.model) {
    if (!stats.models[params.model]) stats.models[params.model] = cloneTotals();
    bumpTotals(stats.models[params.model], delta);
  }

  saveAIUsageStats(stats);
}

export function recordAIUsageMinimal(provider: AIUsageProvider, feature: string, model?: string) {
  recordAIUsage({ provider, feature, model, usage: undefined });
}
