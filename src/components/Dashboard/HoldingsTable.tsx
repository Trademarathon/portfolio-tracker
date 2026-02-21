import { usePortfolio } from "@/contexts/PortfolioContext";
import { useAlerts } from "@/hooks/useAlerts";
import { useSpotAvgPriceRange } from "@/hooks/useSpotAvgPriceRange";
import { normalizeSymbol } from "@/lib/utils/normalization";
import { calculateAssetAnalytics } from "@/lib/utils/analytics";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ArrowUp, ArrowDown, List as ListIcon, Clock, PieChart, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState, CSSProperties, memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { List } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';
import { PortfolioAsset, PortfolioConnection, Transaction } from "@/lib/api/types";
import { SpotOrdersTable } from "./SpotOrdersTable";
import { HoldingsRow } from "./HoldingsRow";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import moment from "moment";

// Filter to only show spot orders (exclude perps/futures)
const isSpotOrder = (order: any) => {
    if (order.isPerp === true) return false;
    if (order.isPerp === false) return true;
    
    const symbol = order.symbol || '';
    if (symbol.startsWith('@')) return true;
    
    const s = symbol.toUpperCase();
    if (s.includes('PERP') || s.includes('-SWAP') || s.includes('_PERP')) return false;
    if (s.startsWith('1000')) return false;
    if (s.includes('_')) return false;
    
    const exchange = (order.exchange || order.connectionName || '').toLowerCase();
    if (exchange.includes('hyperliquid') && !symbol.startsWith('@')) return false;
    
    return true;
};

