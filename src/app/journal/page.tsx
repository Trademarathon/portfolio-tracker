'use client';

import { useState, useEffect, useMemo } from 'react';
import { JournalCalendar } from '@/components/Journal/JournalCalendar';
import { TradingStats } from '@/components/Journal/TradingStats';
import { TradeDetailsModal } from '@/components/Journal/TradeDetailsModal';
import { StrategyBadge } from '@/components/Journal/StrategyTagSelector';
import { TradeAnnotationModal } from '@/components/Journal/TradeAnnotationModal';
import { useTradeJournal } from '@/hooks/useTradeJournal';
import { Transaction } from '@/lib/api/types';
import { STRATEGY_TAGS, getStrategyTag, getExecutionQualityInfo, StrategyTagId } from '@/lib/api/journal-types';
import { ArrowLeft, RefreshCw, BookOpen, Target, BarChart3, Star, Filter, LineChart } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { TokenIcon } from '@/components/ui/TokenIcon';
import {
    PnLCurveWidget,
    DrawdownWidget,
    KeyMetricsWidget,
    HoldtimeAnalyticsWidget,
    TradingSessionWidget,
    DayOfWeekWidget,
    TimeOfDayWidget,
    SymbolsReportWidget
} from '@/components/Journal/Widgets';

type TabType = 'calendar' | 'strategy-review' | 'analytics';

