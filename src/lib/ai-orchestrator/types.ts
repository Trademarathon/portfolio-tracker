export type AIFeature =
  | "overview_pulse"
  | "markets_scanner_summary"
  | "spot_position_risk"
  | "balances_stablecoin_risk"
  | "futures_risk"
  | "feed_summary_overview"
  | "feed_summary_markets"
  | "feed_summary_spot"
  | "feed_summary_balances"
  | "session_advisory"
  | "journal_reflection"
  | "playbook_alignment"
  | "activity_anomaly"
  | "activity_route_health"
  | "activity_fee_drift"
  | "activity_memory_signal"
  | "transfers_risk"
  | "wallet_health";

export type AIUrgency = "low" | "normal" | "high";

export type AISignalSeverity = "info" | "warning" | "critical";
export type AIVerdict = "allow" | "warn" | "block";

export type AIPolicyReason =
  | "rollout_disabled"
  | "low_confidence"
  | "stale_context"
  | "missing_evidence"
  | "incomplete_coverage";

export type AIPolicyThresholdSnapshot = {
  minConfidence: number;
  maxContextAgeMs: number;
  minEvidenceItems: number;
  minDataCoverage: number;
};

export type AIPolicyDecision = {
  verdict: AIVerdict;
  reasons: AIPolicyReason[];
  thresholdSnapshot: AIPolicyThresholdSnapshot;
};

export type AIFeatureConfig = {
  feature: AIFeature;
  title: string;
  ttlMs: number;
  maxPerDay: number;
  maxTokens: number;
  temperature: number;
  rollout: {
    enabledByDefault: boolean;
    percent: number; // 0..100
  };
  policy: AIPolicyThresholdSnapshot;
  prompt: (context: Record<string, unknown>) => string;
  fallback: (context: Record<string, unknown>) => string;
  ui: {
    badge: string;
    variant: "neutral" | "risk" | "action";
  };
};

export type AIRequest = {
  feature: AIFeature;
  context: Record<string, unknown>;
  maxTokens?: number;
  temperature?: number;
  urgency?: AIUrgency;
};

export type AIInsightContract = {
  schemaVersion: 1;
  risk: string;
  action: string;
  confidence: number; // 0..1
  evidence: string[];
  expiresAt: number; // unix ms
};

export type AIContractStatus = "validated" | "repaired" | "fallback";

export type AIContextMeta = {
  contextVersion: 1;
  snapshotTs: number;
  contextHash: string;
  sourceIds: string[];
};

export type AIResponse = {
  content: string;
  provider: "openai" | "gemini" | "ollama";
  model: string;
  usage?: unknown;
  cached: boolean;
  createdAt: number;
  structured?: AIInsightContract;
  contractStatus?: AIContractStatus;
  contextMeta?: AIContextMeta;
  signalMeta?: {
    severity: AISignalSeverity;
    verdict: AIVerdict;
    policy: AIPolicyDecision;
  };
};
