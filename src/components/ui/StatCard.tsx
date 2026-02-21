"use client";

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ICON_SIZES, TYPOGRAPHY } from '@/lib/design-tokens';

export type StatCardColor = 'primary' | 'emerald' | 'rose' | 'amber' | 'cyan' | 'indigo';

const COLOR_CLASSES: Record<StatCardColor, string> = {
    primary: 'from-indigo-500/10 to-indigo-500/5 border-indigo-500/20 text-indigo-400',
    emerald: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 text-emerald-400',
    rose: 'from-rose-500/10 to-rose-500/5 border-rose-500/20 text-rose-400',
    amber: 'from-amber-500/10 to-amber-500/5 border-amber-500/20 text-amber-400',
    cyan: 'from-cyan-500/10 to-cyan-500/5 border-cyan-500/20 text-cyan-400',
    indigo: 'from-indigo-500/10 to-indigo-500/5 border-indigo-500/20 text-indigo-400',
};

export interface StatCardProps {
    label: string;
    value: string | number;
    subValue?: string | React.ReactNode;
    icon?: LucideIcon;
    color?: StatCardColor;
    trend?: 'up' | 'down' | 'neutral';
    compact?: boolean;
    format?: 'currency' | 'percent' | 'number';
    decimals?: number;
    suffix?: string;
    /** Variants: gradient (default), simple (no icon), clean (subtle panel). */
    variant?: 'gradient' | 'simple' | 'clean';
    valueClassName?: string;
}

function formatValue(value: string | number, format?: 'currency' | 'percent' | 'number', decimals = 0, suffix?: string): string {
    if (typeof value === 'string') return value + (suffix ?? '');
    if (format === 'currency') {
        return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: decimals, maximumFractionDigits: 2 });
    }
    if (format === 'percent') {
        return `${value.toFixed(decimals)}%`;
    }
    return value.toFixed(decimals) + (suffix ?? '');
}

export function StatCard({
    label,
    value,
    subValue,
    icon: Icon,
    color = 'primary',
    trend = 'neutral',
    compact = false,
    format,
    decimals = 0,
    suffix = '',
    variant = 'gradient',
    valueClassName,
}: StatCardProps) {
    const displayValue = format !== undefined && typeof value === 'number'
        ? formatValue(value, format, decimals, suffix)
        : String(value) + suffix;

    if (variant === 'simple') {
        return (
            <div className="tm-stat-card group flex flex-col justify-between rounded-xl border border-[#2B2F36] bg-[#1E2026] p-4">
                <span className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</span>
                <span className={cn('mt-1 text-xl font-bold', valueClassName ?? 'text-gray-100')}>
                    {displayValue}
                </span>
            </div>
        );
    }

    if (variant === 'clean') {
        return (
            <div className={cn(
                'tm-stat-card group flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-900/40',
                compact ? 'p-2.5' : 'p-3.5'
            )}>
                {Icon && (
                    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-zinc-300 transition-transform duration-300 group-hover:scale-105">
                        <Icon size={ICON_SIZES.stat} className="shrink-0" />
                    </div>
                )}
                <div className="flex min-w-0 flex-col">
                    <span className={cn(TYPOGRAPHY.label, 'text-zinc-500')}>{label}</span>
                    <div className="flex items-baseline gap-1.5">
                        <span className={cn(TYPOGRAPHY.value, 'truncate text-white', valueClassName)}>{displayValue}</span>
                        {subValue != null && (
                            <span
                                className={cn(
                                    'text-[10px] font-bold',
                                    trend === 'up' && 'text-emerald-400',
                                    trend === 'down' && 'text-rose-400',
                                    trend === 'neutral' && 'text-zinc-500'
                                )}
                            >
                                {subValue}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className={cn(
                'tm-stat-card group flex items-center gap-3 rounded-xl border bg-gradient-to-br',
                compact ? 'p-2' : 'p-3',
                COLOR_CLASSES[color]
            )}
        >
            {Icon && (
                <div className="rounded-lg bg-black/20 p-2">
                    <Icon size={ICON_SIZES.stat} className="shrink-0" />
                </div>
            )}
            <div className="flex min-w-0 flex-col">
                <span className={cn(TYPOGRAPHY.label, 'text-zinc-500')}>{label}</span>
                <div className="flex items-baseline gap-1.5">
                    <span className={cn(TYPOGRAPHY.value, 'truncate', valueClassName)}>{displayValue}</span>
                    {subValue != null && (
                        <span
                            className={cn(
                                'text-[10px] font-bold',
                                trend === 'up' && 'text-emerald-400',
                                trend === 'down' && 'text-rose-400',
                                trend === 'neutral' && 'text-zinc-500'
                            )}
                        >
                            {subValue}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
