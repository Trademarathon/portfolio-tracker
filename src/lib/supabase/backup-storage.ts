/**
 * Supabase Storage helpers for backup export/import.
 * Bucket: "backups" (private). Path: {user_id}/backups/{filename}.
 * Create the bucket in Supabase Dashboard and add RLS policies so users can only access their own path.
 */

import { getSupabase } from "@/lib/supabase/client";

const BUCKET = "backups";

function backupPath(userId: string, filename: string): string {
  return `${userId}/backups/${filename}`;
}

export async function uploadBackup(
  userId: string,
  filename: string,
  body: string | Blob
): Promise<{ error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: new Error("Supabase not configured") };

  const path = backupPath(userId, filename);
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType: "application/json",
    upsert: true,
  });
  return { error: error ?? null };
}

export interface BackupFile {
  name: string;
  path: string;
  createdAt?: string;
}

export async function listBackups(userId: string): Promise<{ files: BackupFile[]; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { files: [], error: new Error("Supabase not configured") };

  const prefix = `${userId}/backups/`;
  const { data, error } = await supabase.storage.from(BUCKET).list(userId + "/backups", { limit: 100 });
  if (error) return { files: [], error };
  const files: BackupFile[] = (data ?? [])
    .filter((f) => f.name && !f.name.endsWith("/"))
    .map((f) => ({
      name: f.name,
      path: prefix + f.name,
      createdAt: f.created_at ?? undefined,
    }));
  return { files, error: null };
}

export async function downloadBackup(
  userId: string,
  filename: string
): Promise<{ data: string | null; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: new Error("Supabase not configured") };

  const path = backupPath(userId, filename);
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) return { data: null, error };
  if (!data) return { data: null, error: null };
  const text = await data.text();
  return { data: text, error: null };
}
