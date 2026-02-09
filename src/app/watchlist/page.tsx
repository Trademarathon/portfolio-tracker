"use client";

import { MarketTable } from "@/components/Screener/MarketTable";
import { TradingViewChart } from "@/components/Screener/TradingViewChart";
import { useAlerts } from "@/hooks/useAlerts";
import { usePortfolioData } from "@/hooks/usePortfolioData";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
    Bell,
    TrendingUp,
    Filter,
    Search,
    ChevronRight,
    LayoutDashboard,
    Maximize2,
    Settings2,
    Activity,
    X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertsSidebar } from "@/components/Screener/AlertsSidebar";

function ScreenerContent() {
    const searchParams = useSearchParams();
    const { alerts, checkAlerts } = useAlerts();
    const { watchlist } = usePortfolioData(); // Fetch watchlist here
    const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isChartVisible, setIsChartVisible] = useState(false);

    useEffect(() => {
        const symbol = searchParams.get("symbol");
        if (symbol && symbol !== selectedSymbol) {
            setSelectedSymbol(symbol);
            setIsChartVisible(true);
        }
    }, [searchParams]);

    // Placeholder prices for alert checking
    useEffect(() => {
        const timer = setInterval(() => {
            // checkAlerts({ BTC: 65000, ETH: 3500 });
        }, 5000);
        return () => clearInterval(timer);
    }, [checkAlerts]);

    const handleSelectSymbol = (symbol: string) => {
        if (selectedSymbol === symbol) {
            setIsChartVisible(!isChartVisible);
        } else {
            setSelectedSymbol(symbol);
            setIsChartVisible(true);
        }
    };

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-black text-white ml-[-20px] mr-[-20px] mt-[-20px] border-t border-white/5">
            {/* Left Main Content */}
            <div className="flex-1 flex flex-col min-w-0 border-r border-white/10">
                {/* Header Strip */}
                <div className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-zinc-950/50 backdrop-blur-md">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <Activity className="h-5 w-5 text-primary" />
                            <h1 className="text-sm font-serif font-black uppercase tracking-[0.2em] text-white">TM Screener</h1>
                        </div>
                        <div className="h-4 w-[1px] bg-white/10" />
                        <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                            <span className="flex items-center gap-1.5"><div className="h-1 w-1 rounded-full bg-emerald-500" /> Markets: 420+</span>
                            <span className="flex items-center gap-1.5"><div className="h-1 w-1 rounded-full bg-emerald-500" /> API: Live</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className={cn(
                                "text-[10px] font-bold uppercase tracking-widest h-8 px-3 transition-all",
                                isSidebarOpen ? "bg-primary text-white" : "text-zinc-400 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <Bell className="h-3.5 w-3.5 mr-2" />
                            Alerts
                            {alerts.filter(a => a.active).length > 0 && (
                                <span className="ml-2 px-1.5 py-0.5 bg-white text-black rounded-full text-[8px]">
                                    {alerts.filter(a => a.active).length}
                                </span>
                            )}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400">
                            <Settings2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 flex flex-col overflow-hidden relative">
                    {/* Market List */}
                    <div className={cn(
                        "flex flex-col bg-zinc-950/20 transition-all duration-300 ease-in-out",
                        isChartVisible ? "h-[45%]" : "h-full"
                    )}>
                        <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                            <MarketTable
                                symbols={watchlist}
                                onSelect={handleSelectSymbol}
                                selectedSymbol={selectedSymbol || ""}
                            />
                        </div>
                    </div>

                    {/* Chart Area */}
                    {isChartVisible && selectedSymbol && (
                        <div className="h-[55%] border-t border-white/10 bg-zinc-950/40 flex flex-col transition-all duration-300 ease-in-out">
                            <div className="p-3 border-b border-white/5 flex items-center justify-between bg-black/40">
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold font-mono tracking-tighter text-white bg-primary/20 px-2 py-0.5 rounded">
                                        {selectedSymbol}/USD
                                    </span>
                                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-bold uppercase">
                                        <span>Interval: 1H</span>
                                        <span>Exchanges: Binance/HL/Bybit</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-600 hover:text-white">
                                        <Maximize2 className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-zinc-600 hover:text-red-500"
                                        onClick={() => setIsChartVisible(false)}
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                            <div className="flex-1 relative">
                                <TradingViewChart symbol={selectedSymbol} />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Sidebar */}
            <AlertsSidebar
                open={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />
        </div>
    );
}

export default function ScreenerPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center p-10 text-zinc-500">Loading Screener...</div>}>
            <ScreenerContent />
        </Suspense>
    );
}
