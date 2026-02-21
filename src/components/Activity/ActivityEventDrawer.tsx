"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ActivityEventEnriched } from "@/lib/activity/types";
import { format } from "date-fns";

function usd(value?: number): string {
  if (!(typeof value === "number" && Number.isFinite(value))) return "-";
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
}

export function ActivityEventDrawer({
  event,
  open,
  onOpenChange,
  aiNote,
}: {
  event: ActivityEventEnriched | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aiNote?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-white/10 bg-zinc-950 text-zinc-200">
        {!event ? null : (
          <>
            <DialogHeader>
              <DialogTitle className="text-base">Movement Event Details</DialogTitle>
              <DialogDescription className="text-zinc-500">
                {event.routeKey}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="text-zinc-500">Time</div>
                <div className="text-zinc-100">{format(event.timestamp, "yyyy-MM-dd HH:mm:ss")}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="text-zinc-500">Type</div>
                <div className="text-zinc-100">{event.rawType}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="text-zinc-500">Asset / Amount</div>
                <div className="text-zinc-100">
                  {event.asset} · {event.amount.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="text-zinc-500">Fee</div>
                <div className="text-zinc-100">
                  {event.feeAmount ? `${event.feeAmount} ${event.feeAsset || ""}` : "-"} ({usd(event.feeUsd)})
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="text-zinc-500">Market Px @ Event</div>
                <div className="text-zinc-100">{usd(event.marketPriceUsdAtEvent)}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="text-zinc-500">Cost Basis @ Event</div>
                <div className="text-zinc-100">{usd(event.costBasisUsdAtEvent)}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="text-zinc-500">Market Value</div>
                <div className="text-zinc-100">{usd(event.marketValueUsdAtEvent)}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="text-zinc-500">Basis Value</div>
                <div className="text-zinc-100">{usd(event.basisValueUsdAtEvent)}</div>
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-2 text-xs">
              <div className="text-zinc-500">Provenance</div>
              <div>Source: {event.sourceLabel}</div>
              <div>
                Route: {event.fromLabel}
                {" -> "}
                {event.toLabel}
              </div>
              <div>Confidence: {event.valuationConfidence}</div>
              <div>Network: {event.network || "-"}</div>
              <div>Tx Hash: {event.txHash || "-"}</div>
            </div>
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-3 text-xs">
              <div className="text-cyan-200 mb-1">AI / Deterministic note</div>
              <div className="text-zinc-200">{aiNote || "No insight yet."}</div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
