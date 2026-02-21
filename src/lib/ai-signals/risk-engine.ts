import type { AISignalSeverity, AIVerdict } from "@/lib/ai-orchestrator/types";

type AssetLike = {
  symbol?: string;
  valueUsd?: number;
  allocations?: number;
};

type PositionLike = {
  symbol?: string;
  size?: number;
  entryPrice?: number;
  markPrice?: number;
  leverage?: number;
  liquidationPrice?: number;
  side?: string;
  stopLoss?: number;
};

type ActivityLike = {
  activityType?: string;
  type?: string;
  amount?: number;
  amountUsd?: number;
  feeUsd?: number;
  feeType?: string;
  timestamp?: number;
  from?: string;
  to?: string;
  chain?: string;
};

export type RiskRuleId =
  | "concentration"
  | "leverage_stress"
  | "stop_coverage"
  | "funding_drag"
  | "transfer_anomaly"
  | "route_health";

export type RiskEngineSignal = {
  rule: RiskRuleId;
  severity: AISignalSeverity;
  verdict: AIVerdict;
  score: number; // 0..100
  confidence: number; // 0..1
  evidence: string[];
  coverage: number; // 0..1
  metrics: Record<string, number | string | boolean>;
};

export type RiskEngineInput = {
  assets?: AssetLike[];
  positions?: PositionLike[];
  activities?: ActivityLike[];
  now?: number;
  snapshotTs?: number;
};

export type RiskEngineOutput = {
  generatedAt: number;
  snapshotTs: number;
  stale: boolean;
  coverage: number;
  severity: AISignalSeverity;
  verdict: AIVerdict;
  signals: RiskEngineSignal[];
  topSignals: RiskEngineSignal[];
};

type SeverityBreakpoints = {
  warning: number;
  critical: number;
};

const SCORE: Record<AISignalSeverity, number> = {
  info: 0,
  warning: 1,
  critical: 2,
};

