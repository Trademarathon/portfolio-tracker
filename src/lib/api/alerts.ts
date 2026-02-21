"use client";

// ========== ALERT TYPES ==========
export type AlertType = 
    | 'price_above' 
    | 'price_below' 
    | 'price_cross' 
    | 'percent_change'
    | 'volume_spike'
    | 'oi_change'
    | 'funding_rate'
    | 'liquidation'
    | 'position_pnl'
    | 'order_filled'
    | 'whale_alert'
    | 'portfolio_change'
    // AI Feed Signal Types
    | 'ai_take_profit'
    | 'ai_stop_loss'
    | 'ai_dca_opportunity'
    | 'ai_sell_signal'
    | 'ai_price_memory'
    | 'ai_whale_activity'
    | 'ai_concentration_risk'
    | 'ai_transfer'
    // Playbook Level Alerts
    | 'playbook_level_touch'
    | 'playbook_level_break'
    | 'playbook_level_reject'
    | 'playbook_entry_zone'
    | 'playbook_target_hit'
    | 'playbook_stop_hit';

export type AlertPriority = 'low' | 'medium' | 'high' | 'critical';

export type AlertChannel = 'in_app' | 'browser' | 'sound' | 'discord' | 'telegram';

export interface AlertCondition {
    type: AlertType;
    symbol?: string;
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'cross_above' | 'cross_below';
    value: number;
    timeframe?: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
}

export interface Alert {
    id: string;
    name: string;
    conditions: AlertCondition[];
    logic: 'AND' | 'OR';
    channels: AlertChannel[];
    priority: AlertPriority;
    enabled: boolean;
    cooldown: number; // minutes before alert can trigger again
    lastTriggered?: number;
    createdAt: number;
    expiresAt?: number;
    triggerCount: number;
    maxTriggers?: number; // optional limit
}

export interface AlertHistory {
    id: string;
    alertId: string;
    alertName: string;
    message: string;
    timestamp: number;
    priority: AlertPriority;
    channels: AlertChannel[];
    data?: Record<string, any>;
    acknowledged: boolean;
}

export interface AlertSettings {
    // In-App
    inAppEnabled: boolean;
    showInNotificationCenter: boolean;
    
    // Browser
    browserEnabled: boolean;
    requestPermissionOnStartup: boolean;
    
    // Sound
    soundEnabled: boolean;
    soundVolume: number;
    soundFile: 'default' | 'chime' | 'alert' | 'critical' | 'coin' | 'pop' | 'ding' | 'whoosh' | 'success' | 'error' | 'bubble' | 'bell' | 'custom';
    customSoundUrl?: string;
    
    // Discord
    discordEnabled: boolean;
    discordWebhookUrl: string;
    discordMentionRole?: string;
    discordMentionOnCritical: boolean;
    
    // Telegram
    telegramEnabled: boolean;
    telegramBotToken: string;
    telegramChatId: string;
    telegramSilent: boolean;
    
    // General
    quietHoursEnabled: boolean;
    quietHoursStart: string; // HH:MM
    quietHoursEnd: string;
    groupSimilarAlerts: boolean;
    alertCooldownMinutes: number;
    
