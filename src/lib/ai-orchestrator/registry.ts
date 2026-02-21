import type { AIFeature, AIFeatureConfig } from "./types";

const toShortJson = (value: unknown) => {
  try {
    return JSON.stringify(value);
  } catch {
    return "{}";
  }
};

const riskLine = "Use 1 line for risk and 1 line for action. Keep it concise.";

const featureConfigList: AIFeatureConfig[] = [
  {
    feature: "overview_pulse",
    title: "Portfolio Pulse",
    ttlMs: 2 * 60 * 1000,
    maxPerDay: 60,
    maxTokens: 120,
    temperature: 0.2,
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
  },
  {
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
  },
  {
    feature: "spot_position_risk",
    title: "Spot Risk Notes",
    ttlMs: 4 * 60 * 1000,
    maxPerDay: 40,
    maxTokens: 160,
    temperature: 0.2,
    prompt: (context) =>
      `From the positions list, call out top risk-heavy spots. Output bullets as "- SYMBOL: note".\n${riskLine}\nContext: ${toShortJson(context)}`,
    fallback: () =>
      "Risk: Position sizing may be uneven.\nAction: Cap single-asset exposure and add defined exits.",
    ui: { badge: "AI-Pulse", variant: "risk" },
  },
  {
    feature: "balances_stablecoin_risk",
    title: "Stablecoin Risk",
    ttlMs: 5 * 60 * 1000,
    maxPerDay: 30,
    maxTokens: 100,
    temperature: 0.2,
    prompt: (context) =>
      `Evaluate stablecoin allocation vs total portfolio.\n${riskLine}\nContext: ${toShortJson(context)}`,
    fallback: () =>
      "Risk: Stablecoin allocation could be too high.\nAction: Set a target deploy range for risk assets.",
    ui: { badge: "AI-Pulse", variant: "neutral" },
  },
  {
    feature: "futures_risk",
    title: "Perp Risk",
    ttlMs: 2 * 60 * 1000,
    maxPerDay: 60,
    maxTokens: 120,
    temperature: 0.2,
    prompt: (context) =>
      `Identify highest leverage or no-stop positions.\n${riskLine}\nContext: ${toShortJson(context)}`,
    fallback: () =>
      "Risk: Leverage exposure may be elevated.\nAction: Add stop-loss orders on the highest leverage positions.",
    ui: { badge: "AI-Pulse", variant: "risk" },
  },
  {
    feature: "journal_reflection",
    title: "Journal Reflection",
    ttlMs: 6 * 60 * 1000,
    maxPerDay: 20,
    maxTokens: 120,
    temperature: 0.4,
    prompt: (context) =>
      `Write a 2-line reflection on missing notes or patterns.\n${riskLine}\nContext: ${toShortJson(context)}`,
    fallback: () =>
      "Risk: Missing trade notes reduce edge clarity.\nAction: Log 2 key decisions from today’s trades.",
    ui: { badge: "AI-Pulse", variant: "neutral" },
  },
  {
    feature: "playbook_alignment",
    title: "Playbook Alignment",
    ttlMs: 4 * 60 * 1000,
    maxPerDay: 20,
    maxTokens: 120,
    temperature: 0.2,
    prompt: (context) =>
      `Check if live orders match playbook levels.\n${riskLine}\nContext: ${toShortJson(context)}`,
    fallback: () =>
      "Risk: Orders may not align with playbook levels.\nAction: Sync open orders with your defined entries and stops.",
    ui: { badge: "AI-Pulse", variant: "risk" },
  },
  {
    feature: "activity_anomaly",
    title: "Activity Anomaly",
    ttlMs: 4 * 60 * 1000,
    maxPerDay: 30,
    maxTokens: 100,
    temperature: 0.25,
    prompt: (context) =>
      `Identify unusual account activity.\n${riskLine}\nContext: ${toShortJson(context)}`,
    fallback: () =>
      "Risk: Recent activity has outlier volume.\nAction: Verify transfers and reconcile balances.",
    ui: { badge: "AI-Pulse", variant: "neutral" },
  },
  {
    feature: "transfers_risk",
    title: "Transfers Risk",
    ttlMs: 4 * 60 * 1000,
    maxPerDay: 30,
    maxTokens: 100,
    temperature: 0.2,
    prompt: (context) =>
      `Analyze transfers for unusual size or timing.\n${riskLine}\nContext: ${toShortJson(context)}`,
    fallback: () =>
      "Risk: Transfer size may be atypical.\nAction: Confirm destination and chain before rebalancing.",
    ui: { badge: "AI-Pulse", variant: "neutral" },
  },
  {
    feature: "wallet_health",
    title: "Wallet Health",
    ttlMs: 6 * 60 * 1000,
    maxPerDay: 20,
    maxTokens: 100,
    temperature: 0.2,
    prompt: (context) =>
      `Detect idle wallets or dust accumulation.\n${riskLine}\nContext: ${toShortJson(context)}`,
    fallback: () =>
      "Risk: Wallets show dust or idle capital.\nAction: Consolidate small balances or move idle funds.",
    ui: { badge: "AI-Pulse", variant: "neutral" },
  },
];

export const FEATURE_CONFIG: Record<AIFeature, AIFeatureConfig> = featureConfigList.reduce(
  (acc, item) => {
    acc[item.feature] = item;
    return acc;
  },
  {} as Record<AIFeature, AIFeatureConfig>
);

export const ALL_FEATURES = featureConfigList.map((f) => f.feature);
