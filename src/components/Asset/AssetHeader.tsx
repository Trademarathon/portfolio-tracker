"use client";

import { TokenIcon } from "@/components/ui/TokenIcon";
import { ArrowUpRight, ArrowDownRight, Activity, Database, DollarSign, Target } from "lucide-react";
import Link from "next/link";

interface AssetHeaderProps {
    symbol: string;
    price: number;
    change24h: number;
    volume24h?: number;
    high24h?: number;
    low24h?: number;
}

export function AssetHeader({ symbol, price, change24h, volume24h, high24h, low24h }: AssetHeaderProps) {
    const isUp = change24h >= 0;

    return (
        <div className="w-full bg-[#141318] border-b border-white/5 p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">

            {/* Left: Identity & Main Price */}
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center p-2 border border-white/5">
                    <TokenIcon symbol={symbol.replace(/USDT|PERP/g, '')} size={32} />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-black text-white tracking-tight">{symbol}</h1>
                        <span className="text-xs font-bold bg-white/5 text-zinc-400 px-1.5 py-0.5 rounded">PERP/SPOT</span>
                    </div>
                    <div className="flex items-baseline gap-3">
                        <span className="text-3xl font-mono text-white font-bold">
                            ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        </span>
                        <span className={`flex items-center text-sm font-bold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                            {Math.abs(change24h).toFixed(2)}%
                        </span>
                    </div>
                </div>
            </div>

            {/* Right: Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2">
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-zinc-500 mb-0.5 flex items-center gap-1">
                        <Activity className="w-3 h-3" /> 24h Vol
                    </span>
                    <span className="text-sm font-mono text-zinc-300">
                        ${volume24h ? volume24h.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-'}
                    </span>
                </div>

                <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-zinc-500 mb-0.5 flex items-center gap-1">
                        <ArrowUpRight className="w-3 h-3" /> 24h High
                    </span>
                    <span className="text-sm font-mono text-zinc-300">
                        ${high24h ? high24h.toLocaleString() : '-'}
                    </span>
                </div>

                <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-zinc-500 mb-0.5 flex items-center gap-1">
                        <ArrowDownRight className="w-3 h-3" /> 24h Low
                    </span>
                    <span className="text-sm font-mono text-zinc-300">
                        ${low24h ? low24h.toLocaleString() : '-'}
                    </span>
                </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center gap-3">
                <Link
                    href={`/watchlist?symbol=${symbol}`}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98]"
                >
                    <Target size={14} />
                    LAUNCH TERMINAL
                </Link>
            </div>
        </div>
    );
}
