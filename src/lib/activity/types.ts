import type { UnifiedActivity } from "@/lib/api/transactions";

export type EntityKind = "exchange" | "hardware_wallet" | "software_wallet" | "unknown";

export type MovementRouteKey = `${string}->${string}:${string}`;

export type ValuationConfidence = "high" | "medium" | "low";

export type ActivityEventEnriched = {
  id: string;
  timestamp: number;
  asset: string;
  amount: number;
  activityType: UnifiedActivity["activityType"];
  rawType: string;
  side?: string;
  sourceLabel: string;
  fromLabel: string;
  toLabel: string;
  fromKind: EntityKind;
  toKind: EntityKind;
  routeKey: MovementRouteKey;
  txHash?: string;
  address?: string;
  status?: string;
  network?: string;
  sourceConnectionId?: string;
  destinationConnectionId?: string;
  feeAsset?: string;
  feeAmount?: number;
  feeUsd?: number;
  marketPriceUsdAtEvent?: number;
  costBasisUsdAtEvent?: number;
  marketValueUsdAtEvent?: number;
  basisValueUsdAtEvent?: number;
  valuationConfidence: ValuationConfidence;
  lastSimilarAt?: number;
  lastSimilarDeltaMinutes?: number;
  bucketId: string;
  raw: UnifiedActivity;
};

export type RouteMatrixRow = {
  routeKey: MovementRouteKey;
  fromLabel: string;
  toLabel: string;
  asset: string;
  count: number;
  totalAmount: number;
  totalValueUsd: number;
  totalFeeUsd: number;
  avgFeeBps: number;
  lastAt: number;
};

export type MovementMemoryRow = {
  routeKey: MovementRouteKey;
  lastAt: number;
  prevAt?: number;
  avgAmount: number;
  avgFeeUsd: number;
  avgMarketPriceUsd?: number;
  sampleCount: number;
};

export type FeeDriftRow = {
  routeKey: MovementRouteKey;
  asset: string;
  fromLabel: string;
  toLabel: string;
  currentFeeBps: number;
  baselineFeeBps: number;
  driftBps: number;
  sampleCurrent: number;
  sampleBaseline: number;
};

export type ActivityKpiSummary = {
  movedUsd24h: number;
  feesUsd24h: number;
  topRoute: RouteMatrixRow | null;
  lastMovementAt: number;
};

export type ActivityAnomalySeed = {
  topRoutesByNotional: RouteMatrixRow[];
  topFeeDriftRoutes: FeeDriftRow[];
  unusualHourMoves: Array<{ hourUtc: number; count: number; routeKey: MovementRouteKey; asset: string }>;
  recurrenceAnomalies: Array<{ routeKey: MovementRouteKey; deltaMinutes: number; asset: string }>;
  highConfidenceSamples: Array<{
    routeKey: MovementRouteKey;
    asset: string;
    amount: number;
    marketValueUsdAtEvent?: number;
    feeUsd?: number;
    timestamp: number;
  }>;
};

export type ActivityIntelResult = {
  events: ActivityEventEnriched[];
  matrix: RouteMatrixRow[];
  memory: MovementMemoryRow[];
  feeDrift: FeeDriftRow[];
  kpis: ActivityKpiSummary;
  anomalySeed: ActivityAnomalySeed;
};
