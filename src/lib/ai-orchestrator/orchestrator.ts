"use client";

import { chatWithAI, streamWithAI } from "@/lib/api/ai";
import { recordAIQualityTelemetry } from "@/lib/api/ai-usage";
import {
  AI_RUNTIME_DISABLED_MESSAGE,
  isAIRuntimeEnabled,
} from "@/lib/ai-runtime";
import { FEATURE_CONFIG } from "./registry";
import { evaluateAIPolicyDecision, formatPolicyReason } from "./policy";
import type {
  AIContractStatus,
  AIContextMeta,
  AIFeature,
  AIFeatureConfig,
  AIInsightContract,
  AIRequest,
  AIResponse,
} from "./types";

const CACHE_KEY = "ai_orchestrator_cache_v3";
const BUDGET_KEY = "ai_orchestrator_budget_v1";
const AUDIT_KEY = "ai_orchestrator_audit_v1";
const FEATURE_ROLLOUT_KEY_PREFIX = "ai_feature_rollout_";
const CONTEXT_VERSION = 1 as const;
const MAX_SOURCE_IDS = 8;
const SOURCE_KEYS = new Set([
  "source",
  "sources",
  "provider",
  "providers",
  "exchange",
  "exchanges",
  "route",
  "routeKey",
  "chain",
  "chains",
  "venue",
  "venues",
]);
const CONTRACT_SYSTEM_PROMPT =
  "You are a trading desk assistant. Return only a strict JSON object with keys risk, action, confidence, evidence, expiresAt. " +
  "No markdown. No code fences. No extra keys. Keep risk/action concise and actionable.";

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
const FORCE_AUTO_PROVIDER_FEATURES = new Set<AIFeature>([
  "session_advisory",
  "feed_summary_overview",
  "feed_summary_markets",
  "feed_summary_spot",
  "feed_summary_balances",
]);

function resolveProviderForFeature(feature: AIFeature): "ollama" | undefined {
  if (!FORCE_AUTO_PROVIDER_FEATURES.has(feature)) return undefined;
  return "ollama";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeText(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned || fallback;
}

function normalizeEvidence(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.replace(/\s+/g, " ").trim() : ""))
    .filter(Boolean)
    .slice(0, 4);
}

function normalizeConfidence(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, 0, 1);
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeExpiresAt(value: unknown, ttlMs: number, now = Date.now()): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(now, Math.round(value));
  }
  if (typeof value === "string") {
    const asNum = Number(value);
    if (Number.isFinite(asNum)) return Math.max(now, Math.round(asNum));
    const parsedDate = Date.parse(value);
    if (Number.isFinite(parsedDate)) return Math.max(now, parsedDate);
  }
  return now + ttlMs;
}

function hashString(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function formatContractContent(contract: AIInsightContract): string {
  return `Risk: ${contract.risk}\nAction: ${contract.action}`;
}

function normalizeSourceToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, 48);
}

function collectSourceIds(context: Record<string, unknown>): string[] {
  const out = new Set<string>();
  const stack: unknown[] = [context];
  const seen = new Set<unknown>();

  while (stack.length > 0 && out.size < MAX_SOURCE_IDS) {
    const node = stack.pop();
    if (!node || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);

    if (Array.isArray(node)) {
      for (const item of node) stack.push(item);
      continue;
    }

    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (SOURCE_KEYS.has(key)) {
        if (Array.isArray(value)) {
          for (const item of value) {
            const token = normalizeSourceToken(item);
            if (token) out.add(token);
            if (out.size >= MAX_SOURCE_IDS) break;
          }
        } else {
          const token = normalizeSourceToken(value);
          if (token) out.add(token);
        }
      }
      if (value && typeof value === "object") stack.push(value);
      if (out.size >= MAX_SOURCE_IDS) break;
    }
  }

  return Array.from(out);
}

