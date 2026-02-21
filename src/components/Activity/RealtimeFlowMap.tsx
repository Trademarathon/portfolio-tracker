"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActivityEventEnriched, EntityKind, RouteMatrixRow } from "@/lib/activity/types";
import { motion } from "framer-motion";
import { ExchangeIcon } from "@/components/ui/ExchangeIcon";
import { CryptoIcon } from "@/components/ui/CryptoIcon";
import { cn } from "@/lib/utils";

type NodePoint = {
  id: string;
  label: string;
  shortLabel: string;
  x: number;
  y: number;
  r: number;
  kind: EntityKind;
  totalUsd: number;
  topAsset: string;
  movementCount: number;
};

type Edge = {
  key: string;
  from: string;
  to: string;
  asset: string;
  value: number;
  feeBps: number;
  count: number;
  width: number;
  color: string;
  path: string;
  duration: number;
  lastAt: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function pathBetween(a: NodePoint, b: NodePoint): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / len;
  const ny = dx / len;
  const curve = clamp(len * 0.15, 18, 58);
  const cx = mx + nx * curve;
  const cy = my + ny * curve;
  return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
}

function compactUsd(value: number): string {
  if (!Number.isFinite(value)) return "$0";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

function shortLabel(input: string, max = 13): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max - 1)}…`;
}

function kindRank(kind: EntityKind): number {
  if (kind === "exchange") return 4;
  if (kind === "hardware_wallet") return 3;
  if (kind === "software_wallet") return 2;
  return 1;
}

function nodeAccent(kind: EntityKind): string {
  if (kind === "exchange") return "border-cyan-400/35";
  if (kind === "hardware_wallet") return "border-amber-300/35";
  if (kind === "software_wallet") return "border-emerald-300/35";
  return "border-zinc-500/35";
}

function NodeBrand({ node }: { node: NodePoint }) {
  if (node.kind === "exchange") {
    return <ExchangeIcon exchange={node.label} size={16} className="!w-6 !h-6" />;
  }
  if (node.kind === "hardware_wallet") {
    return <CryptoIcon type="hardware" id={node.label} size={16} className="!w-6 !h-6" />;
  }
  return (
    <CryptoIcon
      type="chain"
      id={node.topAsset || node.label}
      size={16}
      className="!w-6 !h-6"
    />
  );
}

export function RealtimeFlowMap({
  matrix,
  events,
}: {
  matrix: RouteMatrixRow[];
  events: ActivityEventEnriched[];
}) {
  const { nodes, edges, totalFlowUsd, recentMoves, topRoutes } = useMemo(() => {
    const top = matrix.slice(0, 14);
    const nodeSet = new Set<string>();
    const nodeStats = new Map<
      string,
      {
        kind: EntityKind;
        totalUsd: number;
        movementCount: number;
        assetMix: Map<string, number>;
      }
    >();

    events.forEach((event) => {
      const notional = Number(event.marketValueUsdAtEvent || 0);
      const ensure = (label: string, kind: EntityKind) => {
        if (!nodeStats.has(label)) {
          nodeStats.set(label, {
            kind,
            totalUsd: 0,
            movementCount: 0,
            assetMix: new Map<string, number>(),
          });
        }
        const row = nodeStats.get(label)!;
        if (kindRank(kind) > kindRank(row.kind)) row.kind = kind;
        row.totalUsd += notional;
        row.movementCount += 1;
        row.assetMix.set(event.asset, (row.assetMix.get(event.asset) || 0) + notional);
      };

      ensure(event.fromLabel, event.fromKind);
      ensure(event.toLabel, event.toKind);
    });

    top.forEach((row) => {
      nodeSet.add(row.fromLabel);
      nodeSet.add(row.toLabel);
    });
    const nodeIds = Array.from(nodeSet).slice(0, 14);
    const nodeMap = new Map<string, NodePoint>();
    const centerX = 500;
    const centerY = 170;
    const radius = 126;
    const total = Math.max(1, nodeIds.length);
    const nodeFlow = new Map<string, number>();
    top.forEach((row) => {
      nodeFlow.set(row.fromLabel, (nodeFlow.get(row.fromLabel) || 0) + row.totalValueUsd);
      nodeFlow.set(row.toLabel, (nodeFlow.get(row.toLabel) || 0) + row.totalValueUsd);
    });
    const maxNodeFlow = Math.max(1, ...Array.from(nodeFlow.values()));

    nodeIds.forEach((id, index) => {
      const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
      const flowRatio = (nodeFlow.get(id) || 0) / maxNodeFlow;
      const stats = nodeStats.get(id);
      const topAsset =
        stats && stats.assetMix.size
          ? Array.from(stats.assetMix.entries()).sort((a, b) => b[1] - a[1])[0][0]
          : "USDT";
      nodeMap.set(id, {
        id,
        label: id,
        shortLabel: shortLabel(id),
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        r: 6.5 + flowRatio * 6.5,
        kind: stats?.kind || "unknown",
        totalUsd: stats?.totalUsd || 0,
        topAsset,
        movementCount: stats?.movementCount || 0,
      });
    });

    const maxValue = Math.max(1, ...top.map((row) => row.totalValueUsd));
    const edges: Edge[] = top
      .map((row) => {
        const from = nodeMap.get(row.fromLabel);
        const to = nodeMap.get(row.toLabel);
        if (!from || !to || from.id === to.id) return null;
        const normalized = row.totalValueUsd / maxValue;
        const width = 1.5 + normalized * 4;
        const hue = row.avgFeeBps > 20 ? "rgba(251,113,133,0.85)" : "rgba(34,211,238,0.85)";
        return {
          key: row.routeKey,
          from: row.fromLabel,
          to: row.toLabel,
          asset: row.asset,
          value: row.totalValueUsd,
          feeBps: row.avgFeeBps,
          count: row.count,
          width,
          color: hue,
          path: pathBetween(from, to),
          duration: clamp(7 - normalized * 4, 2.2, 7),
          lastAt: row.lastAt,
        } satisfies Edge;
      })
      .filter(Boolean) as Edge[];

    const recentMoves = events
      .slice(0, 180)
      .filter((event) => event.marketValueUsdAtEvent && event.marketValueUsdAtEvent > 0)
      .slice(0, 6);
    const topRoutes = top.slice(0, 6);

    return {
      nodes: Array.from(nodeMap.values()),
      edges,
      totalFlowUsd: top.reduce((sum, row) => sum + row.totalValueUsd, 0),
      recentMoves,
      topRoutes,
    };
  }, [matrix, events]);

  return (
    <Card className="border-white/10 bg-white/[0.03] overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Realtime Flow Map</CardTitle>
          <div className="text-[11px] text-zinc-400 flex items-center gap-3">
            <span>{edges.length} routes</span>
            <span>{nodes.length} nodes</span>
            <span>{events.length} events</span>
            <span>
              {totalFlowUsd > 0
                ? `${totalFlowUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })} USD routed`
                : "No active routes"}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="w-full h-[360px] rounded-xl border border-white/10 bg-black/25 relative overflow-hidden">
          <svg viewBox="0 0 1000 340" className="absolute inset-0 w-full h-full">
            <defs>
              <linearGradient id="flow-map-glow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(34,211,238,0.24)" />
                <stop offset="100%" stopColor="rgba(56,189,248,0.03)" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="1000" height="340" fill="url(#flow-map-glow)" />
            {Array.from({ length: 11 }).map((_, i) => (
              <line
                key={`grid-${i}`}
                x1={i * 100}
                y1={0}
                x2={i * 100}
                y2={340}
                stroke="rgba(255,255,255,0.035)"
              />
            ))}
            {Array.from({ length: 7 }).map((_, i) => (
              <line
                key={`hgrid-${i}`}
                x1={0}
                y1={i * 56.6}
                x2={1000}
                y2={i * 56.6}
                stroke="rgba(255,255,255,0.03)"
              />
            ))}

            {edges.map((edge) => (
              <g key={edge.key}>
                <motion.path
                  d={edge.path}
                  fill="none"
                  stroke={edge.color}
                  strokeWidth={edge.width}
                  strokeLinecap="round"
                  strokeOpacity={0.2}
                />
                <motion.path
                  d={edge.path}
                  fill="none"
                  stroke={edge.color}
                  strokeWidth={edge.width}
                  strokeLinecap="round"
                  strokeDasharray="10 16"
                  initial={{ strokeDashoffset: 0 }}
                  animate={{ strokeDashoffset: -200 }}
                  transition={{
                    duration: edge.duration,
                    ease: "linear",
                    repeat: Number.POSITIVE_INFINITY,
                  }}
                />
                <circle r={edge.width * 0.58} fill={edge.color} opacity={0.95}>
                  <animateMotion
                    dur={`${Math.max(1.6, edge.duration * 0.62)}s`}
                    repeatCount="indefinite"
                    path={edge.path}
                  />
                </circle>
                <circle r={edge.width * 0.44} fill="rgba(244,244,245,0.95)" opacity={0.55}>
                  <animateMotion
                    dur={`${Math.max(1.2, edge.duration * 0.5)}s`}
                    repeatCount="indefinite"
                    begin="0.65s"
                    path={edge.path}
                  />
                </circle>
                <circle r={edge.width * 0.35} fill="rgba(125,211,252,0.6)" opacity={0.65}>
                  <animateMotion
                    dur={`${Math.max(2.2, edge.duration * 0.86)}s`}
                    repeatCount="indefinite"
                    begin="1.1s"
                    path={edge.path}
                  />
                </circle>
              </g>
            ))}

            {nodes.map((node) => (
              <g key={node.id}>
                <motion.circle
                  cx={node.x}
                  cy={node.y}
                  r={node.r}
                  fill="rgba(15,23,42,0.95)"
                  stroke="rgba(56,189,248,0.65)"
                  strokeWidth={1.4}
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 2.2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                />
                <text
                  x={node.x}
                  y={node.y + node.r + 12}
                  textAnchor="middle"
                  className="fill-zinc-500"
                  style={{ fontSize: "10px", letterSpacing: "0.03em" }}
                >
                  {node.shortLabel}
                </text>
              </g>
            ))}
          </svg>

          <div className="absolute inset-0 pointer-events-none">
            {nodes.map((node) => (
              <div
                key={`chip-${node.id}`}
                className="absolute pointer-events-auto"
                style={{
                  left: `${(node.x / 1000) * 100}%`,
                  top: `${(node.y / 340) * 100}%`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <div
                  className={cn(
                    "rounded-lg border bg-black/70 backdrop-blur-md px-2 py-1 min-w-[120px] shadow-[0_4px_18px_rgba(2,6,23,0.45)]",
                    nodeAccent(node.kind)
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <NodeBrand node={node} />
                    <span className="text-[10px] text-zinc-100 font-medium truncate">{node.shortLabel}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <div className="flex items-center gap-1">
                      <CryptoIcon type="chain" id={node.topAsset} size={10} className="!w-4 !h-4" />
                      <span className="text-[9px] text-zinc-400">{node.topAsset}</span>
                    </div>
                    <span className="text-[10px] text-emerald-300 font-semibold">{compactUsd(node.totalUsd)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="absolute top-2 left-2 text-[10px] text-zinc-500 rounded border border-white/10 bg-black/55 px-2 py-1">
            Live route particles: direction + intensity
          </div>
          <div className="absolute bottom-3 right-3 text-[10px] text-zinc-500 text-right rounded border border-white/10 bg-black/55 px-2 py-1">
            <div>Edge width = notional. Edge hue = fee pressure.</div>
            <div>Node size = routed value on selected routes.</div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mt-3 text-[11px]">
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
            <div className="text-zinc-400 text-[10px] mb-1">Recent flow tape</div>
            {recentMoves.length === 0 ? (
              <div className="text-zinc-500">No recent high-confidence flow events.</div>
            ) : (
              <div className="space-y-1">
                {recentMoves.map((event) => (
                  <div key={`${event.id}-${event.routeKey}`} className="rounded border border-white/10 px-2 py-1.5 text-zinc-300 bg-black/30">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <ExchangeIcon exchange={event.fromLabel} size={12} className="!w-5 !h-5 shrink-0" />
                        <span className="text-zinc-500">→</span>
                        <ExchangeIcon exchange={event.toLabel} size={12} className="!w-5 !h-5 shrink-0" />
                        <CryptoIcon type="chain" id={event.asset} size={12} className="!w-5 !h-5 shrink-0" />
                        <span className="truncate">{event.asset}</span>
                      </div>
                      <span className="text-emerald-300 font-semibold shrink-0">
                        {compactUsd(Number(event.marketValueUsdAtEvent || 0))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
            <div className="text-zinc-400 text-[10px] mb-1">Top routes by notional</div>
            <div className="space-y-1">
              {topRoutes.map((route) => (
                <div key={route.routeKey} className="rounded border border-white/10 px-2 py-1.5 text-zinc-300 bg-black/30">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <ExchangeIcon exchange={route.fromLabel} size={12} className="!w-5 !h-5 shrink-0" />
                      <span className="text-zinc-500">→</span>
                      <ExchangeIcon exchange={route.toLabel} size={12} className="!w-5 !h-5 shrink-0" />
                      <CryptoIcon type="chain" id={route.asset} size={12} className="!w-5 !h-5 shrink-0" />
                      <span className="truncate">{route.fromLabel} → {route.toLabel}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-emerald-300 font-semibold">{compactUsd(route.totalValueUsd)}</div>
                      <div className="text-[10px] text-zinc-500">{route.avgFeeBps.toFixed(2)} bps</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
