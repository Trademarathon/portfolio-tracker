"use client";

import { useEffect } from "react";
import {
  loadAppearanceSettings,
  applyAppearanceSettings,
} from "@/lib/appearance-settings";

/**
 * Applies appearance settings from localStorage on mount and when storage changes (e.g. from Settings).
 */
export function AppearanceSync() {
  useEffect(() => {
    const settings = loadAppearanceSettings();
    applyAppearanceSettings(settings);
  }, []);
  return null;
}
