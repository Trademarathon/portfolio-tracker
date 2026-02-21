"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Position } from '@/lib/api/types';
import { cn } from "@/lib/utils";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { BarChart3 } from "lucide-react";

interface PositionWithName extends Position {
    assetName?: string;
}

interface OpenPositionsTableProps {
    positions: PositionWithName[];
}

export default function OpenPositionsTable({ positions }: OpenPositionsTableProps) {
    const { setSelectedChart } = usePortfolio();

    if (!positions || positions.length === 0) {
        return (
            <Card className="border-white/10 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle>Open Positions</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-sm">No open positions found.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-white/10 bg-card/50 backdrop-blur-sm">
            <CardHeader>
                <CardTitle>Open Positions</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase bg-white/5 border-b border-white/10">
                            <tr>
                                <th className="px-4 py-3">Symbol</th>
                                <th className="px-4 py-3">Side</th>
                                <th className="px-4 py-3 text-right">Size</th>
                                <th className="px-4 py-3 text-right">Entry Price</th>
                                <th className="px-4 py-3 text-right">Mark Price</th>
                                <th className="px-4 py-3 text-right">PnL</th>
                            </tr>
                        </thead>
                        <tbody>
                            {positions.map((pos, idx) => (
                                <tr
                                    key={`${pos.symbol}-${idx}`}
                                    className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer group"
                                    onClick={() => setSelectedChart({
                                        symbol: pos.symbol,
                                        entryPrice: pos.entryPrice,
                                        side: pos.side
                                    })}
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-zinc-100">{pos.assetName || pos.symbol}</span>
                                                <BarChart3 className="h-3 w-3 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{pos.symbol}</span>
                                        </div>
                                    </td>
                                    <td className={cn(
                                        "px-4 py-3 font-bold uppercase text-xs",
                                        pos.side === 'long' ? "text-emerald-500" : "text-red-500"
                                    )}>
                                        {pos.side}
                                    </td>
                                    <td className="px-4 py-3 text-right">{pos.size}</td>
                                    <td className="px-4 py-3 text-right">${(pos.entryPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    <td className="px-4 py-3 text-right">${(pos.markPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    <td className={cn(
                                        "px-4 py-3 text-right font-medium",
                                        (pos.pnl || 0) >= 0 ? "text-emerald-500" : "text-red-500"
                                    )}>
                                        ${(pos.pnl || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
