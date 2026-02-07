'use client';

import { Transaction } from '@/lib/api/types';
import { useMemo } from 'react';

interface TradingStatsProps {
    transactions: Transaction[];
}

export function TradingStats({ transactions }: TradingStatsProps) {
    const stats = useMemo(() => {
        const closedTrades = transactions.filter(t => t.status === 'closed' || t.pnl !== undefined);
        const totalTrades = closedTrades.length;

        if (totalTrades === 0) {
            return {
                netPnl: 0,
                winRate: 0,
                profitFactor: 0,
                avgWin: 0,
                avgLoss: 0,
                bestPair: '-'
            };
        }

        const netPnl = closedTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);
        const wins = closedTrades.filter(t => (t.pnl || 0) > 0);
        const losses = closedTrades.filter(t => (t.pnl || 0) <= 0);

        const winRate = (wins.length / totalTrades) * 100;

        const grossProfit = wins.reduce((acc, t) => acc + (t.pnl || 0), 0);
        const grossLoss = Math.abs(losses.reduce((acc, t) => acc + (t.pnl || 0), 0));
        const profitFactor = grossLoss === 0 ? grossProfit : grossProfit / grossLoss;

        const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
        const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0; // Keeping positive for display

        // Best Pair
        const pairPerformance: Record<string, number> = {};
        closedTrades.forEach(t => {
            pairPerformance[t.symbol] = (pairPerformance[t.symbol] || 0) + (t.pnl || 0);
        });
        const bestPair = Object.entries(pairPerformance).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

        return {
            netPnl,
            winRate,
            profitFactor,
            avgWin,
            avgLoss,
            bestPair
        };
    }, [transactions]);

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <StatCard label="Net PnL" value={stats.netPnl} isCurrency color={stats.netPnl >= 0 ? 'text-green-400' : 'text-red-400'} />
            <StatCard label="Win Rate" value={stats.winRate} suffix="%" />
            <StatCard label="Profit Factor" value={stats.profitFactor} decimals={2} />
            <StatCard label="Avg Win" value={stats.avgWin} isCurrency className="text-green-400" />
            <StatCard label="Avg Loss" value={stats.avgLoss} isCurrency className="text-red-400" />
            <StatCard label="Best Pair" value={stats.bestPair} />
        </div>
    );
}

function StatCard({ label, value, isCurrency, suffix = '', color, decimals = 0, className = '' }: any) {
    let displayValue = value;
    if (typeof value === 'number') {
        if (isCurrency) {
            displayValue = value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });
        } else {
            displayValue = value.toFixed(decimals);
        }
    }

    return (
        <div className="bg-[#1E2026] rounded-xl border border-[#2B2F36] p-4 flex flex-col justify-between">
            <span className="text-xs text-gray-500 font-medium uppercase">{label}</span>
            <span className={`text-xl font-bold mt-1 ${color || 'text-gray-100'} ${className}`}>
                {displayValue}{suffix}
            </span>
        </div>
    );
}