    // AI Feed Alerts
    aiFeedAlertsEnabled: boolean;
    aiFeedCooldownHoursDefault: number;
    aiFeedCooldownHoursPriceMemory: number;
    aiFeedCooldownHoursPerpStoploss: number;
    aiFeedAlertTypes: {
        takeProfit: boolean;
        stopLoss: boolean;
        dcaOpportunity: boolean;
        sellSignal: boolean;
        priceMemory: boolean;
        whaleActivity: boolean;
        concentrationRisk: boolean;
        transfers: boolean;
        social: boolean;
        playbookLevels: boolean;
        playbookCompositeTriggers: boolean;
        playbookValueAcceptance: boolean;
        levelNoOrderWarning: boolean;
        playbookRuleWarning: boolean;
        journalReminder: boolean;
        perpStoplossReminder: boolean;
    };
    aiFeedMinPriority: 'low' | 'medium' | 'high';
    aiFeedChannels: AlertChannel[];
}

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
    inAppEnabled: true,
    showInNotificationCenter: true,
    browserEnabled: true,
    requestPermissionOnStartup: true,
    soundEnabled: true,
    soundVolume: 70,
    soundFile: 'default',
    discordEnabled: false,
    discordWebhookUrl: '',
    discordMentionOnCritical: true,
    telegramEnabled: false,
    telegramBotToken: '',
    telegramChatId: '',
    telegramSilent: false,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    groupSimilarAlerts: true,
    alertCooldownMinutes: 5,
    
    // AI Feed Alerts - all enabled by default
    aiFeedAlertsEnabled: true,
    aiFeedCooldownHoursDefault: 6,
    aiFeedCooldownHoursPriceMemory: 12,
    aiFeedCooldownHoursPerpStoploss: 2,
    aiFeedAlertTypes: {
        takeProfit: true,
        stopLoss: true,
        dcaOpportunity: true,
        sellSignal: true,
        priceMemory: true,
        whaleActivity: false,
        concentrationRisk: true,
        transfers: false,
        social: false,
        playbookLevels: true,
        playbookCompositeTriggers: true,
        playbookValueAcceptance: true,
        levelNoOrderWarning: true,
        playbookRuleWarning: true,
        journalReminder: true,
        perpStoplossReminder: true,
    },
    aiFeedMinPriority: 'high', // critical alerts only by default
    aiFeedChannels: ['in_app', 'browser', 'sound'],
};

// ========== ALERT TEMPLATES ==========
export const ALERT_TEMPLATES = [
    {
        id: 'price_target',
        name: 'Price Target',
        description: 'Alert when price reaches a specific level',
        icon: 'Target',
        conditions: [{ type: 'price_above' as AlertType, operator: 'gte' as const, value: 0 }],
    },
    {
        id: 'price_drop',
        name: 'Price Drop',
        description: 'Alert when price falls below a level',
        icon: 'TrendingDown',
        conditions: [{ type: 'price_below' as AlertType, operator: 'lte' as const, value: 0 }],
    },
    {
        id: 'percent_change',
        name: 'Percent Change',
        description: 'Alert on significant price movement',
        icon: 'Percent',
        conditions: [{ type: 'percent_change' as AlertType, operator: 'gte' as const, value: 5 }],
    },
    {
        id: 'volume_spike',
        name: 'Volume Spike',
        description: 'Alert on unusual trading volume',
        icon: 'BarChart3',
        conditions: [{ type: 'volume_spike' as AlertType, operator: 'gte' as const, value: 200 }],
    },
    {
        id: 'whale_movement',
        name: 'Whale Alert',
        description: 'Large transactions detected',
        icon: 'Anchor',
        conditions: [{ type: 'whale_alert' as AlertType, operator: 'gte' as const, value: 1000000 }],
    },
    {
        id: 'position_profit',
        name: 'Position Profit',
        description: 'Alert when position reaches profit target',
        icon: 'DollarSign',
        conditions: [{ type: 'position_pnl' as AlertType, operator: 'gte' as const, value: 10 }],
    },
    {
        id: 'position_loss',
        name: 'Stop Loss Warning',
        description: 'Alert when position reaches loss threshold',
        icon: 'ShieldAlert',
        conditions: [{ type: 'position_pnl' as AlertType, operator: 'lte' as const, value: -5 }],
    },
    {
        id: 'funding_rate',
        name: 'Funding Rate',
        description: 'Alert on extreme funding rates',
        icon: 'Percent',
        conditions: [{ type: 'funding_rate' as AlertType, operator: 'gte' as const, value: 0.1 }],
    },
];

// ========== PRIORITY CONFIG ==========
export const PRIORITY_CONFIG: Record<AlertPriority, { color: string; bgColor: string; icon: string; sound: string }> = {
    low: { color: 'text-zinc-400', bgColor: 'bg-zinc-500/10', icon: 'Info', sound: 'chime' },
    medium: { color: 'text-blue-400', bgColor: 'bg-blue-500/10', icon: 'Bell', sound: 'default' },
    high: { color: 'text-amber-400', bgColor: 'bg-amber-500/10', icon: 'AlertTriangle', sound: 'alert' },
    critical: { color: 'text-rose-400', bgColor: 'bg-rose-500/10', icon: 'AlertOctagon', sound: 'critical' },
};

