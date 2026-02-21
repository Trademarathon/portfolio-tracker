export type AIFeature =
  | "overview_pulse"
  | "markets_scanner_summary"
  | "spot_position_risk"
  | "balances_stablecoin_risk"
  | "futures_risk"
  | "journal_reflection"
  | "playbook_alignment"
  | "activity_anomaly"
  | "transfers_risk"
  | "wallet_health";

export type AIUrgency = "low" | "normal" | "high";

export type AIFeatureConfig = {
  feature: AIFeature;
  title: string;
  ttlMs: number;
  maxPerDay: number;
  maxTokens: number;
  temperature: number;
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

export type AIResponse = {
  content: string;
  provider: "openai" | "gemini" | "ollama";
  model: string;
  usage?: unknown;
  cached: boolean;
  createdAt: number;
};
