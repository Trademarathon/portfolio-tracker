"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, AreaChart, Area } from "recharts";
import { useState } from "react";
import { ChevronDown, Wallet, TrendingUp } from "lucide-react";
import { usePortfolioData } from "@/hooks/usePortfolioData";

export const SalesChart = () => {
    const [selectedMetric, setSelectedMetric] = useState<"value" | "balance">("value");
    const { assets, wsConnectionStatus } = usePortfolioData();

    // Get wallet connections
    const walletConnections = Array.from(wsConnectionStatus?.entries() || [])
        .filter(([_, info]) => ['zerion', 'wallet', 'evm', 'solana'].includes(info.type));

    // Get wallet assets with values
    const walletAssets = assets.filter(asset => {
        if (!asset.breakdown) return false;
        return Object.keys(asset.breakdown).some(sourceId => {
            const connection = wsConnectionStatus?.get(sourceId);
            return connection && ['zerion', 'wallet', 'evm', 'solana'].includes(connection.type);
        });
    }).map(asset => {
        const walletBalance = Object.entries(asset.breakdown || {}).reduce((balSum, [sourceId, amount]) => {
            const connection = wsConnectionStatus?.get(sourceId);
            return connection && ['zerion', 'wallet', 'evm', 'solana'].includes(connection.type)
                ? balSum + amount
                : balSum;
        }, 0);
        return {
            symbol: asset.symbol,
            name: asset.symbol,
            balance: walletBalance,
            value: walletBalance * asset.price,
            price: asset.price
        };
    }).sort((a, b) => b.value - a.value).slice(0, 12); // Top 12 assets

    // No wallets connected - show empty state
    if (walletConnections.length === 0 || walletAssets.length === 0) {
        return (
            <Card className="bg-[#141318] border-white/5 h-full min-h-[400px]">
                <CardHeader>
                    <CardTitle className="text-xl font-bold font-urbanist">Asset Distribution</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="h-16 w-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
                        <Wallet className="h-8 w-8 text-zinc-500" />
                    </div>
                    <p className="text-zinc-500 text-sm mb-2">No wallet assets to display</p>
                    <p className="text-zinc-600 text-xs">Add wallets in Settings → Connections</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-[#141318] border-white/5 h-full min-h-[400px]">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold font-urbanist">Asset Distribution</CardTitle>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">{walletAssets.length} assets</span>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={walletAssets} layout="vertical" margin={{ left: 50, right: 20 }}>
                            <XAxis type="number" hide />
                            <YAxis
                                type="category"
                                dataKey="symbol"
                                tick={{ fill: '#a1a1aa', fontSize: 11 }}
                                width={45}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1E1E24', borderColor: '#333', borderRadius: '8px' }}
                                itemStyle={{ color: '#fff' }}
                                cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                                formatter={(value: number | undefined) => [
                                    value !== undefined ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-',
                                    'Value'
                                ]}
                            />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                {walletAssets.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={index === 0 ? '#7F6AFF' : index === 1 ? '#5648B2' : '#3D3375'}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Asset Legend */}
                <div className="flex flex-wrap gap-4 mt-4">
                    {walletAssets.slice(0, 5).map((asset, idx) => (
                        <div key={asset.symbol} className="flex items-center gap-2">
                            <div
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: idx === 0 ? '#7F6AFF' : idx === 1 ? '#5648B2' : '#3D3375' }}
                            />
                            <span className="text-xs text-zinc-400">{asset.symbol}</span>
                            <span className="text-xs text-zinc-600">
                                ${asset.value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};
