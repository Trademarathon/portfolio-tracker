"use client";

export const AI_RUNTIME_ENABLED_STORAGE_KEY = "ai_runtime_enabled";
export const AI_RUNTIME_CHANGED_EVENT = "ai-runtime-changed";
export const AI_RUNTIME_DISABLED_MESSAGE =
  "AI is paused from the sidebar toggle. Re-enable AI to resume insights.";

export function isAIRuntimeEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(AI_RUNTIME_ENABLED_STORAGE_KEY);
    if (raw === null) return false;
    if (raw === "0" || raw.toLowerCase() === "false") return false;
    return true;
  } catch {
    return false;
  }
}

export function setAIRuntimeEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AI_RUNTIME_ENABLED_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // ignore storage write failures
  }
  window.dispatchEvent(new Event(AI_RUNTIME_CHANGED_EVENT));
  window.dispatchEvent(new Event("ai-feature-toggles-changed"));
  window.dispatchEvent(new Event("settings-changed"));
}
