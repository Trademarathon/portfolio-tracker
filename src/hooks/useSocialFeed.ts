"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchXPosts } from "@/lib/api/social";
import { loadSocialSettings } from "@/lib/social-settings";
import type { AlphaSignalExport } from "@/components/Dashboard/NeuralAlphaFeed";

const REFRESH_MS = 2 * 60 * 1000;
const MAX_POSTS = 10;

export function useSocialFeed(params: {
  symbols: string[];
  scope: "overview" | "markets" | "spot" | "balances";
  highVolSymbols?: string[];
}) {
  const { symbols, scope, highVolSymbols = [] } = params;
  const [settings, setSettings] = useState(loadSocialSettings());
  const [signals, setSignals] = useState<AlphaSignalExport[]>([]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "social_x_settings") setSettings(loadSocialSettings());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const enabled = settings.enabled && settings.sections?.[scope];
  const symbolsKey = useMemo(() => symbols.join("|"), [symbols]);
  const accountsKey = useMemo(() => (settings.accounts || []).join("|"), [settings.accounts]);
  const keywordsKey = useMemo(() => (settings.keywords || []).join("|"), [settings.keywords]);
  const highVolKey = useMemo(() => highVolSymbols.join("|"), [highVolSymbols]);

  useEffect(() => {
    if (!enabled) {
      setSignals([]);
      return;
    }
    let cancelled = false;
    let controller: AbortController | null = null;
    const tickers = symbols
      .map((s) => s.replace(/[^A-Z0-9]/gi, "").toUpperCase())
      .filter(Boolean)
      .slice(0, 25);

    const run = async () => {
      controller?.abort();
      controller = new AbortController();
      const posts = await fetchXPosts({
        tickers,
        accounts: settings.accounts || [],
        keywords: settings.keywords || [],
        sinceMinutes: 120,
        signal: controller.signal,
      }).catch(() => []);
      if (cancelled) return;
      const top = posts
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, MAX_POSTS);
      const items: AlphaSignalExport[] = top.map((p) => ({
        id: `x-${p.id}`,
        type: "SOCIAL_MENTION",
        symbol: p.symbols?.[0] || tickers[0] || "X",
        title: `${p.author} mentioned ${p.symbols?.[0] || "market"}`,
        description: p.text.slice(0, 180),
        timestamp: p.timestamp,
        priority: highVolSymbols.includes(p.symbols?.[0]) ? "high" : "medium",
        data: {
          url: p.url,
          author: p.author,
          source: "x",
        },
      }));
      setSignals(items);
    };

    run().catch(() => setSignals([]));
    const id = setInterval(run, REFRESH_MS);
    return () => {
      cancelled = true;
      controller?.abort();
      clearInterval(id);
    };
  }, [enabled, scope, symbolsKey, accountsKey, keywordsKey, highVolKey]);

  return useMemo(() => signals, [signals]);
}
