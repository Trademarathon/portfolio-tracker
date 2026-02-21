"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
    TradeAnnotation,
    StrategyTagId,
    ExecutionQuality,
    EXECUTION_QUALITY,
    getExecutionQualityInfo,
    MarketProfileObservation
} from "@/lib/api/journal-types";
import { StrategyTagSelector } from "./StrategyTagSelector";
import { X, Save, Trash2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useVoiceRecognition } from "@/hooks/useVoiceRecognition";
import { VoiceInputButton } from "@/components/ui/VoiceInputButton";

interface TradeAnnotationModalProps {
    isOpen: boolean;
    onClose: () => void;
    tradeId: string;
    tradeSummary: {
        symbol: string;
        side: string;
        size: number;
        price: number;
        pnl?: number;
        timestamp: number;
    };
    existingAnnotation?: TradeAnnotation;
    onSave: (data: Omit<TradeAnnotation, 'id' | 'createdAt' | 'updatedAt'>) => void;
    onDelete?: (id: string) => void;
}

const PROFILE_TYPES = [
    { value: 'p-shape', label: 'P-Shape (Selling Tail)' },
    { value: 'b-shape', label: 'B-Shape (Buying Tail)' },
    { value: 'd-shape', label: 'D-Shape (Double Dist.)' },
    { value: 'normal', label: 'Normal (Balanced)' },
    { value: 'double', label: 'Double TPO' },
    { value: 'other', label: 'Other' },
] as const;

