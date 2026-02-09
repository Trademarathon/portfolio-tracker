"use client";

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
    Shield,
    TrendingDown,
    AlertTriangle,
    Percent,
    Gauge,
    BarChart3,
    ArrowDownRight,
    Lock
} from 'lucide-react';
import { Position } from '@/lib/api/types';

interface RiskMetricsPanelProps {
    positions: Position[];
    totalValue: number;
    totalPnl: number;
    drawdown?: {
        current: number;
        max: number;
        peak: number;
    };
}

interface MetricCardProps {
    label: string;
    value: string | number;
    subValue?: string;
    icon: React.ReactNode;
    color: 'emerald' | 'amber' | 'rose' | 'blue' | 'purple' | 'zinc';
    isNegative?: boolean;
}

function MetricCard({ label, value, subValue, icon, color, isNegative }: MetricCardProps) {
    const colorClasses = {
        emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        amber: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        rose: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
        blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        purple: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
        zinc: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
                "flex items-center gap-3 p-3 rounded-lg border",
                colorClasses[color]
            )}
        >
            <div className={cn("p-2 rounded-lg", colorClasses[color].split(' ')[1])}>
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
                    {label}
                </div>
                <div className={cn(
                    "text-lg font-bold font-mono",
                    isNegative ? "text-rose-400" : "text-white"
                )}>
                    {value}
                </div>
                {subValue && (
                    <div className="text-[10px] text-zinc-500">
                        {subValue}
                    </div>
                )}
            </div>
        </motion.div>
    );
}

