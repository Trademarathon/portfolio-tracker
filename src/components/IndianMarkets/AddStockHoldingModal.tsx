"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { searchStocks, getStockPrice, type StockSearchResult } from "@/lib/api/indian-stocks";
import { cn } from "@/lib/utils";
import { Loader2, Search } from "lucide-react";
import type { IndianTransaction } from "@/lib/api/indian-markets-types";

interface AddStockHoldingModalProps {
    open: boolean;
    onClose: () => void;
    onAdd: (tx: IndianTransaction) => void;
}

function getTicker(symbol: string, exchange: "NSE" | "BSE"): string {
    return exchange === "NSE" ? `${symbol}.NS` : `${symbol}.BO`;
}

export function AddStockHoldingModal(props: AddStockHoldingModalProps) {
    const { open, onClose, onAdd } = props;
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<StockSearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [selected, setSelected] = useState<StockSearchResult | null>(null);
    const [exchange, setExchange] = useState<"NSE" | "BSE">("NSE");
    const [quantity, setQuantity] = useState("");
    const [avgBuyPrice, setAvgBuyPrice] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [currentPriceInfo, setCurrentPriceInfo] = useState<{ price: number; change?: number } | null>(null);

    const doSearch = useCallback(async () => {
        if (!query.trim()) return;
        setSearching(true);
        try {
            const data = await searchStocks(query.trim());
            const list = data.results || [];
            setResults(list);
            setSelected(null);
        } catch {
            setResults([]);
        } finally {
            setSearching(false);
        }
    }, [query]);

    useEffect(() => {
        if (!open) return;
        const t = setTimeout(doSearch, 300);
        return () => clearTimeout(t);
    }, [query, open, doSearch]);

    // Fetch current price when user selects stock + exchange
    useEffect(() => {
        if (!selected) {
            setCurrentPriceInfo(null);
            return;
        }
        let cancelled = false;
        setCurrentPriceInfo(null);
        const ticker = getTicker(selected.symbol, exchange);
        getStockPrice(ticker).then((res) => {
            if (cancelled) return;
            const price = res?.data?.last_price ?? 0;
            const change = res?.data?.percent_change;
            if (price > 0) {
                setCurrentPriceInfo({ price, change });
                setAvgBuyPrice((prev) => (prev ? prev : String(price)));
            }
        });
        return () => {
            cancelled = true;
        };
    }, [selected, exchange]);

    const handleSubmit = async () => {
        if (!selected || !quantity || parseFloat(quantity) <= 0) return;
        setSubmitting(true);
        const ticker = getTicker(selected.symbol, exchange);
        let price = avgBuyPrice ? parseFloat(avgBuyPrice) : 0;
        if (price <= 0) {
            const res = await getStockPrice(ticker);
            price = res?.data?.last_price ?? 0;
        }
        const tx: IndianTransaction = {
            id: `stock-${ticker}-${Date.now()}`,
            type: "stock",
            side: "buy",
            symbol: ticker,
            name: selected.company_name,
            amount: parseFloat(quantity),
            price,
            timestamp: Date.now(),
        };
        onAdd(tx);
        setSubmitting(false);
        onClose();
        setQuery("");
        setSelected(null);
        setQuantity("");
        setAvgBuyPrice("");
    };

    const handleClose = () => {
        setQuery("");
        setResults([]);
        setSelected(null);
        setQuantity("");
        setAvgBuyPrice("");
        setCurrentPriceInfo(null);
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
            <DialogContent className="sm:max-w-md dark:bg-zinc-950 dark:border-zinc-800">
                <DialogHeader>
                    <DialogTitle>Add Stock Holding</DialogTitle>
                    <DialogDescription>
                        Search for a company, select symbol, choose NSE/BSE, and enter quantity.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div>
                        <Label>Search company</Label>
                        <div className="flex gap-2 mt-1">
                            <Input
                                placeholder="e.g. Reliance, TCS"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && doSearch()}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={doSearch}
                                disabled={searching}
                            >
                                {searching ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Search className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                    </div>

                    {results.length > 0 && (
                        <div className="max-h-40 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-900/50 p-2 space-y-1">
                            {results.slice(0, 10).map((r) => (
                                <button
                                    key={r.symbol + r.company_name}
                                    type="button"
                                    onClick={() => setSelected(r)}
                                    className={cn(
                                        "w-full text-left px-3 py-2 rounded text-sm transition-colors",
                                        selected?.symbol === r.symbol
                                            ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                                            : "hover:bg-zinc-800 text-zinc-300"
                                    )}
                                >
                                    <div className="font-medium truncate">{r.company_name}</div>
                                    <div className="text-xs text-zinc-500">
                                        {r.symbol} • NSE: {r.symbol}.NS • BSE: {r.symbol}.BO
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {selected && (
                        <>
                            <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-300">
                                Selected: {selected.company_name} ({selected.symbol})
                            </div>
                            <div className="flex gap-4">
                                <div className="flex items-center gap-2">
                                    <Label>Exchange</Label>
                                    <select
                                        value={exchange}
                                        onChange={(e) => setExchange(e.target.value as "NSE" | "BSE")}
                                        className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
                                    >
                                        <option value="NSE">NSE (.NS)</option>
                                        <option value="BSE">BSE (.BO)</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Quantity</Label>
                                    <Input
                                        type="number"
                                        step="any"
                                        min="0"
                                        placeholder="e.g. 10"
                                        value={quantity}
                                        onChange={(e) => setQuantity(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label>Avg Buy Price (optional)</Label>
                                    <Input
                                        type="number"
                                        step="any"
                                        min="0"
                                        placeholder="Leave blank for current"
                                        value={avgBuyPrice}
                                        onChange={(e) => setAvgBuyPrice(e.target.value)}
                                    />
                                    {currentPriceInfo && (
                                        <p className="text-[10px] text-zinc-500 mt-1">
                                            Current: ₹{currentPriceInfo.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                                            {currentPriceInfo.change != null && (
                                                <span className={currentPriceInfo.change >= 0 ? "text-emerald-500" : "text-rose-500"}>
                                                    {" "}({currentPriceInfo.change >= 0 ? "+" : ""}{currentPriceInfo.change.toFixed(2)}% today)
                                                </span>
                                            )}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!selected || !quantity || parseFloat(quantity) <= 0 || submitting}
                    >
                        Add Holding
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
