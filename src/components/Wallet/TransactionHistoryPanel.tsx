"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Transaction, Transfer } from "@/lib/api/types";
import { format } from "date-fns";
import { ArrowUpRight, ArrowDownRight, RefreshCw, ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface TransactionHistoryPanelProps {
    transactions: (Transaction | Transfer)[];
    className?: string;
}

type FilterType = 'all' | 'buy' | 'sell' | 'transfer';

export function TransactionHistoryPanel({ transactions, className }: TransactionHistoryPanelProps) {
    const [filter, setFilter] = useState<FilterType>('all');

    const filteredTransactions = transactions.filter(t => {
        const item = t as any;
        const type = item.type || item.side;

        if (filter === 'all') return true;
        if (filter === 'buy') return (type === 'buy' || type === 'Buy');
        if (filter === 'sell') return (type === 'sell' || type === 'Sell');
        if (filter === 'transfer') return (type === 'Deposit' || type === 'Withdraw');
        return true;
    }).sort((a, b) => b.timestamp - a.timestamp);

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'completed':
            case 'confirmed':
            case 'success':
                return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
            case 'pending':
                return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
            case 'failed':
                return 'bg-red-500/10 text-red-500 border-red-500/20';
            default:
                return 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20';
        }
    };

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
                <CardTitle className="text-xl font-bold font-urbanist flex items-center gap-2">
                    <ArrowRightLeft className="h-5 w-5 text-zinc-400" />
                    Transaction History
                </CardTitle>
                <div className="flex bg-zinc-900/50 p-1 rounded-lg border border-white/5">
                    {(['all', 'buy', 'sell', 'transfer'] as FilterType[]).map((f) => (
                        <Button
                            key={f}
                            variant="ghost"
                            size="sm"
                            onClick={() => setFilter(f)}
                            className={cn(
                                "h-7 px-3 text-xs capitalize rounded-md transition-all",
                                filter === f
                                    ? "bg-white/10 text-white shadow-sm"
                                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                            )}
                        >
                            {f}
                        </Button>
                    ))}
                </div>
            </CardHeader>
            <CardContent className="p-0 overflow-auto max-h-[600px] custom-scrollbar">
                <Table>
                    <TableHeader className="bg-zinc-900/50 sticky top-0 z-10 backdrop-blur-sm">
                        <TableRow className="hover:bg-transparent border-white/5">
                            <TableHead className="w-[140px] text-xs font-bold uppercase tracking-wider text-zinc-500">Date</TableHead>
                            <TableHead className="w-[100px] text-xs font-bold uppercase tracking-wider text-zinc-500">Type</TableHead>
                            <TableHead className="text-xs font-bold uppercase tracking-wider text-zinc-500">Asset</TableHead>
                            <TableHead className="text-right text-xs font-bold uppercase tracking-wider text-zinc-500">Amount</TableHead>
                            <TableHead className="text-right text-xs font-bold uppercase tracking-wider text-zinc-500">Price</TableHead>
                            <TableHead className="text-right text-xs font-bold uppercase tracking-wider text-zinc-500">Total Value</TableHead>
                            <TableHead className="w-[100px] text-right text-xs font-bold uppercase tracking-wider text-zinc-500">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredTransactions.length > 0 ? (
                            filteredTransactions.map((tx, idx) => {
                                const item = tx as any;
                                const symbol = item.symbol || item.asset;
                                const amount = item.amount;
                                const price = item.price;
                                const side = item.side || item.type;
                                const status = item.status;

                                let totalValue = 0;
                                if (item.cost) totalValue = item.cost;
                                else if (price && amount) totalValue = price * amount;

                                return (
                                    <TableRow key={`${item.id}-${idx}`} className="border-white/5 hover:bg-white/5 transition-colors">
                                        <TableCell className="font-mono text-xs text-zinc-400">
                                            {format(new Date(item.timestamp), 'MMM dd, HH:mm')}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {getTypeIcon(tx)}
                                                <span className={cn(
                                                    "capitalize text-sm font-medium",
                                                    (side === 'buy' || side === 'Deposit') ? "text-emerald-500" :
                                                        (side === 'sell' || side === 'Withdraw') ? "text-fuchsia-500" : "text-white"
                                                )}>
                                                    {side}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-white">{symbol}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-zinc-300">
                                            {amount?.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-zinc-400">
                                            {price ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-bold text-white">
                                            {totalValue > 0 ? `$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 uppercase", getStatusColor(status || 'completed'))}>
                                                {status || 'Completed'}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        ) : (
                            <TableRow>
                                <TableCell colSpan={7} className="h-32 text-center text-zinc-500">
                                    No transactions found matching filter.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
