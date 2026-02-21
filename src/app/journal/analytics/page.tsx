"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useJournal } from "@/contexts/JournalContext";
import { getHours, getDay } from "date-fns";
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Percent,
    Clock,
    BarChart3,
    Activity,
    Target,
} from "lucide-react";

const SESSIONS = [
    { name: "Asia", startHour: 0, endHour: 8 },
    { name: "London", startHour: 8, endHour: 16 },
    { name: "New York", startHour: 13, endHour: 22 },
    { name: "Off-Hours", startHour: 22, endHour: 24 },
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const HOLD_TIME_BUCKETS = [
    { label: "< 1h", max: 60 * 60 * 1000 },
    { label: "1-4h", max: 4 * 60 * 60 * 1000 },
    { label: "4-8h", max: 8 * 60 * 60 * 1000 },
    { label: "8-24h", max: 24 * 60 * 60 * 1000 },
    { label: "1-3d", max: 3 * 24 * 60 * 60 * 1000 },
    { label: "> 3d", max: Infinity },
];

interface MetricCardProps {
    title: string;
    value: string;
    subtitle?: string;
    icon: React.ElementType;
    color: "emerald" | "rose" | "blue" | "amber" | "violet" | "zinc";
    delay?: number;
}

function MetricCard({ title, value, subtitle, icon: Icon, color, delay = 0 }: MetricCardProps) {
    const colorClasses = {
        emerald: "bg-emerald-500/20 text-emerald-400",
        rose: "bg-rose-500/20 text-rose-400",
        blue: "bg-blue-500/20 text-blue-400",
        amber: "bg-amber-500/20 text-amber-400",
        violet: "bg-violet-500/20 text-violet-400",
        zinc: "bg-zinc-700/50 text-zinc-300",
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50"
        >
            <div className="flex items-center gap-3 mb-2">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", colorClasses[color])}>
                    <Icon className="w-4 h-4" />
                </div>
                <span className="text-xs text-zinc-500 uppercase tracking-wider font-medium">{title}</span>
            </div>
            <p className="text-xl font-black text-white">{value}</p>
            {subtitle && <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>}
        </motion.div>
    );
}

function HorizontalBarChart({
    data,
    maxValue,
}: {
    data: { label: string; value: number; color: string }[];
    maxValue: number;
}) {
    return (
        <div className="space-y-2">
            {data.map((item, i) => (
                <div key={item.label} className="flex items-center gap-3">
                    <span className="text-xs text-zinc-400 w-20 text-right">{item.label}</span>
                    <div className="flex-1 h-6 bg-zinc-800/50 rounded overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(Math.abs(item.value) / Math.max(1, maxValue)) * 100}%` }}
                            transition={{ delay: i * 0.05, duration: 0.5 }}
                            className={cn("h-full rounded", item.color)}
                        />
                    </div>
                    <span
                        className={cn(
                            "text-xs font-bold w-16 text-right",
                            item.value >= 0 ? "text-emerald-400" : "text-rose-400"
                        )}
                    >
                        ${Math.abs(item.value).toFixed(0)}
                    </span>
                </div>
            ))}
        </div>
    );
}

function AreaLineChart({
    values,
    positive,
}: {
    values: number[];
    positive: boolean;
}) {
    if (!values.length) {
        return (
            <div className="h-full w-full flex items-center justify-center text-zinc-600 text-xs">
                No closed-trade series yet
            </div>
        );
    }

    const width = 100;
    const height = 40;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(1, max - min);

    const points = values
        .map((value, idx) => {
            const x = (idx / Math.max(1, values.length - 1)) * width;
            const y = height - ((value - min) / range) * height;
            return `${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(" ");

    const fillPoints = `0,${height} ${points} ${width},${height}`;
    const strokeClass = positive ? "text-emerald-400" : "text-rose-400";
    const fillClass = positive ? "fill-emerald-500/20" : "fill-rose-500/20";

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
            <polygon className={fillClass} points={fillPoints} />
            <polyline className={cn("fill-none stroke-2", strokeClass)} points={points} />
        </svg>
    );
}

export default function AnalyticsPage() {
    const { filteredTrades, stats, preferences, isLoading } = useJournal();

    const closedTrades = useMemo(
        () => filteredTrades.filter((t) => !t.isOpen).sort((a, b) => a.timestamp - b.timestamp),
        [filteredTrades]
    );

    const curveStats = useMemo(() => {
        let equity = 0;
        let peak = 0;
        const equityCurve: number[] = [];
        const drawdownCurve: number[] = [];

        closedTrades.forEach((trade) => {
            equity += Number(trade.realizedPnl || 0);
            peak = Math.max(peak, equity);
            const dd = equity - peak;
            equityCurve.push(equity);
            drawdownCurve.push(dd);
        });

        return {
            equityCurve,
            drawdownCurve,
            largestDrawdown: drawdownCurve.length ? Math.min(...drawdownCurve) : 0,
            endingEquity: equityCurve.length ? equityCurve[equityCurve.length - 1] : 0,
        };
    }, [closedTrades]);

    const advancedMetrics = useMemo(() => {
        if (closedTrades.length === 0) {
            return {
                sharpeRatio: 0,
                sortinoRatio: 0,
                avgMae: 0,
                avgMfe: 0,
                mfeMaeRatio: 0,
                expectedValue: 0,
                totalFees: 0,
                totalFunding: 0,
                limitFees: 0,
                marketFees: 0,
                unknownFees: 0,
            };
        }

        const returns = closedTrades.map((t) => Number(t.realizedPnl || 0));
        const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
        const stdDev = Math.sqrt(variance);

        const negativeReturns = returns.filter((r) => r < 0);
        const negVariance = negativeReturns.length > 0
            ? negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length
            : 0;
        const downside = Math.sqrt(negVariance);

        const avgMae = closedTrades.reduce((sum, t) => sum + Number(t.mae || 0), 0) / closedTrades.length;
        const avgMfe = closedTrades.reduce((sum, t) => sum + Number(t.mfe || 0), 0) / closedTrades.length;

        const feeBreakdown = closedTrades.reduce(
            (acc, trade) => {
                const fee = Math.abs(Number(trade.fees || 0));
                if (!fee) return acc;

                const info = (trade as unknown as { info?: Record<string, unknown> }).info || {};
                const makerHint = info.isMaker ?? info.maker ?? info.liquidity ?? info.orderType;
                const hint = String(makerHint ?? "").toLowerCase();

                if (makerHint === true || hint === "maker" || hint === "limit" || hint === "postonly") {
                    acc.limit += fee;
                } else if (makerHint === false || hint === "taker" || hint === "market") {
                    acc.market += fee;
                } else {
                    acc.unknown += fee;
                }
                return acc;
            },
            { limit: 0, market: 0, unknown: 0 }
        );

        const totalFunding = closedTrades.reduce((sum, t) => sum + Number(t.funding || 0), 0);

        const winRate = stats.winningTrades / Math.max(1, closedTrades.length);
        const avgWin = stats.avgWin;
        const avgLoss = stats.avgLoss;
        const expectedValue = (winRate * avgWin) - ((1 - winRate) * avgLoss);

        return {
            sharpeRatio: stdDev > 0 ? avgReturn / stdDev : 0,
            sortinoRatio: downside > 0 ? avgReturn / downside : 0,
            avgMae: Math.abs(avgMae),
            avgMfe: avgMfe,
            mfeMaeRatio: avgMae !== 0 ? avgMfe / Math.abs(avgMae) : 0,
            expectedValue,
            totalFees: feeBreakdown.limit + feeBreakdown.market + feeBreakdown.unknown,
            totalFunding,
            limitFees: feeBreakdown.limit,
            marketFees: feeBreakdown.market,
            unknownFees: feeBreakdown.unknown,
        };
    }, [closedTrades, stats]);

    const sessionData = useMemo(() => {
        return SESSIONS.map((session) => {
            const sessionTrades = closedTrades.filter((t) => {
                const hour = getHours(new Date(t.timestamp));
                return hour >= session.startHour && hour < session.endHour;
            });
            const pnl = sessionTrades.reduce((sum, t) => sum + Number(t.realizedPnl || 0), 0);
            return {
                label: session.name,
                value: pnl,
                color: pnl >= 0 ? "bg-emerald-500" : "bg-rose-500",
                count: sessionTrades.length,
            };
        });
    }, [closedTrades]);

    const dayData = useMemo(() => {
        return DAYS.map((day, index) => {
            const dayTrades = closedTrades.filter((t) => getDay(new Date(t.timestamp)) === index);
            const pnl = dayTrades.reduce((sum, t) => sum + Number(t.realizedPnl || 0), 0);
            return {
                label: day,
                value: pnl,
                color: pnl >= 0 ? "bg-emerald-500" : "bg-rose-500",
                count: dayTrades.length,
            };
        });
    }, [closedTrades]);

    const holdTimeData = useMemo(() => {
        return HOLD_TIME_BUCKETS.map((bucket, i) => {
            const prevMax = i > 0 ? HOLD_TIME_BUCKETS[i - 1].max : 0;
            const bucketTrades = closedTrades.filter((t) => {
                const holdTime = Number(t.holdTime || 0);
                return holdTime >= prevMax && holdTime < bucket.max;
            });

            const pnl = bucketTrades.reduce((sum, t) => sum + Number(t.realizedPnl || 0), 0);
            return {
                label: bucket.label,
                value: pnl,
                color: pnl >= 0 ? "bg-emerald-500" : "bg-rose-500",
                count: bucketTrades.length,
            };
        });
    }, [closedTrades]);

    const hourlyData = useMemo(() => {
        return Array.from({ length: 24 }, (_, hour) => {
            const hourTrades = closedTrades.filter((t) => getHours(new Date(t.timestamp)) === hour);
            const pnl = hourTrades.reduce((sum, t) => sum + Number(t.realizedPnl || 0), 0);
            return {
                label: `${hour}:00`,
                value: pnl,
                color: pnl >= 0 ? "bg-emerald-500" : "bg-rose-500",
                count: hourTrades.length,
            };
        });
    }, [closedTrades]);

    const maxSessionPnl = Math.max(...sessionData.map((d) => Math.abs(d.value)), 1);
    const maxDayPnl = Math.max(...dayData.map((d) => Math.abs(d.value)), 1);
    const maxHoldTimePnl = Math.max(...holdTimeData.map((d) => Math.abs(d.value)), 1);

    const fundingPaid = Math.abs(Math.min(0, advancedMetrics.totalFunding));
    const fundingReceived = Math.max(0, advancedMetrics.totalFunding);

    const formatCurrency = (v: number) => {
        if (preferences.hideBalances) return "••••";
        return `$${Math.abs(v).toFixed(2)}`;
    };

    const formatCurrencySigned = (v: number) => {
        if (preferences.hideBalances) return "••••";
        const sign = v > 0 ? "+" : v < 0 ? "-" : "";
        return `${sign}$${Math.abs(v).toFixed(2)}`;
    };

    const formatHoldTime = (ms: number) => {
        const hours = ms / (1000 * 60 * 60);
        if (hours < 24) return `${hours.toFixed(1)}h`;
        return `${(hours / 24).toFixed(1)}d`;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50"
                >
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Lifetime PnL</h3>
                    <div className="h-40">
                        <AreaLineChart values={curveStats.equityCurve} positive={curveStats.endingEquity >= 0} />
                    </div>
                    <div className="mt-4 flex items-center justify-center">
                        <span className={cn("text-2xl font-black", stats.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                            {formatCurrencySigned(stats.totalPnl)}
                        </span>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50"
                >
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Drawdown($)</h3>
                    <div className="h-40">
                        <AreaLineChart values={curveStats.drawdownCurve} positive={false} />
                    </div>
                    <div className="mt-4 flex items-center justify-center">
                        <span className="text-2xl font-black text-rose-400">
                            {formatCurrencySigned(curveStats.largestDrawdown)}
                        </span>
                    </div>
                </motion.div>
            </div>

            <div className="grid grid-cols-5 gap-4">
                <MetricCard title="Total PnL" value={formatCurrencySigned(stats.totalPnl)} icon={DollarSign} color={stats.totalPnl >= 0 ? "emerald" : "rose"} delay={0.05} />
                <MetricCard title="Volume Traded" value={formatCurrency(stats.totalVolume)} icon={BarChart3} color="blue" delay={0.1} />
                <MetricCard title="Avg Trade Size" value={formatCurrency(stats.totalVolume / Math.max(1, stats.totalTrades))} icon={Activity} color="violet" delay={0.15} />
                <MetricCard title="Avg Hold Time" value={formatHoldTime(stats.avgHoldTime)} icon={Clock} color="amber" delay={0.2} />
                <MetricCard title="Win Rate" value={`${stats.winRate.toFixed(1)}%`} icon={Percent} color="emerald" delay={0.25} />
                <MetricCard title="Average Win" value={formatCurrency(stats.avgWin)} icon={TrendingUp} color="emerald" delay={0.3} />
                <MetricCard title="Average Loss" value={formatCurrency(stats.avgLoss)} icon={TrendingDown} color="rose" delay={0.35} />
                <MetricCard title="Sharpe Ratio" value={advancedMetrics.sharpeRatio.toFixed(2)} icon={Activity} color="zinc" delay={0.4} />
                <MetricCard title="Sortino Ratio" value={advancedMetrics.sortinoRatio.toFixed(2)} icon={Activity} color="zinc" delay={0.45} />
                <MetricCard title="Profit Factor" value={stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)} icon={Target} color="emerald" delay={0.5} />
                <MetricCard title="Average MAE" value={formatCurrency(advancedMetrics.avgMae)} icon={TrendingDown} color="rose" delay={0.55} />
                <MetricCard title="Average MFE" value={formatCurrency(advancedMetrics.avgMfe)} icon={TrendingUp} color="emerald" delay={0.6} />
                <MetricCard title="MFE/MAE Ratio" value={advancedMetrics.mfeMaeRatio.toFixed(2)} icon={Activity} color="zinc" delay={0.65} />
                <MetricCard title="Expected Value" value={formatCurrencySigned(advancedMetrics.expectedValue)} icon={DollarSign} color={advancedMetrics.expectedValue >= 0 ? "emerald" : "rose"} delay={0.7} />
                <MetricCard title="Total Fees" value={formatCurrency(advancedMetrics.totalFees)} icon={DollarSign} color="rose" delay={0.75} />
            </div>

            <div className="grid grid-cols-2 gap-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50"
                >
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Order Types & Fees</h3>
                    <div className="grid grid-cols-4 gap-4 text-center">
                        <div>
                            <p className="text-xs text-zinc-500">Fees (limit)</p>
                            <p className="text-lg font-bold text-rose-400">{formatCurrency(advancedMetrics.limitFees)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-zinc-500">Fees (market)</p>
                            <p className="text-lg font-bold text-rose-400">{formatCurrency(advancedMetrics.marketFees)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-zinc-500">Unclassified</p>
                            <p className="text-lg font-bold text-zinc-300">{formatCurrency(advancedMetrics.unknownFees)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-zinc-500">Total Fees</p>
                            <p className="text-lg font-bold text-rose-400">{formatCurrency(advancedMetrics.totalFees)}</p>
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50"
                >
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Funding</h3>
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p className="text-xs text-zinc-500">Funding Paid</p>
                            <p className="text-lg font-bold text-rose-400">{formatCurrency(fundingPaid)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-zinc-500">Funding Received</p>
                            <p className="text-lg font-bold text-emerald-400">{formatCurrency(fundingReceived)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-zinc-500">Net Funding</p>
                            <p className={cn("text-lg font-bold", advancedMetrics.totalFunding >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                {formatCurrencySigned(advancedMetrics.totalFunding)}
                            </p>
                        </div>
                    </div>
                </motion.div>
            </div>

            <div className="grid grid-cols-2 gap-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50"
                >
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">PnL by Hold Time</h3>
                    <HorizontalBarChart data={holdTimeData} maxValue={maxHoldTimePnl} />
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 }}
                    className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50"
                >
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Trading Session Analysis</h3>
                    <HorizontalBarChart data={sessionData} maxValue={maxSessionPnl} />
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50"
                >
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Day of Week</h3>
                    <HorizontalBarChart data={dayData} maxValue={maxDayPnl} />
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.55 }}
                    className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50"
                >
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Best Trading Hours</h3>
                    <div className="space-y-2">
                        {hourlyData
                            .filter((d) => d.count > 0)
                            .sort((a, b) => b.value - a.value)
                            .slice(0, 5)
                            .map((d) => (
                                <div key={d.label} className="flex items-center justify-between py-2 border-b border-zinc-800/30">
                                    <span className="text-sm text-zinc-400">{d.label}</span>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-zinc-500">{d.count} trades</span>
                                        <span className={cn("text-sm font-bold", d.value >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                            ${Math.abs(d.value).toFixed(0)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
}
