import type { AIFeature, AIFeatureConfig } from "./types";

const toShortJson = (value: unknown) => {
  try {
    return JSON.stringify(value);
  } catch {
    return "{}";
  }
};

const riskLine =
  'Return JSON only with keys {"risk","action","confidence","evidence","expiresAt"}. ' +
  "Use concise strings for risk/action, confidence as 0..1, evidence as short string array, expiresAt as unix ms.";

const DEFAULT_ROLLOUT: AIFeatureConfig["rollout"] = {
  enabledByDefault: true,
  percent: 100,
};

const DEFAULT_POLICY: AIFeatureConfig["policy"] = {
  minConfidence: 0.56,
  maxContextAgeMs: 12 * 60 * 1000,
  minEvidenceItems: 1,
  minDataCoverage: 0.5,
};

type PartialFeatureConfig = Omit<AIFeatureConfig, "rollout" | "policy"> & {
  rollout?: Partial<AIFeatureConfig["rollout"]>;
  policy?: Partial<AIFeatureConfig["policy"]>;
};

function withDefaults(config: PartialFeatureConfig): AIFeatureConfig {
  const percent = Number(config.rollout?.percent ?? DEFAULT_ROLLOUT.percent);
  return {
    ...config,
    rollout: {
      enabledByDefault: config.rollout?.enabledByDefault ?? DEFAULT_ROLLOUT.enabledByDefault,
      percent: Math.min(100, Math.max(0, Number.isFinite(percent) ? percent : 0)),
    },
    policy: {
      minConfidence: Math.min(
        1,
        Math.max(0, Number(config.policy?.minConfidence ?? DEFAULT_POLICY.minConfidence))
      ),
      maxContextAgeMs: Math.max(
        1_000,
        Number(config.policy?.maxContextAgeMs ?? DEFAULT_POLICY.maxContextAgeMs)
      ),
      minEvidenceItems: Math.max(
        0,
        Number(config.policy?.minEvidenceItems ?? DEFAULT_POLICY.minEvidenceItems)
      ),
      minDataCoverage: Math.min(
        1,
        Math.max(0, Number(config.policy?.minDataCoverage ?? DEFAULT_POLICY.minDataCoverage))
      ),
    },
  };
}

