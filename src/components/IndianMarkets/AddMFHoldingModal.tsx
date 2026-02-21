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
import { searchMF, getLatestNav, type MFSearchResult } from "@/lib/api/indian-mf";
import { cn } from "@/lib/utils";
import { Loader2, Search } from "lucide-react";
import type { IndianTransaction } from "@/lib/api/indian-markets-types";

interface AddMFHoldingModalProps {
    open: boolean;
    onClose: () => void;
    onAdd: (tx: IndianTransaction) => void;
}

export function AddMFHoldingModal(props: AddMFHoldingModalProps) {
    const { open, onClose, onAdd } = props;
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<MFSearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [selected, setSelected] = useState<MFSearchResult | null>(null);
    const [units, setUnits] = useState("");
    const [purchaseDate, setPurchaseDate] = useState(() => {
        const d = new Date();
        return d.toISOString().slice(0, 10);
    });
    const [purchaseNav, setPurchaseNav] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [currentNavInfo, setCurrentNavInfo] = useState<{ nav: number; date?: string } | null>(null);

    const doSearch = useCallback(async () => {
        if (!query.trim()) return;
        setSearching(true);
        try {
            const data = await searchMF(query.trim());
            setResults(data || []);
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

    // Fetch current NAV when user selects a scheme
    useEffect(() => {
        if (!selected) {
            setCurrentNavInfo(null);
            return;
        }
        let cancelled = false;
        setCurrentNavInfo(null);
        getLatestNav(selected.schemeCode).then((res) => {
            if (cancelled) return;
            const nav = res?.data?.[0]?.nav ? parseFloat(res.data[0].nav) : 0;
            const date = res?.data?.[0]?.date;
            if (nav > 0) {
                setCurrentNavInfo({ nav, date });
                setPurchaseNav((prev) => (prev ? prev : String(nav)));
            }
        });
        return () => {
            cancelled = true;
        };
    }, [selected]);

    const handleSubmit = async () => {
        if (!selected || !units || parseFloat(units) <= 0) return;
        setSubmitting(true);
        let nav = purchaseNav ? parseFloat(purchaseNav) : 0;
        if (nav <= 0) {
            const res = await getLatestNav(selected.schemeCode);
            nav = res?.data?.[0]?.nav ? parseFloat(res.data[0].nav) : 0;
        }
        const tx: IndianTransaction = {
            id: `mf-${selected.schemeCode}-${Date.now()}`,
            type: "mf",
            side: "buy",
            symbol: String(selected.schemeCode),
            name: selected.schemeName,
            schemeCode: selected.schemeCode,
            amount: parseFloat(units),
            price: nav,
            timestamp: new Date(purchaseDate).getTime(),
        };
        onAdd(tx);
        setSubmitting(false);
        onClose();
        setQuery("");
        setSelected(null);
        setUnits("");
        setPurchaseNav("");
    };

    const handleClose = () => {
        setQuery("");
        setResults([]);
        setSelected(null);
        setUnits("");
        setPurchaseNav("");
        setCurrentNavInfo(null);
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
            <DialogContent className="sm:max-w-md dark:bg-zinc-950 dark:border-zinc-800">
                <DialogHeader>
                    <DialogTitle>Add Mutual Fund Holding</DialogTitle>
                    <DialogDescription>
                        Search for a scheme, select it, and enter your units and purchase date.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div>
                        <Label>Search scheme</Label>
                        <div className="flex gap-2 mt-1">
                            <Input
                                placeholder="e.g. HDFC, SBI"
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
                                    key={r.schemeCode}
                                    type="button"
                                    onClick={() => setSelected(r)}
                                    className={cn(
                                        "w-full text-left px-3 py-2 rounded text-sm transition-colors",
                                        selected?.schemeCode === r.schemeCode
                                            ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                                            : "hover:bg-zinc-800 text-zinc-300"
                                    )}
                                >
                                    <div className="font-medium truncate">{r.schemeName}</div>
                                    <div className="text-xs text-zinc-500">Code: {r.schemeCode}</div>
                                </button>
                            ))}
                        </div>
                    )}

                    {selected && (
                        <>
                            <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-300">
                                Selected: {selected.schemeName}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Units</Label>
                                    <Input
                                        type="number"
                                        step="any"
                                        min="0"
                                        placeholder="e.g. 100"
                                        value={units}
                                        onChange={(e) => setUnits(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label>Purchase Date</Label>
                                    <Input
                                        type="date"
                                        value={purchaseDate}
                                        onChange={(e) => setPurchaseDate(e.target.value)}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <Label>Purchase NAV (optional)</Label>
                                    <Input
                                        type="number"
                                        step="any"
                                        min="0"
                                        placeholder="Leave blank to use current NAV"
                                        value={purchaseNav}
                                        onChange={(e) => setPurchaseNav(e.target.value)}
                                    />
                                    {currentNavInfo && (
                                        <p className="text-[10px] text-zinc-500 mt-1">
                                            Current NAV: ₹{currentNavInfo.nav.toLocaleString("en-IN", { maximumFractionDigits: 4 })}
                                            {currentNavInfo.date && ` as of ${currentNavInfo.date}`}
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
                        disabled={!selected || !units || parseFloat(units) <= 0 || submitting}
                    >
                        Add Holding
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
