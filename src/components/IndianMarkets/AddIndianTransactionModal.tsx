"use client";

import { useState, useEffect } from "react";
import { getLatestNav } from "@/lib/api/indian-mf";
import { getStockPrice } from "@/lib/api/indian-stocks";
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
import type { IndianTransaction, IndianAssetType } from "@/lib/api/indian-markets-types";
import { cn } from "@/lib/utils";

interface AddIndianTransactionModalProps {
    open: boolean;
    onClose: () => void;
    onAdd: (tx: IndianTransaction) => void;
    type: IndianAssetType;
    symbol: string;
    name: string;
    schemeCode?: number;
    currentPrice?: number;
}

export function AddIndianTransactionModal({
    open,
    onClose,
    onAdd,
    type,
    symbol,
    name,
    schemeCode,
    currentPrice,
}: AddIndianTransactionModalProps) {
    const [side, setSide] = useState<"buy" | "sell">("buy");
    const [amount, setAmount] = useState("");
    const [price, setPrice] = useState(currentPrice ? String(currentPrice) : "");
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16));
    const [fee, setFee] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // Fetch current price from API when modal opens if not provided
    useEffect(() => {
        if (!open) return;
        if (currentPrice && currentPrice > 0) {
            setPrice(String(currentPrice));
            return;
        }
        let cancelled = false;
        if (type === "mf" && schemeCode) {
            getLatestNav(schemeCode).then((res) => {
                if (cancelled) return;
                const nav = res?.data?.[0]?.nav ? parseFloat(res.data[0].nav) : 0;
                if (nav > 0) setPrice(String(nav));
            });
        } else if (type === "stock") {
            getStockPrice(symbol).then((res) => {
                if (cancelled) return;
                const p = res?.data?.last_price ?? 0;
                if (p > 0) setPrice(String(p));
            });
        }
        return () => {
            cancelled = true;
        };
    }, [open, type, symbol, schemeCode, currentPrice]);

    const handleSubmit = () => {
        const amt = parseFloat(amount);
        const pr = parseFloat(price);
        if (!amount || amt <= 0 || !price || pr <= 0) return;
        setSubmitting(true);
        const tx: IndianTransaction = {
            id: `indian-${type}-${symbol}-${Date.now()}`,
            type,
            side,
            symbol,
            name,
            schemeCode,
            amount: amt,
            price: pr,
            timestamp: new Date(date).getTime(),
            fee: fee ? parseFloat(fee) : undefined,
        };
        onAdd(tx);
        setSubmitting(false);
        onClose();
        setAmount("");
        setPrice(currentPrice ? String(currentPrice) : "");
        setFee("");
    };

    const handleClose = () => {
        setAmount("");
        setPrice(currentPrice ? String(currentPrice) : "");
        setFee("");
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
            <DialogContent className="sm:max-w-md dark:bg-zinc-950 dark:border-zinc-800">
                <DialogHeader>
                    <DialogTitle>Add {type === "mf" ? "MF" : "Stock"} Transaction</DialogTitle>
                    <DialogDescription>
                        Add a buy or sell for {name} ({symbol})
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant={side === "buy" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSide("buy")}
                            className={cn(side === "buy" && "bg-emerald-600 hover:bg-emerald-700")}
                        >
                            Buy
                        </Button>
                        <Button
                            type="button"
                            variant={side === "sell" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSide("sell")}
                            className={cn(side === "sell" && "bg-rose-600 hover:bg-rose-700")}
                        >
                            Sell
                        </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>{type === "mf" ? "Units" : "Quantity"}</Label>
                            <Input
                                type="number"
                                step="any"
                                min="0"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                        </div>
                        <div>
                            <Label>{type === "mf" ? "NAV" : "Price"} (INR)</Label>
                            <Input
                                type="number"
                                step="any"
                                min="0"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                placeholder={currentPrice ? String(currentPrice) : undefined}
                            />
                        </div>
                        <div>
                            <Label>Date & Time</Label>
                            <Input
                                type="datetime-local"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <Label>Fee (optional)</Label>
                            <Input
                                type="number"
                                step="any"
                                min="0"
                                placeholder="0"
                                value={fee}
                                onChange={(e) => setFee(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!amount || !price || parseFloat(amount) <= 0 || parseFloat(price) <= 0 || submitting}
                    >
                        Add {side === "buy" ? "Buy" : "Sell"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