function buildFallbackEvidence(
  context: Record<string, unknown>,
  minEvidenceItems: number
): string[] {
  const out: string[] = [];

  const topHoldings = context.topHoldings as
    | Array<{ symbol?: unknown; allocPct?: unknown }>
    | undefined;
  if (Array.isArray(topHoldings) && topHoldings.length > 0) {
    const top = topHoldings[0];
    const symbol = typeof top?.symbol === "string" && top.symbol.trim() ? top.symbol.trim() : null;
    const alloc = toFiniteNumber(top?.allocPct);
    if (symbol && alloc !== null) {
      out.push(`Top holding ${symbol} allocation ${alloc.toFixed(1)}%.`);
    } else if (symbol) {
      out.push(`Top holding ${symbol} captured in latest snapshot.`);
    }
  }

  const riskSignals = (context.riskSignals ||
    (context.riskEngine as { signals?: unknown } | undefined)?.signals) as
    | Array<{ rule?: unknown; severity?: unknown }>
    | undefined;
  if (Array.isArray(riskSignals)) {
    for (const signal of riskSignals.slice(0, 2)) {
      const rule = typeof signal?.rule === "string" && signal.rule.trim() ? signal.rule.trim() : null;
      const severity =
        signal?.severity === "info" || signal?.severity === "warning" || signal?.severity === "critical"
          ? signal.severity
          : null;
      if (rule && severity) out.push(`${rule} signal severity ${severity}.`);
      else if (rule) out.push(`${rule} signal present in context.`);
    }
  }

  const coverage =
    toFiniteNumber(context.dataCoverage) ??
    toFiniteNumber(context.coverage) ??
    toFiniteNumber(context.coverageRatio) ??
    toFiniteNumber((context.riskEngine as { coverage?: unknown } | undefined)?.coverage);
  if (coverage !== null) out.push(`Data coverage ${(clamp(coverage, 0, 1) * 100).toFixed(0)}%.`);

  const sourceIds = collectSourceIds(context).slice(0, 2);
  if (sourceIds.length > 0) out.push(`Sources: ${sourceIds.join(", ")}.`);

  if (out.length === 0) {
    out.push("Derived from latest local context snapshot.");
  }

  const targetCount = Math.min(4, Math.max(1, Math.round(minEvidenceItems)));
  while (out.length < targetCount) {
    out.push("Fallback guidance generated by deterministic policy defaults.");
  }

  return out.slice(0, 4);
}

function resolveSnapshotTs(context: Record<string, unknown>): number {
  const candidates = [
    context.snapshotTs,
    context.timestamp,
    context.ts,
    context.lastUpdated,
    context.lastSync,
  ];
  for (const candidate of candidates) {
    const asNum = Number(candidate);
    if (Number.isFinite(asNum) && asNum > 0) return Math.round(asNum);
  }
  return Date.now();
}

function buildContextMeta(
  context: Record<string, unknown>,
  contextHash: string
): AIContextMeta {
  return {
    contextVersion: CONTEXT_VERSION,
    snapshotTs: resolveSnapshotTs(context),
    contextHash,
    sourceIds: collectSourceIds(context),
  };
}

function safeJsonParse(input: string): unknown | null {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function extractJsonCandidate(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const direct = safeJsonParse(trimmed);
  if (direct) return direct;

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    const fromFence = safeJsonParse(fencedMatch[1].trim());
    if (fromFence) return fromFence;
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return safeJsonParse(trimmed.slice(firstBrace, lastBrace + 1));
  }
  return null;
}

