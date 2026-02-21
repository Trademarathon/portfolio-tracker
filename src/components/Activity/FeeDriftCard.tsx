"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FeeDriftRow } from "@/lib/activity/types";
import { cn } from "@/lib/utils";

export function FeeDriftCard({ rows }: { rows: FeeDriftRow[] }) {
  return (
    <Card className="border-white/10 bg-white/[0.03]">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Fee Drift vs Baseline</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-auto max-h-[300px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-black/40 text-zinc-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2">Route</th>
                <th className="text-right px-3 py-2">Current bps</th>
                <th className="text-right px-3 py-2">Baseline bps</th>
                <th className="text-right px-3 py-2">Drift</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">
                    No fee drift data yet.
                  </td>
                </tr>
              )}
              {rows.slice(0, 10).map((row) => (
                <tr key={row.routeKey} className="border-t border-white/5">
                  <td className="px-3 py-2 text-zinc-200">{row.routeKey}</td>
                  <td className="px-3 py-2 text-right">{row.currentFeeBps.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">{row.baselineFeeBps.toFixed(2)}</td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right font-semibold",
                      row.driftBps > 0 ? "text-rose-300" : row.driftBps < 0 ? "text-emerald-300" : "text-zinc-300"
                    )}
                  >
                    {row.driftBps > 0 ? "+" : ""}
                    {row.driftBps.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
