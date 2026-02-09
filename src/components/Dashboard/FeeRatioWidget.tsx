"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info, Zap, LayoutGrid } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface FeeStats {
    marketFees: number;
    limitFees: number;
    ratio: number;
    count: number;
}

interface FeeRatioWidgetProps {
    stats: FeeStats | null;
    title: string;
    icon: React.ElementType;
}

export default function FeeRatioWidget({ stats, title, icon: Icon }: FeeRatioWidgetProps) {
    if (!stats || stats.count === 0) return null;

    const marketPercent = stats.ratio;
    const limitPercent = 100 - marketPercent;

    return (
        <Card className="bg-zinc-900/50 border-white/5 overflow-hidden">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                        <Icon size={16} className="text-zinc-500" />
                        {title} Fee Efficiency
                    </CardTitle>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Info size={14} className="text-zinc-600 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-zinc-900 border-white/10 text-xs max-w-[200px]">
                                Ratio of fees paid on Taker (Market) vs Maker (Limit) orders. Lower market ratio usually means better fee efficiency.
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="flex justify-between items-end">
                        <div>
                            <div className="text-2xl font-bold text-zinc-100">
                                {marketPercent.toFixed(1)}%
                            </div>
                            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Market Ratio</div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm font-medium text-zinc-300">
                                ${stats.marketFees.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Total Fees</div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="relative h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                            <div
                                className="absolute left-0 top-0 h-full bg-emerald-500 transition-all duration-1000"
                                style={{ width: `${limitPercent}%` }}
                            />
                            <div
                                className="absolute right-0 top-0 h-full bg-red-500/50 transition-all duration-1000"
                                style={{ width: `${marketPercent}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-[10px] text-zinc-500 font-medium">
                            <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                LIMIT ({limitPercent.toFixed(0)}%)
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                MARKET ({marketPercent.toFixed(0)}%)
                            </span>
                        </div>
                    </div>

                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-zinc-500">
                        <span>Based on {stats.count} trades</span>
                        <span className={marketPercent > 50 ? "text-red-400" : "text-emerald-400"}>
                            {marketPercent > 50 ? "High Taker Fees" : "Efficient Maker"}
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card >
    );
}
