"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { UnifiedActivity } from '@/lib/api/transactions';
import { format } from 'date-fns';

function sourceLabel(tx: UnifiedActivity, connectionMap: Record<string, string>): string {
    const direct = (tx as any).exchange || '';
    if (direct) return direct;
    const byConn = (tx as any).connectionId ? connectionMap[(tx as any).connectionId] : '';
    if (byConn) return byConn;
    return 'Wallet';
}

export default function TransactionHistory({
    transactions,
    prices = {},
    connectionMap = {},
}: {
    transactions: UnifiedActivity[];
    prices?: Record<string, number>;
    connectionMap?: Record<string, string>;
}) {
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
                                <th className="px-4 py-3 text-right">Unit Price</th>
                                <th className="px-4 py-3 text-right">USD Value</th>
                                <th className="px-4 py-3 text-right">Fee</th>
                                <th className="px-4 py-3">Route / Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map((tx) => {
                                const isTrade = tx.activityType === 'trade' || (tx as any).type === 'Buy' || (tx as any).type === 'Sell';
                                const isTransfer = tx.activityType === 'transfer' || (tx as any).type === 'Deposit' || (tx as any).type === 'Withdraw';
                                const isInternal = tx.activityType === 'internal';

                                const side = (tx as any).side || (tx as any).type || 'UNKNOWN';
                                const typeLabel = isTrade
                                    ? String(side || '').toUpperCase()
                                    : isTransfer
                                        ? String(((tx as any).type || 'TRANSFER') || '').toUpperCase()
                                        : 'INTERNAL';
                                let typeColor = 'text-zinc-500';

                                if (isTrade) {
                                    const s = side.toLowerCase();
                                    typeColor = (s === 'buy' || s === 'long') ? 'text-emerald-500' : 'text-red-500';
                                } else if (isTransfer) {
                                    typeColor = (tx as any).type === 'Deposit' ? 'text-emerald-500' : 'text-orange-500';
                                } else if (isInternal) {
                                    typeColor = 'text-blue-500';
                                }

                                const fee = Number((tx as any).fee ?? 0);
                                const feeCurrency = (tx as any).feeCurrency || (tx as any).feeAsset || '';
                                const asset = (isTrade ? ((tx as any).symbol || (tx as any).asset) : (tx as any).asset) as string;
                                const unitPrice = isTrade
                                    ? Number((tx as any).price || 0)
                                    : Number((prices || {})[String(asset || '').toUpperCase()] || 0);
                                const usdValue = Number(tx.amount || 0) * unitPrice;
                                const route = (tx as any).from && (tx as any).to
                                    ? `${(tx as any).from} → ${(tx as any).to}`
                                    : sourceLabel(tx, connectionMap);
                                const network = (tx as any).network || (tx as any).chain || '';
                                const status = (tx as any).status || 'Completed';

                                return (
                                    <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground font-mono text-xs">
                                            {format(new Date(tx.timestamp), 'MM/dd HH:mm')}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <CryptoIcon type={(tx as any).exchange || (tx as any).connectionId || 'wallet'} size={20} />
                                                <span className="text-xs uppercase text-zinc-400 hidden lg:inline">{sourceLabel(tx, connectionMap)}</span>
                                            </div>
                                        </td>
                                        <td className={`px-4 py-3 font-bold text-xs ${typeColor}`}>
                                            {typeLabel}
                                        </td>
                                        <td className="px-4 py-3 font-medium">
                                            {asset}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-zinc-300">
                                            {Number(tx.amount || 0).toLocaleString(undefined, { maximumFractionDigits: 8 })}
                                        </td>
                                        <td className="px-4 py-3 text-right text-xs text-zinc-400">
                                            {unitPrice > 0 ? `$${unitPrice.toLocaleString(undefined, { maximumFractionDigits: 8 })}` : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right text-xs text-zinc-300 font-mono">
                                            {usdValue > 0 ? `$${usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right text-xs text-zinc-400 font-mono">
                                            {fee > 0 ? `${fee.toFixed(4)} ${feeCurrency}` : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-zinc-500">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-zinc-400">{route}</span>
                                                {(network || status) && (
                                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wide">
                                                        {network ? `${network} • ` : ''}{String(status)}
                                                    </span>
                                                )}
                                                <span>
                                                    {(tx as any).txHash
                                                        ? `${String((tx as any).txHash).slice(0, 10)}...${String((tx as any).txHash).slice(-8)}`
                                                        : (tx as any).address
                                                            ? `${String((tx as any).address).slice(0, 8)}...${String((tx as any).address).slice(-6)}`
                                                            : status}
                                                </span>
                                            </div>
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