export function TradeAnnotationModal({
    isOpen,
    onClose,
    tradeId,
    tradeSummary,
    existingAnnotation,
    onSave,
    onDelete
}: TradeAnnotationModalProps) {
    const [strategyTag, setStrategyTag] = useState<StrategyTagId>(existingAnnotation?.strategyTag || 'pullback');
    const [executionQuality, setExecutionQuality] = useState<ExecutionQuality>(existingAnnotation?.executionQuality || 3);
    const [notes, setNotes] = useState(existingAnnotation?.notes || '');
    const [profileType, setProfileType] = useState<MarketProfileObservation['profileType']>(existingAnnotation?.marketProfile?.profileType);
    const [keyLevels, setKeyLevels] = useState(existingAnnotation?.marketProfile?.keyLevels || '');
    const [profileContext, setProfileContext] = useState(existingAnnotation?.marketProfile?.context || '');
    const [trevSettings, setTrevSettings] = useState(existingAnnotation?.trevSettings || '');
    const [mistakeTags, setMistakeTags] = useState((existingAnnotation?.mistakeTags || []).join(', '));

    const { isListening, isTranscribing, error: voiceError, isSupported: voiceSupported, toggleListening } = useVoiceRecognition({
        onTranscript: (text) => setNotes(text),
    });

    // Reset form when modal opens with new trade
    useEffect(() => {
        if (isOpen) {
            setStrategyTag(existingAnnotation?.strategyTag || 'pullback');
            setExecutionQuality(existingAnnotation?.executionQuality || 3);
            setNotes(existingAnnotation?.notes || '');
            setProfileType(existingAnnotation?.marketProfile?.profileType);
            setKeyLevels(existingAnnotation?.marketProfile?.keyLevels || '');
            setProfileContext(existingAnnotation?.marketProfile?.context || '');
            setTrevSettings(existingAnnotation?.trevSettings || '');
            setMistakeTags((existingAnnotation?.mistakeTags || []).join(', '));
        }
    }, [isOpen, existingAnnotation]);

    const handleSave = () => {
        onSave({
            tradeId,
            strategyTag,
            executionQuality,
            notes,
            marketProfile: {
                profileType,
                keyLevels,
                context: profileContext,
            },
            trevSettings,
            mistakeTags: mistakeTags
                .split(',')
                .map(t => t.trim())
                .filter(Boolean),
        });
        onClose();
    };

    const handleDelete = () => {
        if (existingAnnotation && onDelete) {
            onDelete(existingAnnotation.id);
            onClose();
        }
    };

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
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[90vh] overflow-y-auto z-50"
                    >
                        <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
                                        <Sparkles className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-white">Trade Journal Entry</h2>
                                        <p className="text-xs text-muted-foreground">
                                            {tradeSummary.side} {tradeSummary.size} {tradeSummary.symbol} @ ${tradeSummary.price.toFixed(2)}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Form */}
                            <div className="p-6 space-y-6">
                                {/* Strategy Tag */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Strategy Tag</label>
                                    <StrategyTagSelector value={strategyTag} onChange={setStrategyTag} />
                                </div>

                                {/* Execution Quality */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Execution Quality</label>
                                    <div className="flex gap-2">
                                        {EXECUTION_QUALITY.map(q => (
                                            <button
                                                key={q.value}
                                                type="button"
                                                onClick={() => setExecutionQuality(q.value as ExecutionQuality)}
                                                className={cn(
                                                    "flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all",
                                                    executionQuality === q.value
                                                        ? "border-primary bg-primary/20 text-primary"
                                                        : "border-white/10 bg-white/5 hover:bg-white/10"
                                                )}
                                            >
                                                {q.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Notes */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Institutional Context</label>
                                    <div className="relative">
                                        <textarea
                                            value={notes}
                                            onChange={e => setNotes(e.target.value)}
                                            placeholder="e.g., b-shape profile, seller absorption at VAL, responsive buyers..."
                                            className="w-full h-24 px-4 py-3 pr-14 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                                        />
                                        <div className="absolute right-3 bottom-3">
                                            <VoiceInputButton
                                                isListening={isListening}
                                                isTranscribing={isTranscribing}
                                                onClick={() => voiceSupported && toggleListening(notes)}
                                                disabled={!voiceSupported}
                                                title={voiceSupported ? (isListening ? "Stop recording" : "Record & transcribe") : "Voice not supported"}
                                                size="sm"
                                            />
                                        </div>
                                    </div>
                                    {voiceError && <p className="text-[10px] text-amber-400">{voiceError}</p>}
                                </div>

                                {/* Market Profile Section */}
                                <div className="border border-white/10 rounded-xl p-4 space-y-4">
                                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                                        Market Profile Observation
                                    </p>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase text-muted-foreground">Profile Type</label>
                                            <select
                                                value={profileType || ''}
                                                onChange={e => setProfileType(e.target.value as MarketProfileObservation['profileType'])}
                                                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                            >
                                                <option value="">Select...</option>
                                                {PROFILE_TYPES.map(p => (
                                                    <option key={p.value} value={p.value}>{p.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase text-muted-foreground">TRev Settings</label>
                                            <input
                                                type="text"
                                                value={trevSettings}
                                                onChange={e => setTrevSettings(e.target.value)}
                                                placeholder="e.g., T-Size 5, Delta 200"
                                                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase text-muted-foreground">Key Levels</label>
                                        <input
                                            type="text"
                                            value={keyLevels}
                                            onChange={e => setKeyLevels(e.target.value)}
                                            placeholder="e.g., VAH 45200, POC 45100, VAL 45000"
                                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase text-muted-foreground">Context</label>
                                        <input
                                            type="text"
                                            value={profileContext}
                                            onChange={e => setProfileContext(e.target.value)}
                                            placeholder="e.g., seller absorption at VAL"
                                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        />
                                    </div>
                                </div>

                                {/* Mistake Tags */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mistake Tags</label>
                                    <input
                                        type="text"
                                        value={mistakeTags}
                                        onChange={e => setMistakeTags(e.target.value)}
                                        placeholder="e.g., chased, ignored_val, early_exit"
                                        className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    />
                                    <p className="text-[10px] text-zinc-500">Comma-separated. Used to detect repeated mistakes.</p>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between p-6 border-t border-white/10">
                                <div>
                                    {existingAnnotation && onDelete && (
                                        <button
                                            type="button"
                                            onClick={handleDelete}
                                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors text-sm font-medium"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            Delete
                                        </button>
                                    )}
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5 transition-colors text-sm font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSave}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-bold"
                                    >
                                        <Save className="h-4 w-4" />
                                        Save Entry
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
