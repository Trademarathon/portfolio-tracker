"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MovementRouteKey, RouteMatrixRow } from "@/lib/activity/types";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDistanceToNowStrict } from "date-fns";

type SortKey = "value" | "fee" | "count" | "last";

export function RouteMatrixCard({
  rows,
  selectedRoute,
  onSelectRoute,
}: {
  rows: RouteMatrixRow[];
  selectedRoute: MovementRouteKey | null;
  onSelectRoute: (route: MovementRouteKey | null) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("value");

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      if (sortKey === "value") return b.totalValueUsd - a.totalValueUsd;
      if (sortKey === "fee") return b.totalFeeUsd - a.totalFeeUsd;
      if (sortKey === "count") return b.count - a.count;
      return b.lastAt - a.lastAt;
    });
    return copy;
  }, [rows, sortKey]);

  return (
    <Card className="border-white/10 bg-white/[0.03]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm">Route Matrix</CardTitle>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className={cn("h-7 text-[11px] border-white/10", sortKey === "value" && "bg-cyan-500/10 text-cyan-200")}
              onClick={() => setSortKey("value")}
            >
              <ArrowUpDown className="h-3 w-3 mr-1" />
              Value
            </Button>
            <Button
              size="sm"
              variant="outline"
              className={cn("h-7 text-[11px] border-white/10", sortKey === "fee" && "bg-cyan-500/10 text-cyan-200")}
              onClick={() => setSortKey("fee")}
            >
              <ArrowUpDown className="h-3 w-3 mr-1" />
              Fee
            </Button>
            <Button
              size="sm"
              variant="outline"
              className={cn("h-7 text-[11px] border-white/10", sortKey === "count" && "bg-cyan-500/10 text-cyan-200")}
              onClick={() => setSortKey("count")}
            >
              <ArrowUpDown className="h-3 w-3 mr-1" />
              Count
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-auto max-h-[300px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-black/40 text-zinc-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2">Route</th>
                <th className="text-right px-3 py-2">Count</th>
                <th className="text-right px-3 py-2">Value</th>
                <th className="text-right px-3 py-2">Fee</th>
                <th className="text-right px-3 py-2">Avg bps</th>
                <th className="text-right px-3 py-2">Last</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                    No routes for current filters.
                  </td>
                </tr>
              )}
              {sorted.map((row) => {
                const isSelected = selectedRoute === row.routeKey;
                return (
                  <tr
                    key={row.routeKey}
                    onClick={() => onSelectRoute(isSelected ? null : row.routeKey)}
                    className={cn(
                      "border-t border-white/5 cursor-pointer hover:bg-white/[0.04]",
                      isSelected && "bg-cyan-500/10"
                    )}
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium text-zinc-200">
                        {row.fromLabel}
                        {" -> "}
                        {row.toLabel}
                      </div>
                      <div className="text-[10px] text-zinc-500">{row.asset}</div>
                    </td>
                    <td className="px-3 py-2 text-right">{row.count}</td>
                    <td className="px-3 py-2 text-right text-zinc-200">
                      ${row.totalValueUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 text-right text-amber-300">
                      ${row.totalFeeUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 text-right">{row.avgFeeBps.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-zinc-400">
                      {row.lastAt ? formatDistanceToNowStrict(row.lastAt, { addSuffix: true }) : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
