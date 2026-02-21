"use client";

import { normalizeSymbol } from "@/lib/utils/normalization";
import { setValue } from "@/lib/supabase/sync";

// ============ SESSION INTENT TYPES ============

export type BiasType = 'long' | 'neutral' | 'short';
export type HorizonType = 'scalp' | 'intraday' | 'swing';
export type RiskType = 'conservative' | 'normal' | 'aggressive';
export type ContextTag = 'trend' | 'range' | 'breakout' | 'news' | 'volatility' | 'low_vol';

export interface SessionNote {
    id: string;
    timestamp: number;
    content: string;
    isVoice?: boolean;
}

export interface TradingSession {
    id: string;
    startTime: number;
    endTime?: number;
    bias?: BiasType;
    horizon?: HorizonType;
    risk?: RiskType;
    context: ContextTag[];
    initialNote?: string;
    notes: SessionNote[];
    playbook?: string; // Playbook ID if loaded
    isActive: boolean;
    noIntent?: boolean; // Started without intent
    stats?: {
        symbolsObserved: number;
        tradesTracked: number;
    };
}

// ============ PLAYBOOK TYPES ============

export type PlaybookCategory = 'reversal' | 'expansion' | 'special' | 'defensive' | 'offensive';

// Profile Shapes (from institutional methodology)
export type ProfileShape = 'b_shape' | 'p_shape' | 'd_shape' | 'normal';

// Hierarchy Level (King vs Pawn)
export type HierarchyLevel = 'king' | 'pawn';

// Touch Count for "Touch 2" religion
export type TouchCount = 1 | 2 | 3;

export type MarketState = 
    | 'balanced'        // D-shape, consolidation
    | 'imbalanced'      // Directional pressure
    | 'trending'        // One-timeframing
    | 'ranging'         // Inside value rotation
    | 'one_timeframing' // Single direction TPO
    | 'rotational'      // Rotation between edges
    | 'breakout'        // Acceptance outside balance
    | 'failed_auction'  // Failed breakout, reversal
    | 'migration';      // POC shift in progress

export type ContextCondition = 
    | 'above_value'     // Price above VAH
    | 'below_value'     // Price below VAL
    | 'inside_value'    // Between VAH and VAL
    | 'at_composite_edge'  // At Daily/Weekly Composite edge
    | 'at_session_edge'    // At developing session edge
    | 'poor_high'       // p-shape, weak high
    | 'poor_low'        // b-shape, weak low
    | 'excess_high'     // Excess at high
    | 'excess_low'      // Excess at low
    | 'single_prints'   // Single print areas
    | 'poc_migration';  // POC has shifted

export type KeyLevel = 
    | 'PDH' 
    | 'PDL' 
    | 'VAH' 
    | 'VAL' 
    | 'POC' 
    | 'VWAP'
    | 'D_VAH'  // Daily Composite VAH
    | 'D_VAL'  // Daily Composite VAL
    | 'D_POC'  // Daily Composite POC
    | 'W_VAH'  // Week Composite VAH
    | 'W_VAL'  // Week Composite VAL
    | 'W_POC'  // Week Composite POC
    | 'M_VAH'  // Month Composite VAH
    | 'M_VAL'  // Month Composite VAL
    | 'M_POC'  // Month Composite POC
    | 'S_VAH'  // Session Composite VAH
    | 'S_VAL'  // Session Composite VAL
    | 'S_POC'; // Session Composite POC

export type ValidCondition = 'above' | 'below' | 'inside' | 'outside';

export type InvalidType = 'price' | 'structure' | 'time';

export type InvalidAction = 'lose' | 'back_inside' | 'accept_below' | 'accept_above' | 'break' | 'reject';

export type ScenarioTrigger = 'sweep' | 'accept' | 'reject' | 'break' | 'fail' | 'hold';

export type ScenarioAction = 'long' | 'short' | 'wait' | 'exit';

export interface InvalidCondition {
    type: InvalidType;
    action: InvalidAction;
    level?: KeyLevel;
    connector?: 'or' | 'and'; // Connector to next condition
}

export interface Scenario {
    id: string;
    trigger: ScenarioTrigger;
    level: KeyLevel;
    action: ScenarioAction;
    target?: KeyLevel;
}

