import type { JournalTrade } from "@/contexts/JournalContext";
import { getTradePnl } from "@/lib/journal/reports";

export type TradeInsightId =
  | "quick_loss"
  | "oversized_loser"
  | "high_rr_winner"
  | "fee_heavy"
  | "long_hold_winner";

export type TradeInsight = {
  id: TradeInsightId;
  label: string;
  tradeId: string;
  severity: "low" | "medium" | "high";
};

export function deriveTradeInsights(trade: JournalTrade): TradeInsight[] {
  const insights: TradeInsight[] = [];
  const pnl = getTradePnl(trade);
  const holdMs = Number(trade.holdTime ?? 0);
  const fees = Math.abs(Number(trade.fees ?? trade.feeUsd ?? trade.fee ?? 0));
  const size = Number(trade.cost ?? Math.abs(Number(trade.amount ?? 0) * Number(trade.entryPrice ?? trade.price ?? 0)));

  if (pnl < 0 && holdMs > 0 && holdMs < 5 * 60 * 1000) {
    insights.push({ id: "quick_loss", label: "Quick loss", tradeId: trade.id, severity: "medium" });
  }

  if (pnl < 0 && size > 0 && Math.abs(pnl) > size * 0.03) {
    insights.push({ id: "oversized_loser", label: "Oversized loser", tradeId: trade.id, severity: "high" });
  }

  if (pnl > 0 && Number(trade.mfe ?? 0) > 0 && Number(trade.mae ?? 0) > 0 && Number(trade.mfe) / Math.abs(Number(trade.mae)) > 2.5) {
    insights.push({ id: "high_rr_winner", label: "High R winner", tradeId: trade.id, severity: "low" });
  }

  if (fees > 0 && Math.abs(pnl) > 0 && fees / Math.max(1e-9, Math.abs(pnl)) > 0.25) {
    insights.push({ id: "fee_heavy", label: "Fee heavy", tradeId: trade.id, severity: "medium" });
  }

  if (pnl > 0 && holdMs > 24 * 60 * 60 * 1000) {
    insights.push({ id: "long_hold_winner", label: "Long hold winner", tradeId: trade.id, severity: "low" });
  }

  return insights;
}
