"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { Wallet, ArrowUpRight, ArrowDownRight, Clock } from "lucide-react";

export const TransactionProgress = () => {
    const { assets, wsConnectionStatus } = usePortfolio();

    // Get Zerion/wallet connections
    const walletConnections = Array.from(wsConnectionStatus?.entries() || [])
        .filter(([_, info]) => ['zerion', 'wallet', 'evm', 'solana'].includes(info.type));

    // Get wallet assets
    const walletAssets = (assets || []).filter(asset => {
        if (!asset.breakdown) return false;
        return Object.keys(asset.breakdown).some(sourceId => {
            const connection = wsConnectionStatus?.get(sourceId);
            return connection && ['zerion', 'wallet', 'evm', 'solana'].includes(connection.type);
        });
    });

    // Calculate total value from wallet assets
    const totalValue = walletAssets.reduce((sum, asset) => {
        const walletBalance = Object.entries(asset.breakdown || {}).reduce((balSum, [sourceId, amount]) => {
            const connection = wsConnectionStatus?.get(sourceId);
            return connection && ['zerion', 'wallet', 'evm', 'solana'].includes(connection.type)
                ? balSum + amount
                : balSum;
        }, 0);
        return sum + (walletBalance * asset.price);
    }, 0);

    // Calculate progress as percentage of total connections active
    const activeConnections = walletConnections.filter(([_, info]) => info.status === 'connected').length;
    const progress = walletConnections.length > 0
        ? Math.round((activeConnections / walletConnections.length) * 100)
        : 0;

    // SVG Circular Progress logic
    const radius = 80;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;

    return (
        <Card className="bg-[#141318] border-white/5 h-full">
            <CardHeader>
                <CardTitle className="text-xl font-bold font-urbanist">Wallet Status</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col items-center justify-center py-8 relative">
                    {/* Semi-Circle Progress */}
                    <div className="relative w-48 h-28 overflow-hidden">
                        <svg className="w-48 h-48 transform rotate-180" viewBox="0 0 200 200">
                            {/* Background Track */}
                            <circle
                                cx="100"
                                cy="100"
                                r={radius}
                                fill="none"
                                stroke="#1E1E24"
                                strokeWidth="24"
                                strokeLinecap="round"
                                strokeDasharray={`${circumference / 2} ${circumference}`}
                            />
                            {/* Progress Track */}
                            <circle
                                cx="100"
                                cy="100"
                                r={radius}
                                fill="none"
                                stroke={progress > 0 ? "#7F6AFF" : "#333"}
                                strokeWidth="24"
                                strokeLinecap="round"
                                strokeDasharray={`${circumference / 2} ${circumference}`}
                                strokeDashoffset={offset + (circumference / 2)}
                                className="transition-all duration-1000 ease-out"
                            />
                        </svg>

                        {/* Percentage Text */}
                        <div className="absolute bottom-0 left-0 w-full text-center">
                            <span className="text-4xl font-bold text-white block">{progress}%</span>
                            <span className="text-xs text-zinc-500 uppercase tracking-wider">Connected</span>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-8 mt-8">
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-[#7F6AFF]"></div>
                            <span className="text-white font-bold">{walletConnections.length}</span>
                            <span className="text-zinc-500 text-sm">Wallets</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                            <span className="text-white font-bold">{walletAssets.length}</span>
                            <span className="text-zinc-500 text-sm">Assets</span>
                        </div>
                    </div>

                    {/* Total Value */}
                    {walletConnections.length > 0 && (
                        <div className="mt-4 text-center">
                            <span className="text-zinc-500 text-xs uppercase">Total Value</span>
                            <div className="text-xl font-bold text-white font-mono">
                                ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