function buildValidatedContract(
  candidate: unknown,
  config: AIFeatureConfig,
  fallbackConfidence: number
): AIInsightContract | null {
  if (!candidate || typeof candidate !== "object") return null;
  const value = candidate as {
    risk?: unknown;
    action?: unknown;
    confidence?: unknown;
    evidence?: unknown;
    expiresAt?: unknown;
  };
  if (typeof value.risk !== "string" || typeof value.action !== "string") return null;
  const now = Date.now();
  return {
    schemaVersion: 1,
    risk: normalizeText(value.risk, "Risk is unclear."),
    action: normalizeText(value.action, "Review exposure and risk controls."),
    confidence: normalizeConfidence(value.confidence, fallbackConfidence),
    evidence: normalizeEvidence(value.evidence),
    expiresAt: normalizeExpiresAt(value.expiresAt, config.ttlMs, now),
  };
}

function buildRepairedContract(
  raw: string,
  config: AIFeatureConfig,
  context: Record<string, unknown>
): AIInsightContract | null {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);

  let risk = "";
  let action = "";
  const evidence: string[] = [];

  for (const line of lines) {
    if (!risk) {
      const riskMatch = line.match(/^risk\s*[:\-]\s*(.+)$/i);
      if (riskMatch?.[1]) {
        risk = riskMatch[1].trim();
        continue;
      }
    }
    if (!action) {
      const actionMatch = line.match(/^action\s*[:\-]\s*(.+)$/i);
      if (actionMatch?.[1]) {
        action = actionMatch[1].trim();
        continue;
      }
    }
    const evidenceMatch = line.match(/^evidence\s*[:\-]\s*(.+)$/i);
    if (evidenceMatch?.[1]) {
      evidence.push(...evidenceMatch[1].split(",").map((v) => v.trim()).filter(Boolean));
    }
  }

  const plain = raw.replace(/\s+/g, " ").trim();
  if (!risk) {
    const sentences = plain
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    risk = sentences[0] || lines[0] || "";
  }
  if (!action) {
    const sentences = plain
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    action = sentences[1] || lines[1] || "";
  }

  if (!risk && !action) return null;

  return {
    schemaVersion: 1,
    risk: normalizeText(risk, "Risk is unclear."),
    action: normalizeText(action, "Review exposure and risk controls."),
    confidence: clamp(Math.max(0.52, config.policy.minConfidence), 0.4, 0.75),
    evidence:
      evidence.length > 0
        ? evidence.slice(0, 4)
        : buildFallbackEvidence(context, config.policy.minEvidenceItems),
    expiresAt: Date.now() + config.ttlMs,
  };
}

function fallbackContract(config: AIFeatureConfig, context: Record<string, unknown>): AIInsightContract {
  const fallbackText = config.fallback(context);
  const repaired = buildRepairedContract(fallbackText, config, context);
  if (repaired) {
    return {
      ...repaired,
      confidence: clamp(Math.max(0.45, config.policy.minConfidence), 0.45, 0.75),
      expiresAt: Date.now() + config.ttlMs,
    };
  }
  return {
    schemaVersion: 1,
    risk: "Risk is unclear.",
    action: "Review exposure and risk controls.",
    confidence: clamp(Math.max(0.45, config.policy.minConfidence), 0.45, 0.75),
    evidence: buildFallbackEvidence(context, config.policy.minEvidenceItems),
    expiresAt: Date.now() + config.ttlMs,
  };
}

function normalizeOutputToContract(
  rawContent: string,
  config: AIFeatureConfig,
  context: Record<string, unknown>
): { contract: AIInsightContract; status: AIContractStatus } {
  const fromJson = buildValidatedContract(extractJsonCandidate(rawContent), config, 0.68);
  if (fromJson) return { contract: fromJson, status: "validated" };

  const repaired = buildRepairedContract(rawContent, config, context);
  if (repaired) return { contract: repaired, status: "repaired" };

  return { contract: fallbackContract(config, context), status: "fallback" };
}

