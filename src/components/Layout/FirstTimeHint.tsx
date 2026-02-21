"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, X } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "trademarathon_first_hint_seen";
const AUTO_DISMISS_MS = 5000;

export function FirstTimeHint() {
    const [visible, setVisible] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;
        try {
            const seen = localStorage.getItem(STORAGE_KEY);
            if (seen !== "true") {
                setVisible(true);
            }
        } catch {
            setVisible(true);
        }
    }, [mounted]);

    const dismiss = useCallback(() => {
        setVisible(false);
        try {
            localStorage.setItem(STORAGE_KEY, "true");
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        if (!visible || !mounted) return;
        const t = setTimeout(dismiss, AUTO_DISMISS_MS);
        return () => clearTimeout(t);
    }, [visible, mounted, dismiss]);

    if (!mounted || !visible) return null;

    return (
        <div
            role="banner"
            className={cn(
                "fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-[100]",
                "flex items-center gap-4 p-4 rounded-xl",
                "bg-indigo-500/15 border border-indigo-500/30 backdrop-blur-xl",
                "shadow-lg shadow-indigo-500/10",
                "animate-in slide-in-from-bottom-4 fade-in duration-300"
            )}
        >
            <div className="flex-1 flex items-center gap-3 min-w-0">
                <div className="shrink-0 p-2 rounded-lg bg-indigo-500/20">
                    <BookOpen className="h-5 w-5 text-indigo-400" />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">
                        New to Trade Marathon?
                    </p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                        Read our guide to get started.
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <Link
                    href="/about#how-to-use"
                    onClick={dismiss}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-500/30 text-indigo-200 hover:bg-indigo-500/40 transition-colors"
                >
                    How to Use
                </Link>
                <button
                    onClick={dismiss}
                    aria-label="Close"
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
