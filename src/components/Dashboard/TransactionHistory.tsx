"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Transaction } from '@/lib/api/types';
import { format } from 'date-fns';

interface TransactionHistoryProps {
    transactions: Transaction[];
}

export default function TransactionHistory({ transactions }: TransactionHistoryProps) {
    if (!transactions || transactions.length === 0) {
        return (
            <Card className="border-white/10 bg-card/50 backdrop-blur-sm h-full">
                <CardHeader>
                    <CardTitle>Recent Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-sm">No recent transactions found.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-white/10 bg-card/50 backdrop-blur-sm h-full">
            <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-auto max-h-[300px]">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase bg-white/5 sticky top-0">
                            <tr>
                                <th className="px-4 py-2">Time</th>
                                <th className="px-4 py-2">Symbol</th>
                                <th className="px-4 py-2">Side</th>
                                <th className="px-4 py-2 text-right">Price</th>
                                <th className="px-4 py-2 text-right">Amount</th>
                                <th className="px-4 py-2">Exchange</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map((tx) => (
                                <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{format(tx.timestamp, 'MM/dd HH:mm')}</td>
                                    <td className="px-4 py-2 font-medium">{tx.symbol}</td>
                                    <td className={`px-4 py-2 font-bold ${tx.side === 'buy' ? 'text-emerald-500' : 'text-red-500'}`}>
                                        {tx.side.toUpperCase()}
                                    </td>
                                    <td className="px-4 py-2 text-right">${tx.price.toLocaleString()}</td>
                                    <td className="px-4 py-2 text-right">{tx.amount}</td>
                                    <td className="px-4 py-2 text-xs text-muted-foreground">{tx.exchange}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
