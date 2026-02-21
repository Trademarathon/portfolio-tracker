"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { getSession, onAuthStateChange } from "@/lib/supabase/auth";
import {
  setSyncAuth,
  getAllCloudValues,
  isSyncableKey,
  getCloudSyncLastSuccessAt,
  getCloudSyncQueueSize,
  forceResyncAllLocal,
  type SyncBackend,
} from "@/lib/supabase/sync";
import { getSupabase } from "@/lib/supabase/client";
import { subscribeUserDataRealtime } from "@/hooks/useSupabaseRealtime";
import { setBuilderLoginUserId, clearBuilderLoginUserId, consumeLoginAsBuilderFlag } from "@/lib/user-cloud/config";
import {
  DEFAULT_CLOUD_HEALTH_STATUS,
  type CloudHealthStatus,
} from "@/lib/types/cloud-health";
import {
  FIREBASE_BACKUP_COUNT_KEY,
  FIREBASE_BACKUP_LAST_SUCCESS_KEY,
  FIREBASE_BACKUP_OK_KEY,
} from "@/lib/api/backup-cloud";

const CLOUD_SYNC_ENABLED_KEY = "cloud_sync_enabled";
const ADMIN_STORAGE_FULL_KEY = "_admin_storage_full_notice";
const SESSION_CACHE_KEY = "portfolio_tracker_session_cache";
const AUTO_RESYNC_MIN_AGE_MS = 5 * 60 * 1000;

/** Read cached session from sessionStorage so we can show "logged in" immediately on refresh. */
function getCachedSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session> & { user?: Partial<User> };
    if (!parsed?.user?.id) return null;
    // Reconstruct minimal Session-like object for display; Supabase will validate on getSession().
    return {
      access_token: parsed.access_token ?? "",
      refresh_token: parsed.refresh_token ?? "",
      expires_at: parsed.expires_at ?? 0,
      expires_in: parsed.expires_in ?? 0,
      token_type: parsed.token_type ?? "bearer",
      user: parsed.user as User,
    };
  } catch {
    return null;
  }
}

function setCachedSession(session: Session | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!session) {
      sessionStorage.removeItem(SESSION_CACHE_KEY);
      return;
    }
    sessionStorage.setItem(
      SESSION_CACHE_KEY,
      JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        expires_in: session.expires_in,
        token_type: session.token_type,
        user: session.user,
      })
    );
  } catch {
    // ignore
  }
}

interface SupabaseAuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  cloudSyncEnabled: boolean;
  setCloudSyncEnabled: (enabled: boolean) => void;
  storageFullNotice: boolean;
  cloudHealthStatus: CloudHealthStatus;
  clearStorageFullNotice: () => Promise<void>;
  /** Clear session in UI immediately (e.g. before calling signOut() for instant logout). */
  clearSessionImmediate: () => void;
  forceResync: () => Promise<number>;
}