// ========== STORAGE KEYS ==========
export const ALERTS_STORAGE_KEY = 'portfolio_alerts_v2';
export const ALERT_SETTINGS_KEY = 'portfolio_alert_settings';
export const ALERT_HISTORY_KEY = 'portfolio_alert_history';

// ========== HELPER FUNCTIONS ==========
export function loadAlertSettings(): AlertSettings {
    if (typeof window === 'undefined') return DEFAULT_ALERT_SETTINGS;
    try {
        const saved = localStorage.getItem(ALERT_SETTINGS_KEY);
        if (saved) {
            return { ...DEFAULT_ALERT_SETTINGS, ...JSON.parse(saved) };
        }
    } catch (e) {
        console.warn('Failed to load alert settings:', e);
    }
    return DEFAULT_ALERT_SETTINGS;
}

export function saveAlertSettings(settings: AlertSettings): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(ALERT_SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
        console.warn('Failed to save alert settings:', e);
    }
}

export function loadAlerts(): Alert[] {
    if (typeof window === 'undefined') return [];
    try {
        const saved = localStorage.getItem(ALERTS_STORAGE_KEY);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) {
        console.warn('Failed to load alerts:', e);
    }
    return [];
}

export function saveAlerts(alerts: Alert[]): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(alerts));
    } catch (e) {
        console.warn('Failed to save alerts:', e);
    }
}

export function loadAlertHistory(): AlertHistory[] {
    if (typeof window === 'undefined') return [];
    try {
        const saved = localStorage.getItem(ALERT_HISTORY_KEY);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) {
        console.warn('Failed to load alert history:', e);
    }
    return [];
}

export function saveAlertHistory(history: AlertHistory[]): void {
    if (typeof window === 'undefined') return;
    try {
        // Keep last 200 entries
        const trimmed = history.slice(0, 200);
        localStorage.setItem(ALERT_HISTORY_KEY, JSON.stringify(trimmed));
    } catch (e) {
        console.warn('Failed to save alert history:', e);
    }
}

// ========== FORMAT HELPERS ==========
export function formatAlertMessage(alert: Alert, data: Record<string, any>): string {
    const condition = alert.conditions[0];
    const symbol = condition?.symbol || data.symbol || 'Unknown';
    const value = data.value ?? data.price ?? 0;
    const condVal = condition?.value ?? 0;

    switch (condition?.type) {
        case 'price_above':
        case 'price_below':
            return `${symbol} price ${condition.type === 'price_above' ? 'above' : 'below'} $${Number(condVal).toLocaleString()} (now: $${Number(value).toLocaleString()})`;
        case 'percent_change':
            return `${symbol} moved ${Number(value) > 0 ? '+' : ''}${Number(value).toFixed(2)}% in ${condition.timeframe || '1h'}`;
        case 'volume_spike':
            return `${symbol} volume spike: ${Number(value).toFixed(0)}% above average`;
        case 'position_pnl':
            return `Position ${symbol} PnL: ${Number(value) > 0 ? '+' : ''}${Number(value).toFixed(2)}%`;
        case 'order_filled':
            return `Order filled: ${data.side} ${data.amount} ${symbol} @ $${data.price}`;
        case 'whale_alert':
            return `Whale alert: $${(Number(value) / 1e6).toFixed(2)}M ${data.side || 'transfer'} on ${symbol}`;
        default:
            return alert.name;
    }
}

