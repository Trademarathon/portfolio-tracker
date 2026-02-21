"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useJournal } from "@/contexts/JournalContext";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from "date-fns";
import {
    Calendar,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";

const presets = [
    { id: "all", label: "All trades", getValue: () => ({ start: null, end: null }) },
    { id: "last25", label: "Last 25 trades", getValue: () => ({ start: null, end: null }) },
    { id: "last100", label: "Last 100 trades", getValue: () => ({ start: null, end: null }) },
    { id: "today", label: "Today", getValue: () => ({ start: startOfDay(new Date()), end: endOfDay(new Date()) }) },
    { id: "thisWeek", label: "This week", getValue: () => ({ start: startOfWeek(new Date(), { weekStartsOn: 1 }), end: endOfWeek(new Date(), { weekStartsOn: 1 }) }) },
    { id: "lastWeek", label: "Last week", getValue: () => ({ start: startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }), end: endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }) }) },
    { id: "thisMonth", label: "This month", getValue: () => ({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) }) },
    { id: "lastMonth", label: "Last month", getValue: () => ({ start: startOfMonth(subMonths(new Date(), 1)), end: endOfMonth(subMonths(new Date(), 1)) }) },
    { id: "thisYear", label: "This year", getValue: () => ({ start: new Date(new Date().getFullYear(), 0, 1), end: new Date() }) },
];

