"use client";

import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { JournalTrade, useJournal, JournalPreferences } from "@/contexts/JournalContext";
import { TradeRow } from "./TradeRow";
import { ChevronUp, ChevronDown, Search } from "lucide-react";

type SortField = 'symbol' | 'side' | 'openTime' | 'closeTime' | 'holdTime' | 'entryPrice' | 'exitPrice' | 'mae' | 'mfe' | 'pnl';
type SortDirection = 'asc' | 'desc';

interface TradeTableProps {
    trades: JournalTrade[];
    preferences: JournalPreferences;
    showOpenOnly?: boolean;
}

const columns: { id: SortField; label: string; width: string }[] = [
    { id: 'symbol', label: 'Symbol', width: 'col-span-2' },
    { id: 'side', label: 'Side & Size', width: 'col-span-1' },
    { id: 'openTime', label: 'Open & Close Times', width: 'col-span-2' },
    { id: 'holdTime', label: 'Hold Time', width: 'col-span-1' },
    { id: 'entryPrice', label: 'Entry & Exit', width: 'col-span-2' },
    { id: 'mae', label: 'MAE', width: 'col-span-1' },
    { id: 'mfe', label: 'MFE', width: 'col-span-1' },
    { id: 'pnl', label: 'PnL', width: 'col-span-1' },
];

export function TradeTable({ trades, preferences, showOpenOnly = false }: TradeTableProps) {
    const { connectedExchanges, syncDiagnostics, trades: allJournalTrades } = useJournal();
    const [sortField, setSortField] = useState<SortField>('openTime');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Filter trades
    const filteredTrades = useMemo(() => {
        let result = trades;

        // Filter by open status
        if (showOpenOnly) {
            result = result.filter(t => t.isOpen);
        } else {
            result = result.filter(t => !t.isOpen);
        }

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(t =>
                t.symbol.toLowerCase().includes(query) ||
                t.exchange?.toLowerCase().includes(query)
            );
        }

        return result;
    }, [trades, showOpenOnly, searchQuery]);

    // Sort trades
    const sortedTrades = useMemo(() => {
        return [...filteredTrades].sort((a, b) => {
            let aVal: number | string = 0;
            let bVal: number | string = 0;

            switch (sortField) {
                case 'symbol':
                    aVal = a.symbol;
                    bVal = b.symbol;
                    break;
                case 'side':
                    aVal = a.side;
                    bVal = b.side;
                    break;
                case 'openTime':
                    aVal = a.timestamp;
                    bVal = b.timestamp;
                    break;
                case 'closeTime':
                    aVal = a.exitTime || 0;
                    bVal = b.exitTime || 0;
                    break;
                case 'holdTime':
                    aVal = a.holdTime || 0;
                    bVal = b.holdTime || 0;
                    break;
                case 'entryPrice':
                    aVal = a.entryPrice || a.price;
                    bVal = b.entryPrice || b.price;
                    break;
                case 'exitPrice':
                    aVal = a.exitPrice || 0;
                    bVal = b.exitPrice || 0;
                    break;
                case 'mae':
                    aVal = a.mae || 0;
                    bVal = b.mae || 0;
                    break;
                case 'mfe':
                    aVal = a.mfe || 0;
                    bVal = b.mfe || 0;
                    break;
                case 'pnl':
                    aVal = a.realizedPnl || 0;
                    bVal = b.realizedPnl || 0;
                    break;
            }

            if (typeof aVal === 'string' && typeof bVal === 'string') {
                return sortDirection === 'asc'
                    ? aVal.localeCompare(bVal)
                    : bVal.localeCompare(aVal);
            }

            return sortDirection === 'asc'
                ? (aVal as number) - (bVal as number)
                : (bVal as number) - (aVal as number);
        });
    }, [filteredTrades, sortField, sortDirection]);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    const totalPages = Math.ceil(sortedTrades.length / itemsPerPage);

    // Reset pagination when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    // Ensure valid page if filtered trades shrink
    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(1);
        }
    }, [currentPage, totalPages]);

    const currentTrades = sortedTrades.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const handleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const hasSyncFailure = Object.values(syncDiagnostics).some((diag) => diag.status === 'error');
    const firstSyncError = Object.entries(syncDiagnostics).find(([, diag]) => diag.status === 'error');
    const hasAnyStoredTrades = Array.isArray(allJournalTrades) && allJournalTrades.length > 0;
    const emptyStateMessage = (() => {
        if (connectedExchanges.length === 0) return 'No exchanges connected';
        if (searchQuery) return 'No trades match your search';
        if (!hasAnyStoredTrades && hasSyncFailure) return 'Trade sync failed. Check connection diagnostics and retry.';
        if (!hasAnyStoredTrades) return 'No trades returned from connected exchanges yet';
        return 'Trades are currently filtered out';
    })();

    return (
        <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800/50 overflow-hidden">
            {/* Search Bar */}
            <div className="p-4 border-b border-zinc-800/50">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Search by symbol or exchange..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
                    />
                </div>
            </div>

            {/* Column Headers */}
            <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-zinc-800/30 bg-zinc-800/20">
                {columns.map(col => (
                    <button
                        key={col.id}
                        onClick={() => handleSort(col.id)}
                        className={cn(
                            col.width,
                            "flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium transition-colors text-left",
                            sortField === col.id ? "text-emerald-400" : "text-zinc-500 hover:text-zinc-300"
                        )}
                    >
                        {col.label}
                        {sortField === col.id && (
                            sortDirection === 'asc'
                                ? <ChevronUp className="w-3 h-3" />
                                : <ChevronDown className="w-3 h-3" />
                        )}
                    </button>
                ))}
                <div className="col-span-1" />
            </div>

            {/* Trade Rows */}
            <div className="divide-y divide-zinc-800/30">
                {currentTrades.length > 0 ? (
                    currentTrades.map((trade, index) => (
                        <TradeRow
                            key={trade.id}
                            trade={trade}
                            preferences={preferences}
                            isExpanded={expandedId === trade.id}
                            onExpand={() => handleExpand(trade.id)}
                            index={index}
                        />
                    ))
                ) : (
                    <div className="py-16 text-center">
                        <p className="text-zinc-500 text-sm">{emptyStateMessage}</p>
                        {firstSyncError && !hasAnyStoredTrades && (
                            <p className="text-[11px] text-amber-500 mt-2">
                                {firstSyncError[0]}: {firstSyncError[1].message || 'Connection/auth error'}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Footer & Pagination */}
            <div className="p-4 border-t border-zinc-800/50 flex items-center justify-between">
                <span className="text-xs text-zinc-500">
                    Showing {Math.min((currentPage - 1) * itemsPerPage + 1, sortedTrades.length)} - {Math.min(currentPage * itemsPerPage, sortedTrades.length)} of {sortedTrades.length} trades
                </span>

                {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1 text-xs rounded-lg bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Previous
                        </button>
                        <span className="text-xs text-zinc-500">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1 text-xs rounded-lg bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
