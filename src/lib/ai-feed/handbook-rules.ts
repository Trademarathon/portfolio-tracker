import type { PerpPlan, KeyLevel } from "@/lib/api/session";
import { normalizeSymbol } from "@/lib/utils/normalization";

export type HandbookWarningSignal = {
  id: string;
  type: "PLAYBOOK_RULE_WARNING";
  symbol: string;
  title: string;
  description: string;
  timestamp: number;
  priority: "high" | "medium" | "low";
  data?: Record<string, any>;
};

const DEFAULT_GATE = {
  minDailyVolume: 50_000_000,
  minDailyTrades: 25_000,
  allowedExchanges: ["binance", "bybit"],
};

function getNumeric(value: any): number {
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

function getScreenerValue(data: any, keys: string[]): number {
  for (const key of keys) {
    if (data && data[key] != null) return getNumeric(data[key]);
  }
  return 0;
}

export function evaluatePerpHandbookWarnings({
  perpPlans,
  screenerBySymbol,
  priceBySymbol,
  now = Date.now(),
  touchTolerancePct = 0.0025,
}: {
  perpPlans: PerpPlan[];
  screenerBySymbol: Map<string, any>;
  priceBySymbol: Map<string, number>;
  now?: number;
  touchTolerancePct?: number;
}): HandbookWarningSignal[] {
  const warnings: HandbookWarningSignal[] = [];

  const getPrice = (symbol: string) =>
    priceBySymbol.get(symbol.toUpperCase()) ||
    screenerBySymbol.get(normalizeSymbol(symbol))?.price ||
    0;

  perpPlans.forEach((plan) => {
    if (!plan || !plan.symbol) return;
    if (!plan.handbookTemplate && !plan.touchTwoRequired && !plan.liquidityGate) return;

    const symbol = plan.symbol.toUpperCase();
    const screener = screenerBySymbol.get(normalizeSymbol(symbol)) || screenerBySymbol.get(symbol);
    const gate = { ...DEFAULT_GATE, ...(plan.liquidityGate || {}) };

    const vol24 = getScreenerValue(screener, ["volume24h", "vol24h", "volume"]);
    const trades24 = getScreenerValue(screener, ["trades24h", "tradeCount24h", "trades", "count24h"]);

    if (gate.minDailyVolume && vol24 > 0 && vol24 < gate.minDailyVolume) {
      warnings.push({
        id: `hb-vol-${symbol}`,
        type: "PLAYBOOK_RULE_WARNING",
        symbol,
        title: `${symbol} liquidity gate`,
        description: `24h volume ${Math.round(vol24).toLocaleString()} below ${gate.minDailyVolume.toLocaleString()}.`,
        timestamp: now,
        priority: "high",
        data: { rule: "liquidity_volume" },
      });
    }

    if (gate.minDailyTrades && trades24 > 0 && trades24 < gate.minDailyTrades) {
      warnings.push({
        id: `hb-trades-${symbol}`,
        type: "PLAYBOOK_RULE_WARNING",
        symbol,
        title: `${symbol} trade count gate`,
        description: `24h trades ${Math.round(trades24).toLocaleString()} below ${gate.minDailyTrades.toLocaleString()}.`,
        timestamp: now,
        priority: "high",
        data: { rule: "liquidity_trades" },
      });
    }

    if (gate.allowedExchanges?.length) {
      const exchange = String(screener?.exchange || screener?.source || screener?.venue || "").toLowerCase();
      if (exchange && !gate.allowedExchanges.map((e) => e.toLowerCase()).includes(exchange)) {
        warnings.push({
          id: `hb-exch-${symbol}`,
          type: "PLAYBOOK_RULE_WARNING",
          symbol,
          title: `${symbol} exchange scope`,
          description: `Exchange "${exchange}" not in allowed list (${gate.allowedExchanges.join(", ")}).`,
          timestamp: now,
          priority: "medium",
          data: { rule: "exchange_scope" },
        });
      }
    }

    const dVah = plan.keyLevels?.D_VAH ?? 0;
    const dVal = plan.keyLevels?.D_VAL ?? 0;
    const sVah = plan.keyLevels?.S_VAH ?? 0;
    const sVal = plan.keyLevels?.S_VAL ?? 0;
    if (plan.sessionCompositeEnabled && dVah > 0 && dVal > 0 && sVah > 0 && sVal > 0) {
      if (sVah > dVah || sVal < dVal) {
        warnings.push({
          id: `hb-hierarchy-${symbol}`,
          type: "PLAYBOOK_RULE_WARNING",
          symbol,
          title: `${symbol} hierarchy check`,
          description: `Session composite outside Daily value range.`,
          timestamp: now,
          priority: "medium",
          data: { rule: "hierarchy" },
        });
      }
    } else if (plan.sessionCompositeEnabled && (!dVah || !dVal)) {
      warnings.push({
        id: `hb-daily-missing-${symbol}`,
        type: "PLAYBOOK_RULE_WARNING",
        symbol,
        title: `${symbol} daily composite missing`,
        description: `Daily VAH/VAL not set. Daily composite is required.`,
        timestamp: now,
        priority: "medium",
        data: { rule: "daily_missing" },
      });
    }

    if (plan.touchTwoRequired) {
      const price = getPrice(symbol);
      if (price) {
        const keyLevels = Object.entries(plan.keyLevels || {})
          .filter(([, v]) => !!v && Number(v) > 0)
          .map(([k, v]) => ({ key: k as KeyLevel, value: Number(v) }));
        const nearLevel = keyLevels.find((lvl) =>
          Math.abs((price - lvl.value) / lvl.value) <= touchTolerancePct
        );
        if (nearLevel && !plan.handbookChecklist?.touchTwoObserved) {
          warnings.push({
            id: `hb-touch2-${symbol}-${nearLevel.key}`,
            type: "PLAYBOOK_RULE_WARNING",
            symbol,
            title: `${symbol} Touch 2 required`,
            description: `Price near ${nearLevel.key} (${nearLevel.value.toLocaleString()}). Touch‑2 not confirmed.`,
            timestamp: now,
            priority: "high",
            data: { rule: "touch_two", level: nearLevel.key, levelValue: nearLevel.value },
          });
        }
      }
    }
  });

  return warnings;
}