function MiniCalendar({ 
    month, 
    year, 
    selectedStart, 
    selectedEnd, 
    onSelectDate,
    onMonthChange,
}: {
    month: number;
    year: number;
    selectedStart: Date | null;
    selectedEnd: Date | null;
    onSelectDate: (date: Date) => void;
    onMonthChange: (month: number, year: number) => void;
}) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; // Monday start
    
    const days = [];
    for (let i = 0; i < adjustedFirstDay; i++) {
        days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(new Date(year, month, i));
    }

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const isInRange = (date: Date) => {
        if (!selectedStart || !selectedEnd) return false;
        return date >= selectedStart && date <= selectedEnd;
    };

    const isSelected = (date: Date) => {
        if (selectedStart && date.toDateString() === selectedStart.toDateString()) return true;
        if (selectedEnd && date.toDateString() === selectedEnd.toDateString()) return true;
        return false;
    };

    return (
        <div className="w-full">
            <div className="flex items-center justify-between mb-3">
                <button
                    onClick={() => {
                        if (month === 0) {
                            onMonthChange(11, year - 1);
                        } else {
                            onMonthChange(month - 1, year);
                        }
                    }}
                    className="p-1 rounded hover:bg-zinc-700 text-zinc-400"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium text-white">
                    {monthNames[month]} {year}
                </span>
                <button
                    onClick={() => {
                        if (month === 11) {
                            onMonthChange(0, year + 1);
                        } else {
                            onMonthChange(month + 1, year);
                        }
                    }}
                    className="p-1 rounded hover:bg-zinc-700 text-zinc-400"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-zinc-500 mb-1">
                {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map(d => (
                    <div key={d}>{d}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {days.map((date, i) => (
                    <button
                        key={i}
                        onClick={() => date && onSelectDate(date)}
                        disabled={!date}
                        className={cn(
                            "h-7 rounded text-xs transition-colors",
                            !date && "invisible",
                            date && isSelected(date) && "bg-emerald-500 text-white",
                            date && isInRange(date) && !isSelected(date) && "bg-emerald-500/20 text-emerald-400",
                            date && !isSelected(date) && !isInRange(date) && "text-zinc-300 hover:bg-zinc-700"
                        )}
                    >
                        {date?.getDate()}
                    </button>
                ))}
            </div>
        </div>
    );
}

export function DateRangeSelector() {
    const { dateRange, setDateRange } = useJournal();
    const [isOpen, setIsOpen] = useState(false);
    const [leftMonth, setLeftMonth] = useState(new Date().getMonth() - 1);
    const [leftYear, setLeftYear] = useState(new Date().getFullYear());
    const [rightMonth, setRightMonth] = useState(new Date().getMonth());
    const [rightYear, setRightYear] = useState(new Date().getFullYear());
    const [tempStart, setTempStart] = useState<Date | null>(dateRange.start);
    const [tempEnd, setTempEnd] = useState<Date | null>(dateRange.end);
    const [dateMode, setDateMode] = useState<"before" | "range" | "after">(dateRange.mode ?? "range");
    const [groupBy, setGroupBy] = useState<"open" | "close">(dateRange.groupBy ?? "open");
    
    const containerRef = useRef<HTMLDivElement>(null);

    // Handle left month change
    const handleLeftMonthChange = (month: number, year: number) => {
        setLeftMonth(month);
        setLeftYear(year);
        // Adjust right month if needed
        if (year > rightYear || (year === rightYear && month >= rightMonth)) {
            if (month === 11) {
                setRightMonth(0);
                setRightYear(year + 1);
            } else {
                setRightMonth(month + 1);
                setRightYear(year);
            }
        }
    };

    // Handle right month change
    const handleRightMonthChange = (month: number, year: number) => {
        setRightMonth(month);
        setRightYear(year);
        // Adjust left month if needed
        if (year < leftYear || (year === leftYear && month <= leftMonth)) {
            if (month === 0) {
                setLeftMonth(11);
                setLeftYear(year - 1);
            } else {
                setLeftMonth(month - 1);
                setLeftYear(year);
            }
        }
    };

    // Handle date selection
    const handleSelectDate = (date: Date) => {
        if (!tempStart || (tempStart && tempEnd)) {
            setTempStart(date);
            setTempEnd(null);
        } else {
            if (date < tempStart) {
                setTempEnd(tempStart);
                setTempStart(date);
            } else {
                setTempEnd(date);
            }
        }
    };

    // Apply selection
    const handleApply = () => {
        setDateRange({
            start: tempStart,
            end: tempEnd,
            preset: "custom",
            mode: dateMode,
            groupBy,
        });
        setIsOpen(false);
    };

    // Handle preset selection
    const handlePreset = (preset: typeof presets[0]) => {
        const { start, end } = preset.getValue();
        setDateRange({
            start,
            end,
            preset: preset.id,
            mode: dateMode,
            groupBy,
        });
        setTempStart(start);
        setTempEnd(end);
        setIsOpen(false);
    };

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const getDisplayText = () => {
        const preset = presets.find(p => p.id === dateRange.preset);
        if (preset && preset.id !== "custom") return preset.label;
        if (dateRange.start && dateRange.end) {
            return `${format(dateRange.start, "MMM d, yyyy")} - ${format(dateRange.end, "MMM d, yyyy")}`;
        }
        return "Select a date range";
    };

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-all"
            >
                <Calendar className="w-4 h-4 text-zinc-500" />
                <span>{getDisplayText()}</span>
                <ChevronDown className={cn("w-4 h-4 text-zinc-500 transition-transform", isOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full right-0 mt-2 w-[600px] p-4 rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl z-50"
                    >
                        <div className="flex gap-6">
                            {/* Presets */}
                            <div className="w-36 border-r border-zinc-800 pr-4">
                                <div className="space-y-1">
                                    {presets.map(preset => (
                                        <button
                                            key={preset.id}
                                            onClick={() => handlePreset(preset)}
                                            className={cn(
                                                "w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                                                dateRange.preset === preset.id
                                                    ? "bg-emerald-500/20 text-emerald-400"
                                                    : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                                            )}
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Calendars */}
                            <div className="flex-1">
                                <div className="flex gap-4">
                                    <MiniCalendar
                                        month={leftMonth}
                                        year={leftYear}
                                        selectedStart={tempStart}
                                        selectedEnd={tempEnd}
                                        onSelectDate={handleSelectDate}
                                        onMonthChange={handleLeftMonthChange}
                                    />
                                    <MiniCalendar
                                        month={rightMonth}
                                        year={rightYear}
                                        selectedStart={tempStart}
                                        selectedEnd={tempEnd}
                                        onSelectDate={handleSelectDate}
                                        onMonthChange={handleRightMonthChange}
                                    />
                                </div>

                                {/* Options */}
                                <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-zinc-500">Group Trades by:</span>
                                            <div className="flex rounded-lg overflow-hidden border border-zinc-700">
                                                <button
                                                    onClick={() => setGroupBy("open")}
                                                    className={cn(
                                                        "px-2 py-1 text-xs",
                                                        groupBy === "open" ? "bg-zinc-700 text-white" : "text-zinc-400"
                                                    )}
                                                >
                                                    Trade Open
                                                </button>
                                                <button
                                                    onClick={() => setGroupBy("close")}
                                                    className={cn(
                                                        "px-2 py-1 text-xs",
                                                        groupBy === "close" ? "bg-zinc-700 text-white" : "text-zinc-400"
                                                    )}
                                                >
                                                    Trade Close
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-zinc-500">Date Mode:</span>
                                            <div className="flex rounded-lg overflow-hidden border border-zinc-700">
                                                <button
                                                    onClick={() => setDateMode("before")}
                                                    className={cn(
                                                        "px-2 py-1 text-xs",
                                                        dateMode === "before" ? "bg-zinc-700 text-white" : "text-zinc-400"
                                                    )}
                                                >
                                                    Before
                                                </button>
                                                <button
                                                    onClick={() => setDateMode("range")}
                                                    className={cn(
                                                        "px-2 py-1 text-xs",
                                                        dateMode === "range" ? "bg-zinc-700 text-white" : "text-zinc-400"
                                                    )}
                                                >
                                                    Range
                                                </button>
                                                <button
                                                    onClick={() => setDateMode("after")}
                                                    className={cn(
                                                        "px-2 py-1 text-xs",
                                                        dateMode === "after" ? "bg-zinc-700 text-white" : "text-zinc-400"
                                                    )}
                                                >
                                                    After
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleApply}
                                        className="px-4 py-1.5 rounded-lg bg-emerald-500 text-black text-xs font-bold hover:bg-emerald-400 transition-colors"
                                    >
                                        Apply
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
