"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useJournal } from "@/contexts/JournalContext";
import { JOURNAL_WIDGET_DEFINITIONS } from "@/lib/journal-widgets";
import { WIDGET_ICON_SIZE_CARD } from "@/lib/widget-standards";
import type { WidgetType } from "./AddWidgetModal";
import {
    Settings,
    Move,
    X,
    ChevronDown,
} from "lucide-react";

interface WidgetCardProps {
    widget: WidgetType;
    onRemove: () => void;
    isEditing: boolean;
    index: number;
}

type TimePeriod = 'year' | 'month' | 'week' | 'day';

function WidgetCard({ widget, onRemove, isEditing, index }: WidgetCardProps) {
    const { stats, filteredTrades, preferences } = useJournal();
    const [timePeriod, setTimePeriod] = useState<TimePeriod>('month');

    // Calculate widget-specific data
    const widgetData = useMemo(() => {
        switch (widget.id) {
            case 'pnl_cumulative':
            case 'pnl':
                return { value: stats.totalPnl, label: 'Total PnL' };
            case 'win_rate':
                return { value: stats.winRate, label: 'Win Rate', suffix: '%' };
            case 'hold_time':
                const hours = stats.avgHoldTime / (1000 * 60 * 60);
                return { value: hours, label: 'Avg Hold Time', suffix: 'h' };
            case 'volume_cumulative':
                return { value: stats.totalVolume, label: 'Total Volume' };
            case 'total_trades':
                return { value: stats.totalTrades, label: 'Total Trades', noFormat: true };
            case 'biggest_loss':
                return { value: stats.largestLoss, label: 'Biggest Loss' };
            case 'biggest_profit':
                return { value: stats.largestWin, label: 'Biggest Profit' };
            case 'fees':
            case 'fees_cumulative':
                const totalFees = filteredTrades.reduce((sum, t) => sum + (t.fees || 0), 0);
                return { value: Math.abs(totalFees), label: 'Total Fees' };
            case 'profit_factor':
                return { value: stats.profitFactor, label: 'Profit Factor', noFormat: true };
            case 'loss_factor':
                return { value: stats.avgLoss, label: 'Loss Factor' };
            default:
                return { value: 0, label: 'Unknown' };
        }
    }, [widget.id, stats, filteredTrades]);

    // Format value
    const formatValue = (value: number, suffix?: string, noFormat?: boolean) => {
        if (preferences.hideBalances && !noFormat && !suffix) return '••••';
        if (noFormat) return value.toFixed(2);
        if (suffix) return `${value.toFixed(1)}${suffix}`;
        return `$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const isPositive = widgetData.value >= 0;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: index * 0.05 }}
            className={cn(
                "rounded-2xl bg-zinc-900/50 border border-zinc-800/50 overflow-hidden",
                isEditing && "ring-2 ring-emerald-500/30"
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800/30">
                <div className="flex items-center gap-2">
                    <widget.icon size={WIDGET_ICON_SIZE_CARD} className="text-zinc-400" />
                    <span className="text-sm font-bold text-white">{widget.name}</span>
                </div>
                <div className="flex items-center gap-1">
                    {isEditing && (
                        <>
                            <button className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors cursor-move">
                                <Move className="w-4 h-4" />
                            </button>
                            <button className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors">
                                <Settings className="w-4 h-4" />
                            </button>
                            <button
                                onClick={onRemove}
                                className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-rose-400 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Chart Area */}
            <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <p className={cn(
                        "text-3xl font-black",
                        widget.id.includes('loss') || widgetData.value < 0 ? "text-rose-400" : "text-emerald-400"
                    )}>
                        {widgetData.value < 0 && !widgetData.suffix ? '-' : ''}
                        {formatValue(widgetData.value, widgetData.suffix, widgetData.noFormat)}
                    </p>
                </div>

                {/* Mini Chart Placeholder */}
                <div className="h-24 flex items-center justify-center bg-zinc-800/30 rounded-xl">
                    <div className="text-xs text-zinc-600">Chart visualization</div>
                </div>
            </div>

            {/* Footer */}
            <div className="px-4 pb-4 flex items-center justify-between">
                {/* Time Period Selector */}
                <div className="flex rounded-lg overflow-hidden border border-zinc-700/50">
                    {(['year', 'month', 'week', 'day'] as TimePeriod[]).map(period => (
                        <button
                            key={period}
                            onClick={() => setTimePeriod(period)}
                            className={cn(
                                "px-2 py-1 text-[10px] uppercase tracking-wider font-bold transition-colors",
                                timePeriod === period ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            {period.charAt(0)}
                        </button>
                    ))}
                </div>

                {/* Insight */}
                <span className="text-[10px] text-zinc-500">{widgetData.label}</span>
            </div>
        </motion.div>
    );
}

interface WidgetGridProps {
    selectedWidgets: string[];
    isEditing: boolean;
    onRemoveWidget: (widgetId: string) => void;
}

export function WidgetGrid({ selectedWidgets, isEditing, onRemoveWidget }: WidgetGridProps) {
    const widgets = selectedWidgets
        .map(id => JOURNAL_WIDGET_DEFINITIONS.find(w => w.id === id))
        .filter(Boolean) as WidgetType[];

    if (widgets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[400px] rounded-2xl border-2 border-dashed border-zinc-800">
                <p className="text-zinc-500 text-sm mb-2">No widgets added yet</p>
                <p className="text-zinc-600 text-xs">Click "Add Widget" to get started</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-3 gap-4">
            {widgets.map((widget, index) => (
                <WidgetCard
                    key={widget.id}
                    widget={widget}
                    onRemove={() => onRemoveWidget(widget.id)}
                    isEditing={isEditing}
                    index={index}
                />
            ))}
        </div>
    );
}
