import type { JournalTrade } from "@/contexts/JournalContext";
import { getTradePnl } from "@/lib/journal/reports";

export interface OptionDteBucket {
  id: string;
  label: string;
  count: number;
  totalPnl: number;
}

function getTradeDte(trade: JournalTrade): number | null {
  const info = (trade.info && typeof trade.info === "object") ? trade.info as Record<string, unknown> : {};
  const raw = Number((trade as unknown as { dte?: unknown }).dte ?? info.dte ?? info.daysToExpiry);
  return Number.isFinite(raw) && raw >= 0 ? raw : null;
}

export function buildOptionDteBuckets(trades: JournalTrade[]): OptionDteBucket[] {
  const groups: Array<{ id: string; label: string; test: (dte: number) => boolean }> = [
    { id: "dte_0", label: "0 DTE", test: (dte) => dte === 0 },
    { id: "dte_1_3", label: "1-3 DTE", test: (dte) => dte >= 1 && dte <= 3 },
    { id: "dte_4_7", label: "4-7 DTE", test: (dte) => dte >= 4 && dte <= 7 },
    { id: "dte_8_30", label: "8-30 DTE", test: (dte) => dte >= 8 && dte <= 30 },
    { id: "dte_31_plus", label: "31+ DTE", test: (dte) => dte >= 31 },
  ];

  return groups
    .map((group) => {
      const subset = trades.filter((trade) => {
        const dte = getTradeDte(trade);
        return dte !== null && group.test(dte);
      });

      return {
        id: group.id,
        label: group.label,
        count: subset.length,
        totalPnl: subset.reduce((sum, trade) => sum + getTradePnl(trade), 0),
      };
    })
    .filter((bucket) => bucket.count > 0);
}
