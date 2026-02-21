"use client";

import { useState, useEffect, useCallback } from "react";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { apiUrl } from "@/lib/api/client";
import {
  Loader2,
  AlertTriangle,
  Trash2,
  Bell,
  Pencil,
  Check,
  X,
  Users,
  Database,
  HardDrive,
  Link2,
  Copy,
  RefreshCw,
  Gift,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type StorageUser = {
  userId: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  supabaseRows: number;
  supabaseBytes: number;
  firebaseBytes: number;
  subscription: {
    plan: string | null;
    subscribed_at: string | null;
    start_date: string | null;
    end_date: string | null;
  } | null;
};

type StorageResponse = {
  users: StorageUser[];
  totalSupabaseBytes: number;
  totalFirebaseBytes: number;
};

function formatBytes(n: number): string {
  if (n === 0) return "0 B";
  const k = 1024;
  const i = Math.floor(Math.log(n) / Math.log(k));
  return `${(n / Math.pow(k, i)).toFixed(1)} ${["B", "KB", "MB", "GB"][i]}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { dateStyle: "short" });
  } catch {
    return "—";
  }
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

export function AdminTab() {
  const { session } = useSupabaseAuth();
  const [data, setData] = useState<StorageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deleteEmail, setDeleteEmail] = useState<string>("");
  const [deleting, setDeleting] = useState(false);
  const [notifyingUserId, setNotifyingUserId] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<StorageUser | null>(null);
  const [editPlan, setEditPlan] = useState("");
  const [editSubscribedAt, setEditSubscribedAt] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [savingSubscription, setSavingSubscription] = useState(false);

  // Referral: links from env, Bybit referred users list, grant modal
  const [referralLinks, setReferralLinks] = useState<{
    bybit: string | null;
    binance: string | null;
    hyperliquid: string | null;
    minVolume30dUsdt: number;
  } | null>(null);
  const [bybitUsers, setBybitUsers] = useState<
    { userId: string; registerTime?: string; tradeVol30Day?: string; tradeVol365Day?: string }[]
  >([]);
  const [bybitUsersLoading, setBybitUsersLoading] = useState(false);
  const [grantModal, setGrantModal] = useState<{
    bybitUid: string;
    tradeVol30Day: number;
    appUserInput: string;
    minVolumeOverride: string;
  } | null>(null);
  const [verifying, setVerifying] = useState(false);

  const fetchStorage = useCallback(async () => {
    const token = session?.access_token;
    if (!token) {
      setError("Not signed in");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/admin/storage"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        const rawMsg = j.error || `HTTP ${res.status}`;
        const details = j.details ? `: ${j.details}` : "";
        // Diagnose: if 5xx, check whether api-server is up and if Supabase is configured
        const healthRes = await fetch(apiUrl("/api/health")).catch(() => null);
        if (!healthRes?.ok) {
          setError(
            "API server not running. Start it in a separate terminal: npm run api-server (then click Retry)."
          );
        } else {
          const health = await healthRes.json().catch(() => ({}));
          if (!health.supabaseConfigured) {
            setError(
              "Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to the project root .env, then restart the api-server and Retry."
            );
          } else {
            setError(details ? `${rawMsg}${details}` : rawMsg);
          }
        }
        setData(null);
        return;
      }
      const json: StorageResponse = await res.json();
      setData(json);
    } catch (e) {
      // Network error: likely api-server not running
      const healthRes = await fetch(apiUrl("/api/health")).catch(() => null);
      if (!healthRes?.ok) {
        setError(
          "API server not running. Start it in a separate terminal: npm run api-server (then click Retry)."
        );
      } else {
        setError((e as Error).message);
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    fetchStorage();
  }, [fetchStorage]);

  useEffect(() => {
    const token = session?.access_token;
    if (!token) return;
    fetch(apiUrl("/api/admin/referral/links"), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((j) => j && setReferralLinks({
        bybit: j.bybit ?? null,
        binance: j.binance ?? null,
        hyperliquid: j.hyperliquid ?? null,
        minVolume30dUsdt: typeof j.minVolume30dUsdt === "number" ? j.minVolume30dUsdt : 500,
      }))
      .catch(() => {});
  }, [session?.access_token]);

  const fetchBybitUsers = useCallback(async () => {
    if (!session?.access_token) return;
    setBybitUsersLoading(true);
    try {
      const res = await fetch(apiUrl("/api/admin/referral/bybit-users"), {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const j = await res.json();
        setBybitUsers(j.users ?? []);
      } else {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `Bybit list: ${res.status}`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBybitUsersLoading(false);
    }
  }, [session?.access_token]);

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {}).catch(() => {});
  };

  const resolveAppUserId = (input: string): string | null => {
    const t = input.trim();
    if (!t) return null;
    if (t.includes("@")) {
      const u = data?.users.find((x) => x.email?.toLowerCase() === t.toLowerCase());
      return u?.userId ?? null;
    }
    return t;
  };

  const handleGrantAccess = async () => {
    if (!grantModal || !session?.access_token || !data) return;
    const appUserId = resolveAppUserId(grantModal.appUserInput);
    if (!appUserId) {
      setError("Enter a valid app user email or user ID");
      return;
    }
    const minVol = grantModal.minVolumeOverride.trim() ? parseInt(grantModal.minVolumeOverride, 10) : undefined;
    if (minVol !== undefined && (Number.isNaN(minVol) || minVol < 0)) {
      setError("Min volume must be a non-negative number");
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/admin/referral/verify"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          appUserId,
          bybitUid: grantModal.bybitUid,
          minVolume30dUsdt: minVol,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setGrantModal(null);
        await fetchStorage();
        if (bybitUsers.length) await fetchBybitUsers();
      } else {
        setError(j.error || `Verify failed: ${res.status}`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setVerifying(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteUserId || !session?.access_token) return;
    setDeleting(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/users/${deleteUserId}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        setDeleteUserId(null);
        setDeleteEmail("");
        await fetchStorage();
      } else {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `Delete failed: ${res.status}`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const handleNotifyStorageFull = async (userId: string) => {
    if (!session?.access_token) return;
    setNotifyingUserId(userId);
    try {
      const res = await fetch(apiUrl(`/api/admin/users/${userId}/notify-storage-full`), {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: "{}",
      });
      if (res.ok) {
        await fetchStorage();
      } else {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `Notify failed: ${res.status}`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setNotifyingUserId(null);
    }
  };

  const openEditSubscription = (u: StorageUser) => {
    setEditUser(u);
    setEditPlan(u.subscription?.plan ?? "");
    setEditSubscribedAt(u.subscription?.subscribed_at ? u.subscription.subscribed_at.slice(0, 16) : "");
    setEditStartDate(u.subscription?.start_date ?? "");
    setEditEndDate(u.subscription?.end_date ?? "");
  };

  const saveSubscription = async () => {
    if (!editUser || !session?.access_token) return;
    setSavingSubscription(true);
    try {
      const body: Record<string, string | null> = {
        plan: editPlan || null,
        subscribed_at: editSubscribedAt || null,
        start_date: editStartDate || null,
        end_date: editEndDate || null,
      };
      const res = await fetch(apiUrl(`/api/admin/users/${editUser.userId}/subscription`), {
        method: "PUT",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setEditUser(null);
        await fetchStorage();
      } else {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `Save failed: ${res.status}`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingSubscription(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-zinc-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading admin data…</span>
      </div>
    );
  }

  if (error) {
    const isNetworkError = /failed to fetch|network error|load failed|connection refused/i.test(error);
    const isServerError = /500|502|503|HTTP 5\d\d/i.test(error);
    const isSupabaseNotConfigured = /supabase not configured/i.test(error);
    const showEnvHint = isSupabaseNotConfigured || (isServerError && !isNetworkError);
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex flex-col gap-3 text-amber-200">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Error</p>
            <p className="text-sm text-zinc-400">{error}</p>
            {isNetworkError && (
              <p className="text-sm text-zinc-500 mt-2">
                Start the API server in a separate terminal: <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">npm run api-server</code> (listens on http://127.0.0.1:35821). Then click Retry.
              </p>
            )}
            {showEnvHint && (
              <p className="text-sm text-zinc-500 mt-2">
                Add <code className="bg-white/10 px-1 rounded text-xs">SUPABASE_URL</code> and <code className="bg-white/10 px-1 rounded text-xs">SUPABASE_SERVICE_ROLE_KEY</code> to the project root <code className="bg-white/10 px-1 rounded text-xs">.env</code> (same folder as <code className="bg-white/10 px-1 rounded text-xs">package.json</code>). Use the <strong>service role</strong> key from Supabase Dashboard → Project Settings → API (not the anon key). Restart the api-server, then Retry.
              </p>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStorage} className="self-start shrink-0">
          Retry
        </Button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/20">
            <Database className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider">Total Supabase</p>
            <p className="text-lg font-semibold text-white">{formatBytes(data.totalSupabaseBytes)}</p>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/20">
            <HardDrive className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider">Total Firebase</p>
            <p className="text-lg font-semibold text-white">{formatBytes(data.totalFirebaseBytes)}</p>
          </div>
        </div>
      </div>

      {/* Referral section */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
          <Link2 className="h-4 w-4 text-zinc-400" />
          <span className="text-sm font-medium text-white">Referral</span>
        </div>
        <div className="p-4 space-y-4">
          {referralLinks && (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500">Share these links. Min 30d volume to grant free access: <strong className="text-zinc-300">{referralLinks.minVolume30dUsdt} USDT</strong> (configurable via REFERRAL_MIN_VOLUME_30D_USDT).</p>
              <div className="flex flex-wrap gap-2">
                {referralLinks.bybit && (
                  <div className="flex items-center gap-1 rounded-lg bg-white/5 border border-white/10 px-2 py-1.5">
                    <span className="text-xs text-zinc-400">Bybit</span>
                    <button type="button" onClick={() => copyLink(referralLinks.bybit!)} className="p-1 rounded hover:bg-white/10" title="Copy">
                      <Copy className="h-3.5 w-3.5 text-zinc-400" />
                    </button>
                  </div>
                )}
                {referralLinks.binance && (
                  <div className="flex items-center gap-1 rounded-lg bg-white/5 border border-white/10 px-2 py-1.5">
                    <span className="text-xs text-zinc-400">Binance</span>
                    <button type="button" onClick={() => copyLink(referralLinks.binance!)} className="p-1 rounded hover:bg-white/10" title="Copy">
                      <Copy className="h-3.5 w-3.5 text-zinc-400" />
                    </button>
                  </div>
                )}
                {referralLinks.hyperliquid && (
                  <div className="flex items-center gap-1 rounded-lg bg-white/5 border border-white/10 px-2 py-1.5">
                    <span className="text-xs text-zinc-400">Hyperliquid</span>
                    <button type="button" onClick={() => copyLink(referralLinks.hyperliquid!)} className="p-1 rounded hover:bg-white/10" title="Copy">
                      <Copy className="h-3.5 w-3.5 text-zinc-400" />
                    </button>
                  </div>
                )}
                {!referralLinks.bybit && !referralLinks.binance && !referralLinks.hyperliquid && (
                  <p className="text-xs text-zinc-500">Set REFERRAL_LINK_BYBIT, REFERRAL_LINK_BINANCE, REFERRAL_LINK_HYPERLIQUID in api-server env to show links.</p>
                )}
              </div>
            </div>
          )}
          <p className="text-xs text-zinc-500">Binance and Hyperliquid: no referral volume API yet. Share the link; grant access manually via Edit subscription on the user row below.</p>
          <div>
            <Button variant="outline" size="sm" onClick={fetchBybitUsers} disabled={bybitUsersLoading} className="gap-2">
              {bybitUsersLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh Bybit referral list
            </Button>
            <p className="text-xs text-zinc-500 mt-1">Requires BYBIT_AFFILIATE_API_KEY and BYBIT_AFFILIATE_API_SECRET (Affiliate permission only).</p>
          </div>
          {bybitUsers.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-zinc-400 text-left">
                    <th className="px-3 py-2 font-medium">Bybit UID</th>
                    <th className="px-3 py-2 font-medium">Registered</th>
                    <th className="px-3 py-2 font-medium">Vol 30d (USDT)</th>
                    <th className="px-3 py-2 font-medium">Vol 365d (USDT)</th>
                    <th className="px-3 py-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bybitUsers.map((u) => {
                    const vol30 = parseFloat(u.tradeVol30Day ?? "0") || 0;
                    const minVol = referralLinks?.minVolume30dUsdt ?? 500;
                    const eligible = vol30 >= minVol;
                    return (
                      <tr key={u.userId} className="border-b border-white/5 hover:bg-white/5">
                        <td className="px-3 py-2 text-white font-mono text-xs">{u.userId}</td>
                        <td className="px-3 py-2 text-zinc-400">{u.registerTime ?? "—"}</td>
                        <td className="px-3 py-2 text-zinc-400">{vol30.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="px-3 py-2 text-zinc-400">{(parseFloat(u.tradeVol365Day ?? "0") || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-emerald-400 hover:bg-emerald-500/10 gap-1"
                            disabled={!eligible}
                            onClick={() => setGrantModal({
                              bybitUid: u.userId,
                              tradeVol30Day: vol30,
                              appUserInput: "",
                              minVolumeOverride: "",
                            })}
                            title={eligible ? "Grant referral free access to an app user" : `Need ${minVol} USDT 30d volume`}
                          >
                            <Gift className="h-3.5 w-3.5" />
                            Grant access
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Users table */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
          <Users className="h-4 w-4 text-zinc-400" />
          <span className="text-sm font-medium text-white">Users</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-zinc-400 text-left">
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Created</th>
                <th className="px-4 py-2.5 font-medium">Last sign-in</th>
                <th className="px-4 py-2.5 font-medium">Subscribed</th>
                <th className="px-4 py-2.5 font-medium">Start</th>
                <th className="px-4 py-2.5 font-medium">End</th>
                <th className="px-4 py-2.5 font-medium">Plan</th>
                <th className="px-4 py-2.5 font-medium">Supabase</th>
                <th className="px-4 py-2.5 font-medium">Firebase</th>
                <th className="px-4 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.userId} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-2.5 text-white">{u.email ?? "—"}</td>
                  <td className="px-4 py-2.5 text-zinc-400">{formatDateTime(u.created_at)}</td>
                  <td className="px-4 py-2.5 text-zinc-400">{formatDateTime(u.last_sign_in_at)}</td>
                  <td className="px-4 py-2.5 text-zinc-400">{formatDate(u.subscription?.subscribed_at ?? null)}</td>
                  <td className="px-4 py-2.5 text-zinc-400">{formatDate(u.subscription?.start_date ?? null)}</td>
                  <td className="px-4 py-2.5 text-zinc-400">{formatDate(u.subscription?.end_date ?? null)}</td>
                  <td className="px-4 py-2.5 text-zinc-400">{u.subscription?.plan ?? "—"}</td>
                  <td className="px-4 py-2.5 text-zinc-400">{formatBytes(u.supabaseBytes)}</td>
                  <td className="px-4 py-2.5 text-zinc-400">{formatBytes(u.firebaseBytes)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                        onClick={() => handleNotifyStorageFull(u.userId)}
                        disabled={notifyingUserId === u.userId}
                        title="Notify: data full"
                      >
                        {notifyingUserId === u.userId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10"
                        onClick={() => openEditSubscription(u)}
                        title="Edit subscription"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        onClick={() => {
                          setDeleteUserId(u.userId);
                          setDeleteEmail(u.email ?? u.userId);
                        }}
                        title="Delete user"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete confirmation */}
      <Dialog open={!!deleteUserId} onOpenChange={(open) => !open && setDeleteUserId(null)}>
        <DialogContent className="dark:border-white/10 dark:bg-zinc-900">
          <DialogHeader>
            <DialogTitle>Delete user</DialogTitle>
            <DialogDescription>
              Permanently delete this user? They will be removed from Auth, all their Supabase user_data and
              subscription will be deleted, and their Firebase backup files will be removed. This cannot be undone.
              <br />
              <span className="font-medium text-white mt-2 block">{deleteEmail}</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUserId(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit subscription modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setEditUser(null)}>
          <div
            className="rounded-xl border border-white/10 bg-zinc-900 p-6 w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white mb-4">Edit subscription</h3>
            <p className="text-sm text-zinc-400 mb-4">{editUser.email ?? editUser.userId}</p>
            <div className="space-y-3">
              <div>
                <Label className="text-zinc-400">Plan</Label>
                <Input
                  value={editPlan}
                  onChange={(e) => setEditPlan(e.target.value)}
                  placeholder="e.g. free, pro, annual"
                  className="mt-1 bg-white/5 border-white/10"
                />
              </div>
              <div>
                <Label className="text-zinc-400">Subscribed at (datetime)</Label>
                <Input
                  type="datetime-local"
                  value={editSubscribedAt}
                  onChange={(e) => setEditSubscribedAt(e.target.value)}
                  className="mt-1 bg-white/5 border-white/10"
                />
              </div>
              <div>
                <Label className="text-zinc-400">Start date</Label>
                <Input
                  type="date"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                  className="mt-1 bg-white/5 border-white/10"
                />
              </div>
              <div>
                <Label className="text-zinc-400">End date</Label>
                <Input
                  type="date"
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                  className="mt-1 bg-white/5 border-white/10"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setEditUser(null)}>
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
              <Button onClick={saveSubscription} disabled={savingSubscription}>
                {savingSubscription ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Grant referral access modal */}
      {grantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => !verifying && setGrantModal(null)}>
          <div
            className="rounded-xl border border-white/10 bg-zinc-900 p-6 w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white mb-4">Grant referral access</h3>
            <p className="text-sm text-zinc-400 mb-2">Bybit UID: <span className="font-mono text-white">{grantModal.bybitUid}</span></p>
            <p className="text-xs text-zinc-500 mb-4">30d volume: {grantModal.tradeVol30Day.toLocaleString()} USDT</p>
            <div className="space-y-3">
              <div>
                <Label className="text-zinc-400">App user (email or user ID)</Label>
                <Input
                  value={grantModal.appUserInput}
                  onChange={(e) => setGrantModal((m) => m ? { ...m, appUserInput: e.target.value } : null)}
                  placeholder="user@example.com or Supabase user UUID"
                  className="mt-1 bg-white/5 border-white/10"
                />
              </div>
              <div>
                <Label className="text-zinc-400">Min volume override (USDT, optional)</Label>
                <Input
                  type="number"
                  min={0}
                  value={grantModal.minVolumeOverride}
                  onChange={(e) => setGrantModal((m) => m ? { ...m, minVolumeOverride: e.target.value } : null)}
                  placeholder={`Default: ${referralLinks?.minVolume30dUsdt ?? 500}`}
                  className="mt-1 bg-white/5 border-white/10"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setGrantModal(null)} disabled={verifying}>
                Cancel
              </Button>
              <Button onClick={handleGrantAccess} disabled={verifying || !grantModal.appUserInput.trim()}>
                {verifying ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Gift className="h-4 w-4 mr-1" />}
                Grant access
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
