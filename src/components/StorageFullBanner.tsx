"use client";

import Link from "next/link";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { AlertTriangle, Download, X } from "lucide-react";
import { useState } from "react";

export function StorageFullBanner() {
  const { storageFullNotice, clearStorageFullNotice } = useSupabaseAuth();
  const [dismissing, setDismissing] = useState(false);

  if (!storageFullNotice) return null;

  const handleDismiss = async () => {
    setDismissing(true);
    await clearStorageFullNotice();
    setDismissing(false);
  };

  return (
    <div className="sticky top-0 z-30 shrink-0 flex items-center justify-between gap-4 px-4 py-3 bg-amber-500/15 border-b border-amber-500/30 text-amber-200">
      <div className="flex items-center gap-3 min-w-0">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
        <p className="text-sm">
          Your cloud storage is full. Please export your data from Settings → Data to avoid data loss.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/settings?tab=data"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200 text-sm font-medium hover:bg-amber-500/30 transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </Link>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={dismissing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white/90 text-sm font-medium hover:bg-white/15 transition-colors disabled:opacity-50"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
          Dismiss
        </button>
      </div>
    </div>
  );
}