export function RiskMetricsPanel({
    positions,
    totalValue,
    totalPnl,
    drawdown = { current: 0, max: 0, peak: 0 }
}: RiskMetricsPanelProps) {

    const metrics = useMemo(() => {
        // Calculate margin used and effective leverage
        let totalNotional = 0;
        let totalMarginUsed = 0;
        let closestLiqPercent = Infinity;
        let longExposure = 0;
        let shortExposure = 0;

        positions.forEach(pos => {
            const markPrice = pos.markPrice || pos.entryPrice || 0;
            const notional = Math.abs(pos.size * markPrice);
            totalNotional += notional;

            // Estimate margin based on leverage (if available) or assume 10x
            const leverage = pos.leverage || 10;
            totalMarginUsed += notional / leverage;

            // Track long/short exposure
            if (pos.size > 0) {
                longExposure += notional;
            } else {
                shortExposure += notional;
            }

            // Calculate distance to liquidation
            if (pos.liquidationPrice && pos.markPrice) {
                const distToLiq = Math.abs((pos.markPrice - pos.liquidationPrice) / pos.markPrice) * 100;
                if (distToLiq < closestLiqPercent) {
                    closestLiqPercent = distToLiq;
                }
            }
        });

        const effectiveLeverage = totalValue > 0 ? totalNotional / totalValue : 0;
        const marginUsagePercent = totalValue > 0 ? (totalMarginUsed / totalValue) * 100 : 0;
        const netExposure = longExposure - shortExposure;
        const grossExposure = longExposure + shortExposure;

        return {
            marginUsed: totalMarginUsed,
            marginUsagePercent,
            effectiveLeverage,
            closestLiqPercent: closestLiqPercent === Infinity ? null : closestLiqPercent,
            longExposure,
            shortExposure,
            netExposure,
            grossExposure,
            positionCount: positions.length
        };
    }, [positions, totalValue]);

    // Determine risk level color
    const getRiskColor = (): 'emerald' | 'amber' | 'rose' => {
        if (metrics.marginUsagePercent > 80 || (metrics.closestLiqPercent && metrics.closestLiqPercent < 10)) {
            return 'rose';
        }
        if (metrics.marginUsagePercent > 50 || (metrics.closestLiqPercent && metrics.closestLiqPercent < 25)) {
            return 'amber';
        }
        return 'emerald';
    };

    return (
        <Card className="h-full bg-zinc-900/80 backdrop-blur-xl border-zinc-800/50 overflow-hidden">
            <CardHeader className="py-3 border-b border-white/5">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-blue-500" />
                        Risk Metrics
                    </CardTitle>

                    {/* Risk Status */}
                    <div className={cn(
                        "flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                        getRiskColor() === 'emerald' && "bg-emerald-500/10 text-emerald-500",
                        getRiskColor() === 'amber' && "bg-amber-500/10 text-amber-500",
                        getRiskColor() === 'rose' && "bg-rose-500/10 text-rose-500"
                    )}>
                        <span className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            getRiskColor() === 'emerald' && "bg-emerald-500",
                            getRiskColor() === 'amber' && "bg-amber-500",
                            getRiskColor() === 'rose' && "bg-rose-500 animate-pulse"
                        )} />
                        {getRiskColor() === 'emerald' ? 'Low Risk' : getRiskColor() === 'amber' ? 'Moderate' : 'High Risk'}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-3 space-y-3">
                {/* Top Row - Key Metrics */}
                <div className="grid grid-cols-2 gap-3">
                    <MetricCard
                        label="Margin Usage"
                        value={`${metrics.marginUsagePercent.toFixed(1)}%`}
                        subValue={`$${metrics.marginUsed.toLocaleString(undefined, { maximumFractionDigits: 0 })} used`}
                        icon={<Lock className="w-4 h-4" />}
                        color={metrics.marginUsagePercent > 80 ? 'rose' : metrics.marginUsagePercent > 50 ? 'amber' : 'emerald'}
                    />
                    <MetricCard
                        label="Eff. Leverage"
                        value={`${metrics.effectiveLeverage.toFixed(2)}x`}
                        subValue={`${metrics.positionCount} positions`}
                        icon={<Gauge className="w-4 h-4" />}
                        color={metrics.effectiveLeverage > 5 ? 'rose' : metrics.effectiveLeverage > 2 ? 'amber' : 'blue'}
                    />
                </div>

                {/* Liquidation Risk */}
                <MetricCard
                    label="Closest Liquidation"
                    value={metrics.closestLiqPercent ? `${metrics.closestLiqPercent.toFixed(1)}% away` : 'No positions'}
                    subValue={metrics.closestLiqPercent && metrics.closestLiqPercent < 25 ? '⚠ Monitor closely' : undefined}
                    icon={<AlertTriangle className="w-4 h-4" />}
                    color={metrics.closestLiqPercent && metrics.closestLiqPercent < 10 ? 'rose' :
                        metrics.closestLiqPercent && metrics.closestLiqPercent < 25 ? 'amber' : 'zinc'}
                />

                {/* Drawdown */}
                <MetricCard
                    label="Current Drawdown"
                    value={`-${drawdown.current.toFixed(2)}%`}
                    subValue={`Max: -${drawdown.max.toFixed(2)}% | Peak: $${drawdown.peak.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                    icon={<ArrowDownRight className="w-4 h-4" />}
                    color={drawdown.current > 10 ? 'rose' : drawdown.current > 5 ? 'amber' : 'zinc'}
                    isNegative={drawdown.current > 0}
                />

                {/* Exposure Bar */}
                <div className="p-3 rounded-lg bg-zinc-800/50">
                    <div className="flex items-center justify-between text-[10px] mb-2">
                        <span className="text-emerald-500 font-bold">
                            LONG ${(metrics.longExposure / 1000).toFixed(1)}k
                        </span>
                        <span className="text-zinc-500">Exposure</span>
                        <span className="text-rose-500 font-bold">
                            SHORT ${(metrics.shortExposure / 1000).toFixed(1)}k
                        </span>
                    </div>
                    <div className="h-2 bg-zinc-700 rounded-full overflow-hidden flex">
                        {metrics.grossExposure > 0 && (
                            <>
                                <div
                                    className="bg-emerald-500 h-full"
                                    style={{ width: `${(metrics.longExposure / metrics.grossExposure) * 100}%` }}
                                />
                                <div
                                    className="bg-rose-500 h-full"
                                    style={{ width: `${(metrics.shortExposure / metrics.grossExposure) * 100}%` }}
                                />
                            </>
                        )}
                    </div>
                    <div className="text-center text-[10px] text-zinc-500 mt-1">
                        Net: {metrics.netExposure >= 0 ? '+' : ''}${(metrics.netExposure / 1000).toFixed(1)}k
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
