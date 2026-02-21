"use client";

import { useApiHealth } from "@/hooks/useApiHealth";

export function ApiHealthBanner() {
    const { unreachable, retry } = useApiHealth();
    if (!unreachable) return null;
    return (
        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-200 text-xs">
            <span>API server unreachable — CEX and journal may not work.</span>
            <button
                type="button"
                onClick={retry}
                className="shrink-0 px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 font-bold uppercase tracking-wider"
            >
                Retry
            </button>
        </div>
    );
}
