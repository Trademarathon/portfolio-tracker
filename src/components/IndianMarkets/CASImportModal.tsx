"use client";

import { useState, useCallback } from "react";
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
import { getCasParserApiKey } from "@/lib/api/indian-markets-config";
import {
    loadMFTransactions,
    loadStockTransactions,
    saveMFTransactions,
    saveStockTransactions,
    mergeMFTransactions,
    mergeStockTransactions,
    replaceMFTransactions,
    replaceStockTransactions,
} from "@/lib/api/indian-markets-storage";
import type { IndianTransaction } from "@/lib/api/indian-markets-types";
import { apiUrl } from "@/lib/api/client";
import { Upload, FileJson, FileText, Loader2, CheckCircle2 } from "lucide-react";

interface CASImportModalProps {
    open: boolean;
    onClose: () => void;
    onImport: (mf: IndianTransaction[], stocks: IndianTransaction[]) => void;
}

type UploadMode = "pdf" | "json";

export function CASImportModal({
    open,
    onClose,
    onImport,
}: CASImportModalProps) {
    const [mode, setMode] = useState<UploadMode>("json");
    const [file, setFile] = useState<File | null>(null);
    const [password, setPassword] = useState("");
    const [parsing, setParsing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [parsed, setParsed] = useState<{
        mfTransactions: IndianTransaction[];
        stockTransactions: IndianTransaction[];
    } | null>(null);
    const [mergeMode, setMergeMode] = useState<"merge" | "replace">("replace");

    const reset = useCallback(() => {
        setFile(null);
        setPassword("");
        setError(null);
        setParsed(null);
    }, []);

    const handleClose = useCallback(() => {
        reset();
        onClose();
    }, [reset, onClose]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0] ?? null;
        setFile(f);
        setError(null);
        setParsed(null);
    };

    const handleParse = async () => {
        if (!file) {
            setError("Please select a file");
            return;
        }
        if (mode === "pdf") {
            const apiKey = getCasParserApiKey();
            if (!apiKey) {
                setError("CAS Parser API key required. Add it in Settings > Indian Markets.");
                return;
            }
            if (!password.trim()) {
                setError("Password required (CAS PDF password, usually DOB in DDMMYYYY)");
                return;
            }
        }

        setParsing(true);
        setError(null);
        try {
            if (mode === "json") {
                const text = await file.text();
                const data = JSON.parse(text);
                const res = await fetch(apiUrl("/api/indian-markets/cas-import/parse-json"), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data),
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error || "Parse failed");
                setParsed({
                    mfTransactions: json.mfTransactions ?? [],
                    stockTransactions: json.stockTransactions ?? [],
                });
            } else {
                const formData = new FormData();
                formData.append("file", file);
                formData.append("password", password);

                const apiKey = getCasParserApiKey();
                const res = await fetch(apiUrl("/api/indian-markets/cas-import/parse-pdf"), {
                    method: "POST",
                    headers: {
                        "X-CAS-Parser-API-Key": apiKey,
                    },
                    body: formData,
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error || "Parse failed");
                setParsed({
                    mfTransactions: json.mfTransactions ?? [],
                    stockTransactions: json.stockTransactions ?? [],
                });
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to parse");
        } finally {
            setParsing(false);
        }
    };

    const handleConfirm = () => {
        if (!parsed) return;

        const existingMf = loadMFTransactions();
        const existingStock = loadStockTransactions();

        let newMf: IndianTransaction[];
        let newStock: IndianTransaction[];

        if (mergeMode === "merge") {
            newMf = mergeMFTransactions(existingMf, parsed.mfTransactions);
            newStock = mergeStockTransactions(existingStock, parsed.stockTransactions);
        } else {
            newMf = parsed.mfTransactions;
            newStock = parsed.stockTransactions;
        }

        saveMFTransactions(newMf);
        saveStockTransactions(newStock);
        onImport(newMf, newStock);
        handleClose();
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
            <DialogContent className="sm:max-w-md dark:bg-zinc-950 dark:border-zinc-800">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Upload className="h-5 w-5 text-amber-400" />
                        Import from CAS
                    </DialogTitle>
                    <DialogDescription>
                        Get your CAS from MFCentral (MF) or CDSL (stocks). Download as PDF or convert at casparser.in and upload JSON.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="flex gap-2">
                        <Button
                            variant={mode === "json" ? "default" : "outline"}
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                                setMode("json");
                                reset();
                            }}
                        >
                            <FileJson className="h-4 w-4 mr-2" />
                            JSON
                        </Button>
                        <Button
                            variant={mode === "pdf" ? "default" : "outline"}
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                                setMode("pdf");
                                reset();
                            }}
                        >
                            <FileText className="h-4 w-4 mr-2" />
                            PDF
                        </Button>
                    </div>

                    <div className="space-y-2">
                        <Label>File</Label>
                        <input
                            type="file"
                            accept={mode === "pdf" ? ".pdf" : ".json"}
                            onChange={handleFileChange}
                            className="block w-full text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-amber-500/20 file:text-amber-400 file:text-sm file:font-bold"
                        />
                    </div>

                    {mode === "pdf" && (
                        <div className="space-y-2">
                            <Label>Password (DOB: DDMMYYYY)</Label>
                            <Input
                                type="text"
                                placeholder="e.g. 15041990"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    )}

                    {error && (
                        <p className="text-sm text-rose-400">{error}</p>
                    )}

                    {parsed && (
                        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                            <div className="flex items-center gap-2 text-emerald-400 mb-2">
                                <CheckCircle2 className="h-4 w-4" />
                                <span className="font-bold">Parsed successfully</span>
                            </div>
                            <p className="text-xs text-zinc-400">
                                Found {parsed.mfTransactions.length} MF transactions, {parsed.stockTransactions.length} stock transactions.
                            </p>
                            <div className="flex gap-4 mt-3">
                                <label className="flex items-center gap-2 text-sm cursor-pointer text-foreground">
                                    <input
                                        type="radio"
                                        checked={mergeMode === "replace"}
                                        onChange={() => setMergeMode("replace")}
                                        className="rounded-full border-zinc-600"
                                    />
                                    Replace
                                </label>
                                <label className="flex items-center gap-2 text-sm cursor-pointer text-foreground">
                                    <input
                                        type="radio"
                                        checked={mergeMode === "merge"}
                                        onChange={() => setMergeMode("merge")}
                                        className="rounded-full border-zinc-600"
                                    />
                                    Merge
                                </label>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose}>
                        Cancel
                    </Button>
                    {!parsed ? (
                        <Button
                            onClick={handleParse}
                            disabled={!file || parsing}
                        >
                            {parsing ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Parsing...
                                </>
                            ) : (
                                "Parse"
                            )}
                        </Button>
                    ) : (
                        <Button onClick={handleConfirm}>
                            Import
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