export const HoldingsTable = memo(({ assets: propAssets, connections, onAddTransaction }: { assets?: PortfolioAsset[], connections?: PortfolioConnection[], onAddTransaction?: (tx: Transaction) => void }) => {
    const { assets: hookAssets, spotOrders, loading, prices, transactions: activeTransactions, transfers: activeTransfers } = usePortfolio();
    const { signals } = useAlerts();
    const assets = useMemo(
        () => [...(propAssets ?? hookAssets ?? [])].sort((a, b) => b.valueUsd - a.valueUsd),
        [propAssets, hookAssets]
    );
    const [ordersCollapsed, setOrdersCollapsed] = useState(false);
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
    
    // Filter to only spot orders (exclude perps)
    const filteredSpotOrders = useMemo(() => {
        return (spotOrders || []).filter(isSpotOrder);
    }, [spotOrders]);

    const { fromMs, toMs, hasRange } = useSpotAvgPriceRange();
    const perAssetRangeVwap = useMemo(() => {
        const out = new Map<string, number>();
        if (!hasRange || fromMs >= toMs) return out;
        assets.forEach((asset) => {
            const analytics = calculateAssetAnalytics(asset, activeTransactions || [], {
                transfers: activeTransfers || [],
                fromMs,
                toMs,
                depositBasisPrice: asset.price || 0,
            });
            if (analytics.avgBuyPrice > 0) {
                out.set(normalizeSymbol(asset.symbol), analytics.avgBuyPrice);
            }
        });
        return out;
    }, [assets, activeTransactions, activeTransfers, fromMs, toMs, hasRange]);

    // Manual Tx State
    const [isTxModalOpen, setIsTxModalOpen] = useState(false);
    const [txForm, setTxForm] = useState({
        symbol: '',
        side: 'buy',
        amount: '',
        price: '',
        date: moment().format('YYYY-MM-DDTHH:mm'),
        connectionId: '',
        chain: 'ETH'
    });

    const handleAddTransactionTrigger = (symbol: string) => {
        setTxForm(prev => ({ ...prev, symbol }));
        setIsTxModalOpen(true);
    };

    const submitTransaction = () => {
        if (!txForm.symbol || !txForm.amount || !txForm.connectionId) {
            alert("Please fill in all required fields (Symbol, Amount, Wallet)");
            return;
        }

        const manualTx: Transaction = {
            id: `manual-${Date.now()}`,
            symbol: txForm.symbol,
            side: txForm.side as 'buy' | 'sell',
            amount: parseFloat(txForm.amount),
            price: parseFloat(txForm.price) || 0,
            timestamp: moment(txForm.date).valueOf(),
            exchange: 'Manual',
            status: 'completed',
            connectionId: txForm.connectionId,
            chain: txForm.chain
        };

        if (onAddTransaction) {
            onAddTransaction(manualTx);
            setIsTxModalOpen(false);
        }
    };

    if (loading) {
        return (
            <div className="w-full h-[500px] flex items-center justify-center bg-zinc-900/20 rounded-xl border border-white/5 animate-pulse">
                <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-zinc-500 text-xs uppercase tracking-wider">Loading Assets...</span>
                </div>
            </div>
        );
    }

    if (assets.length === 0 && (spotOrders ?? []).length === 0 && !loading) {
        return (
            <Card className="rounded-xl bg-gradient-to-br from-zinc-950/90 to-zinc-900/90 border-white/10 backdrop-blur-xl mt-4 h-[400px] flex flex-col justify-center items-center">
                <div className="p-4 rounded-full bg-zinc-900 mb-4">
                    <ListIcon className="w-8 h-8 text-zinc-600" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">No Spot Assets</h3>
                <p className="text-zinc-500 text-sm max-w-[300px] text-center mb-6">
                    Your spot portfolio is empty. Connect a wallet or exchange to get started.
                </p>
                    <div className="flex gap-4">
                    <a href="/settings" className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-bold transition-all">
                        Connect Wallet
                    </a>
                </div>
            </Card>
        );
    }

    const Row = ({ index, style, expandedIndex: expIdx, onExpand }: { index: number; style: CSSProperties; expandedIndex: number | null; onExpand: (i: number) => void }) => {
        const asset = assets[index];
        const rangeVwap = perAssetRangeVwap.get(normalizeSymbol(asset.symbol)) ?? null;
        return (
            <HoldingsRow
                asset={asset}
                style={style}
                transactions={activeTransactions}
                transfers={activeTransfers}
                signals={signals}
                onAddTransaction={handleAddTransactionTrigger}
                isExpanded={expIdx === index}
                onExpand={() => onExpand(index)}
                customRangeAvgPrice={hasRange ? rangeVwap : undefined}
            />
        );
    };

    const handleExpand = (index: number) => {
        setExpandedIndex((prev) => (prev === index ? null : index));
    };

    const EXPANDED_ROW_HEIGHT = 480;
    const COLLAPSED_ROW_HEIGHT = 80;

    return (
        <>
            {/* ASSETS SECTION */}
            <Card className="rounded-xl bg-gradient-to-br from-zinc-950/90 to-zinc-900/90 border-white/10 backdrop-blur-xl mt-4 overflow-hidden transition-all duration-300 hover:border-white/15">
                <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-teal-500/10 border border-cyan-500/20">
                            <ListIcon className="w-4 h-4 text-cyan-400" />
                        </div>
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-sm uppercase tracking-[0.15em] font-black text-zinc-300">Assets</CardTitle>
                            <span className="px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/20 rounded text-[10px] font-mono font-bold text-cyan-400">
                                {assets.length}
                            </span>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="h-[420px] flex flex-col p-0">
                    <div className="flex items-center h-10 border-b border-white/5 bg-white/5 text-zinc-500 text-[10px] font-bold uppercase tracking-widest px-4">
                        <div className="w-[32px] mx-2"></div>
                        <div className="flex-[2] min-w-[180px]">Asset</div>
                        <div className="flex-[1.2] text-right hidden md:block">Avg / Strategy</div>
                        <div className="flex-1 text-right hidden md:block">Unrealized PnL</div>
                        <div className="flex-1 text-right">Price</div>
                        <div className="flex-1 text-right min-w-[100px]">Value / Bal</div>
                        <div className="w-[80px] text-right ml-4">24h</div>
                    </div>
                    <div className="flex-1 min-h-0">
                        {/* @ts-ignore */}
                        <AutoSizer
                            renderProp={({ height, width }) => (
                                <List
                                    rowCount={assets.length}
                                    rowHeight={(index) => (index === expandedIndex ? EXPANDED_ROW_HEIGHT : COLLAPSED_ROW_HEIGHT)}
                                    rowComponent={Row as any}
                                    rowProps={{ expandedIndex, onExpand: handleExpand }}
                                    style={{ height, width }}
                                    className="custom-scrollbar"
                                />
                            )}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* OPEN ORDERS SECTION */}
            <Card className="rounded-xl bg-gradient-to-br from-zinc-950/90 to-zinc-900/90 border-white/10 backdrop-blur-xl mt-4 overflow-hidden transition-all duration-300 hover:border-white/15">
                <CardHeader 
                    className="flex flex-row items-center justify-between py-3 px-4 border-b border-white/5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                    onClick={() => setOrdersCollapsed(!ordersCollapsed)}
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/20">
                            <Clock className="w-4 h-4 text-amber-400" />
                        </div>
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-sm uppercase tracking-[0.15em] font-black text-zinc-300">Open Orders</CardTitle>
                            {filteredSpotOrders.length > 0 && (
                                <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-[10px] font-mono font-bold text-amber-400">
                                    {filteredSpotOrders.length}
                                </span>
                            )}
                            <span className="text-[8px] text-zinc-600 uppercase">Spot Only</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {filteredSpotOrders.length === 0 && (
                            <span className="text-[10px] text-zinc-600">No open spot orders</span>
                        )}
                        <button className="p-1 rounded hover:bg-white/5 transition-colors">
                            {ordersCollapsed ? (
                                <ChevronDown className="w-4 h-4 text-zinc-500" />
                            ) : (
                                <ChevronUp className="w-4 h-4 text-zinc-500" />
                            )}
                        </button>
                    </div>
                </CardHeader>
                {!ordersCollapsed && (
                    <CardContent className={cn(
                        "flex flex-col p-0 transition-all duration-300",
                        filteredSpotOrders.length > 0 ? "h-[350px]" : "h-[80px]"
                    )}>
                        {filteredSpotOrders.length > 0 ? (
                            <SpotOrdersTable orders={filteredSpotOrders} prices={prices || {}} />
                        ) : (
                            <div className="flex-1 flex items-center justify-center">
                                <div className="flex flex-col items-center gap-2 text-zinc-600">
                                    <Clock className="w-6 h-6 opacity-50" />
                                    <span className="text-xs">No pending limit orders</span>
                                </div>
                            </div>
                        )}
                    </CardContent>
                )}
            </Card>

            {/* Manual Transaction Modal */}
            <Dialog open={isTxModalOpen} onOpenChange={setIsTxModalOpen}>
                <DialogContent className="bg-zinc-950 border-zinc-800 text-white">
                    <DialogHeader>
                        <DialogTitle>Add Manual Transaction</DialogTitle>
                        <DialogDescription className="text-zinc-500">Record a buy/sell trade for your portfolio tracking.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        {/* Wallet & Chain Selection */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Wallet</Label>
                                <Select
                                    value={txForm.connectionId}
                                    onValueChange={val => setTxForm({ ...txForm, connectionId: val })}
                                >
                                    <SelectTrigger className="bg-zinc-900 border-zinc-800">
                                        <SelectValue placeholder="Select Wallet" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                                        {connections?.filter(c => c.type === 'manual' || c.type === 'wallet' || c.hardwareType).map(c => (
                                            <SelectItem key={c.id} value={c.id}>
                                                {c.name} ({c.type === 'manual' ? 'Manual' : c.hardwareType || c.chain || 'Wallet'})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Chain</Label>
                                <Select
                                    value={txForm.chain}
                                    onValueChange={val => setTxForm({ ...txForm, chain: val })}
                                >
                                    <SelectTrigger className="bg-zinc-900 border-zinc-800">
                                        <SelectValue placeholder="Chain" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                                        {['BTC', 'ETH', 'SOL', 'ARB', 'OP', 'MATIC', 'AVAX', 'BSC', 'SUI', 'APT', 'ADA', 'XRP', 'DOGE', 'DOT', 'TRX', 'LTC', 'ATOM', 'NEAR'].map(chain => (
                                            <SelectItem key={chain} value={chain}>{chain}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Asset Symbol</Label>
                                <Input
                                    placeholder="e.g. BTC"
                                    value={txForm.symbol}
                                    onChange={e => setTxForm({ ...txForm, symbol: e.target.value.toUpperCase() })}
                                    className="bg-zinc-900 border-zinc-800"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Type</Label>
                                <Select
                                    value={txForm.side}
                                    onValueChange={val => setTxForm({ ...txForm, side: val as any })}
                                >
                                    <SelectTrigger className="bg-zinc-900 border-zinc-800">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                                        <SelectItem value="buy">Buy</SelectItem>
                                        <SelectItem value="sell">Sell</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Amount</Label>
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    value={txForm.amount}
                                    onChange={e => setTxForm({ ...txForm, amount: e.target.value })}
                                    className="bg-zinc-900 border-zinc-800"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Price ($)</Label>
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    value={txForm.price}
                                    onChange={e => setTxForm({ ...txForm, price: e.target.value })}
                                    className="bg-zinc-900 border-zinc-800"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Date/Time</Label>
                            <Input
                                type="datetime-local"
                                value={txForm.date}
                                onChange={e => setTxForm({ ...txForm, date: e.target.value })}
                                className="bg-zinc-900 border-zinc-800"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsTxModalOpen(false)} className="border-zinc-800 hover:bg-zinc-900 text-zinc-400">Cancel</Button>
                        <Button onClick={submitTransaction} className="bg-indigo-600 hover:bg-indigo-700 text-white">Save Transaction</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
});

export default HoldingsTable;
