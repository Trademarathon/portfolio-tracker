"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Layout/Sidebar";
import MobileNav from "@/components/Layout/MobileNav";
import { GlobalChartDrawer } from "@/components/Dashboard/GlobalChartDrawer";
import { FirstTimeHint } from "@/components/Layout/FirstTimeHint";
import { ApiHealthBanner } from "@/components/ApiHealthBanner";
import { cn } from "@/lib/utils";

const STORAGE_KEYS = {
  hidden: "ui_sidebar_hidden",
  collapsed: "ui_sidebar_collapsed",
  autoHide: "ui_sidebar_autohide",
} as const;

const WIDTH_EXPANDED = 256;
const WIDTH_COLLAPSED = 72;

function readBool(key: string, fallback: boolean) {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return v === "true";
  } catch {
    return fallback;
  }
}

function writeBool(key: string, val: boolean) {
  try {
    localStorage.setItem(key, String(val));
  } catch {
    // ignore
  }
}

export default function SidebarLayout({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const isAuthRoute = pathname === "/login" || pathname.startsWith("/auth/");
  const pageSection = pathname.split("/")[1] || "root";

  const [hidden, setHidden] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [autoHide, setAutoHide] = useState(false);
  const [isHoveringSidebar, setIsHoveringSidebar] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  // Load persisted preferences
  useEffect(() => {
    setHidden(readBool(STORAGE_KEYS.hidden, false));
    setCollapsed(readBool(STORAGE_KEYS.collapsed, false));
    // Default auto-hide to ON for a cleaner workspace; user can toggle off.
    setAutoHide(readBool(STORAGE_KEYS.autoHide, true));
  }, []);

  // Track breakpoint (md and up)
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    const handle = () => setIsDesktop(mql.matches);
    handle();
    mql.addEventListener("change", handle);
    return () => mql.removeEventListener("change", handle);
  }, []);

  const effectiveCollapsed = useMemo(() => {
    if (hidden) return true;
    if (autoHide) return !isHoveringSidebar;
    return collapsed;
  }, [hidden, autoHide, isHoveringSidebar, collapsed]);

  const sidebarWidth = useMemo(() => {
    if (!isDesktop) return 0;
    if (hidden) return 0;
    return effectiveCollapsed ? WIDTH_COLLAPSED : WIDTH_EXPANDED;
  }, [isDesktop, hidden, effectiveCollapsed]);

  // Expose width as CSS variable for pages (e.g. terminal)
  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-width", `${sidebarWidth}px`);
    return () => {
      // keep last value
    };
  }, [sidebarWidth]);

  const setHiddenPersist = useCallback((v: boolean) => {
    setHidden(v);
    writeBool(STORAGE_KEYS.hidden, v);
    if (v) {
      setCollapsed(false);
      writeBool(STORAGE_KEYS.collapsed, false);
    }
  }, []);

  const setCollapsedPersist = useCallback((v: boolean) => {
    setCollapsed(v);
    writeBool(STORAGE_KEYS.collapsed, v);
    if (v) {
      setHidden(false);
      writeBool(STORAGE_KEYS.hidden, false);
    }
  }, []);

  const setAutoHidePersist = useCallback((v: boolean) => {
    setAutoHide(v);
    writeBool(STORAGE_KEYS.autoHide, v);
    if (v) {
      setHidden(false);
      writeBool(STORAGE_KEYS.hidden, false);
    }
  }, []);

  if (isAuthRoute) {
    return <div key="auth-layout" style={{ display: 'contents' }}>{children}</div>;
  }

  return (
    <div style={{ display: 'contents' }}>
      {/* Desktop sidebar */}
      <div
        key="sidebar-aside"
        className={cn("hidden md:flex fixed left-0 top-0 h-screen z-50", hidden && "pointer-events-none")}
        style={{
          width: sidebarWidth,
          transition: "width 240ms cubic-bezier(0.22,1,0.36,1)",
        }}
        onMouseEnter={() => setIsHoveringSidebar(true)}
        onMouseLeave={() => setIsHoveringSidebar(false)}
      >
        <Sidebar
          className="h-full"
          collapsed={effectiveCollapsed}
          hidden={hidden}
          autoHide={autoHide}
          onToggleHidden={() => setHiddenPersist(!hidden)}
          onToggleCollapsed={() => setCollapsedPersist(!collapsed)}
          onToggleAutoHide={() => setAutoHidePersist(!autoHide)}
          onOpen={() => setHiddenPersist(false)}
        />
      </div>

      {/* Re-open button when hidden (desktop) */}
      {isDesktop && hidden && (
        <button
          key="show-sidebar-btn"
          onClick={() => setHiddenPersist(false)}
          className="hidden md:flex fixed left-3 top-3 z-[60] px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-500/20 to-cyan-500/20 border border-indigo-400/35 text-indigo-100 text-[10px] font-black uppercase tracking-[0.18em] hover:from-indigo-500/30 hover:to-cyan-500/30 transition-all shadow-[0_8px_24px_rgba(56,189,248,0.22)]"
          title="Show sidebar"
        >
          Show sidebar
        </button>
      )}

      {/* Mobile */}
      <MobileNav key="mobile-nav" />

      {/* Main content */}
      <main
        key="main-content"
        data-page-section={pageSection}
        className={cn("pl-0 min-h-screen", className, "clone-divider")}
        style={{
          paddingLeft: sidebarWidth,
          transition: "padding-left 240ms cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <ApiHealthBanner key="api-health-banner" />
        {children}
      </main>

      <GlobalChartDrawer key="global-chart" />
      <FirstTimeHint key="first-time-hint" />
    </div >
  );
}
