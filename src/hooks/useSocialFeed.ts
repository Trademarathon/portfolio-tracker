"use client";

import { useEffect, useMemo, useState } from "react";
import { loadSocialSettings } from "@/lib/social-settings";
import type { AlphaSignalExport } from "@/components/Dashboard/NeuralAlphaFeed";

export function useSocialFeed(params: {
  scope: "overview" | "markets" | "spot" | "balances";
  symbols: string[];
  highVolSymbols?: string[];
}) {
  const { scope } = params;
  const [settings, setSettings] = useState(loadSocialSettings());
  const [signals, setSignals] = useState<AlphaSignalExport[]>([]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "social_feed_settings") setSettings(loadSocialSettings());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const enabled = settings.enabled && settings.sections?.[scope];

  useEffect(() => {
    if (enabled) {
      // External provider integration is intentionally disabled in local-only mode.
      setSignals([]);
      return;
    }
    setSignals([]);
  }, [enabled]);

  return useMemo(() => signals, [signals]);
}
