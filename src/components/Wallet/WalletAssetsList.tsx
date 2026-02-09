"use client";

import { useMemo } from "react";
import { PortfolioAsset, PortfolioConnection } from "@/lib/api/types"; // Import types
import { Maximize2, Wallet, MoreHorizontal, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface WalletAssetsListProps {
    assets: PortfolioAsset[];
    connections: [string, PortfolioConnection][]; // kept for potential filtering
    selectedAssetSymbol: string | null;
    onAssetSelect: (symbol: string) => void;
    className?: string; // Allow styling from parent
}

export function WalletAssetsList({ assets, connections, selectedAssetSymbol, onAssetSelect, className }: WalletAssetsListProps) {

    // Sort assets by value desc
    const sortedAssets = useMemo(() => {
        return [...assets].sort((a, b) => b.valueUsd - a.valueUsd);
    }, [assets]);

    return (
        <div className={`space-y-4 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between px-1">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    Your Assets
                    <Badge variant="secondary" className="bg-zinc-800 text-zinc-400 hover:bg-zinc-700">
                        {assets.length} Assets
                    </Badge>
                </h3>
                {/* Filter/Sort placeholder */}
                <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-white">
                    Filters <MoreHorizontal className="ml-1 h-4 w-4" />
                </Button>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-white/5 bg-[#141318]/50 overflow-hidden shadow-lg backdrop-blur-sm">
                <Table>
                    <TableHeader className="bg-zinc-900/50">
                        <TableRow className="hover:bg-transparent border-white/5">
                            <TableHead className="text-zinc-500 font-medium">Coin</TableHead>
                            <TableHead className="text-right text-zinc-500 font-medium">Price</TableHead>
                            <TableHead className="text-right text-zinc-500 font-medium">24h%</TableHead>
                            <TableHead className="text-right text-zinc-500 font-medium">Holdings</TableHead>
                            <TableHead className="text-right text-zinc-500 font-medium">Value</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedAssets.map((asset) => {
                            const isSelected = selectedAssetSymbol === asset.symbol;
                            const priceChange = asset.priceChange24h || 0;
                            const isPositive = priceChange >= 0;

                            return (
                                <TableRow
                                    key={asset.symbol}
                                    className={`
                                        cursor-pointer transition-colors border-white/5
                                        ${isSelected ? 'bg-indigo-500/10 hover:bg-indigo-500/20' : 'hover:bg-zinc-800/30'}
                                    `}
                                    onClick={() => onAssetSelect(asset.symbol)}
                                >
                                    <TableCell className="font-medium text-white">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8 bg-zinc-800 border border-white/5">
                                                <AvatarImage src={`https://tokenize-api-cdn.mz.xyz/tokens/${asset.symbol.toLowerCase()}.png`} />
                                                <AvatarFallback className="text-[10px]">{asset.symbol.substring(0, 2)}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                                <span>{asset.name || asset.symbol}</span>
                                                <span className="text-xs text-zinc-500">{asset.symbol}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right text-zinc-300 font-mono">
                                        ${asset.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }) || '0.00'}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                        <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${isPositive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                            {isPositive ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                                            {Math.abs(priceChange).toFixed(2)}%
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right text-zinc-300 font-mono">
                                        <div className="flex flex-col items-end">
                                            <span>{(asset.balance || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                                            <span className="text-[10px] text-zinc-600">{asset.symbol}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right text-white font-bold font-mono">
                                        ${(asset.valueUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-white">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {sortedAssets.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-zinc-500">
                                    No assets found in this group.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
