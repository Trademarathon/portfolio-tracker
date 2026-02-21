"use client";

import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { STRATEGY_TAGS } from "@/lib/api/journal-types";
import { getPlaybooks, getSpotPlans, getPerpPlans, Playbook, SpotPlan, PerpPlan } from "@/lib/api/session";
import {
    Clock,
    Globe,
    Filter,
    Tag,
    Search,
    Edit2,
    Plus,
    RotateCcw,
    BookOpen,
    BookMarked,
    Target,
    Shield,
    Zap,
    Radio,
    Bell,
    Eye,
    EyeOff,
    TrendingUp,
    TrendingDown,
    Trash2,
} from "lucide-react";

// Timezone options
const TIMEZONES = [
    { value: 'UTC', label: 'UTC' },
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'Europe/London', label: 'London (GMT)' },
    { value: 'Europe/Paris', label: 'Central European Time (CET)' },
    { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)' },
    { value: 'Asia/Singapore', label: 'Singapore Time (SGT)' },
    { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET)' },
];

// LocalStorage keys
const JOURNAL_PREFERENCES_KEY = 'journal_preferences';
const JOURNAL_PERMANENT_FILTERS_KEY = 'journal_permanent_filters';
const PLAYBOOK_SETTINGS_KEY = 'playbook_settings';

interface JournalPreferences {
    timeFormat: '12h' | '24h';
    timezone: string;
    breakevenEnabled: boolean;
    breakevenRange: number;
    permanentFiltersEnabled: boolean;
    hideBalances: boolean;
}

interface JournalFilters {
    status: 'all' | 'open' | 'closed';
    side: 'all' | 'long' | 'short';
    symbols: string[];
    tags: string[];
    exchange: string;
    minPnl: number | null;
    maxPnl: number | null;
    minHoldTime: number | null;
    maxHoldTime: number | null;
}

interface PlaybookSettings {
    autoSyncAlerts: boolean;
    defaultLeverage: number;
    defaultRiskPercent: number;
    showInactivePlaybooks: boolean;
    autoArchiveCompletedPlans: boolean;
    alertSound: boolean;
    browserNotifications: boolean;
    compositeTolerancePct: number;
}

const defaultPreferences: JournalPreferences = {
    timeFormat: '24h',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    breakevenEnabled: true,
    breakevenRange: 2.5,
    permanentFiltersEnabled: false,
    hideBalances: false,
};

const defaultFilters: JournalFilters = {
    status: 'all',
    side: 'all',
    symbols: [],
    tags: [],
    exchange: '',
    minPnl: null,
    maxPnl: null,
    minHoldTime: null,
    maxHoldTime: null,
};

const defaultPlaybookSettings: PlaybookSettings = {
    autoSyncAlerts: true,
    defaultLeverage: 5,
    defaultRiskPercent: 1,
    showInactivePlaybooks: false,
    autoArchiveCompletedPlans: false,
    alertSound: true,
    browserNotifications: true,
    compositeTolerancePct: 0.25,
};

