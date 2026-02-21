"use client";

import { motion } from "framer-motion";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { ArrowUpRight, ArrowDownRight, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TokenIcon } from "@/components/ui/TokenIcon";

interface PriceTickerCardProps {
    symbol: string;
    name: string;
    price: number;
    change24h: number;
    volume?: string;
    chartData: { value: number }[];
    link?: string;
    color?: string; // e.g. "emerald", "rose", "indigo"
}

export function PriceTickerCard({ symbol, name, price, change24h, volume, chartData, link, color = "emerald" }: PriceTickerCardProps) {
    const isPositive = change24h >= 0;
    const chartColor = isPositive ? "#10b981" : "#f43f5e"; // emerald-500 : rose-500

    return (
        <motion.div
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            className="h-full"
        >
            <Card className="h-full bg-[#141318]/60 backdrop-blur-xl border-white/5 overflow-hidden relative group">
                {/* Glow Background */}
                <div className={`absolute -top-10 -right-10 w-32 h-32 bg-${color}-500/10 rounded-full blur-[60px] group-hover:bg-${color}-500/20 transition-all duration-500`} />

                <div className="p-4 flex flex-col h-full justify-between relative z-10">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                            <TokenIcon symbol={symbol} size={32} />
                            <div>
                                <h3 className="font-bold text-white text-lg">{symbol}</h3>
                                <p className="text-xs text-zinc-500">{name}</p>
                            </div>
                        </div>
                        {link && (
                            <a
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-indigo-400 flex items-center gap-1 hover:text-indigo-300 transition-colors bg-indigo-500/10 px-2 py-1 rounded-full border border-indigo-500/20"
                            >
                                Trade <ExternalLink className="w-3 h-3" />
                            </a>
                        )}
                    </div>

                    {/* Price */}
                    <div className="mb-4">
                        <div className="text-2xl font-bold text-white font-mono tracking-tight">
                            ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className={`flex items-center gap-2 text-xs font-medium ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {Math.abs(change24h).toFixed(2)}%
                            {volume && <span className="text-zinc-600 font-normal ml-2">24h Vol: {volume}</span>}
                        </div>
                    </div>

                    {/* Mini Chart */}
                    <div className="h-16 w-full mt-auto opacity-50 group-hover:opacity-100 transition-opacity">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id={`gradient-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={chartColor} stopOpacity={0.2} />
                                        <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke={chartColor}
                                    strokeWidth={2}
                                    fill={`url(#gradient-${symbol})`}
                                    isAnimationActive={false}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </Card>
        </motion.div>
    );
}