export default function JournalPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [selectedTrade, setSelectedTrade] = useState<Transaction | null>(null);
    const [filterDate, setFilterDate] = useState<Date | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('calendar');

    // Strategy Review State
    const [selectedTag, setSelectedTag] = useState<StrategyTagId | 'all'>('all');
    const [annotationModalOpen, setAnnotationModalOpen] = useState(false);
    const [selectedTradeForAnnotation, setSelectedTradeForAnnotation] = useState<Transaction | null>(null);

    const {
        annotations,
        addAnnotation,
        updateAnnotation,
        deleteAnnotation,
        getAnnotationByTradeId,
        filterByTag
    } = useTradeJournal();

    useEffect(() => {
        const savedData = localStorage.getItem("journal_transactions");
        if (savedData) {
            const parsed = JSON.parse(savedData);
            const unique = parsed.filter((v: Transaction, i: number, a: Transaction[]) => a.findIndex(t => t.id === v.id) === i);
            setTransactions(unique);
        }
    }, []);

    const handleSync = async () => {
        setLoading(true);
        try {
            const savedConnections = localStorage.getItem("portfolio_connections");
            if (!savedConnections) {
                alert("No connections found! Please go to Settings and add your exchange accounts first.");
                setLoading(false);
                return;
            }

            const connections = JSON.parse(savedConnections);
            const enabledExchanges = connections.filter((conn: any) =>
                conn.enabled !== false &&
                (conn.type === 'binance' || conn.type === 'bybit' || conn.type === 'hyperliquid')
            );

            if (enabledExchanges.length === 0) {
                alert("No enabled exchange accounts found! Please go to Settings and enable at least one exchange.");
                setLoading(false);
                return;
            }

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

    // Strategy Review: Filter trades based on selected tag
    const strategyFilteredTrades = useMemo(() => {
        if (selectedTag === 'all') return transactions;
        const taggedTradeIds = new Set(filterByTag(selectedTag).map(a => a.tradeId));
        return transactions.filter(t => taggedTradeIds.has(t.id));
    }, [transactions, selectedTag, filterByTag]);

    // Calculate stats per strategy
    const strategyStats = useMemo(() => {
        const stats: Record<string, number> = {};
        STRATEGY_TAGS.forEach(tag => {
            stats[tag.id] = filterByTag(tag.id).length;
        });
        return stats;
    }, [filterByTag]);

    const totalTaggedTrades = annotations.length;
    const avgQuality = annotations.length > 0
        ? annotations.reduce((sum, a) => sum + a.executionQuality, 0) / annotations.length
        : 0;

    const handleOpenAnnotationModal = (trade: Transaction) => {
        setSelectedTradeForAnnotation(trade);
        setAnnotationModalOpen(true);
    };

    const handleSaveAnnotation = (data: any) => {
        const existing = getAnnotationByTradeId(data.tradeId);
        if (existing) {
            updateAnnotation(existing.id, data);
        } else {
            addAnnotation(data);
        }
    };

    const tabs = [
        { id: 'calendar' as TabType, label: 'Calendar View', icon: BookOpen },
        { id: 'analytics' as TabType, label: 'Analytics', icon: LineChart },
        { id: 'strategy-review' as TabType, label: 'Strategy Review', icon: Target },
    ];

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
                            <h1 className="text-3xl font-serif font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
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

                {/* Tab Navigation */}
                <div className="flex gap-2 border-b border-white/10 pb-0">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "relative px-4 py-3 text-sm font-bold uppercase tracking-wider transition-all flex items-center gap-2",
                                    activeTab === tab.id
                                        ? "text-white"
                                        : "text-zinc-500 hover:text-zinc-300"
                                )}
                            >
                                <Icon className="h-4 w-4" />
                                <span>{tab.label}</span>
                                {activeTab === tab.id && (
                                    <motion.div
                                        layoutId="journalActiveTab"
                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Calendar View Tab */}
                {activeTab === 'calendar' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-8"
                    >
                        <TradingStats transactions={transactions} />

                        <div className="grid lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 space-y-6">
                                <section>
                                    <h2 className="text-xl font-semibold mb-4">Activity Calendar</h2>
                                    <JournalCalendar transactions={transactions} onSelectDate={setFilterDate} />
                                </section>

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
                    </motion.div>
                )}

                {/* Strategy Review Tab */}
                {activeTab === 'strategy-review' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-6"
                    >
                        {/* Stats Row */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-[#1E2026] rounded-xl border border-[#2B2F36] p-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                        <BarChart3 className="h-5 w-5 text-blue-500" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 font-bold uppercase">Total Trades</p>
                                        <p className="text-2xl font-bold text-white">{transactions.length}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-[#1E2026] rounded-xl border border-[#2B2F36] p-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                                        <Target className="h-5 w-5 text-emerald-500" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 font-bold uppercase">Tagged Trades</p>
                                        <p className="text-2xl font-bold text-white">{totalTaggedTrades}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-[#1E2026] rounded-xl border border-[#2B2F36] p-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                                        <Star className="h-5 w-5 text-amber-500" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 font-bold uppercase">Avg. Execution</p>
                                        <p className="text-2xl font-bold text-white">{avgQuality.toFixed(1)}/5</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-[#1E2026] rounded-xl border border-[#2B2F36] p-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                        <Filter className="h-5 w-5 text-purple-500" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 font-bold uppercase">Strategies Used</p>
                                        <p className="text-2xl font-bold text-white">
                                            {Object.values(strategyStats).filter(c => c > 0).length}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Strategy Filter */}
                        <div className="bg-[#1E2026] rounded-xl border border-[#2B2F36] p-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                                <Filter className="h-3 w-3" /> Filter by Strategy
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setSelectedTag('all')}
                                    className={cn(
                                        "px-3 py-2 rounded-lg text-sm font-medium transition-all",
                                        selectedTag === 'all'
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-white/5 hover:bg-white/10 text-gray-400"
                                    )}
                                >
                                    All Trades ({transactions.length})
                                </button>
                                {STRATEGY_TAGS.map(tag => (
                                    <button
                                        key={tag.id}
                                        onClick={() => setSelectedTag(tag.id)}
                                        className={cn(
                                            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                                            selectedTag === tag.id ? "ring-2 ring-offset-2 ring-offset-zinc-900" : "hover:bg-white/10"
                                        )}
                                        style={{
                                            backgroundColor: selectedTag === tag.id ? `${tag.color}30` : 'rgba(255,255,255,0.05)',
                                            color: selectedTag === tag.id ? tag.color : '#a1a1aa',
                                        }}
                                    >
                                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
                                        {tag.name} ({strategyStats[tag.id] || 0})
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Trade List */}
                        <div className="bg-[#1E2026] rounded-xl border border-[#2B2F36] overflow-hidden">
                            <div className="p-4 border-b border-[#2B2F36] flex justify-between items-center">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">
                                    {selectedTag === 'all' ? 'All Trades' : `${getStrategyTag(selectedTag)?.name} Trades`}
                                </h3>
                                <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded">
                                    {strategyFilteredTrades.length} trades
                                </span>
                            </div>

                            {strategyFilteredTrades.length === 0 ? (
                                <div className="text-center py-16 text-gray-500">
                                    <Target className="h-12 w-12 mx-auto mb-4 opacity-30" />
                                    <p className="text-sm">No trades found for this filter.</p>
                                    <p className="text-xs mt-1">Start tagging trades to see them here!</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-[#2B2F36] max-h-[500px] overflow-y-auto">
                                    {strategyFilteredTrades.slice(0, 50).map((trade) => {
                                        const annotation = getAnnotationByTradeId(trade.id);
                                        const qualityInfo = annotation ? getExecutionQualityInfo(annotation.executionQuality) : null;

                                        return (
                                            <div
                                                key={trade.id}
                                                className="flex items-center p-4 hover:bg-[#2B2F36]/50 transition-colors cursor-pointer"
                                                onClick={() => handleOpenAnnotationModal(trade)}
                                            >
                                                <div className="w-[100px] shrink-0">
                                                    <p className="text-xs text-gray-500 font-mono">
                                                        {format(trade.timestamp, 'MM/dd HH:mm')}
                                                    </p>
                                                </div>
                                                <div className="w-[140px] shrink-0 flex items-center gap-2">
                                                    <TokenIcon symbol={trade.symbol} size={24} />
                                                    <div>
                                                        <p className="font-bold text-white text-sm">{trade.symbol}</p>
                                                        <p className={cn(
                                                            "text-[10px] font-bold uppercase",
                                                            trade.side === 'buy' ? "text-emerald-500" : "text-red-500"
                                                        )}>
                                                            {trade.side}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="w-[100px] shrink-0 text-right">
                                                    <p className="text-sm font-mono text-gray-300">${(trade.price || 0).toLocaleString()}</p>
                                                    <p className="text-xs text-gray-500">{trade.amount} units</p>
                                                </div>
                                                <div className="flex-1 px-4">
                                                    {annotation ? (
                                                        <div className="flex items-center gap-2">
                                                            <StrategyBadge tag={annotation.strategyTag} />
                                                            {qualityInfo && (
                                                                <span
                                                                    className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                                                    style={{ backgroundColor: `${qualityInfo.color}20`, color: qualityInfo.color }}
                                                                >
                                                                    {qualityInfo.label}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-gray-600 hover:text-primary">+ Add Tag</span>
                                                    )}
                                                </div>
                                                <div className="w-[180px] shrink-0">
                                                    {annotation?.notes ? (
                                                        <p className="text-xs text-gray-500 truncate italic">"{annotation.notes}"</p>
                                                    ) : (
                                                        <span className="text-xs text-gray-700">No notes</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}

                {/* Analytics Tab - Tradestream-style Dashboard */}
                {activeTab === 'analytics' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-6"
                    >
                        {/* Header Row */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-white">Trading Analytics</h2>
                                <p className="text-sm text-gray-500">Comprehensive insights powered by {transactions.length} trades</p>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
                                Last synced: {new Date().toLocaleTimeString()}
                            </div>
                        </div>

                        {/* Key Metrics - Full Width */}
                        <KeyMetricsWidget trades={transactions} />

                        {/* Charts Row */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <PnLCurveWidget trades={transactions} />
                            <DrawdownWidget trades={transactions} />
                        </div>

                        {/* Analysis Row */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <HoldtimeAnalyticsWidget trades={transactions} />
                            <TradingSessionWidget trades={transactions} />
                        </div>

                        {/* Time-based Analysis Row */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <DayOfWeekWidget trades={transactions} />
                            <TimeOfDayWidget trades={transactions} />
                        </div>

                        {/* Symbols Report - Full Width */}
                        <SymbolsReportWidget trades={transactions} />

                        {/* Footer Note */}
                        <div className="text-center text-xs text-gray-600 py-4">
                            <p>Analytics update in real-time as you sync trades. All metrics are calculated from your trading history.</p>
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Trade Details Modal (Calendar View) */}
            {selectedTrade && (
                <TradeDetailsModal
                    transaction={selectedTrade}
                    onClose={() => setSelectedTrade(null)}
                    onSave={handleUpdateTrade}
                />
            )}

            {/* Strategy Annotation Modal */}
            {selectedTradeForAnnotation && (
                <TradeAnnotationModal
                    isOpen={annotationModalOpen}
                    onClose={() => {
                        setAnnotationModalOpen(false);
                        setSelectedTradeForAnnotation(null);
                    }}
                    tradeId={selectedTradeForAnnotation.id}
                    tradeSummary={{
                        symbol: selectedTradeForAnnotation.symbol,
                        side: selectedTradeForAnnotation.side,
                        size: selectedTradeForAnnotation.amount,
                        price: selectedTradeForAnnotation.price || 0,
                        pnl: selectedTradeForAnnotation.pnl,
                        timestamp: selectedTradeForAnnotation.timestamp,
                    }}
                    existingAnnotation={getAnnotationByTradeId(selectedTradeForAnnotation.id)}
                    onSave={handleSaveAnnotation}
                    onDelete={deleteAnnotation}
                />
            )}
        </main>
    );
}
