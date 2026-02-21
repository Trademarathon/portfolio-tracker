"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useJournal, JournalTrade } from "@/contexts/JournalContext";
import { getHours, getDay } from "date-fns";
import { Check } from "lucide-react";

type CurveType = 'side' | 'month' | 'symbol' | 'timeOfDay' | 'holdTime' | 'dayOfWeek' | 'session';

interface CurveOption {
    id: string;
    label: string;
    color: string;
    trades: JournalTrade[];
}

type CurveWithPoints = CurveOption & {
    points: { x: number; y: number }[];
};

const SESSIONS = [
    { name: 'Asia', startHour: 0, endHour: 8 },
    { name: 'London', startHour: 8, endHour: 16 },
    { name: 'New York', startHour: 13, endHour: 22 },
];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function buildPath(points: { x: number; y: number }[]) {
    if (points.length === 0) return "";
    const [first, ...rest] = points;
    return `M ${first.x.toFixed(2)} ${first.y.toFixed(2)} ${rest
        .map(p => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
        .join(" ")}`;
}

function EquityCurveChart({
    curves,
    normalizeX,
}: {
    curves: CurveWithPoints[];
    normalizeX: boolean;
}) {
    const width = 900;
    const height = 320;
    const padding = { left: 12, right: 12, top: 14, bottom: 18 };

    const domain = useMemo(() => {
        const all = curves.flatMap(c => c.points);
        const xs = all.map(p => p.x);
        const ys = all.map(p => p.y);
        const minX = normalizeX ? 0 : Math.min(...xs, 0);
        const maxX = normalizeX ? 100 : Math.max(...xs, 1);
        let minY = Math.min(...ys, 0);
        let maxY = Math.max(...ys, 0);
        if (minY === maxY) {
            // prevent flatline divide-by-zero; add a small range
            minY -= 1;
            maxY += 1;
        }
        return { minX, maxX, minY, maxY };
    }, [curves, normalizeX]);

    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;

    const scaleX = (x: number) =>
        padding.left + ((x - domain.minX) / (domain.maxX - domain.minX || 1)) * plotW;
    const scaleY = (y: number) =>
        padding.top + (1 - (y - domain.minY) / (domain.maxY - domain.minY || 1)) * plotH;

    const curvesScaled = useMemo(() => {
        return curves.map(c => ({
            ...c,
            scaled: c.points.map(p => ({ x: scaleX(p.x), y: scaleY(p.y) })),
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [curves, domain.minX, domain.maxX, domain.minY, domain.maxY]);

    const zeroY = domain.minY < 0 && domain.maxY > 0 ? scaleY(0) : null;

    return (
        <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-full"
            role="img"
            aria-label="Equity curve comparison chart"
        >
            {/* Grid lines */}
            {[0.25, 0.5, 0.75].map(ratio => {
                const y = padding.top + ratio * plotH;
                return (
                    <line
                        key={ratio}
                        x1={padding.left}
                        x2={width - padding.right}
                        y1={y}
                        y2={y}
                        stroke="rgba(113,113,122,0.25)"
                        strokeWidth={1}
                    />
                );
            })}

            {/* Zero line */}
            {zeroY !== null && (
                <line
                    x1={padding.left}
                    x2={width - padding.right}
                    y1={zeroY}
                    y2={zeroY}
                    stroke="rgba(16,185,129,0.25)"
                    strokeDasharray="4 4"
                    strokeWidth={1}
                />
            )}

            {/* Curves */}
            {curvesScaled.map(curve => (
                <path
                    key={curve.id}
                    d={buildPath(curve.scaled)}
                    fill="none"
                    stroke={curve.color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    opacity={0.95}
                />
            ))}
        </svg>
    );
}

export default function PnLCurvePage() {
    const { filteredTrades, preferences, isLoading } = useJournal();
    const [selectedCurveType, setSelectedCurveType] = useState<CurveType>('side');
    const [selectedCurves, setSelectedCurves] = useState<string[]>([]);
    const [normalizeX, setNormalizeX] = useState(false);

    // Generate curve options based on selected type
    const curveOptions = useMemo((): CurveOption[] => {
        const closedTrades = (filteredTrades || []).filter(t => !t.isOpen);

        switch (selectedCurveType) {
            case 'side':
                return [
                    {
                        id: 'long',
                        label: 'Long',
                        color: '#10b981',
                        trades: closedTrades.filter(t => t.side === 'buy' || (t.side as string) === 'long'),
                    },
                    {
                        id: 'short',
                        label: 'Short',
                        color: '#ef4444',
                        trades: closedTrades.filter(t => t.side === 'sell' || (t.side as string) === 'short'),
                    },
                ];
            case 'month':
                return MONTHS.map((month, i) => ({
                    id: `month-${i}`,
                    label: month,
                    color: `hsl(${i * 30}, 70%, 50%)`,
                    trades: closedTrades.filter(t => new Date(t.timestamp).getMonth() === i),
                })).filter(m => m.trades.length > 0);
            case 'symbol':
                const symbols = [...new Set(closedTrades.map(t => t.symbol))];
                return symbols.slice(0, 10).map((symbol, i) => ({
                    id: symbol,
                    label: symbol,
                    color: `hsl(${i * 36}, 70%, 50%)`,
                    trades: closedTrades.filter(t => t.symbol === symbol),
                }));
            case 'timeOfDay':
                return [
                    { id: 'morning', label: 'Morning (0-8)', color: '#f59e0b', trades: closedTrades.filter(t => getHours(new Date(t.timestamp)) >= 0 && getHours(new Date(t.timestamp)) < 8) },
                    { id: 'midday', label: 'Midday (8-16)', color: '#3b82f6', trades: closedTrades.filter(t => getHours(new Date(t.timestamp)) >= 8 && getHours(new Date(t.timestamp)) < 16) },
                    { id: 'evening', label: 'Evening (16-24)', color: '#8b5cf6', trades: closedTrades.filter(t => getHours(new Date(t.timestamp)) >= 16) },
                ];
            case 'holdTime':
                return [
                    { id: 'scalp', label: '< 1 hour', color: '#10b981', trades: closedTrades.filter(t => (t.holdTime || 0) < 60 * 60 * 1000) },
                    { id: 'intraday', label: '1-8 hours', color: '#3b82f6', trades: closedTrades.filter(t => (t.holdTime || 0) >= 60 * 60 * 1000 && (t.holdTime || 0) < 8 * 60 * 60 * 1000) },
                    { id: 'swing', label: '8+ hours', color: '#8b5cf6', trades: closedTrades.filter(t => (t.holdTime || 0) >= 8 * 60 * 60 * 1000) },
                ];
            case 'dayOfWeek':
                return DAYS.map((day, i) => ({
                    id: `day-${i}`,
                    label: day,
                    color: `hsl(${i * 51}, 70%, 50%)`,
                    trades: closedTrades.filter(t => getDay(new Date(t.timestamp)) === i),
                })).filter(d => d.trades.length > 0);
            case 'session':
                return SESSIONS.map((session, i) => ({
                    id: session.name.toLowerCase(),
                    label: session.name,
                    color: i === 0 ? '#f59e0b' : i === 1 ? '#3b82f6' : '#10b981',
                    trades: closedTrades.filter(t => {
                        const hour = getHours(new Date(t.timestamp));
                        return hour >= session.startHour && hour < session.endHour;
                    }),
                }));
            default:
                return [];
        }
    }, [filteredTrades, selectedCurveType]);

    // Toggle curve selection
    const toggleCurve = (id: string) => {
        if (selectedCurves.includes(id)) {
            setSelectedCurves(selectedCurves.filter(c => c !== id));
        } else {
            setSelectedCurves([...selectedCurves, id]);
        }
    };

    // Select all curves
    const selectAll = () => {
        setSelectedCurves(curveOptions.map(c => c.id));
    };

    // Generate equity curves for selected options
    const equityCurves = useMemo(() => {
        return curveOptions
            .filter(opt => selectedCurves.includes(opt.id))
            .map(opt => {
                const sortedTrades = [...opt.trades].sort((a, b) => a.timestamp - b.timestamp);
                let cumulative = 0;
                const points = sortedTrades.map((t, i) => {
                    cumulative += t.realizedPnl || 0;
                    return {
                        x: normalizeX ? (i / (sortedTrades.length - 1 || 1)) * 100 : t.timestamp,
                        y: cumulative,
                    };
                });
                return { ...opt, points };
            });
    }, [curveOptions, selectedCurves, normalizeX]);

    const formatValue = (value: number) => {
        if (preferences.hideBalances) return '••••';
        const prefix = value > 0 ? '+' : value < 0 ? '-' : '';
        return `${prefix}$${Math.abs(value).toFixed(2)}`;
    };

    const curveTypes: { id: CurveType; label: string }[] = [
        { id: 'side', label: 'Trade Side' },
        { id: 'month', label: 'Month' },
        { id: 'symbol', label: 'Symbol' },
        { id: 'timeOfDay', label: 'Time of Day' },
        { id: 'holdTime', label: 'Hold Time' },
        { id: 'dayOfWeek', label: 'Day of Week' },
        { id: 'session', label: 'Session' },
    ];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-12 gap-6"
        >
            {/* Main Chart Area */}
            <div className="col-span-9 space-y-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50"
                >
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">PnL Curve Comparison</h3>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={normalizeX}
                                onChange={(e) => setNormalizeX(e.target.checked)}
                                className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500"
                            />
                            <span className="text-xs text-zinc-400">Normalize X-axis</span>
                        </label>
                    </div>

                    {/* Chart Placeholder */}
                    {equityCurves.length > 0 ? (
                        <div className="h-80 relative">
                            {/* Y-axis labels */}
                            <div className="absolute left-0 top-0 bottom-0 w-16 flex flex-col justify-between py-2">
                                {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                                    const allY = equityCurves.flatMap(c => c.points.map(p => p.y));
                                    const maxY = Math.max(...allY, 0);
                                    const minY = Math.min(...allY, 0);
                                    const value = maxY - ratio * (maxY - minY);
                                    return (
                                        <span key={i} className="text-[10px] text-zinc-500 text-right pr-2">
                                            {formatValue(value)}
                                        </span>
                                    );
                                })}
                            </div>

                            {/* Chart area */}
                            <div className="ml-16 h-full bg-zinc-800/30 rounded-xl relative overflow-hidden">
                                <EquityCurveChart curves={equityCurves} normalizeX={normalizeX} />
                            </div>

                            {/* Legend */}
                            <div className="flex flex-wrap gap-4 mt-4">
                                {equityCurves.map(curve => (
                                    <div key={curve.id} className="flex items-center gap-2">
                                        <div
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: curve.color }}
                                        />
                                        <span className="text-xs text-zinc-400">{curve.label}</span>
                                        <span className={cn(
                                            "text-xs font-bold",
                                            curve.points[curve.points.length - 1]?.y >= 0 ? "text-emerald-400" : "text-rose-400"
                                        )}>
                                            {formatValue(curve.points[curve.points.length - 1]?.y || 0)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="h-80 flex items-center justify-center bg-zinc-800/30 rounded-xl">
                            <p className="text-zinc-500 text-sm">Select curves from the sidebar to compare</p>
                        </div>
                    )}
                </motion.div>
            </div>

            {/* Curve Selector Sidebar */}
            <div className="col-span-3">
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 sticky top-6"
                >
                    <h3 className="text-sm font-bold text-white mb-4">Curve Selector</h3>

                    {/* Curve Type Selection */}
                    <div className="mb-4">
                        <label className="text-xs text-zinc-500 uppercase tracking-wider mb-2 block">Group By</label>
                        <div className="space-y-1">
                            {curveTypes.map(type => (
                                <button
                                    key={type.id}
                                    onClick={() => {
                                        setSelectedCurveType(type.id);
                                        setSelectedCurves([]);
                                    }}
                                    className={cn(
                                        "w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                                        selectedCurveType === type.id
                                            ? "bg-emerald-500/20 text-emerald-400"
                                            : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                                    )}
                                >
                                    {type.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="border-t border-zinc-800 pt-4">
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-xs text-zinc-500 uppercase tracking-wider">Curves</label>
                            <button
                                onClick={selectAll}
                                className="text-[10px] text-emerald-400 hover:underline"
                            >
                                Select All
                            </button>
                        </div>
                        <div className="space-y-1 max-h-64 overflow-y-auto">
                            {curveOptions.map(option => (
                                <label
                                    key={option.id}
                                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800/50 cursor-pointer"
                                >
                                    <div
                                        className={cn(
                                            "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                                            selectedCurves.includes(option.id)
                                                ? "bg-emerald-500 border-emerald-500"
                                                : "border-zinc-600"
                                        )}
                                    >
                                        {selectedCurves.includes(option.id) && (
                                            <Check className="w-3 h-3 text-black" />
                                        )}
                                    </div>
                                    <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: option.color }}
                                    />
                                    <span className="text-xs text-zinc-300 flex-1">{option.label}</span>
                                    <span className="text-[10px] text-zinc-500">{option.trades.length}</span>
                                    <input
                                        type="checkbox"
                                        checked={selectedCurves.includes(option.id)}
                                        onChange={() => toggleCurve(option.id)}
                                        className="hidden"
                                    />
                                </label>
                            ))}
                            {curveOptions.length === 0 && (
                                <p className="text-xs text-zinc-500 px-3 py-2">No data available</p>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
}
