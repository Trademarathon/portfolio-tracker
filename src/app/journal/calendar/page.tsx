"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useJournal } from "@/contexts/JournalContext";
import { STRATEGY_TAGS } from "@/lib/api/journal-types";
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    addDays,
    addMonths,
    subMonths,
    isSameMonth,
    isToday,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function CalendarPage() {
    const { filteredTrades, annotations, preferences, isLoading } = useJournal();
    const [currentDate, setCurrentDate] = useState(new Date());

    // Generate calendar days
    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
        const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

        const days: Date[] = [];
        let day = startDate;
        while (day <= endDate) {
            days.push(day);
            day = addDays(day, 1);
        }
        return days;
    }, [currentDate]);

    // Get trade data for each day
    const dayData = useMemo(() => {
        const data: Record<string, { trades: number; pnl: number; tags: string[] }> = {};
        
        filteredTrades.forEach(trade => {
            const dateKey = format(trade.timestamp, 'yyyy-MM-dd');
            if (!data[dateKey]) {
                data[dateKey] = { trades: 0, pnl: 0, tags: [] };
            }
            data[dateKey].trades++;
            data[dateKey].pnl += trade.realizedPnl || 0;
            
            // Get strategy tag from annotation
            const annotation = annotations[trade.id];
            if (annotation?.strategyTag && !data[dateKey].tags.includes(annotation.strategyTag)) {
                data[dateKey].tags.push(annotation.strategyTag);
            }
        });

        return data;
    }, [filteredTrades, annotations]);

    // Format currency
    const formatPnL = (value: number) => {
        if (preferences.hideBalances) return "••••";
        const prefix = value >= 0 ? '+' : '';
        return `${prefix}$${Math.abs(value).toFixed(0)}`;
    };

    // Navigation
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));

    // Get cell styling based on PnL
    const getCellStyle = (pnl: number, trades: number) => {
        if (trades === 0) return "";
        if (pnl > 500) return "bg-emerald-500/30 border-emerald-500/50";
        if (pnl > 0) return "bg-emerald-500/20 border-emerald-500/30";
        if (pnl > -500) return "bg-rose-500/20 border-rose-500/30";
        return "bg-rose-500/30 border-rose-500/50";
    };

    // Calculate monthly stats
    const monthlyStats = useMemo(() => {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        
        const monthTrades = filteredTrades.filter(t => {
            const date = new Date(t.timestamp);
            return date >= monthStart && date <= monthEnd;
        });

        const totalPnl = monthTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
        const wins = monthTrades.filter(t => (t.realizedPnl || 0) > 0).length;
        const losses = monthTrades.filter(t => (t.realizedPnl || 0) < 0).length;
        const tradingDays = new Set(monthTrades.map(t => format(t.timestamp, 'yyyy-MM-dd'))).size;
        const decisiveTrades = wins + losses;

        return {
            totalTrades: monthTrades.length,
            totalPnl,
            wins,
            losses,
            winRate: decisiveTrades > 0 ? (wins / decisiveTrades) * 100 : 0,
            tradingDays,
        };
    }, [filteredTrades, currentDate]);

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
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={prevMonth}
                        className="p-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <h2 className="text-2xl font-black text-white">
                        {format(currentDate, 'MMMM yyyy')}
                    </h2>
                    <button
                        onClick={nextMonth}
                        className="p-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>

                {/* Month Stats */}
                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <p className="text-xs text-zinc-500">Total PnL</p>
                        <p className={cn(
                            "text-lg font-bold",
                            monthlyStats.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400"
                        )}>
                            {formatPnL(monthlyStats.totalPnl)}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-zinc-500">Win Rate</p>
                        <p className="text-lg font-bold text-white">
                            {monthlyStats.winRate.toFixed(0)}%
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-zinc-500">Trades</p>
                        <p className="text-lg font-bold text-white">
                            {monthlyStats.totalTrades}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-zinc-500">Trading Days</p>
                        <p className="text-lg font-bold text-white">
                            {monthlyStats.tradingDays}
                        </p>
                    </div>
                </div>
            </div>

            {/* Calendar Grid */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-zinc-900/50 border border-zinc-800/50 overflow-hidden"
            >
                {/* Weekday Headers */}
                <div className="grid grid-cols-7 border-b border-zinc-800/50">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                        <div
                            key={day}
                            className="py-4 text-center text-xs text-zinc-500 font-medium uppercase tracking-wider"
                        >
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7">
                    {calendarDays.map((day, index) => {
                        const dateKey = format(day, 'yyyy-MM-dd');
                        const data = dayData[dateKey];
                        const isCurrentMonth = isSameMonth(day, currentDate);
                        const isTodayDate = isToday(day);

                        return (
                            <motion.div
                                key={dateKey}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: Math.min(index * 0.01, 0.3) }}
                                className={cn(
                                    "min-h-[120px] p-3 border-r border-b border-zinc-800/30 transition-colors cursor-pointer hover:bg-zinc-800/20",
                                    !isCurrentMonth && "opacity-40",
                                    isTodayDate && "ring-2 ring-inset ring-emerald-500/50",
                                    data && getCellStyle(data.pnl, data.trades)
                                )}
                            >
                                {/* Day Number */}
                                <div className="flex items-center justify-between mb-2">
                                    <span className={cn(
                                        "text-sm font-bold",
                                        isTodayDate ? "text-emerald-400" : "text-zinc-400"
                                    )}>
                                        {format(day, 'd')}
                                    </span>
                                    {data && data.trades > 0 && (
                                        <span className="text-[10px] text-zinc-500">
                                            {data.trades} trade{data.trades > 1 ? 's' : ''}
                                        </span>
                                    )}
                                </div>

                                {/* PnL */}
                                {data && data.trades > 0 && (
                                    <div className="mt-1">
                                        <p className={cn(
                                            "text-lg font-black",
                                            data.pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                                        )}>
                                            {formatPnL(data.pnl)}
                                        </p>

                                        {/* Strategy Tags */}
                                        {data.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {data.tags.slice(0, 3).map(tagId => {
                                                    const tag = STRATEGY_TAGS.find(t => t.id === tagId);
                                                    return tag ? (
                                                        <span
                                                            key={tagId}
                                                            className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider"
                                                            style={{ backgroundColor: `${tag.color}30`, color: tag.color }}
                                                        >
                                                            {tag.name.substring(0, 8)}
                                                        </span>
                                                    ) : null;
                                                })}
                                                {data.tags.length > 3 && (
                                                    <span className="px-1.5 py-0.5 rounded text-[8px] text-zinc-500 bg-zinc-800">
                                                        +{data.tags.length - 3}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </motion.div>
                        );
                    })}
                </div>
            </motion.div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-emerald-500/30 border border-emerald-500/50" />
                    <span className="text-xs text-zinc-500">Profitable (+$500)</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-emerald-500/20 border border-emerald-500/30" />
                    <span className="text-xs text-zinc-500">Profit</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-rose-500/20 border border-rose-500/30" />
                    <span className="text-xs text-zinc-500">Loss</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-rose-500/30 border border-rose-500/50" />
                    <span className="text-xs text-zinc-500">Heavy Loss (-$500)</span>
                </div>
            </div>
        </motion.div>
    );
}
