"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, cn } from "@/lib/utils";
import { Plus, Trash2, Loader2, ChevronRight, History, PlusCircle } from "lucide-react";
import { getBatchPrices } from "@/lib/api/indian-stocks";
import { calculateIndianAssetAnalytics } from "@/lib/utils/indian-markets-analytics";
import type { IndianTransaction } from "@/lib/api/indian-markets-types";
import { AddIndianTransactionModal } from "./AddIndianTransactionModal";
import moment from "moment";

interface StockHoldingsTableProps {
    transactions: IndianTransaction[];
    onTransactionsChange: (tx: IndianTransaction[]) => void;
    onAddClick: () => void;
    onTotalChange?: (total: number) => void;
}

export function StockHoldingsTable({
    transactions,
    onTransactionsChange,
    onAddClick,
    onTotalChange,
}: StockHoldingsTableProps) {
    const [expanded, setExpanded] = useState<string | null>(null);
    const [addTxFor, setAddTxFor] = useState<{
        symbol: string;
        name: string;
        price?: number;
    } | null>(null);
    const [priceCache, setPriceCache] = useState<
        Record<string, { price: number; change?: number; sector?: string }>
    >({});

    const stockTx = useMemo(
        () => transactions.filter((t) => t.type === "stock"),
        [transactions]
    );

    const positions = useMemo(() => {
        const map = new Map<string, { name: string; balance: number }>();
        stockTx.forEach((t) => {
            const cur = map.get(t.symbol) || { name: t.name, balance: 0 };
            cur.balance += t.side === "buy" ? t.amount : -t.amount;
            map.set(t.symbol, cur);
        });
        return Array.from(map.entries())
            .filter(([, p]) => p.balance > 0)
            .map(([symbol, p]) => ({ symbol, ...p }));
    }, [stockTx]);

    const fetchPrices = useCallback(async () => {
        if (positions.length === 0) {
            onTotalChange?.(0);
            return;
        }
        const symbols = positions.map((p) => p.symbol);
        const res = await getBatchPrices(symbols);
        const cache: Record<string, { price: number; change?: number; sector?: string }> = {};
        (res?.stocks || []).forEach((s) => {
            cache[s.ticker] = {
                price: s.last_price,
                change: s.percent_change,
                sector: s.sector,
            };
        });
        setPriceCache(cache);
        const total = positions.reduce(
            (s, p) => s + (cache[p.symbol]?.price ?? 0) * p.balance,
            0
        );
        onTotalChange?.(total);
    }, [positions, onTotalChange]);

    useEffect(() => {
        fetchPrices();
    }, [fetchPrices]);

    const removeTransaction = (id: string) => {
        const next = transactions.filter((t) => t.id !== id);
        onTransactionsChange(next);
    };

    const handleAddTx = (tx: IndianTransaction) => {
        const next = [...transactions, tx];
        onTransactionsChange(next);
        setAddTxFor(null);
    };

    if (positions.length === 0) {
        return (
            <Card className="border-white/10 bg-zinc-950/50 backdrop-blur-md p-6 flex flex-col items-center justify-center min-h-[280px]">
                <p className="text-zinc-500 text-sm mb-4">No stock holdings yet.</p>
                <Button onClick={onAddClick} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Stock Holding
                </Button>
            </Card>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">
                    Stock Holdings
                </h3>
                <Button size="sm" onClick={onAddClick} className="gap-2">
                    <Plus className="h-3 w-3" />
                    Add
                </Button>
            </div>
            <Card className="border-white/10 bg-zinc-950/50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="w-8" />
                                <th className="text-left py-3 px-4 font-bold text-zinc-500">Company</th>
                                <th className="text-right py-3 px-4 font-bold text-zinc-500">Symbol</th>
                                <th className="text-right py-3 px-4 font-bold text-zinc-500">Qty</th>
                                <th className="text-right py-3 px-4 font-bold text-zinc-500">Price</th>
                                <th className="text-right py-3 px-4 font-bold text-zinc-500">Avg Buy</th>
                                <th className="text-right py-3 px-4 font-bold text-zinc-500">Value (INR)</th>
                                <th className="text-right py-3 px-4 font-bold text-zinc-500">PnL</th>
                                <th className="text-right py-3 px-4 font-bold text-zinc-500">Day %</th>
                            </tr>
                        </thead>
                        <tbody>
                            {positions.map((pos) => {
                                const p = priceCache[pos.symbol];
                                const price = p?.price ?? 0;
                                const dayChange = p?.change;
                                const sector = p?.sector;
                                const analytics = calculateIndianAssetAnalytics(
                                    pos.symbol,
                                    pos.balance,
                                    price,
                                    stockTx
                                );
                                const value = price * pos.balance;
                                const isExp = expanded === pos.symbol;

                                return (
                                    <React.Fragment key={pos.symbol}>
                                        <tr
                                            className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                                            onClick={() =>
                                                setExpanded((e) => (e === pos.symbol ? null : pos.symbol))
                                            }
                                        >
                                            <td className="py-3 px-2">
                                                <ChevronRight
                                                    className={cn(
                                                        "h-4 w-4 text-zinc-500 transition-transform",
                                                        isExp && "rotate-90"
                                                    )}
                                                />
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="font-medium text-white truncate max-w-[200px]">
                                                    {pos.name}
                                                </div>
                                                {sector && (
                                                    <div className="text-[10px] text-zinc-500">
                                                        {sector}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono text-zinc-400 text-xs">
                                                {pos.symbol}
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono text-zinc-300">
                                                {pos.balance.toLocaleString("en-IN", {
                                                    maximumFractionDigits: 2,
                                                })}
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono text-zinc-300">
                                                {price > 0 ? formatCurrency(price, "INR") : "-"}
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono text-zinc-300">
                                                {analytics.avgBuyPrice > 0
                                                    ? formatCurrency(analytics.avgBuyPrice, "INR")
                                                    : "-"}
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono font-bold text-white">
                                                {formatCurrency(value, "INR")}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                {analytics.costBasis > 0 ? (
                                                    <span
                                                        className={cn(
                                                            "font-mono font-bold",
                                                            analytics.unrealizedPnl >= 0
                                                                ? "text-emerald-400"
                                                                : "text-rose-400"
                                                        )}
                                                    >
                                                        {analytics.unrealizedPnl >= 0 ? "+" : ""}
                                                        {formatCurrency(analytics.unrealizedPnl, "INR")} (
                                                        {analytics.unrealizedPnlPercent >= 0 ? "+" : ""}
                                                        {analytics.unrealizedPnlPercent.toFixed(1)}%)
                                                    </span>
                                                ) : (
                                                    "-"
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                {dayChange != null ? (
                                                    <span
                                                        className={cn(
                                                            "font-mono font-bold",
                                                            dayChange >= 0 ? "text-emerald-400" : "text-rose-400"
                                                        )}
                                                    >
                                                        {dayChange >= 0 ? "+" : ""}
                                                        {dayChange.toFixed(2)}%
                                                    </span>
                                                ) : (
                                                    "-"
                                                )}
                                            </td>
                                        </tr>
                                        {isExp && (
                                            <tr className="bg-black/20">
                                                <td colSpan={9} className="p-4">
                                                    <StockExpandedRow
                                                        symbol={pos.symbol}
                                                        name={pos.name}
                                                        balance={pos.balance}
                                                        currentPrice={price}
                                                        transactions={stockTx}
                                                        onAddTransaction={() =>
                                                            setAddTxFor({
                                                                symbol: pos.symbol,
                                                                name: pos.name,
                                                                price: price > 0 ? price : undefined,
                                                            })
                                                        }
                                                        onRemoveTransaction={removeTransaction}
                                                    />
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            {addTxFor && (
                <AddIndianTransactionModal
                    open={!!addTxFor}
                    onClose={() => setAddTxFor(null)}
                    onAdd={handleAddTx}
                    type="stock"
                    symbol={addTxFor.symbol}
                    name={addTxFor.name}
                    currentPrice={addTxFor.price}
                />
            )}
        </div>
    );
}

function StockExpandedRow({
    symbol,
    name,
    balance,
    currentPrice,
    transactions,
    onAddTransaction,
    onRemoveTransaction,
}: {
    symbol: string;
    name: string;
    balance: number;
    currentPrice: number;
    transactions: IndianTransaction[];
    onAddTransaction: () => void;
    onRemoveTransaction: (id: string) => void;
}) {
    const analytics = useMemo(
        () =>
            calculateIndianAssetAnalytics(symbol, balance, currentPrice, transactions),
        [symbol, balance, currentPrice, transactions]
    );
    const assetTx = transactions
        .filter((t) => t.symbol === symbol)
        .sort((a, b) => b.timestamp - a.timestamp);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <div className="bg-white/5 rounded-lg p-3">
                    <span className="text-[10px] uppercase text-zinc-500 font-bold block mb-1">
                        Avg Buy
                    </span>
                    <span className="text-emerald-400 font-mono text-sm font-bold">
                        {analytics.avgBuyPrice > 0
                            ? formatCurrency(analytics.avgBuyPrice, "INR")
                            : "—"}
                    </span>
                    <div className="text-[10px] text-zinc-500 mt-1">
                        {analytics.buyCount} buys
                    </div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                    <span className="text-[10px] uppercase text-zinc-500 font-bold block mb-1">
                        Avg Sell
                    </span>
                    <span className="text-rose-400 font-mono text-sm font-bold">
                        {analytics.avgSellPrice > 0
                            ? formatCurrency(analytics.avgSellPrice, "INR")
                            : "—"}
                    </span>
                    <div className="text-[10px] text-zinc-500 mt-1">
                        {analytics.sellCount} sells
                    </div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                    <span className="text-[10px] uppercase text-zinc-500 font-bold block mb-1">
                        Total Bought
                    </span>
                    <span className="text-white font-mono text-sm">
                        {analytics.totalBought.toLocaleString()} qty
                    </span>
                    <div className="text-[10px] text-zinc-500 mt-1">
                        Cost: {formatCurrency(analytics.totalCost, "INR")}
                    </div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                    <span className="text-[10px] uppercase text-zinc-500 font-bold block mb-1">
                        Total Sold
                    </span>
                    <span className="text-white font-mono text-sm">
                        {analytics.totalSold.toLocaleString()} qty
                    </span>
                    <div className="text-[10px] text-zinc-500 mt-1">
                        Proceeds: {formatCurrency(analytics.totalProceeds, "INR")}
                    </div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                    <span className="text-[10px] uppercase text-zinc-500 font-bold block mb-1">
                        Cost Basis
                    </span>
                    <span className="text-cyan-400 font-mono text-sm font-bold">
                        {formatCurrency(analytics.costBasis, "INR")}
                    </span>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                    <span className="text-[10px] uppercase text-zinc-500 font-bold block mb-1">
                        PnL
                    </span>
                    <div className="text-sm">
                        <div
                            className={cn(
                                "font-mono",
                                analytics.unrealizedPnl >= 0 ? "text-emerald-400" : "text-rose-400"
                            )}
                        >
                            Unreal: {analytics.unrealizedPnl >= 0 ? "+" : ""}
                            {formatCurrency(analytics.unrealizedPnl, "INR")}
                        </div>
                        <div
                            className={cn(
                                "font-mono text-[10px]",
                                analytics.realizedPnl >= 0 ? "text-emerald-500/70" : "text-rose-500/70"
                            )}
                        >
                            Real: {analytics.realizedPnl >= 0 ? "+" : ""}
                            {formatCurrency(analytics.realizedPnl, "INR")}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500">
                    Held {analytics.daysHeld} days
                    {analytics.lastBuyDate > 0 && ` • Last buy: ${moment(analytics.lastBuyDate).fromNow()}`}
                    {analytics.lastSellDate > 0 && ` • Last sell: ${moment(analytics.lastSellDate).fromNow()}`}
                </span>
                <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-white/10 hover:bg-white/5"
                    onClick={(e) => {
                        e.stopPropagation();
                        onAddTransaction();
                    }}
                >
                    <PlusCircle className="h-3 w-3 mr-1" /> Add Transaction
                </Button>
            </div>

            <div className="rounded-lg border border-white/5 overflow-hidden">
                <div className="bg-white/5 px-4 py-2 flex items-center gap-2">
                    <History className="h-3 w-3 text-zinc-400" />
                    <span className="text-xs font-bold text-zinc-300 uppercase">
                        Transactions
                    </span>
                </div>
                {assetTx.length > 0 ? (
                    <table className="w-full text-xs">
                        <thead className="bg-black/20 text-zinc-500 font-medium">
                            <tr>
                                <th className="px-4 py-2 text-left">Date</th>
                                <th className="px-4 py-2 text-left">Type</th>
                                <th className="px-4 py-2 text-right">Price</th>
                                <th className="px-4 py-2 text-right">Qty</th>
                                <th className="px-4 py-2 text-right">Value</th>
                                <th className="w-10" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {assetTx.map((tx) => (
                                <tr key={tx.id} className="hover:bg-white/5">
                                    <td className="px-4 py-2 text-zinc-400 font-mono">
                                        {moment(tx.timestamp).format("MMM D, YYYY HH:mm")}
                                    </td>
                                    <td
                                        className={cn(
                                            "px-4 py-2 font-bold uppercase",
                                            tx.side === "buy" ? "text-emerald-500" : "text-rose-500"
                                        )}
                                    >
                                        {tx.side}
                                    </td>
                                    <td className="px-4 py-2 text-right font-mono text-zinc-300">
                                        {formatCurrency(tx.price, "INR")}
                                    </td>
                                    <td className="px-4 py-2 text-right font-mono text-zinc-300">
                                        {tx.amount}
                                    </td>
                                    <td className="px-4 py-2 text-right font-mono text-zinc-300">
                                        {formatCurrency(tx.amount * tx.price, "INR")}
                                    </td>
                                    <td className="px-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-zinc-500 hover:text-rose-400"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onRemoveTransaction(tx.id);
                                            }}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="p-6 text-center text-zinc-500 text-xs italic">
                        No transactions
                    </div>
                )}
            </div>
        </div>
    );
}
