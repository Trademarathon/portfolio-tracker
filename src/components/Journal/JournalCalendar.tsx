'use client';

import { useState } from 'react';
import { Transaction } from '@/lib/api/types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface JournalCalendarProps {
    transactions: Transaction[];
    onSelectDate: (date: Date) => void;
}

export function JournalCalendar({ transactions, onSelectDate }: JournalCalendarProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Align start of week (Sunday/Monday) - let's do Sunday start
    const startDay = getDay(monthStart);
    const emptyDays = Array(startDay).fill(null);

    const getDayStats = (date: Date) => {
        const dailyTrades = transactions.filter(t => isSameDay(new Date(t.timestamp), date));
        const count = dailyTrades.length;
        const pnl = dailyTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);
        return { count, pnl };
    };

    return (
        <div className="bg-[#1E2026] rounded-xl border border-[#2B2F36] p-4">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-100">
                    {format(currentMonth, 'MMMM yyyy')}
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                        className="p-1 hover:bg-[#2B2F36] rounded text-gray-400 hover:text-white"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <button
                        onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                        className="p-1 hover:bg-[#2B2F36] rounded text-gray-400 hover:text-white"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-2 mb-2 text-center text-sm text-gray-500">
                <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
            </div>

            <div className="grid grid-cols-7 gap-2">
                {emptyDays.map((_, i) => (
                    <div key={`empty-${i}`} className="h-24 rounded-lg bg-transparent" />
                ))}

                {days.map((day) => {
                    const stats = getDayStats(day);
                    const isToday = isSameDay(day, new Date());

                    let bgClass = "bg-[#2B2F36]/30";
                    let textClass = "text-gray-400";

                    if (stats.count > 0) {
                        if (stats.pnl > 0) {
                            bgClass = "bg-green-500/10 border border-green-500/20";
                            textClass = "text-green-400";
                        } else if (stats.pnl < 0) {
                            bgClass = "bg-red-500/10 border border-red-500/20";
                            textClass = "text-red-400";
                        } else {
                            bgClass = "bg-[#2B2F36]";
                            textClass = "text-gray-200";
                        }
                    }

                    if (isToday) {
                        bgClass += " ring-1 ring-blue-500";
                    }

                    return (
                        <div
                            key={day.toISOString()}
                            onClick={() => onSelectDate(day)}
                            className={`h-24 rounded-lg p-2 cursor-pointer transition-colors hover:bg-opacity-80 ${bgClass} flex flex-col justify-between`}
                        >
                            <span className={`text-xs font-medium ${isSameMonth(day, currentMonth) ? 'text-gray-400' : 'text-gray-600'}`}>
                                {format(day, 'd')}
                            </span>

                            {stats.count > 0 && (
                                <div className="text-right">
                                    <div className={`text-sm font-bold ${textClass}`}>
                                        {stats.pnl > 0 ? '+' : ''}{stats.pnl.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })}
                                    </div>
                                    <div className="text-[10px] text-gray-500">
                                        {stats.count} trade{stats.count !== 1 && 's'}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
