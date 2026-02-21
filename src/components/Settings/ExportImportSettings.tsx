"use client";

import { useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Upload, Database, AlertTriangle, Cloud, CloudDownload, Loader2, Trash2 } from "lucide-react";
import {
  exportProjectDatabase,
  importProjectDatabase,
  triggerPostImportRefresh,
} from "@/lib/export-import";
import { useNotifications } from "@/components/Notifications/NotificationSystem";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import {
  uploadBackup,
  listBackups,
  downloadBackup,
  deleteBackup,
  createVersionedBackupFilename,
  type BackupFile,
} from "@/lib/api/backup-cloud";

export function ExportImportSettings() {
  const { notify } = useNotifications();
  const { user } = useSupabaseAuth();
  const [includeSensitive, setIncludeSensitive] = useState(false);
  const [mergeOnImport, setMergeOnImport] = useState(false);
  const [overwriteSensitiveOnImport, setOverwriteSensitiveOnImport] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSavingToCloud, setIsSavingToCloud] = useState(false);
  const [cloudBackups, setCloudBackups] = useState<BackupFile[]>([]);
  const [loadingCloudList, setLoadingCloudList] = useState(false);
  const [loadingCloudImport, setLoadingCloudImport] = useState(false);
  const [loadingFilename, setLoadingFilename] = useState<string | null>(null);
  const [deletingFilename, setDeletingFilename] = useState<string | null>(null);

  const handleExport = () => {
    try {
      const data = exportProjectDatabase({ includeSensitive });
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trade-marathon-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      notify({
        type: "success",
        title: "Export Complete",
        message: "Your data has been exported successfully.",
        duration: 3000,
      });
    } catch (e) {
      notify({
        type: "error",
        title: "Export Failed",
        message: e instanceof Error ? e.message : "Unknown error",
        duration: 3000,
      });
    }
  };

  const handleSaveToCloud = useCallback(async () => {
    if (!user?.id) return;
    setIsSavingToCloud(true);
    try {
      const data = exportProjectDatabase({ includeSensitive });
      const filename = createVersionedBackupFilename(1);
      const { error } = await uploadBackup(user.id, filename, JSON.stringify(data, null, 2));
      if (error) throw error;
      notify({
        type: "success",
        title: "Saved to cloud",
        message: `Backup saved as ${filename}.`,
        duration: 3000,
      });
    } catch (e) {
      notify({
        type: "error",
        title: "Save to cloud failed",
        message: e instanceof Error ? e.message : "Unknown error",
        duration: 3000,
      });
    } finally {
      setIsSavingToCloud(false);
    }
  }, [user?.id, includeSensitive, notify]);

  const loadCloudBackups = useCallback(async () => {
    if (!user?.id) return;
    setLoadingCloudList(true);
    try {
      const { files, error } = await listBackups(user.id);
      if (error) throw error;
      setCloudBackups(files);
    } catch (e) {
      notify({
        type: "error",
        title: "Load list failed",
        message: e instanceof Error ? e.message : "Unknown error",
        duration: 3000,
      });
    } finally {
      setLoadingCloudList(false);
    }
  }, [user?.id, notify]);

  const handleDeleteFromCloud = useCallback(
    async (filename: string) => {
      if (!user?.id) return;
      setDeletingFilename(filename);
      try {
        const { error } = await deleteBackup(user.id, filename);
        if (error) throw error;
        notify({ type: "success", title: "Deleted", message: `Removed ${filename} from cloud.`, duration: 3000 });
        await loadCloudBackups();
      } catch (e) {
        notify({
          type: "error",
          title: "Delete failed",
          message: e instanceof Error ? e.message : "Unknown error",
          duration: 3000,
        });
      } finally {
        setDeletingFilename(null);
      }
    },
    [user?.id, loadCloudBackups, notify]
  );

  const handleLoadFromCloud = useCallback(
    async (filename: string) => {
      if (!user?.id) return;
      setLoadingCloudImport(true);
      setLoadingFilename(filename);
      try {
        const { data, error } = await downloadBackup(user.id, filename);
        if (error) throw error;
        if (!data) throw new Error("Empty backup file");
        const parsed = JSON.parse(data);
        if (typeof parsed.version !== "number" || !parsed.keys || typeof parsed.keys !== "object") {
          throw new Error("Invalid backup file format.");
        }
        const { imported, skipped } = importProjectDatabase(parsed, {
          merge: mergeOnImport,
          overwriteSensitive: overwriteSensitiveOnImport,
        });
        triggerPostImportRefresh();
        notify({
          type: "success",
          title: "Import from cloud complete",
          message: `Imported ${imported} items. ${skipped > 0 ? `Skipped ${skipped}.` : ""} Reload to apply.`,
          duration: 4000,
        });
        setTimeout(() => window.location.reload(), 1500);
      } catch (e) {
        notify({
          type: "error",
          title: "Import from cloud failed",
          message: e instanceof Error ? e.message : "Unknown error",
          duration: 4000,
        });
      } finally {
        setLoadingCloudImport(false);
        setLoadingFilename(null);
      }
    },
    [user?.id, mergeOnImport, overwriteSensitiveOnImport, notify]
  );

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const data = JSON.parse(text);

        if (typeof data.version !== "number" || !data.keys || typeof data.keys !== "object") {
          throw new Error("Invalid backup file format. Expected version and keys.");
        }

        const { imported, skipped } = importProjectDatabase(data, {
          merge: mergeOnImport,
          overwriteSensitive: overwriteSensitiveOnImport,
        });

        triggerPostImportRefresh();

        notify({
          type: "success",
          title: "Import Complete",
          message: `Imported ${imported} items. ${skipped > 0 ? `Skipped ${skipped} (existing or protected).` : ""} Reload to apply changes.`,
          duration: 4000,
        });

        setTimeout(() => window.location.reload(), 1500);
      } catch (err) {
        notify({
          type: "error",
          title: "Import Failed",
          message: err instanceof Error ? err.message : "Invalid file",
          duration: 4000,
        });
      } finally {
        setIsImporting(false);
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  return (
    <Card className="bg-card/50 backdrop-blur-xl border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Database className="h-4 w-4 text-zinc-400" />
          Export & Import
        </CardTitle>
        <CardDescription>
          Backup or restore your entire project: journal, wallet addresses, terminal/screener presets, settings, alerts, playbooks, and config.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-200/90">
            <strong>Export includes:</strong> Journal trades & annotations, wallet addresses & connections, terminal widgets & chart presets, screener watchlist, alerts, playbooks, sessions, spot/perp plans, and all settings.
          </div>
        </div>

        {/* Export */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-white">Export</h4>
          <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={includeSensitive}
              onChange={(e) => setIncludeSensitive(e.target.checked)}
              className="rounded border-white/20"
            />
            Include API keys & secrets (connections, AI providers, Indian Markets)
          </label>
          <Button
            onClick={handleExport}
            variant="outline"
            className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Full Backup
          </Button>
        </div>

        {/* Import */}
        <div className="space-y-3 pt-4 border-t border-white/5">
          <h4 className="text-sm font-bold text-white">Import</h4>
          <p className="text-xs text-zinc-500">Import will replace existing data. Use merge to skip items that already exist.</p>
          <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={mergeOnImport}
              onChange={(e) => setMergeOnImport(e.target.checked)}
              className="rounded border-white/20"
            />
            Merge (skip keys that already have data)
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={overwriteSensitiveOnImport}
              onChange={(e) => setOverwriteSensitiveOnImport(e.target.checked)}
              className="rounded border-white/20"
            />
            Overwrite API keys & secrets if present in backup
          </label>
          <div>
            <input
              id="import-backup-input"
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImport}
              disabled={isImporting}
            />
            <Button
              variant="outline"
              className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
              onClick={() => document.getElementById("import-backup-input")?.click()}
              disabled={isImporting}
            >
              <Upload className="h-4 w-4 mr-2" />
              {isImporting ? "Importing…" : "Import Backup"}
            </Button>
          </div>
        </div>

        {/* Cloud backup (when signed in) */}
        {user && (
          <div className="space-y-3 pt-4 border-t border-white/5">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Cloud className="h-4 w-4 text-sky-400" />
              Cloud backup
            </h4>
            <p className="text-xs text-zinc-500">
              Save a backup to the cloud (Firebase Storage via api-server) or load one. Requires api-server running with Firebase configured.
            </p>
            <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 text-xs text-zinc-400">
              <strong className="text-sky-300">When cloud space is limited:</strong> Delete old backups below to free space. You can also do a <strong>full database export</strong> to your computer (Export Full Backup above) and <strong>import</strong> later (Import Backup)—no cloud needed.
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="border-sky-500/30 text-sky-400 hover:bg-sky-500/10"
                onClick={handleSaveToCloud}
                disabled={isSavingToCloud}
              >
                {isSavingToCloud ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Cloud className="h-4 w-4 mr-2" />}
                Save to cloud
              </Button>
              <Button
                variant="outline"
                className="border-sky-500/30 text-sky-400 hover:bg-sky-500/10"
                onClick={loadCloudBackups}
                disabled={loadingCloudList}
              >
                {loadingCloudList ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CloudDownload className="h-4 w-4 mr-2" />}
                List cloud backups
              </Button>
            </div>
            {cloudBackups.length > 0 && (
              <ul className="space-y-1 text-sm">
                {cloudBackups.map((f) => (
                  <li key={f.name} className="flex items-center justify-between gap-2 py-1">
                    <span className="text-zinc-400 truncate">{f.name}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-sky-400 hover:bg-sky-500/10"
                        onClick={() => handleLoadFromCloud(f.name)}
                        disabled={loadingCloudImport}
                      >
                        {loadingFilename === f.name ? "Loading…" : "Load"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:bg-red-500/10"
                        onClick={() => handleDeleteFromCloud(f.name)}
                        disabled={!!deletingFilename}
                        title="Delete from cloud"
                      >
                        {deletingFilename === f.name ? "…" : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
