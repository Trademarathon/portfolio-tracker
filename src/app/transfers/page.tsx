"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeftRight, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { usePortfolioData } from "@/hooks/usePortfolioData";

export default function TransfersPage() {
    const { transfers, loading } = usePortfolioData();

    return (
        <div className="flex flex-col gap-6 pb-12">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-white">Transfers</h1>
                <p className="text-muted-foreground">Track deposits and withdrawals between wallets and exchanges.</p>
            </div>

            <Card className="bg-gradient-to-br from-zinc-900 to-zinc-950 border-white/10">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ArrowLeftRight className="h-5 w-5 text-primary" /> Transfer History
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="p-4 text-muted-foreground">Loading transfers...</div>
                    ) : transfers.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">
                            No transfer history found. Connect CEX APIs with Read permissions.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {transfers.map((t) => (
                                <div key={t.id} className="flex items-center justify-between p-4 border border-white/5 rounded-lg bg-zinc-900/40 hover:bg-white/5 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${t.type === 'Deposit' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                            {t.type === 'Deposit' ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                                        </div>
                                        <div>
                                            <div className="font-bold text-white flex items-center gap-2">
                                                {t.type} {t.asset}
                                                <span className="text-xs font-normal text-muted-foreground px-2 py-0.5 rounded-full bg-white/5 border border-white/5">
                                                    {t.status}
                                                </span>
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {t.id.slice(0, 10)}... {t.txHash ? `(Tx: ${t.txHash.slice(0, 6)}...)` : ''}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-white font-mono text-lg">{t.amount} {t.asset}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {new Date(t.timestamp).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