export interface KeyLevelValues {
    PDH: number;
    PDL: number;
    VAH: number;
    VAL: number;
    POC: number;
    VWAP: number;
    D_VAH: number;  // Daily Composite VAH
    D_VAL: number;  // Daily Composite VAL
    D_POC: number;  // Daily Composite POC
    W_VAH: number;  // Week Composite VAH
    W_VAL: number;  // Week Composite VAL
    W_POC: number;  // Week Composite POC
    M_VAH: number;  // Month Composite VAH
    M_VAL: number;  // Month Composite VAL
    M_POC: number;  // Month Composite POC
    S_VAH: number;  // Session Composite VAH
    S_VAL: number;  // Session Composite VAL
    S_POC: number;  // Session Composite POC
}

export interface Playbook {
    id: string;
    name: string;
    description: string;
    category: PlaybookCategory;
    // Institutional Methodology
    profileShape?: ProfileShape;      // b-shape, p-shape, d-shape
    hierarchyLevel?: HierarchyLevel;  // king (composite) or pawn (session)
    touchRequired?: TouchCount;       // Touch 2 religion
    // Conditions
    marketStates: MarketState[];
    contextConditions: ContextCondition[];
    keyLevels: Partial<KeyLevelValues>;
    defaultBias: BiasType;
    validWhile: {
        condition: ValidCondition;
        level: KeyLevel;
    };
    invalidConditions: InvalidCondition[];
    scenarios: Scenario[];
    // Risk Management
    riskPercent?: number;             // 0.25%, 0.5%, 1%
    maxContracts?: number;            // Position size limit
    stopMultiplier?: number;          // ATR multiplier for stop
    notes: string;
    compositeNotes?: string;
    valueRotationCount?: number;
    valueTestCount?: number;
    valueAcceptance?: "accepted" | "rejected" | "in_progress";
    profileContext?: { tpoShape?: ProfileShape; footprint?: string; dom?: string; tape?: string };
    sessionCompositeEnabled?: boolean;
    compositeTag?: "daily" | "weekly" | "monthly" | "session" | "stacked";
    createdAt: number;
    updatedAt: number;
}

// ============ SPOT & PERP PLAN TYPES ============

export type PlanType = 'spot' | 'perp';
export type RuleEnforcementMode = 'critical' | 'all' | 'advisory';

export interface RuleEnforcementConfig {
    mode: RuleEnforcementMode;
}

export interface SpotPlan {
    id: string;
    symbol: string;           // Coin symbol (BTC, ETH, SOL, etc.)
    name?: string;            // Custom name for the plan
    bias: BiasType;
    keyLevels: Partial<KeyLevelValues>;
    scenarios: Scenario[];
    invalidConditions: InvalidCondition[];
    notes: string;
    targets: number[];        // Target prices for taking profit
    stopLoss?: number;        // Stop loss level
    entryZone?: {
        low: number;
        high: number;
    };
    /** Buy limit order prices (for Buy/DCA bias) */
    buyLimits?: number[];
    /** Sell limit order prices (for Sell bias) */
    sellLimits?: number[];
    isActive: boolean;
    compositeNotes?: string;
    valueRotationCount?: number;
    valueTestCount?: number;
    valueAcceptance?: "accepted" | "rejected" | "in_progress";
    profileContext?: { tpoShape?: ProfileShape; footprint?: string; dom?: string; tape?: string };
    sessionCompositeEnabled?: boolean;
    compositeTag?: "daily" | "weekly" | "monthly" | "session" | "stacked";
    plannedOrderSizes?: Partial<Record<KeyLevel | 'target' | 'stop' | 'entry_low' | 'entry_high', number>>;
    filledOrderSizes?: Partial<Record<KeyLevel | 'target' | 'stop' | 'entry_low' | 'entry_high', number>>;
    lastLevelProfit?: Partial<Record<KeyLevel, number>>;
    compositeReaction?: Partial<Record<
        "daily" | "weekly" | "monthly" | "session",
        {
            lastTouchAt?: number;
            maxDrawdownPct?: number;
            timeToReturnMinutes?: number;
            timeOutsideValueMinutes?: number;
        }
    >>;
    ruleEnforcement?: RuleEnforcementConfig;
    createdAt: number;
    updatedAt: number;
}

