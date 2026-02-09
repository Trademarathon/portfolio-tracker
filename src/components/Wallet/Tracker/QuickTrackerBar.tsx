"use client";

import { useState } from "react";
import { Plus, Search, ArrowRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TrackedGroup, TrackedAddress } from "@/hooks/useTrackedWallets";

interface QuickTrackerBarProps {
    groups: TrackedGroup[];
    activeGroupId: string | null;
    onAddAddress: (groupId: string, address: TrackedAddress) => void;
    onAddGroup: (name: string) => Promise<string | void> | void;
}

export function QuickTrackerBar({ groups, activeGroupId, onAddAddress, onAddGroup }: QuickTrackerBarProps) {
    const [address, setAddress] = useState("");
    const [loading, setLoading] = useState(false);

    const handleQuickTrack = async () => {
        if (!address.trim()) return;
        setLoading(true);

        try {
            // 1. Detect Chain
            let chain = 'ETH';
            let type: TrackedAddress['type'] = 'evm';

            const addr = address.trim();
            if (addr.startsWith('0x')) {
                if (addr.length > 60) {
                    // Logic for Move chains if needed
                }
                type = 'zerion'; // Use Zerion for full DeFi/NFT support on EVM
                chain = 'ETH';
            } else if (addr.startsWith('bc1') || addr.startsWith('1') || addr.startsWith('3')) {
                type = 'bitcoin';
                chain = 'BTC';
            } else {
                // Assume Solana for now if not 0x
                type = 'solana';
                chain = 'SOL';
            }

            // 2. Determine Group
            let targetGroupId = activeGroupId;
            if (!targetGroupId) {
                if (groups.length > 0) {
                    targetGroupId = groups[0].id;
                } else {
                    alert("Please create a group first using the Manager.");
                    setLoading(false);
                    return;
                }
            }

            // 3. Add
            if (targetGroupId) {
                onAddAddress(targetGroupId, {
                    address: addr,
                    chain,
                    type,
                    name: "Quick Track"
                });
                setAddress("");
            }

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-xl mx-auto mb-8 relative group z-20">
            {/* Glow Effect */}
            <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl group-hover:bg-indigo-500/30 transition-all opacity-0 group-hover:opacity-100 duration-500" />

            <div className="relative bg-[#141318]/80 border border-white/10 rounded-full flex items-center p-1 shadow-2xl backdrop-blur-md hover:border-indigo-500/50 transition-colors">
                <div className="pl-4 pr-2 text-zinc-500">
                    <Search className="h-5 w-5" />
                </div>
                <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleQuickTrack()}
                    placeholder="Search or paste address (EVM, SOL, BTC)..."
                    className="border-none bg-transparent h-10 text-sm focus-visible:ring-0 placeholder:text-zinc-500 w-full"
                />
                <Button
                    onClick={handleQuickTrack}
                    disabled={!address.trim() || loading}
                    className="ml-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full px-5 h-9 font-medium transition-all shadow-lg shadow-indigo-500/20"
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                        <div className="flex items-center gap-2">
                            <span>Track</span>
                            <ArrowRight className="h-3 w-3 opacity-70" />
                        </div>
                    )}
                </Button>
            </div>
            <div className="flex justify-center px-4 mt-3 gap-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> EVM
                </p>
                <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500" /> Solana
                </p>
                <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500" /> Bitcoin
                </p>
            </div>
        </div>
    );
}