const SupabaseAuthContext = createContext<SupabaseAuthContextValue | null>(null);

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  // Keep SSR/client first render deterministic. Cache hydration happens in effect.
  const [session, setSessionState] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cloudSyncEnabled, setCloudSyncEnabledState] = useState(false);
  const [storageFullNotice, setStorageFullNotice] = useState(false);
  const [cloudHealthStatus, setCloudHealthStatus] = useState<CloudHealthStatus>(DEFAULT_CLOUD_HEALTH_STATUS);
  const receivedSessionFromListener = useRef(false);
  const lastResyncUserId = useRef<string | null>(null);

  /** Set session + user + cache in one place so refresh restores from cache. */
  const applySession = useCallback((s: Session | null) => {
    setSessionState(s);
    setUser(s?.user ?? null);
    setCachedSession(s);
  }, []);

  const setCloudSyncEnabled = useCallback((enabled: boolean) => {
    if (typeof window === "undefined") return;
    setCloudSyncEnabledState(enabled);
    localStorage.setItem(CLOUD_SYNC_ENABLED_KEY, enabled ? "1" : "0");
    window.dispatchEvent(new Event("cloud-sync-changed"));
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const cached = getCachedSession();
      if (cached?.user?.id) {
        applySession(cached);
      }
    }

    receivedSessionFromListener.current = false;
    let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let loadingTimeoutId: ReturnType<typeof setTimeout> | null = null;

    getSession()
      .then((result) => {
        const { data, error, sessionInvalidated } = result;
        if (sessionInvalidated) {
          setCachedSession(null);
          setSessionState(null);
          setUser(null);
          setIsLoading(false);
          return;
        }
        if (!error && data.session) {
          if (consumeLoginAsBuilderFlag()) setBuilderLoginUserId(data.session.user.id);
          applySession(data.session);
          setIsLoading(false);
          return;
        }
        if (error) {
          setIsLoading(false);
          return;
        }
        // No session and no error: retry once after 150ms (Supabase may not have rehydrated yet).
        retryTimeoutId = setTimeout(() => {
          getSession().then((retryResult) => {
            if (retryResult.sessionInvalidated) {
              setCachedSession(null);
              setSessionState(null);
              setUser(null);
              setIsLoading(false);
              return;
            }
            const { data: retryData, error: retryError } = retryResult;
            if (!retryError && retryData.session) {
              if (consumeLoginAsBuilderFlag()) setBuilderLoginUserId(retryData.session.user.id);
              applySession(retryData.session);
              setIsLoading(false);
              return;
            }
            loadingTimeoutId = setTimeout(() => setIsLoading(false), 400);
          });
        }, 150);
      })
      .catch(() => {
        setIsLoading(false);
      });

    const unsubscribe = onAuthStateChange((_event, session) => {
      if (session) {
        receivedSessionFromListener.current = true;
        if (consumeLoginAsBuilderFlag()) setBuilderLoginUserId(session.user.id);
        applySession(session);
      }
      else {
        applySession(null);
      }
      setIsLoading(false);
    });
    return () => {
      if (retryTimeoutId != null) clearTimeout(retryTimeoutId);
      if (loadingTimeoutId != null) clearTimeout(loadingTimeoutId);
      unsubscribe();
    };
  }, [applySession]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(CLOUD_SYNC_ENABLED_KEY);
    // Default ON for signed-in users unless explicitly disabled.
    setCloudSyncEnabledState(raw !== "0");
  }, []);

  const effectiveCloudSyncEnabled = cloudSyncEnabled;

  // Supabase-first sync for all users.
  const syncBackend: SyncBackend =
    user && effectiveCloudSyncEnabled ? "supabase" : "none";

  useEffect(() => {
    setSyncAuth(user?.id ?? null, effectiveCloudSyncEnabled, syncBackend);
  }, [user?.id, effectiveCloudSyncEnabled, syncBackend]);

  useEffect(() => {
    if (!user?.id || !effectiveCloudSyncEnabled || syncBackend !== "supabase") return;
    if (lastResyncUserId.current === user.id) return;
    lastResyncUserId.current = user.id;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;

    const runResync = () => {
      if (cancelled) return;
      const lastSuccessAt = getCloudSyncLastSuccessAt();
      if (lastSuccessAt > 0 && Date.now() - lastSuccessAt < AUTO_RESYNC_MIN_AGE_MS) {
        return;
      }
      void forceResyncAllLocal();
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = (window as unknown as {
        requestIdleCallback: (cb: () => void, options?: { timeout: number }) => number;
      }).requestIdleCallback(runResync, { timeout: 15000 });
    } else {
      timeoutId = setTimeout(runResync, 5000);
    }

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (idleId != null && typeof window !== "undefined" && "cancelIdleCallback" in window) {
        (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(idleId);
      }
    };
  }, [user?.id, effectiveCloudSyncEnabled, syncBackend]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const refreshCloudHealth = (event?: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>> | undefined)?.detail || {};
      const pending = Number(detail.pendingCloudWrites ?? getCloudSyncQueueSize());
      const supabaseAt = Number(detail.supabaseLastSyncAt ?? getCloudSyncLastSuccessAt());
      const firebaseOkRaw = detail.firebaseBackupOk ?? localStorage.getItem(FIREBASE_BACKUP_OK_KEY);
      const firebaseOk = firebaseOkRaw === true || firebaseOkRaw === "1";
      const firebaseLast = Number((detail.firebaseLastBackupAt ?? localStorage.getItem(FIREBASE_BACKUP_LAST_SUCCESS_KEY)) || 0);
      const firebaseCount = Number((detail.firebaseBackupCount ?? localStorage.getItem(FIREBASE_BACKUP_COUNT_KEY)) || 0);
      setCloudHealthStatus({
        supabaseSyncOk: pending === 0,
        supabaseLastSyncAt: supabaseAt,
        firebaseBackupOk: firebaseOk,
        firebaseLastBackupAt: firebaseLast,
        firebaseBackupCount: firebaseCount,
        pendingCloudWrites: pending,
      });
    };
    refreshCloudHealth();
    window.addEventListener("cloud-sync-health-changed", refreshCloudHealth as EventListener);
    return () => window.removeEventListener("cloud-sync-health-changed", refreshCloudHealth as EventListener);
  }, []);

  // Realtime: only when using Supabase backend
  useEffect(() => {
    if (!user?.id || !effectiveCloudSyncEnabled || syncBackend !== "supabase") return;
    return subscribeUserDataRealtime(user.id);
  }, [user?.id, effectiveCloudSyncEnabled, syncBackend]);

  // Hydrate localStorage from cloud when sync is on.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!user?.id || !effectiveCloudSyncEnabled || syncBackend === "none") return;
    let cancelled = false;
    const isKeySyncable = isSyncableKey;
    const nativeSetItem = Storage.prototype.setItem;

    getAllCloudValues(user.id, syncBackend).then((record) => {
      if (cancelled) return;
      for (const [key, value] of Object.entries(record)) {
        if (isKeySyncable(key)) {
          try {
            const current = localStorage.getItem(key);
            if (current !== value) {
              // Always write via native setter to avoid any external localStorage wrappers.
              nativeSetItem.call(localStorage, key, value);
            }
          } catch {}
        }
      }
      if (syncBackend === "supabase" && record[ADMIN_STORAGE_FULL_KEY] !== undefined) {
        const val = record[ADMIN_STORAGE_FULL_KEY] as string | boolean | undefined;
        const on = val === "true" || val === true;
        setStorageFullNotice(!!on);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, effectiveCloudSyncEnabled, syncBackend]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!user?.id || !effectiveCloudSyncEnabled || syncBackend !== "supabase") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handler = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void forceResyncAllLocal();
      }, 250);
    };
    window.addEventListener("supabase-sync-scope-changed", handler as EventListener);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("supabase-sync-scope-changed", handler as EventListener);
    };
  }, [user?.id, effectiveCloudSyncEnabled, syncBackend]);

  // Periodic background sync (lightweight) to capture localStorage writes from modules
  // that don't directly call setValueWithCloud, without monkey-patching localStorage APIs.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!user?.id || !effectiveCloudSyncEnabled || syncBackend !== "supabase") return;

    const syncIfVisible = () => {
      if (document.visibilityState !== "visible") return;
      void forceResyncAllLocal();
    };

    const timer = setInterval(syncIfVisible, 60_000);
    window.addEventListener("focus", syncIfVisible);
    document.addEventListener("visibilitychange", syncIfVisible);

    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", syncIfVisible);
      document.removeEventListener("visibilitychange", syncIfVisible);
    };
  }, [user?.id, effectiveCloudSyncEnabled, syncBackend]);

  // Admin "data full" notice: fetch from Supabase when user is signed in (RLS allows own row).
  useEffect(() => {
    if (!user?.id || typeof window === "undefined") {
      setStorageFullNotice(false);
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setStorageFullNotice(false);
      return;
    }
    let cancelled = false;
    void Promise.resolve(
      supabase
        .from("user_data")
        .select("payload")
        .eq("user_id", user.id)
        .eq("key", ADMIN_STORAGE_FULL_KEY)
        .maybeSingle()
    ).then(({ data }) => {
      if (cancelled) return;
      const payload = data?.payload;
      const on = payload === true || payload === "true";
      setStorageFullNotice(!!on);
    }).catch(() => {
      if (!cancelled) setStorageFullNotice(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const clearStorageFullNotice = useCallback(async () => {
    if (!user?.id) return;
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.from("user_data").delete().eq("user_id", user.id).eq("key", ADMIN_STORAGE_FULL_KEY);
    setStorageFullNotice(false);
  }, [user?.id]);

  const clearSessionImmediate = useCallback(() => {
    clearBuilderLoginUserId();
    setCachedSession(null);
    setSessionState(null);
    setUser(null);
  }, []);

  const value: SupabaseAuthContextValue = {
    user,
    session,
    isLoading,
    cloudSyncEnabled: effectiveCloudSyncEnabled,
    setCloudSyncEnabled,
    storageFullNotice,
    cloudHealthStatus,
    clearStorageFullNotice,
    clearSessionImmediate,
    forceResync: forceResyncAllLocal,
  };

  return (
    <SupabaseAuthContext.Provider value={value}>
      {children}
    </SupabaseAuthContext.Provider>
  );
}

export function useSupabaseAuth(): SupabaseAuthContextValue {
  const ctx = useContext(SupabaseAuthContext);
  if (!ctx) {
    return {
      user: null,
      session: null,
      isLoading: false,
      cloudSyncEnabled: false,
      setCloudSyncEnabled: () => {},
      storageFullNotice: false,
      cloudHealthStatus: DEFAULT_CLOUD_HEALTH_STATUS,
      clearStorageFullNotice: async () => {},
      clearSessionImmediate: () => {},
      forceResync: async () => 0,
    };
  }
  return ctx;
}
