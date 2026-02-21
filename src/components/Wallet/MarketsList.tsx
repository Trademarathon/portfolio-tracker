"use client";

import { useRealtimeMarket } from "@/hooks/useRealtimeMarket";
import { fetchSpecificPrices, fetchSimplePrices } from "@/lib/api/prices";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Search, TrendingUp, TrendingDown, PieChart, Loader2 } from "lucide-react";
import { useState, useMemo, memo, useEffect } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cn } from "@/lib/utils";

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

const POPULAR_COINS = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX", "DOT", "MATIC"];
const NAME_MAP: Record<string, string> = {
    BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana", BNB: "Binance Coin", XRP: "Ripple",
    DOGE: "Dogecoin", ADA: "Cardano", AVAX: "Avalanche", DOT: "Polkadot", MATIC: "Polygon",
};

export const MarketsList = memo(({ compact = false }: { compact?: boolean } = {}) => {
    const { allStats } = useRealtimeMarket();
    const [searchInput, setSearchInput] = useState("");
    const search = useDebouncedValue(searchInput, 300);
    const [activeTab, setActiveTab] = useState<"popular" | "new">("popular");
    const [fallbackPrices, setFallbackPrices] = useState<Record<string, { price: number; change24h: number }>>({});
    const [isLoading, setIsLoading] = useState(true);

    // Fallback: fetch from CoinGecko when WebSocket data is empty or missing
    useEffect(() => {
        const hasWsData = Object.keys(allStats).length > 0 && POPULAR_COINS.some(s => (allStats[s]?.price || 0) > 0);
        if (hasWsData) {
            setIsLoading(false);
            return;
        }

        let cancelled = false;
        const loadPrices = async () => {
            setIsLoading(true);
            try {
                const prices = await fetchSpecificPrices(POPULAR_COINS);
                if (cancelled) return;
                if (prices.length > 0) {
                    const map: Record<string, { price: number; change24h: number }> = {};
                    prices.forEach((p: { symbol: string; current_price: number; price_change_percentage_24h?: number }) => {
                        const sym = (p.symbol || "").toUpperCase();
                        if (sym) map[sym] = { price: p.current_price || 0, change24h: p.price_change_percentage_24h ?? 0 };
                    });
                    setFallbackPrices(map);
                    return;
                }
                const simple = await fetchSimplePrices(POPULAR_COINS);
                if (cancelled) return;
                if (Object.keys(simple).length > 0) setFallbackPrices(simple);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        loadPrices();
        return () => { cancelled = true; };
    }, [allStats]);

    const markets = useMemo(() => {
        return POPULAR_COINS.map(symbol => {
            const stats = allStats[symbol];
            const fallback = fallbackPrices[symbol];
            const price = (stats?.price && stats.price > 0) ? stats.price : (fallback?.price || 0);
            const change24h = (stats && stats.price > 0) ? stats.change24h : (fallback?.change24h ?? 0);
            return {
                id: symbol,
                symbol,
                name: NAME_MAP[symbol] || symbol,
                price,
                change24h,
                logo: LOGO_MAP[symbol]
            };
        }).filter(coin => coin.name.toLowerCase().includes(search.toLowerCase()) || coin.symbol.toLowerCase().includes(search.toLowerCase()));
    }, [allStats, fallbackPrices, search]);
    const displayedMarkets = compact ? markets.slice(0, 8) : markets;

    return (
        <Card className={cn(
            "rounded-2xl bg-gradient-to-br from-zinc-950/90 to-zinc-900/90 border-white/10 overflow-hidden transition-all duration-300 hover:border-white/15 flex flex-col clone-wallet-card clone-noise",
            compact ? "min-h-[300px]" : "min-h-[360px]"
        )}>
            <CardHeader className={cn(compact ? "pb-2 px-3.5 pt-3" : "pb-3")}>
                <div className={cn("flex items-center gap-3", compact ? "mb-3" : "mb-4")}>
                    <div className={cn(
                        "rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-indigo-500/20 clone-wallet-card",
                        compact ? "p-1.5" : "p-2"
                    )}>
                        <PieChart className="w-4 h-4 text-indigo-400" />
                    </div>
                    <CardTitle className={cn(
                        "font-bold text-zinc-300 uppercase tracking-[0.15em]",
                        compact ? "text-xs" : "text-sm"
                    )}>
                        Markets Overview
                    </CardTitle>
                    {isLoading && (
                        <Loader2 className="w-4 h-4 text-zinc-500 animate-spin ml-auto" />
                    )}
                </div>

                {/* Tabs */}
                <div className={cn(compact ? "mb-3" : "mb-4")}>
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
                        placeholder="Search coins…"
                        className={cn(
                            "w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500/50 clone-wallet-card",
                            compact ? "py-2.5 text-xs" : "py-3 text-sm"
                        )}
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                    />
                </div>
            </CardHeader>

            <CardContent className={cn("flex-1 flex flex-col min-h-0", compact ? "px-3.5 pb-3 pt-0" : "" )}>
                <div className="space-y-1 flex-1 min-h-0 overflow-y-auto">
                    {displayedMarkets.map((market) => (
                        <div
                            key={market.id}
                            className={cn(
                                "flex items-center justify-between rounded-xl hover:bg-white/5 transition-colors cursor-pointer group clone-wallet-card clone-noise",
                                compact ? "p-2.5" : "p-3"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "rounded-full bg-white/5 p-2 flex items-center justify-center",
                                    compact ? "h-9 w-9" : "h-10 w-10"
                                )}>
                                    {market.logo ? (
                                        // External token logos come from third-party CDNs.
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={market.logo} alt={market.symbol} className="w-full h-full object-contain" />
                                    ) : (
                                        <span className="text-xs font-bold text-zinc-400">{market.symbol[0]}</span>
                                    )}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className={cn(
                                            "font-bold text-white",
                                            compact ? "text-xs" : "text-sm"
                                        )}>
                                            {market.symbol}
                                        </p>
                                        <span className="text-xs text-zinc-500 hidden group-hover:inline-block transition-all">
                                            {market.name}
                                        </span>
                                    </div>
                                    <p className={cn(
                                        "font-mono text-zinc-400",
                                        compact ? "text-xs" : "text-sm"
                                    )}>
                                        {market.price > 0
                                            ? `$${market.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                            : isLoading ? "…" : "—"}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-col items-end">
                                {market.price > 0 ? (
                                    <div className={cn(
                                        "flex items-center gap-1 font-bold rounded-lg border",
                                        compact ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1",
                                        market.change24h >= 0 ? "clone-chip-green border-emerald-500/30" : "clone-chip-red border-rose-500/30"
                                    )}>
                                        {market.change24h >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                        {market.change24h > 0 ? '+' : ''}{market.change24h.toFixed(2)}%
                                    </div>
                                ) : (
                                    <span className="text-xs text-zinc-500">{isLoading ? "…" : "—"}</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
});
