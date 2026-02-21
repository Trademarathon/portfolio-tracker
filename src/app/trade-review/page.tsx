"use client";

import { useState, useMemo } from "react";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { useTradeJournal } from "@/hooks/useTradeJournal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionErrorBoundary } from "@/components/Dashboard/SectionErrorBoundary";
import { PageWrapper } from "@/components/Layout/PageWrapper";
import { StrategyBadge, StrategyTagSelector } from "@/components/Journal/StrategyTagSelector";
import { TradeAnnotationModal } from "@/components/Journal/TradeAnnotationModal";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { STRATEGY_TAGS, StrategyTagId, getStrategyTag, getExecutionQualityInfo } from "@/lib/api/journal-types";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
    BarChart3,
    Target,
    TrendingUp,
    Filter,
    Plus,
    Star,
    Clock,
    DollarSign,
    Sparkles,
    ChevronDown
} from "lucide-react";

export default function TradeReviewPage() {
    const { activities } = usePortfolio();
    const {
        annotations,
        addAnnotation,
        updateAnnotation,
        deleteAnnotation,
        getAnnotationByTradeId,
        filterByTag,
        isLoaded
    } = useTradeJournal();

    const [selectedTag, setSelectedTag] = useState<StrategyTagId | 'all'>('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTrade, setSelectedTrade] = useState<any>(null);

    // Get all trades from activities
    const allTrades = useMemo(() => {
        return (activities || [])
            .filter(a => a.activityType === 'trade')
            .sort((a, b) => b.timestamp - a.timestamp);
    }, [activities]);

    // Filter trades based on selected tag
    const filteredTrades = useMemo(() => {
        if (selectedTag === 'all') return allTrades;

        const taggedTradeIds = new Set(filterByTag(selectedTag).map(a => a.tradeId));
        return allTrades.filter(t => taggedTradeIds.has(t.id));
    }, [allTrades, selectedTag, filterByTag]);

    // Calculate stats per strategy
    const strategyStats = useMemo(() => {
        const stats: Record<string, { count: number; tagged: number }> = {};

        STRATEGY_TAGS.forEach(tag => {
            const taggedTrades = filterByTag(tag.id);
            stats[tag.id] = {
                count: taggedTrades.length,
                tagged: taggedTrades.length,
            };
        });

        return stats;
    }, [filterByTag]);

    const handleOpenModal = (trade: any) => {
        setSelectedTrade(trade);
        setIsModalOpen(true);
    };

    const handleSave = (data: any) => {
        const existing = getAnnotationByTradeId(data.tradeId);
        if (existing) {
            updateAnnotation(existing.id, data);
        } else {
            addAnnotation(data);
        }
    };

    const handleDelete = (id: string) => {
        deleteAnnotation(id);
    };

    const totalTaggedTrades = annotations.length;
    const avgQuality = annotations.length > 0
        ? annotations.reduce((sum, a) => sum + a.executionQuality, 0) / annotations.length
        : 0;

    return (
        <SectionErrorBoundary sectionName="Trade Review" fallback={
            <PageWrapper><div className="flex flex-col items-center justify-center min-h-[40vh] gap-4"><p className="text-sm text-zinc-400">Something went wrong.</p><button type="button" onClick={() => window.location.reload()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold">Reload</button></div></PageWrapper>
        }>
        <div className="p-8 max-w-7xl mx-auto space-y-8 pb-32">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
                        <Sparkles className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">Trade Review</h1>
                        <p className="text-sm text-muted-foreground">
                            Analyze performance by strategy • Tag trades for post-trade review
                        </p>
                    </div>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-zinc-900/50 border-white/10">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                <BarChart3 className="h-5 w-5 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground font-bold uppercase">Total Trades</p>
                                <p className="text-2xl font-bold text-white">{allTrades.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-zinc-900/50 border-white/10">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                                <Target className="h-5 w-5 text-emerald-500" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground font-bold uppercase">Tagged Trades</p>
                                <p className="text-2xl font-bold text-white">{totalTaggedTrades}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-zinc-900/50 border-white/10">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                                <Star className="h-5 w-5 text-amber-500" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground font-bold uppercase">Avg. Execution</p>
                                <p className="text-2xl font-bold text-white">{avgQuality.toFixed(1)}/5</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-zinc-900/50 border-white/10">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                <TrendingUp className="h-5 w-5 text-purple-500" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground font-bold uppercase">Strategies Used</p>
                                <p className="text-2xl font-bold text-white">
                                    {Object.values(strategyStats).filter(s => s.count > 0).length}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Strategy Breakdown */}
            <Card className="bg-zinc-900/50 border-white/10">
                <CardHeader>
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        Strategy Breakdown
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setSelectedTag('all')}
                            className={cn(
                                "px-3 py-2 rounded-lg text-sm font-medium transition-all",
                                selectedTag === 'all'
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-white/5 hover:bg-white/10 text-zinc-400"
                            )}
                        >
                            All Trades ({allTrades.length})
                        </button>
                        {STRATEGY_TAGS.map(tag => (
                            <button
                                key={tag.id}
                                onClick={() => setSelectedTag(tag.id)}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                                    selectedTag === tag.id
                                        ? "ring-2 ring-offset-2 ring-offset-zinc-900"
                                        : "hover:bg-white/10"
                                )}
                                style={{
                                    backgroundColor: selectedTag === tag.id ? `${tag.color}30` : 'rgba(255,255,255,0.05)',
                                    color: selectedTag === tag.id ? tag.color : '#a1a1aa',
                                    borderColor: selectedTag === tag.id ? tag.color : 'transparent',
                                }}
                            >
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
                                {tag.name} ({strategyStats[tag.id]?.count || 0})
                            </button>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Trade List */}
            <Card className="bg-zinc-900/50 border-white/10">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                        {selectedTag === 'all' ? 'All Trades' : `${getStrategyTag(selectedTag)?.name} Trades`}
                    </CardTitle>
                    <span className="text-xs text-muted-foreground bg-white/5 px-2 py-1 rounded">
                        {filteredTrades.length} trades
                    </span>
                </CardHeader>
                <CardContent className="p-0">
                    {filteredTrades.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground">
                            <Target className="h-12 w-12 mx-auto mb-4 opacity-30" />
                            <p className="text-sm">No trades found for this filter.</p>
                            <p className="text-xs mt-1">Start tagging trades to see them here!</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
                            {filteredTrades.slice(0, 50).map((trade: any) => {
                                const annotation = getAnnotationByTradeId(trade.id);
                                const tagInfo = annotation ? getStrategyTag(annotation.strategyTag) : null;
                                const qualityInfo = annotation ? getExecutionQualityInfo(annotation.executionQuality) : null;

                                return (
                                    <motion.div
                                        key={trade.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="flex items-center p-4 hover:bg-white/5 transition-colors cursor-pointer"
                                        onClick={() => handleOpenModal(trade)}
                                    >
                                        {/* Time */}
                                        <div className="w-[100px] shrink-0">
                                            <p className="text-xs text-muted-foreground font-mono">
                                                {format(trade.timestamp, 'MM/dd HH:mm')}
                                            </p>
                                        </div>

                                        {/* Symbol */}
                                        <div className="w-[140px] shrink-0 flex items-center gap-2">
                                            <TokenIcon symbol={trade.symbol || trade.asset} size={24} />
                                            <div>
                                                <p className="font-bold text-white text-sm">{trade.symbol || trade.asset}</p>
                                                <p className={cn(
                                                    "text-[10px] font-bold uppercase",
                                                    trade.side === 'buy' ? "text-emerald-500" : "text-red-500"
                                                )}>
                                                    {trade.side}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Price & Amount */}
                                        <div className="w-[120px] shrink-0 text-right">
                                            <p className="text-sm font-mono text-zinc-300">${(trade.price || 0).toLocaleString()}</p>
                                            <p className="text-xs text-muted-foreground">{trade.amount} units</p>
                                        </div>

                                        {/* Strategy Tag */}
                                        <div className="flex-1 px-4">
                                            {annotation ? (
                                                <div className="flex items-center gap-2">
                                                    <StrategyBadge tag={annotation.strategyTag} />
                                                    {qualityInfo && (
                                                        <span
                                                            className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                                            style={{
                                                                backgroundColor: `${qualityInfo.color}20`,
                                                                color: qualityInfo.color
                                                            }}
                                                        >
                                                            {qualityInfo.label}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                                                    <Plus className="h-3 w-3" />
                                                    Add Tag
                                                </button>
                                            )}
                                        </div>

                                        {/* Notes Preview */}
                                        <div className="w-[200px] shrink-0">
                                            {annotation?.notes ? (
                                                <p className="text-xs text-muted-foreground truncate italic">
                                                    "{annotation.notes}"
                                                </p>
                                            ) : (
                                                <span className="text-xs text-zinc-600">No notes</span>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Annotation Modal */}
            {selectedTrade && (
                <TradeAnnotationModal
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        setSelectedTrade(null);
                    }}
                    tradeId={selectedTrade.id}
                    tradeSummary={{
                        symbol: selectedTrade.symbol || selectedTrade.asset,
                        side: selectedTrade.side || 'UNKNOWN',
                        size: selectedTrade.amount || 0,
                        price: selectedTrade.price || 0,
                        pnl: selectedTrade.pnl,
                        timestamp: selectedTrade.timestamp,
                    }}
                    existingAnnotation={getAnnotationByTradeId(selectedTrade.id)}
                    onSave={handleSave}
                    onDelete={handleDelete}
                />
            )}
        </div>
        </SectionErrorBoundary>
    );
}