export function getAlertTypeLabel(type: AlertType): string {
    const labels: Record<AlertType, string> = {
        price_above: 'Price Above',
        price_below: 'Price Below',
        price_cross: 'Price Cross',
        percent_change: 'Percent Change',
        volume_spike: 'Volume Spike',
        oi_change: 'Open Interest Change',
        funding_rate: 'Funding Rate',
        liquidation: 'Liquidation',
        position_pnl: 'Position PnL',
        order_filled: 'Order Filled',
        whale_alert: 'Whale Alert',
        portfolio_change: 'Portfolio Change',
        // AI Feed Alert Types
        ai_take_profit: 'AI Take Profit',
        ai_stop_loss: 'AI Stop Loss',
        ai_dca_opportunity: 'AI DCA Opportunity',
        ai_sell_signal: 'AI Sell Signal',
        ai_price_memory: 'AI Price Memory',
        ai_whale_activity: 'AI Whale Activity',
        ai_concentration_risk: 'AI Concentration Risk',
        ai_transfer: 'AI Transfer Alert',
        // Playbook Level Alert Types
        playbook_level_touch: 'Playbook Level Touch',
        playbook_level_break: 'Playbook Level Break',
        playbook_level_reject: 'Playbook Level Reject',
        playbook_entry_zone: 'Playbook Entry Zone',
        playbook_target_hit: 'Playbook Target Hit',
        playbook_stop_hit: 'Playbook Stop Hit',
    };
    return labels[type] || type;
}

// ========== QUIET HOURS CHECK ==========
export function isInQuietHours(settings: AlertSettings): boolean {
    if (!settings.quietHoursEnabled) return false;
    
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startH, startM] = settings.quietHoursStart.split(':').map(Number);
    const [endH, endM] = settings.quietHoursEnd.split(':').map(Number);
    
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    
    if (startMinutes < endMinutes) {
        return currentTime >= startMinutes && currentTime < endMinutes;
    } else {
        // Crosses midnight
        return currentTime >= startMinutes || currentTime < endMinutes;
    }
}

// ========== PLAYBOOK LEVEL ALERTS INTEGRATION ==========

export type KeyLevel = 
    | 'PDH' | 'PDL' | 'VAH' | 'VAL' | 'POC' | 'VWAP'
    | 'D_VAH' | 'D_VAL' | 'D_POC' 
    | 'W_VAH' | 'W_VAL' | 'W_POC' 
    | 'M_VAH' | 'M_VAL' | 'M_POC'
    | 'S_VAH' | 'S_VAL' | 'S_POC';

export const KEY_LEVEL_LABELS: Record<KeyLevel, string> = {
    PDH: 'Previous Day High',
    PDL: 'Previous Day Low',
    VAH: 'Value Area High',
    VAL: 'Value Area Low',
    POC: 'Point of Control',
    VWAP: 'VWAP',
    D_VAH: 'Daily Composite VAH',
    D_VAL: 'Daily Composite VAL',
    D_POC: 'Daily Composite POC',
    W_VAH: 'Weekly Composite VAH',
    W_VAL: 'Weekly Composite VAL',
    W_POC: 'Weekly Composite POC',
    M_VAH: 'Monthly Composite VAH',
    M_VAL: 'Monthly Composite VAL',
    M_POC: 'Monthly Composite POC',
    S_VAH: 'Session Composite VAH',
    S_VAL: 'Session Composite VAL',
    S_POC: 'Session Composite POC',
};

export type LevelCategory = 'buy' | 'sell';

export interface PlaybookLevelAlert {
    id: string;
    planId: string;              // ID of the SpotPlan or PerpPlan
    planType: 'spot' | 'perp';
    symbol: string;
    levelType: KeyLevel | 'target' | 'stop' | 'entry_low' | 'entry_high';
    levelValue: number;
    alertType: 'touch' | 'break_above' | 'break_below' | 'reject';
    levelCategory?: LevelCategory;  // buy = accumulate, sell = take profit
    priority: AlertPriority;
    enabled: boolean;
    triggered: boolean;
    lastTriggered?: number;
    createdAt: number;
}

