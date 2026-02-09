"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { UnifiedActivity } from '@/lib/api/transactions';
import { format } from 'date-fns';

export default function TransactionHistory({ transactions }: { transactions: UnifiedActivity[] }) {
    if (!transactions || transactions.length === 0) {
        return (
            <Card className="border-white/10 bg-card/50 backdrop-blur-sm h-full">
                <CardHeader>
                    <CardTitle>History</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-sm">No recent activity found.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-white/10 bg-card/50 backdrop-blur-sm h-full">
            <CardHeader>
                <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-auto max-h-[600px]">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase bg-white/5 sticky top-0">
                            <tr>
                                <th className="px-4 py-3">Time</th>
                                <th className="px-4 py-3">Source</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3">Asset</th>
                                <th className="px-4 py-3 text-right">Amount</th>
                                <th className="px-4 py-3 text-right">Price</th>
                                <th className="px-4 py-3 text-right">Fee</th>
                                <th className="px-4 py-3 text-right">Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map((tx) => {
                                const isTrade = tx.activityType === 'trade' || (tx as any).type === 'Buy' || (tx as any).type === 'Sell';
                                const isTransfer = tx.activityType === 'transfer' || (tx as any).type === 'Deposit' || (tx as any).type === 'Withdraw';
                                const isInternal = tx.activityType === 'internal';

                                const side = (tx as any).side || (tx as any).type || 'UNKNOWN';
                                let typeLabel = isTrade ? side.toUpperCase() : isTransfer ? ((tx as any).type || 'TRANSFER').toUpperCase() : 'INTERNAL';
                                let typeColor = 'text-zinc-500';

                                if (isTrade) {
                                    const s = side.toLowerCase();
                                    typeColor = (s === 'buy' || s === 'long') ? 'text-emerald-500' : 'text-red-500';
                                } else if (isTransfer) {
                                    typeColor = (tx as any).type === 'Deposit' ? 'text-emerald-500' : 'text-orange-500';
                                } else if (isInternal) {
                                    typeColor = 'text-blue-500';
                                }

                                // Mock fees if missing for visual verification
                                const fee = (tx as any).fee !== undefined ? (tx as any).fee : 0;
                                const feeCurrency = (tx as any).feeCurrency || '';

                                return (
                                    <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground font-mono text-xs">
                                            {format(new Date(tx.timestamp), 'MM/dd HH:mm')}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <CryptoIcon type={(tx as any).exchange || (tx as any).connectionId || 'wallet'} size={20} />
                                                <span className="text-xs uppercase text-zinc-400 hidden lg:inline">{(tx as any).exchange || 'Wallet'}</span>
                                            </div>
                                        </td>
                                        <td className={`px-4 py-3 font-bold text-xs ${typeColor}`}>
                                            {typeLabel}
                                        </td>
                                        <td className="px-4 py-3 font-medium">
                                            {isTrade ? ((tx as any).symbol || (tx as any).asset) : (tx as any).asset}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-zinc-300">
                                            {tx.amount}
                                        </td>
                                        <td className="px-4 py-3 text-right text-xs text-zinc-400">
                                            {isTrade
                                                ? `$${((tx as any).price || 0).toLocaleString()}`
                                                : '-'
                                            }
                                        </td>
                                        <td className="px-4 py-3 text-right text-xs text-zinc-400 font-mono">
                                            {fee > 0 ? `${fee.toFixed(4)} ${feeCurrency}` : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right text-xs text-zinc-500">
                                            {isInternal
                                                ? `${(tx as any).from} → ${(tx as any).to}`
                                                : (tx as any).address ? `${(tx as any).address.slice(0, 4)}...${(tx as any).address.slice(-4)}` : (tx as any).status || 'Completed'
                                            }
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}

import { CryptoIcon } from "@/components/ui/CryptoIcon";
