import { Transaction, Transfer } from "@/lib/api/types";
import { normalizeSymbol } from "@/lib/utils/normalization";

export type LedgerEventKind =
  | "TRADE_BUY"
  | "TRADE_SELL"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "INTERNAL_MOVE_IN"
  | "INTERNAL_MOVE_OUT"
  | "FEE"
  | "FUNDING";

export interface LedgerEvent {
  id: string;
  kind: LedgerEventKind;
  symbol: string;
  timestamp: number;
  qty: number;
  price?: number;
  feeUsd?: number;
  feeAsset?: string;
  quoteAsset?: string;
  connectionId?: string;
  exchange?: string;
  sourceType?: "cex" | "dex" | "wallet" | "manual";
  estimatedBasis?: boolean;
}

export interface BuildLedgerOptions {
  symbol: string;
  transactions: Transaction[];
  transfers?: Transfer[];
  fromMs?: number;
  toMs?: number;
  depositBasisPrice?: number;
}

function isInRange(ts: number, fromMs?: number, toMs?: number): boolean {
  if (!Number.isFinite(ts) || ts <= 0) return false;
  if (fromMs != null && ts < fromMs) return false;
  if (toMs != null && ts > toMs) return false;
  return true;
}

function toUsdFee(tx: Transaction): number {
  if (typeof tx.feeUsd === "number") return tx.feeUsd;
  if (typeof tx.fee === "number") return tx.fee;
  return 0;
}

function transferKind(transfer: Transfer): LedgerEventKind {
  const t = String(transfer.type || "").toLowerCase();
  const isInternal = Boolean(transfer.isInternalTransfer) || t === "internal";
  if (isInternal) {
    return t.includes("with") ? "INTERNAL_MOVE_OUT" : "INTERNAL_MOVE_IN";
  }
  if (t.includes("with")) return "TRANSFER_OUT";
  return "TRANSFER_IN";
}

export function buildLedgerEvents(options: BuildLedgerOptions): LedgerEvent[] {
  const {
    symbol,
    transactions,
    transfers = [],
    fromMs,
    toMs,
    depositBasisPrice = 0,
  } = options;

  const target = normalizeSymbol(symbol);
  const out: LedgerEvent[] = [];

  for (const tx of transactions || []) {
    const ts = Number(tx.timestamp || 0);
    if (!isInRange(ts, fromMs, toMs)) continue;

    const txSym = normalizeSymbol(tx.symbol || tx.asset || "");
    if (!txSym || txSym !== target) continue;

    const side = String((tx as any).side ?? (tx as any).type ?? "").toLowerCase();
    const amount = Number(tx.amount || 0);
    const price = Number(tx.price || 0);
    if (amount <= 0) continue;

    if (side === "funding" || tx.feeType === "funding") {
      out.push({
        id: String(tx.id),
        kind: "FUNDING",
        symbol: target,
        timestamp: ts,
        qty: amount,
        connectionId: tx.connectionId,
        exchange: tx.exchange,
        sourceType: tx.sourceType,
      });
      continue;
    }

    const isBuy =
      side === "buy" ||
      side === "long" ||
      String(tx.type || "").toLowerCase() === "buy";
    const isSell =
      side === "sell" ||
      side === "short" ||
      String(tx.type || "").toLowerCase() === "sell";
    if (!isBuy && !isSell) continue;
    if (!Number.isFinite(price) || price <= 0) continue;

    out.push({
      id: String(tx.id),
      kind: isBuy ? "TRADE_BUY" : "TRADE_SELL",
      symbol: target,
      timestamp: ts,
      qty: amount,
      price,
      feeUsd: toUsdFee(tx),
      feeAsset: tx.feeAsset || tx.feeCurrency,
      quoteAsset: tx.quoteAsset,
      connectionId: tx.connectionId,
      exchange: tx.exchange,
      sourceType: tx.sourceType,
      estimatedBasis: tx.estimatedBasis,
    });
  }

  for (const tr of transfers || []) {
    const ts = Number((tr as any).timestamp || 0);
    if (!isInRange(ts, fromMs, toMs)) continue;
    const trSym = normalizeSymbol((tr.symbol || tr.asset || "") as string);
    if (!trSym || trSym !== target) continue;

    const qty = Number(tr.amount || 0);
    if (!(qty > 0)) continue;

    const kind = transferKind(tr);
    out.push({
      id: String(tr.id),
      kind,
      symbol: target,
      timestamp: ts,
      qty,
      price: depositBasisPrice > 0 ? depositBasisPrice : undefined,
      feeUsd: typeof tr.feeUsd === "number" ? tr.feeUsd : 0,
      feeAsset: tr.feeAsset,
      connectionId: tr.connectionId,
      sourceType: tr.sourceType,
      estimatedBasis: kind === "TRANSFER_IN" || kind === "INTERNAL_MOVE_IN",
    });
  }

  return out.sort((a, b) => a.timestamp - b.timestamp);
}

