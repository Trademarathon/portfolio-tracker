// Journal Types for Strategy Tagging & Trade Annotation

export const STRATEGY_TAGS = [
    { id: 'pinnacle_rebound', name: 'Pinnacle Rebound', color: '#22c55e', description: 'Reversal from key swing high/low' },
    { id: 'equilibrium_breaker', name: 'Equilibrium Breaker', color: '#3b82f6', description: 'Breakout from balance area' },
    { id: 'pullback', name: 'Pullback', color: '#f59e0b', description: 'Entry on retracement to value' },
    { id: 'volume_breakout', name: 'Volume Breakout', color: '#8b5cf6', description: 'High volume range expansion' },
    { id: 'trend_continuation', name: 'Trend Continuation', color: '#06b6d4', description: 'With-trend entry after consolidation' },
    { id: 'fade', name: 'Fade', color: '#ef4444', description: 'Counter-trend at extremes' },
    { id: 'delta_stall', name: 'Delta Stall', color: '#ec4899', description: 'Absorption and delta divergence' },
    { id: 'trev_entry', name: 'TRev Entry', color: '#14b8a6', description: 'T-Size reversal pattern' },
    { id: 'scalp', name: 'Scalp', color: '#a3a3a3', description: 'Quick in-and-out trade' },
    { id: 'custom', name: 'Custom', color: '#71717a', description: 'User-defined strategy' },
] as const;

export type StrategyTagId = typeof STRATEGY_TAGS[number]['id'];

export const EXECUTION_QUALITY = [
    { value: 1, label: 'Poor', color: '#ef4444' },
    { value: 2, label: 'Below Avg', color: '#f97316' },
    { value: 3, label: 'Average', color: '#f59e0b' },
    { value: 4, label: 'Good', color: '#84cc16' },
    { value: 5, label: 'Excellent', color: '#22c55e' },
] as const;

export type ExecutionQuality = 1 | 2 | 3 | 4 | 5;

export interface MarketProfileObservation {
    profileType?: 'p-shape' | 'b-shape' | 'd-shape' | 'normal' | 'double' | 'other';
    keyLevels?: string; // e.g., "VAH 45200, POC 45100, VAL 45000"
    context?: string; // e.g., "seller absorption at VAL, responsive buyers"
}

export interface TradeAnnotation {
    id: string;
    tradeId: string; // Links to the trade in history
    strategyTag: StrategyTagId;
    customTagName?: string; // If strategyTag is 'custom'
    executionQuality: ExecutionQuality;
    notes: string; // Free-form "Institutional Context"
    marketProfile?: MarketProfileObservation;
    atrAtEntry?: number;
    trevSettings?: string; // e.g., "T-Size 5, Delta Threshold 200"
    mistakeTags?: string[]; // e.g., ["chased", "ignored_val", "early_exit"]
    targets?: Array<{ price: number; sizePercent?: number; triggered?: boolean }>;
    stops?: Array<{ price: number; sizePercent?: number; triggered?: boolean }>;
    screenshots?: string[];
    createdAt: number;
    updatedAt: number;
}

export interface JournalStats {
    totalTrades: number;
    taggedTrades: number;
    winRateByTag: Record<StrategyTagId, { wins: number; losses: number; winRate: number; totalPnl: number }>;
    avgExecutionQuality: number;
}

// Helper to get tag info
export function getStrategyTag(id: StrategyTagId) {
    return STRATEGY_TAGS.find(t => t.id === id);
}

export function getExecutionQualityInfo(value: ExecutionQuality) {
    return EXECUTION_QUALITY.find(q => q.value === value);
}
