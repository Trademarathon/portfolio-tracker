"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MovementMemoryRow, MovementRouteKey } from "@/lib/activity/types";
import { formatDistanceToNowStrict } from "date-fns";
import { Button } from "@/components/ui/button";

export function MovementMemoryPanel({
  rows,
  onFocusRoute,
}: {
  rows: MovementMemoryRow[];
  onFocusRoute: (route: MovementRouteKey) => void;
}) {
  return (
    <Card className="border-white/10 bg-white/[0.03]">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Movement Memory</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2 max-h-[300px] overflow-auto">
          {rows.length === 0 && <div className="text-xs text-zinc-500 py-4">No recurrence memory yet.</div>}
          {rows.slice(0, 14).map((row) => {
            const recurrence =
              row.lastAt && row.prevAt
                ? Math.max(0, Math.round((row.lastAt - row.prevAt) / 60_000))
                : null;
            return (
              <div key={row.routeKey} className="rounded-lg border border-white/8 bg-white/[0.02] p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-zinc-100 font-medium">{row.routeKey}</div>
                    <div className="text-[11px] text-zinc-500">
                      Last {row.lastAt ? formatDistanceToNowStrict(row.lastAt, { addSuffix: true }) : "n/a"}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 border-white/10 text-[11px]"
                    onClick={() => onFocusRoute(row.routeKey)}
                  >
                    Focus
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="text-zinc-500">
                    Avg amount
                    <div className="text-zinc-200 font-medium">{row.avgAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })}</div>
                  </div>
                  <div className="text-zinc-500">
                    Avg fee
                    <div className="text-amber-300 font-medium">${row.avgFeeUsd.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
                  </div>
                  <div className="text-zinc-500">
                    Recurrence
                    <div className="text-zinc-200 font-medium">{recurrence != null ? `${recurrence}m` : "n/a"}</div>
                  </div>
                  <div className="text-zinc-500">
                    Samples
                    <div className="text-zinc-200 font-medium">{row.sampleCount}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
