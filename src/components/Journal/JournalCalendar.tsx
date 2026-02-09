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
        <div className="bg-zinc-900/50 backdrop-blur-xl rounded-xl border border-white/10 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                    <span className="bg-primary/20 text-primary p-1.5 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
                    </span>
                    {format(currentMonth, 'MMMM yyyy')}
                </h2>
                <div className="flex gap-1 bg-zinc-800/50 p-1 rounded-lg border border-white/5">
                    <button
                        onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                        className="p-1.5 hover:bg-zinc-700 rounded-md text-zinc-400 hover:text-white transition-all"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button
                        onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                        className="p-1.5 hover:bg-zinc-700 rounded-md text-zinc-400 hover:text-white transition-all"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-2 mb-3 text-center text-xs font-bold uppercase text-zinc-500 tracking-wider">
                <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
            </div>

            <div className="grid grid-cols-7 gap-2">
                {emptyDays.map((_, i) => (
                    <div key={`empty-${i}`} className="h-28 rounded-xl bg-transparent" />
                ))}

                {days.map((day) => {
                    const stats = getDayStats(day);
                    const isToday = isSameDay(day, new Date());
                    const isSelected = false; // Add selection logic if needed

                    let bgClass = "bg-zinc-800/20 border-zinc-800/50 hover:border-zinc-700";
                    let textClass = "text-zinc-500";
                    let pnlColor = "text-zinc-500";

                    if (stats.count > 0) {
                        if (stats.pnl > 0) {
                            bgClass = "bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/10";
                            textClass = "text-emerald-200";
                            pnlColor = "text-emerald-400";
                        } else if (stats.pnl < 0) {
                            bgClass = "bg-rose-500/5 border-rose-500/20 hover:border-rose-500/40 hover:bg-rose-500/10";
                            textClass = "text-rose-200";
                            pnlColor = "text-rose-400";
                        } else {
                            bgClass = "bg-zinc-800/40 border-zinc-700 hover:border-zinc-600";
                            textClass = "text-zinc-300";
                        }
                    }

                    if (isToday) {
                        bgClass += " ring-2 ring-primary/50 ring-offset-2 ring-offset-zinc-950";
                    }

                    return (
                        <div
                            key={day.toISOString()}
                            onClick={() => onSelectDate(day)}
                            className={`
                                group relative h-28 rounded-xl p-3 cursor-pointer transition-all duration-200 border
                                flex flex-col justify-between
                                ${bgClass}
                            `}
                        >
                            <div className="flex justify-between items-start">
                                <span className={`text-xs font-medium ${isSameMonth(day, currentMonth) ? 'text-zinc-400 group-hover:text-white' : 'text-zinc-700'}`}>
                                    {format(day, 'd')}
                                </span>
                                {stats.count > 0 && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-950/30 text-zinc-400">
                                        {stats.count}
                                    </span>
                                )}
                            </div>

                            {stats.count > 0 && (
                                <div className="text-right">
                                    <div className={`text-sm font-bold tracking-tight ${pnlColor}`}>
                                        {stats.pnl > 0 ? '+' : ''}{stats.pnl.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </div>
                                    <div className="text-[10px] text-zinc-500 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {stats.pnl > 0 ? 'Profit' : 'Loss'}
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
