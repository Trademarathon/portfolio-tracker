"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { 
    Plus, X, BookOpen, TrendingUp, TrendingDown, Minus,
    Clock, Target, Shield, Zap, Hash, AlertTriangle, AlertCircle, Check,
    ChevronDown, ChevronRight, Save, Trash2, Edit2, Play, Square, Activity, Search,
    Info
} from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
import {
    TradingSession,
    BiasType,
    HorizonType,
    RiskType,
    ContextTag,
    SessionNote,
    Playbook,
    PlaybookCategory,
    MarketState,
    ContextCondition,
    KeyLevel,
    ValidCondition,
    InvalidType,
    InvalidAction,
    InvalidCondition,
    Scenario,
    ScenarioTrigger,
    ScenarioAction,
    SpotPlan,
    PerpPlan,
    ProfileShape,
    HierarchyLevel,
    TouchCount,
    getActiveSession,
    saveActiveSession,
    getSessions,
    saveSessions,
    getPlaybooks,
    savePlaybooks,
    getSpotPlans,
    saveSpotPlans,
    getPerpPlans,
    savePerpPlans,
    getSessionStats,
    formatSessionTime,
    formatSessionDate,
    MARKET_STATE_LABELS,
    CONTEXT_LABELS,
    CATEGORY_COLORS,
    PROFILE_SHAPE_LABELS,
    HIERARCHY_LABELS,
} from "@/lib/api/session";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { useExchangePairs, type PairWithExchange } from "@/hooks/useExchangePairs";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { Bell } from "lucide-react";
import { useVoiceRecognition } from "@/hooks/useVoiceRecognition";
import { VoiceInputButton } from "@/components/ui/VoiceInputButton";
import { 
    syncSpotPlansWithAlerts, 
    syncPerpPlansWithAlerts,
    getPlaybookAlertsForSymbol,
    PlaybookLevelAlert,
    loadPlaybookAlerts,
} from "@/lib/api/alerts";
import { PlaybookDedicatedFeed } from "@/components/Journal/PlaybookDedicatedFeed";

// ============ CONSTANTS ============

const BIAS_OPTIONS: { value: BiasType; label: string; icon: React.ReactNode }[] = [
    { value: 'long', label: 'Long', icon: <TrendingUp className="w-4 h-4" /> },
    { value: 'neutral', label: 'Neutral', icon: <Minus className="w-4 h-4" /> },
    { value: 'short', label: 'Short', icon: <TrendingDown className="w-4 h-4" /> },
];

// Spot trading: Buy/Sell/DCA with correct colors (green=Buy, red=Sell, amber=DCA)
const SPOT_BIAS_OPTIONS: { value: BiasType; label: string; icon: React.ReactNode; selectedClass: string }[] = [
    { value: 'long', label: 'Buy', icon: <TrendingUp className="w-4 h-4" />, selectedClass: "bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.2)]" },
    { value: 'neutral', label: 'DCA', icon: <Minus className="w-4 h-4" />, selectedClass: "bg-amber-500/20 text-amber-400 border-2 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.2)]" },
    { value: 'short', label: 'Sell', icon: <TrendingDown className="w-4 h-4" />, selectedClass: "bg-rose-500/20 text-rose-400 border-2 border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.2)]" },
];

function spotBiasLabel(bias: BiasType): string {
    return bias === 'long' ? 'Buy' : bias === 'short' ? 'Sell' : 'DCA';
}

const HORIZON_OPTIONS: { value: HorizonType; label: string }[] = [
    { value: 'scalp', label: 'Scalp' },
    { value: 'intraday', label: 'Intraday' },
    { value: 'swing', label: 'Swing' },
];

const RISK_OPTIONS: { value: RiskType; label: string }[] = [
    { value: 'conservative', label: 'Conservative' },
    { value: 'normal', label: 'Normal' },
    { value: 'aggressive', label: 'Aggressive' },
];

const CONTEXT_OPTIONS: { value: ContextTag; label: string }[] = [
    { value: 'trend', label: 'Trend' },
    { value: 'range', label: 'Range' },
    { value: 'breakout', label: 'Breakout' },
    { value: 'news', label: 'News' },
    { value: 'volatility', label: 'Volatility' },
    { value: 'low_vol', label: 'Low Vol' },
];

const KEY_LEVELS: KeyLevel[] = [
    'PDH', 'PDL', 'VAH', 'VAL', 'POC',
    'D_VAH', 'D_VAL', 'D_POC', 'W_VAH', 'W_VAL', 'W_POC', 'M_VAH', 'M_VAL', 'M_POC',
    'S_VAH', 'S_VAL', 'S_POC'
];

// Display labels for key levels (EQ = equilibrium / POC for composites)
const KEY_LEVEL_LABELS: Record<KeyLevel, string> = {
    'PDH': 'PDH',
    'PDL': 'PDL',
    'VAH': 'VAH',
    'VAL': 'VAL',
    'POC': 'POC',
    'VWAP': 'VWAP',
    'D_VAH': 'Daily VAH',
    'D_VAL': 'Daily VAL',
    'D_POC': 'Daily EQ',
    'W_VAH': 'Week VAH',
    'W_VAL': 'Week VAL',
    'W_POC': 'Week EQ',
    'M_VAH': 'Month VAH',
    'M_VAL': 'Month VAL',
    'M_POC': 'Month EQ',
    'S_VAH': 'Session VAH',
    'S_VAL': 'Session VAL',
    'S_POC': 'Session EQ',
};

const MARKET_STATES: MarketState[] = [
    'balanced', 'imbalanced', 'trending', 'ranging', 
    'one_timeframing', 'rotational', 'breakout', 'failed_auction', 'migration'
];

const CONTEXT_CONDITIONS: ContextCondition[] = [
    'above_value', 'below_value', 'inside_value', 
    'at_composite_edge', 'at_session_edge',
    'poor_high', 'poor_low',
    'excess_high', 'excess_low', 'single_prints', 'poc_migration'
];

const PLAYBOOK_CATEGORIES: PlaybookCategory[] = ['reversal', 'expansion', 'special', 'defensive', 'offensive'];

const PROFILE_SHAPES: ProfileShape[] = ['b_shape', 'p_shape', 'd_shape', 'normal'];

const HIERARCHY_LEVELS: HierarchyLevel[] = ['king', 'pawn'];

// ============ TOGGLE BUTTON GROUP ============

interface ToggleGroupProps<T extends string> {
    options: { value: T; label: string; icon?: React.ReactNode; selectedClass?: string }[];
    value: T | undefined;
    onChange: (value: T) => void;
    className?: string;
}

const DEFAULT_SELECTED_CLASS = "bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.2)]";
const UNSELECTED_CLASS = "bg-zinc-800/50 text-zinc-400 border-2 border-transparent hover:bg-zinc-700/50 hover:text-zinc-300";