export interface PerpPlan {
    id: string;
    symbol: string;           // Trading pair (BTCUSDT, ETHUSDT, etc.)
    name?: string;            // Custom name for the plan
    bias: BiasType;
    leverage?: number;        // Leverage for perp trading
    keyLevels: Partial<KeyLevelValues>;
    scenarios: Scenario[];
    invalidConditions: InvalidCondition[];
    notes: string;
    targets: number[];        // Target prices
    stopLoss?: number;
    entryZone?: {
        low: number;
        high: number;
    };
    isActive: boolean;
    compositeNotes?: string;
    valueRotationCount?: number;
    valueTestCount?: number;
    valueAcceptance?: "accepted" | "rejected" | "in_progress";
    profileContext?: { tpoShape?: ProfileShape; footprint?: string; dom?: string; tape?: string };
    sessionCompositeEnabled?: boolean;
    compositeTag?: "daily" | "weekly" | "monthly" | "session" | "stacked";
    plannedOrderSizes?: Partial<Record<KeyLevel | 'target' | 'stop' | 'entry_low' | 'entry_high', number>>;
    filledOrderSizes?: Partial<Record<KeyLevel | 'target' | 'stop' | 'entry_low' | 'entry_high', number>>;
    lastLevelProfit?: Partial<Record<KeyLevel, number>>;
    compositeReaction?: Partial<Record<
        "daily" | "weekly" | "monthly" | "session",
        {
            lastTouchAt?: number;
            maxDrawdownPct?: number;
            timeToReturnMinutes?: number;
            timeOutsideValueMinutes?: number;
        }
    >>;
    handbookTemplate?: "institutional_tpo_v3_5";
    touchTwoRequired?: boolean;
    liquidityGate?: {
        minDailyVolume?: number;
        minDailyTrades?: number;
        allowedExchanges?: string[];
    };
    handbookChecklist?: {
        dailyCompositeActive?: boolean;
        touchTwoObserved?: boolean;
        liquidityOk?: boolean;
        exchangeOk?: boolean;
        hierarchyOk?: boolean;
    };
    ruleEnforcement?: RuleEnforcementConfig;
    createdAt: number;
    updatedAt: number;
}

// ============ STORAGE KEYS ============

export const SESSION_STORAGE_KEY = 'trading_sessions';
export const ACTIVE_SESSION_KEY = 'active_session';
export const PLAYBOOKS_KEY = 'trading_playbooks';
export const SESSION_STATS_KEY = 'session_stats';
export const SPOT_PLANS_KEY = 'spot_plans';
export const PERP_PLANS_KEY = 'perp_plans';

// ============ STORAGE HELPERS ============

export function getActiveSession(): TradingSession | null {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!stored) return null;
    try {
        return JSON.parse(stored);
    } catch {
        return null;
    }
}

export function saveActiveSession(session: TradingSession | null): void {
    if (typeof window === 'undefined') return;
    if (session) {
        const raw = JSON.stringify(session);
        localStorage.setItem(ACTIVE_SESSION_KEY, raw);
        setValue(ACTIVE_SESSION_KEY, raw).catch(() => {});
    } else {
        localStorage.removeItem(ACTIVE_SESSION_KEY);
    }
}

export function getSessions(): TradingSession[] {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) return [];
    try {
        return JSON.parse(stored);
    } catch {
        return [];
    }
}

export function saveSessions(sessions: TradingSession[]): void {
    if (typeof window === 'undefined') return;
    const raw = JSON.stringify(sessions);
    localStorage.setItem(SESSION_STORAGE_KEY, raw);
    setValue(SESSION_STORAGE_KEY, raw).catch(() => {});
}

export function getPlaybooks(): Playbook[] {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(PLAYBOOKS_KEY);
    if (!stored) return getDefaultPlaybooks();
    try {
        return JSON.parse(stored);
    } catch {
        return getDefaultPlaybooks();
    }
}

export function savePlaybooks(playbooks: Playbook[]): void {
    if (typeof window === 'undefined') return;
    const raw = JSON.stringify(playbooks);
    localStorage.setItem(PLAYBOOKS_KEY, raw);
    setValue(PLAYBOOKS_KEY, raw).catch(() => {});
}

