"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useJournal } from "@/contexts/JournalContext";
import { formatDistanceToNow } from "date-fns";
import { 
    CheckCircle2, 
    AlertCircle, 
    Settings,
} from "lucide-react";
import Link from "next/link";
import { ExchangeIcon } from "@/components/ui/ExchangeIcon";

interface ExchangeCardProps {
    name: string;
    isConnected: boolean;
    lastSyncTime?: number;
    tradesCount?: number;
    diagnostic?: {
        status: 'ok' | 'empty' | 'error';
        message?: string;
        lastSyncAt: number;
    };
}

function ExchangeCard({ name, isConnected, lastSyncTime, tradesCount, diagnostic }: ExchangeCardProps) {
    return (
        <div className={cn(
            "flex items-center gap-3 p-3 rounded-xl transition-all",
            isConnected && diagnostic?.status === 'error'
                ? "bg-amber-500/10 border border-amber-500/30"
                : isConnected
                ? "bg-emerald-500/10 border border-emerald-500/30" 
                : "bg-zinc-800/30 border border-zinc-700/30"
        )}>
            <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.08] flex items-center justify-center shrink-0">
                <ExchangeIcon exchange={name} size={18} />
            </div>
            <div className="flex-1">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white capitalize">{name}</span>
                    {isConnected && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                </div>
                <span className="text-[10px] text-zinc-500">
                    {isConnected
                        ? diagnostic?.status === 'error'
                            ? (diagnostic.message || 'Sync/auth error')
                            : `${tradesCount || 0} trades synced`
                        : "Not connected"}
                </span>
            </div>
            {isConnected && (diagnostic?.lastSyncAt || lastSyncTime) && (
                <span className="text-[10px] text-zinc-500">
                    {formatDistanceToNow(diagnostic?.lastSyncAt || lastSyncTime!, { addSuffix: true })}
                </span>
            )}
        </div>
    );
}

export function ExchangesSyncStatus() {
    const { 
        connectedExchanges,
        lastSyncTime, 
        trades,
        syncDiagnostics,
    } = useJournal();
    
    const [, forceUpdate] = useState(0);
    
    // Update relative time
    useEffect(() => {
        const interval = setInterval(() => forceUpdate(n => n + 1), 30000);
        return () => clearInterval(interval);
    }, []);
    
    // Count trades by exchange
    const tradesByExchange = trades.reduce((acc, trade) => {
        const exchange = trade.exchange?.toLowerCase() || 'unknown';
        acc[exchange] = (acc[exchange] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    
    const supportedExchanges = ['binance', 'bybit', 'hyperliquid', 'okx', 'bitget'];
    
    // If no exchanges connected, show connect prompt
    if (connectedExchanges.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
            className="neo-card p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30"
        >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                            <AlertCircle className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white">No Exchanges Connected</h3>
                            <p className="text-xs text-zinc-400">
                                Connect your exchange accounts in Settings to sync trades automatically
                            </p>
                        </div>
                    </div>
                    <Link
                        href="/settings?tab=connections"
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/20 text-amber-400 text-sm font-medium hover:bg-amber-500/30 transition-colors"
                    >
                        <Settings className="w-4 h-4" />
                        Connect Exchange
                    </Link>
                </div>
                
                {/* Quick connect options */}
                    <div className="mt-4 pt-4 border-t border-amber-500/20">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-3">Supported Exchanges</p>
                    <div className="flex items-center gap-3">
                        {supportedExchanges.slice(0, 3).map(ex => (
                            <div key={ex} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/50">
                                <ExchangeIcon exchange={ex} size={16} />
                                <span className="text-xs text-zinc-400 capitalize">{ex}</span>
                            </div>
                        ))}
                        <span className="text-xs text-zinc-500">+2 more</span>
                    </div>
                </div>
            </motion.div>
        );
    }
    
    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="neo-card neo-card-cool p-4 rounded-2xl bg-zinc-900/40 border border-white/10"
        >
            <div>
                <p className="text-[10px] text-zinc-500 uppercase tracking-[0.16em] font-medium mb-3">
                    Exchange Connections
                </p>
                <div className="grid grid-cols-5 gap-3">
                    {supportedExchanges.map(exchange => (
                        <ExchangeCard
                            key={exchange}
                            name={exchange}
                            isConnected={connectedExchanges.includes(exchange)}
                            lastSyncTime={lastSyncTime || undefined}
                            tradesCount={tradesByExchange[exchange]}
                            diagnostic={syncDiagnostics[exchange]}
                        />
                    ))}
                </div>

                <div className="mt-4 flex items-center justify-between text-[10px] text-zinc-500">
                    <span>Trades auto-sync every 5 seconds when live sync is enabled</span>
                    <Link
                        href="/settings?tab=connections"
                        className="text-emerald-400 hover:text-emerald-300"
                    >
                        Configure API keys
                    </Link>
                </div>
            </div>
        </motion.div>
    );
}