/** Determine buy vs sell from level type and bias */
function getLevelCategory(
    levelType: PlaybookLevelAlert['levelType'],
    bias: 'long' | 'short' | 'neutral'
): LevelCategory {
    if (levelType === 'entry_low' || levelType === 'entry_high') return 'buy';
    if (levelType === 'target') return 'sell';
    if (levelType === 'stop') return 'sell';
    const supportLevels = ['VAL', 'PDL', 'D_VAL', 'W_VAL', 'M_VAL'];
    const resistanceLevels = ['VAH', 'PDH', 'D_VAH', 'W_VAH', 'M_VAH'];
    if (supportLevels.includes(levelType)) return bias === 'long' ? 'buy' : 'sell';
    if (resistanceLevels.includes(levelType)) return bias === 'long' ? 'sell' : 'buy';
    if (['POC', 'VWAP', 'D_POC', 'W_POC', 'M_POC'].includes(levelType)) return bias === 'long' ? 'buy' : 'sell';
    return 'buy';
}

export const PLAYBOOK_ALERTS_KEY = 'playbook_level_alerts';
const PLAYBOOK_COMPLETION_NOTIFIED_KEY = 'playbook_completion_notified';

/** Check if we've already notified for plan completion (buy phase or full) */
export function getPlanCompletionNotified(planId: string, type: 'buy_phase' | 'full'): boolean {
    if (typeof window === 'undefined') return false;
    try {
        const raw = localStorage.getItem(PLAYBOOK_COMPLETION_NOTIFIED_KEY);
        const map = raw ? JSON.parse(raw) : {};
        return !!map[`${planId}_${type}`];
    } catch {
        return false;
    }
}

export function setPlanCompletionNotified(planId: string, type: 'buy_phase' | 'full'): void {
    if (typeof window === 'undefined') return;
    try {
        const raw = localStorage.getItem(PLAYBOOK_COMPLETION_NOTIFIED_KEY);
        const map = raw ? JSON.parse(raw) : {};
        map[`${planId}_${type}`] = true;
        localStorage.setItem(PLAYBOOK_COMPLETION_NOTIFIED_KEY, JSON.stringify(map));
    } catch {}
}

// Load playbook level alerts
export function loadPlaybookAlerts(): PlaybookLevelAlert[] {
    if (typeof window === 'undefined') return [];
    try {
        const saved = localStorage.getItem(PLAYBOOK_ALERTS_KEY);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) {
        console.warn('Failed to load playbook alerts:', e);
    }
    return [];
}

// Save playbook level alerts
export function savePlaybookAlerts(alerts: PlaybookLevelAlert[]): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(PLAYBOOK_ALERTS_KEY, JSON.stringify(alerts));
        window.dispatchEvent(new CustomEvent('playbook-alerts-updated', { detail: alerts }));
    } catch (e) {
        console.warn('Failed to save playbook alerts:', e);
    }
}

