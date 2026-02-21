"use client";

import { useEffect, useMemo, useState } from "react";
import { Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useScreenerData } from "@/hooks/useScreenerData";

type Preset = "all" | "high-volume" | "oi-spike" | "big-movers" | "high-funding";

type ScreenerRow = {
    symbol: string;
    exchange: string;
    price: number;
    oiUsd: number;
    funding: number;
    trd15m: number;
    vlt15m: number;
    liq5m: number;
    rvol: number;
    chg15m: number;
    vol24h: number;
};

const formatUsdCompact = (val: number) => {
    const n = Number(val) || 0;
    if (!isFinite(n) || n === 0) return "-";
    const abs = Math.abs(n);
    if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
    return `$${n.toFixed(2)}`;
};

const formatPct = (val: number) => {
    const n = Number(val);
    if (!isFinite(n)) return "-";
    return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
};

export default function TMScreener() {
    const screener = useScreenerData();
    const tickersList = screener?.tickersList || [];
    const isConnected = screener?.isConnected || false;

    const [search, setSearch] = useState("");
    const [preset, setPreset] = useState<Preset>("all");
    const [sortBy, setSortBy] = useState<keyof ScreenerRow>("vol24h");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
    const [starred, setStarred] = useState<Set<string>>(new Set());

    const rows: ScreenerRow[] = useMemo(() => {
        return tickersList
            .filter(t => !!t.symbol)
            .map(t => ({
                symbol: t.symbol,
                exchange: t.exchange,
                price: Number(t.price || 0),
                oiUsd: Number(t.openInterest || 0),
                funding: Number(t.fundingRate || 0) * 100,
                trd15m: Number(t.trades15m || 0),
                vlt15m: Number(t.volatility15m || 0),
                liq5m: Number(t.liquidations5m || 0),
                rvol: Number(t.momentumScore || 0) / 10,
                chg15m: Number(t.change15m || 0),
                vol24h: Number(t.volume24h || 0),
            }));
    }, [tickersList]);

    const filteredData = useMemo(() => {
        const low = search.trim().toLowerCase();

        let res = rows;

        if (low) {
            res = res.filter(r => r.symbol.toLowerCase().includes(low) || r.exchange.toLowerCase().includes(low));
        }

        if (preset !== "all") {
            if (preset === "high-volume") res = res.filter(r => r.vol24h > 1e9);
            if (preset === "oi-spike") res = res.filter(r => r.oiUsd > 5e8);
            if (preset === "big-movers") res = res.filter(r => Math.abs(r.chg15m) > 2);
            if (preset === "high-funding") res = res.filter(r => Math.abs(r.funding) > 0.01);
        }

        res = [...res].sort((a, b) => {
            const va = Number(a[sortBy] || 0);
            const vb = Number(b[sortBy] || 0);
            return sortDir === "asc" ? va - vb : vb - va;
        });

        return res;
    }, [rows, search, preset, sortBy, sortDir]);

    const toggleStar = (key: string) => {
        setStarred(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const setPresetFromLabel = (label: string) => {
        const key = label.toLowerCase().replace(/\s+/g, "-") as Preset;
        setPreset(key);
    };

    useEffect(() => {
        if (!isConnected) return;
    }, [isConnected]);

    return (
        <div className="flex h-full bg-black text-white">
            <div className="w-64 bg-gray-950 border-r border-gray-800 p-4">
                <div className="space-y-4">
                    <div className="text-lg font-bold">TM Screener</div>
                    <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
                    <div className="flex flex-wrap gap-2">
                        {["All", "High Volume", "OI Spike", "Big Movers", "High Funding"].map(p => (
                            <Button
                                key={p}
                                variant={preset === (p.toLowerCase().replace(/\s+/g, "-") as Preset) ? "default" : "outline"}
                                size="sm"
                                onClick={() => setPresetFromLabel(p)}
                            >
                                {p}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex-1 p-6">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold">TM SCREENER</h1>
                    <div className="text-sm text-gray-400">
                        MARKETS: {filteredData.length} • API: {isConnected ? "LIVE" : "OFF"}
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-8" />
                            <TableHead>SYMBOL</TableHead>
                            <TableHead>PRICE</TableHead>
                            <TableHead
                                className="cursor-pointer"
                                onClick={() => {
                                    setSortBy("oiUsd");
                                    setSortDir(prev => (prev === "asc" ? "desc" : "asc"));
                                }}
                            >
                                OI $
                            </TableHead>
                            <TableHead
                                className="cursor-pointer"
                                onClick={() => {
                                    setSortBy("funding");
                                    setSortDir(prev => (prev === "asc" ? "desc" : "asc"));
                                }}
                            >
                                FUNDING
                            </TableHead>
                            <TableHead>TRD (15m)</TableHead>
                            <TableHead>VLT (15m)</TableHead>
                            <TableHead>LIQ (5m)</TableHead>
                            <TableHead>RVOL</TableHead>
                            <TableHead
                                className="cursor-pointer"
                                onClick={() => {
                                    setSortBy("chg15m");
                                    setSortDir(prev => (prev === "asc" ? "desc" : "asc"));
                                }}
                            >
                                CHG (15m)
                            </TableHead>
                            <TableHead
                                className="cursor-pointer"
                                onClick={() => {
                                    setSortBy("vol24h");
                                    setSortDir(prev => (prev === "asc" ? "desc" : "asc"));
                                }}
                            >
                                VOL (24h)
                            </TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {filteredData.map((row) => {
                            const key = `${row.symbol}-${row.exchange}`;
                            const isStarred = starred.has(key);
                            return (
                                <TableRow key={key} className="hover:bg-gray-900">
                                    <TableCell onClick={() => toggleStar(key)} className="cursor-pointer">
                                        <Star className={`w-4 h-4 ${isStarred ? "fill-yellow-400 text-yellow-400" : "text-gray-500"}`} />
                                    </TableCell>
                                    <TableCell className="font-medium">{row.symbol}</TableCell>
                                    <TableCell>{row.price ? row.price.toFixed(2) : "-"}</TableCell>
                                    <TableCell>{row.oiUsd ? formatUsdCompact(row.oiUsd) : "-"}</TableCell>
                                    <TableCell className={row.funding > 0 ? "text-green-400" : row.funding < 0 ? "text-red-400" : "text-gray-300"}>
                                        {isFinite(row.funding) && row.funding !== 0 ? `${row.funding.toFixed(4)}%` : "-"}
                                    </TableCell>
                                    <TableCell>{row.trd15m ? row.trd15m.toFixed(0) : "-"}</TableCell>
                                    <TableCell>{row.vlt15m ? formatPct(row.vlt15m) : "-"}</TableCell>
                                    <TableCell className="text-red-400">{row.liq5m ? formatUsdCompact(row.liq5m) : "-"}</TableCell>
                                    <TableCell>{row.rvol ? `${row.rvol.toFixed(2)}x` : "-"}</TableCell>
                                    <TableCell className={row.chg15m > 0 ? "text-green-400" : row.chg15m < 0 ? "text-red-400" : "text-gray-300"}>
                                        {isFinite(row.chg15m) ? formatPct(row.chg15m) : "-"}
                                    </TableCell>
                                    <TableCell>{row.vol24h ? formatUsdCompact(row.vol24h) : "-"}</TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
