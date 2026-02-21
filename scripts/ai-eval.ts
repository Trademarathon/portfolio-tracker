import { readdir, readFile } from "fs/promises";
import path from "path";
import { performance } from "perf_hooks";
import { FEATURE_CONFIG } from "../src/lib/ai-orchestrator/registry";
import { evaluateAIPolicyDecision } from "../src/lib/ai-orchestrator/policy";
import { evaluateAdvancedRiskSnapshot } from "../src/lib/ai-signals/risk-engine";
import type {
  AIFeature,
  AIInsightContract,
  AIContractStatus,
  AIVerdict,
  AIContextMeta,
} from "../src/lib/ai-orchestrator/types";

type EvalScenario = {
  id: string;
  feature: AIFeature;
  context: Record<string, unknown> & {
    snapshotAgeMs?: number;
  };
  contract: {
    risk: string;
    action: string;
    confidence: number;
    evidence: string[];
    expiresAtOffsetMs?: number;
  };
  contractStatus?: AIContractStatus;
  expectedVerdict: AIVerdict;
};

type EvalSummary = {
  total: number;
  contractValid: number;
  fallbackCount: number;
  blockedCount: number;
  expectedBlockedCount: number;
  trueBlockCount: number;
  falseBlockCount: number;
  staleChecks: number;
  staleCorrect: number;
  evidenceSevereChecks: number;
  evidenceComplete: number;
  latencyMs: number[];
};

function isContractValid(contract: AIInsightContract): boolean {
  if (!contract) return false;
  if (!contract.risk.trim() || !contract.action.trim()) return false;
  if (!Number.isFinite(contract.confidence) || contract.confidence < 0 || contract.confidence > 1) {
    return false;
  }
  if (!Array.isArray(contract.evidence)) return false;
  if (!Number.isFinite(contract.expiresAt)) return false;
  return true;
}

function average(list: number[]): number {
  if (!list.length) return 0;
  return list.reduce((sum, value) => sum + value, 0) / list.length;
}

function percentile(list: number[], p: number): number {
  if (!list.length) return 0;
  const sorted = [...list].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[idx] || 0;
}

async function loadScenarios(root: string): Promise<EvalScenario[]> {
  const files = (await readdir(root)).filter((file) => file.endsWith(".json"));
  const scenarios: EvalScenario[] = [];
  for (const file of files) {
    const full = path.join(root, file);
    const parsed = JSON.parse(await readFile(full, "utf8")) as { scenarios?: EvalScenario[] };
    if (Array.isArray(parsed.scenarios)) scenarios.push(...parsed.scenarios);
  }
  return scenarios;
}

function buildContextMeta(id: string, context: EvalScenario["context"], now: number): AIContextMeta {
  const snapshotAgeMs = Number(context.snapshotAgeMs || 0);
  const snapshotTs = now - Math.max(0, snapshotAgeMs);
  const sources = Array.isArray(context.sources)
    ? context.sources.map((s) => String(s)).slice(0, 8)
    : ["eval-fixture"];
  return {
    contextVersion: 1,
    snapshotTs,
    contextHash: id,
    sourceIds: sources,
  };
}

function enrichContext(context: EvalScenario["context"], now: number): Record<string, unknown> {
  const cloned: Record<string, unknown> = { ...context };
  if (!cloned.snapshotTs) {
    const snapshotAgeMs = Number(context.snapshotAgeMs || 0);
    cloned.snapshotTs = now - Math.max(0, snapshotAgeMs);
  }
  const risk = evaluateAdvancedRiskSnapshot({
    assets: Array.isArray(cloned.assets) ? (cloned.assets as any[]) : [],
    positions: Array.isArray(cloned.positions) ? (cloned.positions as any[]) : [],
    activities: Array.isArray(cloned.activities) ? (cloned.activities as any[]) : [],
    now,
    snapshotTs: Number(cloned.snapshotTs || now),
  });
  if (!cloned.riskEngine) {
    cloned.riskEngine = {
      severity: risk.severity,
      verdict: risk.verdict,
      coverage: risk.coverage,
      stale: risk.stale,
      signals: risk.signals.map((signal) => ({
        rule: signal.rule,
        severity: signal.severity,
        verdict: signal.verdict,
        score: signal.score,
        evidence: signal.evidence.slice(0, 2),
      })),
    };
  }
  if (!Number.isFinite(Number(cloned.dataCoverage))) cloned.dataCoverage = risk.coverage;
  if (!cloned.riskSeverity) cloned.riskSeverity = risk.severity;
  if (!cloned.riskSignals) cloned.riskSignals = (cloned.riskEngine as any).signals || [];
  return cloned;
}

