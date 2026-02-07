'use client';

import { useState, useEffect } from 'react';
import { JournalCalendar } from '@/components/Journal/JournalCalendar';
import { TradingStats } from '@/components/Journal/TradingStats';
import { TradeDetailsModal } from '@/components/Journal/TradeDetailsModal';
import { Transaction } from '@/lib/api/types';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function JournalPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [selectedTrade, setSelectedTrade] = useState<Transaction | null>(null);
    const [filterDate, setFilterDate] = useState<Date | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Load from LocalStorage - ONLY real data, no demo
        const savedData = localStorage.getItem("journal_transactions");
        if (savedData) {
            setTransactions(JSON.parse(savedData));
        }
        // If no saved data, show empty state - user must click "Sync Data"
    }, []);

    const handleSync = async () => {
        setLoading(true);
        try {
            // Read connections from Settings (new format)
            const savedConnections = localStorage.getItem("portfolio_connections");
            if (!savedConnections) {
                alert("No connections found! Please go to Settings and add your exchange accounts first.");
                setLoading(false);
                return;
            }

            const connections = JSON.parse(savedConnections);

            // Filter only enabled exchange connections
            const enabledExchanges = connections.filter((conn: any) =>
                conn.enabled !== false &&
                (conn.type === 'binance' || conn.type === 'bybit' || conn.type === 'hyperliquid')
            );

            if (enabledExchanges.length === 0) {
                alert("No enabled exchange accounts found! Please go to Settings and enable at least one exchange.");
                setLoading(false);
                return;
            }

            // Build keys object for API
            const keys: any = {};
            enabledExchanges.forEach((conn: any) => {
                if (conn.type === 'binance' && conn.apiKey && conn.secret) {
                    keys.binanceApiKey = conn.apiKey;
                    keys.binanceSecret = conn.secret;
                }
                if (conn.type === 'bybit' && conn.apiKey && conn.secret) {
                    keys.bybitApiKey = conn.apiKey;
                    keys.bybitSecret = conn.secret;
                }
                if (conn.type === 'hyperliquid' && conn.walletAddress) {
                    keys.hyperliquidWallet = conn.walletAddress;
                }
            });

            const res = await fetch('/api/journal/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keys })
            });

            if (res.ok) {
                const data = await res.json();
                if (data.trades) {
                    setTransactions(data.trades);
                    localStorage.setItem("journal_transactions", JSON.stringify(data.trades));
                }
            } else {
                console.error("Sync failed");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateTrade = (id: string, updates: Partial<Transaction>) => {
        const updated = transactions.map(t => t.id === id ? { ...t, ...updates } : t);
        setTransactions(updated);
        localStorage.setItem("journal_transactions", JSON.stringify(updated));
    };

    // Filter trades by selected date on calendar
    const displayedTrades = filterDate
        ? transactions.filter(t => new Date(t.timestamp).toDateString() === filterDate.toDateString())
        : transactions;

    return (
        <main className="min-h-screen bg-[#0B0E11] text-gray-100 p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="p-2 hover:bg-[#1E2026] rounded-full text-gray-400 hover:text-white transition-colors">
                            <ArrowLeft size={24} />
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                                Trading Journal
                            </h1>
                            <p className="text-gray-500">Track, Analyze, Improve.</p>
                        </div>
                    </div>

                    <button
                        onClick={handleSync}
                        disabled={loading}
                        className={cn(
                            "px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white rounded-lg font-medium flex items-center gap-2 transition-colors",
                            loading && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                        {loading ? 'Syncing...' : 'Sync Data'}
                    </button>
                </div>

                {/* Top Stats */}
                <TradingStats transactions={transactions} />

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Left: Calendar */}
                    <div className="lg:col-span-2 space-y-6">
                        <section>
                            <h2 className="text-xl font-semibold mb-4">Activity Calendar</h2>
                            <JournalCalendar transactions={transactions} onSelectDate={setFilterDate} />
                        </section>

                        {/* Recent Trades List */}
                        <section>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-semibold">
                                    {filterDate ? `Trades on ${filterDate.toLocaleDateString()}` : 'Recent Trades'}
                                </h2>
                                {filterDate && (
                                    <button onClick={() => setFilterDate(null)} className="text-sm text-blue-400 hover:text-blue-300">
                                        Clear Filter
                                    </button>
                                )}
                            </div>

                            <div className="bg-[#1E2026] rounded-xl border border-[#2B2F36] overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-[#13151A] text-gray-500 uppercase font-medium border-b border-[#2B2F36]">
                                        <tr>
                                            <th className="px-6 py-4">Date</th>
                                            <th className="px-6 py-4">Symbol</th>
                                            <th className="px-6 py-4">Side</th>
                                            <th className="px-6 py-4 text-right">PnL</th>
                                            <th className="px-6 py-4 text-center">Tags</th>
                                            <th className="px-6 py-4"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#2B2F36]">
                                        {displayedTrades.map(trade => (
                                            <tr key={trade.id} className="hover:bg-[#2B2F36]/50 transition-colors group">
                                                <td className="px-6 py-4 text-gray-400 cursor-pointer" onClick={() => setSelectedTrade(trade)}>
                                                    {new Date(trade.timestamp).toLocaleDateString()} <span className="text-xs">{new Date(trade.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </td>
                                                <td className="px-6 py-4 font-medium cursor-pointer" onClick={() => setSelectedTrade(trade)}>
                                                    {trade.symbol}
                                                </td>
                                                <td className="px-6 py-4 cursor-pointer" onClick={() => setSelectedTrade(trade)}>
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${trade.side === 'buy' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                                        {trade.side.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td className={`px-6 py-4 text-right font-mono font-bold cursor-pointer ${trade.pnl && trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`} onClick={() => setSelectedTrade(trade)}>
                                                    {trade.pnl ? (trade.pnl > 0 ? '+' : '') + trade.pnl.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '-'}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex gap-1 justify-center flex-wrap">
                                                        {trade.tags?.map(tag => (
                                                            <span key={tag} className="px-2 py-0.5 bg-[#13151A] border border-[#2B2F36] rounded text-[10px] text-gray-400">
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => setSelectedTrade(trade)}
                                                        className="text-gray-500 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        Edit
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {displayedTrades.length === 0 && (
                                    <div className="p-8 text-center text-gray-500 italic">
                                        {transactions.length === 0 ? "No trades found. Click 'Sync Data' to fetch history." : "No trades found for this period."}
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>

                    {/* Right: Insights / Motivation (Optional, kept simple for now) */}
                    <div className="space-y-6">
                        <div className="bg-[#1E2026] p-6 rounded-xl border border-[#2B2F36]">
                            <h3 className="text-lg font-bold mb-4">Focus Area</h3>
                            <p className="text-gray-400 text-sm mb-4">
                                "The goal of a successful trader is to make the best trades. Money is secondary."
                                <br />— Alexander Elder
                            </p>
                            <div className="space-y-2">
                                <h4 className="text-sm font-semibold text-gray-300">Strategy Rules</h4>
                                <ul className="list-disc list-inside text-sm text-gray-500 space-y-1">
                                    <li>Wait for candle close</li>
                                    <li>Risk max 1% per trade</li>
                                    <li>No revenge trading</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {selectedTrade && (
                <TradeDetailsModal
                    transaction={selectedTrade}
                    onClose={() => setSelectedTrade(null)}
                    onSave={handleUpdateTrade}
                />
            )}
        </main>
    );
}
