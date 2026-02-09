"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Wallet, X } from "lucide-react";

import { TrackedGroup, TrackedAddress } from "@/hooks/useTrackedWallets";

interface TrackerGroupManagerProps {
    groups: TrackedGroup[];
    addGroup: (name: string) => void;
    removeGroup: (id: string) => void;
    addAddressToGroup: (groupId: string, address: TrackedAddress) => void;
    removeAddressFromGroup: (groupId: string, addressStr: string) => void;
}

export function TrackerGroupManager({ groups, addGroup, removeGroup, addAddressToGroup, removeAddressFromGroup }: TrackerGroupManagerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

    // Address Form State
    const [newAddress, setNewAddress] = useState("");
    const [newChain, setNewChain] = useState("ETH");
    const [newType, setNewType] = useState<TrackedAddress['type']>("evm");
    const [newName, setNewName] = useState("");

    const handleCreateGroup = () => {
        if (!newGroupName.trim()) return;
        addGroup(newGroupName);
        setNewGroupName("");
    };

    const handleAddAddress = () => {
        if (!selectedGroupId || !newAddress.trim()) return;

        // Auto-detect type if simple logic applies?
        let type = newType;
        if (newChain === 'SOL') type = 'solana';
        else if (newChain === 'BTC') type = 'bitcoin';
        else if (newChain === 'SUI') type = 'sui';
        else if (newChain === 'APT') type = 'aptos';
        else type = 'evm';

        addAddressToGroup(selectedGroupId, {
            address: newAddress,
            chain: newChain,
            type: type,
            name: newName || undefined
        });

        setNewAddress("");
        setNewName("");
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 border-white/10 bg-white/5 hover:bg-white/10">
                    <Wallet className="h-4 w-4" />
                    Manage Groups
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl bg-[#141318] border-white/10 text-white">
                <DialogHeader>
                    <DialogTitle>Manage Wallet Groups</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    {/* Left: Groups List */}
                    <div className="space-y-4 border-r border-white/5 pr-4">
                        <div className="flex items-center gap-2">
                            <Input
                                placeholder="Group Name (e.g. Whale Watch)"
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                className="bg-zinc-900/50 border-white/5 h-8"
                            />
                            <Button size="sm" onClick={handleCreateGroup} disabled={!newGroupName.trim()}>
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                            {groups.map(group => (
                                <div
                                    key={group.id}
                                    className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${selectedGroupId === group.id
                                        ? "bg-indigo-500/10 border-indigo-500/30"
                                        : "bg-zinc-900/30 border-white/5 hover:bg-white/5"
                                        }`}
                                    onClick={() => setSelectedGroupId(group.id)}
                                >
                                    <div>
                                        <p className="font-bold text-sm">{group.name}</p>
                                        <p className="text-xs text-zinc-500">{group.addresses.length} addresses</p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-zinc-500 hover:text-red-500"
                                        onClick={(e) => { e.stopPropagation(); removeGroup(group.id); if (selectedGroupId === group.id) setSelectedGroupId(null); }}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            ))}
                            {groups.length === 0 && (
                                <p className="text-xs text-zinc-500 text-center py-4">No groups yet.</p>
                            )}
                        </div>
                    </div>

                    {/* Right: Address Management for Selected Group */}
                    <div className="space-y-4">
                        {selectedGroupId ? (
                            <>
                                <h3 className="text-sm font-bold text-zinc-400 uppercase">
                                    Addresses in {groups.find(g => g.id === selectedGroupId)?.name}
                                </h3>

                                <div className="space-y-3 p-3 bg-zinc-900/30 rounded-lg border border-white/5">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="col-span-2">
                                            <Label className="text-xs text-zinc-500">Chain</Label>
                                            <select
                                                value={newChain}
                                                onChange={(e) => setNewChain(e.target.value)}
                                                className="h-8 w-full bg-zinc-900 border border-white/5 rounded-md text-xs px-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none"
                                            >
                                                <option value="ETH">Ethereum (EVM)</option>
                                                <option value="SOL">Solana</option>
                                                <option value="BTC">Bitcoin</option>
                                                <option value="SUI">Sui</option>
                                                <option value="APT">Aptos</option>
                                            </select>
                                        </div>
                                        <div className="col-span-2">
                                            <Label className="text-xs text-zinc-500">Address</Label>
                                            <Input
                                                value={newAddress}
                                                onChange={(e) => setNewAddress(e.target.value)}
                                                placeholder="0x... or solana address"
                                                className="h-8 bg-zinc-900 border-white/5 text-xs font-mono"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <Label className="text-xs text-zinc-500">Label (Optional)</Label>
                                            <Input
                                                value={newName}
                                                onChange={(e) => setNewName(e.target.value)}
                                                placeholder="e.g. Main Wallet"
                                                className="h-8 bg-zinc-900 border-white/5 text-xs"
                                            />
                                        </div>
                                        <div className="col-span-2 pt-2">
                                            <Button size="sm" className="w-full h-8" onClick={handleAddAddress} disabled={!newAddress.trim()}>
                                                <Plus className="h-3 w-3 mr-2" /> Add Address
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                                    {groups.find(g => g.id === selectedGroupId)?.addresses.map((addr, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2 bg-zinc-900/50 rounded border border-white/5">
                                            <div className="overflow-hidden">
                                                <p className="text-xs font-bold text-white truncate">{addr.name || 'Unnamed'}</p>
                                                <p className="text-[10px] font-mono text-zinc-500 truncate w-[180px]">{addr.address}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] bg-white/10 px-1 rounded text-zinc-300">{addr.chain}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-5 w-5 text-zinc-500 hover:text-red-500"
                                                    onClick={() => removeAddressFromGroup(selectedGroupId, addr.address)}
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                    {groups.find(g => g.id === selectedGroupId)?.addresses.length === 0 && (
                                        <p className="text-xs text-zinc-500 text-center">No addresses yet.</p>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-2">
                                <Wallet className="h-8 w-8 opacity-20" />
                                <p className="text-sm">Select a group to manage addresses</p>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
