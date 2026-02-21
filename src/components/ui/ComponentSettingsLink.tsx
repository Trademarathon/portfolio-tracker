"use client";

import Link from "next/link";
import { Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type SettingsTab =
  | "general"
  | "connections"
  | "journal"
  | "alerts"
  | "security"
  | "preferences"
  | "appearance"
  | "indian_markets"
  | "data"
  | "debug";

interface ComponentSettingsLinkProps {
  /** Settings tab to open (e.g. "terminal" for chart/terminal settings) */
  tab: SettingsTab;
  /** Tooltip / aria label */
  title?: string;
  /** Optional class for the wrapper (e.g. positioning) */
  className?: string;
  /** Show on hover only (parent should have group class). Default false so icon is always visible in corner. */
  showOnHover?: boolean;
  /** Position in corner: adds absolute positioning so the icon sits in the component corner. */
  corner?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  /** Smaller icon for tight UIs */
  size?: "sm" | "xs";
}

const TAB_LABELS: Record<SettingsTab, string> = {
  general: "General settings",
  connections: "Connection settings",
  journal: "Journal settings",
  alerts: "Alert settings",
  security: "Security settings",
  preferences: "Preferences",
  appearance: "Appearance settings",
  indian_markets: "Indian Markets settings",
  data: "Data settings",
  debug: "Debug",
};

const CORNER_CLASS = {
  "top-right": "absolute top-2 right-2 z-[40]",
  "top-left": "absolute top-2 left-2 z-[40]",
  "bottom-right": "absolute bottom-2 right-2 z-[40]",
  "bottom-left": "absolute bottom-2 left-2 z-[40]",
};

export function ComponentSettingsLink({
  tab,
  title,
  className,
  showOnHover = false,
  corner,
  size = "sm",
}: ComponentSettingsLinkProps) {
  const label = title ?? TAB_LABELS[tab];
  return (
    <Link
      href={`/settings?tab=${tab}`}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex items-center justify-center rounded-lg border border-white/10 bg-black/40 text-zinc-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all shrink-0",
        size === "sm" && "w-7 h-7",
        size === "xs" && "w-6 h-6",
        showOnHover && "opacity-0 group-hover:opacity-100",
        corner && CORNER_CLASS[corner],
        className
      )}
    >
      <Settings2 className={size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5"} />
    </Link>
  );
}
