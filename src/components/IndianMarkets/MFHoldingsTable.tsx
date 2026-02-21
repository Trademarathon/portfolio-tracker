"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, cn } from "@/lib/utils";
import React from "react";
import { Plus, Trash2, Loader2, ChevronRight, History, PlusCircle } from "lucide-react";
import { getLatestNav, getNavHistory } from "@/lib/api/indian-mf";
import { calculateIndianAssetAnalytics } from "@/lib/utils/indian-markets-analytics";
import type { IndianTransaction } from "@/lib/api/indian-markets-types";
import { AddIndianTransactionModal } from "./AddIndianTransactionModal";
import moment from "moment";

interface MFHoldingsTableProps {
    transactions: IndianTransaction[];
    onTransactionsChange: (tx: IndianTransaction[]) => void;
    onAddClick: () => void;
    onTotalChange?: (total: number) => void;
}

export function MFHoldingsTable({
    transactions,
    onTransactionsChange,
    onAddClick,
    onTotalChange,
}: MFHoldingsTableProps) {
    const [expanded, setExpanded] = useState<string | null>(null);
    const [addTxFor, setAddTxFor] = useState<{
        symbol: string;
        name: string;
        schemeCode?: number;
        nav?: number;
    } | null>(null);
    const [navCache, setNavCache] = useState<
        Record<string, { nav: number; date?: string; fundHouse?: string }>
    >({});

    const mfTx = useMemo(
        () => transactions.filter((t) => t.type === "mf"),
        [transactions]
    );

    const positions = useMemo(() => {
        const map = new Map<string, { name: string; schemeCode?: number; balance: number }>();
        mfTx.forEach((t) => {
            const cur = map.get(t.symbol) || {
                name: t.name,
                schemeCode: t.schemeCode,
                balance: 0,
            };
            cur.balance += t.side === "buy" ? t.amount : -t.amount;
            map.set(t.symbol, cur);
        });
        return Array.from(map.entries())
            .filter(([, p]) => p.balance > 0)
            .map(([symbol, p]) => ({ symbol, ...p }));
    }, [mfTx]);

    const fetchNavs = useCallback(async () => {
        if (positions.length === 0) {
            onTotalChange?.(0);
            return;
        }
        const cache: Record<string, { nav: number; date?: string; fundHouse?: string }> = {};
        await Promise.all(
            positions.map(async (p) => {
                const res = await getLatestNav(parseInt(p.symbol, 10));
                const nav = res?.data?.[0]?.nav ? parseFloat(res.data[0].nav) : 0;
                const date = res?.data?.[0]?.date;
                const fundHouse = res?.meta?.fund_house;
                if (nav > 0) cache[p.symbol] = { nav, date, fundHouse };
            })
        );
        setNavCache(cache);
        const total = positions.reduce(
            (s, p) => s + (cache[p.symbol]?.nav ?? 0) * p.balance,
            0
        );
        onTotalChange?.(total);
    }, [positions, onTotalChange]);

    useEffect(() => {
        fetchNavs();
    }, [fetchNavs]);

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
                <p className="text-zinc-500 text-sm mb-4">No mutual fund holdings yet.</p>
                <Button onClick={onAddClick} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add MF Holding
                </Button>
            </Card>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">
                    MF Holdings
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
                                <th className="text-left py-3 px-4 font-bold text-zinc-500">Scheme</th>
                                <th className="text-right py-3 px-4 font-bold text-zinc-500">Units</th>
                                <th className="text-right py-3 px-4 font-bold text-zinc-500">NAV</th>
                                <th className="text-right py-3 px-4 font-bold text-zinc-500">Avg Buy</th>
                                <th className="text-right py-3 px-4 font-bold text-zinc-500">Value (INR)</th>
                                <th className="text-right py-3 px-4 font-bold text-zinc-500">PnL</th>
                            </tr>
                        </thead>
                        <tbody>
                            {positions.map((pos) => {
                                const navData = navCache[pos.symbol];
                                const nav = navData?.nav ?? 0;
                                const navDate = navData?.date;
                                const fundHouse = navData?.fundHouse;
                                const analytics = calculateIndianAssetAnalytics(
                                    pos.symbol,
                                    pos.balance,
                                    nav,
                                    mfTx
                                );
                                const value = nav * pos.balance;
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
                                                <div className="font-medium text-white truncate max-w-[220px]">
                                                    {pos.name}
                                                </div>
                                                {(fundHouse || navDate) && (
                                                    <div className="text-[10px] text-zinc-500">
                                                        {fundHouse && <span>{fundHouse}</span>}
                                                        {fundHouse && navDate && " • "}
                                                        {navDate && `NAV as of ${navDate}`}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono text-zinc-300">
                                                {pos.balance.toLocaleString("en-IN", {
                                                    maximumFractionDigits: 2,
                                                })}
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono text-zinc-300">
                                                {nav > 0 ? formatCurrency(nav, "INR") : "-"}
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
                                        </tr>
                                        {isExp && (
                                            <tr className="bg-black/20">
                                                <td colSpan={7} className="p-4">
                                                    <MFExpandedRow
                                                        symbol={pos.symbol}
                                                        name={pos.name}
                                                        schemeCode={pos.schemeCode}
                                                        balance={pos.balance}
                                                        currentNav={nav}
                                                        transactions={mfTx}
                                                        onAddTransaction={() =>
                                                            setAddTxFor({
                                                                symbol: pos.symbol,
                                                                name: pos.name,
                                                                schemeCode: pos.schemeCode,
                                                                nav: nav > 0 ? nav : undefined,
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
                    type="mf"
                    symbol={addTxFor.symbol}
                    name={addTxFor.name}
                    schemeCode={addTxFor.schemeCode}
                    currentPrice={addTxFor.nav}
                />
            )}
        </div>
    );
}

function MFExpandedRow({
    symbol,
    name,
    schemeCode,
    balance,
    currentNav,
    transactions,
    onAddTransaction,
    onRemoveTransaction,
}: {
    symbol: string;
    name: string;
    schemeCode?: number;
    balance: number;
    currentNav: number;
    transactions: IndianTransaction[];
    onAddTransaction: () => void;
    onRemoveTransaction: (id: string) => void;
}) {
    const [navHistory, setNavHistory] = useState<Array<{ date: string; nav: number }>>([]);
    const analytics = useMemo(
        () =>
            calculateIndianAssetAnalytics(symbol, balance, currentNav, transactions),
        [symbol, balance, currentNav, transactions]
    );
    const assetTx = transactions
        .filter((t) => t.symbol === symbol)
        .sort((a, b) => b.timestamp - a.timestamp);

    useEffect(() => {
        if (!schemeCode) return;
        getNavHistory(schemeCode).then((res) => {
            if (res?.data?.length) {
                const sorted = [...res.data]
                    .reverse()
                    .slice(-90)
                    .map((d) => ({ date: d.date, nav: parseFloat(d.nav) }));
                setNavHistory(sorted);
            }
        });
    }, [schemeCode]);

    return (
        <div className="space-y-4">
            {navHistory.length > 1 && (
                <div className="rounded-lg border border-white/5 overflow-hidden bg-white/5">
                    <div className="px-4 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                        NAV History (from API)
                    </div>
                    <div className="h-[120px] px-2 pb-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={navHistory} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="navGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="date"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: "#71717a", fontSize: 9 }}
                                    tickFormatter={(v) => {
                                        const parts = String(v).split("-");
                                        return parts.length === 3 ? `${parts[0]}/${parts[1]}` : v;
                                    }}
                                />
                                <YAxis
                                    hide
                                    domain={["auto", "auto"]}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: "#18181b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                                    labelFormatter={(v) => `Date: ${v}`}
                                    formatter={(v: number | undefined) => [formatCurrency(v ?? 0, "INR"), "NAV"]}
                                />
                                <Area type="monotone" dataKey="nav" stroke="#f59e0b" strokeWidth={1.5} fill="url(#navGradient)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
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
                        {analytics.totalBought.toLocaleString()} units
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
                        {analytics.totalSold.toLocaleString()} units
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
                                <th className="px-4 py-2 text-right">NAV</th>
                                <th className="px-4 py-2 text-right">Units</th>
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