export function getSessionStats(): { symbolsObserved: number; tradesTracked: number } {
    if (typeof window === 'undefined') return { symbolsObserved: 0, tradesTracked: 0 };
    const stored = localStorage.getItem(SESSION_STATS_KEY);
    if (!stored) return { symbolsObserved: 3, tradesTracked: 12 }; // Demo values
    try {
        return JSON.parse(stored);
    } catch {
        return { symbolsObserved: 3, tradesTracked: 12 };
    }
}

// ============ SPOT PLANS HELPERS ============

export function getSpotPlans(): SpotPlan[] {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(SPOT_PLANS_KEY);
    if (!stored) return [];
    try {
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) return [];
        return parsed.map((plan) => ({
            ...plan,
            ruleEnforcement: {
                mode: plan?.ruleEnforcement?.mode || 'critical',
            },
        }));
    } catch {
        return [];
    }
}

export function saveSpotPlans(plans: SpotPlan[]): void {
    if (typeof window === 'undefined') return;
    const normalized = (Array.isArray(plans) ? plans : []).map((plan) => ({
        ...plan,
        ruleEnforcement: {
            mode: plan?.ruleEnforcement?.mode || 'critical',
        },
    }));
    const raw = JSON.stringify(normalized);
    localStorage.setItem(SPOT_PLANS_KEY, raw);
    setValue(SPOT_PLANS_KEY, raw).catch(() => {});
    // Dispatch event for AI feed sync
    window.dispatchEvent(new CustomEvent('spot-plans-updated', { detail: normalized }));
    // Trigger playbook alerts sync
    window.dispatchEvent(new CustomEvent('sync-playbook-alerts', { detail: { type: 'spot' } }));
}

export function getSpotPlanForSymbol(symbol: string): SpotPlan | null {
    const plans = getSpotPlans();
    const normSymbol = normalizeSymbol(symbol);
    return plans.find(p => normalizeSymbol(p.symbol) === normSymbol || p.symbol.toUpperCase() === symbol.toUpperCase()) || null;
}

// ============ PERP PLANS HELPERS ============

export function getPerpPlans(): PerpPlan[] {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(PERP_PLANS_KEY);
    if (!stored) return [];
    try {
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) return [];
        return parsed.map((plan) => ({
            ...plan,
            ruleEnforcement: {
                mode: plan?.ruleEnforcement?.mode || 'critical',
            },
        }));
    } catch {
        return [];
    }
}

export function savePerpPlans(plans: PerpPlan[]): void {
    if (typeof window === 'undefined') return;
    const normalized = (Array.isArray(plans) ? plans : []).map((plan) => ({
        ...plan,
        ruleEnforcement: {
            mode: plan?.ruleEnforcement?.mode || 'critical',
        },
    }));
    const raw = JSON.stringify(normalized);
    localStorage.setItem(PERP_PLANS_KEY, raw);
    setValue(PERP_PLANS_KEY, raw).catch(() => {});
    window.dispatchEvent(new CustomEvent('perp-plans-updated', { detail: normalized }));
    // Trigger playbook alerts sync
    window.dispatchEvent(new CustomEvent('sync-playbook-alerts', { detail: { type: 'perp' } }));
}

export function getPerpPlanForSymbol(symbol: string): PerpPlan | null {
    const plans = getPerpPlans();
    const normSymbol = normalizeSymbol(symbol);
    return plans.find(p => normalizeSymbol(p.symbol) === normSymbol || p.symbol.toUpperCase() === symbol.toUpperCase()) || null;
}

// ============ DEFAULT PLAYBOOKS (Institutional Methodology) ============

