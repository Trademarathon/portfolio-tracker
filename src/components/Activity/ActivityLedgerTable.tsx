"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActivityEventEnriched } from "@/lib/activity/types";
import { formatDistanceToNowStrict } from "date-fns";
import { List } from "react-window";
import { AutoSizer } from "react-virtualized-auto-sizer";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type RowProps = {
  events: ActivityEventEnriched[];
  onOpenEvent: (event: ActivityEventEnriched) => void;
};

function usd(value?: number): string {
  if (!(typeof value === "number" && Number.isFinite(value) && value > 0)) return "-";
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
}

function LedgerRow({
  index,
  style,
  events,
  onOpenEvent,
}: {
  index: number;
  style: React.CSSProperties;
} & RowProps) {
  const event = events[index];
  if (!event) return null;
  return (
    <div style={style} className="px-2">
      <div className="grid grid-cols-[130px_110px_90px_130px_130px_130px_80px_130px_120px] gap-2 items-center h-full border-b border-white/5 hover:bg-white/[0.03] text-xs px-2">
        <div className="text-zinc-400">{formatDistanceToNowStrict(event.timestamp, { addSuffix: true })}</div>
        <div className="text-zinc-200 font-medium truncate" title={`${event.fromLabel} -> ${event.toLabel}`}>
          {event.fromLabel}
          {" -> "}
          {event.toLabel}
        </div>
        <div className="text-zinc-300">{event.asset}</div>
        <div className="text-zinc-200">{event.amount.toLocaleString(undefined, { maximumFractionDigits: 8 })}</div>
        <div className="text-zinc-300">{usd(event.marketPriceUsdAtEvent)}</div>
        <div className="text-zinc-300">{usd(event.costBasisUsdAtEvent)}</div>
        <div className="text-zinc-300">{event.valuationConfidence}</div>
        <div className="text-zinc-300">
          {event.lastSimilarDeltaMinutes ? `${event.lastSimilarDeltaMinutes}m` : "-"}
        </div>
        <div className="text-right">
          <Button
            variant="outline"
            size="sm"
            className="h-7 border-white/10 text-[11px]"
            onClick={() => onOpenEvent(event)}
          >
            Details
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ActivityLedgerTable({
  events,
  onOpenEvent,
}: {
  events: ActivityEventEnriched[];
  onOpenEvent: (event: ActivityEventEnriched) => void;
}) {
  return (
    <Card className="border-white/10 bg-white/[0.03]">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Advanced Ledger</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-[130px_110px_90px_130px_130px_130px_80px_130px_120px] gap-2 px-4 py-2 text-[10px] uppercase tracking-widest text-zinc-500 border-b border-white/10">
          <div>Time</div>
          <div>Route</div>
          <div>Asset</div>
          <div>Amount</div>
          <div>Market Px @ Event</div>
          <div>Cost Basis @ Event</div>
          <div>Confidence</div>
          <div>Last Similar</div>
          <div className="text-right">Actions</div>
        </div>
        <div className={cn("w-full", events.length ? "h-[420px]" : "h-[120px]")}>
          {events.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-zinc-500">
              No events for current filters.
            </div>
          ) : (
            <AutoSizer
              renderProp={({ height, width }: { height: number | undefined; width: number | undefined }) => (
                <List<RowProps>
                  rowCount={events.length}
                  rowHeight={48}
                  rowComponent={(props: any) => <LedgerRow {...props} />}
                  rowProps={{ events, onOpenEvent }}
                  className="custom-scrollbar"
                  style={{ height: height || 420, width: width || 1200 }}
                />
              )}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
