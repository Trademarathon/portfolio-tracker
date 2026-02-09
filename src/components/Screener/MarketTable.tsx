
"use client";

import { useRealtimeMarket } from "@/hooks/useRealtimeMarket";
import { useAlerts } from "@/hooks/useAlerts";
import { useAdvancedScreener } from "@/hooks/useAdvancedScreener";
import { useState, useMemo, CSSProperties } from "react";
import { formatCurrency, cn } from "@/lib/utils";
import {
    Bell,
    TrendingUp,
    ExternalLink,
    Search,
    Eye,
    Zap,
    Activity
} from "lucide-react";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { List } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';

const MarketRow = ({
    index,
    style,
    data
}: {
    index: number,
    style: CSSProperties,
    data: {
        items: any[],
        onSelect: (s: string) => void,
        selectedSymbol: string,
        isCompact: boolean,
        visibleColumns: Record<string, boolean>,
        colWidths: Record<string, string>,
        addAlert: (s: string, c: any[]) => void
    }
}) => {
    const item = data.items[index];
    const isSelected = data.selectedSymbol === item.symbol;
    const { onSelect, isCompact, visibleColumns, colWidths, addAlert } = data;

    return (
        <div style={style} onClick={() => onSelect(item.symbol)}>
            <div className={cn(
                "flex items-center h-full border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer",
                isSelected && "bg-primary/15 border-l-2 border-l-primary"
            )}>
                <div className={cn(colWidths.market, "px-4 flex items-center gap-3", !isCompact && "pl-6")}>
                    <TokenIcon symbol={item.symbol} size={isCompact ? 20 : 28} />
                    <div>
                        <div className="font-bold text-white text-[11px] leading-tight">{item.symbol}</div>
                        {!isCompact && <div className="text-[9px] text-zinc-500 font-mono uppercase">Perp</div>}
                    </div>
                </div>

                {visibleColumns.price && (
                    <div className={cn(colWidths.price, "px-4 text-right font-mono font-bold text-white")}>
                        {formatCurrency(item.price)}
                    </div>
                )}

                {visibleColumns.change1h && (
                    <div className={cn(colWidths.change1h, "px-4 text-right")}>
                        <div className={cn("text-xs font-mono font-bold", (item.priceChange1h || 0) >= 0 ? "text-emerald-500" : "text-rose-500")}>
                            {(item.priceChange1h || 0).toFixed(2)}%
                        </div>
                    </div>
                )}

                {visibleColumns.change24h && (
                    <div className={cn(colWidths.change24h, "px-4 text-right")}>
                        <div className={cn("text-xs font-mono font-bold", item.change24h >= 0 ? "text-emerald-500" : "text-rose-500")}>
                            {item.change24h.toFixed(2)}%
                        </div>
                    </div>
                )}

                {visibleColumns.volatility && (
                    <div className={cn(colWidths.volatility, "px-4 text-right")}>
                        <div className="flex flex-col items-end">
                            <span className="text-xs font-mono font-bold text-white">{(item.volatility24h || 0).toFixed(2)}%</span>
                        </div>
                    </div>
                )}

                {visibleColumns.rvol && (
                    <div className={cn(colWidths.rvol, "px-4 text-right")}>
                        <div className="flex flex-col items-end">
                            <span className="text-xs font-mono font-bold text-white">{(item.rvol || 0).toFixed(2)}x</span>
                        </div>
                    </div>
                )}

                {visibleColumns.oi && (
                    <div className={cn(colWidths.oi, "px-4 text-right")}>
                        <span className="text-[10px] font-mono text-zinc-500 opacity-80">${((item.oi || 0) / 1000000).toFixed(1)}M</span>
                    </div>
                )}

                {visibleColumns.funding && (
                    <div className={cn(colWidths.funding, "px-4 text-right")}>
                        {item.funding !== undefined && (
                            <span className={cn(
                                "text-[9px] font-bold px-1 rounded bg-white/5",
                                item.funding > 0 ? "text-amber-500" : "text-emerald-500"
                            )}>
                                {(item.funding * 8 * 100).toFixed(4)}%
                            </span>
                        )}
                    </div>
                )}

                {!isCompact && (
                    <div className={cn(colWidths.action, "px-4 text-right pr-6")}>
                        <div className="flex items-center justify-end gap-2 opacity-50 hover:opacity-100">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    addAlert(item.symbol, [{ type: "price_above", target: item.price * 1.05 }]);
                                }}
                            >
                                <Bell className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-white hover:bg-white/10">
                                <ExternalLink className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export function MarketTable({
    onSelect,
    selectedSymbol,
    isCompact = false,
    symbols
}: {
    onSelect: (symbol: string) => void,
    selectedSymbol: string,
    isCompact?: boolean,
    symbols: string[]
}) {
    const { stats: marketStats, prices } = useRealtimeMarket(symbols);
    const { addAlert } = useAlerts();

    const activeSymbols = useMemo(() => symbols, [symbols]);

    const [search, setSearch] = useState("");
    const [sortBy, setSortBy] = useState<string>("price");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

    const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
        price: true,
        change1h: true,
        change24h: !isCompact,
        volatility: !isCompact,
        rvol: !isCompact,
        oi: !isCompact,
        funding: !isCompact,
        cvd: false
    });

    const filteredItems = useMemo(() => {
        let items = activeSymbols.map((symbol: string) => {
            const stat = marketStats[symbol];
            const price = prices[symbol] || stat?.price || 0;

            return {
                symbol,
                price,
                change24h: stat?.change24h || 0,
                priceChange1h: stat?.change1h || 0,
                funding: stat?.fundingRate,
                oi: stat?.openInterest,
                volatility24h: 0,
                rvol: 0,
                btcCorrelation: 0,
                cvd: 0,
                oiChange1h: 0,
                oiChange24h: 0,
            };
        });

        if (search) {
            items = items.filter(i => i.symbol.toLowerCase().includes(search.toLowerCase()));
        }

        return items.sort((a, b) => {
            const factor = sortDir === "asc" ? 1 : -1;
            const valA = (a as any)[sortBy] ?? 0;
            const valB = (b as any)[sortBy] ?? 0;
            return (valA > valB ? 1 : -1) * factor;
        });
    }, [activeSymbols, marketStats, search, sortBy, sortDir, prices]);

    const toggleColumn = (col: string) => {
        setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }));
    };

    const colWidths = useMemo(() => ({
        market: "flex-1 min-w-[140px]",
        price: "w-[100px]",
        change1h: "w-[80px]",
        change24h: "w-[80px]",
        volatility: "w-[80px]",
        rvol: "w-[80px]",
        oi: "w-[120px]",
        funding: "w-[120px]",
        action: "w-[80px]"
    }), []);

    // Memoize the data passed to the list to prevent re-renders when other things change
    const itemData = useMemo(() => ({
        items: filteredItems,
        onSelect,
        selectedSymbol,
        isCompact,
        visibleColumns,
        colWidths,
        addAlert
    }), [filteredItems, onSelect, selectedSymbol, isCompact, visibleColumns, colWidths, addAlert]);

    return (
        <div className="space-y-4 h-full flex flex-col">
            {!isCompact && (
                <div className="flex flex-wrap items-center justify-between gap-4 flex-shrink-0">
                    <div className="flex items-center gap-4 flex-1 min-w-[300px]">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search symbols..."
                                className="pl-10 bg-zinc-900/50 border-white/5 focus-visible:ring-primary/50 text-xs h-9"
                                value={search}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white bg-white/5">
                                <Zap className="h-3 w-3 mr-1 text-amber-500" /> OI Spike
                            </Button>
                            <Button variant="ghost" size="sm" className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white bg-white/5">
                                <TrendingUp className="h-3 w-3 mr-1 text-emerald-500" /> High Vol
                            </Button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="bg-zinc-900/50 border-white/5 text-xs h-9">
                                    <Eye className="h-3.5 w-3.5 mr-2" /> Columns
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="bg-zinc-900 border-white/10 text-white w-48">
                                <DropdownMenuLabel className="text-[10px] uppercase font-bold text-zinc-500">Display Columns</DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-white/5" />
                                {Object.keys(visibleColumns).map(col => (
                                    <DropdownMenuCheckboxItem
                                        key={col}
                                        checked={visibleColumns[col]}
                                        onCheckedChange={() => toggleColumn(col)}
                                        className="text-xs capitalize focus:bg-primary/20 focus:text-white"
                                    >
                                        {col.replace('24h', ' 24h')}
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <div className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 rounded-lg border border-primary/20">
                            <Activity className="h-3 w-3 text-primary animate-pulse" />
                            <span className="text-[10px] font-bold text-primary uppercase tracking-tighter">Stream Active</span>
                        </div>
                    </div>
                </div>
            )}

            <div className="rounded-xl border border-white/5 bg-zinc-950/30 overflow-hidden flex-1 flex flex-col min-h-[400px]">
                {/* Header Row */}
                <div className={cn("flex items-center h-12 border-b border-white/5 bg-white/5 px-0 flex-shrink-0", isCompact && "bg-transparent")}>
                    <div className={cn(colWidths.market, "px-4 font-bold text-[10px] uppercase tracking-widest text-muted-foreground", !isCompact && "pl-6")}>Market</div>
                    {visibleColumns.price && <div onClick={() => { setSortBy('price'); setSortDir(prev => prev === 'asc' ? 'desc' : 'asc'); }} className={cn(colWidths.price, "px-4 text-right font-bold text-[10px] uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-white transition-colors")}>Price</div>}
                    {visibleColumns.change1h && <div onClick={() => { setSortBy('change1h'); setSortDir(prev => prev === 'asc' ? 'desc' : 'asc'); }} className={cn(colWidths.change1h, "px-4 text-right font-bold text-[10px] uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-white transition-colors")}>1H</div>}
                    {visibleColumns.change24h && <div onClick={() => { setSortBy('change24h'); setSortDir(prev => prev === 'asc' ? 'desc' : 'asc'); }} className={cn(colWidths.change24h, "px-4 text-right font-bold text-[10px] uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-white transition-colors")}>24h %</div>}
                    {visibleColumns.volatility && <div onClick={() => { setSortBy('volatility24h'); setSortDir(prev => prev === 'asc' ? 'desc' : 'asc'); }} className={cn(colWidths.volatility, "px-4 text-right font-bold text-[10px] uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-white transition-colors")}>Vlt</div>}
                    {visibleColumns.rvol && <div onClick={() => { setSortBy('rvol'); setSortDir(prev => prev === 'asc' ? 'desc' : 'asc'); }} className={cn(colWidths.rvol, "px-4 text-right font-bold text-[10px] uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-white transition-colors")}>RVOL</div>}
                    {visibleColumns.oi && <div onClick={() => { setSortBy('oi'); setSortDir(prev => prev === 'asc' ? 'desc' : 'asc'); }} className={cn(colWidths.oi, "px-4 text-right font-bold text-[10px] uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-white transition-colors")}>OI $</div>}
                    {visibleColumns.funding && <div onClick={() => { setSortBy('funding'); setSortDir(prev => prev === 'asc' ? 'desc' : 'asc'); }} className={cn(colWidths.funding, "px-4 text-right font-bold text-[10px] uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-white transition-colors")}>Funding</div>}
                    {!isCompact && <div className={cn(colWidths.action, "px-4 text-right font-bold text-[10px] uppercase tracking-widest text-muted-foreground pr-6")}>Action</div>}
                </div>

                {/* Virtualized Body */}
                <div className="flex-1">
                    <AutoSizer renderProp={({ height, width }: { height: number | undefined; width: number | undefined }) => (
                        <List
                            height={height || 400}
                            width={width || 600}
                            itemCount={filteredItems.length}
                            itemSize={56}
                            itemData={itemData}
                            className="custom-scrollbar"
                        >
                            {MarketRow}
                        </List>
                    )} />
                </div>
            </div>
        </div>
    );
}