export function JournalPlaybookSettings() {
    // Journal settings state
    const [preferences, setPreferencesState] = useState<JournalPreferences>(defaultPreferences);
    const [permanentFilters, setPermanentFiltersState] = useState<JournalFilters>(defaultFilters);
    const [tagSearch, setTagSearch] = useState('');
    
    // Playbook settings state
    const [playbookSettings, setPlaybookSettingsState] = useState<PlaybookSettings>(defaultPlaybookSettings);
    const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
    const [spotPlans, setSpotPlans] = useState<SpotPlan[]>([]);
    const [perpPlans, setPerpPlans] = useState<PerpPlan[]>([]);
    
    // Load settings on mount
    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        try {
            // Load journal preferences
            const savedPrefs = localStorage.getItem(JOURNAL_PREFERENCES_KEY);
            if (savedPrefs) {
                setPreferencesState({ ...defaultPreferences, ...JSON.parse(savedPrefs) });
            }
            
            // Load permanent filters
            const savedFilters = localStorage.getItem(JOURNAL_PERMANENT_FILTERS_KEY);
            if (savedFilters) {
                setPermanentFiltersState({ ...defaultFilters, ...JSON.parse(savedFilters) });
            }
            
            // Load playbook settings
            const savedPlaybookSettings = localStorage.getItem(PLAYBOOK_SETTINGS_KEY);
            if (savedPlaybookSettings) {
                setPlaybookSettingsState({ ...defaultPlaybookSettings, ...JSON.parse(savedPlaybookSettings) });
            }
            
            // Load playbooks and plans
            setPlaybooks(getPlaybooks());
            setSpotPlans(getSpotPlans());
            setPerpPlans(getPerpPlans());
        } catch (e) {
            console.error('Failed to load settings:', e);
        }
    }, []);
    
    // Save journal preferences
    const setPreferences = (prefs: Partial<JournalPreferences>) => {
        const newPrefs = { ...preferences, ...prefs };
        setPreferencesState(newPrefs);
        localStorage.setItem(JOURNAL_PREFERENCES_KEY, JSON.stringify(newPrefs));
        // Dispatch event for other components
        window.dispatchEvent(new CustomEvent('journal-preferences-updated', { detail: newPrefs }));
    };
    
    // Save permanent filters
    const setPermanentFilters = (filters: JournalFilters) => {
        setPermanentFiltersState(filters);
        localStorage.setItem(JOURNAL_PERMANENT_FILTERS_KEY, JSON.stringify(filters));
        window.dispatchEvent(new CustomEvent('journal-filters-updated', { detail: filters }));
    };
    
    // Save playbook settings
    const setPlaybookSettings = (settings: Partial<PlaybookSettings>) => {
        const newSettings = { ...playbookSettings, ...settings };
        setPlaybookSettingsState(newSettings);
        localStorage.setItem(PLAYBOOK_SETTINGS_KEY, JSON.stringify(newSettings));
        window.dispatchEvent(new CustomEvent('playbook-settings-updated', { detail: newSettings }));
    };
    
    // Filter tags by search
    const filteredTags = useMemo(() => {
        if (!tagSearch) return STRATEGY_TAGS;
        return STRATEGY_TAGS.filter(tag =>
            tag.name.toLowerCase().includes(tagSearch.toLowerCase())
        );
    }, [tagSearch]);
    
    // Reset filters
    const handleResetFilters = () => {
        setPermanentFilters(defaultFilters);
    };
    
    // Stats
    const activeSpotPlans = spotPlans.filter(p => p.isActive).length;
    const activePerpPlans = perpPlans.filter(p => p.isActive).length;
    
    return (
        <div className="space-y-6">
            {/* ============ JOURNAL SETTINGS ============ */}
            <div className="border-b border-zinc-800 pb-2 mb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-emerald-400" />
                    Journal Settings
                </h3>
            </div>
            
            {/* Time Settings */}
            <Card className="bg-card/50 backdrop-blur-xl border-border">
                <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Clock className="h-4 w-4 text-blue-400" />
                        Time Settings
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        {/* Time Format */}
                        <div>
                            <label className="text-xs text-zinc-500 uppercase tracking-wider mb-2 block">Time Format</label>
                            <div className="flex rounded-lg overflow-hidden border border-zinc-700/50">
                                <button
                                    onClick={() => setPreferences({ timeFormat: '24h' })}
                                    className={cn(
                                        "flex-1 px-3 py-2 text-xs font-medium transition-colors",
                                        preferences.timeFormat === '24h'
                                            ? "bg-emerald-500 text-black"
                                            : "bg-zinc-800 text-zinc-400 hover:text-white"
                                    )}
                                >
                                    24h
                                </button>
                                <button
                                    onClick={() => setPreferences({ timeFormat: '12h' })}
                                    className={cn(
                                        "flex-1 px-3 py-2 text-xs font-medium transition-colors",
                                        preferences.timeFormat === '12h'
                                            ? "bg-emerald-500 text-black"
                                            : "bg-zinc-800 text-zinc-400 hover:text-white"
                                    )}
                                >
                                    AM/PM
                                </button>
                            </div>
                        </div>
                        
                        {/* Timezone */}
                        <div>
                            <label className="text-xs text-zinc-500 uppercase tracking-wider mb-2 block">Timezone</label>
                            <div className="relative">
                                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                <select
                                    value={preferences.timezone}
                                    onChange={(e) => setPreferences({ timezone: e.target.value })}
                                    className="w-full pl-10 pr-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700/50 text-sm text-white appearance-none cursor-pointer focus:outline-none focus:border-emerald-500/50"
                                >
                                    {TIMEZONES.map(tz => (
                                        <option key={tz.value} value={tz.value}>{tz.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
            
            {/* Breakeven Filter */}
            <Card className="bg-card/50 backdrop-blur-xl border-border">
                <CardHeader className="pb-4">
                    <CardTitle className="flex items-center justify-between text-base">
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-amber-400" />
                            Breakeven Filter
                        </div>
                        <button
                            onClick={() => setPreferences({ breakevenEnabled: !preferences.breakevenEnabled })}
                            className={cn(
                                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                                preferences.breakevenEnabled ? "bg-emerald-500" : "bg-zinc-700"
                            )}
                        >
                            <span className={cn("inline-block h-3 w-3 transform rounded-full bg-white transition-transform", preferences.breakevenEnabled ? "translate-x-5" : "translate-x-1")} />
                        </button>
                    </CardTitle>
                </CardHeader>
                {preferences.breakevenEnabled && (
                    <CardContent className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-xs text-zinc-500">Breakeven Range</label>
                            <span className="text-sm font-bold text-white">${preferences.breakevenRange.toFixed(2)}</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="10"
                            step="0.5"
                            value={preferences.breakevenRange}
                            onChange={(e) => setPreferences({ breakevenRange: parseFloat(e.target.value) })}
                            className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                        <p className="text-[10px] text-zinc-500">
                            Trades with PnL between -${preferences.breakevenRange.toFixed(2)} and +${preferences.breakevenRange.toFixed(2)} will be counted as breakeven.
                        </p>
                    </CardContent>
                )}
            </Card>
            
            {/* Permanent Filters */}
            <Card className="bg-card/50 backdrop-blur-xl border-border">
                <CardHeader className="pb-4">
                    <CardTitle className="flex items-center justify-between text-base">
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-violet-400" />
                            Permanent Filters
                        </div>
                        <button
                            onClick={() => setPreferences({ permanentFiltersEnabled: !preferences.permanentFiltersEnabled })}
                            className={cn(
                                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                                preferences.permanentFiltersEnabled ? "bg-emerald-500" : "bg-zinc-700"
                            )}
                        >
                            <span className={cn("inline-block h-3 w-3 transform rounded-full bg-white transition-transform", preferences.permanentFiltersEnabled ? "translate-x-5" : "translate-x-1")} />
                        </button>
                    </CardTitle>
                </CardHeader>
                {preferences.permanentFiltersEnabled && (
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="text-xs text-zinc-500 mb-1 block">Status</label>
                                <select
                                    value={permanentFilters.status}
                                    onChange={(e) => setPermanentFilters({ ...permanentFilters, status: e.target.value as any })}
                                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700/50 text-sm text-white"
                                >
                                    <option value="all">All</option>
                                    <option value="open">Open</option>
                                    <option value="closed">Closed</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-zinc-500 mb-1 block">Side</label>
                                <select
                                    value={permanentFilters.side}
                                    onChange={(e) => setPermanentFilters({ ...permanentFilters, side: e.target.value as any })}
                                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700/50 text-sm text-white"
                                >
                                    <option value="all">All</option>
                                    <option value="long">Long</option>
                                    <option value="short">Short</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-zinc-500 mb-1 block">Exchange</label>
                                <input
                                    type="text"
                                    value={permanentFilters.exchange}
                                    onChange={(e) => setPermanentFilters({ ...permanentFilters, exchange: e.target.value })}
                                    placeholder="All"
                                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700/50 text-sm text-white placeholder:text-zinc-500"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <button
                                onClick={handleResetFilters}
                                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white"
                            >
                                <RotateCcw className="w-3 h-3" />
                                Reset
                            </button>
                        </div>
                    </CardContent>
                )}
            </Card>
            
            {/* Hide Balances */}
            <Card className="bg-card/50 backdrop-blur-xl border-border">
                <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {preferences.hideBalances ? (
                                <EyeOff className="w-4 h-4 text-zinc-400" />
                            ) : (
                                <Eye className="w-4 h-4 text-zinc-400" />
                            )}
                            <div>
                                <p className="text-sm font-medium text-white">Hide Balances</p>
                                <p className="text-xs text-zinc-500">Mask monetary values for privacy</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setPreferences({ hideBalances: !preferences.hideBalances })}
                            className={cn(
                                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                                preferences.hideBalances ? "bg-emerald-500" : "bg-zinc-700"
                            )}
                        >
                            <span className={cn("inline-block h-3 w-3 transform rounded-full bg-white transition-transform", preferences.hideBalances ? "translate-x-5" : "translate-x-1")} />
                        </button>
                    </div>
                </CardContent>
            </Card>
            
            {/* Tag Manager */}
            <Card className="bg-card/50 backdrop-blur-xl border-border">
                <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Tag className="h-4 w-4 text-emerald-400" />
                        Strategy Tags
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                            type="text"
                            placeholder="Search tags..."
                            value={tagSearch}
                            onChange={(e) => setTagSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-sm text-white placeholder:text-zinc-500"
                        />
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                        {filteredTags.slice(0, 8).map(tag => (
                            <div key={tag.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-800/50">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded" style={{ backgroundColor: tag.color }} />
                                    <span className="text-sm text-white">{tag.name}</span>
                                </div>
                                <button className="p-1 text-zinc-500 hover:text-white">
                                    <Edit2 className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                    <button className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white">
                        <Plus className="w-3 h-3" />
                        Create Custom Tag
                    </button>
                </CardContent>
            </Card>
            
            {/* ============ PLAYBOOK SETTINGS ============ */}
            <div className="border-b border-zinc-800 pb-2 mb-4 mt-8">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <BookMarked className="w-4 h-4 text-purple-400" />
                    Playbook Settings
                </h3>
            </div>
            
            {/* Playbook Overview */}
            <Card className="bg-card/50 backdrop-blur-xl border-border">
                <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Target className="h-4 w-4 text-zinc-400" />
                        Active Plans Overview
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="p-3 rounded-lg bg-zinc-800/50 text-center">
                            <p className="text-2xl font-bold text-white">{playbooks.length}</p>
                            <p className="text-xs text-zinc-500">Playbooks</p>
                        </div>
                        <div className="p-3 rounded-lg bg-emerald-500/10 text-center">
                            <p className="text-2xl font-bold text-emerald-400">{activeSpotPlans}</p>
                            <p className="text-xs text-zinc-500">Active Spot Plans</p>
                        </div>
                        <div className="p-3 rounded-lg bg-purple-500/10 text-center">
                            <p className="text-2xl font-bold text-purple-400">{activePerpPlans}</p>
                            <p className="text-xs text-zinc-500">Active Perp Plans</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
            
            {/* Playbook Defaults */}
            <Card className="bg-card/50 backdrop-blur-xl border-border">
                <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Shield className="h-4 w-4 text-zinc-400" />
                        Default Settings
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-zinc-500 mb-1 block">Default Leverage (Perp)</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={playbookSettings.defaultLeverage}
                                    onChange={(e) => setPlaybookSettings({ defaultLeverage: parseInt(e.target.value) || 1 })}
                                    className="w-20 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700/50 text-sm text-white"
                                />
                                <span className="text-sm text-zinc-400">x</span>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-zinc-500 mb-1 block">Default Risk %</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min="0.1"
                                    max="10"
                                    step="0.1"
                                    value={playbookSettings.defaultRiskPercent}
                                    onChange={(e) => setPlaybookSettings({ defaultRiskPercent: parseFloat(e.target.value) || 1 })}
                                    className="w-20 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700/50 text-sm text-white"
                                />
                                <span className="text-sm text-zinc-400">%</span>
                            </div>
                        </div>
                    </div>
                    <div className="pt-3 border-t border-white/5">
                        <label className="text-xs text-zinc-500 mb-1 block">Composite Tolerance</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min="0.05"
                                max="1"
                                step="0.05"
                                value={playbookSettings.compositeTolerancePct}
                                onChange={(e) => setPlaybookSettings({ compositeTolerancePct: parseFloat(e.target.value) || 0.25 })}
                                className="w-20 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700/50 text-sm text-white"
                            />
                            <span className="text-sm text-zinc-400">%</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-2">
                            Used for composite hit + no-order warnings.
                        </p>
                    </div>
                </CardContent>
            </Card>
            
            {/* Alert Settings */}
            <Card className="bg-card/50 backdrop-blur-xl border-border">
                <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Bell className="h-4 w-4 text-amber-400" />
                        Playbook Alerts
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-white">Auto-sync Alerts</p>
                            <p className="text-xs text-zinc-500">Automatically create alerts when plans are saved</p>
                        </div>
                        <button
                            onClick={() => setPlaybookSettings({ autoSyncAlerts: !playbookSettings.autoSyncAlerts })}
                            className={cn(
                                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                                playbookSettings.autoSyncAlerts ? "bg-emerald-500" : "bg-zinc-700"
                            )}
                        >
                            <span className={cn("inline-block h-3 w-3 transform rounded-full bg-white transition-transform", playbookSettings.autoSyncAlerts ? "translate-x-5" : "translate-x-1")} />
                        </button>
                    </div>
                    
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-white">Alert Sound</p>
                            <p className="text-xs text-zinc-500">Play sound when alerts trigger</p>
                        </div>
                        <button
                            onClick={() => setPlaybookSettings({ alertSound: !playbookSettings.alertSound })}
                            className={cn(
                                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                                playbookSettings.alertSound ? "bg-emerald-500" : "bg-zinc-700"
                            )}
                        >
                            <span className={cn("inline-block h-3 w-3 transform rounded-full bg-white transition-transform", playbookSettings.alertSound ? "translate-x-5" : "translate-x-1")} />
                        </button>
                    </div>
                    
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-white">Browser Notifications</p>
                            <p className="text-xs text-zinc-500">Show desktop notifications</p>
                        </div>
                        <button
                            onClick={() => setPlaybookSettings({ browserNotifications: !playbookSettings.browserNotifications })}
                            className={cn(
                                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                                playbookSettings.browserNotifications ? "bg-emerald-500" : "bg-zinc-700"
                            )}
                        >
                            <span className={cn("inline-block h-3 w-3 transform rounded-full bg-white transition-transform", playbookSettings.browserNotifications ? "translate-x-5" : "translate-x-1")} />
                        </button>
                    </div>
                </CardContent>
            </Card>
            
            {/* Display Options */}
            <Card className="bg-card/50 backdrop-blur-xl border-border">
                <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Zap className="h-4 w-4 text-zinc-400" />
                        Display Options
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-white">Show Inactive Playbooks</p>
                            <p className="text-xs text-zinc-500">Display archived playbooks in lists</p>
                        </div>
                        <button
                            onClick={() => setPlaybookSettings({ showInactivePlaybooks: !playbookSettings.showInactivePlaybooks })}
                            className={cn(
                                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                                playbookSettings.showInactivePlaybooks ? "bg-emerald-500" : "bg-zinc-700"
                            )}
                        >
                            <span className={cn("inline-block h-3 w-3 transform rounded-full bg-white transition-transform", playbookSettings.showInactivePlaybooks ? "translate-x-5" : "translate-x-1")} />
                        </button>
                    </div>
                    
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-white">Auto-archive Completed Plans</p>
                            <p className="text-xs text-zinc-500">Archive plans when all targets hit</p>
                        </div>
                        <button
                            onClick={() => setPlaybookSettings({ autoArchiveCompletedPlans: !playbookSettings.autoArchiveCompletedPlans })}
                            className={cn(
                                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                                playbookSettings.autoArchiveCompletedPlans ? "bg-emerald-500" : "bg-zinc-700"
                            )}
                        >
                            <span className={cn("inline-block h-3 w-3 transform rounded-full bg-white transition-transform", playbookSettings.autoArchiveCompletedPlans ? "translate-x-5" : "translate-x-1")} />
                        </button>
                    </div>
                </CardContent>
            </Card>
            
            {/* Real-time Sync */}
            <Card className="bg-card/50 backdrop-blur-xl border-border">
                <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Radio className="h-4 w-4 text-emerald-400" />
                        Real-time Sync
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <Radio className="w-5 h-5 text-emerald-400" />
                                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-white">Live Sync Active</p>
                                <p className="text-xs text-zinc-400">Trades sync every 5 seconds</p>
                            </div>
                        </div>
                        <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                            LIVE
                        </span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
