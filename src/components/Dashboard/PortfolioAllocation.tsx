"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Layers, Globe, ShieldCheck } from "lucide-react";

interface AllocationViewProps {
    assets: any[];
}

export function PortfolioAllocation({ assets: assetsProp }: AllocationViewProps) {
    const assets = Array.isArray(assetsProp) ? assetsProp : [];
    // Group by simple categories: Stables vs Volatile
    const categoryDataMap: Record<string, number> = {
        "Stables": 0,
        "Altcoins": 0,
        "Bluechips": 0,
    };

    assets.forEach(asset => {
        const value = (asset.balance || 0) * (asset.price || 0);
        if (asset.symbol.includes("USD") || asset.symbol === "USDT" || asset.symbol === "USDC") {
            categoryDataMap["Stables"] += value;
        } else if (asset.symbol === "BTC" || asset.symbol === "ETH") {
            categoryDataMap["Bluechips"] += value;
        } else {
            categoryDataMap["Altcoins"] += value;
        }
    });

    const categoryData = Object.entries(categoryDataMap)
        .filter(([, value]) => value > 0)
        .map(([name, value]) => ({ name, value }));

    const COLORS = ["#8b5cf6", "#3b82f6", "#10b981"];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-zinc-950/40 border-white/10 overflow-hidden">
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold flex items-center gap-2 text-zinc-500 uppercase tracking-[0.2em]">
                        <Layers className="h-4 w-4 text-zinc-300" />
                        Asset Allocation
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[200px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={categoryData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {categoryData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                                    formatter={(value) => formatCurrency(value as number)}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-4">
                        {categoryData.map((item, i) => (
                            <div key={item.name} className="flex flex-col items-center">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                    <span className="text-[10px] font-bold text-zinc-500 uppercase">{item.name}</span>
                                </div>
                                <span className="text-sm font-bold text-white">{((item.value / categoryData.reduce((a, b) => a + b.value, 0)) * 100).toFixed(1)}%</span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-zinc-950/40 border-white/10 overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                    <ShieldCheck className="h-32 w-32" />
                </div>
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold flex items-center gap-2 text-zinc-500 uppercase tracking-[0.2em]">
                        <Globe className="h-4 w-4 text-zinc-300" />
                        Smart Insights
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                        <p className="text-[10px] font-black text-zinc-500 mb-1 uppercase tracking-[0.2em]">Portfolio Health</p>
                        <p className="text-sm font-medium text-white">Your portfolio is well-diversified across {categoryData.length} asset classes.</p>
                    </div>
                    <div className="space-y-3">
                        <div className="flex gap-3">
                            <div className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                            <p className="text-xs text-zinc-500 italic">Strong stablecoin buffer detected ({((categoryDataMap["Stables"] / categoryData.reduce((a, b) => a + (b.value || 0), 0)) * 100).toFixed(1)}%). Ready for market opportunities.</p>
                        </div>
                        <div className="flex gap-3">
                            <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                            <p className="text-xs text-zinc-500 italic">Exposure to Bluechips (BTC/ETH) is optimal at 45% of volatile holdings.</p>
                        </div>
                        <div className="flex gap-3">
                            <div className="h-2 w-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                            <p className="text-xs text-zinc-500 italic">Recommendation: Consider rebalancing some Altcoin gains into BTC as dominance increases.</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
