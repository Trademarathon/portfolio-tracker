"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useJournal } from "@/contexts/JournalContext";
import { WidgetGrid } from "@/components/Journal/Dashboard/WidgetGrid";
import { AddWidgetModal } from "@/components/Journal/Dashboard/AddWidgetModal";
import { Plus, Settings, LayoutGrid } from "lucide-react";

const DASHBOARD_WIDGETS_KEY = 'journal_dashboard_widgets';

// Default widgets for new users
const DEFAULT_WIDGETS = ['pnl_cumulative', 'win_rate', 'total_trades', 'hold_time', 'profit_factor', 'biggest_profit'];

export default function DashboardPage() {
    const { isLoading } = useJournal();
    const [selectedWidgets, setSelectedWidgets] = useState<string[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [mounted, setMounted] = useState(false);

    // Load widgets from localStorage
    useEffect(() => {
        setMounted(true);
        const saved = localStorage.getItem(DASHBOARD_WIDGETS_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setSelectedWidgets(Array.isArray(parsed) ? parsed : DEFAULT_WIDGETS);
            } catch {
                setSelectedWidgets(DEFAULT_WIDGETS);
            }
        } else {
            setSelectedWidgets(DEFAULT_WIDGETS);
        }
    }, []);

    // Save widgets to localStorage
    useEffect(() => {
        if (mounted && selectedWidgets.length > 0) {
            localStorage.setItem(DASHBOARD_WIDGETS_KEY, JSON.stringify(selectedWidgets));
        }
    }, [selectedWidgets, mounted]);

    const handleAddWidget = (widgetId: string) => {
        if (!selectedWidgets.includes(widgetId)) {
            setSelectedWidgets([...selectedWidgets, widgetId]);
        }
    };

    const handleRemoveWidget = (widgetId: string) => {
        setSelectedWidgets(selectedWidgets.filter(id => id !== widgetId));
    };

    if (isLoading || !mounted) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                        <LayoutGrid className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Custom Dashboard</h2>
                        <p className="text-sm text-zinc-500">
                            {selectedWidgets.length} widget{selectedWidgets.length !== 1 ? 's' : ''} active
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsEditing(!isEditing)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                            isEditing
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                        }`}
                    >
                        <Settings className="w-4 h-4" />
                        {isEditing ? "Done Editing" : "Re-arrange"}
                    </button>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-black text-sm font-bold hover:bg-emerald-400 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add Widget
                    </button>
                </div>
            </div>

            {/* Widget Grid */}
            <WidgetGrid
                selectedWidgets={selectedWidgets}
                isEditing={isEditing}
                onRemoveWidget={handleRemoveWidget}
            />

            {/* Add Widget Modal */}
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