const STABLE_SYMBOLS = new Set(["USDT", "USDC", "DAI", "USDE", "FDUSD"]);
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const STALE_MS = 12 * 60 * 1000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toFinite(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function rankSeverity(a: AISignalSeverity, b: AISignalSeverity): AISignalSeverity {
  return SCORE[a] >= SCORE[b] ? a : b;
}

function severityToVerdict(severity: AISignalSeverity): AIVerdict {
  return severity === "info" ? "allow" : "warn";
}

function severityFromThreshold(value: number, cfg: SeverityBreakpoints): AISignalSeverity {
  if (value >= cfg.critical) return "critical";
  if (value >= cfg.warning) return "warning";
  return "info";
}

function safeSymbol(value: unknown): string {
  const out = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return out || "UNKNOWN";
}

function computeConcentration(assets: AssetLike[]): RiskEngineSignal {
  const scoped = assets
    .map((a) => ({
      symbol: safeSymbol(a.symbol),
      valueUsd: Math.max(0, toFinite(a.valueUsd)),
    }))
    .filter((a) => a.valueUsd > 0);
  const total = scoped.reduce((sum, a) => sum + a.valueUsd, 0);
  if (total <= 0 || scoped.length === 0) {
    return {
      rule: "concentration",
      severity: "warning",
      verdict: "warn",
      score: 50,
      confidence: 0.45,
      coverage: 0.35,
      evidence: ["No asset valuation coverage available"],
      metrics: { totalValueUsd: total, topWeightPct: 0, hhi: 0 },
    };
  }

  const sorted = [...scoped].sort((a, b) => b.valueUsd - a.valueUsd);
  const top = sorted[0];
  const topWeightPct = (top.valueUsd / total) * 100;
  const hhi = sorted.reduce((sum, item) => {
    const w = item.valueUsd / total;
    return sum + w * w;
  }, 0);
  const level = Math.max(topWeightPct, hhi * 100);
  const severity =
    topWeightPct >= 55 || hhi >= 0.38
      ? "critical"
      : topWeightPct >= 35 || hhi >= 0.24
        ? "warning"
        : "info";

  return {
    rule: "concentration",
    severity,
    verdict: severityToVerdict(severity),
    score: clamp(Math.round(level), 0, 100),
    confidence: 0.94,
    coverage: 1,
    evidence: [
      `Top holding ${top.symbol} is ${topWeightPct.toFixed(1)}% of tracked value`,
      `Portfolio concentration index (HHI) is ${hhi.toFixed(3)}`,
    ],
    metrics: {
      totalValueUsd: Math.round(total),
      topSymbol: top.symbol,
      topWeightPct: Number(topWeightPct.toFixed(2)),
      hhi: Number(hhi.toFixed(4)),
    },
  };
}

function liquidationDistancePct(position: PositionLike): number {
  const mark = toFinite(position.markPrice || position.entryPrice);
  const liq = toFinite(position.liquidationPrice);
  if (mark <= 0 || liq <= 0) return Number.POSITIVE_INFINITY;
  const side = String(position.side || "").toLowerCase();
  if (side === "short") return ((liq - mark) / mark) * 100;
  return ((mark - liq) / mark) * 100;
}

function computeLeverageStress(positions: PositionLike[]): RiskEngineSignal {
  const scoped = positions.filter((p) => Math.abs(toFinite(p.size)) > 0);
  if (!scoped.length) {
    return {
      rule: "leverage_stress",
      severity: "info",
      verdict: "allow",
      score: 0,
      confidence: 0.92,
      coverage: 1,
      evidence: ["No open leveraged positions detected"],
      metrics: { maxLeverage: 0, minLiqDistancePct: 0, openPositions: 0 },
    };
  }

  const maxLeverage = scoped.reduce((max, p) => Math.max(max, toFinite(p.leverage, 1)), 1);
  const distances = scoped
    .map((p) => liquidationDistancePct(p))
    .filter((d) => Number.isFinite(d) && d > 0);
  const minLiqDistancePct =
    distances.length > 0 ? distances.reduce((min, d) => Math.min(min, d), distances[0]) : 999;
  const severity =
    maxLeverage >= 12 || minLiqDistancePct <= 10
      ? "critical"
      : maxLeverage >= 6 || minLiqDistancePct <= 20
        ? "warning"
        : "info";
  const score = clamp(Math.round(Math.max((maxLeverage / 15) * 100, 100 - minLiqDistancePct)), 0, 100);

  return {
    rule: "leverage_stress",
    severity,
    verdict: severityToVerdict(severity),
    score,
    confidence: 0.9,
    coverage: 0.95,
    evidence: [
      `Max leverage across positions is ${maxLeverage.toFixed(1)}x`,
      `Closest liquidation distance is ${minLiqDistancePct.toFixed(1)}%`,
    ],
    metrics: {
      maxLeverage: Number(maxLeverage.toFixed(2)),
      minLiqDistancePct: Number(minLiqDistancePct.toFixed(2)),
      openPositions: scoped.length,
    },
  };
}

function computeStopCoverage(positions: PositionLike[]): RiskEngineSignal {
  const scoped = positions.filter((p) => Math.abs(toFinite(p.size)) > 0);
  if (!scoped.length) {
    return {
      rule: "stop_coverage",
      severity: "info",
      verdict: "allow",
      score: 0,
      confidence: 0.9,
      coverage: 1,
      evidence: ["No open positions requiring stop checks"],
      metrics: { missingStopCount: 0, missingStopPct: 0, highLevMissingStops: 0 },
    };
  }

  let missingStopCount = 0;
  let highLevMissingStops = 0;
  for (const position of scoped) {
    const hasStop = toFinite(position.stopLoss) > 0;
    if (!hasStop) {
      missingStopCount += 1;
      if (toFinite(position.leverage, 1) >= 3) highLevMissingStops += 1;
    }
  }
  const missingStopPct = (missingStopCount / scoped.length) * 100;
  const severity =
    highLevMissingStops > 0 || missingStopPct >= 60
      ? "critical"
      : missingStopPct >= 30
        ? "warning"
        : "info";
  const score = clamp(Math.round(missingStopPct), 0, 100);

  return {
    rule: "stop_coverage",
    severity,
    verdict: severityToVerdict(severity),
    score,
    confidence: 0.88,
    coverage: 0.8,
    evidence: [
      `${missingStopCount}/${scoped.length} open positions have no mapped stop`,
      `${highLevMissingStops} high-leverage positions are uncovered`,
    ],
    metrics: {
      missingStopCount,
      missingStopPct: Number(missingStopPct.toFixed(2)),
      highLevMissingStops,
      openPositions: scoped.length,
    },
  };
}

function computeFundingDrag(activities: ActivityLike[], equityUsd: number, now: number): RiskEngineSignal {
  const inWindow = activities.filter((a) => {
    const ts = toFinite(a.timestamp);
    return ts > now - DAY_MS && ts <= now;
  });
  const fundingRows = inWindow.filter((a) => {
    const feeType = String(a.feeType || a.type || "").toLowerCase();
    return feeType.includes("funding");
  });
  if (!fundingRows.length) {
    return {
      rule: "funding_drag",
      severity: "info",
      verdict: "allow",
      score: 0,
      confidence: 0.72,
      coverage: 0.6,
      evidence: ["No recent funding fee events observed"],
      metrics: { funding24hUsd: 0, funding24hBpsOfEquity: 0 },
    };
  }

  const funding24hUsd = fundingRows.reduce((sum, row) => sum + Math.abs(toFinite(row.feeUsd)), 0);
  const funding24hBpsOfEquity =
    equityUsd > 0 ? (funding24hUsd / equityUsd) * 10000 : funding24hUsd > 0 ? 999 : 0;
  const severity = severityFromThreshold(funding24hBpsOfEquity, { warning: 15, critical: 40 });

  return {
    rule: "funding_drag",
    severity,
    verdict: severityToVerdict(severity),
    score: clamp(Math.round(funding24hBpsOfEquity), 0, 100),
    confidence: 0.86,
    coverage: 0.75,
    evidence: [
      `Funding fees in 24h are ${funding24hUsd.toFixed(2)} USD`,
      `Funding drag equals ${funding24hBpsOfEquity.toFixed(1)} bps of tracked equity`,
    ],
    metrics: {
      funding24hUsd: Number(funding24hUsd.toFixed(2)),
      funding24hBpsOfEquity: Number(funding24hBpsOfEquity.toFixed(2)),
    },
  };
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid] || 0;
}

