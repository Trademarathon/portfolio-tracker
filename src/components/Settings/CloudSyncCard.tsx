"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { signOut } from "@/lib/supabase/auth";
import { Cloud, Mail, LogOut, Loader2 } from "lucide-react";
import { SignInForm } from "@/components/Auth/SignInForm";
import { isBuilder, clearBuilderLoginUserId } from "@/lib/user-cloud/config";
import {
  readSupabaseSyncScope,
  setSupabaseSyncScope,
  forceResyncAllLocalDetailed,
  type ResyncItemResult,
  type ResyncSummary,
  type ResyncReport,
  type SupabaseSyncScope,
} from "@/lib/supabase/sync";

export function CloudSyncCard() {
  const { user, isLoading, cloudSyncEnabled, setCloudSyncEnabled, clearSessionImmediate, cloudHealthStatus } = useSupabaseAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [syncScope, setSyncScope] = useState<SupabaseSyncScope>("alerts_ui");
  const [allowSensitiveSync, setAllowSensitiveSync] = useState(false);
  const [encryptSensitive, setEncryptSensitive] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [resyncing, setResyncing] = useState(false);
  const [resyncCount, setResyncCount] = useState<number | null>(null);
  const [resyncProgress, setResyncProgress] = useState<ResyncSummary | null>(null);
  const [resyncItems, setResyncItems] = useState<ResyncItemResult[]>([]);
  const [resyncReport, setResyncReport] = useState<ResyncReport | null>(null);
  const [resyncCurrentKey, setResyncCurrentKey] = useState<string | null>(null);
  const handleSignOut = async () => {
    setSigningOut(true);
    clearSessionImmediate();
    clearBuilderLoginUserId();
    await signOut();
    setSigningOut(false);
  };

  const builder = user ? isBuilder(user) : false;
  const modeLabel = "Hybrid (Supabase + Firebase backups)";
  const hasSupabaseEnv = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const fmt = (ts: number) => (ts > 0 ? new Date(ts).toLocaleString() : "Never");
  const progressPercent = resyncProgress?.total
    ? Math.min(100, Math.round((resyncProgress.done / resyncProgress.total) * 100))
    : 0;
  const formatDuration = (startedAt?: number, endedAt?: number) => {
    if (!startedAt || !endedAt) return "—";
    const ms = Math.max(0, endedAt - startedAt);
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  useEffect(() => {
    setSyncScope(readSupabaseSyncScope());
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as SupabaseSyncScope | undefined;
      if (detail === "alerts" || detail === "alerts_ui") setSyncScope(detail);
      if (detail === "full") setSyncScope(detail);
    };
    window.addEventListener("supabase-sync-scope-changed", handler as EventListener);
    return () => window.removeEventListener("supabase-sync-scope-changed", handler as EventListener);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("supabase_sync_allow_sensitive");
    setAllowSensitiveSync(raw === "1");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("supabase_sync_allow_sensitive", allowSensitiveSync ? "1" : "0");
  }, [allowSensitiveSync]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("supabase_sync_encrypt");
    setEncryptSensitive(raw === "1");
    const stored = sessionStorage.getItem("supabase_sync_passphrase") || "";
    setPassphrase(stored);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("supabase_sync_encrypt", encryptSensitive ? "1" : "0");
  }, [encryptSensitive]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (passphrase) sessionStorage.setItem("supabase_sync_passphrase", passphrase);
    else sessionStorage.removeItem("supabase_sync_passphrase");
  }, [passphrase]);

  useEffect(() => {
    if (syncScope === "full" && !allowSensitiveSync) {
      setSyncScope("alerts_ui");
      setSupabaseSyncScope("alerts_ui");
    }
  }, [allowSensitiveSync, syncScope]);

  const scopeOptions = useMemo(
    () => [
      {
        id: "alerts" as const,
        title: "Alerts only",
        desc: "Syncs alert presets, alert feed settings, and movement settings only (lowest usage).",
      },
      {
        id: "alerts_ui" as const,
        title: "Alerts + UI",
        desc: "Adds watchlist, sidebar state, dust filters, and appearance settings (recommended).",
      },
      {
        id: "full" as const,
        title: "Full sync (includes API keys)",
        desc: "Stores exchange keys, wallet connections, playbooks, journal data, and AI/social API keys.",
      },
    ],
    []
  );

  return (
    <Card className="bg-card/50 backdrop-blur-xl border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Cloud className="h-4 w-4 text-zinc-400" />
          Cloud sync
        </CardTitle>
        <CardDescription>
          Sign in to sync presets, settings, and alerts. You can enable full sync (including API keys and wallet connections) if desired.
        </CardDescription>
      </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="py-8 flex items-center justify-center gap-2 text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : user ? (
          <>
            <div className="p-4 border border-white/10 rounded-lg bg-white/[0.02] space-y-2">
              <h4 className="text-sm font-semibold text-zinc-200">Backend roles</h4>
              <p className="text-xs text-zinc-400">
                <span className="text-zinc-200">Supabase:</span> login (email/password, Google, Apple), session tokens, live user-data sync.
              </p>
              <p className="text-xs text-zinc-400">
                <span className="text-zinc-200">Firebase:</span> cloud backup files only (upload/list/download snapshots).
              </p>
            </div>

            <div className="flex items-center justify-between p-4 border border-emerald-500/20 bg-emerald-500/5 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Signed in</h3>
                  <p className="text-xs text-muted-foreground truncate max-w-[200px]" title={user.email ?? undefined}>
                    {user.email}
                  </p>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs font-medium disabled:opacity-50"
              >
                {signingOut ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
                Sign out
              </button>
            </div>

            {!builder && (
              <div className="space-y-2 p-4 border border-white/5 rounded-lg bg-white/[0.02]">
                <span className="text-sm font-medium text-zinc-300">Supabase sync</span>
                <p className="text-[10px] text-zinc-500">
                  Your login now powers cross-device memory for alert presets and key settings. Backups are still stored separately.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between p-4 border border-white/5 rounded-lg">
              <div>
                <label className="text-sm font-medium text-zinc-200">Sync data to cloud</label>
                <p className="text-xs text-muted-foreground">
                  When on, alert presets and key settings are synced to your account.
                  {syncScope === "full"
                    ? " Journal, playbook data, wallet connections, and API keys are also synced."
                    : " Journal and playbook data stay local."}
                  {builder && <span className="block mt-1 text-amber-400/90">Always on for admin account.</span>}
                </p>
              </div>
                <Switch
                  checked={cloudSyncEnabled}
                  onCheckedChange={setCloudSyncEnabled}
                  className="data-[state=checked]:bg-indigo-500"
                />
            </div>

            <div className="space-y-3 p-4 border border-white/5 rounded-lg bg-white/[0.02]">
              <div>
                <span className="text-sm font-medium text-zinc-200">Supabase sync scope</span>
                <p className="text-[11px] text-zinc-500">
                  Control which preferences are synced to keep free-tier usage predictable.
                </p>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2">
                <div>
                  <div className="text-xs font-semibold text-rose-200">Allow syncing API keys & wallet connections</div>
                  <div className="text-[10px] text-rose-300/80">
                    Secrets will be stored in Supabase as-is. Only enable if you accept this risk.
                  </div>
                </div>
                <Switch
                  checked={allowSensitiveSync}
                  onCheckedChange={setAllowSensitiveSync}
                  className="data-[state=checked]:bg-rose-500"
                  disabled={!cloudSyncEnabled}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-3 py-2">
                <div>
                  <div className="text-xs font-semibold text-indigo-200">Encrypt sensitive keys before sync</div>
                  <div className="text-[10px] text-indigo-300/80">
                    Uses a local passphrase (not stored in cloud). Required for decryption on new devices.
                  </div>
                </div>
                <Switch
                  checked={encryptSensitive}
                  onCheckedChange={setEncryptSensitive}
                  className="data-[state=checked]:bg-indigo-500"
                  disabled={!cloudSyncEnabled}
                />
              </div>
              {encryptSensitive && (
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">Encryption passphrase</label>
                  <input
                    type="password"
                    placeholder="Enter a passphrase (required to decrypt on new devices)"
                    className="w-full bg-black/40 border border-white/10 rounded p-3 text-white text-sm focus:border-primary/50 outline-none"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    disabled={!cloudSyncEnabled}
                  />
                  {!passphrase && (
                    <p className="text-[11px] text-amber-400">Passphrase is required to decrypt synced keys.</p>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {scopeOptions.map((opt) => {
                  const active = syncScope === opt.id;
                  const requiresSensitive = opt.id === "full";
                  const blocked = requiresSensitive && !allowSensitiveSync;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={!cloudSyncEnabled || blocked}
                      onClick={() => {
                        setSyncScope(opt.id);
                        setSupabaseSyncScope(opt.id);
                      }}
                      className={
                        "rounded-xl border px-4 py-3 text-left transition-colors disabled:opacity-60 " +
                        (active
                          ? "border-emerald-400/40 bg-emerald-500/10"
                          : "border-white/10 bg-white/[0.01] hover:bg-white/[0.04]")
                      }
                    >
                      <div className="text-sm font-semibold text-white">{opt.title}</div>
                      <div className="text-[11px] text-zinc-400 mt-1">{opt.desc}</div>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-zinc-500">
                Alerts-only mode is best for free tier if you want minimal storage usage. Alerts + UI keeps your layout consistent across devices.
              </p>
              {!cloudSyncEnabled && (
                <p className="text-[11px] text-amber-400">Enable cloud sync to change scope.</p>
              )}
              {syncScope === "full" && (
                <p className="text-[11px] text-rose-300">
                  Full sync stores API keys and wallet connection data in Supabase. Use only on trusted accounts.
                </p>
              )}
              {encryptSensitive && syncScope === "full" && !passphrase && (
                <p className="text-[11px] text-amber-400">
                  Encryption is enabled but passphrase is empty. Sensitive keys will not decrypt on this device.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  setResyncing(true);
                  setResyncCount(null);
                  setResyncProgress(null);
                  setResyncItems([]);
                  setResyncReport(null);
                  setResyncCurrentKey(null);
                  const report = await forceResyncAllLocalDetailed((item, summary) => {
                    setResyncCurrentKey(item.key);
                    setResyncProgress(summary);
                    setResyncItems((prev) => [item, ...prev].slice(0, 120));
                  });
                  setResyncReport(report);
                  setResyncCount(report.synced);
                  setResyncProgress({
                    total: report.total,
                    done: report.done,
                    synced: report.synced,
                    failed: report.failed,
                    skipped: report.skipped,
                    startedAt: report.startedAt,
                    endedAt: report.endedAt,
                  });
                  setResyncCurrentKey(null);
                  setResyncing(false);
                }}
                disabled={!cloudSyncEnabled || resyncing}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10 disabled:opacity-60"
              >
                {resyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cloud className="h-3.5 w-3.5" />}
                Resync now
              </button>
              {resyncCount != null && (
                <span className="text-[11px] text-zinc-400">Synced {resyncCount} keys.</span>
              )}
            </div>

            <div className="p-4 border border-white/10 rounded-lg bg-white/[0.02] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-zinc-200">Sync activity</div>
                  <div className="text-[11px] text-zinc-500">
                    Live key-by-key status for this device resync.
                  </div>
                </div>
                {resyncProgress && (
                  <div className="text-right">
                    <div className="text-xs font-semibold text-zinc-200">
                      {resyncProgress.done}/{resyncProgress.total} ({progressPercent}%)
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      {resyncProgress.synced} synced · {resyncProgress.failed} failed · {resyncProgress.skipped} skipped
                    </div>
                  </div>
                )}
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400/80 to-emerald-400/80 transition-all duration-200"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="text-[11px] text-zinc-400 min-h-[16px]">
                {resyncing && resyncCurrentKey ? `Syncing: ${resyncCurrentKey}` : resyncReport ? "Resync session complete." : "No resync session yet."}
              </div>
              <div className="max-h-56 overflow-auto rounded-md border border-white/5">
                {resyncItems.length === 0 ? (
                  <div className="p-3 text-[11px] text-zinc-500">Run `Resync now` to see per-key details.</div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {resyncItems.map((item, idx) => (
                      <div key={`${item.key}-${item.endedAt}-${idx}`} className="px-3 py-2 flex items-start gap-2 text-[11px]">
                        <span
                          className={
                            "mt-0.5 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase " +
                            (item.status === "synced"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : item.status === "failed"
                                ? "bg-rose-500/15 text-rose-300"
                                : "bg-amber-500/15 text-amber-300")
                          }
                        >
                          {item.status}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-zinc-200 truncate">{item.key}</div>
                          <div className="text-zinc-500">
                            {item.bytes} bytes · {formatDuration(item.startedAt, item.endedAt)}
                            {item.reason ? ` · ${item.reason}` : ""}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border border-white/5 rounded-lg bg-white/[0.02] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Mode</span>
                <span className="text-zinc-200">{modeLabel}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Supabase last sync</span>
                <span className="text-zinc-200">{fmt(cloudHealthStatus.supabaseLastSyncAt)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Pending cloud writes</span>
                <span className={cloudHealthStatus.pendingCloudWrites > 0 ? "text-amber-400" : "text-emerald-400"}>
                  {cloudHealthStatus.pendingCloudWrites}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Firebase last backup</span>
                <span className="text-zinc-200">{fmt(cloudHealthStatus.firebaseLastBackupAt)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Backup files</span>
                <span className="text-zinc-200">{cloudHealthStatus.firebaseBackupCount}</span>
              </div>
              {!hasSupabaseEnv && (
                <p className="text-[11px] text-amber-400">Supabase env keys missing. Cloud sync is unavailable.</p>
              )}
              {!cloudHealthStatus.firebaseBackupOk && (
                <p className="text-[11px] text-amber-400">Firebase backup endpoint currently unavailable. Local export still works.</p>
              )}
            </div>
          </>
        ) : (
          <SignInForm />
        )}
      </CardContent>
    </Card>
  );
}
