"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
    X, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
    Clock, ExternalLink, Copy, Check, Wallet, ArrowRightLeft,
    RefreshCw
} from "lucide-react";
import { usePortfolioData } from "@/hooks/usePortfolioData";
import { cn } from "@/lib/utils";

interface AssetDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    asset: {
        symbol: string;
        name?: string;
        balance: number;
        value: number;
        price: number;
        priceChange24h: number;
        walletAddress?: string;
        chain?: string;
    } | null;
}

export function AssetDetailModal({ isOpen, onClose, asset }: AssetDetailModalProps) {
    const [activeTab, setActiveTab] = useState("Overview");
    const [copied, setCopied] = useState(false);
    const { transactions, transfers, loading: isLoading } = usePortfolioData();

    if (!asset) return null;

    // Filter transactions for this asset
    const assetTransactions = transactions?.filter(
        tx => tx.asset?.toUpperCase() === asset.symbol.toUpperCase() ||
            tx.symbol?.toUpperCase() === asset.symbol.toUpperCase()
    ) || [];

    // Filter transfers for this asset
    const assetTransfers = transfers?.filter(
        tx => tx.asset?.toUpperCase() === asset.symbol.toUpperCase() ||
            tx.symbol?.toUpperCase() === asset.symbol.toUpperCase()
    ) || [];

    const copyAddress = () => {
        if (asset.walletAddress) {
            navigator.clipboard.writeText(asset.walletAddress);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const tabs = ["Overview", "Transactions", "Transfers"];

    return (
        <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
            <DialogContent className="sm:max-w-[600px] bg-[#0E0E11] border-white/10 p-0 gap-0 overflow-hidden">
                {/* Header */}
                <DialogHeader className="p-4 pb-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-white/10 flex items-center justify-center">
                                <span className="text-lg font-bold text-white">{asset.symbol.slice(0, 2)}</span>
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold text-white">{asset.symbol}</DialogTitle>
                                <p className="text-sm text-zinc-500">{asset.name || asset.symbol}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-lg font-bold text-white font-mono">
                                ${asset.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <p className={cn(
                                "text-sm font-medium flex items-center justify-end gap-1",
                                asset.priceChange24h >= 0 ? "text-emerald-500" : "text-red-500"
                            )}>
                                {asset.priceChange24h >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {asset.priceChange24h >= 0 ? '+' : ''}{asset.priceChange24h.toFixed(2)}%
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                {/* Tabs */}
                <div className="px-4 pt-4">
                    <SegmentedControl
                        options={tabs}
                        value={activeTab}
                        onChange={setActiveTab}
                        className="w-full"
                    />
                </div>

                {/* Content */}
                <div className="p-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                    {activeTab === "Overview" && (
                        <div className="space-y-4">
                            {/* Quick Stats */}
                            <div className="grid grid-cols-2 gap-3">
                                <Card className="bg-white/5 border-white/5">
                                    <CardContent className="p-3">
                                        <p className="text-xs text-zinc-500 mb-1">Balance</p>
                                        <p className="text-lg font-bold text-white font-mono">
                                            {asset.balance.toLocaleString('en-US', { maximumFractionDigits: 6 })}
                                        </p>
                                        <p className="text-xs text-zinc-500">{asset.symbol}</p>
                                    </CardContent>
                                </Card>
                                <Card className="bg-white/5 border-white/5">
                                    <CardContent className="p-3">
                                        <p className="text-xs text-zinc-500 mb-1">Price</p>
                                        <p className="text-lg font-bold text-white font-mono">
                                            ${asset.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                                        </p>
                                        <p className={cn(
                                            "text-xs",
                                            asset.priceChange24h >= 0 ? "text-emerald-500" : "text-red-500"
                                        )}>
                                            {asset.priceChange24h >= 0 ? '+' : ''}{asset.priceChange24h.toFixed(2)}% 24h
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Wallet Info */}
                            {asset.walletAddress && (
                                <Card className="bg-white/5 border-white/5">
                                    <CardContent className="p-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-xs text-zinc-500 mb-1 flex items-center gap-2">
                                                    <Wallet className="h-3 w-3" />
                                                    Wallet Address
                                                </p>
                                                <p className="text-sm text-white font-mono">
                                                    {asset.walletAddress.slice(0, 10)}...{asset.walletAddress.slice(-8)}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={copyAddress}
                                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                                    title="Copy Address"
                                                >
                                                    {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-zinc-400" />}
                                                </button>
                                                <a
                                                    href={`https://etherscan.io/address/${asset.walletAddress}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                                    title="View on Explorer"
                                                >
                                                    <ExternalLink className="h-4 w-4 text-zinc-400" />
                                                </a>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Recent Activity Summary */}
                            <Card className="bg-white/5 border-white/5">
                                <CardContent className="p-3">
                                    <p className="text-xs text-zinc-500 mb-2">Recent Activity</p>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <ArrowRightLeft className="h-4 w-4 text-blue-400" />
                                            <span className="text-sm text-white">{assetTransactions.length} trades</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <RefreshCw className="h-4 w-4 text-purple-400" />
                                            <span className="text-sm text-white">{assetTransfers.length} transfers</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {activeTab === "Transactions" && (
                        <div className="space-y-2">
                            {isLoading ? (
                                <div className="text-center py-8 text-zinc-500">
                                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                                    <p className="text-sm">Loading transactions...</p>
                                </div>
                            ) : assetTransactions.length > 0 ? (
                                assetTransactions.slice(0, 20).map((tx, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "p-2 rounded-full",
                                                tx.side === 'buy' ? "bg-emerald-500/20" : "bg-red-500/20"
                                            )}>
                                                {tx.side === 'buy' ?
                                                    <ArrowDownRight className="h-4 w-4 text-emerald-500" /> :
                                                    <ArrowUpRight className="h-4 w-4 text-red-500" />
                                                }
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-white capitalize">{tx.side || 'Trade'}</p>
                                                <p className="text-xs text-zinc-500">
                                                    {tx.amount?.toFixed(6)} {tx.asset || tx.symbol}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-mono text-white">
                                                ${(tx.cost || (tx.amount || 0) * (tx.price || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </p>
                                            <p className="text-xs text-zinc-500 flex items-center justify-end gap-1">
                                                <Clock className="h-3 w-3" />
                                                {new Date(tx.timestamp).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 text-zinc-500">
                                    <ArrowRightLeft className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No transactions found for {asset.symbol}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "Transfers" && (
                        <div className="space-y-2">
                            {isLoading ? (
                                <div className="text-center py-8 text-zinc-500">
                                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                                    <p className="text-sm">Loading transfers...</p>
                                </div>
                            ) : assetTransfers.length > 0 ? (
                                assetTransfers.slice(0, 20).map((tx, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "p-2 rounded-full",
                                                tx.type === 'deposit' ? "bg-emerald-500/20" : "bg-amber-500/20"
                                            )}>
                                                {tx.type === 'deposit' ?
                                                    <ArrowDownRight className="h-4 w-4 text-emerald-500" /> :
                                                    <ArrowUpRight className="h-4 w-4 text-amber-500" />
                                                }
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-white capitalize">{tx.type || 'Transfer'}</p>
                                                <p className="text-xs text-zinc-500">
                                                    {tx.amount?.toFixed(6)} {tx.asset || tx.symbol}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-zinc-500 flex items-center justify-end gap-1">
                                                <Clock className="h-3 w-3" />
                                                {new Date(tx.timestamp).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 text-zinc-500">
                                    <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No transfers found for {asset.symbol}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/5 flex justify-between items-center">
                    <a
                        href={`/asset/${asset.symbol}`}
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                        View Full Details <ExternalLink className="h-3 w-3" />
                    </a>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        Close
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
