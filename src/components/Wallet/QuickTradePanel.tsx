"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { ChevronDown, ArrowRightLeft, Wallet } from "lucide-react";
import { usePortfolioData } from "@/hooks/usePortfolioData";
import { useRealtimeMarket } from "@/hooks/useRealtimeMarket";

export const QuickTradePanel = () => {
    const [mode, setMode] = useState<"buy" | "sell">("buy");
    const [amount, setAmount] = useState("");
    const [selectedToken, setSelectedToken] = useState("BTC");

    const { assets, wsConnectionStatus } = usePortfolioData();
    const { allStats } = useRealtimeMarket();

    // Get wallet connections
    const walletConnections = Array.from(wsConnectionStatus?.entries() || [])
        .filter(([_, info]) => ['zerion', 'wallet', 'evm', 'solana'].includes(info.type));

    // Calculate total wallet balance
    const walletAssets = assets.filter(asset => {
        if (!asset.breakdown) return false;
        return Object.keys(asset.breakdown).some(sourceId => {
            const connection = wsConnectionStatus?.get(sourceId);
            return connection && ['zerion', 'wallet', 'evm', 'solana'].includes(connection.type);
        });
    });

    const totalBalance = walletAssets.reduce((sum, asset) => {
        const walletBalance = Object.entries(asset.breakdown || {}).reduce((balSum, [sourceId, amount]) => {
            const connection = wsConnectionStatus?.get(sourceId);
            return connection && ['zerion', 'wallet', 'evm', 'solana'].includes(connection.type)
                ? balSum + amount
                : balSum;
        }, 0);
        return sum + (walletBalance * asset.price);
    }, 0);

    // Get real price from market data
    const tokenPrice = allStats[selectedToken]?.price || 0;
    const estimatedReceive = amount && tokenPrice ? (parseFloat(amount) / tokenPrice).toFixed(8) : "0.00000000";

    // No wallets connected
    if (walletConnections.length === 0) {
        return (
            <Card className="bg-[#141318] border-white/5 h-full">
                <CardHeader className="pb-2">
                    <CardTitle className="text-xl font-bold font-urbanist">Quick Trade</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="h-12 w-12 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
                        <Wallet className="h-6 w-6 text-zinc-500" />
                    </div>
                    <p className="text-zinc-500 text-sm mb-2">No wallets connected</p>
                    <p className="text-zinc-600 text-xs">Add wallets in Settings to enable trading</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-[#141318] border-white/5 h-full">
            <CardHeader className="pb-2">
                <CardTitle className="text-xl font-bold font-urbanist">Quick Trade</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Buy/Sell Switcher */}
                <div className="flex p-1 bg-white/5 rounded-xl">
                    <button
                        onClick={() => setMode("buy")}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === "buy" ? "bg-[#1E1E24] text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300"}`}
                    >
                        Buy
                    </button>
                    <button
                        onClick={() => setMode("sell")}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === "sell" ? "bg-[#1E1E24] text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300"}`}
                    >
                        Sell
                    </button>
                </div>

                {/* Spend Input */}
                <div className="space-y-2">
                    <div className="flex justify-between text-xs text-zinc-500 px-1">
                        <span>Spend</span>
                        <span>Balance: ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="relative">
                        <input
                            type="number"
                            placeholder="0"
                            className="w-full bg-[#0E0E11] border border-white/5 rounded-xl py-4 pl-4 pr-32 text-white font-mono placeholder:text-zinc-700 focus:outline-none focus:border-primary/50"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-[#1E1E24] px-3 py-1.5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
                            <span className="text-xs font-bold text-white">USDT</span>
                            <ChevronDown className="h-3 w-3 text-zinc-400" />
                        </div>
                    </div>
                </div>

                {/* Receive Input */}
                <div className="space-y-2">
                    <div className="flex justify-between text-xs text-zinc-500 px-1">
                        <span>Receive</span>
                        <span>Price: ${tokenPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="relative">
                        <input
                            type="text"
                            readOnly
                            value={estimatedReceive}
                            className="w-full bg-[#0E0E11] border border-white/5 rounded-xl py-4 pl-4 pr-32 text-emerald-400 font-mono focus:outline-none"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-[#1E1E24] px-3 py-1.5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
                            <div className="h-4 w-4 rounded-full bg-orange-500 flex items-center justify-center text-[8px] font-bold text-white">B</div>
                            <span className="text-xs font-bold text-white">{selectedToken}</span>
                            <ChevronDown className="h-3 w-3 text-zinc-400" />
                        </div>
                    </div>
                </div>

                {/* Buy Button */}
                <button className="w-full bg-[#EB8644] hover:bg-[#D97533] text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-orange-500/20 active:scale-[0.98]">
                    {mode === "buy" ? `Buy ${selectedToken}` : `Sell ${selectedToken}`}
                </button>
            </CardContent>
        </Card>
    );
};