function transferAmountUsd(row: ActivityLike): number {
  const explicit = Math.abs(toFinite(row.amountUsd));
  if (explicit > 0) return explicit;
  return Math.abs(toFinite(row.amount));
}

function toRouteKey(row: ActivityLike): string {
  const from = String(row.from || "unknown").trim();
  const to = String(row.to || "unknown").trim();
  const chain = String(row.chain || "").trim();
  return chain ? `${from}->${to}@${chain}` : `${from}->${to}`;
}

function computeTransferAnomaly(activities: ActivityLike[], now: number): RiskEngineSignal {
  const transfers = activities
    .filter((a) => {
      const type = String(a.activityType || "").toLowerCase();
      return type === "transfer" || type === "internal";
    })
    .filter((a) => {
      const ts = toFinite(a.timestamp);
      return ts > now - WEEK_MS && ts <= now;
    });

  if (transfers.length < 3) {
    return {
      rule: "transfer_anomaly",
      severity: "info",
      verdict: "allow",
      score: 0,
      confidence: 0.62,
      coverage: transfers.length > 0 ? 0.5 : 0.3,
      evidence: ["Not enough recent transfer history to score anomalies robustly"],
      metrics: { transferCount7d: transfers.length, anomalyRatio: 0, latestAmountUsd: 0 },
    };
  }

  const baseline = median(transfers.map((row) => transferAmountUsd(row)).filter((n) => n > 0));
  const recent24h = transfers
    .filter((row) => toFinite(row.timestamp) >= now - DAY_MS)
    .sort((a, b) => transferAmountUsd(b) - transferAmountUsd(a));
  const latest = recent24h[0];
  const latestAmountUsd = latest ? transferAmountUsd(latest) : 0;
  const ratio = baseline > 0 ? latestAmountUsd / baseline : latestAmountUsd > 0 ? 999 : 0;
  const severity =
    ratio >= 4 && latestAmountUsd >= 500
      ? "critical"
      : ratio >= 2.5 && latestAmountUsd >= 250
        ? "warning"
        : "info";

  return {
    rule: "transfer_anomaly",
    severity,
    verdict: severityToVerdict(severity),
    score: clamp(Math.round(ratio * 20), 0, 100),
    confidence: 0.84,
    coverage: 0.85,
    evidence: [
      `Largest transfer in 24h is ${latestAmountUsd.toFixed(2)} USD`,
      `Size is ${ratio.toFixed(2)}x the 7d median transfer size`,
      latest ? `Route ${toRouteKey(latest)} carried the latest outlier` : "No route context",
    ],
    metrics: {
      transferCount7d: transfers.length,
      latestAmountUsd: Number(latestAmountUsd.toFixed(2)),
      medianAmountUsd: Number(baseline.toFixed(2)),
      anomalyRatio: Number(ratio.toFixed(3)),
      routeKey: latest ? toRouteKey(latest) : "n/a",
    },
  };
}

