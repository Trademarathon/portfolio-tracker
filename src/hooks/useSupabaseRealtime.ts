"use client";

import { useEffect } from "react";
import { getSupabase } from "@/lib/supabase/client";

const REALTIME_SYNC_UPDATE = "supabase-sync-update";

/** Dispatch this event when user_data row changes so contexts can refetch. */
export function dispatchRealtimeSyncUpdate(key: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(REALTIME_SYNC_UPDATE, { detail: { key } }));
}

export function useSupabaseRealtimeSyncUpdate(callback: (key: string) => void): void {
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail as { key?: string };
      if (d?.key) callback(d.key);
    };
    window.addEventListener(REALTIME_SYNC_UPDATE, handler);
    return () => window.removeEventListener(REALTIME_SYNC_UPDATE, handler);
  }, [callback]);
}

/**
 * Subscribe to Supabase Realtime postgres_changes on user_data for the given user.
 * When a row changes, dispatches supabase-sync-update so listeners can refetch that key.
 */
export function subscribeUserDataRealtime(userId: string): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};

  const channel = supabase
    .channel("user_data_sync")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "user_data",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const key = (payload.new as { key?: string })?.key ?? (payload.old as { key?: string })?.key;
        if (key) dispatchRealtimeSyncUpdate(key);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
