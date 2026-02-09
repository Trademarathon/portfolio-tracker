"use client";

import { useMemo } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceDot,
    ReferenceLine
} from 'recharts';
import { format } from 'date-fns';
import { Transaction } from '@/lib/api/types';

interface TradeHistoryChartProps {
    data: { date: number; price: number }[];
    trades: Transaction[];
    symbol: string;
    avgBuyPrice?: number;
    avgSellPrice?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string | number }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-zinc-950/90 border border-white/10 p-3 rounded-lg backdrop-blur-md shadow-xl z-50">
                <p className="text-zinc-400 text-xs mb-1 font-mono">{format(new Date(label || 0), 'MMM dd, HH:mm')}</p>
                <div className="flex items-baseline gap-2">
                    <span className="text-zinc-500 text-xs">Price:</span>
                    <span className="text-white font-bold font-mono text-sm">
                        ${payload[0].value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                </div>
            </div>
        );
    }
    return null;
};

// Custom Marker Components
const BuyMarker = (props: { cx?: number; cy?: number }) => {
    const { cx, cy } = props;
    if (cx === undefined || cy === undefined) return null;
    return (
        <svg x={cx - 6} y={cy - 6} width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5" />
            <path d="M5 12l7-7 7 7" />
        </svg>
    );
};

const SellMarker = (props: { cx?: number; cy?: number }) => {
    const { cx, cy } = props;
    if (cx === undefined || cy === undefined) return null;
    return (
        <svg x={cx - 6} y={cy - 6} width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#d946ef" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14" />
            <path d="M19 12l-7 7-7-7" />
        </svg>
    );
};

export function TradeHistoryChart({ data, trades, avgBuyPrice, avgSellPrice }: TradeHistoryChartProps) {

    // Calculate domain to frame the chart nicely
    const { min, max } = useMemo(() => {
        if (!data.length) return { min: 0, max: 0 };
        const prices = data.map(d => d.price);
        let minPrice = Math.min(...prices);
        let maxPrice = Math.max(...prices);

        // Adjust for Avg Lines if they exist to ensure they are visible
        if (avgBuyPrice) {
            minPrice = Math.min(minPrice, avgBuyPrice);
            maxPrice = Math.max(maxPrice, avgBuyPrice);
        }
        if (avgSellPrice) {
            minPrice = Math.min(minPrice, avgSellPrice);
            maxPrice = Math.max(maxPrice, avgSellPrice);
        }

        return {
            min: minPrice * 0.95,
            max: maxPrice * 1.05
        };
    }, [data, avgBuyPrice, avgSellPrice]);

    // Filter trades that fall within the chart's time range
    const visibleTrades = useMemo(() => {
        if (!data.length) return [];
        const startTime = data[0].date;
        const endTime = data[data.length - 1].date;
        return trades.filter(t => t.timestamp >= startTime && t.timestamp <= endTime);
    }, [data, trades]);

    if (!data || data.length === 0) {
        return (
            <div className="w-full h-[400px] flex items-center justify-center text-zinc-500 bg-zinc-900/20 rounded-xl border border-white/5">
                No price history available.
            </div>
        );
    }

    return (
        <div className="w-full h-[500px] bg-gradient-to-b from-zinc-900/50 to-zinc-950/50 rounded-xl border border-white/5 p-4 relative overflow-hidden group">
            {/* Background "Grid" Effect for that technical look */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

            <div className="flex items-center justify-between mb-6 relative z-10 px-2">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-10 bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.6)]" />
                    <div>
                        <h3 className="text-base font-black text-white uppercase tracking-widest">Performance Analysis</h3>
                        <p className="text-xs text-zinc-500 font-mono">
                            {format(data[0].date, 'MMM dd')} - {format(data[data.length - 1].date, 'MMM dd')}
                        </p>
                    </div>
                </div>

                {/* Legend */}
                <div className="flex gap-6 text-xs font-bold uppercase tracking-wider bg-zinc-950/50 p-2 rounded-lg border border-white/5 backdrop-blur-sm">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center w-5 h-5 bg-emerald-500/10 rounded border border-emerald-500/30">
                            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5" /><path d="M5 12l7-7 7 7" /></svg>
                        </div>
                        <span className="text-zinc-400">Buy</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center w-5 h-5 bg-fuchsia-500/10 rounded border border-fuchsia-500/30">
                            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#d946ef" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M19 12l-7 7-7-7" /></svg>
                        </div>
                        <span className="text-zinc-400">Sell</span>
                    </div>
                    {avgBuyPrice && (
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-0.5 border-t-2 border-dashed border-emerald-500/50" />
                            <span className="text-emerald-500/80">Avg Buy</span>
                        </div>
                    )}
                </div>
            </div>

            <ResponsiveContainer width="100%" height="85%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                    <XAxis
                        dataKey="date"
                        type="number"
                        domain={['dataMin', 'dataMax']}
                        tickFormatter={(unix) => format(new Date(unix), 'dd MMM')}
                        stroke="#52525b"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={50}
                        dy={10}
                    />
                    <YAxis
                        domain={[min, max]}
                        stroke="#52525b"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => `$${val.toLocaleString()}`}
                        width={60}
                        dx={-10}
                    />
                    <Tooltip
                        content={<CustomTooltip />}
                        cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                    />
                    <Area
                        type="monotone"
                        dataKey="price"
                        stroke="#6366f1"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorPrice)"
                        isAnimationActive={true}
                        animationDuration={1500}
                    />

                    {/* Average Buy Price Line */}
                    {avgBuyPrice && (
                        <ReferenceLine
                            y={avgBuyPrice}
                            stroke="#10b981"
                            strokeDasharray="4 4"
                            strokeOpacity={0.6}
                            label={{
                                value: `Avg Buy: $${avgBuyPrice.toLocaleString()}`,
                                position: 'insideBottomLeft',
                                fill: '#10b981',
                                fontSize: 10,
                                dy: -5
                            }}
                        />
                    )}

                    {/* Average Sell Price Line */}
                    {avgSellPrice && (
                        <ReferenceLine
                            y={avgSellPrice}
                            stroke="#d946ef"
                            strokeDasharray="4 4"
                            strokeOpacity={0.6}
                            label={{
                                value: `Avg Sell: $${avgSellPrice.toLocaleString()}`,
                                position: 'insideTopLeft',
                                fill: '#d946ef',
                                fontSize: 10,
                                dy: 5
                            }}
                        />
                    )}

                    {/* Render Trade Markers */}
                    {visibleTrades.map((trade, idx) => {
                        const t = trade as Transaction & { type?: string };
                        const isBuy = t.type === 'Buy' || t.side === 'buy';
                        const MarkerComponent = isBuy ? BuyMarker : SellMarker;

                        return (
                            <ReferenceDot
                                key={trade.id || idx}
                                x={trade.timestamp}
                                y={trade.price}
                                r={0} // Invisible dot, using custom label as marker
                                stroke="none"
                                label={(props) => <MarkerComponent {...props} />}
                            />
                        );
                    })}
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
