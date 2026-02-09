"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Transaction, Transfer } from "@/lib/api/types";
import { format } from "date-fns";
import { ArrowUpRight, ArrowDownRight, RefreshCw, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecentActivityProps {
    transactions: (Transaction | Transfer)[];
    className?: string;
}

export function RecentActivity({ transactions, className }: RecentActivityProps) {
    const recent = transactions.slice(0, 5);

    const getTypeIcon = (tx: Transaction | Transfer) => {
        const item = tx as any;
        const t = (item.type || item.side || '').toLowerCase();

        if (t.includes('buy')) return <ArrowDownRight className="h-4 w-4 text-emerald-500" />;
        if (t.includes('sell')) return <ArrowUpRight className="h-4 w-4 text-fuchsia-500" />;
        if (t.includes('deposit')) return <ArrowDownRight className="h-4 w-4 text-emerald-500" />;
        if (t.includes('withdraw')) return <ArrowUpRight className="h-4 w-4 text-amber-500" />;
        return <RefreshCw className="h-4 w-4 text-blue-500" />;
    };

    return (
        <Card className={cn("bg-[#141318] border-white/5 flex flex-col h-full", className)}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-bold font-urbanist flex items-center gap-2 uppercase text-zinc-400 tracking-wider">
                    <Activity className="h-4 w-4" />
                    Recent Activity
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="flex flex-col">
                    {recent.length > 0 ? (
                        recent.map((tx, idx) => {
                            const item = tx as any;
                            const symbol = item.symbol || item.asset;
                            const amount = item.amount;
                            const side = item.side || item.type;

                            return (
                                <div key={idx} className="flex items-center justify-between p-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={cn("h-8 w-8 rounded-full flex items-center justify-center bg-zinc-900 border border-white/5")}>
                                            {getTypeIcon(tx)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white">{symbol}</p>
                                            <p className="text-xs text-zinc-500 capitalize">{side}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-mono text-zinc-300">
                                            {amount?.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                        </p>
                                        <p className="text-xs text-zinc-600 font-mono">
                                            {format(new Date(item.timestamp), 'HH:mm')}
                                        </p>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="p-6 text-center text-zinc-500 text-sm">
                            No recent activity found.
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