// Generate alerts from a spot plan's key levels
export function generateAlertsFromSpotPlan(plan: {
    id: string;
    symbol: string;
    keyLevels: Partial<Record<KeyLevel, number>>;
    targets?: number[];
    stopLoss?: number;
    entryZone?: { low: number; high: number };
    buyLimits?: number[];
    sellLimits?: number[];
    bias: 'long' | 'short' | 'neutral';
}): PlaybookLevelAlert[] {
    const alerts: PlaybookLevelAlert[] = [];
    const now = Date.now();
    
    // Generate alerts for each key level
    Object.entries(plan.keyLevels).forEach(([level, value]) => {
        if (value && value > 0) {
            const levelKey = level as KeyLevel;
            
            // Determine priority based on level type
            let priority: AlertPriority = 'medium';
            if (levelKey.includes('POC') || levelKey === 'VWAP') {
                priority = 'high'; // POC and VWAP are high priority (magnet levels)
            } else if (levelKey.startsWith('M_')) {
                priority = 'critical'; // Monthly levels are critical (King levels)
            } else if (levelKey.startsWith('W_')) {
                priority = 'high'; // Weekly levels are high priority
            }
            
            const touchCategory = getLevelCategory(levelKey, plan.bias);
            alerts.push({
                id: `${plan.id}_${level}_touch`,
                planId: plan.id,
                planType: 'spot',
                symbol: plan.symbol,
                levelType: levelKey,
                levelValue: value,
                alertType: 'touch',
                levelCategory: touchCategory,
                priority,
                enabled: true,
                triggered: false,
                createdAt: now,
            });

            if (plan.bias === 'long') {
                if (['VAH', 'D_VAH', 'W_VAH', 'M_VAH', 'PDH'].includes(level)) {
                    alerts.push({
                        id: `${plan.id}_${level}_break_above`,
                        planId: plan.id,
                        planType: 'spot',
                        symbol: plan.symbol,
                        levelType: levelKey,
                        levelValue: value,
                        alertType: 'break_above',
                        levelCategory: 'sell',
                        priority: 'high',
                        enabled: true,
                        triggered: false,
                        createdAt: now,
                    });
                }
            } else if (plan.bias === 'short') {
                if (['VAL', 'D_VAL', 'W_VAL', 'M_VAL', 'PDL'].includes(level)) {
                    alerts.push({
                        id: `${plan.id}_${level}_break_below`,
                        planId: plan.id,
                        planType: 'spot',
                        symbol: plan.symbol,
                        levelType: levelKey,
                        levelValue: value,
                        alertType: 'break_below',
                        levelCategory: 'sell',
                        priority: 'high',
                        enabled: true,
                        triggered: false,
                        createdAt: now,
                    });
                }
            }
        }
    });
    
    if (plan.targets && plan.targets.length > 0) {
        plan.targets.forEach((target, idx) => {
            if (target > 0) {
                alerts.push({
                    id: `${plan.id}_target_${idx}`,
                    planId: plan.id,
                    planType: 'spot',
                    symbol: plan.symbol,
                    levelType: 'target',
                    levelValue: target,
                    alertType: plan.bias === 'long' ? 'break_above' : 'break_below',
                    levelCategory: 'sell',
                    priority: 'critical',
                    enabled: true,
                    triggered: false,
                    createdAt: now,
                });
            }
        });
    }

    if (plan.stopLoss && plan.stopLoss > 0) {
        alerts.push({
            id: `${plan.id}_stop`,
            planId: plan.id,
            planType: 'spot',
            symbol: plan.symbol,
            levelType: 'stop',
            levelValue: plan.stopLoss,
            alertType: plan.bias === 'long' ? 'break_below' : 'break_above',
            levelCategory: 'sell',
            priority: 'critical',
            enabled: true,
            triggered: false,
            createdAt: now,
        });
    }

    // Buy limits (new structure)
    if (plan.buyLimits && plan.buyLimits.length > 0) {
        plan.buyLimits.forEach((price, idx) => {
            if (price > 0) {
                alerts.push({
                    id: `${plan.id}_entry_buy_${idx}`,
                    planId: plan.id,
                    planType: 'spot',
                    symbol: plan.symbol,
                    levelType: 'entry_low',
                    levelValue: price,
                    alertType: 'touch',
                    levelCategory: 'buy',
                    priority: 'high',
                    enabled: true,
                    triggered: false,
                    createdAt: now,
                });
            }
        });
    }
    // Sell limits (new structure)
    if (plan.sellLimits && plan.sellLimits.length > 0) {
        plan.sellLimits.forEach((price, idx) => {
            if (price > 0) {
                alerts.push({
                    id: `${plan.id}_entry_sell_${idx}`,
                    planId: plan.id,
                    planType: 'spot',
                    symbol: plan.symbol,
                    levelType: 'entry_high',
                    levelValue: price,
                    alertType: 'touch',
                    levelCategory: 'sell',
                    priority: 'high',
                    enabled: true,
                    triggered: false,
                    createdAt: now,
                });
            }
        });
    }
    // Legacy entry zone (only if no buy/sell limits)
    if (!plan.buyLimits?.length && !plan.sellLimits?.length && plan.entryZone) {
        if (plan.entryZone.low > 0) {
            alerts.push({
                id: `${plan.id}_entry_low`,
                planId: plan.id,
                planType: 'spot',
                symbol: plan.symbol,
                levelType: 'entry_low',
                levelValue: plan.entryZone.low,
                alertType: 'touch',
                levelCategory: 'buy',
                priority: 'high',
                enabled: true,
                triggered: false,
                createdAt: now,
            });
        }
        if (plan.entryZone.high > 0) {
            alerts.push({
                id: `${plan.id}_entry_high`,
                planId: plan.id,
                planType: 'spot',
                symbol: plan.symbol,
                levelType: 'entry_high',
                levelValue: plan.entryZone.high,
                alertType: 'touch',
                levelCategory: 'buy',
                priority: 'high',
                enabled: true,
                triggered: false,
                createdAt: now,
            });
        }
    }
    
    return alerts;
}

