"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Settings2 } from "lucide-react";
import { useJournal } from "@/contexts/JournalContext";
import { DateRangeSelector } from "@/components/Journal/DateRangeSelector";
import { AddWidgetModal } from "@/components/Journal/Dashboard/AddWidgetModal";
import { WidgetGrid, type WidgetDisplayConfig } from "@/components/Journal/Dashboard/WidgetGrid";
import type { WidgetTimeframe } from "@/lib/journal/dashboard";
import { cn } from "@/lib/utils";

const DASHBOARD_WIDGETS_KEY = "journal_dashboard_widgets";
const DASHBOARD_WIDGET_CONFIGS_KEY = "journal_dashboard_widget_configs";
const DASHBOARD_GLOBAL_TIMEFRAME_KEY = "journal_dashboard_global_timeframe";

const DEFAULT_WIDGETS = [
  "pnl_cumulative",
  "win_rate",
  "pnl",
  "hold_time",
  "volume_cumulative",
  "total_trades",
  "biggest_loss",
  "biggest_profit",
];

export default function DashboardPage() {
  const { isLoading, preferences, setPreferences } = useJournal();

  const [mounted, setMounted] = useState(false);
  const [selectedWidgets, setSelectedWidgets] = useState<string[]>([]);
  const [widgetConfigs, setWidgetConfigs] = useState<Record<string, WidgetDisplayConfig>>({});
  const [globalTimeframe, setGlobalTimeframe] = useState<WidgetTimeframe>("month");
  const [isEditing, setIsEditing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    setMounted(true);

    try {
      const savedWidgets = localStorage.getItem(DASHBOARD_WIDGETS_KEY);
      const parsedWidgets = savedWidgets ? JSON.parse(savedWidgets) : DEFAULT_WIDGETS;
      setSelectedWidgets(Array.isArray(parsedWidgets) && parsedWidgets.length > 0 ? parsedWidgets : DEFAULT_WIDGETS);
    } catch {
      setSelectedWidgets(DEFAULT_WIDGETS);
    }

    try {
      const savedConfigs = localStorage.getItem(DASHBOARD_WIDGET_CONFIGS_KEY);
      const parsedConfigs = savedConfigs ? JSON.parse(savedConfigs) : {};
      if (parsedConfigs && typeof parsedConfigs === "object") {
        setWidgetConfigs(parsedConfigs as Record<string, WidgetDisplayConfig>);
      }
    } catch {
      setWidgetConfigs({});
    }

    try {
      const savedTimeframe = localStorage.getItem(DASHBOARD_GLOBAL_TIMEFRAME_KEY);
      if (savedTimeframe === "year" || savedTimeframe === "month" || savedTimeframe === "week" || savedTimeframe === "day") {
        setGlobalTimeframe(savedTimeframe);
      }
    } catch {
      setGlobalTimeframe("month");
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(DASHBOARD_WIDGETS_KEY, JSON.stringify(selectedWidgets));
  }, [mounted, selectedWidgets]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(DASHBOARD_WIDGET_CONFIGS_KEY, JSON.stringify(widgetConfigs));
  }, [mounted, widgetConfigs]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(DASHBOARD_GLOBAL_TIMEFRAME_KEY, globalTimeframe);
  }, [globalTimeframe, mounted]);

  const handleAddWidget = (widgetId: string) => {
    setSelectedWidgets((prev) => (prev.includes(widgetId) ? prev : [...prev, widgetId]));
    setWidgetConfigs((prev) => ({
      ...prev,
      [widgetId]: prev[widgetId] ?? { timeframe: globalTimeframe, sideFilter: "all" },
    }));
  };

  const handleRemoveWidget = (widgetId: string) => {
    setSelectedWidgets((prev) => prev.filter((id) => id !== widgetId));
    setWidgetConfigs((prev) => {
      const next = { ...prev };
      delete next[widgetId];
      return next;
    });
  };

  const handleMoveWidget = (widgetId: string, direction: "up" | "down") => {
    setSelectedWidgets((prev) => {
      const index = prev.indexOf(widgetId);
      if (index < 0) return prev;

      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;

      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleWidgetConfigChange = (widgetId: string, patch: Partial<WidgetDisplayConfig>) => {
    setWidgetConfigs((prev) => ({
      ...prev,
      [widgetId]: {
        timeframe: prev[widgetId]?.timeframe ?? globalTimeframe,
        sideFilter: prev[widgetId]?.sideFilter ?? "all",
        ...patch,
      },
    }));
  };

  if (isLoading || !mounted) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-4xl font-black text-white">Dashboard</h2>

        <div className="flex flex-wrap items-center gap-2">
          <DateRangeSelector />

          <label className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-zinc-700 bg-zinc-900/35">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">Widget's timeframe</span>
            <select
              value={globalTimeframe}
              onChange={(event) => setGlobalTimeframe(event.target.value as WidgetTimeframe)}
              className="bg-transparent text-xs text-zinc-300 outline-none"
            >
              <option value="year">Year</option>
              <option value="month">Month</option>
              <option value="week">Week</option>
              <option value="day">Day</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => setPreferences({ hideBalances: !preferences.hideBalances })}
            className="px-3 py-1.5 rounded-md border border-zinc-700 text-xs font-semibold text-zinc-400 hover:text-white"
          >
            Hide Balances
          </button>

          <button
            type="button"
            onClick={() => setIsEditing((prev) => !prev)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-semibold",
              isEditing
                ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-300"
                : "border-zinc-700 text-zinc-400 hover:text-white"
            )}
          >
            <Settings2 className="w-3.5 h-3.5" />
            Re-arrange widgets
          </button>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500 text-black text-xs font-semibold hover:bg-emerald-400"
          >
            <Plus className="w-3.5 h-3.5" />
            Add New Widget
          </button>

          <button
            type="button"
            onClick={() => setPreferences({ permanentFiltersEnabled: !preferences.permanentFiltersEnabled })}
            className={cn(
              "px-3 py-1.5 rounded-md border text-xs font-semibold",
              preferences.permanentFiltersEnabled
                ? "border-amber-500/40 text-amber-300 bg-amber-500/15"
                : "border-zinc-700 text-zinc-400 hover:text-white"
            )}
          >
            Permanent Filters
          </button>
        </div>
      </div>

      <WidgetGrid
        selectedWidgets={selectedWidgets}
        isEditing={isEditing}
        globalTimeframe={globalTimeframe}
        widgetConfigs={widgetConfigs}
        onChangeWidgetConfig={handleWidgetConfigChange}
        onRemoveWidget={handleRemoveWidget}
        onMoveWidget={handleMoveWidget}
      />

      <AddWidgetModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedWidgets={selectedWidgets}
        onAddWidget={handleAddWidget}
        onRemoveWidget={handleRemoveWidget}
      />
    </motion.div>
  );
}
