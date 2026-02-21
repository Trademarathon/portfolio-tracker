import type {
  AIContextMeta,
  AIFeatureConfig,
  AIInsightContract,
  AIPolicyDecision,
  AIPolicyReason,
  AISignalSeverity,
  AIVerdict,
} from "./types";

const SEVERITY_SCORE: Record<AISignalSeverity, number> = {
  info: 0,
  warning: 1,
  critical: 2,
};

const RISK_KEYWORDS: Array<{ severity: AISignalSeverity; pattern: RegExp }> = [
  { severity: "critical", pattern: /\b(liquidation|insolvency|exploit|critical|halt)\b/i },
  { severity: "warning", pattern: /\b(risk|drawdown|leverage|funding|concentration|stop)\b/i },
];

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function parseCoverage(context: Record<string, unknown>): number {
  const direct =
    Number(context.dataCoverage) ||
    Number(context.coverage) ||
    Number(context.coverageRatio) ||
    Number((context.riskEngine as { coverage?: unknown } | undefined)?.coverage);
  if (Number.isFinite(direct)) return clamp(direct, 0, 1);
  return 1;
}

function severityFromContext(context: Record<string, unknown>): AISignalSeverity | null {
  const direct = (context.riskSeverity ||
    (context.riskEngine as { severity?: unknown } | undefined)?.severity) as
    | AISignalSeverity
    | undefined;
  if (direct === "info" || direct === "warning" || direct === "critical") return direct;

  const signals = (context.riskSignals ||
    (context.riskEngine as { signals?: unknown } | undefined)?.signals) as
    | Array<{ severity?: unknown }>
    | undefined;
  if (!Array.isArray(signals) || signals.length === 0) return null;

  let best: AISignalSeverity = "info";
  for (const signal of signals) {
    const severity = signal?.severity;
    if (severity !== "info" && severity !== "warning" && severity !== "critical") continue;
    if (SEVERITY_SCORE[severity] > SEVERITY_SCORE[best]) best = severity;
  }
  return best;
}

function severityFromText(contract: AIInsightContract): AISignalSeverity {
  const text = `${contract.risk} ${contract.action}`;
  let best: AISignalSeverity = "info";
  for (const row of RISK_KEYWORDS) {
    if (row.pattern.test(text) && SEVERITY_SCORE[row.severity] > SEVERITY_SCORE[best]) {
      best = row.severity;
    }
  }
  return best;
}

function maxSeverity(a: AISignalSeverity, b: AISignalSeverity): AISignalSeverity {
  return SEVERITY_SCORE[a] >= SEVERITY_SCORE[b] ? a : b;
}

function inferSeverity(
  contract: AIInsightContract,
  context: Record<string, unknown>
): AISignalSeverity {
  const fromContext = severityFromContext(context);
  if (fromContext) {
    return maxSeverity(fromContext, severityFromText(contract));
  }
  return severityFromText(contract);
}

function hasInsufficientEvidence(contract: AIInsightContract, minEvidenceItems: number): boolean {
  return contract.evidence.length < minEvidenceItems;
}

function toWarnOrAllow(severity: AISignalSeverity): AIVerdict {
  return severity === "info" ? "allow" : "warn";
}

export function formatPolicyReason(reason: AIPolicyReason): string {
  if (reason === "rollout_disabled") return "Feature rollout currently disabled";
  if (reason === "low_confidence") return "Confidence below guardrail threshold";
  if (reason === "stale_context") return "Snapshot context is stale";
  if (reason === "missing_evidence") return "Evidence requirements not satisfied";
  if (reason === "incomplete_coverage") return "Data coverage is incomplete";
  return "Policy blocked";
}

export function evaluateAIPolicyDecision(params: {
  config: AIFeatureConfig;
  contract: AIInsightContract;
  context: Record<string, unknown>;
  contextMeta: AIContextMeta;
  rolloutAllowed: boolean;
}): {
  severity: AISignalSeverity;
  verdict: AIVerdict;
  policy: AIPolicyDecision;
} {
  const { config, contract, contextMeta, context, rolloutAllowed } = params;
  const now = Date.now();
  const ageMs = Math.max(0, now - contextMeta.snapshotTs);
  const coverage = parseCoverage(context);
  const severity = inferSeverity(contract, context);
  const reasons: AIPolicyReason[] = [];

  if (!rolloutAllowed) reasons.push("rollout_disabled");
  if (contract.confidence < config.policy.minConfidence) reasons.push("low_confidence");
  if (ageMs > config.policy.maxContextAgeMs) reasons.push("stale_context");
  if (coverage < config.policy.minDataCoverage) reasons.push("incomplete_coverage");
  if (
    severity !== "info" &&
    hasInsufficientEvidence(contract, config.policy.minEvidenceItems)
  ) {
    reasons.push("missing_evidence");
  }

  const verdict: AIVerdict = reasons.length > 0 ? "block" : toWarnOrAllow(severity);
  return {
    severity,
    verdict,
    policy: {
      verdict,
      reasons,
      thresholdSnapshot: {
        minConfidence: config.policy.minConfidence,
        maxContextAgeMs: config.policy.maxContextAgeMs,
        minEvidenceItems: config.policy.minEvidenceItems,
        minDataCoverage: config.policy.minDataCoverage,
      },
    },
  };
}
