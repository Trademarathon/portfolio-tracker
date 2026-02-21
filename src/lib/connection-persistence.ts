/**
 * Persist portfolio_connections to app data directory so they survive reinstalls.
 * Uses Tauri fs plugin when running in desktop app; no-op in browser.
 */

const PERSIST_FILE = "portfolio_connections.json";
const LEGACY_PERSIST_FILE = "state/portfolio_connections.json";

/** Load persisted connections from disk and restore to localStorage. Call on app init. */
export async function loadPersistedConnections(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const { readTextFile, exists, BaseDirectory } = await import(
      "@tauri-apps/plugin-fs"
    );
    const candidates = [PERSIST_FILE, LEGACY_PERSIST_FILE];
    for (const file of candidates) {
      const fileExists = await exists(file, {
        baseDir: BaseDirectory.AppData,
      });
      if (!fileExists) continue;

      const content = await readTextFile(file, {
        baseDir: BaseDirectory.AppData,
      });
      if (!content || !content.trim()) continue;

      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        localStorage.setItem("portfolio_connections", JSON.stringify(parsed));
        window.dispatchEvent(new Event("connections-changed"));
        return;
      }
    }
  } catch {
    // Not in Tauri or fs unavailable - ignore
  }
}

/** Save connections to localStorage and persist to disk. Use instead of direct localStorage.setItem. */
export async function persistConnections(connections: unknown[]): Promise<void> {
  localStorage.setItem("portfolio_connections", JSON.stringify(connections));
  window.dispatchEvent(new Event("connections-changed"));
  try {
    const { writeTextFile, mkdir, BaseDirectory } = await import(
      "@tauri-apps/plugin-fs"
    );
    await mkdir("state", { baseDir: BaseDirectory.AppData, recursive: true });
    const serialized = JSON.stringify(connections ?? [], null, 0);
    await writeTextFile(
      PERSIST_FILE,
      serialized,
      { baseDir: BaseDirectory.AppData }
    );
    await writeTextFile(
      LEGACY_PERSIST_FILE,
      serialized,
      { baseDir: BaseDirectory.AppData }
    );
  } catch {
    // Ignore - local storage still has the data
  }
}
