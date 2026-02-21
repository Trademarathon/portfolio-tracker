"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { ActivityKpiSummary } from "@/lib/activity/types";
import { ArrowRightLeft, Clock3, DollarSign, Route } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";

function fmtUsd(value: number): string {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function ActivityKpiStrip({ kpis }: { kpis: ActivityKpiSummary }) {
  const topRouteLabel = kpis.topRoute ? `${kpis.topRoute.fromLabel} -> ${kpis.topRoute.toLabel}` : "No route";
  const lastMove =
    kpis.lastMovementAt > 0
      ? `${formatDistanceToNowStrict(kpis.lastMovementAt, { addSuffix: true })}`
      : "No activity";

  const cards = [
    {
      label: "Moved (24h)",
      value: fmtUsd(kpis.movedUsd24h),
      icon: ArrowRightLeft,
      tone: "text-emerald-300",
    },
    {
      label: "Fees (24h)",
      value: fmtUsd(kpis.feesUsd24h),
      icon: DollarSign,
      tone: "text-amber-300",
    },
    {
      label: "Top Route",
      value: topRouteLabel,
      icon: Route,
      tone: "text-cyan-300",
    },
    {
      label: "Last Movement",
      value: lastMove,
      icon: Clock3,
      tone: "text-zinc-300",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label} className="border-white/10 bg-white/[0.03]">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-zinc-500">
                <Icon className="h-3.5 w-3.5" />
                <span>{card.label}</span>
              </div>
              <div className={`text-sm font-semibold ${card.tone}`}>{card.value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
