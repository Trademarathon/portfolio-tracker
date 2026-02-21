"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAdvancedAlerts } from './useAdvancedAlerts';
import { AlertPriority, AlertChannel } from '@/lib/api/alerts';
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { loadMemory, saveMemory, setCooldown, isSuppressed, cleanupMemory, type MemoryStore } from "@/lib/ai-memory";

// Signal type to AI Feed alert type mapping
type AISignalType = 
    | 'SET_TP_ALERT'
    | 'SET_SL_ALERT'
    | 'SELL_SIGNAL'
    | 'BUY_SIGNAL'
    | 'PRICE_MEMORY'
    | 'WHALE_ACCUMULATION'
    | 'VOLATILITY_ALERT'
    | 'CONCENTRATION_RISK'
    | 'TRANSFER_INSIGHT'
    | 'ORDER_RECOMMENDATION'
    | 'STRUCTURE_BREAK'
    | 'DCA_LEVELS'
    | 'TAKE_PROFIT'
    | 'PLAYBOOK_PLAN_LEVELS'
    | 'PLAYBOOK_COMPOSITE_TRIGGER'
    | 'PLAYBOOK_VALUE_ACCEPTANCE'
    | 'LEVEL_NO_ORDER_WARNING'
    | 'PLAYBOOK_RULE_WARNING'
    | 'JOURNAL_REMINDER'
    | 'PERP_STOPLOSS_REMINDER'
    | 'SOCIAL_MENTION';

interface AISignal {
    id: string;
    type: AISignalType;
    symbol: string;
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    data?: Record<string, any>;
}

// Map AI signal types to settings keys
const SIGNAL_TYPE_MAP: Record<AISignalType, keyof typeof DEFAULT_ENABLED_TYPES> = {
    'SET_TP_ALERT': 'takeProfit',
    'SET_SL_ALERT': 'stopLoss',
    'SELL_SIGNAL': 'sellSignal',
    'BUY_SIGNAL': 'dcaOpportunity',
    'PRICE_MEMORY': 'priceMemory',
    'WHALE_ACCUMULATION': 'whaleActivity',
    'VOLATILITY_ALERT': 'concentrationRisk',
    'CONCENTRATION_RISK': 'concentrationRisk',
    'TRANSFER_INSIGHT': 'transfers',
    'ORDER_RECOMMENDATION': 'takeProfit', // Categorize with orders
    'STRUCTURE_BREAK': 'whaleActivity',
    'DCA_LEVELS': 'dcaOpportunity',
    'TAKE_PROFIT': 'takeProfit',
    'PLAYBOOK_PLAN_LEVELS': 'playbookLevels',
    'PLAYBOOK_COMPOSITE_TRIGGER': 'playbookCompositeTriggers',
    'PLAYBOOK_VALUE_ACCEPTANCE': 'playbookValueAcceptance',
    'LEVEL_NO_ORDER_WARNING': 'levelNoOrderWarning',
    'PLAYBOOK_RULE_WARNING': 'playbookRuleWarning',
    'JOURNAL_REMINDER': 'journalReminder',
    'PERP_STOPLOSS_REMINDER': 'perpStoplossReminder',
    'SOCIAL_MENTION': 'social',
};

const DEFAULT_ENABLED_TYPES = {
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
};

// Priority order for comparison
const PRIORITY_ORDER: Record<string, number> = {
    'low': 1,
    'medium': 2,
    'high': 3,
};

// Emoji for signal types
const SIGNAL_EMOJI: Record<AISignalType, string> = {
    'SET_TP_ALERT': '🎯',
    'SET_SL_ALERT': '🛑',
    'SELL_SIGNAL': '📈',
    'BUY_SIGNAL': '💰',
    'PRICE_MEMORY': '🧠',
    'WHALE_ACCUMULATION': '🐋',
    'VOLATILITY_ALERT': '⚡',
    'CONCENTRATION_RISK': '⚠️',
    'TRANSFER_INSIGHT': '↔️',
    'ORDER_RECOMMENDATION': '📋',
    'STRUCTURE_BREAK': '📊',
    'DCA_LEVELS': '📉',
    'TAKE_PROFIT': '💵',
    'PLAYBOOK_PLAN_LEVELS': '📋',
    'PLAYBOOK_COMPOSITE_TRIGGER': '🎯',
    'PLAYBOOK_VALUE_ACCEPTANCE': '✅',
    'LEVEL_NO_ORDER_WARNING': '⚠️',
    'PLAYBOOK_RULE_WARNING': '📌',
    'JOURNAL_REMINDER': '📓',
    'PERP_STOPLOSS_REMINDER': '🛡️',
    'SOCIAL_MENTION': '𝕏',
};

// Module-level ref so "already processed" survives navigation between Overview/Spot/Balances
const processedSignalsRef = { current: new Set<string>() };
const lastCleanupRef = { current: Date.now() };