const featureConfigList: AIFeatureConfig[] = [
  withDefaults({
    feature: "overview_pulse",
    title: "Portfolio Pulse",
    ttlMs: 2 * 60 * 1000,
    maxPerDay: 60,
    maxTokens: 120,
    temperature: 0.2,
    policy: { minEvidenceItems: 2, minDataCoverage: 0.65 },
    prompt: (context) =>
      `Summarize top 3 portfolio risks and 1 priority action.\n${riskLine}\nContext: ${toShortJson(context)}`,
    fallback: (context) => {
      const c = context as { topHoldings?: Array<{ symbol: string; allocPct: number }> };
      const top = c.topHoldings?.[0];
      return top
        ? `Risk: ${top.symbol} concentration may dominate portfolio swings.\nAction: Rebalance or hedge top exposure.`
        : "Risk: Portfolio risk profile is unclear.\nAction: Review top holdings and exposure limits.";
    },
    ui: { badge: "AI-Pulse", variant: "risk" },
  }),
  withDefaults({
    feature: "feed_summary_overview",
    title: "Feed Summary (Overview)",
    ttlMs: 3 * 60 * 1000,
    maxPerDay: 80,
    maxTokens: 160,
    temperature: 0.2,
    policy: { minEvidenceItems: 2, minDataCoverage: 0.7, maxContextAgeMs: 8 * 60 * 1000 },
    prompt: (context) =>
      `Explain deterministic risk signals for overview scope. Use only context facts. ` +
      `Call out one concrete advisory action.\n${riskLine}\nContext: ${toShortJson(context)}`,
    fallback: () =>
      "Risk: Overview signal quality is currently insufficient.\nAction: Refresh portfolio data and verify top risk drivers.",
    ui: { badge: "AI-Feed", variant: "risk" },
  }),
  withDefaults({
    feature: "feed_summary_markets",
    title: "Feed Summary (Markets)",
    ttlMs: 3 * 60 * 1000,
    maxPerDay: 80,
    maxTokens: 160,
    temperature: 0.2,
    policy: { minEvidenceItems: 2, minDataCoverage: 0.65, maxContextAgeMs: 8 * 60 * 1000 },
    prompt: (context) =>
      `Explain deterministic market risk signals for scanner/volatility context. Use only context facts. ` +
      `Call out one concrete advisory action.\n${riskLine}\nContext: ${toShortJson(context)}`,
    fallback: () =>
      "Risk: Market signal reliability is below threshold.\nAction: Re-run scanner filters and confirm liquidity before acting.",
    ui: { badge: "AI-Feed", variant: "action" },
  }),
  withDefaults({
    feature: "feed_summary_spot",
    title: "Feed Summary (Spot)",
    ttlMs: 3 * 60 * 1000,
    maxPerDay: 80,
    maxTokens: 160,
    temperature: 0.2,
    policy: { minEvidenceItems: 2, minDataCoverage: 0.7, maxContextAgeMs: 8 * 60 * 1000 },
    prompt: (context) =>
      `Explain deterministic spot exposure risk signals. Use only context facts. ` +
      `Call out one concrete advisory action.\n${riskLine}\nContext: ${toShortJson(context)}`,
    fallback: () =>
      "Risk: Spot risk signal quality is insufficient.\nAction: Verify position sizing and stop coverage before adding exposure.",
    ui: { badge: "AI-Feed", variant: "risk" },
  }),
  withDefaults({
    feature: "feed_summary_balances",
    title: "Feed Summary (Balances)",
    ttlMs: 3 * 60 * 1000,
    maxPerDay: 80,
    maxTokens: 160,
    temperature: 0.2,
    policy: { minEvidenceItems: 2, minDataCoverage: 0.7, maxContextAgeMs: 8 * 60 * 1000 },
    prompt: (context) =>
      `Explain deterministic balances and transfer risk signals. Use only context facts. ` +
      `Call out one concrete advisory action.\n${riskLine}\nContext: ${toShortJson(context)}`,
    fallback: () =>
      "Risk: Balance/transfer context is incomplete.\nAction: Reconcile balances and route flows before large reallocation.",
    ui: { badge: "AI-Feed", variant: "risk" },
  }),
  withDefaults({
    feature: "session_advisory",
    title: "Session Advisory",
    ttlMs: 2 * 60 * 1000,
    maxPerDay: 120,
    maxTokens: 120,
    temperature: 0.2,
    policy: { minEvidenceItems: 1, minDataCoverage: 0.55, maxContextAgeMs: 15 * 60 * 1000 },
    prompt: (context) =>
      `Given current market session timing and economic event risk, return one concise advisory. ` +
      `Prioritize risk-first sizing guidance and event timing discipline.\n${riskLine}\nContext: ${toShortJson(context)}`,
    fallback: () =>
      "Risk: Session conditions can shift quickly around event windows.\nAction: Keep normal size and wait for confirmed setups.",
    ui: { badge: "AI-Session", variant: "risk" },
  }),
  withDefaults({
    feature: "markets_scanner_summary",
    title: "Scanner Summary",
    ttlMs: 3 * 60 * 1000,
    maxPerDay: 40,
    maxTokens: 120,
    temperature: 0.3,
    prompt: (context) =>
      `Highlight top 3 tradeable setups based on current filters.\n${riskLine}\nContext: ${toShortJson(context)}`,
    fallback: () =>
      "Risk: Screener filters may be too broad.\nAction: Narrow to 2–3 catalysts and confirm liquidity.",
    ui: { badge: "AI-Pulse", variant: "action" },
  }),
  withDefaults({
    feature: "spot_position_risk",
    title: "Spot Risk Notes",
    ttlMs: 4 * 60 * 1000,
    maxPerDay: 40,
    maxTokens: 160,
    temperature: 0.2,
    policy: { minEvidenceItems: 2, minDataCoverage: 0.65 },
    prompt: (context) =>
      `From the positions list, call out top risk-heavy spot exposure.\n${riskLine}\nContext: ${toShortJson(context)}`,
    fallback: () =>
      "Risk: Position sizing may be uneven.\nAction: Cap single-asset exposure and add defined exits.",
    ui: { badge: "AI-Pulse", variant: "risk" },
  }),
  withDefaults({
    feature: "balances_stablecoin_risk",
    title: "Stablecoin Risk",
    ttlMs: 5 * 60 * 1000,
    maxPerDay: 30,
    maxTokens: 100,
    temperature: 0.2,
    policy: { minEvidenceItems: 2, minDataCoverage: 0.65 },
    prompt: (context) =>
      `Evaluate stablecoin allocation vs total portfolio.\n${riskLine}\nContext: ${toShortJson(context)}`,
    fallback: () =>
      "Risk: Stablecoin allocation could be too high.\nAction: Set a target deploy range for risk assets.",
    ui: { badge: "AI-Pulse", variant: "neutral" },
  }),
  withDefaults({
    feature: "futures_risk",
    title: "Perp Risk",
    ttlMs: 2 * 60 * 1000,
    maxPerDay: 60,
    maxTokens: 120,
    temperature: 0.2,
    policy: { minEvidenceItems: 2, minDataCoverage: 0.7 },
    prompt: (context) =>
      `Identify highest leverage or no-stop positions.\n${riskLine}\nContext: ${toShortJson(context)}`,
    fallback: () =>
      "Risk: Leverage exposure may be elevated.\nAction: Add stop-loss orders on the highest leverage positions.",
    ui: { badge: "AI-Pulse", variant: "risk" },
  }),
  withDefaults({
    feature: "journal_reflection",
    title: "Journal Reflection",
    ttlMs: 6 * 60 * 1000,
    maxPerDay: 20,
    maxTokens: 120,
    temperature: 0.4,
    policy: { minConfidence: 0.5, minEvidenceItems: 1, minDataCoverage: 0.4 },
    prompt: (context) =>
      `Write a 2-line reflection on missing notes or patterns.\n${riskLine}\nContext: ${toShortJson(context)}`,
    fallback: () =>
      "Risk: Missing trade notes reduce edge clarity.\nAction: Log 2 key decisions from today’s trades.",
    ui: { badge: "AI-Pulse", variant: "neutral" },
  }),
  withDefaults({
    feature: "playbook_alignment",
    title: "Playbook Alignment",
    ttlMs: 4 * 60 * 1000,
    maxPerDay: 20,
    maxTokens: 120,
    temperature: 0.2,
    policy: { minEvidenceItems: 2, minDataCoverage: 0.6 },
    prompt: (context) =>
      `Check if live orders match playbook levels.\n${riskLine}\nContext: ${toShortJson(context)}`,
    fallback: () =>
      "Risk: Orders may not align with playbook levels.\nAction: Sync open orders with your defined entries and stops.",
    ui: { badge: "AI-Pulse", variant: "risk" },
  }),
  withDefaults({
    feature: "activity_anomaly",
    title: "Activity Anomaly",
    ttlMs: 4 * 60 * 1000,
    maxPerDay: 30,
    maxTokens: 100,
    temperature: 0.25,
    policy: { minEvidenceItems: 2, minDataCoverage: 0.6 },
    prompt: (context) =>
      `Identify unusual account activity.\n${riskLine}\nContext: ${toShortJson(context)}`,
    fallback: () =>
      "Risk: Recent activity has outlier volume.\nAction: Verify transfers and reconcile balances.",
    ui: { badge: "AI-Pulse", variant: "neutral" },
  }),
  withDefaults({
    feature: "activity_route_health",
    title: "Route Health",
    ttlMs: 3 * 60 * 1000,
    maxPerDay: 40,
    maxTokens: 120,
    temperature: 0.2,
    policy: { minEvidenceItems: 2, minDataCoverage: 0.7 },
    prompt: (context) =>
      `Assess route health across wallet and exchange transfers. Mention exact route key.\n${riskLine}\nContext: ${toShortJson(context)}`,
    fallback: () =>
      "Risk: One route is carrying oversized notional.\nAction: Split flow across a secondary route and verify address labels.",
    ui: { badge: "AI-Pulse", variant: "risk" },
  }),
  withDefaults({
    feature: "activity_fee_drift",
    title: "Fee Drift",
    ttlMs: 3 * 60 * 1000,
    maxPerDay: 40,
    maxTokens: 120,
    temperature: 0.15,
    policy: { minEvidenceItems: 2, minDataCoverage: 0.7 },
    prompt: (context) =>
      `Identify fee drift by route versus baseline. Mention route and current vs baseline bps.\n${riskLine}\nContext: ${toShortJson(context)}`,
    fallback: () =>
      "Risk: Fees are drifting above baseline on one route.\nAction: Switch route/network window and recheck transfer timing.",
    ui: { badge: "AI-Pulse", variant: "action" },
  }),
  withDefaults({
    feature: "activity_memory_signal",
    title: "Memory Signal",
    ttlMs: 5 * 60 * 1000,
    maxPerDay: 30,
    maxTokens: 120,
    temperature: 0.2,
    policy: { minEvidenceItems: 2, minDataCoverage: 0.6 },
    prompt: (context) =>
      `Use recurrence memory to flag unusual repeated movements. Mention route and recurrence gap.\n${riskLine}\nContext: ${toShortJson(context)}`,
    fallback: () =>
      "Risk: A movement pattern is repeating faster than normal.\nAction: Confirm intent and destination before next transfer.",
    ui: { badge: "AI-Pulse", variant: "neutral" },
  }),
  withDefaults({
    feature: "transfers_risk",
    title: "Transfers Risk",
    ttlMs: 4 * 60 * 1000,
    maxPerDay: 30,
    maxTokens: 100,
    temperature: 0.2,
    policy: { minEvidenceItems: 2, minDataCoverage: 0.65 },
    prompt: (context) =>
      `Analyze transfers for unusual size or timing.\n${riskLine}\nContext: ${toShortJson(context)}`,
    fallback: () =>
      "Risk: Transfer size may be atypical.\nAction: Confirm destination and chain before rebalancing.",
    ui: { badge: "AI-Pulse", variant: "neutral" },
  }),
  withDefaults({
    feature: "wallet_health",
    title: "Wallet Health",
    ttlMs: 6 * 60 * 1000,
    maxPerDay: 20,
    maxTokens: 100,
    temperature: 0.2,
    policy: { minEvidenceItems: 1, minDataCoverage: 0.5 },
    prompt: (context) =>
      `Detect idle wallets or dust accumulation.\n${riskLine}\nContext: ${toShortJson(context)}`,
    fallback: () =>
      "Risk: Wallets show dust or idle capital.\nAction: Consolidate small balances or move idle funds.",
    ui: { badge: "AI-Pulse", variant: "neutral" },
  }),
];

export const FEATURE_CONFIG: Record<AIFeature, AIFeatureConfig> = featureConfigList.reduce(
  (acc, item) => {
    acc[item.feature] = item;
    return acc;
  },
  {} as Record<AIFeature, AIFeatureConfig>
);

export const ALL_FEATURES = featureConfigList.map((f) => f.feature);
