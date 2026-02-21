import type { PortfolioAsset, Position } from "@/lib/api/types";

export type AIKind = "PLAYBOOK" | "JOURNAL" | "STOPLOSS" | "ECONOMIC" | "POSITION" | "ACTIVITY" | "INFO" | "SOCIAL";
export type AISource = "global" | "screener" | "spot" | "balances" | "journal" | "x";

export interface ScoreContext {
  topHoldings: Set<string>;
  openPositions: Set<string>;
  now: number;
}

export interface ScoredSignal {
  id: string;
  type: string;
  symbol: string;
  title: string;
  description: string;
  timestamp: number;
  priority: "high" | "medium" | "low";
  kind: AIKind;
  source: AISource;
  score: number;
}

export function scoreSignal(signal: ScoredSignal, context: ScoreContext): number {
  let score = 0;

  // High urgency
  if (signal.type === "PERP_STOPLOSS_REMINDER") score += 100;
  if (signal.type === "FUTURES_INSIGHT" && (signal.description || "").includes("drawdown")) score += 60;

  // Medium urgency
  if (signal.type === "PLAYBOOK_PLAN_LEVELS") score += 40;
  if (signal.type === "PLAYBOOK_COMPOSITE_TRIGGER") score += 60;
  if (signal.type === "PLAYBOOK_VALUE_ACCEPTANCE") score += 45;
  if (signal.type === "LEVEL_NO_ORDER_WARNING") score += 55;
  if (signal.type === "PLAYBOOK_RULE_WARNING") score += 50;
  if (signal.type === "JOURNAL_REMINDER") score += 35;

  // Low urgency
  if (signal.type === "TRX_ACTIVITY") score += 10;

  // Recency (0..20 in last 24h)
  const ageMs = Math.max(0, context.now - signal.timestamp);
  const recency = Math.max(0, 20 - Math.floor(ageMs / (24 * 60 * 60 * 1000) * 20));
  score += recency;

  // User impact
  if (context.topHoldings.has(signal.symbol)) score += 15;
  if (context.openPositions.has(signal.symbol)) score += 15;

  // Priority override
  if (signal.priority === "high") score += 20;
  if (signal.priority === "medium") score += 10;

  return score;
}

export function dedupeSignals(signals: ScoredSignal[]): ScoredSignal[] {
  const byKey = new Map<string, ScoredSignal>();
  for (const s of signals) {
    const bucket = Math.floor(s.timestamp / (12 * 60 * 60 * 1000));
    const key = `${s.type}|${s.symbol}|${s.title}|${bucket}`;
    const existing = byKey.get(key);
    if (!existing || s.score > existing.score || s.timestamp > existing.timestamp) byKey.set(key, s);
  }
  return Array.from(byKey.values());
}

export function buildScoreContext(assets: PortfolioAsset[], positions: Position[]): ScoreContext {
  const now = Date.now();
  const topHoldings = new Set<string>(
    [...assets].sort((a, b) => (b.valueUsd || 0) - (a.valueUsd || 0)).slice(0, 5).map((a) => a.symbol)
  );
  const openPositions = new Set<string>(
    (positions || []).map((p) => p.symbol?.replace("-PERP", "") || p.symbol).filter(Boolean) as string[]
  );
  return { topHoldings, openPositions, now };
}