async function main(): Promise<void> {
  const root = path.join(process.cwd(), "docs", "ai-evals");
  const scenarios = await loadScenarios(root);
  if (!scenarios.length) {
    console.error("No AI eval scenarios found under docs/ai-evals/*.json");
    process.exit(1);
  }

  const summary: EvalSummary = {
    total: 0,
    contractValid: 0,
    fallbackCount: 0,
    blockedCount: 0,
    expectedBlockedCount: 0,
    trueBlockCount: 0,
    falseBlockCount: 0,
    staleChecks: 0,
    staleCorrect: 0,
    evidenceSevereChecks: 0,
    evidenceComplete: 0,
    latencyMs: [],
  };

  for (const scenario of scenarios) {
    const now = Date.now();
    const config = FEATURE_CONFIG[scenario.feature];
    const context = enrichContext(scenario.context || {}, now);
    const contextMeta = buildContextMeta(scenario.id, scenario.context || {}, now);
    const contract: AIInsightContract = {
      schemaVersion: 1,
      risk: scenario.contract.risk,
      action: scenario.contract.action,
      confidence: scenario.contract.confidence,
      evidence: Array.isArray(scenario.contract.evidence) ? scenario.contract.evidence : [],
      expiresAt: now + Number(scenario.contract.expiresAtOffsetMs || config.ttlMs),
    };

    summary.total += 1;
    if (isContractValid(contract)) summary.contractValid += 1;
    if ((scenario.contractStatus || "validated") === "fallback") summary.fallbackCount += 1;

    const t0 = performance.now();
    const result = evaluateAIPolicyDecision({
      config,
      contract,
      context,
      contextMeta,
      rolloutAllowed: true,
    });
    const latency = performance.now() - t0;
    summary.latencyMs.push(latency);

    const expectedBlocked = scenario.expectedVerdict === "block";
    const actualBlocked = result.verdict === "block";
    if (expectedBlocked) summary.expectedBlockedCount += 1;
    if (actualBlocked) summary.blockedCount += 1;
    if (expectedBlocked && actualBlocked) summary.trueBlockCount += 1;
    if (!expectedBlocked && actualBlocked) summary.falseBlockCount += 1;

    const staleByFixture =
      now - contextMeta.snapshotTs > config.policy.maxContextAgeMs;
    if (staleByFixture) {
      summary.staleChecks += 1;
      if (actualBlocked && result.policy.reasons.includes("stale_context")) {
        summary.staleCorrect += 1;
      }
    }

    if (
      (result.severity === "warning" || result.severity === "critical") &&
      result.verdict !== "block"
    ) {
      summary.evidenceSevereChecks += 1;
      if (contract.evidence.length >= config.policy.minEvidenceItems) {
        summary.evidenceComplete += 1;
      }
    }
  }

  const contractValidRate = summary.total > 0 ? summary.contractValid / summary.total : 0;
  const blockPrecision =
    summary.blockedCount > 0 ? summary.trueBlockCount / summary.blockedCount : 1;
  const blockRecall =
    summary.expectedBlockedCount > 0
      ? summary.trueBlockCount / summary.expectedBlockedCount
      : 1;
  const staleCorrectness =
    summary.staleChecks > 0 ? summary.staleCorrect / summary.staleChecks : 1;
  const evidenceCompleteness =
    summary.evidenceSevereChecks > 0
      ? summary.evidenceComplete / summary.evidenceSevereChecks
      : 1;
  const avgLatency = average(summary.latencyMs);
  const p95Latency = percentile(summary.latencyMs, 95);
  const fallbackRate = summary.total > 0 ? summary.fallbackCount / summary.total : 0;

  console.log("AI eval replay summary");
  console.log(`- scenarios: ${summary.total}`);
  console.log(`- contract valid rate: ${(contractValidRate * 100).toFixed(1)}%`);
  console.log(`- guardrail block precision: ${(blockPrecision * 100).toFixed(1)}%`);
  console.log(`- guardrail block recall: ${(blockRecall * 100).toFixed(1)}%`);
  console.log(`- stale-data block correctness: ${(staleCorrectness * 100).toFixed(1)}%`);
  console.log(`- evidence completeness: ${(evidenceCompleteness * 100).toFixed(1)}%`);
  console.log(`- avg latency: ${avgLatency.toFixed(2)}ms`);
  console.log(`- p95 latency: ${p95Latency.toFixed(2)}ms`);
  console.log(`- fallback rate: ${(fallbackRate * 100).toFixed(1)}%`);

  const passes =
    contractValidRate >= 0.95 &&
    staleCorrectness >= 1 &&
    blockRecall >= 0.9 &&
    evidenceCompleteness >= 0.9;
  if (!passes) {
    console.error("AI eval failed quality gates.");
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`AI eval failed: ${message}`);
  process.exit(1);
});