function computeRouteHealth(activities: ActivityLike[], now: number): RiskEngineSignal {
  const transfers = activities
    .filter((a) => {
      const type = String(a.activityType || "").toLowerCase();
      return type === "transfer" || type === "internal";
    })
    .filter((a) => {
      const ts = toFinite(a.timestamp);
      return ts > now - WEEK_MS && ts <= now;
    });
  if (!transfers.length) {
    return {
      rule: "route_health",
      severity: "info",
      verdict: "allow",
      score: 0,
      confidence: 0.58,
      coverage: 0.3,
      evidence: ["No transfer routes observed in the scoring window"],
      metrics: { routeCount: 0, topRouteSharePct: 0, feeBps: 0 },
    };
  }

  const routeCounts = new Map<string, number>();
  let totalAmountUsd = 0;
  let totalFeeUsd = 0;
  for (const row of transfers) {
    const route = toRouteKey(row);
    routeCounts.set(route, (routeCounts.get(route) || 0) + 1);
    totalAmountUsd += transferAmountUsd(row);
    totalFeeUsd += Math.max(0, toFinite(row.feeUsd));
  }

  const entries = Array.from(routeCounts.entries()).sort((a, b) => b[1] - a[1]);
  const topRoute = entries[0] || ["unknown->unknown", 0];
  const topRouteSharePct = transfers.length > 0 ? (topRoute[1] / transfers.length) * 100 : 0;
  const feeBps = totalAmountUsd > 0 ? (totalFeeUsd / totalAmountUsd) * 10000 : 0;
  const severity =
    topRouteSharePct >= 80 || feeBps >= 80
      ? "critical"
      : topRouteSharePct >= 60 || feeBps >= 45
        ? "warning"
        : "info";
  const score = clamp(Math.round(Math.max(topRouteSharePct, feeBps)), 0, 100);

  return {
    rule: "route_health",
    severity,
    verdict: severityToVerdict(severity),
    score,
    confidence: 0.87,
    coverage: 0.9,
    evidence: [
      `Top route ${topRoute[0]} carries ${topRouteSharePct.toFixed(1)}% of recent transfer flow`,
      `Observed route fee load is ${feeBps.toFixed(1)} bps`,
    ],
    metrics: {
      routeCount: entries.length,
      topRouteKey: topRoute[0],
      topRouteSharePct: Number(topRouteSharePct.toFixed(2)),
      feeBps: Number(feeBps.toFixed(2)),
      transferCount7d: transfers.length,
    },
  };
}

function aggregateVerdict(signals: RiskEngineSignal[]): {
  severity: AISignalSeverity;
  verdict: AIVerdict;
  coverage: number;
} {
  let severity: AISignalSeverity = "info";
  let coverageTotal = 0;
  for (const signal of signals) {
    severity = rankSeverity(severity, signal.severity);
    coverageTotal += signal.coverage;
  }
  return {
    severity,
    verdict: severityToVerdict(severity),
    coverage: signals.length ? clamp(coverageTotal / signals.length, 0, 1) : 0,
  };
}

function normalizeAssets(assets: AssetLike[]): AssetLike[] {
  return assets.filter((a) => {
    const symbol = safeSymbol(a.symbol);
    if (STABLE_SYMBOLS.has(symbol)) return true;
    return toFinite(a.valueUsd) > 0 || toFinite(a.allocations) > 0;
  });
}

export function evaluateAdvancedRiskSnapshot(input: RiskEngineInput): RiskEngineOutput {
  const now = toFinite(input.now, Date.now());
  const snapshotTs = toFinite(input.snapshotTs, now);
  const assets = normalizeAssets(Array.isArray(input.assets) ? input.assets : []);
  const positions = Array.isArray(input.positions) ? input.positions : [];
  const activities = Array.isArray(input.activities) ? input.activities : [];
  const equityUsd = assets.reduce((sum, a) => sum + Math.max(0, toFinite(a.valueUsd)), 0);

  const signals: RiskEngineSignal[] = [
    computeConcentration(assets),
    computeLeverageStress(positions),
    computeStopCoverage(positions),
    computeFundingDrag(activities, equityUsd, now),
    computeTransferAnomaly(activities, now),
    computeRouteHealth(activities, now),
  ];
  const aggregate = aggregateVerdict(signals);
  const topSignals = [...signals].sort((a, b) => b.score - a.score).slice(0, 3);

  return {
    generatedAt: now,
    snapshotTs,
    stale: now - snapshotTs > STALE_MS,
    coverage: aggregate.coverage,
    severity: aggregate.severity,
    verdict: aggregate.verdict,
    signals,
    topSignals,
  };
}
