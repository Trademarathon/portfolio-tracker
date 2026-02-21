import { getValueWithCloud, setValueWithCloud } from "@/lib/supabase/sync";

export type MemoryScope = "ai" | "alerts";

export type MemoryEntry = {
  id: string;
  dismissedAt?: number;
  cooldownUntil?: number;
  reason?: "dismissed" | "cooldown" | "auto";
  type?: string;
  symbol?: string;
};

export type MemoryStore = {
  version: 1;
  updatedAt: number;
  dismissed: Record<string, MemoryEntry>;
  cooldowns: Record<string, MemoryEntry>;
  lastSeen: {
    aiFeed?: number;
    alerts?: number;
    futures?: number;
  };
};

export const AI_FEED_MEMORY_KEY = "ai_feed_memory_v1";
export const ALERTS_MEMORY_KEY = "alerts_memory_v1";

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const LEGACY_DISMISSED_IDS_KEY = "ai_feed_dismissed_ids";
const LEGACY_LAST_SEEN_KEY = "ai_feed_last_seen_timestamp";

function storageKey(scope: MemoryScope): string {
  return scope === "ai" ? AI_FEED_MEMORY_KEY : ALERTS_MEMORY_KEY;
}

function emptyMemory(): MemoryStore {
  return {
    version: 1,
    updatedAt: Date.now(),
    dismissed: {},
    cooldowns: {},
    lastSeen: {},
  };
}

function safeParse(raw: string | null): MemoryStore | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as MemoryStore;
    if (!parsed || parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

function readLocal(scope: MemoryScope): MemoryStore | null {
  if (typeof window === "undefined") return null;
  return safeParse(localStorage.getItem(storageKey(scope)));
}

function writeLocal(scope: MemoryScope, memory: MemoryStore): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(scope), JSON.stringify(memory));
  } catch {
    // ignore
  }
}

function migrateLegacyAI(memory: MemoryStore): MemoryStore {
  if (typeof window === "undefined") return memory;
  try {
    const rawDismissed = localStorage.getItem(LEGACY_DISMISSED_IDS_KEY);
    const rawSeen = localStorage.getItem(LEGACY_LAST_SEEN_KEY);
    const dismissed = rawDismissed ? JSON.parse(rawDismissed) : [];
    if (Array.isArray(dismissed)) {
      dismissed.forEach((id: string) => {
        if (!memory.dismissed[id]) {
          memory.dismissed[id] = { id, dismissedAt: Date.now(), reason: "dismissed" };
        }
      });
    }
    if (rawSeen) {
      const ts = parseInt(rawSeen, 10);
      if (Number.isFinite(ts)) memory.lastSeen.aiFeed = ts;
    }
  } catch {
    // ignore
  }
  return memory;
}

export function cleanupMemory(memory: MemoryStore, now = Date.now()): MemoryStore {
  const cutoff = now - RETENTION_MS;
  const next: MemoryStore = {
    ...memory,
    dismissed: { ...memory.dismissed },
    cooldowns: { ...memory.cooldowns },
    updatedAt: now,
  };
  Object.keys(next.dismissed).forEach((id) => {
    const entry = next.dismissed[id];
    if (entry?.dismissedAt && entry.dismissedAt < cutoff) delete next.dismissed[id];
  });
  Object.keys(next.cooldowns).forEach((id) => {
    const entry = next.cooldowns[id];
    if (entry?.cooldownUntil && entry.cooldownUntil < cutoff) delete next.cooldowns[id];
  });
  return next;
}

export function isSuppressed(memory: MemoryStore | null, id: string, now = Date.now()): boolean {
  if (!memory) return false;
  const dismissed = memory.dismissed[id];
  if (dismissed?.dismissedAt && now - dismissed.dismissedAt < RETENTION_MS) return true;
  const cooldown = memory.cooldowns[id];
  if (cooldown?.cooldownUntil && cooldown.cooldownUntil > now) return true;
  return false;
}

export async function loadMemory(scope: MemoryScope, userId: string | null, cloudSyncEnabled: boolean): Promise<MemoryStore> {
  const local = readLocal(scope);
  const cloudRaw = await getValueWithCloud(storageKey(scope), userId, cloudSyncEnabled);
  const cloud = safeParse(cloudRaw);
  let memory = local || cloud || emptyMemory();
  if (cloud && (!local || cloud.updatedAt > local.updatedAt)) memory = cloud;
  if (scope === "ai") memory = migrateLegacyAI(memory);
  memory = cleanupMemory(memory);
  writeLocal(scope, memory);
  return memory;
}

export async function saveMemory(scope: MemoryScope, memory: MemoryStore, userId: string | null, cloudSyncEnabled: boolean): Promise<void> {
  const next = cleanupMemory({ ...memory, updatedAt: Date.now() });
  writeLocal(scope, next);
  await setValueWithCloud(storageKey(scope), JSON.stringify(next), userId, cloudSyncEnabled);
}

export function addDismissed(memory: MemoryStore, entry: MemoryEntry): MemoryStore {
  const now = Date.now();
  return {
    ...memory,
    updatedAt: now,
    dismissed: {
      ...memory.dismissed,
      [entry.id]: { ...entry, dismissedAt: entry.dismissedAt ?? now, reason: entry.reason ?? "dismissed" },
    },
  };
}

export function setCooldown(memory: MemoryStore, entry: MemoryEntry, cooldownMs: number): MemoryStore {
  const now = Date.now();
  return {
    ...memory,
    updatedAt: now,
    cooldowns: {
      ...memory.cooldowns,
      [entry.id]: {
        ...entry,
        cooldownUntil: now + cooldownMs,
        reason: entry.reason ?? "cooldown",
      },
    },
  };
}

export function markLastSeen(memory: MemoryStore, key: keyof MemoryStore["lastSeen"], ts = Date.now()): MemoryStore {
  return {
    ...memory,
    updatedAt: Date.now(),
    lastSeen: {
      ...memory.lastSeen,
      [key]: ts,
    },
  };
}
