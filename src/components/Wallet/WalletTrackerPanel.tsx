"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, History, Bookmark, Plus, Wallet, ArrowRight, ExternalLink } from "lucide-react";
import { PortfolioConnection } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export function WalletTrackerPanel() {
    const [activeTab, setActiveTab] = useState("Track Address");
    const [addressInput, setAddressInput] = useState("");
    const [connections, setConnections] = useState<PortfolioConnection[]>([]);

    const tabs = ["Track Address", "Tracking"];

    // Load user's wallet connections from localStorage
    useEffect(() => {
        const stored = localStorage.getItem("portfolio_connections");
        if (stored) {
            try {
                const parsed = JSON.parse(stored) as PortfolioConnection[];
                // Filter to only wallet-type connections (EVM, Solana, Zerion, etc.)
                const wallets = parsed.filter(c =>
                    ['wallet', 'zerion', 'evm', 'solana'].includes(c.type) &&
                    c.walletAddress &&
                    c.enabled !== false
                );
                setConnections(wallets);
            } catch (e) {
                console.error("Failed to parse connections:", e);
            }
        }
    }, []);

    const handleTrackWallet = () => {
        if (!addressInput.trim()) return;
        // Navigate to settings to add the wallet
        window.location.href = `/settings?addWallet=${encodeURIComponent(addressInput)}`;
    };

    return (
        <Card className="h-full bg-[#141318] border border-white/5 rounded-xl overflow-hidden flex flex-col">
            <CardHeader className="pb-3 space-y-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold text-zinc-400 uppercase tracking-widest font-urbanist">
                        Wallet Tracker
                    </CardTitle>
                    <div className="p-1.5 bg-white/5 rounded-full">
                        <Wallet className="w-4 h-4 text-zinc-500" />
                    </div>
                </div>
                <SegmentedControl
                    options={tabs}
                    value={activeTab}
                    onChange={setActiveTab}
                    className="w-full"
                />
            </CardHeader>
            <CardContent className="flex-1 min-h-0 flex flex-col gap-4">
                {activeTab === "Track Address" && (
                    <div className="flex flex-col gap-4 h-full justify-center">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase">Enter Address or ENS</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                                <Input
                                    placeholder="0x... or name.eth"
                                    className="pl-10 bg-zinc-900/50 border-white/5 h-10 text-sm focus-visible:ring-primary/50"
                                    value={addressInput}
                                    onChange={(e) => setAddressInput(e.target.value)}
                                />
                            </div>
                        </div>
                        <Button
                            onClick={handleTrackWallet}
                            className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-10 rounded-lg"
                        >
                            Track Wallet <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400">
                            <strong>Pro Tip:</strong> Add wallets in Settings → Connections to track holdings and transactions.
                        </div>
                    </div>
                )}

                {activeTab === "Tracking" && (
                    <div className="space-y-2 overflow-auto pr-2 custom-scrollbar">
                        {connections.length > 0 ? (
                            connections.map((wallet, i) => (
                                <div key={wallet.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer group">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-full bg-zinc-900 text-emerald-500/50 group-hover:text-emerald-500 transition-colors">
                                            <Bookmark className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white">{wallet.name}</div>
                                            <div className="text-[10px] text-zinc-500 font-mono">
                                                {wallet.walletAddress?.slice(0, 6)}...{wallet.walletAddress?.slice(-4)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="px-2 py-0.5 rounded bg-zinc-900 text-[10px] font-bold text-zinc-400 border border-white/5 uppercase">
                                            {wallet.chain || wallet.type}
                                        </div>
                                        <a
                                            href={`https://etherscan.io/address/${wallet.walletAddress}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-1 hover:bg-white/10 rounded transition-colors"
                                            title="View on Explorer"
                                        >
                                            <ExternalLink className="h-3 w-3 text-zinc-500 hover:text-white" />
                                        </a>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8 text-zinc-500 text-sm">
                                <Wallet className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p className="mb-2">No wallets tracked yet</p>
                                <p className="text-xs text-zinc-600">Add wallets in Settings → Connections</p>
                            </div>
                        )}
                        <Button
                            variant="outline"
                            className="w-full border-dashed border-white/10 text-zinc-500 hover:text-white hover:bg-white/5 h-9 text-xs uppercase font-bold tracking-wider"
                            onClick={() => window.location.href = '/settings'}
                        >
                            <Plus className="mr-2 h-3 w-3" /> Add Wallet
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
