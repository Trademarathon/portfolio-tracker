"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useJournal } from "@/contexts/JournalContext";
import { STRATEGY_TAGS, StrategyTagId } from "@/lib/api/journal-types";
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react";

type ViewMode = 'pnl' | 'count' | 'winRate';
type SortField = 'tag' | 'count' | 'winRate' | 'avgPnl' | 'totalPnl';

interface TagStats {
    id: StrategyTagId;
    name: string;
    color: string;
    count: number;
    wins: number;
    losses: number;
    winRate: number;
    longs: number;
    shorts: number;
    avgHoldTime: number;
    avgPnl: number;
    totalPnl: number;
}

export default function TagsReportPage() {
    const { filteredTrades, annotations, preferences, isLoading } = useJournal();
    const [viewMode, setViewMode] = useState<ViewMode>('pnl');
    const [sortField, setSortField] = useState<SortField>('totalPnl');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // Calculate stats by tag
    const tagStats = useMemo(() => {
        const stats: Record<string, TagStats> = {};

        // Initialize all tags
        STRATEGY_TAGS.forEach(tag => {
            stats[tag.id] = {
                id: tag.id,
                name: tag.name,
                color: tag.color,
                count: 0,
                wins: 0,
                losses: 0,
                winRate: 0,
                longs: 0,
                shorts: 0,
                avgHoldTime: 0,
                avgPnl: 0,
                totalPnl: 0,
            };
        });

        // Aggregate trade data
        (filteredTrades || []).forEach(trade => {
            const annotation = (annotations || {})[trade.id];
            if (!annotation?.strategyTag) return;

            const tag = stats[annotation.strategyTag];
            if (!tag) return;

            const pnl = trade.realizedPnl || 0;
            const isLong = trade.side === 'buy' || (trade.side as string) === 'long';

            tag.count++;
            tag.totalPnl += pnl;
            if (pnl > 0) tag.wins++;
            if (pnl < 0) tag.losses++;
            if (isLong) tag.longs++;
            else tag.shorts++;
            tag.avgHoldTime += trade.holdTime || 0;
        });

        // Calculate averages
        Object.values(stats).forEach(tag => {
            if (tag.count > 0) {
                tag.winRate = (tag.wins / tag.count) * 100;
                tag.avgPnl = tag.totalPnl / tag.count;
                tag.avgHoldTime = tag.avgHoldTime / tag.count;
            }
        });

        return Object.values(stats).filter(t => t.count > 0);
    }, [filteredTrades, annotations]);

    // Sort tag stats
    const sortedStats = useMemo(() => {
        return [...tagStats].sort((a, b) => {
            let aVal: number | string = 0;
            let bVal: number | string = 0;

            switch (sortField) {
                case 'tag':
                    aVal = a.name;
                    bVal = b.name;
                    break;
                case 'count':
                    aVal = a.count;
                    bVal = b.count;
                    break;
                case 'winRate':
                    aVal = a.winRate;
                    bVal = b.winRate;
                    break;
                case 'avgPnl':
                    aVal = a.avgPnl;
                    bVal = b.avgPnl;
                    break;
                case 'totalPnl':
                    aVal = a.totalPnl;
                    bVal = b.totalPnl;
                    break;
            }

            if (typeof aVal === 'string' && typeof bVal === 'string') {
                return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            }

            return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
        });
    }, [tagStats, sortField, sortDirection]);

    // Get max value for chart
    const maxValue = useMemo(() => {
        switch (viewMode) {
            case 'pnl':
                return Math.max(...tagStats.map(t => Math.abs(t.totalPnl)), 1);
            case 'count':
                return Math.max(...tagStats.map(t => t.count), 1);
            case 'winRate':
                return 100;
        }
    }, [tagStats, viewMode]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const formatValue = (value: number) => {
        if (preferences.hideBalances) return '••••';
        return `$${Math.abs(value).toFixed(2)}`;
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
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
        >
            {/* Chart Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50"
            >
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Performance by Tag</h3>
                    <div className="flex rounded-lg overflow-hidden border border-zinc-700/50">
                        {(['pnl', 'count', 'winRate'] as ViewMode[]).map(mode => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                className={cn(
                                    "px-3 py-1.5 text-xs font-medium transition-colors",
                                    viewMode === mode ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"
                                )}
                            >
                                {mode === 'pnl' ? 'PnL' : mode === 'count' ? 'Count' : 'Win Rate'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Bar Chart */}
                <div className="space-y-3">
                    {sortedStats.slice(0, 10).map((tag, i) => {
                        const value = viewMode === 'pnl' ? tag.totalPnl : viewMode === 'count' ? tag.count : tag.winRate;
                        const barWidth = Math.abs(value) / maxValue * 100;
                        const isPositive = viewMode === 'pnl' ? tag.totalPnl >= 0 : true;

                        return (
                            <motion.div
                                key={tag.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="flex items-center gap-4"
                            >
                                <div className="w-32 flex items-center gap-2">
                                    <div
                                        className="w-3 h-3 rounded"
                                        style={{ backgroundColor: tag.color }}
                                    />
                                    <span className="text-xs text-zinc-300 truncate">{tag.name}</span>
                                </div>
                                <div className="flex-1 h-6 bg-zinc-800/50 rounded overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${barWidth}%` }}
                                        transition={{ delay: i * 0.05, duration: 0.5 }}
                                        className={cn(
                                            "h-full rounded",
                                            isPositive ? "bg-emerald-500" : "bg-rose-500"
                                        )}
                                    />
                                </div>
                                <span className={cn(
                                    "w-20 text-right text-xs font-bold",
                                    isPositive ? "text-emerald-400" : "text-rose-400"
                                )}>
                                    {viewMode === 'pnl' ? formatValue(value) : viewMode === 'count' ? value : `${value.toFixed(1)}%`}
                                </span>
                            </motion.div>
                        );
                    })}
                </div>
            </motion.div>

            {/* Insights Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="p-6 rounded-2xl bg-gradient-to-br from-violet-500/10 to-transparent border border-violet-500/20"
            >
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-violet-400" />
                    </div>
                    <h3 className="text-sm font-bold text-white">AI Insights</h3>
                </div>
                <div className="space-y-3 text-sm text-zinc-300">
                    {sortedStats.length > 0 ? (
                        <>
                            <p>
                                Your best performing strategy is <span className="text-emerald-400 font-bold">{sortedStats[0]?.name}</span> with a total PnL of <span className="text-emerald-400 font-bold">{formatValue(sortedStats[0]?.totalPnl || 0)}</span>.
                            </p>
                            {sortedStats.length > 1 && (
                                <p>
                                    Consider focusing more on strategies with higher win rates. Your <span className="font-bold">{sortedStats.filter(t => t.winRate > 60).length}</span> strategies have a win rate above 60%.
                                </p>
                            )}
                        </>
                    ) : (
                        <p>Add strategy tags to your trades to see insights here.</p>
                    )}
                </div>
            </motion.div>

            {/* Data Table */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-2xl bg-zinc-900/50 border border-zinc-800/50 overflow-hidden"
            >
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-zinc-800/50">
                            {[
                                { id: 'tag', label: 'Tag' },
                                { id: 'count', label: 'Trade Count' },
                                { id: 'winRate', label: 'Win Rate %' },
                                { id: 'avgPnl', label: 'Avg PnL' },
                                { id: 'totalPnl', label: 'Total PnL' },
                            ].map(col => (
                                <th
                                    key={col.id}
                                    onClick={() => handleSort(col.id as SortField)}
                                    className="px-4 py-3 text-left text-[10px] text-zinc-500 uppercase tracking-wider font-medium cursor-pointer hover:text-zinc-300"
                                >
                                    <div className="flex items-center gap-1">
                                        {col.label}
                                        {sortField === col.id && (
                                            sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/30">
                        {sortedStats.map(tag => (
                            <tr key={tag.id} className="hover:bg-zinc-800/20 transition-colors">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-3 h-3 rounded"
                                            style={{ backgroundColor: tag.color }}
                                        />
                                        <span className="text-sm text-white font-medium">{tag.name}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-zinc-300">{tag.count}</td>
                                <td className="px-4 py-3">
                                    <span className={cn(
                                        "text-sm font-bold",
                                        tag.winRate >= 50 ? "text-emerald-400" : "text-rose-400"
                                    )}>
                                        {tag.winRate.toFixed(1)}%
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <span className={cn(
                                        "text-sm font-bold",
                                        tag.avgPnl >= 0 ? "text-emerald-400" : "text-rose-400"
                                    )}>
                                        {formatValue(tag.avgPnl)}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <span className={cn(
                                        "text-sm font-bold",
                                        tag.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400"
                                    )}>
                                        {formatValue(tag.totalPnl)}
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {sortedStats.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-12 text-center text-sm text-zinc-500">
                                    No tagged trades found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </motion.div>
        </motion.div>
    );
}
