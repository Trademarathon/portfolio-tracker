"use client";

import { useRealtimeMarket } from "@/hooks/useRealtimeMarket";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Search, TrendingUp, TrendingDown, Star } from "lucide-react";
import { useState } from "react";
import Image from "next/image";

interface MarketItem {
    id: string;
    symbol: string;
    name: string;
    price: number;
    change24h: number;
    logo?: string;
}

// Mock logo mapping since we don't have a full token list with logos yet
const LOGO_MAP: Record<string, string> = {
    BTC: "https://cryptologos.cc/logos/bitcoin-btc-logo.svg?v=035",
    ETH: "https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=035",
    SOL: "https://cryptologos.cc/logos/solana-sol-logo.svg?v=035",
    BNB: "https://cryptologos.cc/logos/bnb-bnb-logo.svg?v=035",
    XRP: "https://cryptologos.cc/logos/xrp-xrp-logo.svg?v=035",
    DOGE: "https://cryptologos.cc/logos/dogecoin-doge-logo.svg?v=035",
    ADA: "https://cryptologos.cc/logos/cardano-ada-logo.svg?v=035",
    AVAX: "https://cryptologos.cc/logos/avalanche-avax-logo.svg?v=035",
    DOT: "https://cryptologos.cc/logos/polkadot-new-dot-logo.svg?v=035",
    MATIC: "https://cryptologos.cc/logos/polygon-matic-logo.svg?v=035",
};

export const MarketsList = () => {
    const { allStats } = useRealtimeMarket();
    const [search, setSearch] = useState("");
    const [activeTab, setActiveTab] = useState<"popular" | "new">("popular");

    const popularCoins = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX", "DOT", "MATIC"];

    // Transform data for display
    const markets: MarketItem[] = popularCoins.map(symbol => {
        const stats = allStats[symbol];
        return {
            id: symbol,
            symbol,
            name: symbol === "BTC" ? "Bitcoin" :
                symbol === "ETH" ? "Ethereum" :
                    symbol === "SOL" ? "Solana" :
                        symbol === "BNB" ? "Binance Coin" :
                            symbol === "XRP" ? "Ripple" :
                                symbol === "DOGE" ? "Dogecoin" :
                                    symbol === "ADA" ? "Cardano" :
                                        symbol === "AVAX" ? "Avalanche" :
                                            symbol === "DOT" ? "Polkadot" :
                                                symbol === "MATIC" ? "Polygon" : symbol,
            price: stats ? stats.price : 0,
            change24h: stats ? stats.change24h : 0,
            logo: LOGO_MAP[symbol]
        };
    }).filter(coin => coin.name.toLowerCase().includes(search.toLowerCase()) || coin.symbol.toLowerCase().includes(search.toLowerCase()));

    return (
        <Card className="bg-[#141318] border-white/5 h-full">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between mb-4">
                    <CardTitle className="text-xl font-bold font-urbanist">Markets Overview</CardTitle>
                </div>

                {/* Tabs */}
                <div className="mb-4">
                    <SegmentedControl
                        value={activeTab}
                        onChange={(val) => setActiveTab(val as "popular" | "new")}
                        options={["popular", "new"]}
                    />
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Search coins..."
                        className="w-full bg-[#0E0E11] border border-white/5 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary/50"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </CardHeader>

            <CardContent>
                <div className="space-y-1">
                    {markets.map((market) => (
                        <div
                            key={market.id}
                            className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-white/5 p-2 flex items-center justify-center">
                                    {market.logo ? (
                                        <img src={market.logo} alt={market.symbol} className="w-full h-full object-contain" />
                                    ) : (
                                        <span className="text-xs font-bold text-zinc-400">{market.symbol[0]}</span>
                                    )}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-white text-sm">{market.symbol}</p>
                                        <span className="text-xs text-zinc-500 hidden group-hover:inline-block transition-all">
                                            {market.name}
                                        </span>
                                    </div>
                                    <p className="text-sm font-mono text-zinc-400">
                                        ${market.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>

                            <div className={`flex flex-col items-end`}>
                                <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${market.change24h >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                                    }`}>
                                    {market.change24h >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                    {market.change24h > 0 ? '+' : ''}{market.change24h.toFixed(2)}%
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};