export function getDefaultPlaybooks(): Playbook[] {
    return [
        // === REVERSAL STRATEGIES (Fading the Edge) ===
        {
            id: 'pb_basement_rebound',
            name: 'Basement Rebound',
            description: 'Long at Daily Composite Low or Session VAL. Wait for Seller Absorption. Enter on Touch 2.',
            category: 'reversal',
            profileShape: 'b_shape',
            hierarchyLevel: 'king',
            touchRequired: 2,
            marketStates: ['rotational', 'failed_auction'],
            contextConditions: ['at_composite_edge', 'poor_low', 'below_value'],
            keyLevels: {},
            defaultBias: 'long',
            validWhile: { condition: 'below', level: 'D_VAL' },
            invalidConditions: [
                { type: 'structure', action: 'accept_below', level: 'D_VAL' },
                { type: 'price', action: 'break', level: 'PDL' }
            ],
            scenarios: [
                { id: 's1', trigger: 'reject', level: 'D_VAL', action: 'long', target: 'POC' },
                { id: 's2', trigger: 'sweep', level: 'VAL', action: 'long', target: 'D_POC' },
            ],
            riskPercent: 0.5,
            maxContracts: 2,
            stopMultiplier: 1.5,
            notes: 'b-shape profile required. Wait for Seller Absorption on DOM. Touch 2 only.',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        },
        {
            id: 'pb_pinnacle_rebound',
            name: 'Pinnacle Rebound',
            description: 'Bear Trap setup. Price dips below VAL, traps sellers, aggressively reclaims.',
            category: 'reversal',
            profileShape: 'b_shape',
            hierarchyLevel: 'pawn',
            touchRequired: 2,
            marketStates: ['failed_auction', 'rotational'],
            contextConditions: ['below_value', 'at_session_edge'],
            keyLevels: {},
            defaultBias: 'long',
            validWhile: { condition: 'below', level: 'VAL' },
            invalidConditions: [
                { type: 'price', action: 'accept_below', level: 'VAL' },
            ],
            scenarios: [
                { id: 's1', trigger: 'fail', level: 'VAL', action: 'long', target: 'POC' },
                { id: 's2', trigger: 'reject', level: 'VAL', action: 'long', target: 'VAH' },
            ],
            riskPercent: 0.25,
            maxContracts: 1,
            stopMultiplier: 1,
            notes: 'Classic Bear Trap. Requires aggressive reclaim of VAL after the probe.',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        },
        {
            id: 'pb_gravity_fade',
            name: 'Gravity Fade',
            description: 'Short when price pokes above VAH, traps buyers, and falls back inside.',
            category: 'reversal',
            profileShape: 'p_shape',
            hierarchyLevel: 'pawn',
            touchRequired: 2,
            marketStates: ['failed_auction', 'rotational'],
            contextConditions: ['above_value', 'at_session_edge'],
            keyLevels: {},
            defaultBias: 'short',
            validWhile: { condition: 'above', level: 'VAH' },
            invalidConditions: [
                { type: 'price', action: 'accept_above', level: 'VAH' },
            ],
            scenarios: [
                { id: 's1', trigger: 'fail', level: 'VAH', action: 'short', target: 'POC' },
                { id: 's2', trigger: 'reject', level: 'VAH', action: 'short', target: 'VAL' },
            ],
            riskPercent: 0.25,
            maxContracts: 1,
            stopMultiplier: 1,
            notes: 'Bull Trap. Price must fail to hold above VAH and reclaim back inside.',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        },
        {
            id: 'pb_parabolic_trap',
            name: 'Parabolic Trap',
            description: 'Short at exhaustion in p-shape. Wait for Tape Flip (buying drying up).',
            category: 'reversal',
            profileShape: 'p_shape',
            hierarchyLevel: 'king',
            touchRequired: 2,
            marketStates: ['imbalanced', 'failed_auction'],
            contextConditions: ['at_composite_edge', 'poor_high', 'above_value'],
            keyLevels: {},
            defaultBias: 'short',
            validWhile: { condition: 'above', level: 'D_VAH' },
            invalidConditions: [
                { type: 'structure', action: 'accept_above', level: 'D_VAH' },
                { type: 'price', action: 'break', level: 'PDH' }
            ],
            scenarios: [
                { id: 's1', trigger: 'reject', level: 'D_VAH', action: 'short', target: 'D_POC' },
                { id: 's2', trigger: 'sweep', level: 'VAH', action: 'short', target: 'POC' },
            ],
            riskPercent: 0.5,
            maxContracts: 2,
            stopMultiplier: 1.5,
            notes: 'p-shape profile required. Wait for Tape Flip (aggressive buying drying up).',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        },
        // === EXPANSION STRATEGY ===
        {
            id: 'pb_equilibrium_breaker',
            name: 'Equilibrium Breaker',
            description: 'Breakout from D-shape balance (3+ days). Requires acceptance outside with Micro-Ledge.',
            category: 'expansion',
            profileShape: 'd_shape',
            hierarchyLevel: 'king',
            touchRequired: 1,
            marketStates: ['balanced', 'breakout'],
            contextConditions: ['inside_value'],
            keyLevels: {},
            defaultBias: 'neutral',
            validWhile: { condition: 'inside', level: 'D_VAH' },
            invalidConditions: [
                { type: 'price', action: 'back_inside', level: 'D_VAH' },
                { type: 'price', action: 'back_inside', level: 'D_VAL' },
            ],
            scenarios: [
                { id: 's1', trigger: 'accept', level: 'D_VAH', action: 'long', target: 'W_VAH' },
                { id: 's2', trigger: 'accept', level: 'D_VAL', action: 'short', target: 'W_VAL' },
            ],
            riskPercent: 1.0,
            maxContracts: 3,
            stopMultiplier: 2,
            notes: 'ONLY breakout play. Requires D-shape balance 3+ days. Look for Micro-Ledge (small pause) outside.',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        },
        // === SPECIAL ===
        {
            id: 'pb_reversal_ace',
            name: 'Reversal Ace',
            description: 'Rare high-probability setup at major Macro Wall (Monthly/Weekly). Maximum size.',
            category: 'special',
            profileShape: 'normal',
            hierarchyLevel: 'king',
            touchRequired: 2,
            marketStates: ['imbalanced', 'failed_auction'],
            contextConditions: ['at_composite_edge'],
            keyLevels: {},
            defaultBias: 'neutral',
            validWhile: { condition: 'outside', level: 'W_VAH' },
            invalidConditions: [
                { type: 'structure', action: 'accept_above', level: 'M_VAH' },
                { type: 'structure', action: 'accept_below', level: 'M_VAL' },
            ],
            scenarios: [
                { id: 's1', trigger: 'reject', level: 'M_VAH', action: 'short', target: 'W_POC' },
                { id: 's2', trigger: 'reject', level: 'M_VAL', action: 'long', target: 'W_POC' },
                { id: 's3', trigger: 'reject', level: 'W_VAH', action: 'short', target: 'D_POC' },
                { id: 's4', trigger: 'reject', level: 'W_VAL', action: 'long', target: 'D_POC' },
            ],
            riskPercent: 1.0,
            maxContracts: 3,
            stopMultiplier: 2,
            notes: 'RARE. Requires perfect confluence: Large Order Absorption + Delta Stall + Tape Flip. Max position size.',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        },
    ];
}