function normalizeStoredResponse(
  response: AIResponse,
  feature: AIFeature,
  config: AIFeatureConfig,
  context: Record<string, unknown>,
  contextHash: string
): AIResponse {
  const normalized =
    response.structured && response.contractStatus
      ? { contract: response.structured, status: response.contractStatus }
      : normalizeOutputToContract(response.content || "", config, context);
  const contextMeta = response.contextMeta || buildContextMeta(context, contextHash);
  return buildResponseFromContract({
    feature,
    config,
    context,
    contextMeta,
    contract: normalized.contract,
    status: normalized.status,
    provider: response.provider,
    model: response.model,
    usage: response.usage,
    cached: response.cached,
    createdAt: response.createdAt,
  });
}

function policyBlockedContent(reasons: string[]): string {
  if (!reasons.length) return "Signal blocked by policy.";
  return `Signal blocked by policy: ${reasons.join("; ")}.`;
}

function buildResponseFromContract(params: {
  feature: AIFeature;
  config: AIFeatureConfig;
  context: Record<string, unknown>;
  contextMeta: AIContextMeta;
  contract: AIInsightContract;
  status: AIContractStatus;
  provider: AIResponse["provider"];
  model: string;
  usage?: unknown;
  cached: boolean;
  createdAt: number;
  rolloutAllowed?: boolean;
}): AIResponse {
  const rolloutAllowed =
    typeof params.rolloutAllowed === "boolean"
      ? params.rolloutAllowed
      : isRolloutAllowed(params.feature, params.contextMeta.contextHash);
  const policyEval = evaluateAIPolicyDecision({
    config: params.config,
    contract: params.contract,
    context: params.context,
    contextMeta: params.contextMeta,
    rolloutAllowed,
  });
  const reasons = policyEval.policy.reasons.map((reason) => formatPolicyReason(reason));
  return {
    content:
      policyEval.verdict === "block"
        ? policyBlockedContent(reasons)
        : formatContractContent(params.contract),
    provider: params.provider,
    model: params.model,
    usage: params.usage,
    cached: params.cached,
    createdAt: params.createdAt,
    structured: params.contract,
    contractStatus: params.status,
    contextMeta: params.contextMeta,
    signalMeta: {
      severity: policyEval.severity,
      verdict: policyEval.verdict,
      policy: policyEval.policy,
    },
  };
}

function trackQuality(
  feature: AIFeature,
  status: AIContractStatus,
  confidence: number | undefined,
  response: AIResponse
): void {
  try {
    recordAIQualityTelemetry({
      feature,
      contractStatus: status,
      confidence,
      verdict: response.signalMeta?.verdict,
      policyReasons: response.signalMeta?.policy?.reasons,
    });
  } catch {
    // ignore telemetry write issues
  }
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
  if (typeof window === "undefined") {
    return FEATURE_CONFIG[feature]?.rollout.enabledByDefault ?? true;
  }
  const key = `ai_feature_enabled_${feature}`;
  const raw = localStorage.getItem(key);
  if (raw === "1") return true;
  if (raw === "0") return false;
  return FEATURE_CONFIG[feature]?.rollout.enabledByDefault ?? true;
}

export function setFeatureEnabled(feature: AIFeature, enabled: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`ai_feature_enabled_${feature}`, enabled ? "1" : "0");
  window.dispatchEvent(new Event("ai-feature-toggles-changed"));
}

export function getFeatureRolloutPercent(feature: AIFeature): number {
  const config = FEATURE_CONFIG[feature];
  if (!config) return 100;
  if (typeof window === "undefined") return config.rollout.percent;
  const raw = localStorage.getItem(`${FEATURE_ROLLOUT_KEY_PREFIX}${feature}`);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return config.rollout.percent;
  return Math.min(100, Math.max(0, Math.round(parsed)));
}

export function setFeatureRolloutPercent(feature: AIFeature, percent: number) {
  if (typeof window === "undefined") return;
  const normalized = Math.min(100, Math.max(0, Math.round(percent)));
  localStorage.setItem(`${FEATURE_ROLLOUT_KEY_PREFIX}${feature}`, String(normalized));
  window.dispatchEvent(new Event("ai-feature-toggles-changed"));
}

