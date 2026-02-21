"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { JournalTrade, useJournal } from "@/contexts/JournalContext";
import { format, startOfWeek, addDays, subWeeks, isSameDay } from "date-fns";
import { Calendar } from "lucide-react";

interface WeeklyCalendarProps {
    trades: JournalTrade[];
}

interface DayData {
    date: Date;
    trades: number;
    pnl: number;
}

export function WeeklyCalendar({ trades }: WeeklyCalendarProps) {
    const { preferences } = useJournal();

    // Generate 4 weeks of data
    const weeksData = useMemo(() => {
        const today = new Date();
        const weeks: DayData[][] = [];

        for (let week = 0; week < 4; week++) {
            const weekStart = startOfWeek(subWeeks(today, 3 - week), { weekStartsOn: 1 });
            const weekDays: DayData[] = [];

            for (let day = 0; day < 7; day++) {
                const date = addDays(weekStart, day);
                const dayTrades = trades.filter(t => isSameDay(new Date(t.timestamp), date));
                const pnl = dayTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);

                weekDays.push({
                    date,
                    trades: dayTrades.length,
                    pnl,
                });
            }

            weeks.push(weekDays);
        }

        return weeks;
    }, [trades]);

    // Format PnL
    const formatPnL = (value: number) => {
        if (preferences.hideBalances) return "••••";
        const prefix = value >= 0 ? '' : '-';
        return `${prefix}$${Math.abs(value).toFixed(2)}`;
    };

    // Get cell background based on PnL
    const getCellBg = (pnl: number, trades: number) => {
        if (trades === 0) return "bg-zinc-800/30";
        if (pnl > 0) return "bg-emerald-500/20 hover:bg-emerald-500/30";
        if (pnl < 0) return "bg-rose-500/20 hover:bg-rose-500/30";
        return "bg-zinc-700/30";
    };

    // Date range text
    const dateRangeText = useMemo(() => {
        if (weeksData.length === 0) return "";
        const start = format(weeksData[0][0].date, "MMM d");
        const end = format(weeksData[weeksData.length - 1][6].date, "MMM d");
        return `${start} - ${end}`;
    }, [weeksData]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16 }}
            className="neo-card neo-card-warm p-6 rounded-2xl bg-zinc-900/40 border border-white/10"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="title-md text-zinc-500">Past 4 Weeks</h3>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span>{dateRangeText}</span>
                    <span className="w-4 h-4 rounded bg-zinc-700 flex items-center justify-center">
                        <span className="text-[8px]">ℹ</span>
                    </span>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="space-y-1">
                {/* Header row */}
                <div className="grid grid-cols-8 gap-1 mb-2">
                    <div className="h-8" /> {/* Empty corner */}
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
                        <div key={day} className="h-8 flex items-center justify-center text-[10px] text-zinc-500 font-medium">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Week rows */}
                {weeksData.map((week, weekIndex) => (
                    <div key={weekIndex} className="grid grid-cols-8 gap-1">
                        {/* Week label */}
                        <div className="h-16 flex items-center justify-center">
                            <div className="text-[10px] text-zinc-600 font-medium -rotate-90 whitespace-nowrap">
                                Weekly Notes
                            </div>
                        </div>

                        {/* Day cells */}
                        {week.map((day, dayIndex) => (
                            <motion.div
                                key={dayIndex}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.14 }}
                                className={cn(
                                    "h-16 rounded-lg p-2 transition-colors cursor-pointer",
                                    getCellBg(day.pnl, day.trades)
                                )}
                            >
                                <div className="flex flex-col h-full">
                                    <span className="text-[10px] text-zinc-500">
                                        {format(day.date, "d")}
                                    </span>
                                    <span className="text-[9px] text-zinc-500">
                                        {day.trades} trades
                                    </span>
                                    <span className={cn(
                                        "text-sm font-bold mt-auto",
                                        day.pnl > 0 ? "text-emerald-400" : 
                                        day.pnl < 0 ? "text-rose-400" : 
                                        "text-zinc-500"
                                    )}>
                                        {day.trades > 0 ? formatPnL(day.pnl) : "$0.00"}
                                    </span>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="mt-4 pt-4 border-t border-zinc-800 flex justify-center">
                <Link
                    href="/journal/calendar"
                    className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors"
                >
                    <Calendar className="w-4 h-4" />
                    Go to the Calendar
                </Link>
            </div>
        </motion.div>
    );
}
