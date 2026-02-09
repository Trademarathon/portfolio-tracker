"use client";

import React from 'react';
import { Card, CardContent } from "@/components/ui/card";

interface Metrics {
    totalPnl: number;
    winRate: number;
    winCount: number;
    lossCount: number;
    totalTrades: number;
    avgWin: number;
    avgLoss: number;
    volumeTraded: number;
    profitFactor: number;
}

interface AdvancedMetricsProps {
    metrics: Metrics;
}

export default function AdvancedMetrics({ metrics }: AdvancedMetricsProps) {
    const MetricItem = ({ label, value, subValue, color }: { label: string, value: string, subValue?: string, color?: string }) => (
        <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">{label}</span>
            <div className="flex items-baseline gap-2">
                <span className={`text-lg font-bold ${color || 'text-zinc-100'}`}>{value}</span>
                {subValue && <span className="text-[10px] text-zinc-500">{subValue}</span>}
            </div>
        </div>
    );

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 px-1">
            <MetricItem
                label="Total PNL ($)"
                value={`${metrics.totalPnl >= 0 ? '+' : ''}${metrics.totalPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                color={metrics.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}
            />
            <MetricItem
                label="Win Rate"
                value={`${metrics.winRate.toFixed(1)}%`}
                subValue={`${metrics.winCount} / ${metrics.totalTrades}`}
            />
            <MetricItem
                label="Average Win"
                value={`$${metrics.avgWin.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                color="text-emerald-400/80"
            />
            <MetricItem
                label="Average Loss"
                value={`$${metrics.avgLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                color="text-red-400/80"
            />
            <MetricItem
                label="Volume Traded"
                value={`$${(metrics.volumeTraded / 1000).toFixed(1)}k`}
            />
            <MetricItem
                label="Profit Factor"
                value={metrics.profitFactor.toFixed(2)}
                color={metrics.profitFactor >= 2 ? 'text-emerald-400' : metrics.profitFactor >= 1 ? 'text-zinc-100' : 'text-orange-400'}
            />
            <MetricItem
                label="Win Count"
                value={metrics.winCount.toString()}
            />
            <MetricItem
                label="Loss Count"
                value={metrics.lossCount.toString()}
            />
        </div>
    );
}