// Generate alerts from a perp plan's key levels
export function generateAlertsFromPerpPlan(plan: {
    id: string;
    symbol: string;
    keyLevels: Partial<Record<KeyLevel, number>>;
    targets?: number[];
    stopLoss?: number;
    entryZone?: { low: number; high: number };
    bias: 'long' | 'short' | 'neutral';
    leverage?: number;
}): PlaybookLevelAlert[] {
    // Same logic as spot plan but with perp type
    const alerts = generateAlertsFromSpotPlan(plan);
    return alerts.map(alert => ({
        ...alert,
        planType: 'perp' as const,
        // Higher priority for perp due to leverage risk
        priority: plan.leverage && plan.leverage > 5 
            ? (alert.priority === 'high' ? 'critical' : 'high') 
            : alert.priority,
    }));
}

// Sync all spot plans with alerts
export function syncSpotPlansWithAlerts(): void {
    if (typeof window === 'undefined') return;
    
    try {
        const spotPlansRaw = localStorage.getItem('spot_plans');
        if (!spotPlansRaw) return;
        
        const spotPlans = JSON.parse(spotPlansRaw);
        const existingAlerts = loadPlaybookAlerts();
        
        // Remove old alerts for inactive plans
        const activePlanIds = spotPlans.filter((p: any) => p.isActive).map((p: any) => p.id);
        let newAlerts = existingAlerts.filter(a => 
            a.planType !== 'spot' || activePlanIds.includes(a.planId)
        );
        
        // Generate new alerts for active plans
        spotPlans.forEach((plan: any) => {
            if (plan.isActive) {
                // Remove existing alerts for this plan
                newAlerts = newAlerts.filter(a => a.planId !== plan.id);
                // Add new alerts
                const planAlerts = generateAlertsFromSpotPlan(plan);
                newAlerts.push(...planAlerts);
            }
        });
        
        savePlaybookAlerts(newAlerts);
        console.log(`[Playbook Alerts] Synced ${newAlerts.length} alerts from spot plans`);
    } catch (e) {
        console.error('Failed to sync spot plans with alerts:', e);
    }
}

// Sync all perp plans with alerts
export function syncPerpPlansWithAlerts(): void {
    if (typeof window === 'undefined') return;
    
    try {
        const perpPlansRaw = localStorage.getItem('perp_plans');
        if (!perpPlansRaw) return;
        
        const perpPlans = JSON.parse(perpPlansRaw);
        const existingAlerts = loadPlaybookAlerts();
        
        // Remove old alerts for inactive plans
        const activePlanIds = perpPlans.filter((p: any) => p.isActive).map((p: any) => p.id);
        let newAlerts = existingAlerts.filter(a => 
            a.planType !== 'perp' || activePlanIds.includes(a.planId)
        );
        
        // Generate new alerts for active plans
        perpPlans.forEach((plan: any) => {
            if (plan.isActive) {
                // Remove existing alerts for this plan
                newAlerts = newAlerts.filter(a => a.planId !== plan.id);
                // Add new alerts
                const planAlerts = generateAlertsFromPerpPlan(plan);
                newAlerts.push(...planAlerts);
            }
        });
        
        savePlaybookAlerts(newAlerts);
        console.log(`[Playbook Alerts] Synced ${newAlerts.length} alerts from perp plans`);
    } catch (e) {
        console.error('Failed to sync perp plans with alerts:', e);
    }
}

