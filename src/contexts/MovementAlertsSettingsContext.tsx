"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { getValueWithCloud, setValueWithCloud } from "@/lib/supabase/sync";
import { useSupabaseRealtimeSyncUpdate } from "@/hooks/useSupabaseRealtime";
import {
  MOVEMENT_ALERTS_SETTINGS_KEY,
  DEFAULT_MOVEMENT_ALERTS_SETTINGS,
  type MovementAlertsSettings,
} from "@/lib/movementAlertsSettings";

function mergeSettings(raw: unknown): MovementAlertsSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_MOVEMENT_ALERTS_SETTINGS;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    const next = parsed as Partial<MovementAlertsSettings> & { types?: Partial<MovementAlertsSettings["types"]> };
    return {
      ...DEFAULT_MOVEMENT_ALERTS_SETTINGS,
      ...next,
      types: {
        ...DEFAULT_MOVEMENT_ALERTS_SETTINGS.types,
        ...(next.types || {}),
      },
    };
  } catch {
    return DEFAULT_MOVEMENT_ALERTS_SETTINGS;
  }
}

interface MovementAlertsSettingsContextValue {
  settings: MovementAlertsSettings;
  saveSettings: (partial: Partial<MovementAlertsSettings>) => void;
}

const MovementAlertsSettingsContext = createContext<MovementAlertsSettingsContextValue | null>(null);

export function MovementAlertsSettingsProvider({ children }: { children: React.ReactNode }) {
  const { user, cloudSyncEnabled } = useSupabaseAuth();
  const [settings, setSettings] = useState<MovementAlertsSettings>(DEFAULT_MOVEMENT_ALERTS_SETTINGS);

  // Load from cloud when user + sync on; else from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    if (user?.id && cloudSyncEnabled) {
      getValueWithCloud(MOVEMENT_ALERTS_SETTINGS_KEY, user.id, cloudSyncEnabled).then((saved) => {
        if (cancelled) return;
        const next = mergeSettings(saved);
        setSettings(next);
        try {
          localStorage.setItem(MOVEMENT_ALERTS_SETTINGS_KEY, JSON.stringify(next));
        } catch {}
        window.dispatchEvent(new CustomEvent("movement-alerts-settings-changed", { detail: next }));
      });
    } else {
      try {
        const raw = localStorage.getItem(MOVEMENT_ALERTS_SETTINGS_KEY);
        const next = raw ? mergeSettings(JSON.parse(raw)) : DEFAULT_MOVEMENT_ALERTS_SETTINGS;
        setSettings(next);
      } catch {
        setSettings(DEFAULT_MOVEMENT_ALERTS_SETTINGS);
      }
    }
    return () => {
      cancelled = true;
    };
  }, [user?.id, cloudSyncEnabled]);

  // Realtime: when another tab/device updates movement_alerts_settings, refetch and update
  const handleRealtimeUpdate = useCallback(
    async (key: string) => {
      if (key !== MOVEMENT_ALERTS_SETTINGS_KEY || !user?.id || !cloudSyncEnabled) return;
      const saved = await getValueWithCloud(MOVEMENT_ALERTS_SETTINGS_KEY, user.id, cloudSyncEnabled);
      const next = mergeSettings(saved);
      setSettings(next);
      try {
        localStorage.setItem(MOVEMENT_ALERTS_SETTINGS_KEY, JSON.stringify(next));
      } catch {}
      window.dispatchEvent(new CustomEvent("movement-alerts-settings-changed", { detail: next }));
    },
    [user?.id, cloudSyncEnabled]
  );
  useSupabaseRealtimeSyncUpdate(handleRealtimeUpdate);

  const saveSettings = useCallback(
    (partial: Partial<MovementAlertsSettings>) => {
      setSettings((prev) => {
        const next = {
          ...prev,
          ...partial,
          types: {
            ...prev.types,
            ...(partial.types || {}),
          },
        };
        const raw = JSON.stringify(next);
        try {
          localStorage.setItem(MOVEMENT_ALERTS_SETTINGS_KEY, raw);
        } catch {}
        setValueWithCloud(MOVEMENT_ALERTS_SETTINGS_KEY, raw, user?.id ?? null, cloudSyncEnabled).catch(() => {});
        window.dispatchEvent(new CustomEvent("movement-alerts-settings-changed", { detail: next }));
        return next;
      });
    },
    [user?.id, cloudSyncEnabled]
  );

  const value: MovementAlertsSettingsContextValue = { settings, saveSettings };

  return (
    <MovementAlertsSettingsContext.Provider value={value}>
      {children}
    </MovementAlertsSettingsContext.Provider>
  );
}

function getLocalSettings(): MovementAlertsSettings {
  if (typeof window === "undefined") return DEFAULT_MOVEMENT_ALERTS_SETTINGS;
  try {
    const raw = localStorage.getItem(MOVEMENT_ALERTS_SETTINGS_KEY);
    return raw ? mergeSettings(JSON.parse(raw)) : DEFAULT_MOVEMENT_ALERTS_SETTINGS;
  } catch {
    return DEFAULT_MOVEMENT_ALERTS_SETTINGS;
  }
}

export function useMovementAlertsSettings(): MovementAlertsSettingsContextValue {
  const ctx = useContext(MovementAlertsSettingsContext);
  const [localFallback, setLocalFallback] = useState(getLocalSettings);

  useEffect(() => {
    if (ctx) return;
    const handler = () => setLocalFallback(getLocalSettings());
    window.addEventListener("movement-alerts-settings-changed", handler);
    return () => window.removeEventListener("movement-alerts-settings-changed", handler);
  }, [ctx]);

  if (ctx) return ctx;
  return {
    settings: localFallback,
    saveSettings: (partial) => {
      const current = getLocalSettings();
      const next = {
        ...current,
        ...partial,
        types: {
          ...current.types,
          ...(partial.types || {}),
        },
      };
      try {
        localStorage.setItem(MOVEMENT_ALERTS_SETTINGS_KEY, JSON.stringify(next));
      } catch {}
      window.dispatchEvent(new CustomEvent("movement-alerts-settings-changed", { detail: next }));
      setLocalFallback(next);
    },
  };
}
