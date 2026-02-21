"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { X, Search, Check } from "lucide-react";
import { JOURNAL_WIDGET_DEFINITIONS, type JournalWidgetDefinition } from "@/lib/journal-widgets";
import { WIDGET_MODAL_TITLE, WIDGET_ICON_SIZE_GRID, WIDGET_ICON_SIZE_CARD } from "@/lib/widget-standards";

export type WidgetType = JournalWidgetDefinition;

interface AddWidgetModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedWidgets: string[];
    onAddWidget: (widgetId: string) => void;
    onRemoveWidget: (widgetId: string) => void;
}

export function AddWidgetModal({ isOpen, onClose, selectedWidgets, onAddWidget, onRemoveWidget }: AddWidgetModalProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    const filteredWidgets = JOURNAL_WIDGET_DEFINITIONS.filter(widget => {
        const matchesSearch = widget.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            widget.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = !selectedCategory || widget.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const categories = [
        { id: 'performance', label: 'Performance' },
        { id: 'metrics', label: 'Metrics' },
        { id: 'analysis', label: 'Analysis' },
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="fixed inset-0 flex items-center justify-center z-50 p-4"
                    >
                        <div className="w-full max-w-3xl rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                                <div>
                                    <h2 className="text-lg font-bold text-white">{WIDGET_MODAL_TITLE}</h2>
                                    <p className="text-sm text-zinc-500 mt-1">Select widgets to add to your dashboard</p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="flex h-[500px]">
                                {/* Widget List */}
                                <div className="flex-1 p-6 border-r border-zinc-800 overflow-y-auto">
                                    {/* Search */}
                                    <div className="relative mb-4">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                        <input
                                            type="text"
                                            placeholder="Search widgets..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
                                        />
                                    </div>

                                    {/* Categories */}
                                    <div className="flex gap-2 mb-4">
                                        <button
                                            onClick={() => setSelectedCategory(null)}
                                            className={cn(
                                                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                                                !selectedCategory ? "bg-emerald-500/20 text-emerald-400" : "text-zinc-400 hover:text-white"
                                            )}
                                        >
                                            All
                                        </button>
                                        {categories.map(cat => (
                                            <button
                                                key={cat.id}
                                                onClick={() => setSelectedCategory(cat.id)}
                                                className={cn(
                                                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                                                    selectedCategory === cat.id ? "bg-emerald-500/20 text-emerald-400" : "text-zinc-400 hover:text-white"
                                                )}
                                            >
                                                {cat.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Widget Grid */}
                                    <div className="grid grid-cols-2 gap-3">
                                        {filteredWidgets.map(widget => {
                                            const isSelected = selectedWidgets.includes(widget.id);
                                            return (
                                                <button
                                                    key={widget.id}
                                                    onClick={() => isSelected ? onRemoveWidget(widget.id) : onAddWidget(widget.id)}
                                                    className={cn(
                                                        "p-4 rounded-xl text-left transition-all",
                                                        isSelected
                                                            ? "bg-emerald-500/20 border-2 border-emerald-500"
                                                            : "bg-zinc-800/50 border border-zinc-700/50 hover:border-zinc-600"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <widget.icon
                                                            size={WIDGET_ICON_SIZE_GRID}
                                                            className={cn(isSelected ? "text-emerald-400" : "text-zinc-400")}
                                                        />
                                                        <span className={cn(
                                                            "text-sm font-bold",
                                                            isSelected ? "text-emerald-400" : "text-white"
                                                        )}>
                                                            {widget.name}
                                                        </span>
                                                        {isSelected && (
                                                            <Check className="w-4 h-4 text-emerald-400 ml-auto" />
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-zinc-500">{widget.description}</p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Selected Widgets */}
                                <div className="w-64 p-6 bg-zinc-800/30">
                                    <h3 className="text-sm font-bold text-white mb-4">Selected Widgets</h3>
                                    {selectedWidgets.length > 0 ? (
                                        <div className="space-y-2">
                                            {selectedWidgets.map(widgetId => {
                                                const widget = JOURNAL_WIDGET_DEFINITIONS.find(w => w.id === widgetId);
                                                if (!widget) return null;
                                                return (
                                                    <div
                                                        key={widgetId}
                                                        className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <widget.icon size={WIDGET_ICON_SIZE_CARD} className="text-zinc-400" />
                                                            <span className="text-xs text-zinc-300">{widget.name}</span>
                                                        </div>
                                                        <button
                                                            onClick={() => onRemoveWidget(widgetId)}
                                                            className="text-zinc-500 hover:text-rose-400 transition-colors"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-zinc-500">No widgets selected</p>
                                    )}
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between p-6 border-t border-zinc-800 bg-zinc-800/30">
                                <span className="text-sm text-zinc-500">
                                    {selectedWidgets.length} widget{selectedWidgets.length !== 1 ? 's' : ''} selected
                                </span>
                                <button
                                    onClick={onClose}
                                    className="px-6 py-2.5 rounded-xl bg-emerald-500 text-black text-sm font-bold hover:bg-emerald-400 transition-colors"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

export { JOURNAL_WIDGET_DEFINITIONS };