// ============ FORMAT HELPERS ============

export function formatSessionTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
}

export function formatSessionDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
}

export const MARKET_STATE_LABELS: Record<MarketState, string> = {
    balanced: 'Balanced (D-Shape)',
    imbalanced: 'Imbalanced',
    trending: 'Trending',
    ranging: 'Ranging',
    one_timeframing: 'One-Timeframing',
    rotational: 'Rotational',
    breakout: 'Breakout',
    failed_auction: 'Failed Auction',
    migration: 'POC Migration',
};

export const CONTEXT_LABELS: Record<ContextCondition, string> = {
    above_value: 'Above Value',
    below_value: 'Below Value',
    inside_value: 'Inside Value',
    at_composite_edge: 'At Composite Edge',
    at_session_edge: 'At Session Edge',
    poor_high: 'Poor High (p-shape)',
    poor_low: 'Poor Low (b-shape)',
    excess_high: 'Excess High',
    excess_low: 'Excess Low',
    single_prints: 'Single Prints',
    poc_migration: 'POC Migration',
};

export const CATEGORY_COLORS: Record<PlaybookCategory, string> = {
    reversal: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    expansion: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    special: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    defensive: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    offensive: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
};

export const PROFILE_SHAPE_LABELS: Record<ProfileShape, string> = {
    b_shape: 'b-Shape (Poor Low)',
    p_shape: 'p-Shape (Poor High)',
    d_shape: 'D-Shape (Balance)',
    normal: 'Normal',
};

export const HIERARCHY_LABELS: Record<HierarchyLevel, string> = {
    king: 'King (80% - Composite)',
    pawn: 'Pawn (20% - Session)',
};