function isRolloutAllowed(
  feature: AIFeature,
  contextHash: string
): boolean {
  if (!isFeatureEnabled(feature)) return false;
  const percent = getFeatureRolloutPercent(feature);
  if (percent <= 0) return false;
  if (percent >= 100) return true;
  const bucket = Number.parseInt(hashString(`${feature}:${contextHash}:rollout`), 36) % 100;
  return bucket < percent;
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
  const context = request.context || {};
  const contextStr = JSON.stringify(context);
  const hash = hashString(`${request.feature}:${contextStr}`);
  const contextMeta = buildContextMeta(context, hash);
  const runtimeEnabled = isAIRuntimeEnabled();
  if (!runtimeEnabled) {
    const structured = fallbackContract(config, context);
    const blocked = buildResponseFromContract({
      feature: request.feature,
      config,
      context,
      contextMeta,
      contract: structured,
      status: "fallback",
      provider: "ollama",
      model: "runtime-disabled",
      cached: false,
      createdAt: Date.now(),
      rolloutAllowed: false,
    });
    blocked.content = AI_RUNTIME_DISABLED_MESSAGE;
    appendAudit({
      feature: request.feature,
      createdAt: blocked.createdAt,
      provider: blocked.provider,
      model: blocked.model,
      cached: false,
      contractStatus: "fallback",
      confidence: structured.confidence,
      verdict: blocked.signalMeta?.verdict,
      policyReasons: blocked.signalMeta?.policy?.reasons,
      contextHash: contextMeta.contextHash,
      snapshotTs: contextMeta.snapshotTs,
      sourceIds: contextMeta.sourceIds,
    });
    trackQuality(request.feature, "fallback", structured.confidence, blocked);
    return blocked;
  }

  const rolloutAllowed = isRolloutAllowed(request.feature, hash);
  if (!rolloutAllowed) {
    const structured = fallbackContract(config, context);
    const blocked = buildResponseFromContract({
      feature: request.feature,
      config,
      context,
      contextMeta,
      contract: structured,
      status: "fallback",
      provider: "openai",
      model: "policy-rollout",
      cached: false,
      createdAt: Date.now(),
      rolloutAllowed: false,
    });
    appendAudit({
      feature: request.feature,
      createdAt: blocked.createdAt,
      provider: blocked.provider,
      model: blocked.model,
      cached: false,
      contractStatus: "fallback",
      confidence: structured.confidence,
      verdict: blocked.signalMeta?.verdict,
      policyReasons: blocked.signalMeta?.policy?.reasons,
      contextHash: contextMeta.contextHash,
      snapshotTs: contextMeta.snapshotTs,
      sourceIds: contextMeta.sourceIds,
    });
    trackQuality(request.feature, "fallback", structured.confidence, blocked);
    return blocked;
  }

  const cacheKey = `${request.feature}:${hash}`;
  const cache = loadCache();
  const cached = cache[cacheKey];
  if (cached && Date.now() - cached.createdAt < config.ttlMs) {
    const normalizedCached = normalizeStoredResponse(
      cached.response,
      request.feature,
      config,
      context,
      hash
    );
    return { ...normalizedCached, cached: true };
  }

  if (!checkBudget(request.feature, config.maxPerDay)) {
    const structured = fallbackContract(config, context);
    const fallback = buildResponseFromContract({
      feature: request.feature,
      config,
      context,
      contextMeta,
      contract: structured,
      status: "fallback",
      provider: "openai",
      model: "budget-fallback",
      cached: false,
      createdAt: Date.now(),
      rolloutAllowed,
    });
    appendAudit({
      feature: request.feature,
      createdAt: fallback.createdAt,
      provider: fallback.provider,
      model: fallback.model,
      cached: false,
      contractStatus: "fallback",
      confidence: structured.confidence,
      verdict: fallback.signalMeta?.verdict,
      policyReasons: fallback.signalMeta?.policy?.reasons,
      contextHash: contextMeta.contextHash,
      snapshotTs: contextMeta.snapshotTs,
      sourceIds: contextMeta.sourceIds,
    });
    trackQuality(request.feature, "fallback", structured.confidence, fallback);
    return fallback;
  }

  const inflightKey = cacheKey;
  if (inflight.has(inflightKey)) return inflight.get(inflightKey)!;

  const task = (async () => {
    const prompt = config.prompt(context);
    const response = await chatWithAI({
      provider: resolveProviderForFeature(request.feature),
      feature: request.feature,
      maxTokens: request.maxTokens ?? config.maxTokens,
      temperature: request.temperature ?? config.temperature,
      messages: [
        {
          role: "system",
          content: CONTRACT_SYSTEM_PROMPT,
        },
        { role: "user", content: prompt },
      ],
      jsonMode: true,
    });
    const normalized = normalizeOutputToContract(response.content || "", config, context);
    const enriched = buildResponseFromContract({
      feature: request.feature,
      config,
      context,
      contextMeta,
      contract: normalized.contract,
      status: normalized.status,
      provider: response.provider,
      model: response.model,
      usage: response.usage,
      cached: false,
      createdAt: Date.now(),
      rolloutAllowed,
    });
    cache[cacheKey] = { createdAt: Date.now(), response: enriched, hash };
    saveCache(cache);
    appendAudit({
      feature: request.feature,
      createdAt: enriched.createdAt,
      provider: enriched.provider,
      model: enriched.model,
      cached: false,
      contractStatus: normalized.status,
      confidence: normalized.contract.confidence,
      verdict: enriched.signalMeta?.verdict,
      policyReasons: enriched.signalMeta?.policy?.reasons,
      contextHash: contextMeta.contextHash,
      snapshotTs: contextMeta.snapshotTs,
      sourceIds: contextMeta.sourceIds,
    });
    trackQuality(request.feature, normalized.status, normalized.contract.confidence, enriched);
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
  onDelta: (chunk: string) => void,
  options?: { signal?: AbortSignal }
): Promise<AIResponse> {
  const config = FEATURE_CONFIG[request.feature];
  const context = request.context || {};
  const contextStr = JSON.stringify(context);
  const hash = hashString(`${request.feature}:${contextStr}`);
  const contextMeta = buildContextMeta(context, hash);
  const runtimeEnabled = isAIRuntimeEnabled();
  if (!runtimeEnabled) {
    const structured = fallbackContract(config, context);
    const blocked = buildResponseFromContract({
      feature: request.feature,
      config,
      context,
      contextMeta,
      contract: structured,
      status: "fallback",
      provider: "ollama",
      model: "runtime-disabled",
      cached: false,
      createdAt: Date.now(),
      rolloutAllowed: false,
    });
    blocked.content = AI_RUNTIME_DISABLED_MESSAGE;
    appendAudit({
      feature: request.feature,
      createdAt: blocked.createdAt,
      provider: blocked.provider,
      model: blocked.model,
      cached: false,
      contractStatus: "fallback",
      confidence: structured.confidence,
      verdict: blocked.signalMeta?.verdict,
      policyReasons: blocked.signalMeta?.policy?.reasons,
      contextHash: contextMeta.contextHash,
      snapshotTs: contextMeta.snapshotTs,
      sourceIds: contextMeta.sourceIds,
    });
    onDelta(blocked.content);
    trackQuality(request.feature, "fallback", structured.confidence, blocked);
    return blocked;
  }

  const rolloutAllowed = isRolloutAllowed(request.feature, hash);
  if (!rolloutAllowed) {
    const structured = fallbackContract(config, context);
    const blocked = buildResponseFromContract({
      feature: request.feature,
      config,
      context,
      contextMeta,
      contract: structured,
      status: "fallback",
      provider: "openai",
      model: "policy-rollout",
      cached: false,
      createdAt: Date.now(),
      rolloutAllowed: false,
    });
    appendAudit({
      feature: request.feature,
      createdAt: blocked.createdAt,
      provider: blocked.provider,
      model: blocked.model,
      cached: false,
      contractStatus: "fallback",
      confidence: structured.confidence,
      verdict: blocked.signalMeta?.verdict,
      policyReasons: blocked.signalMeta?.policy?.reasons,
      contextHash: contextMeta.contextHash,
      snapshotTs: contextMeta.snapshotTs,
      sourceIds: contextMeta.sourceIds,
    });
    onDelta(blocked.content);
    trackQuality(request.feature, "fallback", structured.confidence, blocked);
    return blocked;
  }

  const cacheKey = `${request.feature}:${hash}`;
  const cache = loadCache();
  const cached = cache[cacheKey];
  if (cached && Date.now() - cached.createdAt < config.ttlMs) {
    const normalizedCached = normalizeStoredResponse(
      cached.response,
      request.feature,
      config,
      context,
      hash
    );
    onDelta(normalizedCached.content || "");
    return { ...normalizedCached, cached: true };
  }

  if (!checkBudget(request.feature, config.maxPerDay)) {
    const structured = fallbackContract(config, context);
    const fallback = buildResponseFromContract({
      feature: request.feature,
      config,
      context,
      contextMeta,
      contract: structured,
      status: "fallback",
      provider: "openai",
      model: "budget-fallback",
      cached: false,
      createdAt: Date.now(),
      rolloutAllowed,
    });
    appendAudit({
      feature: request.feature,
      createdAt: fallback.createdAt,
      provider: fallback.provider,
      model: fallback.model,
      cached: false,
      contractStatus: "fallback",
      confidence: structured.confidence,
      verdict: fallback.signalMeta?.verdict,
      policyReasons: fallback.signalMeta?.policy?.reasons,
      contextHash: contextMeta.contextHash,
      snapshotTs: contextMeta.snapshotTs,
      sourceIds: contextMeta.sourceIds,
    });
    onDelta(fallback.content);
    trackQuality(request.feature, "fallback", structured.confidence, fallback);
    return fallback;
  }

  const prompt = config.prompt(context);
  let streamedRaw = "";
  const response = await streamWithAI(
    {
      provider: resolveProviderForFeature(request.feature),
      feature: request.feature,
      maxTokens: request.maxTokens ?? config.maxTokens,
      temperature: request.temperature ?? config.temperature,
      messages: [
        {
          role: "system",
          content: CONTRACT_SYSTEM_PROMPT,
        },
        { role: "user", content: prompt },
      ],
      jsonMode: true,
    },
    {
      onDelta: (chunk) => {
        streamedRaw += chunk;
      },
      signal: options?.signal,
    }
  );
  const normalized = normalizeOutputToContract(
    response.content || streamedRaw,
    config,
    context
  );
  const enriched = buildResponseFromContract({
    feature: request.feature,
    config,
    context,
    contextMeta,
    contract: normalized.contract,
    status: normalized.status,
    provider: response.provider,
    model: response.model,
    usage: response.usage,
    cached: false,
    createdAt: Date.now(),
    rolloutAllowed,
  });
  onDelta(enriched.content);
  cache[cacheKey] = { createdAt: Date.now(), response: enriched, hash };
  saveCache(cache);
  appendAudit({
    feature: request.feature,
    createdAt: enriched.createdAt,
    provider: enriched.provider,
    model: enriched.model,
    cached: false,
    contractStatus: normalized.status,
    confidence: normalized.contract.confidence,
    verdict: enriched.signalMeta?.verdict,
    policyReasons: enriched.signalMeta?.policy?.reasons,
    contextHash: contextMeta.contextHash,
    snapshotTs: contextMeta.snapshotTs,
    sourceIds: contextMeta.sourceIds,
  });
  trackQuality(request.feature, normalized.status, normalized.contract.confidence, enriched);
  return enriched;
}