function ToggleGroup<T extends string>({ options, value, onChange, className }: ToggleGroupProps<T>) {
    return (
        <div className={cn("grid gap-2", className)} style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
            {options.map((opt) => {
                const isSelected = value === opt.value;
                const selectedClass = opt.selectedClass ?? DEFAULT_SELECTED_CLASS;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onChange(opt.value);
                        }}
                        className={cn(
                            "px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2",
                            isSelected ? selectedClass : UNSELECTED_CLASS
                        )}
                    >
                        {opt.icon}
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}

// ============ MULTI-SELECT TAGS ============

interface TagSelectProps<T extends string> {
    options: { value: T; label: string }[];
    selected: T[];
    onChange: (selected: T[]) => void;
}

function TagSelect<T extends string>({ options, selected, onChange }: TagSelectProps<T>) {
    const toggle = (value: T) => {
        if (selected.includes(value)) {
            onChange(selected.filter(v => v !== value));
        } else {
            onChange([...selected, value]);
        }
    };

    return (
        <div className="flex flex-wrap gap-2">
            {options.map((opt) => (
                <button
                    key={opt.value}
                    onClick={() => toggle(opt.value)}
                    className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                        selected.includes(opt.value)
                            ? "bg-zinc-600 text-white"
                            : "bg-zinc-800/50 text-zinc-500 hover:bg-zinc-700/50 hover:text-zinc-400"
                    )}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

// ============ SESSION INTENT SCREEN ============

interface SessionIntentProps {
    onStartSession: (session: TradingSession) => void;
    onLoadPlaybook: () => void;
    stats: { symbolsObserved: number; tradesTracked: number };
}

function SessionIntent({ onStartSession, onLoadPlaybook, stats }: SessionIntentProps) {
    const [bias, setBias] = useState<BiasType | undefined>();
    const [horizon, setHorizon] = useState<HorizonType | undefined>();
    const [risk, setRisk] = useState<RiskType | undefined>();
    const [context, setContext] = useState<ContextTag[]>([]);
    const [note, setNote] = useState('');
    const {
        isListening,
        isTranscribing,
        error: voiceError,
        isSupported: voiceSupported,
        toggleListening,
    } = useVoiceRecognition({
        onTranscript: (text) => setNote(text),
    });

    const startSession = (withIntent: boolean) => {
        const session: TradingSession = {
            id: uuidv4(),
            startTime: Date.now(),
            bias: withIntent ? bias : undefined,
            horizon: withIntent ? horizon : undefined,
            risk: withIntent ? risk : undefined,
            context: withIntent ? context : [],
            initialNote: withIntent ? note : undefined,
            notes: [],
            isActive: true,
            noIntent: !withIntent,
            stats,
        };
        onStartSession(session);
    };

    const canStart = bias && horizon && risk;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl mx-auto"
        >
            {/* Header */}
            <div className="text-center mb-10">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500/20 to-sky-600/10 border border-sky-500/30 flex items-center justify-center mx-auto mb-4"
                >
                    <Target className="w-8 h-8 text-sky-400" />
                </motion.div>
                <h1 className="text-2xl font-black tracking-tight text-white">
                    Session Intent
                </h1>
                <p className="text-sm text-zinc-500 mt-2">
                    Define your trading approach before entering the market
                </p>
                <p className="text-xs text-zinc-600 font-mono mt-1">
                    {formatSessionDate(Date.now())}
                </p>
            </div>

            {/* Form Card */}
            <div className="p-8 rounded-3xl bg-zinc-900/50 border border-zinc-800/50 backdrop-blur-sm">
                <div className="space-y-8">
                    {/* Bias */}
                    <div>
                        <label className="text-xs text-zinc-400 uppercase font-bold tracking-wider mb-4 block">
                            Market Bias
                        </label>
                        <ToggleGroup options={BIAS_OPTIONS} value={bias} onChange={setBias} />
                    </div>

                    {/* Horizon */}
                    <div>
                        <label className="text-xs text-zinc-400 uppercase font-bold tracking-wider mb-4 block">
                            Time Horizon
                        </label>
                        <ToggleGroup options={HORIZON_OPTIONS} value={horizon} onChange={setHorizon} />
                    </div>

                    {/* Risk */}
                    <div>
                        <label className="text-xs text-zinc-400 uppercase font-bold tracking-wider mb-4 block">
                            Risk Level
                        </label>
                        <ToggleGroup options={RISK_OPTIONS} value={risk} onChange={setRisk} />
                    </div>

                    {/* Context */}
                    <div>
                        <label className="text-xs text-zinc-400 uppercase font-bold tracking-wider mb-4 block">
                            Market Context <span className="text-zinc-600 font-normal normal-case">(Optional)</span>
                        </label>
                        <TagSelect options={CONTEXT_OPTIONS} selected={context} onChange={setContext} />
                    </div>

                    {/* Note */}
                    <div>
                        <label className="text-xs text-zinc-400 uppercase font-bold tracking-wider mb-4 block">
                            Session Note <span className="text-zinc-600 font-normal normal-case">(Optional)</span>
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="What's on your mind entering this session?"
                                className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-xl px-5 py-4 pr-14 text-sm text-zinc-300 placeholder-zinc-600 outline-none focus:border-sky-500/50 transition-colors"
                            />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <VoiceInputButton
                                        isListening={isListening}
                                        isTranscribing={isTranscribing}
                                        onClick={() => voiceSupported && toggleListening(note)}
                                        disabled={!voiceSupported}
                                        title={voiceSupported ? (isListening ? "Stop recording" : "Record & transcribe") : "Voice not supported (Chrome/Edge)"}
                                        size="sm"
                                    />
                                </div>
                        </div>
                        {voiceError && (
                            <p className="text-[10px] text-amber-400 mt-1">{voiceError}</p>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="mt-10 space-y-4">
                    {/* Start Button */}
                    <motion.button
                        whileHover={{ scale: canStart ? 1.01 : 1 }}
                        whileTap={{ scale: canStart ? 0.98 : 1 }}
                        onClick={() => startSession(true)}
                        disabled={!canStart}
                        className={cn(
                            "w-full py-4 rounded-2xl text-sm font-black uppercase tracking-wider transition-all",
                            canStart
                                ? "bg-sky-500 text-white hover:bg-sky-400 shadow-lg shadow-sky-500/20"
                                : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                        )}
                    >
                        Start Session
                    </motion.button>

                    {/* Skip */}
                    <button
                        onClick={() => startSession(false)}
                        className="w-full text-center text-xs text-zinc-500 hover:text-zinc-400 transition-colors py-3"
                    >
                        Skip and trade without intent →
                    </button>

                    {/* Divider */}
                    <div className="relative py-4">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-zinc-800" />
                        </div>
                        <div className="relative flex justify-center">
                            <span className="px-4 bg-zinc-900/50 text-xs text-zinc-600">or</span>
                        </div>
                    </div>

                    {/* Load Playbook */}
                    <button
                        onClick={onLoadPlaybook}
                        className="w-full flex items-center justify-center gap-2 text-sm text-sky-400 hover:text-sky-300 transition-colors py-3 rounded-xl border border-sky-500/20 hover:border-sky-500/40 hover:bg-sky-500/5"
                    >
                        <BookOpen className="w-4 h-4" />
                        Load a Playbook
                    </button>
                </div>
            </div>

            {/* Status Bar */}
            <div className="mt-8 flex items-center justify-center gap-6 text-xs text-zinc-500">
                <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Observing
                </span>
                <span className="text-zinc-400 font-medium">{stats.symbolsObserved} symbols</span>
                <span className="text-zinc-400 font-medium">{stats.tradesTracked} trades</span>
            </div>

            {/* 7 Laws Quick Reference */}
            <div className="mt-8 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
                <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-4 h-4 text-amber-400" />
                    <span className="text-[10px] text-amber-400 uppercase font-black tracking-wider">The 7 Laws</span>
                </div>
                <div className="grid grid-cols-1 gap-1.5 text-[10px]">
                    <div className="flex items-start gap-2">
                        <span className="text-zinc-600 font-mono w-4">1.</span>
                        <span className="text-zinc-400"><span className="text-amber-400 font-bold">Daily Composite</span> is the Bible</span>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="text-zinc-600 font-mono w-4">2.</span>
                        <span className="text-zinc-400"><span className="text-amber-400 font-bold">Touch 2</span> is Religion</span>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="text-zinc-600 font-mono w-4">3.</span>
                        <span className="text-zinc-400"><span className="text-amber-400 font-bold">POC</span> is the Magnet</span>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="text-zinc-600 font-mono w-4">4.</span>
                        <span className="text-zinc-400"><span className="text-amber-400 font-bold">Cycle of Failure</span> — Failed breakout → rotation</span>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="text-zinc-600 font-mono w-4">5.</span>
                        <span className="text-zinc-400"><span className="text-amber-400 font-bold">Shape</span> Dictates Strategy</span>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="text-zinc-600 font-mono w-4">6.</span>
                        <span className="text-zinc-400"><span className="text-amber-400 font-bold">King vs Pawn</span> — Composite 80% / Session 20%</span>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="text-zinc-600 font-mono w-4">7.</span>
                        <span className="text-zinc-400"><span className="text-amber-400 font-bold">Migration</span> — When POC shifts, PAUSE</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

// ============ ACTIVE SESSION SCREEN ============

interface SessionActiveProps {
    session: TradingSession;
    onAddNote: (note: string) => void;
    onEndSession: () => void;
    onOpenPlaybooks: () => void;
    stats: { symbolsObserved: number; tradesTracked: number };
}

function SessionActive({ session, onAddNote, onEndSession, onOpenPlaybooks, stats }: SessionActiveProps) {
    const [newNote, setNewNote] = useState('');
    const {
        isListening,
        isTranscribing,
        error: voiceError,
        isSupported: voiceSupported,
        toggleListening,
    } = useVoiceRecognition({
        onTranscript: (text) => setNewNote(text),
    });

    const addNote = () => {
        if (newNote.trim()) {
            onAddNote(newNote.trim());
            setNewNote('');
        }
    };

    const handleMicClick = () => {
        if (!voiceSupported) return;
        toggleListening(newNote);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl mx-auto"
        >
            {/* Header Card */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 mb-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center"
                        >
                            <Activity className="w-7 h-7 text-emerald-400" />
                        </motion.div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-black text-white">Session Active</h2>
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            </div>
                            <p className="text-sm text-zinc-500 mt-0.5">
                                Started {formatSessionTime(session.startTime)}
                            </p>
                        </div>
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onEndSession}
                        className="px-5 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 font-bold hover:border-rose-500/50 hover:text-rose-400 transition-all text-sm"
                    >
                        End Session
                    </motion.button>
                </div>

                {/* Session Parameters */}
                {!session.noIntent && (
                    <div className="mt-5 pt-5 border-t border-emerald-500/10 flex items-center gap-3">
                        <span className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-black uppercase",
                            session.bias === 'long' ? "bg-emerald-500/20 text-emerald-400" :
                            session.bias === 'short' ? "bg-rose-500/20 text-rose-400" :
                            "bg-zinc-700/50 text-zinc-400"
                        )}>
                            {session.bias}
                        </span>
                        <span className="px-3 py-1.5 rounded-lg bg-sky-500/20 text-sky-400 text-xs font-black uppercase">
                            {session.horizon}
                        </span>
                        <span className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-black uppercase",
                            session.risk === 'aggressive' ? "bg-amber-500/20 text-amber-400" :
                            session.risk === 'conservative' ? "bg-zinc-600/30 text-zinc-400" :
                            "bg-zinc-700/30 text-zinc-300"
                        )}>
                            {session.risk}
                        </span>
                    </div>
                )}
                {session.noIntent && (
                    <div className="mt-5 pt-5 border-t border-emerald-500/10">
                        <p className="text-sm text-zinc-400">Trading without declared intent</p>
                    </div>
                )}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Notes Section */}
                <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50">
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Session Notes</h3>
                    
                    {/* Notes Timeline */}
                    <div className="space-y-3 max-h-[300px] overflow-y-auto mb-4">
                        {session.initialNote && (
                            <div className="p-4 rounded-xl bg-zinc-800/50 border-l-2 border-emerald-500/50">
                                <p className="text-[10px] text-zinc-500 font-mono mb-1">
                                    {formatSessionTime(session.startTime)} • Initial
                                </p>
                                <p className="text-sm text-zinc-300">{session.initialNote}</p>
                            </div>
                        )}
                        {session.notes.map((note) => (
                            <div key={note.id} className="p-4 rounded-xl bg-zinc-800/30 border-l-2 border-zinc-600">
                                <p className="text-[10px] text-zinc-500 font-mono mb-1">
                                    {formatSessionTime(note.timestamp)}
                                </p>
                                <p className="text-sm text-zinc-300">{note.content}</p>
                            </div>
                        ))}
                        {!session.initialNote && session.notes.length === 0 && (
                            <p className="text-sm text-zinc-600 text-center py-8">No notes yet</p>
                        )}
                    </div>

                    {/* Add Note Input */}
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    value={newNote}
                                    onChange={(e) => setNewNote(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addNote()}
                                    placeholder="Add a note..."
                                    className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-zinc-300 placeholder-zinc-600 outline-none focus:border-emerald-500/50 transition-colors"
                                />
                            </div>
                            <VoiceInputButton
                                isListening={isListening}
                                isTranscribing={isTranscribing}
                                onClick={handleMicClick}
                                disabled={!voiceSupported}
                                title={voiceSupported ? (isListening ? "Stop recording" : "Record & transcribe") : "Voice not supported (Chrome/Edge)"}
                                size="md"
                            />
                            <button
                                onClick={addNote}
                                disabled={!newNote.trim()}
                                className={cn(
                                    "p-3 rounded-xl transition-colors",
                                    newNote.trim() 
                                        ? "bg-emerald-500 text-black hover:bg-emerald-400" 
                                        : "bg-zinc-800 text-zinc-600"
                                )}
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                        {voiceError && (
                            <p className="text-[10px] text-amber-400">{voiceError}</p>
                        )}
                    </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                    {/* Playbooks Button */}
                    <button
                        onClick={onOpenPlaybooks}
                        className="w-full p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 hover:border-sky-500/30 transition-all group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center group-hover:bg-sky-500/20 transition-colors">
                                <BookOpen className="w-5 h-5 text-sky-400" />
                            </div>
                            <div className="text-left">
                                <p className="text-sm font-bold text-white group-hover:text-sky-400 transition-colors">View Playbooks</p>
                                <p className="text-xs text-zinc-500">Load a strategy during session</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-zinc-600 ml-auto group-hover:text-sky-400 transition-colors" />
                        </div>
                    </button>

                    {/* Kill Switches Reminder */}
                    <div className="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/20">
                        <div className="flex items-center gap-2 mb-4">
                            <AlertCircle className="w-4 h-4 text-rose-400" />
                            <span className="text-xs text-rose-400 uppercase font-black tracking-wider">Kill Switches</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="text-center p-3 rounded-xl bg-zinc-800/50">
                                <p className="text-[10px] text-zinc-500 mb-1">Daily Max</p>
                                <p className="text-lg font-black text-rose-400">8</p>
                                <p className="text-[9px] text-zinc-600">trades</p>
                            </div>
                            <div className="text-center p-3 rounded-xl bg-zinc-800/50">
                                <p className="text-[10px] text-zinc-500 mb-1">Red Line</p>
                                <p className="text-lg font-black text-rose-400">3</p>
                                <p className="text-[9px] text-zinc-600">losses</p>
                            </div>
                            <div className="text-center p-3 rounded-xl bg-zinc-800/50">
                                <p className="text-[10px] text-zinc-500 mb-1">Black Line</p>
                                <p className="text-lg font-black text-rose-400">2%</p>
                                <p className="text-[9px] text-zinc-600">drawdown</p>
                            </div>
                        </div>
                    </div>

                    {/* Status Bar */}
                    <div className="flex items-center justify-center gap-6 text-xs text-zinc-500 py-3">
                        <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Observing
                        </span>
                        <span className="text-zinc-400 font-medium">{stats.symbolsObserved} symbols</span>
                        <span className="text-zinc-400 font-medium">{stats.tradesTracked} trades</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

// ============ PLAYBOOKS MODAL ============

interface PlaybooksModalProps {
    isOpen: boolean;
    onClose: () => void;
    playbooks: Playbook[];
    onSelect: (playbook: Playbook) => void;
    onCreateNew: () => void;
    onEdit: (playbook: Playbook) => void;
    onDelete: (id: string) => void;
}

function PlaybooksModal({ isOpen, onClose, playbooks, onSelect, onCreateNew, onEdit, onDelete }: PlaybooksModalProps) {
    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="neo-shell w-full max-w-2xl bg-zinc-900/90 rounded-[20px] border neo-border shadow-2xl max-h-[80vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b neo-border">
                    <h2 className="text-lg font-black text-white">Playbooks</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(80vh-140px)]">
                    {playbooks.map((playbook) => (
                        <div
                            key={playbook.id}
                            className="neo-card card-lg p-5 border neo-border hover:border-white/20 transition-all group"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h3 className="text-base font-black text-white uppercase tracking-wide">
                                        {playbook.name}
                                    </h3>
                                    <p className="text-xs text-zinc-500 mt-1">{playbook.description}</p>
                                </div>
                                <span className={cn(
                                    "neo-chip text-[10px] font-black uppercase tracking-wider border",
                                    CATEGORY_COLORS[playbook.category]
                                )}>
                                    {playbook.category}
                                </span>
                            </div>

                            {/* Institutional Methodology Tags */}
                            <div className="flex items-center gap-2 mt-2">
                                {playbook.profileShape && (
                                    <span className="neo-chip bg-amber-500/20 text-amber-300 text-[9px] font-bold uppercase">
                                        {PROFILE_SHAPE_LABELS[playbook.profileShape]}
                                    </span>
                                )}
                                {playbook.hierarchyLevel && (
                                    <span className={cn(
                                        "neo-chip text-[9px] font-bold uppercase",
                                        playbook.hierarchyLevel === 'king' 
                                            ? "bg-violet-500/20 text-violet-400" 
                                            : "bg-zinc-600/20 text-zinc-400"
                                    )}>
                                        {playbook.hierarchyLevel === 'king' ? '👑 King' : '♟️ Pawn'}
                                    </span>
                                )}
                                {playbook.touchRequired && (
                                    <span className="neo-chip bg-emerald-500/20 text-emerald-300 text-[9px] font-bold">
                                        Touch {playbook.touchRequired}
                                    </span>
                                )}
                                {playbook.riskPercent && (
                                    <span className="neo-chip bg-rose-500/20 text-rose-300 text-[9px] font-bold">
                                        {playbook.riskPercent}% Risk
                                    </span>
                                )}
                            </div>

                            {/* Composite Badges */}
                            <div className="flex items-center gap-2 mt-2">
                                {playbook.keyLevels?.D_VAH || playbook.keyLevels?.D_VAL || playbook.keyLevels?.D_POC ? (
                                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[9px] font-bold uppercase">Daily</span>
                                ) : null}
                                {playbook.keyLevels?.W_VAH || playbook.keyLevels?.W_VAL || playbook.keyLevels?.W_POC ? (
                                    <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[9px] font-bold uppercase">Weekly</span>
                                ) : null}
                                {playbook.keyLevels?.M_VAH || playbook.keyLevels?.M_VAL || playbook.keyLevels?.M_POC ? (
                                    <span className="px-2 py-0.5 rounded bg-violet-500/15 text-violet-400 text-[9px] font-bold uppercase">Monthly</span>
                                ) : null}
                                {playbook.keyLevels?.S_VAH || playbook.keyLevels?.S_VAL || playbook.keyLevels?.S_POC ? (
                                    <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-400 text-[9px] font-bold uppercase">Session</span>
                                ) : null}
                            </div>

                            {/* Scenarios */}
                            <div className="flex flex-wrap gap-2 mt-3">
                                {playbook.scenarios.map((scenario) => (
                                    <span
                                        key={scenario.id}
                                        className="neo-metric card-sm px-2.5 py-1 text-zinc-400 text-[10px] font-mono"
                                    >
                                        IF {scenario.trigger} {KEY_LEVEL_LABELS[scenario.level]} → {scenario.action.toUpperCase()}
                                        {scenario.target && ` to ${KEY_LEVEL_LABELS[scenario.target]}`}
                                    </span>
                                ))}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => onSelect(playbook)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/30 transition-colors"
                                >
                                    <Play className="w-3 h-3" />
                                    Load
                                </button>
                                <button
                                    onClick={() => onEdit(playbook)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-700 text-zinc-300 text-xs font-bold hover:bg-zinc-600 transition-colors"
                                >
                                    <Edit2 className="w-3 h-3" />
                                    Edit
                                </button>
                                <button
                                    onClick={() => onDelete(playbook.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-colors"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    ))}

                    {/* Create New */}
                    <button
                        onClick={onCreateNew}
                        className="neo-metric card-lg w-full p-5 border border-dashed border-emerald-500/30 text-emerald-300 font-bold flex items-center justify-center gap-2 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        Create New Playbook
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ============ PLAYBOOK CREATOR MODAL ============

interface PlaybookCreatorProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (playbook: Playbook) => void;
    editPlaybook?: Playbook | null;
}

function PlaybookCreator({ isOpen, onClose, onSave, editPlaybook }: PlaybookCreatorProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState<PlaybookCategory>('reversal');
    // Institutional Methodology Fields
    const [profileShape, setProfileShape] = useState<ProfileShape>('normal');
    const [hierarchyLevel, setHierarchyLevel] = useState<HierarchyLevel>('king');
    const [touchRequired, setTouchRequired] = useState<TouchCount>(2);
    const [riskPercent, setRiskPercent] = useState<number>(0.5);
    const [maxContracts, setMaxContracts] = useState<number>(2);
    const [stopMultiplier, setStopMultiplier] = useState<number>(1.5);
    // Market Conditions
    const [marketStates, setMarketStates] = useState<MarketState[]>([]);
    const [contextConditions, setContextConditions] = useState<ContextCondition[]>([]);
    const [keyLevels, setKeyLevels] = useState<Record<KeyLevel, number>>({
        PDH: 0, PDL: 0, VAH: 0, VAL: 0, POC: 0, VWAP: 0,
        D_VAH: 0, D_VAL: 0, D_POC: 0, W_VAH: 0, W_VAL: 0, W_POC: 0, M_VAH: 0, M_VAL: 0, M_POC: 0,
        S_VAH: 0, S_VAL: 0, S_POC: 0
    });
    const [defaultBias, setDefaultBias] = useState<BiasType>('neutral');
    const [validCondition, setValidCondition] = useState<ValidCondition>('above');
    const [validLevel, setValidLevel] = useState<KeyLevel>('PDH');
    const [invalidConditions, setInvalidConditions] = useState<InvalidCondition[]>([]);
    const [scenarios, setScenarios] = useState<Scenario[]>([]);
    const [notes, setNotes] = useState('');
    const [compositeNotes, setCompositeNotes] = useState('');
    const [valueRotationCount, setValueRotationCount] = useState<number>(0);
    const [valueTestCount, setValueTestCount] = useState<number>(0);
    const [valueAcceptance, setValueAcceptance] = useState<"accepted" | "rejected" | "in_progress">("in_progress");
    const [profileContext, setProfileContext] = useState<{ footprint?: string; dom?: string; tape?: string }>({});
    const [sessionCompositeEnabled, setSessionCompositeEnabled] = useState(true);
    const [compositeTag, setCompositeTag] = useState<"daily" | "weekly" | "monthly" | "session" | "stacked">("daily");
    const {
        isListening,
        isTranscribing,
        error: voiceError,
        isSupported: voiceSupported,
        toggleListening,
    } = useVoiceRecognition({
        onTranscript: (text) => setNotes(text),
    });

    // Reset form when opening
    useEffect(() => {
        if (isOpen) {
            if (editPlaybook) {
                setName(editPlaybook.name);
                setDescription(editPlaybook.description);
                setCategory(editPlaybook.category);
                // Institutional fields
                setProfileShape(editPlaybook.profileShape || 'normal');
                setHierarchyLevel(editPlaybook.hierarchyLevel || 'king');
                setTouchRequired(editPlaybook.touchRequired || 2);
                setRiskPercent(editPlaybook.riskPercent || 0.5);
                setMaxContracts(editPlaybook.maxContracts || 2);
                setStopMultiplier(editPlaybook.stopMultiplier || 1.5);
                // Market conditions
                setMarketStates(editPlaybook.marketStates);
                setContextConditions(editPlaybook.contextConditions);
                setKeyLevels(prev => ({ ...prev, ...editPlaybook.keyLevels }));
                setDefaultBias(editPlaybook.defaultBias);
                setValidCondition(editPlaybook.validWhile.condition);
                setValidLevel(editPlaybook.validWhile.level);
                setInvalidConditions(editPlaybook.invalidConditions);
                setScenarios(editPlaybook.scenarios);
                setNotes(editPlaybook.notes);
                setCompositeNotes(editPlaybook.compositeNotes || '');
                setValueRotationCount(editPlaybook.valueRotationCount || 0);
                setValueTestCount(editPlaybook.valueTestCount || 0);
                setValueAcceptance(editPlaybook.valueAcceptance || "in_progress");
                setProfileContext(editPlaybook.profileContext || {});
                setSessionCompositeEnabled(editPlaybook.sessionCompositeEnabled ?? true);
                setCompositeTag(editPlaybook.compositeTag || "daily");
            } else {
                // Reset to defaults
                setName('');
                setDescription('');
                setCategory('reversal');
                setProfileShape('normal');
                setHierarchyLevel('king');
                setTouchRequired(2);
                setRiskPercent(0.5);
                setMaxContracts(2);
                setStopMultiplier(1.5);
                setMarketStates([]);
                setContextConditions([]);
                setKeyLevels({ PDH: 0, PDL: 0, VAH: 0, VAL: 0, POC: 0, VWAP: 0, D_VAH: 0, D_VAL: 0, D_POC: 0, W_VAH: 0, W_VAL: 0, W_POC: 0, M_VAH: 0, M_VAL: 0, M_POC: 0, S_VAH: 0, S_VAL: 0, S_POC: 0 });
                setDefaultBias('neutral');
                setValidCondition('above');
                setValidLevel('PDH');
                setInvalidConditions([]);
                setScenarios([]);
                setNotes('');
                setCompositeNotes('');
                setValueRotationCount(0);
                setValueTestCount(0);
                setValueAcceptance("in_progress");
                setProfileContext({});
                setSessionCompositeEnabled(true);
                setCompositeTag("daily");
            }
        }
    }, [isOpen, editPlaybook]);

    const toggleMarketState = (state: MarketState) => {
        setMarketStates(prev => 
            prev.includes(state) ? prev.filter(s => s !== state) : [...prev, state]
        );
    };

    const toggleContext = (ctx: ContextCondition) => {
        setContextConditions(prev => 
            prev.includes(ctx) ? prev.filter(c => c !== ctx) : [...prev, ctx]
        );
    };

    const addInvalidCondition = () => {
        setInvalidConditions(prev => [...prev, { type: 'price', action: 'break' }]);
    };

    const updateInvalidCondition = (index: number, updates: Partial<InvalidCondition>) => {
        setInvalidConditions(prev => prev.map((c, i) => i === index ? { ...c, ...updates } : c));
    };

    const removeInvalidCondition = (index: number) => {
        setInvalidConditions(prev => prev.filter((_, i) => i !== index));
    };

    const addScenario = () => {
        setScenarios(prev => [...prev, { 
            id: uuidv4(), 
            trigger: 'sweep', 
            level: 'VAH', 
            action: 'long' 
        }]);
    };

    const updateScenario = (id: string, updates: Partial<Scenario>) => {
        setScenarios(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    };

    const removeScenario = (id: string) => {
        setScenarios(prev => prev.filter(s => s.id !== id));
    };

    const handleSave = () => {
        const playbook: Playbook = {
            id: editPlaybook?.id || uuidv4(),
            name: name || 'Untitled Playbook',
            description,
            category,
            // Institutional Methodology
            profileShape,
            hierarchyLevel,
            touchRequired,
            riskPercent,
            maxContracts,
            stopMultiplier,
            // Market Conditions
            marketStates,
            contextConditions,
            keyLevels,
            defaultBias,
            validWhile: { condition: validCondition, level: validLevel },
            invalidConditions,
            scenarios,
            notes,
            compositeNotes,
            valueRotationCount,
            valueTestCount,
            valueAcceptance,
            profileContext: { ...profileContext, tpoShape: profileShape },
            sessionCompositeEnabled,
            compositeTag,
            createdAt: editPlaybook?.createdAt || Date.now(),
            updatedAt: Date.now(),
        };
        onSave(playbook);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="playbook-neo-modal neo-shell w-full max-w-3xl bg-zinc-900/90 rounded-[20px] border neo-border shadow-2xl my-8"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b neo-border sticky top-0 bg-zinc-900/95 z-10 backdrop-blur-sm">
                    <div className="flex items-center gap-4">
                        <h2 className="text-lg font-black text-white uppercase tracking-wide">
                            {editPlaybook ? 'Edit Playbook' : 'New Playbook'}
                        </h2>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value as PlaybookCategory)}
                            className="neo-chip bg-emerald-500/20 border border-emerald-500/30 rounded-xl px-3 py-1.5 text-emerald-300 text-xs font-bold uppercase outline-none cursor-pointer"
                        >
                            {PLAYBOOK_CATEGORIES.map(cat => (
                                <option key={cat} value={cat} className="bg-zinc-900">{cat}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSave}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-black font-bold text-sm hover:bg-emerald-400 transition-colors"
                        >
                            <Save className="w-4 h-4" />
                            Save Playbook
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="playbook-neo-form p-6 space-y-4">
                    {/* Institutional Methodology Section */}
                    <div className="neo-card neo-card-warm card-lg p-4 border border-amber-500/25">
                        <label className="text-[10px] text-amber-400 uppercase font-black tracking-wider mb-4 flex items-center gap-2">
                            <Shield className="w-3 h-3" />
                            Institutional Methodology
                        </label>
                        <div className="grid grid-cols-3 gap-4">
                            {/* Profile Shape */}
                            <div>
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block mb-2">Profile Shape</span>
                                <select
                                    value={profileShape}
                                    onChange={(e) => setProfileShape(e.target.value as ProfileShape)}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none cursor-pointer"
                                >
                                    {PROFILE_SHAPES.map(shape => (
                                        <option key={shape} value={shape}>{PROFILE_SHAPE_LABELS[shape]}</option>
                                    ))}
                                </select>
                            </div>
                            {/* Hierarchy Level */}
                            <div>
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block mb-2">Hierarchy</span>
                                <select
                                    value={hierarchyLevel}
                                    onChange={(e) => setHierarchyLevel(e.target.value as HierarchyLevel)}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none cursor-pointer"
                                >
                                    {HIERARCHY_LEVELS.map(level => (
                                        <option key={level} value={level}>{HIERARCHY_LABELS[level]}</option>
                                    ))}
                                </select>
                            </div>
                            {/* Touch Required */}
                            <div>
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block mb-2">Touch Required</span>
                                <div className="flex items-center gap-1">
                                    {[1, 2, 3].map(touch => (
                                        <button
                                            key={touch}
                                            onClick={() => setTouchRequired(touch as TouchCount)}
                                            className={cn(
                                                "flex-1 py-2 rounded-lg text-xs font-bold transition-all",
                                                touchRequired === touch
                                                    ? "bg-amber-500 text-black"
                                                    : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                                            )}
                                        >
                                            {touch}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        {/* Risk Management Row */}
                        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-amber-500/10">
                            <div>
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block mb-2">Risk %</span>
                                <select
                                    value={riskPercent}
                                    onChange={(e) => setRiskPercent(parseFloat(e.target.value))}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none cursor-pointer"
                                >
                                    <option value={0.25}>0.25% (Balance)</option>
                                    <option value={0.5}>0.50% (Rotation)</option>
                                    <option value={1.0}>1.00% (Extension)</option>
                                </select>
                            </div>
                            <div>
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block mb-2">Max Contracts</span>
                                <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={maxContracts}
                                    onChange={(e) => setMaxContracts(parseInt(e.target.value) || 1)}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                                />
                            </div>
                            <div>
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block mb-2">Stop (ATR x)</span>
                                <select
                                    value={stopMultiplier}
                                    onChange={(e) => setStopMultiplier(parseFloat(e.target.value))}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none cursor-pointer"
                                >
                                    <option value={1}>1.0x ATR</option>
                                    <option value={1.5}>1.5x ATR</option>
                                    <option value={2}>2.0x ATR</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* 01 Market State */}
                    <div className="neo-card card-lg p-4 md:p-5">
                        <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-3 flex items-center gap-2">
                            <span className="text-zinc-600">01</span> Market State
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {MARKET_STATES.map(state => (
                                <button
                                    key={state}
                                    onClick={() => toggleMarketState(state)}
                                    className={cn(
                                        "px-3 py-2 rounded-lg text-xs font-bold transition-all",
                                        marketStates.includes(state)
                                            ? "bg-zinc-600 text-white"
                                            : "bg-zinc-800/50 text-zinc-500 hover:bg-zinc-700/50"
                                    )}
                                >
                                    {MARKET_STATE_LABELS[state]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 02 Context */}
                    <div className="neo-card card-lg p-4 md:p-5">
                        <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-3 flex items-center gap-2">
                            <span className="text-zinc-600">02</span> Context
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {CONTEXT_CONDITIONS.map(ctx => (
                                <button
                                    key={ctx}
                                    onClick={() => toggleContext(ctx)}
                                    className={cn(
                                        "px-3 py-2 rounded-lg text-xs font-bold transition-all",
                                        contextConditions.includes(ctx)
                                            ? "bg-zinc-600 text-white"
                                            : "bg-zinc-800/50 text-zinc-500 hover:bg-zinc-700/50"
                                    )}
                                >
                                    {CONTEXT_LABELS[ctx]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 03 Key Levels */}
                    <div className="neo-card card-lg p-4 md:p-5">
                        <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-3 flex items-center gap-2">
                            <span className="text-zinc-600">03</span> Key Levels
                        </label>
                        <div className="space-y-4">
                            {/* Session Levels - PDH/PDL, VAH/VAL, POC */}
                            <div className="grid grid-cols-2 gap-3">
                                {(['PDH', 'PDL', 'VAH', 'VAL', 'POC'] as KeyLevel[]).map(level => (
                                    <div key={level} className="flex items-center gap-3">
                                        <span className="text-xs text-zinc-500 font-mono w-12">{level}</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={keyLevels[level] || ''}
                                            onChange={(e) => setKeyLevels(prev => ({ ...prev, [level]: parseFloat(e.target.value) || 0 }))}
                                            placeholder="0.00"
                                            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:border-emerald-500/50"
                                        />
                                    </div>
                                ))}
                            </div>
                            
                            {/* Composite Levels Section */}
                            <div className="pt-3 border-t border-zinc-800">
                                <span className="text-[9px] text-zinc-600 uppercase tracking-wider font-bold mb-3 block">Composite Levels</span>
                                <div className="space-y-3">
                                    {/* Daily composite VAH EQ VAL */}
                                    <div className="grid grid-cols-3 gap-3">
                                        {(['D_VAH', 'D_POC', 'D_VAL'] as KeyLevel[]).map(level => (
                                            <div key={level} className="flex items-center gap-2">
                                                <span className="text-[10px] text-zinc-500 font-mono w-16 shrink-0">{KEY_LEVEL_LABELS[level]}</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={keyLevels[level] || ''}
                                                    onChange={(e) => setKeyLevels(prev => ({ ...prev, [level]: parseFloat(e.target.value) || 0 }))}
                                                    placeholder="0.00"
                                                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:border-emerald-500/50"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    {/* Same week composite VAH EQ VAL */}
                                    <div className="grid grid-cols-3 gap-3">
                                        {(['W_VAH', 'W_POC', 'W_VAL'] as KeyLevel[]).map(level => (
                                            <div key={level} className="flex items-center gap-2">
                                                <span className="text-[10px] text-zinc-500 font-mono w-16 shrink-0">{KEY_LEVEL_LABELS[level]}</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={keyLevels[level] || ''}
                                                    onChange={(e) => setKeyLevels(prev => ({ ...prev, [level]: parseFloat(e.target.value) || 0 }))}
                                                    placeholder="0.00"
                                                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:border-emerald-500/50"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    {/* Monthly composite VAH EQ VAL */}
                                    <div className="grid grid-cols-3 gap-3">
                                        {(['M_VAH', 'M_POC', 'M_VAL'] as KeyLevel[]).map(level => (
                                            <div key={level} className="flex items-center gap-2">
                                                <span className="text-[10px] text-zinc-500 font-mono w-16 shrink-0">{KEY_LEVEL_LABELS[level]}</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={keyLevels[level] || ''}
                                                    onChange={(e) => setKeyLevels(prev => ({ ...prev, [level]: parseFloat(e.target.value) || 0 }))}
                                                    placeholder="0.00"
                                                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:border-emerald-500/50"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    {/* Session composite VAH EQ VAL */}
                                    <div className="grid grid-cols-3 gap-3">
                                        {(['S_VAH', 'S_POC', 'S_VAL'] as KeyLevel[]).map(level => (
                                            <div key={level} className="flex items-center gap-2">
                                                <span className="text-[10px] text-zinc-500 font-mono w-16 shrink-0">{KEY_LEVEL_LABELS[level]}</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={keyLevels[level] || ''}
                                                    onChange={(e) => setKeyLevels(prev => ({ ...prev, [level]: parseFloat(e.target.value) || 0 }))}
                                                    placeholder="0.00"
                                                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:border-emerald-500/50"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 03.5 Composite Context */}
                    <div className="neo-card card-lg p-4 border neo-border">
                        <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-3 block">Composite Context</label>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block mb-2">Rotation Count</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={valueRotationCount}
                                    onChange={(e) => setValueRotationCount(parseInt(e.target.value) || 0)}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                                />
                            </div>
                            <div>
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block mb-2">Test Count</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={valueTestCount}
                                    onChange={(e) => setValueTestCount(parseInt(e.target.value) || 0)}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                                />
                            </div>
                            <div>
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block mb-2">Value Acceptance</span>
                                <select
                                    value={valueAcceptance}
                                    onChange={(e) => setValueAcceptance(e.target.value as any)}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none cursor-pointer"
                                >
                                    <option value="in_progress">In progress</option>
                                    <option value="accepted">Accepted</option>
                                    <option value="rejected">Rejected</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-4 pt-3 border-t border-white/5">
                            <div>
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block mb-2">Composite Tag</span>
                                <select
                                    value={compositeTag}
                                    onChange={(e) => setCompositeTag(e.target.value as any)}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none cursor-pointer"
                                >
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                    <option value="session">Session</option>
                                    <option value="stacked">Stacked</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2 pt-6">
                                <button
                                    type="button"
                                    onClick={() => setSessionCompositeEnabled(!sessionCompositeEnabled)}
                                    className={cn(
                                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                                        sessionCompositeEnabled ? "bg-emerald-500" : "bg-zinc-700"
                                    )}
                                >
                                    <span className={cn("inline-block h-3 w-3 transform rounded-full bg-white transition-transform", sessionCompositeEnabled ? "translate-x-5" : "translate-x-1")} />
                                </button>
                                <span className="text-xs text-zinc-400">Session composite enabled</span>
                            </div>
                        </div>
                        <div className="mt-4">
                            <span className="text-[9px] text-zinc-500 uppercase font-bold block mb-2">Composite Notes</span>
                            <textarea
                                value={compositeNotes}
                                onChange={(e) => setCompositeNotes(e.target.value)}
                                rows={2}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                                placeholder="Rotation notes, acceptance/rejection details..."
                            />
                        </div>
                    </div>

                    {/* 03.6 TPO / Footprint / DOM / Tape */}
                    <div className="neo-card card-lg p-4 border neo-border">
                        <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-3 block">TPO / Footprint / DOM / Tape</label>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block mb-2">Footprint</span>
                                <input
                                    type="text"
                                    value={profileContext.footprint || ""}
                                    onChange={(e) => setProfileContext(prev => ({ ...prev, footprint: e.target.value }))}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                                />
                            </div>
                            <div>
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block mb-2">DOM</span>
                                <input
                                    type="text"
                                    value={profileContext.dom || ""}
                                    onChange={(e) => setProfileContext(prev => ({ ...prev, dom: e.target.value }))}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                                />
                            </div>
                            <div>
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block mb-2">Tape</span>
                                <input
                                    type="text"
                                    value={profileContext.tape || ""}
                                    onChange={(e) => setProfileContext(prev => ({ ...prev, tape: e.target.value }))}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 04 Default Bias */}
                    <div className="neo-card card-lg p-4 md:p-5">
                        <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-3 flex items-center gap-2">
                            <span className="text-zinc-600">04</span> Default Bias
                        </label>
                        <ToggleGroup 
                            options={BIAS_OPTIONS} 
                            value={defaultBias} 
                            onChange={setDefaultBias} 
                        />
                    </div>

                    {/* 05 Valid / Invalid */}
                    <div className="neo-card card-lg p-4 md:p-5">
                        <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-3 flex items-center gap-2">
                            <span className="text-zinc-600">05</span> Valid / Invalid
                        </label>
                        
                        {/* Valid While */}
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-xs text-emerald-400 font-bold">Valid while</span>
                            <select
                                value={validCondition}
                                onChange={(e) => setValidCondition(e.target.value as ValidCondition)}
                                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white outline-none cursor-pointer"
                            >
                                <option value="above">Above</option>
                                <option value="below">Below</option>
                                <option value="inside">Inside</option>
                                <option value="outside">Outside</option>
                            </select>
                            <select
                                value={validLevel}
                                onChange={(e) => setValidLevel(e.target.value as KeyLevel)}
                                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white outline-none cursor-pointer"
                            >
                                {KEY_LEVELS.map(l => <option key={l} value={l}>{KEY_LEVEL_LABELS[l]}</option>)}
                            </select>
                        </div>

                        {/* Saved Invalid Conditions - Displayed as compact cards with OR/AND toggles */}
                        <div className="space-y-0 mb-3">
                            {invalidConditions.map((cond, idx) => (
                                <div key={idx}>
                                    {/* Condition Card */}
                                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-800/60 border-l-4 border-orange-500/70">
                                        <span className="px-2 py-1 rounded bg-orange-500/20 text-orange-400 text-[10px] font-black uppercase tracking-wider">
                                            {cond.type}
                                        </span>
                                        <span className="text-sm text-zinc-300">
                                            {cond.action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                        </span>
                                        {cond.level && (
                                            <span className="text-sm text-emerald-400 font-bold">{KEY_LEVEL_LABELS[cond.level]}</span>
                                        )}
                                        <button
                                            onClick={() => removeInvalidCondition(idx)}
                                            className="p-1 rounded text-zinc-600 hover:text-red-400 transition-colors ml-auto"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                    
                                    {/* OR/AND Toggle - Show between conditions */}
                                    {idx < invalidConditions.length - 1 && (
                                        <div className="flex items-center justify-center py-1">
                                            <div className="flex items-center bg-zinc-800/80 rounded-lg overflow-hidden border border-zinc-700">
                                                <button
                                                    onClick={() => updateInvalidCondition(idx, { connector: 'or' })}
                                                    className={cn(
                                                        "px-3 py-1 text-[10px] font-bold transition-colors",
                                                        cond.connector !== 'and'
                                                            ? "bg-emerald-500/30 text-emerald-400"
                                                            : "text-zinc-500 hover:text-zinc-300"
                                                    )}
                                                >
                                                    OR
                                                </button>
                                                <button
                                                    onClick={() => updateInvalidCondition(idx, { connector: 'and' })}
                                                    className={cn(
                                                        "px-3 py-1 text-[10px] font-bold transition-colors",
                                                        cond.connector === 'and'
                                                            ? "bg-emerald-500/30 text-emerald-400"
                                                            : "text-zinc-500 hover:text-zinc-300"
                                                    )}
                                                >
                                                    AND
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Add New Invalid Condition Row */}
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-zinc-800/30 border border-dashed border-red-500/30">
                            <span className="text-[10px] text-red-400 font-bold px-2 py-1 rounded bg-red-500/10 uppercase tracking-wider">Invalid if</span>
                            <select
                                defaultValue=""
                                onChange={(e) => {
                                    if (e.target.value) {
                                        setInvalidConditions(prev => [...prev, { 
                                            type: e.target.value as InvalidType, 
                                            action: 'break' 
                                        }]);
                                        e.target.value = '';
                                    }
                                }}
                                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none cursor-pointer"
                            >
                                <option value="">Type...</option>
                                <option value="price">PRICE</option>
                                <option value="structure">STRUCTURE</option>
                                <option value="time">TIME</option>
                            </select>
                            {invalidConditions.length > 0 && (
                                <>
                                    <select
                                        value={invalidConditions[invalidConditions.length - 1]?.action || 'break'}
                                        onChange={(e) => updateInvalidCondition(invalidConditions.length - 1, { action: e.target.value as InvalidAction })}
                                        className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none cursor-pointer"
                                    >
                                        <option value="lose">Lose</option>
                                        <option value="back_inside">Back inside</option>
                                        <option value="accept_below">Accept below</option>
                                        <option value="accept_above">Accept above</option>
                                        <option value="break">Break</option>
                                        <option value="reject">Reject</option>
                                    </select>
                                    <select
                                        value={invalidConditions[invalidConditions.length - 1]?.level || ''}
                                        onChange={(e) => updateInvalidCondition(invalidConditions.length - 1, { level: e.target.value as KeyLevel || undefined })}
                                        className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none cursor-pointer"
                                    >
                                        <option value="">Level...</option>
                                        {KEY_LEVELS.map(l => <option key={l} value={l}>{KEY_LEVEL_LABELS[l]}</option>)}
                                    </select>
                                </>
                            )}
                        </div>
                    </div>

                    {/* 06 Scenarios */}
                    <div className="neo-card card-lg p-4 md:p-5">
                        <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-3 flex items-center gap-2">
                            <span className="text-zinc-600">06</span> Scenarios
                        </label>
                        <div className="space-y-2">
                            {scenarios.map((scenario) => (
                                <div key={scenario.id} className="flex items-center gap-2 p-3 rounded-xl bg-zinc-800/50">
                                    <span className="text-xs text-zinc-500 font-bold">IF</span>
                                    <select
                                        value={scenario.trigger}
                                        onChange={(e) => updateScenario(scenario.id, { trigger: e.target.value as ScenarioTrigger })}
                                        className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                                    >
                                        <option value="sweep">Sweep</option>
                                        <option value="accept">Accept</option>
                                        <option value="reject">Reject</option>
                                        <option value="break">Break</option>
                                        <option value="fail">Fail</option>
                                        <option value="hold">Hold</option>
                                    </select>
                                    <select
                                        value={scenario.level}
                                        onChange={(e) => updateScenario(scenario.id, { level: e.target.value as KeyLevel })}
                                        className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                                    >
                                        {KEY_LEVELS.map(l => <option key={l} value={l}>{KEY_LEVEL_LABELS[l]}</option>)}
                                    </select>
                                    <span className="text-zinc-500">→</span>
                                    <select
                                        value={scenario.action}
                                        onChange={(e) => updateScenario(scenario.id, { action: e.target.value as ScenarioAction })}
                                        className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                                    >
                                        <option value="long">LONG</option>
                                        <option value="short">SHORT</option>
                                        <option value="wait">WAIT</option>
                                        <option value="exit">EXIT</option>
                                    </select>
                                    <span className="text-zinc-600 text-xs">INTO</span>
                                    <select
                                        value={scenario.target || ''}
                                        onChange={(e) => updateScenario(scenario.id, { target: e.target.value as KeyLevel || undefined })}
                                        className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                                    >
                                        <option value="">Target...</option>
                                        {KEY_LEVELS.map(l => <option key={l} value={l}>{KEY_LEVEL_LABELS[l]}</option>)}
                                    </select>
                                    <button
                                        onClick={() => removeScenario(scenario.id)}
                                        className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors ml-auto"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            <button
                                onClick={addScenario}
                                className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Add Scenario
                            </button>
                        </div>
                    </div>

                    {/* 07 Notes */}
                    <div className="neo-card card-lg p-4 md:p-5">
                        <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-3 flex items-center gap-2">
                            <span className="text-zinc-600">07</span> Notes
                        </label>
                        <div className="relative space-y-1">
                            <div className="relative">
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Add any additional notes for this playbook..."
                                    rows={3}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 pr-12 text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-500/50 resize-none"
                                />
                                <div className="absolute right-3 bottom-3">
                                    <VoiceInputButton
                                        isListening={isListening}
                                        isTranscribing={isTranscribing}
                                        onClick={() => voiceSupported && toggleListening(notes)}
                                        disabled={!voiceSupported}
                                        title={voiceSupported ? (isListening ? "Stop recording" : "Record & transcribe") : "Voice not supported (Chrome/Edge)"}
                                        size="sm"
                                    />
                                </div>
                            </div>
                            {voiceError && (
                                <p className="text-[10px] text-amber-400">{voiceError}</p>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ============ SPOT PLANS PANEL ============

type PlanTab = 'session' | 'spot' | 'perp';

// Shared rule for Spot & Perp: filter and sort pair suggestions by search
function filterAndSortPairSuggestions(
    pairs: PairWithExchange[],
    normalizedSearch: string,
    symbolNorm: string,
    hasConnectedExchanges: boolean
): PairWithExchange[] {
    if (!normalizedSearch || !hasConnectedExchanges) return [];
    const base = (s: string) => s.replace(/USDT|USDC|USD$/i, '').toUpperCase();
    return pairs
        .filter(p => {
            const b = base(p.symbol);
            return p.symbol.startsWith(normalizedSearch) || b.startsWith(normalizedSearch) || b.includes(normalizedSearch) || p.symbol === symbolNorm || b === normalizedSearch;
        })
        .sort((a, b) => {
            const baseA = base(a.symbol);
            const baseB = base(b.symbol);
            const exactA = baseA === normalizedSearch;
            const exactB = baseB === normalizedSearch;
            if (exactA && !exactB) return -1;
            if (!exactA && exactB) return 1;
            const prefA = baseA.startsWith(normalizedSearch);
            const prefB = baseB.startsWith(normalizedSearch);
            if (prefA && !prefB) return -1;
            if (!prefA && prefB) return 1;
            const inclA = baseA.includes(normalizedSearch);
            const inclB = baseB.includes(normalizedSearch);
            if (inclA && !inclB) return -1;
            if (!inclA && inclB) return 1;
            return baseA.localeCompare(baseB);
        })
        .slice(0, 15);
}

function SpotPlansPanel({ onClose }: { onClose: () => void }) {
    const { assets, connections } = usePortfolio();
    const { spotPairs, spotPairsWithExchange, isLoading: pairsLoading, hasConnectedExchanges } = useExchangePairs(connections);
    const [spotPlans, setSpotPlans] = useState<SpotPlan[]>([]);
    const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
    const [editingPlan, setEditingPlan] = useState<SpotPlan | null>(null);
    const [showEditor, setShowEditor] = useState(false);
    const [newSymbol, setNewSymbol] = useState('');
    const [showPairDropdown, setShowPairDropdown] = useState(false);
    const pairInputRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setSpotPlans(getSpotPlans());
    }, []);

    // Stablecoins to exclude from spot plans
    const STABLECOINS = [
        'USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'USDP', 'USDD', 'GUSD', 
        'FRAX', 'LUSD', 'SUSD', 'CUSD', 'UST', 'MIM', 'FEI', 'TRIBE',
        'EURC', 'EURS', 'EURT', 'PYUSD', 'FDUSD', 'USDE', 'CRVUSD'
    ];

    // Get unique coins from assets (excluding stablecoins)
    const availableCoins = useMemo(() => {
        if (!assets) return [];
        return assets
            .filter(a => a.valueUsd > 10) // Only coins with meaningful value
            .filter(a => !STABLECOINS.includes(a.symbol.toUpperCase())) // Exclude stablecoins
            .sort((a, b) => b.valueUsd - a.valueUsd)
            .slice(0, 20); // Top 20 holdings
    }, [assets]);

    // Combine holdings with plan-only symbols (plans created by typing a symbol, not from holdings)
    const displayItems = useMemo(() => {
        const coinSymbols = new Set(availableCoins.map(c => c.symbol.toUpperCase()));
        const planOnly = spotPlans
            .filter(p => !coinSymbols.has(p.symbol.toUpperCase()))
            .map(p => ({ symbol: p.symbol, valueUsd: 0 }));
        return [...availableCoins, ...planOnly];
    }, [availableCoins, spotPlans]);

    const handleSavePlan = (plan: SpotPlan) => {
        const existing = spotPlans.findIndex(p => p.id === plan.id);
        let updated: SpotPlan[];
        if (existing >= 0) {
            updated = spotPlans.map(p => p.id === plan.id ? plan : p);
        } else {
            updated = [...spotPlans, plan];
        }
        setSpotPlans(updated);
        saveSpotPlans(updated);
        setShowEditor(false);
        setEditingPlan(null);
    };

    const handleDeletePlan = (id: string) => {
        const updated = spotPlans.filter(p => p.id !== id);
        setSpotPlans(updated);
        saveSpotPlans(updated);
    };

    const handleEditPlan = (plan: SpotPlan) => {
        setEditingPlan(plan);
        setShowEditor(true);
    };

    const handleCreatePlan = (symbol: string) => {
        const newPlan: SpotPlan = {
            id: uuidv4(),
            symbol,
            bias: 'neutral',
            keyLevels: {},
            scenarios: [],
            invalidConditions: [],
            notes: '',
            targets: [],
            isActive: true,
            ruleEnforcement: { mode: 'critical' },
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        setEditingPlan(newPlan);
        setShowEditor(true);
    };

    const normalizedSearch = newSymbol.trim().toUpperCase();
    const symbolNorm = normalizedSearch.endsWith('USDT') || normalizedSearch.endsWith('USDC') ? normalizedSearch : normalizedSearch + 'USDT';
    const spotSuggestions = useMemo(() =>
        filterAndSortPairSuggestions(spotPairsWithExchange, normalizedSearch, symbolNorm, hasConnectedExchanges),
        [spotPairsWithExchange, normalizedSearch, symbolNorm, hasConnectedExchanges]
    );

    const handleCreatePlanFromSymbol = (symbol?: string) => {
        const s = (symbol || newSymbol).trim().toUpperCase();
        if (!s) return;
        const sym = s.endsWith('USDT') || s.endsWith('USDC') || s.endsWith('USD') ? s : `${s}USDT`;
        if (spotPlans.some(p => p.symbol.toUpperCase() === sym)) {
            handleEditPlan(spotPlans.find(p => p.symbol.toUpperCase() === sym)!);
        } else {
            handleCreatePlan(sym);
        }
        setNewSymbol('');
        setShowPairDropdown(false);
    };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (pairInputRef.current && !pairInputRef.current.contains(e.target as Node)) {
                setShowPairDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="space-y-8">
            {/* Section Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 flex items-center justify-center">
                        <Target className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white tracking-tight">Spot Trading Plans</h2>
                        <p className="text-sm text-zinc-500 mt-0.5">Define key levels, scenarios, and targets for spot pairs</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="neo-metric card-md px-4 py-2 border neo-border">
                        <span className="text-xs text-zinc-500">Active Plans</span>
                        <span className="ml-2 text-lg font-black text-emerald-400">{spotPlans.filter(p => p.isActive).length}</span>
                    </div>
                    <div className="neo-metric card-md px-4 py-2 border neo-border">
                        <span className="text-xs text-zinc-500">Total</span>
                        <span className="ml-2 text-lg font-black text-white">{spotPlans.length}</span>
                    </div>
                </div>
            </div>

            {/* Add by symbol - spot pairs from connected exchanges only */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="neo-card card-lg flex items-center gap-4 p-5 border border-emerald-500/25"
            >
                <div className="flex-1 relative" ref={pairInputRef}>
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                        <input
                            type="text"
                            value={newSymbol}
                            onChange={(e) => {
                                setNewSymbol(e.target.value.toUpperCase());
                                setShowPairDropdown(true);
                            }}
                            onFocus={() => setShowPairDropdown(true)}
                            placeholder={hasConnectedExchanges
                                ? "Type BTC, ETH, etc. to search spot pairs"
                                : "Connect Binance, Bybit, or Hyperliquid in Settings to see spot pairs"}
                            className="w-full bg-zinc-900/80 border border-zinc-700 rounded-xl pl-11 pr-5 py-3.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500/50 transition-colors"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreatePlanFromSymbol();
                            }}
                        />
                    </div>
                    {showPairDropdown && spotSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-60 overflow-y-auto rounded-xl bg-zinc-900 border border-zinc-700 shadow-xl">
                            {spotSuggestions.map(({ symbol: sym, exchange }) => (
                                <button
                                    key={`${sym}-${exchange}`}
                                    type="button"
                                    onClick={() => handleCreatePlanFromSymbol(sym)}
                                    className="w-full px-6 py-2.5 text-left text-sm text-white hover:bg-emerald-500/20 flex items-center gap-3"
                                >
                                    <span
                                        className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold text-black"
                                        style={{
                                            backgroundColor: exchange === "binance" ? "#F0B90B" : exchange === "bybit" ? "#F7931A" : "#22C55E",
                                        }}
                                        title={exchange === "binance" ? "Binance Spot" : exchange === "bybit" ? "Bybit Spot" : "Hyperliquid Spot"}
                                    >
                                        {exchange === "binance" ? "B" : exchange === "bybit" ? "Y" : "H"}
                                    </span>
                                    <span className="font-mono">{sym}</span>
                                    <span className="text-[10px] text-zinc-500 ml-auto">
                                        {exchange === "binance" ? "Binance" : exchange === "bybit" ? "Bybit" : "Hyperliquid"}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                    {pairsLoading && (
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500">Loading pairs…</span>
                    )}
                </div>
                <button
                    onClick={() => handleCreatePlanFromSymbol()}
                    disabled={!newSymbol.trim() || (hasConnectedExchanges && !spotPairs.includes(symbolNorm))}
                    className={cn(
                        "flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm transition-all",
                        newSymbol.trim() && (!hasConnectedExchanges || spotPairs.includes(symbolNorm))
                            ? "bg-emerald-500 text-black hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"
                            : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                    )}
                >
                    <Plus className="w-4 h-4" />
                    Create Plan
                </button>
            </motion.div>

            {/* Holdings + Plan-only Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {displayItems.map((item) => {
                    const plan = spotPlans.find(p => p.symbol.toUpperCase() === item.symbol.toUpperCase());
                    return (
                        <motion.div
                            key={item.symbol}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.16 }}
                            className={cn(
                                "neo-card card-lg relative p-4 border transition-all duration-150 cursor-pointer group overflow-hidden",
                                plan
                                    ? "border-emerald-500/30 hover:border-emerald-400/60"
                                    : "border-zinc-700/50 hover:border-zinc-500"
                            )}
                            onClick={() => plan ? handleEditPlan(plan) : handleCreatePlan(item.symbol)}
                        >
                            {/* Glow effect for active plans */}
                            {plan?.isActive && (
                                <div className="absolute -inset-1 bg-emerald-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                            )}
                            
                            <div className="relative">
                                <div className="flex items-center gap-3 mb-3">
                                    <TokenIcon symbol={item.symbol} size={36} />
                                    <div className="flex-1 min-w-0">
                                        <div className="font-black text-white text-base">{item.symbol}</div>
                                        <div className="text-[11px] text-zinc-500 font-medium">
                                            {item.valueUsd > 0 ? `$${item.valueUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                                        </div>
                                    </div>
                                </div>
                                
                                {plan ? (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className={cn(
                                                "px-2 py-1 rounded-lg text-[10px] font-black uppercase",
                                                plan.bias === 'long' ? "bg-emerald-500/20 text-emerald-400" :
                                                plan.bias === 'short' ? "bg-rose-500/20 text-rose-400" :
                                                "bg-zinc-600/30 text-zinc-400"
                                            )}>
                                                {spotBiasLabel(plan.bias)}
                                            </span>
                                            <span className="text-[10px] text-zinc-500 font-medium">
                                                {plan.scenarios.length} scenarios
                                            </span>
                                        </div>
                                        {(plan.keyLevels?.D_VAH || plan.keyLevels?.W_VAH || plan.keyLevels?.M_VAH || plan.keyLevels?.S_VAH) && (
                                            <div className="text-[10px] text-zinc-500 font-medium">
                                                Updated {Math.max(1, Math.floor((Date.now() - (plan.updatedAt || plan.createdAt)) / 86400000))}d ago
                                            </div>
                                        )}
                                        {plan.targets.length > 0 && (
                                            <div className="flex items-center gap-1 text-[10px]">
                                                <TrendingUp className="w-3 h-3 text-emerald-400" />
                                                <span className="text-emerald-400 font-medium truncate">
                                                    {plan.targets.slice(0, 2).map(t => `$${t.toLocaleString()}`).join(', ')}
                                                    {plan.targets.length > 2 && '...'}
                                                </span>
                                            </div>
                                        )}
                                        {plan.stopLoss && (
                                            <div className="flex items-center gap-1 text-[10px]">
                                                <TrendingDown className="w-3 h-3 text-rose-400" />
                                                <span className="text-rose-400 font-medium">SL: ${plan.stopLoss.toLocaleString()}</span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center py-2">
                                        <span className="flex items-center gap-1.5 text-[11px] text-zinc-500 group-hover:text-zinc-300 transition-colors">
                                            <Plus className="w-3.5 h-3.5" />
                                            Add Plan
                                        </span>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {displayItems.length === 0 && (
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="neo-card card-lg text-center py-20 border border-dashed border-zinc-700/70"
                >
                    <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center mx-auto mb-4">
                        <Target className="w-8 h-8 text-zinc-600" />
                    </div>
                    <p className="text-base font-bold text-zinc-400">No spot plans yet</p>
                    <p className="text-sm text-zinc-600 mt-1">Add a trading pair above or connect wallets to see holdings</p>
                </motion.div>
            )}

            {/* Spot Plan Editor Modal */}
            <AnimatePresence>
                {showEditor && editingPlan && (
                    <SpotPlanEditor
                        isOpen={showEditor}
                        plan={editingPlan}
                        currentPrice={availableCoins.find(c => {
                            const p = (editingPlan.symbol || '').replace(/USDT|USDC|USD$/i, '').toUpperCase();
                            const a = (c.symbol || '').replace(/USDT|USDC|USD$/i, '').toUpperCase();
                            return p === a || c.symbol.toUpperCase() === editingPlan.symbol.toUpperCase();
                        })?.price}
                        onClose={() => {
                            setShowEditor(false);
                            setEditingPlan(null);
                        }}
                        onSave={handleSavePlan}
                        onDelete={() => {
                            if (editingPlan.id) handleDeletePlan(editingPlan.id);
                            setShowEditor(false);
                            setEditingPlan(null);
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// ============ SPOT PLAN EDITOR ============

function displaySymbolForPlan(s: string): string {
    return (s || '').replace(/USDT|USDC|USD$/i, '').toUpperCase() || s;
}

function SpotPlanEditor({
    isOpen,
    plan,
    currentPrice,
    onClose,
    onSave,
    onDelete,
}: {
    isOpen: boolean;
    plan: SpotPlan;
    currentPrice?: number;
    onClose: () => void;
    onSave: (plan: SpotPlan) => void;
    onDelete: () => void;
}) {
    const [bias, setBias] = useState<BiasType>(plan.bias);
    const [keyLevels, setKeyLevels] = useState<Record<KeyLevel, number>>(
        plan.keyLevels as Record<KeyLevel, number> || {
            PDH: 0, PDL: 0, VAH: 0, VAL: 0, POC: 0, VWAP: 0,
            D_VAH: 0, D_VAL: 0, D_POC: 0, W_VAH: 0, W_VAL: 0, W_POC: 0, M_VAH: 0, M_VAL: 0, M_POC: 0,
            S_VAH: 0, S_VAL: 0, S_POC: 0
        }
    );

    // Sync bias when plan changes (e.g. opening a different plan)
    useEffect(() => {
        setBias(plan.bias);
    }, [plan.id, plan.bias]);
    const [targets, setTargets] = useState<string>(plan.targets.join(', '));
    const [stopLoss, setStopLoss] = useState<string>(plan.stopLoss?.toString() || '');
    const [buyLimits, setBuyLimits] = useState<string[]>(() => {
        if (plan.buyLimits && plan.buyLimits.length > 0) return plan.buyLimits.map(String);
        if (plan.entryZone?.low != null && plan.entryZone?.high != null) return [plan.entryZone.low.toString(), plan.entryZone.high.toString()];
        if (plan.entryZone?.low != null) return [plan.entryZone.low.toString()];
        return [''];
    });
    const [sellLimits, setSellLimits] = useState<string[]>(() => {
        if (plan.sellLimits && plan.sellLimits.length > 0) return plan.sellLimits.map(String);
        if (plan.entryZone?.low != null && plan.entryZone?.high != null) return [plan.entryZone.low.toString(), plan.entryZone.high.toString()];
        if (plan.entryZone?.high != null) return [plan.entryZone.high.toString()];
        return [''];
    });
    const [notes, setNotes] = useState(plan.notes);
    const [compositeNotes, setCompositeNotes] = useState(plan.compositeNotes || '');
    const [valueRotationCount, setValueRotationCount] = useState<number>(plan.valueRotationCount || 0);
    const [valueTestCount, setValueTestCount] = useState<number>(plan.valueTestCount || 0);
    const [valueAcceptance, setValueAcceptance] = useState<"accepted" | "rejected" | "in_progress">(plan.valueAcceptance || "in_progress");
    const [profileContext, setProfileContext] = useState<{ footprint?: string; dom?: string; tape?: string }>(plan.profileContext || {});
    const [sessionCompositeEnabled, setSessionCompositeEnabled] = useState(plan.sessionCompositeEnabled ?? true);
    const [compositeTag, setCompositeTag] = useState<"daily" | "weekly" | "monthly" | "session" | "stacked">(plan.compositeTag || "daily");
    const [plannedOrderSizes, setPlannedOrderSizes] = useState<Partial<Record<KeyLevel | 'target' | 'stop' | 'entry_low' | 'entry_high', number>>>(plan.plannedOrderSizes || {});
    const { isListening, isTranscribing, error: voiceError, isSupported: voiceSupported, toggleListening } = useVoiceRecognition({
        onTranscript: (text) => setNotes(text),
    });
    const [scenarios, setScenarios] = useState<Scenario[]>(plan.scenarios);
    const [invalidConditions, setInvalidConditions] = useState<InvalidCondition[]>(plan.invalidConditions);
    const [alertsCount, setAlertsCount] = useState(0);
    const [alertsSynced, setAlertsSynced] = useState(false);

    // Load existing alerts for this symbol
    useEffect(() => {
        const alerts = getPlaybookAlertsForSymbol(plan.symbol);
        setAlertsCount(alerts.length);
        setAlertsSynced(alerts.length > 0);
    }, [plan.symbol]);

    const hasBuyLimits = buyLimits.some(s => s.trim() && !isNaN(parseFloat(s)));
    const hasSellLimits = sellLimits.some(s => s.trim() && !isNaN(parseFloat(s)));
    const hasEntryOrders = (bias === 'long' || bias === 'neutral') ? hasBuyLimits : hasSellLimits;
    const hasStopLoss = stopLoss.trim() && !isNaN(parseFloat(stopLoss));
    const hasTargets = targets.split(',').some(t => t.trim() && !isNaN(parseFloat(t.trim())));
    const hasNotes = notes.trim().length > 0;
    const hasKeyLevels = Object.values(keyLevels).some(v => v !== undefined && v !== null && v !== 0);
    const hasScenarios = scenarios.length > 0;
    const canSave = hasEntryOrders || hasStopLoss || hasTargets || hasNotes || hasKeyLevels || hasScenarios;

    const addBuyLimit = () => setBuyLimits(prev => [...prev, '']);
    const addSellLimit = () => setSellLimits(prev => [...prev, '']);
    const updateBuyLimit = (i: number, v: string) => setBuyLimits(prev => prev.map((x, j) => j === i ? v : x));
    const updateSellLimit = (i: number, v: string) => setSellLimits(prev => prev.map((x, j) => j === i ? v : x));
    const removeBuyLimit = (i: number) => setBuyLimits(prev => prev.filter((_, j) => j !== i));
    const removeSellLimit = (i: number) => setSellLimits(prev => prev.filter((_, j) => j !== i));

    const handleSyncAlerts = () => {
        if (!canSave) return;
        // Save current plan first, then sync alerts
        handleSave();
        setTimeout(() => {
            syncSpotPlansWithAlerts();
            const alerts = getPlaybookAlertsForSymbol(plan.symbol);
            setAlertsCount(alerts.length);
            setAlertsSynced(true);
        }, 100);
    };

    const handleSave = () => {
        if (!canSave) return;
        const buyLimitsNum = buyLimits.map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
        const sellLimitsNum = sellLimits.map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
        const updatedPlan: SpotPlan = {
            ...plan,
            bias,
            keyLevels,
            targets: targets.split(',').map(t => parseFloat(t.trim())).filter(t => !isNaN(t)),
            stopLoss: parseFloat(stopLoss) || undefined,
            buyLimits: buyLimitsNum.length > 0 ? buyLimitsNum : undefined,
            sellLimits: sellLimitsNum.length > 0 ? sellLimitsNum : undefined,
            notes,
            compositeNotes,
            valueRotationCount,
            valueTestCount,
            valueAcceptance,
            profileContext,
            sessionCompositeEnabled,
            compositeTag,
            scenarios,
            invalidConditions,
            plannedOrderSizes,
            updatedAt: Date.now(),
        };
        onSave(updatedPlan);
    };

    const addScenario = () => {
        setScenarios(prev => [...prev, { 
            id: uuidv4(), 
            trigger: 'sweep', 
            level: 'VAH', 
            action: 'long' 
        }]);
    };

    const updateScenario = (id: string, updates: Partial<Scenario>) => {
        setScenarios(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    };

    const removeScenario = (id: string) => {
        setScenarios(prev => prev.filter(s => s.id !== id));
    };

    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-full max-w-2xl bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl my-8 antialiased"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                    <div className="flex items-center gap-3">
                        <TokenIcon symbol={displaySymbolForPlan(plan.symbol)} size={32} />
                        <div>
                            <h2 className="text-lg font-semibold text-white uppercase tracking-wide">{displaySymbolForPlan(plan.symbol)} Plan</h2>
                            <p className="text-[10px] text-zinc-500 font-normal">Spot Trading Levels</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors shrink-0"
                            title="Define bias, limits, targets & key levels. Use + to add orders. Sync Alerts to create price alerts."
                        >
                            <Info className="w-4 h-4" />
                        </button>
                        {/* Sync Alerts Button */}
                        <button
                            onClick={handleSyncAlerts}
                            disabled={!canSave}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all",
                                !canSave && "opacity-50 cursor-not-allowed",
                                canSave && (alertsSynced 
                                    ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30" 
                                    : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600")
                            )}
                            title={canSave ? "Sync key levels with alerts" : "Add data before syncing alerts"}
                        >
                            <Bell className="w-3.5 h-3.5" />
                            {alertsSynced ? `${alertsCount} Alerts` : 'Sync Alerts'}
                        </button>
                        <button
                            onClick={onDelete}
                            className="p-2 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!canSave}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-colors",
                                canSave
                                    ? "bg-emerald-500 text-black hover:bg-emerald-400"
                                    : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                            )}
                        >
                            <Save className="w-4 h-4" />
                            Save Plan
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Bias */}
                    <div>
                        <label className="text-[10px] text-zinc-500 uppercase font-medium tracking-wider mb-3 block">Bias</label>
                        <ToggleGroup options={SPOT_BIAS_OPTIONS} value={bias} onChange={setBias} className="[&_button]:font-medium" />
                    </div>

                    {/* Buy Limits / Sell Limits / DCA Levels & Stop Loss */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col">
                            <label className="text-[10px] text-zinc-500 uppercase font-medium tracking-wider mb-2 block">
                                {bias === 'long' ? 'Buy Limits' : bias === 'short' ? 'Sell Limits' : 'DCA Levels'}
                            </label>
                            <div className="space-y-2">
                                {(bias === 'long' || bias === 'neutral' ? buyLimits : sellLimits).map((val, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={val}
                                            onChange={(e) => (bias === 'long' || bias === 'neutral') ? updateBuyLimit(i, e.target.value) : updateSellLimit(i, e.target.value)}
                                            placeholder={currentPrice ? `${currentPrice.toFixed(2)}` : 'Price'}
                                            className={cn(
                                                "flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono font-normal tabular-nums outline-none focus:border-emerald-500/50",
                                                bias === 'short' && "focus:border-rose-500/50"
                                            )}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => (bias === 'long' || bias === 'neutral') ? removeBuyLimit(i) : removeSellLimit(i)}
                                            className="p-2 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                                            disabled={(bias === 'long' || bias === 'neutral' ? buyLimits : sellLimits).length <= 1}
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => (bias === 'long' || bias === 'neutral') ? addBuyLimit() : addSellLimit()}
                                    className="flex items-center gap-2 px-3 py-2 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add order
                                </button>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <label className="text-[10px] text-zinc-500 uppercase font-medium tracking-wider mb-2 block">Stop Loss</label>
                            <input
                                type="number"
                                step="0.01"
                                value={stopLoss}
                                onChange={(e) => setStopLoss(e.target.value)}
                                placeholder={currentPrice ? `${(currentPrice * 0.95).toFixed(2)}` : '—'}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono font-normal tabular-nums outline-none focus:border-rose-500/50"
                            />
                        </div>
                    </div>

                    {/* Targets */}
                    <div>
                        <label className="text-[10px] text-zinc-500 uppercase font-medium tracking-wider mb-2 block">Targets (comma-separated)</label>
                        <input
                            type="text"
                            value={targets}
                            onChange={(e) => setTargets(e.target.value)}
                            placeholder={currentPrice ? `${(currentPrice * 1.05).toFixed(0)}, ${(currentPrice * 1.1).toFixed(0)}, ${(currentPrice * 1.15).toFixed(0)}` : '100, 120, 150'}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono font-normal tabular-nums outline-none focus:border-emerald-500/50"
                        />
                    </div>

                    {/* Key Levels */}
                    <div>
                        <label className="text-[10px] text-zinc-500 uppercase font-medium tracking-wider mb-3 block">Key Levels</label>
                        <div className="space-y-4">
                            {/* Session */}
                            <div className="grid grid-cols-3 gap-3">
                                {(['PDH', 'PDL', 'VAH', 'VAL', 'POC'] as KeyLevel[]).map(level => (
                                    <div key={level} className="flex items-center gap-2">
                                        <span className="text-[10px] text-zinc-500 font-mono font-normal w-12 shrink-0">{level}</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={keyLevels[level] !== undefined && keyLevels[level] !== null && keyLevels[level] !== 0 ? String(keyLevels[level]) : ''}
                                            onChange={(e) => setKeyLevels(prev => ({ ...prev, [level]: parseFloat(e.target.value) || 0 }))}
                                            placeholder={currentPrice ? `${currentPrice.toFixed(2)}` : '—'}
                                            className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono font-normal tabular-nums outline-none focus:border-emerald-500/50"
                                        />
                                    </div>
                                ))}
                            </div>
                            {/* Daily composite VAH EQ VAL */}
                            <div className="pt-3 border-t border-zinc-800">
                                <span className="text-[9px] text-zinc-600 uppercase tracking-wider font-medium mb-2 block">Daily composite</span>
                                <div className="grid grid-cols-3 gap-3">
                                    {(['D_VAH', 'D_POC', 'D_VAL'] as KeyLevel[]).map(level => (
                                        <div key={level} className="flex items-center gap-2">
                                            <span className="text-[10px] text-zinc-500 font-mono font-normal w-14 shrink-0">{KEY_LEVEL_LABELS[level]}</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={keyLevels[level] !== undefined && keyLevels[level] !== null && keyLevels[level] !== 0 ? String(keyLevels[level]) : ''}
                                                onChange={(e) => setKeyLevels(prev => ({ ...prev, [level]: parseFloat(e.target.value) || 0 }))}
                                                placeholder={currentPrice ? `${currentPrice.toFixed(2)}` : '—'}
                                                className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono font-normal tabular-nums outline-none focus:border-emerald-500/50"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* Same week composite VAH EQ VAL */}
                            <div>
                                <span className="text-[9px] text-zinc-600 uppercase tracking-wider font-medium mb-2 block">Same week composite</span>
                                <div className="grid grid-cols-3 gap-3">
                                    {(['W_VAH', 'W_POC', 'W_VAL'] as KeyLevel[]).map(level => (
                                        <div key={level} className="flex items-center gap-2">
                                            <span className="text-[10px] text-zinc-500 font-mono font-normal w-14 shrink-0">{KEY_LEVEL_LABELS[level]}</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={keyLevels[level] !== undefined && keyLevels[level] !== null && keyLevels[level] !== 0 ? String(keyLevels[level]) : ''}
                                                onChange={(e) => setKeyLevels(prev => ({ ...prev, [level]: parseFloat(e.target.value) || 0 }))}
                                                placeholder={currentPrice ? `${currentPrice.toFixed(2)}` : '—'}
                                                className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono font-normal tabular-nums outline-none focus:border-emerald-500/50"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* Monthly composite VAH EQ VAL */}
                            <div>
                                <span className="text-[9px] text-zinc-600 uppercase tracking-wider font-medium mb-2 block">Monthly composite</span>
                                <div className="grid grid-cols-3 gap-3">
                                    {(['M_VAH', 'M_POC', 'M_VAL'] as KeyLevel[]).map(level => (
                                        <div key={level} className="flex items-center gap-2">
                                            <span className="text-[10px] text-zinc-500 font-mono font-normal w-14 shrink-0">{KEY_LEVEL_LABELS[level]}</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={keyLevels[level] !== undefined && keyLevels[level] !== null && keyLevels[level] !== 0 ? String(keyLevels[level]) : ''}
                                                onChange={(e) => setKeyLevels(prev => ({ ...prev, [level]: parseFloat(e.target.value) || 0 }))}
                                                placeholder={currentPrice ? `${currentPrice.toFixed(2)}` : '—'}
                                                className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono font-normal tabular-nums outline-none focus:border-emerald-500/50"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* Session composite VAH EQ VAL */}
                            <div>
                                <span className="text-[9px] text-zinc-600 uppercase tracking-wider font-medium mb-2 block">Session composite</span>
                                <div className="grid grid-cols-3 gap-3">
                                    {(['S_VAH', 'S_POC', 'S_VAL'] as KeyLevel[]).map(level => (
                                        <div key={level} className="flex items-center gap-2">
                                            <span className="text-[10px] text-zinc-500 font-mono font-normal w-14 shrink-0">{KEY_LEVEL_LABELS[level]}</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={keyLevels[level] !== undefined && keyLevels[level] !== null && keyLevels[level] !== 0 ? String(keyLevels[level]) : ''}
                                                onChange={(e) => setKeyLevels(prev => ({ ...prev, [level]: parseFloat(e.target.value) || 0 }))}
                                                placeholder={currentPrice ? `${currentPrice.toFixed(2)}` : '—'}
                                                className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono font-normal tabular-nums outline-none focus:border-emerald-500/50"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Planned Order Sizes */}
                    <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5">
                        <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">Planned Order Sizes</label>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block">Entry Low</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={plannedOrderSizes.entry_low ?? ''}
                                    onChange={(e) => setPlannedOrderSizes(prev => ({ ...prev, entry_low: parseFloat(e.target.value) || 0 }))}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block">Entry High</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={plannedOrderSizes.entry_high ?? ''}
                                    onChange={(e) => setPlannedOrderSizes(prev => ({ ...prev, entry_high: parseFloat(e.target.value) || 0 }))}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block">Stop</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={plannedOrderSizes.stop ?? ''}
                                    onChange={(e) => setPlannedOrderSizes(prev => ({ ...prev, stop: parseFloat(e.target.value) || 0 }))}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block">Target</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={plannedOrderSizes.target ?? ''}
                                    onChange={(e) => setPlannedOrderSizes(prev => ({ ...prev, target: parseFloat(e.target.value) || 0 }))}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                                />
                            </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-white/5">
                            <span className="text-[9px] text-zinc-500 uppercase font-bold block mb-2">Composite Levels</span>
                            <div className="grid grid-cols-3 gap-3">
                                {(Object.entries(keyLevels) as Array<[KeyLevel, number]>)
                                    .filter(([, v]) => v && v > 0)
                                    .map(([level]) => (
                                        <div key={`plan-size-${level}`} className="flex items-center gap-2">
                                            <span className="text-[10px] text-zinc-500 font-mono font-normal w-16 shrink-0">{KEY_LEVEL_LABELS[level] || level}</span>
                                            <input
                                                type="number"
                                                min="0"
                                                value={plannedOrderSizes[level] ?? ''}
                                                onChange={(e) => setPlannedOrderSizes(prev => ({ ...prev, [level]: parseFloat(e.target.value) || 0 }))}
                                                className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                                            />
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>

                    {/* Composite Context */}
                    <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5">
                        <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">Composite Context</label>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block mb-2">Rotation</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={valueRotationCount}
                                    onChange={(e) => setValueRotationCount(parseInt(e.target.value) || 0)}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                                />
                            </div>
                            <div>
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block mb-2">Tests</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={valueTestCount}
                                    onChange={(e) => setValueTestCount(parseInt(e.target.value) || 0)}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                                />
                            </div>
                            <div>
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block mb-2">Acceptance</span>
                                <select
                                    value={valueAcceptance}
                                    onChange={(e) => setValueAcceptance(e.target.value as any)}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none cursor-pointer"
                                >
                                    <option value="in_progress">In progress</option>
                                    <option value="accepted">Accepted</option>
                                    <option value="rejected">Rejected</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-white/5">
                            <div>
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block mb-2">Composite Tag</span>
                                <select
                                    value={compositeTag}
                                    onChange={(e) => setCompositeTag(e.target.value as any)}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none cursor-pointer"
                                >
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                    <option value="session">Session</option>
                                    <option value="stacked">Stacked</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2 pt-6">
                                <button
                                    type="button"
                                    onClick={() => setSessionCompositeEnabled(!sessionCompositeEnabled)}
                                    className={cn(
                                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                                        sessionCompositeEnabled ? "bg-emerald-500" : "bg-zinc-700"
                                    )}
                                >
                                    <span className={cn("inline-block h-3 w-3 transform rounded-full bg-white transition-transform", sessionCompositeEnabled ? "translate-x-5" : "translate-x-1")} />
                                </button>
                                <span className="text-xs text-zinc-400">Session composite enabled</span>
                            </div>
                        </div>
                        <div className="mt-3">
                            <span className="text-[9px] text-zinc-500 uppercase font-bold block mb-2">Composite Notes</span>
                            <textarea
                                value={compositeNotes}
                                onChange={(e) => setCompositeNotes(e.target.value)}
                                rows={2}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                            />
                        </div>
                    </div>

                    {/* TPO / Footprint / DOM / Tape */}
                    <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5">
                        <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">TPO / Footprint / DOM / Tape</label>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block mb-2">Footprint</span>
                                <input
                                    type="text"
                                    value={profileContext.footprint || ""}
                                    onChange={(e) => setProfileContext(prev => ({ ...prev, footprint: e.target.value }))}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                                />
                            </div>
                            <div>
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block mb-2">DOM</span>
                                <input
                                    type="text"
                                    value={profileContext.dom || ""}
                                    onChange={(e) => setProfileContext(prev => ({ ...prev, dom: e.target.value }))}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                                />
                            </div>
                            <div>
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block mb-2">Tape</span>
                                <input
                                    type="text"
                                    value={profileContext.tape || ""}
                                    onChange={(e) => setProfileContext(prev => ({ ...prev, tape: e.target.value }))}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Scenarios */}
                    <div>
                        <label className="text-[10px] text-zinc-500 uppercase font-medium tracking-wider mb-3 block">Scenarios</label>
                        <div className="space-y-2">
                            {scenarios.map((scenario) => (
                                <div key={scenario.id} className="flex items-center gap-2 p-3 rounded-xl bg-zinc-800/50">
                                    <span className="text-xs text-zinc-500 font-medium">IF</span>
                                    <select
                                        value={scenario.trigger}
                                        onChange={(e) => updateScenario(scenario.id, { trigger: e.target.value as ScenarioTrigger })}
                                        className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white font-normal outline-none"
                                    >
                                        <option value="sweep">Sweep</option>
                                        <option value="accept">Accept</option>
                                        <option value="reject">Reject</option>
                                        <option value="break">Break</option>
                                        <option value="fail">Fail</option>
                                        <option value="hold">Hold</option>
                                    </select>
                                    <select
                                        value={scenario.level}
                                        onChange={(e) => updateScenario(scenario.id, { level: e.target.value as KeyLevel })}
                                        className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white font-normal outline-none"
                                    >
                                        {KEY_LEVELS.map(l => <option key={l} value={l}>{KEY_LEVEL_LABELS[l]}</option>)}
                                    </select>
                                    <span className="text-zinc-500">→</span>
                                    <select
                                        value={scenario.action}
                                        onChange={(e) => updateScenario(scenario.id, { action: e.target.value as ScenarioAction })}
                                        className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white font-normal outline-none"
                                    >
                                        <option value="long">BUY</option>
                                        <option value="short">SELL</option>
                                        <option value="wait">WAIT</option>
                                    </select>
                                    <button
                                        onClick={() => removeScenario(scenario.id)}
                                        className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors ml-auto"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            <button
                                onClick={addScenario}
                                className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Add Scenario
                            </button>
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="text-[10px] text-zinc-500 uppercase font-medium tracking-wider mb-2 block">Notes</label>
                        <div className="relative">
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Trading notes for this coin..."
                                rows={3}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 pr-14 text-sm text-white font-normal placeholder-zinc-600 outline-none focus:border-emerald-500/50 resize-none"
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
                        {voiceError && <p className="text-[10px] text-amber-400 mt-1">{voiceError}</p>}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ============ PERP PLANS PANEL ============

function PerpPlansPanel({ onClose }: { onClose: () => void }) {
    const { connections } = usePortfolio();
    const { perpPairs, perpPairsWithExchange, isLoading: pairsLoading, hasConnectedExchanges } = useExchangePairs(connections);
    const [perpPlans, setPerpPlans] = useState<PerpPlan[]>([]);
    const [showEditor, setShowEditor] = useState(false);
    const [editingPlan, setEditingPlan] = useState<PerpPlan | null>(null);
    const [newSymbol, setNewSymbol] = useState('');
    const [showPairDropdown, setShowPairDropdown] = useState(false);
    const pairInputRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setPerpPlans(getPerpPlans());
    }, []);

    const normalizedSearch = newSymbol.trim().toUpperCase();
    const symbolNorm = normalizedSearch.endsWith('USDT') || normalizedSearch.endsWith('USDC') ? normalizedSearch : normalizedSearch + 'USDT';
    const perpSuggestions = useMemo(() =>
        filterAndSortPairSuggestions(perpPairsWithExchange, normalizedSearch, symbolNorm, hasConnectedExchanges),
        [perpPairsWithExchange, normalizedSearch, symbolNorm, hasConnectedExchanges]
    );

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (pairInputRef.current && !pairInputRef.current.contains(e.target as Node)) {
                setShowPairDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSavePlan = (plan: PerpPlan) => {
        const existing = perpPlans.findIndex(p => p.id === plan.id);
        let updated: PerpPlan[];
        if (existing >= 0) {
            updated = perpPlans.map(p => p.id === plan.id ? plan : p);
        } else {
            updated = [...perpPlans, plan];
        }
        setPerpPlans(updated);
        savePerpPlans(updated);
        setShowEditor(false);
        setEditingPlan(null);
    };

    const handleDeletePlan = (id: string) => {
        const updated = perpPlans.filter(p => p.id !== id);
        setPerpPlans(updated);
        savePerpPlans(updated);
    };

    const handleCreatePlanFromSymbol = (symbol?: string) => {
        const s = (symbol || newSymbol).trim().toUpperCase();
        if (!s) return;
        const sym = s.endsWith('USDT') || s.endsWith('USDC') || s.endsWith('USD') ? s : `${s}USDT`;
        const plan: PerpPlan = {
            id: uuidv4(),
            symbol: sym,
            bias: 'neutral',
            leverage: 1,
            keyLevels: {},
            scenarios: [],
            invalidConditions: [],
            notes: '',
            targets: [],
            isActive: true,
            handbookTemplate: "institutional_tpo_v3_5",
            touchTwoRequired: true,
            liquidityGate: {
                minDailyVolume: 50_000_000,
                minDailyTrades: 25_000,
                allowedExchanges: ["binance", "bybit"],
            },
            handbookChecklist: {
                dailyCompositeActive: false,
                touchTwoObserved: false,
                liquidityOk: false,
                exchangeOk: false,
                hierarchyOk: false,
            },
            compositeTag: "daily",
            sessionCompositeEnabled: true,
            ruleEnforcement: { mode: 'critical' },
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        setEditingPlan(plan);
        setShowEditor(true);
        setNewSymbol('');
        setShowPairDropdown(false);
    };

    return (
        <div className="space-y-8">
            {/* Section Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-violet-600/10 border border-violet-500/30 flex items-center justify-center">
                        <Zap className="w-6 h-6 text-violet-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white tracking-tight">Perpetual Trading Plans</h2>
                        <p className="text-sm text-zinc-500 mt-0.5">Define leveraged positions with key levels and scenarios</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="neo-metric card-md px-4 py-2 border neo-border">
                        <span className="text-xs text-zinc-500">Active</span>
                        <span className="ml-2 text-lg font-black text-violet-400">{perpPlans.filter(p => p.isActive).length}</span>
                    </div>
                    <div className="neo-metric card-md px-4 py-2 border neo-border">
                        <span className="text-xs text-zinc-500">Total</span>
                        <span className="ml-2 text-lg font-black text-white">{perpPlans.length}</span>
                    </div>
                </div>
            </div>

            {/* Add New - perp pairs from connected exchanges only */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="neo-card card-lg flex items-center gap-4 p-5 border border-violet-500/25"
            >
                <div className="flex-1 relative" ref={pairInputRef}>
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                        <input
                            type="text"
                            value={newSymbol}
                            onChange={(e) => {
                                setNewSymbol(e.target.value.toUpperCase());
                                setShowPairDropdown(true);
                            }}
                            onFocus={() => setShowPairDropdown(true)}
                            placeholder={hasConnectedExchanges
                                ? "Type BTC, ETH, etc. to search perp pairs"
                                : "Connect Binance, Bybit, or Hyperliquid in Settings to see perp pairs"}
                            className="w-full bg-zinc-900/80 border border-zinc-700 rounded-xl pl-11 pr-5 py-3.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500/50 transition-colors"
                            onKeyDown={(e) => e.key === 'Enter' && handleCreatePlanFromSymbol()}
                        />
                    </div>
                    {showPairDropdown && perpSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-60 overflow-y-auto rounded-xl bg-zinc-900 border border-zinc-700 shadow-xl">
                            {perpSuggestions.map(({ symbol: sym, exchange }) => (
                                <button
                                    key={`${sym}-${exchange}`}
                                    type="button"
                                    onClick={() => handleCreatePlanFromSymbol(sym)}
                                    className="w-full px-6 py-2.5 text-left text-sm text-white hover:bg-violet-500/20 flex items-center gap-3"
                                >
                                    <span
                                        className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold text-black"
                                        style={{
                                            backgroundColor: exchange === "binance" ? "#F0B90B" : exchange === "bybit" ? "#F7931A" : "#22C55E",
                                        }}
                                        title={exchange === "binance" ? "Binance Perp" : exchange === "bybit" ? "Bybit Perp" : "Hyperliquid Perp"}
                                    >
                                        {exchange === "binance" ? "B" : exchange === "bybit" ? "Y" : "H"}
                                    </span>
                                    <span className="font-mono">{sym}</span>
                                    <span className="text-[10px] text-zinc-500 ml-auto">
                                        {exchange === "binance" ? "Binance" : exchange === "bybit" ? "Bybit" : "Hyperliquid"}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                    {pairsLoading && (
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500">Loading pairs…</span>
                    )}
                </div>
                <button
                    onClick={() => handleCreatePlanFromSymbol()}
                    disabled={!newSymbol.trim() || (hasConnectedExchanges && !perpPairs.includes(symbolNorm))}
                    className={cn(
                        "flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm transition-all",
                        newSymbol.trim() && (!hasConnectedExchanges || perpPairs.includes(symbolNorm))
                            ? "bg-violet-500 text-white hover:bg-violet-400 shadow-lg shadow-violet-500/20"
                            : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                    )}
                >
                    <Plus className="w-4 h-4" />
                    Create Plan
                </button>
            </motion.div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {perpPlans.map((plan) => (
                    <motion.div
                        key={plan.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.16 }}
                        className="neo-card card-lg relative p-5 border border-zinc-700/50 hover:border-violet-500/40 transition-all duration-150 cursor-pointer group overflow-hidden"
                        onClick={() => {
                            setEditingPlan(plan);
                            setShowEditor(true);
                        }}
                    >
                        {/* Glow effect */}
                        {plan.isActive && (
                            <div className="absolute -inset-1 bg-violet-500/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        )}
                        
                        <div className="relative">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-600/10 border border-violet-500/30 flex items-center justify-center">
                                            <span className="text-violet-400 font-black text-sm">{plan.symbol.slice(0, 3)}</span>
                                        </div>
                                        <div>
                                            <div className="font-black text-white text-lg">{plan.symbol}</div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded-lg text-[10px] font-black uppercase",
                                                    plan.bias === 'long' ? "bg-emerald-500/20 text-emerald-400" :
                                                    plan.bias === 'short' ? "bg-rose-500/20 text-rose-400" :
                                                    "bg-zinc-600/30 text-zinc-400"
                                                )}>
                                                    {plan.bias}
                                                </span>
                                                {plan.leverage && plan.leverage > 1 && (
                                                    <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-400 text-[10px] font-black">{plan.leverage}x</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {(plan.keyLevels?.D_VAH || plan.keyLevels?.W_VAH || plan.keyLevels?.M_VAH || plan.keyLevels?.S_VAH) && (
                                        <span className="text-[10px] text-zinc-500 font-medium">
                                            Updated {Math.max(1, Math.floor((Date.now() - (plan.updatedAt || plan.createdAt)) / 86400000))}d ago
                                        </span>
                                    )}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeletePlan(plan.id);
                                    }}
                                    className="p-2 rounded-xl text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-zinc-500">Scenarios</span>
                                    <span className="text-zinc-300 font-medium">{plan.scenarios.length}</span>
                                </div>
                                {plan.targets.length > 0 && (
                                    <div className="flex items-center gap-2 text-[11px]">
                                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                                        <span className="text-emerald-400 font-medium">
                                            {plan.targets.slice(0, 2).map(t => `$${t.toLocaleString()}`).join(' → ')}
                                        </span>
                                    </div>
                                )}
                                {plan.stopLoss && (
                                    <div className="flex items-center gap-2 text-[11px]">
                                        <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                                        <span className="text-rose-400 font-medium">SL: ${plan.stopLoss.toLocaleString()}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {perpPlans.length === 0 && (
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="neo-card card-lg text-center py-20 border border-dashed border-zinc-700/70"
                >
                    <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center mx-auto mb-4">
                        <Zap className="w-8 h-8 text-zinc-600" />
                    </div>
                    <p className="text-base font-bold text-zinc-400">No perpetual plans yet</p>
                    <p className="text-sm text-zinc-600 mt-1">Add a trading pair above to create your first plan</p>
                </motion.div>
            )}

            {/* Perp Plan Editor Modal */}
            <AnimatePresence>
                {showEditor && editingPlan && (
                    <PerpPlanEditor
                        isOpen={showEditor}
                        plan={editingPlan}
                        onClose={() => {
                            setShowEditor(false);
                            setEditingPlan(null);
                        }}
                        onSave={handleSavePlan}
                        onDelete={() => {
                            if (editingPlan.id) handleDeletePlan(editingPlan.id);
                            setShowEditor(false);
                            setEditingPlan(null);
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// ============ PERP PLAN EDITOR ============

function PerpPlanEditor({
    isOpen,
    plan,
    onClose,
    onSave,
    onDelete,
}: {
    isOpen: boolean;
    plan: PerpPlan;
    onClose: () => void;
    onSave: (plan: PerpPlan) => void;
    onDelete: () => void;
}) {
    const [bias, setBias] = useState<BiasType>(plan.bias);
    const [leverage, setLeverage] = useState<string>(plan.leverage?.toString() || '1');
    const [keyLevels, setKeyLevels] = useState<Record<KeyLevel, number>>(
        plan.keyLevels as Record<KeyLevel, number> || {
            PDH: 0, PDL: 0, VAH: 0, VAL: 0, POC: 0, VWAP: 0,
            D_VAH: 0, D_VAL: 0, D_POC: 0, W_VAH: 0, W_VAL: 0, W_POC: 0, M_VAH: 0, M_VAL: 0, M_POC: 0,
            S_VAH: 0, S_VAL: 0, S_POC: 0
        }
    );
    const [targets, setTargets] = useState<string>(plan.targets.join(', '));
    const [stopLoss, setStopLoss] = useState<string>(plan.stopLoss?.toString() || '');
    const [entryLow, setEntryLow] = useState<string>(plan.entryZone?.low?.toString() || '');
    const [entryHigh, setEntryHigh] = useState<string>(plan.entryZone?.high?.toString() || '');
    const [notes, setNotes] = useState(plan.notes);
    const [compositeNotes, setCompositeNotes] = useState(plan.compositeNotes || '');
    const [valueRotationCount, setValueRotationCount] = useState<number>(plan.valueRotationCount || 0);
    const [valueTestCount, setValueTestCount] = useState<number>(plan.valueTestCount || 0);
    const [valueAcceptance, setValueAcceptance] = useState<"accepted" | "rejected" | "in_progress">(plan.valueAcceptance || "in_progress");
    const [profileContext, setProfileContext] = useState<{ footprint?: string; dom?: string; tape?: string }>(plan.profileContext || {});
    const [sessionCompositeEnabled, setSessionCompositeEnabled] = useState(plan.sessionCompositeEnabled ?? true);
    const [compositeTag, setCompositeTag] = useState<"daily" | "weekly" | "monthly" | "session" | "stacked">(plan.compositeTag || "daily");
    const [plannedOrderSizes, setPlannedOrderSizes] = useState<Partial<Record<KeyLevel | 'target' | 'stop' | 'entry_low' | 'entry_high', number>>>(plan.plannedOrderSizes || {});
    const [handbookTemplate] = useState<"institutional_tpo_v3_5">(plan.handbookTemplate || "institutional_tpo_v3_5");
    const [touchTwoRequired, setTouchTwoRequired] = useState(plan.touchTwoRequired ?? true);
    const [handbookChecklist, setHandbookChecklist] = useState({
        dailyCompositeActive: plan.handbookChecklist?.dailyCompositeActive ?? false,
        touchTwoObserved: plan.handbookChecklist?.touchTwoObserved ?? false,
        liquidityOk: plan.handbookChecklist?.liquidityOk ?? false,
        exchangeOk: plan.handbookChecklist?.exchangeOk ?? false,
        hierarchyOk: plan.handbookChecklist?.hierarchyOk ?? false,
    });
    const [liquidityGate, setLiquidityGate] = useState({
        minDailyVolume: plan.liquidityGate?.minDailyVolume ?? 50_000_000,
        minDailyTrades: plan.liquidityGate?.minDailyTrades ?? 25_000,
        allowedExchanges: plan.liquidityGate?.allowedExchanges ?? ["binance", "bybit"],
    });
    const [allowedExchangesText, setAllowedExchangesText] = useState(
        (plan.liquidityGate?.allowedExchanges ?? ["binance", "bybit"]).join(", ")
    );
    const { isListening, isTranscribing, error: voiceError, isSupported: voiceSupported, toggleListening } = useVoiceRecognition({
        onTranscript: (text) => setNotes(text),
    });
    const [scenarios, setScenarios] = useState<Scenario[]>(plan.scenarios);
    const [alertsCount, setAlertsCount] = useState(0);
    const [alertsSynced, setAlertsSynced] = useState(false);

    // Load existing alerts for this symbol
    useEffect(() => {
        const alerts = getPlaybookAlertsForSymbol(plan.symbol);
        setAlertsCount(alerts.length);
        setAlertsSynced(alerts.length > 0);
    }, [plan.symbol]);

    const hasEntryZone = entryLow.trim() && entryHigh.trim();
    const hasStopLoss = stopLoss.trim() && !isNaN(parseFloat(stopLoss));
    const hasTargets = targets.split(',').some(t => t.trim() && !isNaN(parseFloat(t.trim())));
    const hasNotes = notes.trim().length > 0;
    const hasKeyLevels = Object.values(keyLevels).some(v => v !== undefined && v !== null && v !== 0);
    const hasScenarios = scenarios.length > 0;
    const canSave = hasEntryZone || hasStopLoss || hasTargets || hasNotes || hasKeyLevels || hasScenarios;

    const handleSyncAlerts = () => {
        if (!canSave) return;
        // Save current plan first, then sync alerts
        handleSave();
        setTimeout(() => {
            syncPerpPlansWithAlerts();
            const alerts = getPlaybookAlertsForSymbol(plan.symbol);
            setAlertsCount(alerts.length);
            setAlertsSynced(true);
        }, 100);
    };

    const handleSave = () => {
        if (!canSave) return;
        const updatedPlan: PerpPlan = {
            ...plan,
            bias,
            leverage: parseInt(leverage) || 1,
            keyLevels,
            targets: targets.split(',').map(t => parseFloat(t.trim())).filter(t => !isNaN(t)),
            stopLoss: parseFloat(stopLoss) || undefined,
            entryZone: entryLow && entryHigh ? {
                low: parseFloat(entryLow),
                high: parseFloat(entryHigh),
            } : undefined,
            notes,
            compositeNotes,
            valueRotationCount,
            valueTestCount,
            valueAcceptance,
            profileContext,
            sessionCompositeEnabled,
            compositeTag,
            scenarios,
            plannedOrderSizes,
            handbookTemplate,
            touchTwoRequired,
            liquidityGate: {
                minDailyVolume: liquidityGate.minDailyVolume,
                minDailyTrades: liquidityGate.minDailyTrades,
                allowedExchanges: allowedExchangesText
                    .split(",")
                    .map((v) => v.trim().toLowerCase())
                    .filter(Boolean),
            },
            handbookChecklist,
            updatedAt: Date.now(),
        };
        onSave(updatedPlan);
    };

    const addScenario = () => {
        setScenarios(prev => [...prev, { 
            id: uuidv4(), 
            trigger: 'sweep', 
            level: 'VAH', 
            action: 'long' 
        }]);
    };

    const updateScenario = (id: string, updates: Partial<Scenario>) => {
        setScenarios(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    };

    const removeScenario = (id: string) => {
        setScenarios(prev => prev.filter(s => s.id !== id));
    };

    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-full max-w-2xl bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl my-8 antialiased"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                    <div className="flex items-center gap-3">
                        <TokenIcon symbol={displaySymbolForPlan(plan.symbol)} size={32} />
                        <div>
                            <h2 className="text-lg font-semibold text-white uppercase tracking-wide">{displaySymbolForPlan(plan.symbol)} Plan</h2>
                            <p className="text-[10px] text-zinc-500 font-normal">Perpetual Trading Plan</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors shrink-0"
                            title="Define bias, entry zone, targets & key levels. Add scenarios for if/then rules. Sync Alerts to create price alerts."
                        >
                            <Info className="w-4 h-4" />
                        </button>
                        {/* Sync Alerts Button */}
                        <button
                            onClick={handleSyncAlerts}
                            disabled={!canSave}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all",
                                !canSave && "opacity-50 cursor-not-allowed",
                                canSave && (alertsSynced 
                                    ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30" 
                                    : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600")
                            )}
                            title={canSave ? "Sync key levels with alerts" : "Add data before syncing alerts"}
                        >
                            <Bell className="w-3.5 h-3.5" />
                            {alertsSynced ? `${alertsCount} Alerts` : 'Sync Alerts'}
                        </button>
                        <button
                            onClick={onDelete}
                            className="p-2 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!canSave}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-colors",
                                canSave
                                    ? "bg-violet-500 text-white hover:bg-violet-400"
                                    : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                            )}
                        >
                            <Save className="w-4 h-4" />
                            Save Plan
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Bias & Leverage */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col">
                            <label className="text-[10px] text-zinc-500 uppercase font-medium tracking-wider mb-3 block">Bias</label>
                            <ToggleGroup options={BIAS_OPTIONS} value={bias} onChange={setBias} className="[&_button]:font-medium" />
                        </div>
                        <div className="flex flex-col">
                            <label className="text-[10px] text-zinc-500 uppercase font-medium tracking-wider mb-3 block">Leverage</label>
                            <input
                                type="number"
                                min="1"
                                max="125"
                                value={leverage}
                                onChange={(e) => setLeverage(e.target.value)}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono font-normal tabular-nums outline-none focus:border-violet-500/50"
                            />
                        </div>
                    </div>

                    {/* Entry Zone & Stop Loss */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col">
                            <label className="text-[10px] text-zinc-500 uppercase font-medium tracking-wider mb-2 block">Entry Zone</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    step="0.01"
                                    value={entryLow}
                                    onChange={(e) => setEntryLow(e.target.value)}
                                    placeholder="Low"
                                    className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono font-normal tabular-nums outline-none focus:border-violet-500/50"
                                />
                                <span className="text-zinc-600 shrink-0">–</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={entryHigh}
                                    onChange={(e) => setEntryHigh(e.target.value)}
                                    placeholder="High"
                                    className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono font-normal tabular-nums outline-none focus:border-violet-500/50"
                                />
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <label className="text-[10px] text-zinc-500 uppercase font-medium tracking-wider mb-2 block">Stop Loss</label>
                            <input
                                type="number"
                                step="0.01"
                                value={stopLoss}
                                onChange={(e) => setStopLoss(e.target.value)}
                                placeholder="—"
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono font-normal tabular-nums outline-none focus:border-rose-500/50"
                            />
                        </div>
                    </div>

                    {/* Targets */}
                    <div>
                        <label className="text-[10px] text-zinc-500 uppercase font-medium tracking-wider mb-2 block">Targets (comma-separated)</label>
                        <input
                            type="text"
                            value={targets}
                            onChange={(e) => setTargets(e.target.value)}
                            placeholder="100000, 105000, 110000"
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono font-normal tabular-nums outline-none focus:border-violet-500/50"
                        />
                    </div>

                    {/* Key Levels */}
                    <div>
                        <label className="text-[10px] text-zinc-500 uppercase font-medium tracking-wider mb-3 block">Key Levels</label>
                        <div className="space-y-4">
                            {/* Session */}
                            <div className="grid grid-cols-3 gap-3">
                                {(['PDH', 'PDL', 'VAH', 'VAL', 'POC'] as KeyLevel[]).map(level => (
                                    <div key={level} className="flex items-center gap-2">
                                        <span className="text-[10px] text-zinc-500 font-mono font-normal w-12 shrink-0">{level}</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={keyLevels[level] !== undefined && keyLevels[level] !== null && keyLevels[level] !== 0 ? String(keyLevels[level]) : ''}
                                            onChange={(e) => setKeyLevels(prev => ({ ...prev, [level]: parseFloat(e.target.value) || 0 }))}
                                            placeholder="—"
                                            className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono font-normal tabular-nums outline-none focus:border-violet-500/50"
                                        />
                                    </div>
                                ))}
                            </div>
                            {/* Daily composite VAH EQ VAL */}
                            <div className="pt-3 border-t border-zinc-800">
                                <span className="text-[9px] text-zinc-600 uppercase tracking-wider font-medium mb-2 block">Daily composite</span>
                                <div className="grid grid-cols-3 gap-3">
                                    {(['D_VAH', 'D_POC', 'D_VAL'] as KeyLevel[]).map(level => (
                                        <div key={level} className="flex items-center gap-2">
                                            <span className="text-[10px] text-zinc-500 font-mono font-normal w-14 shrink-0">{KEY_LEVEL_LABELS[level]}</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={keyLevels[level] !== undefined && keyLevels[level] !== null && keyLevels[level] !== 0 ? String(keyLevels[level]) : ''}
                                                onChange={(e) => setKeyLevels(prev => ({ ...prev, [level]: parseFloat(e.target.value) || 0 }))}
                                                placeholder="—"
                                                className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono font-normal tabular-nums outline-none focus:border-violet-500/50"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* Same week composite VAH EQ VAL */}
                            <div>
                                <span className="text-[9px] text-zinc-600 uppercase tracking-wider font-medium mb-2 block">Same week composite</span>
                                <div className="grid grid-cols-3 gap-3">
                                    {(['W_VAH', 'W_POC', 'W_VAL'] as KeyLevel[]).map(level => (
                                        <div key={level} className="flex items-center gap-2">
                                            <span className="text-[10px] text-zinc-500 font-mono font-normal w-14 shrink-0">{KEY_LEVEL_LABELS[level]}</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={keyLevels[level] !== undefined && keyLevels[level] !== null && keyLevels[level] !== 0 ? String(keyLevels[level]) : ''}
                                                onChange={(e) => setKeyLevels(prev => ({ ...prev, [level]: parseFloat(e.target.value) || 0 }))}
                                                placeholder="—"
                                                className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono font-normal tabular-nums outline-none focus:border-violet-500/50"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* Monthly composite VAH EQ VAL */}
                            <div>
                                <span className="text-[9px] text-zinc-600 uppercase tracking-wider font-medium mb-2 block">Monthly composite</span>
                                <div className="grid grid-cols-3 gap-3">
                                    {(['M_VAH', 'M_POC', 'M_VAL'] as KeyLevel[]).map(level => (
                                        <div key={level} className="flex items-center gap-2">
                                            <span className="text-[10px] text-zinc-500 font-mono font-normal w-14 shrink-0">{KEY_LEVEL_LABELS[level]}</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={keyLevels[level] !== undefined && keyLevels[level] !== null && keyLevels[level] !== 0 ? String(keyLevels[level]) : ''}
                                                onChange={(e) => setKeyLevels(prev => ({ ...prev, [level]: parseFloat(e.target.value) || 0 }))}
                                                placeholder="—"
                                                className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono font-normal tabular-nums outline-none focus:border-violet-500/50"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* Session composite VAH EQ VAL */}
                            <div>
                                <span className="text-[9px] text-zinc-600 uppercase tracking-wider font-medium mb-2 block">Session composite</span>
                                <div className="grid grid-cols-3 gap-3">
                                    {(['S_VAH', 'S_POC', 'S_VAL'] as KeyLevel[]).map(level => (
                                        <div key={level} className="flex items-center gap-2">
                                            <span className="text-[10px] text-zinc-500 font-mono font-normal w-14 shrink-0">{KEY_LEVEL_LABELS[level]}</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={keyLevels[level] !== undefined && keyLevels[level] !== null && keyLevels[level] !== 0 ? String(keyLevels[level]) : ''}
                                                onChange={(e) => setKeyLevels(prev => ({ ...prev, [level]: parseFloat(e.target.value) || 0 }))}
                                                placeholder="—"
                                                className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono font-normal tabular-nums outline-none focus:border-violet-500/50"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Planned Order Sizes */}
                    <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5">
                        <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">Planned Order Sizes</label>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block">Entry Low</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={plannedOrderSizes.entry_low ?? ''}
                                    onChange={(e) => setPlannedOrderSizes(prev => ({ ...prev, entry_low: parseFloat(e.target.value) || 0 }))}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block">Entry High</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={plannedOrderSizes.entry_high ?? ''}
                                    onChange={(e) => setPlannedOrderSizes(prev => ({ ...prev, entry_high: parseFloat(e.target.value) || 0 }))}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block">Stop</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={plannedOrderSizes.stop ?? ''}
                                    onChange={(e) => setPlannedOrderSizes(prev => ({ ...prev, stop: parseFloat(e.target.value) || 0 }))}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block">Target</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={plannedOrderSizes.target ?? ''}
                                    onChange={(e) => setPlannedOrderSizes(prev => ({ ...prev, target: parseFloat(e.target.value) || 0 }))}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                                />
                            </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-white/5">
                            <span className="text-[9px] text-zinc-500 uppercase font-bold block mb-2">Composite Levels</span>
                            <div className="grid grid-cols-3 gap-3">
                                {(Object.entries(keyLevels) as Array<[KeyLevel, number]>)
                                    .filter(([, v]) => v && v > 0)
                                    .map(([level]) => (
                                        <div key={`perp-plan-size-${level}`} className="flex items-center gap-2">
                                            <span className="text-[10px] text-zinc-500 font-mono font-normal w-16 shrink-0">{KEY_LEVEL_LABELS[level] || level}</span>
                                            <input
                                                type="number"
                                                min="0"
                                                value={plannedOrderSizes[level] ?? ''}
                                                onChange={(e) => setPlannedOrderSizes(prev => ({ ...prev, [level]: parseFloat(e.target.value) || 0 }))}
                                                className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                                            />
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>

                    {/* Institutional Handbook (Perp) */}
                    <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Institutional Handbook (Perp)</label>
                            <span className="text-[10px] text-zinc-500">Template: {handbookTemplate}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <label className="flex items-center gap-2 text-xs text-zinc-300">
                                <input type="checkbox" checked={touchTwoRequired} onChange={(e) => setTouchTwoRequired(e.target.checked)} className="h-3.5 w-3.5 accent-violet-500" />
                                Touch 2 required
                            </label>
                            <label className="flex items-center gap-2 text-xs text-zinc-300">
                                <input type="checkbox" checked={handbookChecklist.touchTwoObserved} onChange={(e) => setHandbookChecklist(prev => ({ ...prev, touchTwoObserved: e.target.checked }))} className="h-3.5 w-3.5 accent-emerald-500" />
                                Touch 2 observed
                            </label>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-3">
                            <div className="space-y-2">
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block">Min 24h Volume</span>
                                <input type="number" min="0" value={liquidityGate.minDailyVolume ?? 0} onChange={(e) => setLiquidityGate(prev => ({ ...prev, minDailyVolume: parseFloat(e.target.value) || 0 }))} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none" />
                            </div>
                            <div className="space-y-2">
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block">Min 24h Trades</span>
                                <input type="number" min="0" value={liquidityGate.minDailyTrades ?? 0} onChange={(e) => setLiquidityGate(prev => ({ ...prev, minDailyTrades: parseFloat(e.target.value) || 0 }))} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none" />
                            </div>
                        </div>
                        <div className="mt-3">
                            <span className="text-[9px] text-zinc-500 uppercase font-bold block mb-2">Allowed Exchanges</span>
                            <input type="text" value={allowedExchangesText} onChange={(e) => setAllowedExchangesText(e.target.value)} placeholder="binance, bybit" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none" />
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-3">
                            <label className="flex items-center gap-2 text-xs text-zinc-400">
                                <input type="checkbox" checked={handbookChecklist.dailyCompositeActive} onChange={(e) => setHandbookChecklist(prev => ({ ...prev, dailyCompositeActive: e.target.checked }))} className="h-3.5 w-3.5 accent-emerald-500" />
                                Daily composite active
                            </label>
                            <label className="flex items-center gap-2 text-xs text-zinc-400">
                                <input type="checkbox" checked={handbookChecklist.hierarchyOk} onChange={(e) => setHandbookChecklist(prev => ({ ...prev, hierarchyOk: e.target.checked }))} className="h-3.5 w-3.5 accent-emerald-500" />
                                Hierarchy respected
                            </label>
                            <label className="flex items-center gap-2 text-xs text-zinc-400">
                                <input type="checkbox" checked={handbookChecklist.liquidityOk} onChange={(e) => setHandbookChecklist(prev => ({ ...prev, liquidityOk: e.target.checked }))} className="h-3.5 w-3.5 accent-emerald-500" />
                                Liquidity gate ok
                            </label>
                            <label className="flex items-center gap-2 text-xs text-zinc-400">
                                <input type="checkbox" checked={handbookChecklist.exchangeOk} onChange={(e) => setHandbookChecklist(prev => ({ ...prev, exchangeOk: e.target.checked }))} className="h-3.5 w-3.5 accent-emerald-500" />
                                Exchange scope ok
                            </label>
                        </div>
                    </div>

                    {/* Composite Context */}
                    <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5">
                        <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">Composite Context</label>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block mb-2">Rotation</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={valueRotationCount}
                                    onChange={(e) => setValueRotationCount(parseInt(e.target.value) || 0)}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                                />
                            </div>
                            <div>
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block mb-2">Tests</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={valueTestCount}
                                    onChange={(e) => setValueTestCount(parseInt(e.target.value) || 0)}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                                />
                            </div>
                            <div>
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block mb-2">Acceptance</span>
                                <select
                                    value={valueAcceptance}
                                    onChange={(e) => setValueAcceptance(e.target.value as any)}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none cursor-pointer"
                                >
                                    <option value="in_progress">In progress</option>
                                    <option value="accepted">Accepted</option>
                                    <option value="rejected">Rejected</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-white/5">
                            <div>
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block mb-2">Composite Tag</span>
                                <select
                                    value={compositeTag}
                                    onChange={(e) => setCompositeTag(e.target.value as any)}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none cursor-pointer"
                                >
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                    <option value="session">Session</option>
                                    <option value="stacked">Stacked</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2 pt-6">
                                <button
                                    type="button"
                                    onClick={() => setSessionCompositeEnabled(!sessionCompositeEnabled)}
                                    className={cn(
                                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                                        sessionCompositeEnabled ? "bg-emerald-500" : "bg-zinc-700"
                                    )}
                                >
                                    <span className={cn("inline-block h-3 w-3 transform rounded-full bg-white transition-transform", sessionCompositeEnabled ? "translate-x-5" : "translate-x-1")} />
                                </button>
                                <span className="text-xs text-zinc-400">Session composite enabled</span>
                            </div>
                        </div>
                        <div className="mt-3">
                            <span className="text-[9px] text-zinc-500 uppercase font-bold block mb-2">Composite Notes</span>
                            <textarea
                                value={compositeNotes}
                                onChange={(e) => setCompositeNotes(e.target.value)}
                                rows={2}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                            />
                        </div>
                    </div>

                    {/* TPO / Footprint / DOM / Tape */}
                    <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5">
                        <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">TPO / Footprint / DOM / Tape</label>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block mb-2">Footprint</span>
                                <input
                                    type="text"
                                    value={profileContext.footprint || ""}
                                    onChange={(e) => setProfileContext(prev => ({ ...prev, footprint: e.target.value }))}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                                />
                            </div>
                            <div>
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block mb-2">DOM</span>
                                <input
                                    type="text"
                                    value={profileContext.dom || ""}
                                    onChange={(e) => setProfileContext(prev => ({ ...prev, dom: e.target.value }))}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                                />
                            </div>
                            <div>
                                <span className="text-[9px] text-zinc-500 uppercase font-bold block mb-2">Tape</span>
                                <input
                                    type="text"
                                    value={profileContext.tape || ""}
                                    onChange={(e) => setProfileContext(prev => ({ ...prev, tape: e.target.value }))}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Scenarios */}
                    <div>
                        <label className="text-[10px] text-zinc-500 uppercase font-medium tracking-wider mb-3 block">Scenarios</label>
                        <div className="space-y-2">
                            {scenarios.map((scenario) => (
                                <div key={scenario.id} className="flex items-center gap-2 p-3 rounded-xl bg-zinc-800/50">
                                    <span className="text-xs text-zinc-500 font-medium">IF</span>
                                    <select
                                        value={scenario.trigger}
                                        onChange={(e) => updateScenario(scenario.id, { trigger: e.target.value as ScenarioTrigger })}
                                        className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white font-normal outline-none"
                                    >
                                        <option value="sweep">Sweep</option>
                                        <option value="accept">Accept</option>
                                        <option value="reject">Reject</option>
                                        <option value="break">Break</option>
                                        <option value="fail">Fail</option>
                                        <option value="hold">Hold</option>
                                    </select>
                                    <select
                                        value={scenario.level}
                                        onChange={(e) => updateScenario(scenario.id, { level: e.target.value as KeyLevel })}
                                        className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white font-normal outline-none"
                                    >
                                        {KEY_LEVELS.map(l => <option key={l} value={l}>{KEY_LEVEL_LABELS[l]}</option>)}
                                    </select>
                                    <span className="text-zinc-500">→</span>
                                    <select
                                        value={scenario.action}
                                        onChange={(e) => updateScenario(scenario.id, { action: e.target.value as ScenarioAction })}
                                        className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white font-normal outline-none"
                                    >
                                        <option value="long">LONG</option>
                                        <option value="short">SHORT</option>
                                        <option value="wait">WAIT</option>
                                        <option value="exit">EXIT</option>
                                    </select>
                                    <button
                                        onClick={() => removeScenario(scenario.id)}
                                        className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors ml-auto"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            <button
                                onClick={addScenario}
                                className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors font-normal"
                            >
                                <Plus className="w-4 h-4" />
                                Add Scenario
                            </button>
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="text-[10px] text-zinc-500 uppercase font-medium tracking-wider mb-2 block">Notes</label>
                        <div className="relative">
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Trading notes for this pair..."
                                rows={3}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 pr-14 text-sm text-white font-normal placeholder-zinc-600 outline-none focus:border-violet-500/50 resize-none"
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
                        {voiceError && <p className="text-[10px] text-amber-400 mt-1">{voiceError}</p>}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ============ MAIN COMPONENT ============

export function TradingSessionManager() {
    const [mounted, setMounted] = useState(false);
    const [activeTab, setActiveTab] = useState<PlanTab>('spot');
    const [activeSession, setActiveSession] = useState<TradingSession | null>(null);
    const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
    const [spotPlans, setSpotPlans] = useState<SpotPlan[]>([]);
    const [perpPlans, setPerpPlans] = useState<PerpPlan[]>([]);
    const [showPlaybooks, setShowPlaybooks] = useState(false);
    const [showCreator, setShowCreator] = useState(false);
    const [editingPlaybook, setEditingPlaybook] = useState<Playbook | null>(null);
    const [stats, setStats] = useState({ symbolsObserved: 3, tradesTracked: 12 });

    // Load data on mount
    useEffect(() => {
        setMounted(true);
        setActiveSession(getActiveSession());
        setPlaybooks(getPlaybooks());
        setSpotPlans(getSpotPlans());
        setPerpPlans(getPerpPlans());
        setStats(getSessionStats());
        
        // Listen for plan updates
        const handleSpotUpdate = () => setSpotPlans(getSpotPlans());
        const handlePerpUpdate = () => setPerpPlans(getPerpPlans());
        window.addEventListener('spot-plans-updated', handleSpotUpdate);
        window.addEventListener('perp-plans-updated', handlePerpUpdate);
        return () => {
            window.removeEventListener('spot-plans-updated', handleSpotUpdate);
            window.removeEventListener('perp-plans-updated', handlePerpUpdate);
        };
    }, []);

    const handleStartSession = (session: TradingSession) => {
        setActiveSession(session);
        saveActiveSession(session);
    };

    const handleAddNote = (content: string) => {
        if (!activeSession) return;
        const note: SessionNote = {
            id: uuidv4(),
            timestamp: Date.now(),
            content,
        };
        const updated = { ...activeSession, notes: [...activeSession.notes, note] };
        setActiveSession(updated);
        saveActiveSession(updated);
    };

    const handleEndSession = () => {
        if (!activeSession) return;
        const ended = { ...activeSession, isActive: false, endTime: Date.now() };
        const sessions = getSessions();
        saveSessions([...sessions, ended]);
        setActiveSession(null);
        saveActiveSession(null);
    };

    const handleSelectPlaybook = (playbook: Playbook) => {
        setShowPlaybooks(false);
        // Pre-fill session with playbook defaults
        const session: TradingSession = {
            id: uuidv4(),
            startTime: Date.now(),
            bias: playbook.defaultBias,
            horizon: 'intraday',
            risk: 'normal',
            context: [],
            initialNote: `Loaded playbook: ${playbook.name}`,
            notes: [],
            playbook: playbook.id,
            isActive: true,
            stats,
        };
        handleStartSession(session);
    };

    const handleSavePlaybook = (playbook: Playbook) => {
        const existing = playbooks.findIndex(p => p.id === playbook.id);
        let updated: Playbook[];
        if (existing >= 0) {
            updated = playbooks.map(p => p.id === playbook.id ? playbook : p);
        } else {
            updated = [...playbooks, playbook];
        }
        setPlaybooks(updated);
        savePlaybooks(updated);
        setEditingPlaybook(null);
    };

    const handleDeletePlaybook = (id: string) => {
        const updated = playbooks.filter(p => p.id !== id);
        setPlaybooks(updated);
        savePlaybooks(updated);
    };

    const handleEditPlaybook = (playbook: Playbook) => {
        setEditingPlaybook(playbook);
        setShowPlaybooks(false);
        setShowCreator(true);
    };

    const handleCreateNew = () => {
        setEditingPlaybook(null);
        setShowPlaybooks(false);
        setShowCreator(true);
    };

    if (!mounted) {
        return (
            <div className="min-h-screen bg-[#141310] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="journal-neo-active relative overflow-hidden">
            {/* Main Content */}
            <div className="relative z-10">
                {/* Page Header */}
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.16, ease: "easeOut" }}
                    className="mb-4"
                >
                    <div className="tm-page-header neo-header">
                        <div className="tm-page-header-main">
                            <div className="tm-page-header-icon border-sky-500/35 bg-gradient-to-br from-sky-500/20 to-cyan-500/10">
                                <BookOpen className="h-5 w-5 text-sky-300" />
                            </div>
                            <div>
                                <h1 className="tm-page-title title-lg">Playbook</h1>
                                <p className="tm-page-subtitle">Manage your trading plans, sessions, and institutional strategies.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <motion.div 
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.16, delay: 0.08 }}
                                className="neo-chip text-sky-200"
                            >
                                <div className="w-2 h-2 rounded-full bg-[var(--neo-live)] animate-pulse" />
                                <span className="text-xs">
                                    {spotPlans.filter(p => p.isActive).length + perpPlans.filter(p => p.isActive).length} Active Plans
                                </span>
                            </motion.div>
                        </div>
                    </div>
                </motion.div>

                {/* Tab Navigation */}
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.16, delay: 0.04 }}
                    className="mb-6"
                >
                    <div className="tm-tab-shell neo-shell p-2 w-fit">
                        <button
                            onClick={() => setActiveTab('spot')}
                            className={cn(
                                "neo-tab relative px-6 py-3 rounded-xl text-sm font-bold transition-all duration-150 border",
                                activeTab === 'spot'
                                    ? "text-sky-100 border-sky-500/45 bg-sky-500/15"
                                    : "text-zinc-400 border-transparent hover:text-white hover:bg-white/5"
                            )}
                            data-state={activeTab === "spot" ? "active" : "inactive"}
                        >
                            <span className="relative flex items-center gap-2">
                                <Target className="w-4 h-4" />
                                Spot Plans
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveTab('perp')}
                            className={cn(
                                "neo-tab relative px-6 py-3 rounded-xl text-sm font-bold transition-all duration-150 border",
                                activeTab === 'perp'
                                    ? "text-sky-100 border-sky-500/45 bg-sky-500/15"
                                    : "text-zinc-400 border-transparent hover:text-white hover:bg-white/5"
                            )}
                            data-state={activeTab === "perp" ? "active" : "inactive"}
                        >
                            <span className="relative flex items-center gap-2">
                                <Zap className="w-4 h-4" />
                                Perp Plans
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveTab('session')}
                            className={cn(
                                "neo-tab relative px-6 py-3 rounded-xl text-sm font-bold transition-all duration-150 border",
                                activeTab === 'session'
                                    ? "text-sky-100 border-sky-500/45 bg-sky-500/15"
                                    : "text-zinc-400 border-transparent hover:text-white hover:bg-white/5"
                            )}
                            data-state={activeTab === "session" ? "active" : "inactive"}
                        >
                            <span className="relative flex items-center gap-2">
                                <BookOpen className="w-4 h-4" />
                                Session & Playbooks
                            </span>
                        </button>
                    </div>
                </motion.div>

                {/* Tab Content */}
                <div className={cn(
                    "w-full",
                    (activeTab === 'spot' || activeTab === 'perp') && "grid gap-6 lg:grid-cols-12"
                )}>
                    <AnimatePresence mode="wait">
                        {activeTab === 'spot' && (
                            <motion.div
                                key="spot"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.16, ease: "easeOut" }}
                                className="lg:col-span-9"
                            >
                                <SpotPlansPanel onClose={() => {}} />
                            </motion.div>
                        )}

                        {activeTab === 'perp' && (
                            <motion.div
                                key="perp"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.16, ease: "easeOut" }}
                                className="lg:col-span-9"
                            >
                                <PerpPlansPanel onClose={() => {}} />
                            </motion.div>
                        )}

                        {activeTab === 'session' && (
                            <motion.div
                                key="session"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.16, ease: "easeOut" }}
                                className="flex items-center justify-center min-h-[60vh] col-span-full"
                            >
                                {activeSession ? (
                                    <SessionActive
                                        session={activeSession}
                                        onAddNote={handleAddNote}
                                        onEndSession={handleEndSession}
                                        onOpenPlaybooks={() => setShowPlaybooks(true)}
                                        stats={stats}
                                    />
                                ) : (
                                    <SessionIntent
                                        onStartSession={handleStartSession}
                                        onLoadPlaybook={() => setShowPlaybooks(true)}
                                        stats={stats}
                                    />
                                )}
                            </motion.div>
                        )}

                        {/* Playbook AI Feed - shown when Spot or Perp tab is active */}
                        {(activeTab === 'spot' || activeTab === 'perp') && (
                            <div className="lg:col-span-3 order-first lg:order-last">
                                <div className="sticky top-4">
                                    <PlaybookDedicatedFeed
                                        spotPlans={spotPlans}
                                        perpPlans={perpPlans}
                                    />
                                </div>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Playbooks Modal */}
            <AnimatePresence>
                {showPlaybooks && (
                    <PlaybooksModal
                        isOpen={showPlaybooks}
                        onClose={() => setShowPlaybooks(false)}
                        playbooks={playbooks}
                        onSelect={handleSelectPlaybook}
                        onCreateNew={handleCreateNew}
                        onEdit={handleEditPlaybook}
                        onDelete={handleDeletePlaybook}
                    />
                )}
            </AnimatePresence>

            {/* Playbook Creator */}
            <AnimatePresence>
                {showCreator && (
                    <PlaybookCreator
                        isOpen={showCreator}
                        onClose={() => {
                            setShowCreator(false);
                            setEditingPlaybook(null);
                        }}
                        onSave={handleSavePlaybook}
                        editPlaybook={editingPlaybook}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

export default TradingSessionManager;
