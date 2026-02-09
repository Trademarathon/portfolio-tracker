"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateSymbolStats, formatPnL, SymbolStats } from "@/lib/api/journal-stats";
import { Transaction } from "@/lib/api/types";
import { Coins, ArrowUpDown, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SymbolsReportWidgetProps {
    trades: Transaction[];
    className?: string;
}

type SortKey = 'symbol' | 'count' | 'winRate' | 'totalPnL' | 'avgPnL';
type SortDir = 'asc' | 'desc';

export function SymbolsReportWidget({ trades, className }: SymbolsReportWidgetProps) {
    const [sortKey, setSortKey] = useState<SortKey>('totalPnL');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    const symbolStats = useMemo(() => calculateSymbolStats(trades), [trades]);

    const sortedStats = useMemo(() => {
        return [...symbolStats].sort((a, b) => {
            let cmp = 0;
            switch (sortKey) {
                case 'symbol':
                    cmp = a.symbol.localeCompare(b.symbol);
                    break;
                case 'count':
                    cmp = a.count - b.count;
                    break;
                case 'winRate':
                    cmp = a.winRate - b.winRate;
                    break;
                case 'totalPnL':
                    cmp = a.totalPnL - b.totalPnL;
                    break;
                case 'avgPnL':
                    cmp = a.avgPnL - b.avgPnL;
                    break;
            }
            return sortDir === 'asc' ? cmp : -cmp;
        });
    }, [symbolStats, sortKey, sortDir]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('desc');
        }
    };

    const SortHeader = ({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) => (
        <button
            onClick={() => handleSort(sortKeyName)}
            className={cn(
                "flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold transition-colors",
                sortKey === sortKeyName ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
        >
            {label}
            <ArrowUpDown className="h-3 w-3" />
        </button>
    );

    return (
        <Card className={cn("bg-zinc-900/50 border-white/10", className)}>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Coins className="h-4 w-4 text-amber-500" />
                    Symbols Report
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
                {trades.length === 0 ? (
                    <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                        No trades to analyze
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="text-left py-2 px-2">
                                        <SortHeader label="Symbol" sortKeyName="symbol" />
                                    </th>
                                    <th className="text-center py-2 px-2">
                                        <SortHeader label="Trades" sortKeyName="count" />
                                    </th>
                                    <th className="text-center py-2 px-2">
                                        <SortHeader label="Win Rate" sortKeyName="winRate" />
                                    </th>
                                    <th className="text-center py-2 px-2">
                                        <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                                            L/S
                                        </span>
                                    </th>
                                    <th className="text-right py-2 px-2">
                                        <SortHeader label="Avg PnL" sortKeyName="avgPnL" />
                                    </th>
                                    <th className="text-right py-2 px-2">
                                        <SortHeader label="Total PnL" sortKeyName="totalPnL" />
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedStats.slice(0, 10).map((stat, i) => (
                                    <tr
                                        key={stat.symbol}
                                        className={cn(
                                            "border-b border-white/5 transition-colors hover:bg-white/5",
                                            i % 2 === 0 ? "" : "bg-white/2"
                                        )}
                                    >
                                        <td className="py-2 px-2">
                                            <span className="font-bold text-sm">{stat.symbol}</span>
                                        </td>
                                        <td className="text-center py-2 px-2">
                                            <span className="text-sm font-mono">{stat.count}</span>
                                        </td>
                                        <td className="text-center py-2 px-2">
                                            <span className={cn(
                                                "text-sm font-mono font-bold",
                                                stat.winRate >= 0.5 ? "text-emerald-500" : "text-amber-500"
                                            )}>
                                                {(stat.winRate * 100).toFixed(0)}%
                                            </span>
                                        </td>
                                        <td className="text-center py-2 px-2">
                                            <div className="flex items-center justify-center gap-1 text-[10px]">
                                                <TrendingUp className="h-3 w-3 text-emerald-500" />
                                                <span>{stat.longCount}</span>
                                                <span className="text-muted-foreground">/</span>
                                                <TrendingDown className="h-3 w-3 text-red-500" />
                                                <span>{stat.shortCount}</span>
                                            </div>
                                        </td>
                                        <td className="text-right py-2 px-2">
                                            <span className={cn(
                                                "text-sm font-mono",
                                                stat.avgPnL >= 0 ? "text-emerald-500" : "text-red-500"
                                            )}>
                                                {formatPnL(stat.avgPnL)}
                                            </span>
                                        </td>
                                        <td className="text-right py-2 px-2">
                                            <span className={cn(
                                                "text-sm font-mono font-bold",
                                                stat.totalPnL >= 0 ? "text-emerald-500" : "text-red-500"
                                            )}>
                                                {formatPnL(stat.totalPnL)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {sortedStats.length > 10 && (
                            <div className="text-center mt-3">
                                <span className="text-[10px] text-muted-foreground">
                                    Showing top 10 of {sortedStats.length} symbols
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