export function useAIFeedAlerts() {
    const { settings, triggerAlert, sendNotification } = useAdvancedAlerts();
    const { user, cloudSyncEnabled } = useSupabaseAuth();
    const memoryRef = useRef<MemoryStore | null>(null);
    const lastSaveRef = useRef<number>(0);
    const saveThrottleMs = 1500;
    
    // Cleanup old processed signals periodically (every 5 minutes) – uses module-level ref
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            if (now - lastCleanupRef.current > 300000) {
                processedSignalsRef.current.clear();
                lastCleanupRef.current = now;
            }
            if (memoryRef.current) {
                memoryRef.current = cleanupMemory(memoryRef.current);
            }
        }, 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        let cancelled = false;
        loadMemory("alerts", user?.id ?? null, cloudSyncEnabled).then((memory) => {
            if (cancelled) return;
            memoryRef.current = memory;
        });
        return () => {
            cancelled = true;
        };
    }, [user?.id, cloudSyncEnabled]);
    
    // Check if a signal type is enabled
    const isSignalTypeEnabled = useCallback((type: AISignalType): boolean => {
        if (!settings.aiFeedAlertsEnabled) return false;
        
        const settingKey = SIGNAL_TYPE_MAP[type];
        if (!settingKey) return false;
        
        return settings.aiFeedAlertTypes?.[settingKey] ?? DEFAULT_ENABLED_TYPES[settingKey];
    }, [settings.aiFeedAlertsEnabled, settings.aiFeedAlertTypes]);
    
    // Check if signal priority meets minimum threshold
    const meetsPriorityThreshold = useCallback((priority: 'high' | 'medium' | 'low'): boolean => {
        const minPriority = settings.aiFeedMinPriority || 'medium';
        return PRIORITY_ORDER[priority] >= PRIORITY_ORDER[minPriority];
    }, [settings.aiFeedMinPriority]);
    
    // Process an AI signal and trigger alerts if appropriate
    const processAISignal = useCallback((signal: AISignal) => {
        // Skip if already processed
        if (processedSignalsRef.current.has(signal.id)) {
            return;
        }
        
        // Skip if AI feed alerts are disabled
        if (!settings.aiFeedAlertsEnabled) {
            return;
        }
        
        // Check if this signal type is enabled
        if (!isSignalTypeEnabled(signal.type as AISignalType)) {
            return;
        }
        
        // Check priority threshold
        if (!meetsPriorityThreshold(signal.priority)) {
            return;
        }

        // Memory suppression (dismissed or cooldown)
        if (memoryRef.current && isSuppressed(memoryRef.current, signal.id)) {
            return;
        }
        
        // Mark as processed
        processedSignalsRef.current.add(signal.id);
        
        // Get channels for AI feed alerts
        const channels = settings.aiFeedChannels || ['in_app', 'browser', 'sound'];
        
        // Map priority
        const priorityMap: Record<string, AlertPriority> = {
            'high': 'high',
            'medium': 'medium',
            'low': 'low',
        };
        
        // Build notification message with emoji
        const emoji = SIGNAL_EMOJI[signal.type as AISignalType] || '📣';
        const title = `${emoji} ${signal.title}`;
        
        // Send notification through the advanced alerts system
        sendNotification(
            title,
            signal.description,
            priorityMap[signal.priority] || 'medium',
            channels as AlertChannel[],
            {
                symbol: signal.symbol,
                signalType: signal.type,
                ...signal.data,
            }
        );

        // Apply cooldowns for repeated alerts (futures tighter)
        const defaultHours = Math.max(1, Number(settings.aiFeedCooldownHoursDefault ?? 6) || 6);
        const priceMemoryHours = Math.max(1, Number(settings.aiFeedCooldownHoursPriceMemory ?? 12) || 12);
        const perpStoplossHours = Math.max(1, Number(settings.aiFeedCooldownHoursPerpStoploss ?? 2) || 2);
        const cooldownMs =
            signal.type === "PERP_STOPLOSS_REMINDER" ? perpStoplossHours * 60 * 60 * 1000 :
            signal.type === "PRICE_MEMORY" ? priceMemoryHours * 60 * 60 * 1000 :
            defaultHours * 60 * 60 * 1000;

        if (memoryRef.current) {
            memoryRef.current = setCooldown(memoryRef.current, {
                id: signal.id,
                type: signal.type,
                symbol: signal.symbol,
            }, cooldownMs);
            const now = Date.now();
            if (now - lastSaveRef.current > saveThrottleMs) {
                lastSaveRef.current = now;
                saveMemory("alerts", memoryRef.current, user?.id ?? null, cloudSyncEnabled).catch(() => {});
            }
        }
    }, [
        settings.aiFeedAlertsEnabled,
        settings.aiFeedCooldownHoursDefault,
        settings.aiFeedCooldownHoursPriceMemory,
        settings.aiFeedCooldownHoursPerpStoploss,
        settings.aiFeedChannels,
        isSignalTypeEnabled,
        meetsPriorityThreshold,
        sendNotification,
        user?.id,
        cloudSyncEnabled,
    ]);
    
    // Process multiple signals at once
    const processAISignals = useCallback((signals: AISignal[]) => {
        signals.forEach(processAISignal);
    }, [processAISignal]);
    
    // Check if a specific signal would trigger an alert (for UI preview)
    const wouldTriggerAlert = useCallback((signal: AISignal): boolean => {
        if (!settings.aiFeedAlertsEnabled) return false;
        if (!isSignalTypeEnabled(signal.type as AISignalType)) return false;
        if (!meetsPriorityThreshold(signal.priority)) return false;
        return true;
    }, [settings.aiFeedAlertsEnabled, isSignalTypeEnabled, meetsPriorityThreshold]);
    
    return {
        processAISignal,
        processAISignals,
        wouldTriggerAlert,
        isSignalTypeEnabled,
        isEnabled: settings.aiFeedAlertsEnabled,
        enabledTypes: settings.aiFeedAlertTypes || DEFAULT_ENABLED_TYPES,
        minPriority: settings.aiFeedMinPriority || 'medium',
        channels: settings.aiFeedChannels || ['in_app', 'browser', 'sound'],
    };
}