// Get alerts for a specific symbol
export function getPlaybookAlertsForSymbol(symbol: string): PlaybookLevelAlert[] {
    const alerts = loadPlaybookAlerts();
    return alerts.filter(a => a.symbol.toUpperCase() === symbol.toUpperCase() && a.enabled);
}

// Get all enabled playbook alerts
export function getEnabledPlaybookAlerts(): PlaybookLevelAlert[] {
    return loadPlaybookAlerts().filter(a => a.enabled && !a.triggered);
}

// Mark an alert as triggered
export function markPlaybookAlertTriggered(alertId: string): void {
    const alerts = loadPlaybookAlerts();
    const updatedAlerts = alerts.map(a => 
        a.id === alertId ? { ...a, triggered: true, lastTriggered: Date.now() } : a
    );
    savePlaybookAlerts(updatedAlerts);
}

// Reset triggered alerts for a plan
export function resetPlaybookAlertsForPlan(planId: string): void {
    const alerts = loadPlaybookAlerts();
    const updatedAlerts = alerts.map(a => 
        a.planId === planId ? { ...a, triggered: false, lastTriggered: undefined } : a
    );
    savePlaybookAlerts(updatedAlerts);
    try {
        const raw = localStorage.getItem(PLAYBOOK_COMPLETION_NOTIFIED_KEY);
        const map = raw ? JSON.parse(raw) : {};
        delete map[`${planId}_buy_phase`];
        delete map[`${planId}_full`];
        localStorage.setItem(PLAYBOOK_COMPLETION_NOTIFIED_KEY, JSON.stringify(map));
    } catch {}
}

// Plan progress for completion insights
export interface PlanProgress {
    planId: string;
    symbol: string;
    planType: 'spot' | 'perp';
    buyTotal: number;
    buyTriggered: number;
    sellTotal: number;
    sellTriggered: number;
    allDone: boolean;
    buyPhaseDone: boolean;
    pendingSellLevels: { levelType: string; levelValue: number }[];
}

export function getPlanProgress(planId: string): PlanProgress | null {
    const alerts = loadPlaybookAlerts().filter(a => a.planId === planId);
    if (alerts.length === 0) return null;

    const buyAlerts = alerts.filter(a => a.levelCategory === 'buy');
    const sellAlerts = alerts.filter(a => a.levelCategory === 'sell');
    const buyTriggered = buyAlerts.filter(a => a.triggered).length;
    const sellTriggered = sellAlerts.filter(a => a.triggered).length;
    const pendingSell = sellAlerts.filter(a => !a.triggered).map(a => ({
        levelType: a.levelType === 'target' ? 'Target' : a.levelType === 'stop' ? 'Stop' : a.levelType,
        levelValue: a.levelValue,
    }));

    const symbol = alerts[0]?.symbol || '';
    const planType = alerts[0]?.planType || 'spot';

    return {
        planId,
        symbol,
        planType,
        buyTotal: buyAlerts.length,
        buyTriggered,
        sellTotal: sellAlerts.length,
        sellTriggered,
        allDone: buyTriggered === buyAlerts.length && sellTriggered === sellAlerts.length,
        buyPhaseDone: buyTriggered === buyAlerts.length && buyAlerts.length > 0,
        pendingSellLevels: pendingSell,
    };
}

// Format playbook alert message
export function formatPlaybookAlertMessage(alert: PlaybookLevelAlert): string {
    const levelLabel = alert.levelType === 'target' ? 'Target' :
                       alert.levelType === 'stop' ? 'Stop Loss' :
                       alert.levelType === 'entry_low' ? 'Entry Zone Low' :
                       alert.levelType === 'entry_high' ? 'Entry Zone High' :
                       KEY_LEVEL_LABELS[alert.levelType as KeyLevel] || alert.levelType;
    
    const action = alert.alertType === 'touch' ? 'touched' :
                   alert.alertType === 'break_above' ? 'broke above' :
                   alert.alertType === 'break_below' ? 'broke below' :
                   'rejected';
    
    return `${alert.symbol} ${action} ${levelLabel} @ $${alert.levelValue.toLocaleString()}`;
}
