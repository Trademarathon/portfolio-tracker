"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { PageWrapper } from "@/components/Layout/PageWrapper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Landmark, PieChart, TrendingUp, BarChart2, Upload } from "lucide-react";

import { StatCard } from "@/components/ui/StatCard";
import { AddMFHoldingModal } from "@/components/IndianMarkets/AddMFHoldingModal";
import { MFHoldingsTable } from "@/components/IndianMarkets/MFHoldingsTable";
import { AddStockHoldingModal } from "@/components/IndianMarkets/AddStockHoldingModal";
import { StockHoldingsTable } from "@/components/IndianMarkets/StockHoldingsTable";
import { IndianMarketsAlphaFeed } from "@/components/IndianMarkets/IndianMarketsAlphaFeed";
import { CASImportModal } from "@/components/IndianMarkets/CASImportModal";
import {
    loadMFTransactions,
    saveMFTransactions,
    loadStockTransactions,
    saveStockTransactions,
} from "@/lib/api/indian-markets-storage";
import type { IndianTransaction } from "@/lib/api/indian-markets-types";

export default function IndianMarketsPage() {
    const [mfTransactions, setMfTransactions] = useState<IndianTransaction[]>([]);
    const [mfModalOpen, setMfModalOpen] = useState(false);
    const [stockTransactions, setStockTransactions] = useState<IndianTransaction[]>([]);
    const [stockModalOpen, setStockModalOpen] = useState(false);

    useEffect(() => {
        setMfTransactions(loadMFTransactions());
        setStockTransactions(loadStockTransactions());
    }, []);

    const handleMfAdd = useCallback((tx: IndianTransaction) => {
        const next = [...mfTransactions, tx];
        setMfTransactions(next);
        saveMFTransactions(next);
    }, [mfTransactions]);

    const handleMfChange = useCallback((next: IndianTransaction[]) => {
        setMfTransactions(next);
        saveMFTransactions(next);
    }, []);

    const handleStockAdd = useCallback((tx: IndianTransaction) => {
        const next = [...stockTransactions, tx];
        setStockTransactions(next);
        saveStockTransactions(next);
    }, [stockTransactions]);

    const handleStockChange = useCallback((next: IndianTransaction[]) => {
        setStockTransactions(next);
        saveStockTransactions(next);
    }, []);

    const mfPositionsCount = useMemo(() => {
        const map = new Map<string, number>();
        mfTransactions.forEach((t) => {
            const cur = map.get(t.symbol) || 0;
            map.set(t.symbol, cur + (t.side === "buy" ? t.amount : -t.amount));
        });
        return Array.from(map.values()).filter((b) => b > 0).length;
    }, [mfTransactions]);

    const stockPositionsCount = useMemo(() => {
        const map = new Map<string, number>();
        stockTransactions.forEach((t) => {
            const cur = map.get(t.symbol) || 0;
            map.set(t.symbol, cur + (t.side === "buy" ? t.amount : -t.amount));
        });
        return Array.from(map.values()).filter((b) => b > 0).length;
    }, [stockTransactions]);

    const [mfTotal, setMfTotal] = useState(0);
    const [stockTotal, setStockTotal] = useState(0);
    const [casImportOpen, setCasImportOpen] = useState(false);

    const handleCASImport = useCallback(
        (mf: IndianTransaction[], stocks: IndianTransaction[]) => {
            setMfTransactions(mf);
            setStockTransactions(stocks);
        },
        []
    );

    return (
        <PageWrapper className="flex flex-col gap-4 px-4 md:px-6 lg:px-8 pt-3 pb-12 max-w-none w-full">
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20">
                            <Landmark className="h-5 w-5 text-amber-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-white tracking-tight">
                                Indian Markets
                            </h1>
                            <p className="text-[10px] text-zinc-500">
                                Mutual Funds & Indian Stocks
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => setCasImportOpen(true)}
                        className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                    >
                        <Upload className="h-4 w-4" />
                        Import from CAS
                    </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
                    <div className="min-w-0">
                        <Tabs defaultValue="mf" className="w-full">
                            <TabsList className="bg-zinc-900/80 border border-white/10">
                                <TabsTrigger value="mf">Mutual Funds</TabsTrigger>
                                <TabsTrigger value="stocks">Stocks</TabsTrigger>
                            </TabsList>

                            <TabsContent value="mf" className="mt-4 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <StatCard
                                        label="MF Portfolio"
                                        value={formatCurrency(mfTotal, "INR")}
                                        icon={PieChart}
                                        color="amber"
                                    />
                                    <StatCard
                                        label="Holdings"
                                        value={String(mfPositionsCount)}
                                        icon={TrendingUp}
                                        color="emerald"
                                    />
                                </div>

                                <MFHoldingsTable
                                    transactions={mfTransactions}
                                    onTransactionsChange={handleMfChange}
                                    onAddClick={() => setMfModalOpen(true)}
                                    onTotalChange={setMfTotal}
                                />
                            </TabsContent>

                            <TabsContent value="stocks" className="mt-4 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <StatCard
                                        label="Stock Portfolio"
                                        value={formatCurrency(stockTotal, "INR")}
                                        icon={BarChart2}
                                        color="indigo"
                                    />
                                    <StatCard
                                        label="Holdings"
                                        value={String(stockPositionsCount)}
                                        icon={TrendingUp}
                                        color="emerald"
                                    />
                                </div>
                                <StockHoldingsTable
                                    transactions={stockTransactions}
                                    onTransactionsChange={handleStockChange}
                                    onAddClick={() => setStockModalOpen(true)}
                                    onTotalChange={setStockTotal}
                                />
                            </TabsContent>
                        </Tabs>
                    </div>

                    {/* Indian Markets AI Feed - same logic as NeuralAlphaFeed */}
                    <div className="lg:sticky lg:top-4 lg:self-start">
                        <IndianMarketsAlphaFeed
                            mfTransactions={mfTransactions}
                            stockTransactions={stockTransactions}
                            compact
                        />
                    </div>
                </div>
            </div>

            <AddMFHoldingModal
                open={mfModalOpen}
                onClose={() => setMfModalOpen(false)}
                onAdd={handleMfAdd}
            />
            <AddStockHoldingModal
                open={stockModalOpen}
                onClose={() => setStockModalOpen(false)}
                onAdd={handleStockAdd}
            />
            <CASImportModal
                open={casImportOpen}
                onClose={() => setCasImportOpen(false)}
                onImport={handleCASImport}
            />
        </PageWrapper>
    );
}
