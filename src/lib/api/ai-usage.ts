"use client";

export type AIUsageProvider = "openai" | "gemini" | "ollama";
export type AIContractStatus = "validated" | "repaired" | "fallback";
export type AIPolicyReason =
  | "rollout_disabled"
  | "low_confidence"
  | "stale_context"
  | "missing_evidence"
  | "incomplete_coverage";
export type AIVerdict = "allow" | "warn" | "block";

export interface AIUsageTotals {
  count: number;
  lastUsed: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AIUsageCounter {
  count: number;
  lastUsed: number;
}

export interface AIUsageConfidenceStats {
  samples: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  last: number;
}

export interface AIUsageQualityStats {
  contractStatus: Record<AIContractStatus, AIUsageCounter>;
  confidence: AIUsageConfidenceStats;
}

export interface AIFeatureQualityCounters {
  totalDecisions: number;
  allowCount: number;
  warnCount: number;
  blockCount: number;
  blockedCount: number;
  staleBlockedCount: number;
  lowConfidenceBlockedCount: number;
  evidenceMissingBlockedCount: number;
  fallbackCount: number;
  lastUsed: number;
}

export interface AIUsageStats {
  providers: Record<AIUsageProvider, AIUsageTotals>;
  features: Record<string, AIUsageTotals>;
  models: Record<string, AIUsageTotals>;
  quality: AIUsageQualityStats;
  featureQuality: Record<string, AIFeatureQualityCounters>;
}

const STORAGE_KEY = "ai_usage_stats_v1";

const DEFAULT_COUNTER: AIUsageCounter = {
  count: 0,
  lastUsed: 0,
};

const DEFAULT_CONFIDENCE: AIUsageConfidenceStats = {
  samples: 0,
  sum: 0,
  avg: 0,
  min: 0,
  max: 0,
  last: 0,
};

const DEFAULT_FEATURE_QUALITY: AIFeatureQualityCounters = {
  totalDecisions: 0,
  allowCount: 0,
  warnCount: 0,
  blockCount: 0,
  blockedCount: 0,
  staleBlockedCount: 0,
  lowConfidenceBlockedCount: 0,
  evidenceMissingBlockedCount: 0,
  fallbackCount: 0,
  lastUsed: 0,
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

function cloneCounter(base?: AIUsageCounter): AIUsageCounter {
  return {
    count: base?.count ?? DEFAULT_COUNTER.count,
    lastUsed: base?.lastUsed ?? DEFAULT_COUNTER.lastUsed,
  };
}

function cloneConfidence(base?: AIUsageConfidenceStats): AIUsageConfidenceStats {
  const samples = base?.samples ?? DEFAULT_CONFIDENCE.samples;
  const sum = base?.sum ?? DEFAULT_CONFIDENCE.sum;
  const avg = samples > 0 ? sum / samples : 0;
  return {
    samples,
    sum,
    avg: Number.isFinite(base?.avg) ? (base?.avg as number) : avg,
    min: samples > 0 ? (base?.min ?? avg) : DEFAULT_CONFIDENCE.min,
    max: samples > 0 ? (base?.max ?? avg) : DEFAULT_CONFIDENCE.max,
    last: base?.last ?? DEFAULT_CONFIDENCE.last,
  };
}

function cloneFeatureQuality(base?: AIFeatureQualityCounters): AIFeatureQualityCounters {
  return {
    totalDecisions: base?.totalDecisions ?? DEFAULT_FEATURE_QUALITY.totalDecisions,
    allowCount: base?.allowCount ?? DEFAULT_FEATURE_QUALITY.allowCount,
    warnCount: base?.warnCount ?? DEFAULT_FEATURE_QUALITY.warnCount,
    blockCount: base?.blockCount ?? DEFAULT_FEATURE_QUALITY.blockCount,
    blockedCount: base?.blockedCount ?? DEFAULT_FEATURE_QUALITY.blockedCount,
    staleBlockedCount: base?.staleBlockedCount ?? DEFAULT_FEATURE_QUALITY.staleBlockedCount,
    lowConfidenceBlockedCount:
      base?.lowConfidenceBlockedCount ?? DEFAULT_FEATURE_QUALITY.lowConfidenceBlockedCount,
    evidenceMissingBlockedCount:
      base?.evidenceMissingBlockedCount ?? DEFAULT_FEATURE_QUALITY.evidenceMissingBlockedCount,
    fallbackCount: base?.fallbackCount ?? DEFAULT_FEATURE_QUALITY.fallbackCount,
    lastUsed: base?.lastUsed ?? DEFAULT_FEATURE_QUALITY.lastUsed,
  };
}

function emptyStats(): AIUsageStats {
  return {
    providers: { openai: cloneTotals(), gemini: cloneTotals(), ollama: cloneTotals() },
    features: {},
    models: {},
    quality: {
      contractStatus: {
        validated: cloneCounter(),
        repaired: cloneCounter(),
        fallback: cloneCounter(),
      },
      confidence: cloneConfidence(),
    },
    featureQuality: {},
  };
}

export function loadAIUsageStats(): AIUsageStats {
  if (typeof window === "undefined") {
    return emptyStats();
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
      quality: {
        contractStatus: {
          validated: cloneCounter(parsed.quality?.contractStatus?.validated),
          repaired: cloneCounter(parsed.quality?.contractStatus?.repaired),
          fallback: cloneCounter(parsed.quality?.contractStatus?.fallback),
        },
        confidence: cloneConfidence(parsed.quality?.confidence),
      },
      featureQuality: Object.entries(parsed.featureQuality || {}).reduce(
        (acc, [key, value]) => {
          acc[key] = cloneFeatureQuality(value);
          return acc;
        },
        {} as Record<string, AIFeatureQualityCounters>
      ),
    };
  } catch {
    return emptyStats();
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

function bumpCounter(target: AIUsageCounter) {
  target.count += 1;
  target.lastUsed = Date.now();
}

function bumpFeatureQuality(
  target: AIFeatureQualityCounters,
  verdict: AIVerdict | undefined,
  contractStatus: AIContractStatus | undefined,
  policyReasons?: AIPolicyReason[]
) {
  target.totalDecisions += 1;
  target.lastUsed = Date.now();
  if (verdict === "allow") target.allowCount += 1;
  if (verdict === "warn") target.warnCount += 1;
  if (verdict === "block") {
    target.blockCount += 1;
    target.blockedCount += 1;
    if (policyReasons?.includes("stale_context")) target.staleBlockedCount += 1;
    if (policyReasons?.includes("low_confidence")) target.lowConfidenceBlockedCount += 1;
    if (policyReasons?.includes("missing_evidence")) target.evidenceMissingBlockedCount += 1;
  }
  if (contractStatus === "fallback") target.fallbackCount += 1;
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

export function recordAIQualityTelemetry(params: {
  feature?: string;
  contractStatus: AIContractStatus;
  confidence?: number;
  verdict?: AIVerdict;
  policyReasons?: AIPolicyReason[];
}) {
  if (typeof window === "undefined") return;
  const stats = loadAIUsageStats();
  const bucket = stats.quality.contractStatus[params.contractStatus];
  bumpCounter(bucket);

  const confidence = Number(params.confidence);
  if (Number.isFinite(confidence)) {
    const clamped = Math.min(1, Math.max(0, confidence));
    const c = stats.quality.confidence;
    c.samples += 1;
    c.sum += clamped;
    c.avg = c.sum / c.samples;
    if (c.samples === 1) {
      c.min = clamped;
      c.max = clamped;
    } else {
      c.min = Math.min(c.min, clamped);
      c.max = Math.max(c.max, clamped);
    }
    c.last = clamped;
  }

  if (params.feature) {
    const featureKey = params.feature || "unknown";
    if (!stats.featureQuality[featureKey]) {
      stats.featureQuality[featureKey] = cloneFeatureQuality();
    }
    bumpFeatureQuality(
      stats.featureQuality[featureKey],
      params.verdict,
      params.contractStatus,
      params.policyReasons
    );
  }

  saveAIUsageStats(stats);
}
