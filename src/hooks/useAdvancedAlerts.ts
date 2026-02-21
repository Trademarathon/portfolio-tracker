"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Alert,
    AlertHistory,
    AlertSettings,
    AlertChannel,
    AlertPriority,
    DEFAULT_ALERT_SETTINGS,
    ALERTS_STORAGE_KEY,
    loadAlerts,
    saveAlerts,
    loadAlertSettings,
    saveAlertSettings,
    loadAlertHistory,
    saveAlertHistory,
    ALERT_SETTINGS_KEY,
    formatAlertMessage,
    isInQuietHours,
} from '@/lib/api/alerts';
import { apiUrl } from '@/lib/api/client';

// Available sound types
export type SoundType = 
    | 'default' 
    | 'chime' 
    | 'alert' 
    | 'critical'
    | 'coin'
    | 'pop'
    | 'ding'
    | 'whoosh'
    | 'success'
    | 'error'
    | 'bubble'
    | 'bell';

// Sound generator using Web Audio API
export function createNotificationSound(
    type: SoundType,
    volume: number
): void {
    try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const gainNode = audioContext.createGain();
        gainNode.connect(audioContext.destination);
        gainNode.gain.value = volume;

        const now = audioContext.currentTime;

        switch (type) {
            case 'default': {
                // Soft notification sound - two gentle tones
                const osc1 = audioContext.createOscillator();
                const osc2 = audioContext.createOscillator();
                const gain1 = audioContext.createGain();
                const gain2 = audioContext.createGain();

                osc1.connect(gain1);
                osc2.connect(gain2);
                gain1.connect(gainNode);
                gain2.connect(gainNode);

                osc1.type = 'sine';
                osc2.type = 'sine';
                osc1.frequency.value = 880;
                osc2.frequency.value = 1108.73;

                gain1.gain.setValueAtTime(0, now);
                gain1.gain.linearRampToValueAtTime(0.3, now + 0.02);
                gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

                gain2.gain.setValueAtTime(0, now + 0.1);
                gain2.gain.linearRampToValueAtTime(0.2, now + 0.12);
                gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

                osc1.start(now);
                osc2.start(now + 0.1);
                osc1.stop(now + 0.3);
                osc2.stop(now + 0.4);
                break;
            }

            case 'chime': {
                // Pleasant chime - ascending notes
                const frequencies = [523.25, 659.25, 783.99];
                frequencies.forEach((freq, i) => {
                    const osc = audioContext.createOscillator();
                    const gain = audioContext.createGain();
                    osc.connect(gain);
                    gain.connect(gainNode);

                    osc.type = 'sine';
                    osc.frequency.value = freq;

                    const startTime = now + i * 0.12;
                    gain.gain.setValueAtTime(0, startTime);
                    gain.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.5);

                    osc.start(startTime);
                    osc.stop(startTime + 0.5);
                });
                break;
            }

            case 'alert': {
                // Alert sound - attention-grabbing double beep
                for (let i = 0; i < 2; i++) {
                    const osc = audioContext.createOscillator();
                    const gain = audioContext.createGain();
                    osc.connect(gain);
                    gain.connect(gainNode);

                    osc.type = 'square';
                    osc.frequency.value = 800;

                    const startTime = now + i * 0.25;
                    gain.gain.setValueAtTime(0, startTime);
                    gain.gain.linearRampToValueAtTime(0.2, startTime + 0.01);
                    gain.gain.setValueAtTime(0.2, startTime + 0.1);
                    gain.gain.linearRampToValueAtTime(0, startTime + 0.15);

                    osc.start(startTime);
                    osc.stop(startTime + 0.15);
                }
                break;
            }

            case 'critical': {
                // Critical - urgent siren-like sound
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                osc.connect(gain);
                gain.connect(gainNode);

                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.linearRampToValueAtTime(900, now + 0.15);
                osc.frequency.linearRampToValueAtTime(600, now + 0.3);
                osc.frequency.linearRampToValueAtTime(900, now + 0.45);
                osc.frequency.linearRampToValueAtTime(600, now + 0.6);

                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
                gain.gain.setValueAtTime(0.25, now + 0.55);
                gain.gain.linearRampToValueAtTime(0, now + 0.6);

                osc.start(now);
                osc.stop(now + 0.6);
                break;
            }

            case 'coin': {
                // Coin/cash register sound - classic game coin
                const osc1 = audioContext.createOscillator();
                const osc2 = audioContext.createOscillator();
                const gain1 = audioContext.createGain();
                const gain2 = audioContext.createGain();

                osc1.connect(gain1);
                osc2.connect(gain2);
                gain1.connect(gainNode);
                gain2.connect(gainNode);

                osc1.type = 'square';
                osc2.type = 'square';
                osc1.frequency.value = 987.77; // B5
                osc2.frequency.value = 1318.51; // E6

                gain1.gain.setValueAtTime(0.3, now);
                gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

                gain2.gain.setValueAtTime(0, now + 0.08);
                gain2.gain.linearRampToValueAtTime(0.3, now + 0.09);
                gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

                osc1.start(now);
                osc2.start(now + 0.08);
                osc1.stop(now + 0.1);
                osc2.stop(now + 0.3);
                break;
            }

            case 'pop': {
                // Pop sound - short bubble pop
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                osc.connect(gain);
                gain.connect(gainNode);

                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);

                gain.gain.setValueAtTime(0.4, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

                osc.start(now);
                osc.stop(now + 0.1);
                break;
            }

            case 'ding': {
                // Ding - single clear tone like a service bell
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                osc.connect(gain);
                gain.connect(gainNode);

                osc.type = 'sine';
                osc.frequency.value = 1200;

                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.4, now + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);

                osc.start(now);
                osc.stop(now + 0.8);
                break;
            }

            case 'whoosh': {
                // Whoosh - sweep sound
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                const filter = audioContext.createBiquadFilter();
                
                osc.connect(filter);
                filter.connect(gain);
                gain.connect(gainNode);

                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(100, now);
                osc.frequency.exponentialRampToValueAtTime(2000, now + 0.15);
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.3);

                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(500, now);
                filter.frequency.exponentialRampToValueAtTime(4000, now + 0.15);
                filter.frequency.exponentialRampToValueAtTime(500, now + 0.3);

                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
                gain.gain.linearRampToValueAtTime(0.2, now + 0.2);
                gain.gain.linearRampToValueAtTime(0, now + 0.3);

                osc.start(now);
                osc.stop(now + 0.3);
                break;
            }

            case 'success': {
                // Success - triumphant ascending arpeggio
                const notes = [392, 523.25, 659.25, 783.99]; // G4, C5, E5, G5
                notes.forEach((freq, i) => {
                    const osc = audioContext.createOscillator();
                    const gain = audioContext.createGain();
                    osc.connect(gain);
                    gain.connect(gainNode);

                    osc.type = 'sine';
                    osc.frequency.value = freq;

                    const startTime = now + i * 0.08;
                    gain.gain.setValueAtTime(0, startTime);
                    gain.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);

                    osc.start(startTime);
                    osc.stop(startTime + 0.4);
                });
                break;
            }

            case 'error': {
                // Error - descending buzzer
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                osc.connect(gain);
                gain.connect(gainNode);

                osc.type = 'square';
                osc.frequency.setValueAtTime(400, now);
                osc.frequency.linearRampToValueAtTime(200, now + 0.3);

                gain.gain.setValueAtTime(0.2, now);
                gain.gain.setValueAtTime(0.2, now + 0.25);
                gain.gain.linearRampToValueAtTime(0, now + 0.3);

                osc.start(now);
                osc.stop(now + 0.3);
                break;
            }

            case 'bubble': {
                // Bubble - underwater bubble sound
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                osc.connect(gain);
                gain.connect(gainNode);

                osc.type = 'sine';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);
                osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);

                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

                osc.start(now);
                osc.stop(now + 0.15);
                break;
            }

            case 'bell': {
                // Bell - rich bell tone with harmonics
                const fundamentalFreq = 440;
                const harmonics = [1, 2.4, 3, 4.2, 5.4];
                const amplitudes = [0.5, 0.3, 0.2, 0.15, 0.1];

                harmonics.forEach((harmonic, i) => {
                    const osc = audioContext.createOscillator();
                    const gain = audioContext.createGain();
                    osc.connect(gain);
                    gain.connect(gainNode);

                    osc.type = 'sine';
                    osc.frequency.value = fundamentalFreq * harmonic;

                    gain.gain.setValueAtTime(amplitudes[i], now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5 - i * 0.2);

                    osc.start(now);
                    osc.stop(now + 1.5);
                });
                break;
            }
        }
    } catch (e) {
        console.warn('Web Audio API not available:', e);
    }
}

export function useAdvancedAlerts() {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [history, setHistory] = useState<AlertHistory[]>([]);
    const [settings, setSettings] = useState<AlertSettings>(DEFAULT_ALERT_SETTINGS);
    const [unreadCount, setUnreadCount] = useState(0);
    
    const lastPricesRef = useRef<Record<string, number>>({});
    
    const ALERTS_SYNC_EVENT = 'advanced-alerts-synced';
    const HISTORY_SYNC_EVENT = 'advanced-alerts-history-synced';
    const SETTINGS_SYNC_EVENT = 'advanced-alerts-settings-synced';

    // Load initial data
    useEffect(() => {
        setAlerts(loadAlerts());
        setHistory(loadAlertHistory());
        setSettings(loadAlertSettings());
    }, []);

    // Sync history from localStorage when another instance updates it (e.g. clear in NotificationCenter)
    useEffect(() => {
        const handler = () => setHistory(loadAlertHistory());
        window.addEventListener(HISTORY_SYNC_EVENT, handler);
        return () => window.removeEventListener(HISTORY_SYNC_EVENT, handler);
    }, []);

    // Sync alerts across multiple hook instances/components.
    useEffect(() => {
        const handler = () => setAlerts(loadAlerts());
        const onStorage = (event: StorageEvent) => {
            if (event.key === ALERTS_STORAGE_KEY) {
                handler();
            }
        };
        window.addEventListener(ALERTS_SYNC_EVENT, handler);
        window.addEventListener('storage', onStorage);
        return () => {
            window.removeEventListener(ALERTS_SYNC_EVENT, handler);
            window.removeEventListener('storage', onStorage);
        };
    }, []);

    // Sync settings across multiple hook instances/components.
    useEffect(() => {
        const handler = () => setSettings(loadAlertSettings());
        const onStorage = (event: StorageEvent) => {
            if (event.key === ALERT_SETTINGS_KEY) {
                handler();
            }
        };
        window.addEventListener(SETTINGS_SYNC_EVENT, handler);
        window.addEventListener('storage', onStorage);
        return () => {
            window.removeEventListener(SETTINGS_SYNC_EVENT, handler);
            window.removeEventListener('storage', onStorage);
        };
    }, []);
    
    // Update unread count
    useEffect(() => {
        const unread = history.filter(h => !h.acknowledged).length;
        setUnreadCount(unread);
    }, [history]);
    
    // Request browser notification permission
    useEffect(() => {
        if (settings.browserEnabled && settings.requestPermissionOnStartup) {
            if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission();
            }
        }
    }, [settings.browserEnabled, settings.requestPermissionOnStartup]);
    
    // Save settings whenever they change
    const updateSettings = useCallback((newSettings: Partial<AlertSettings>) => {
        setSettings(prev => {
            const updated = { ...prev, ...newSettings };
            saveAlertSettings(updated);
            return updated;
        });
        setTimeout(() => window.dispatchEvent(new CustomEvent(SETTINGS_SYNC_EVENT)), 0);
    }, []);
    
    // Add new alert
    const addAlert = useCallback((alert: Omit<Alert, 'id' | 'createdAt' | 'triggerCount'>) => {
        const newAlert: Alert = {
            ...alert,
            id: Math.random().toString(36).substring(2, 11),
            createdAt: Date.now(),
            triggerCount: 0,
        };
        
        setAlerts(prev => {
            const updated = [...prev, newAlert];
            saveAlerts(updated);
            return updated;
        });
        setTimeout(() => window.dispatchEvent(new CustomEvent(ALERTS_SYNC_EVENT)), 0);
        
        return newAlert.id;
    }, [ALERTS_SYNC_EVENT]);
    
    // Update alert
    const updateAlert = useCallback((id: string, updates: Partial<Alert>) => {
        setAlerts(prev => {
            const updated = prev.map(a => a.id === id ? { ...a, ...updates } : a);
            saveAlerts(updated);
            return updated;
        });
        setTimeout(() => window.dispatchEvent(new CustomEvent(ALERTS_SYNC_EVENT)), 0);
    }, [ALERTS_SYNC_EVENT]);
    
    // Delete alert
    const deleteAlert = useCallback((id: string) => {
        setAlerts(prev => {
            const updated = prev.filter(a => a.id !== id);
            saveAlerts(updated);
            return updated;
        });
        setTimeout(() => window.dispatchEvent(new CustomEvent(ALERTS_SYNC_EVENT)), 0);
    }, [ALERTS_SYNC_EVENT]);
    
    // Toggle alert
    const toggleAlert = useCallback((id: string) => {
        setAlerts(prev => {
            const updated = prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a);
            saveAlerts(updated);
            return updated;
        });
        setTimeout(() => window.dispatchEvent(new CustomEvent(ALERTS_SYNC_EVENT)), 0);
    }, [ALERTS_SYNC_EVENT]);
    
    // Play sound
    const playSound = useCallback((priority: AlertPriority) => {
        if (!settings.soundEnabled) return;
        
        try {
            // Determine sound type based on priority and user setting
            let soundType: SoundType = (settings.soundFile as SoundType) || 'default';
            
            // Override to critical/error sound for critical priority alerts
            if (priority === 'critical') {
                soundType = 'critical';
            }
            
            // Generate and play the sound
            createNotificationSound(soundType, settings.soundVolume / 100);
        } catch (_e) {
            // Sound playback failed
            console.warn('Sound playback failed:', _e);
        }
    }, [settings.soundEnabled, settings.soundFile, settings.soundVolume]);
    
    // Send browser notification
    const sendBrowserNotification = useCallback((title: string, message: string, priority: AlertPriority) => {
        if (!settings.browserEnabled) return;
        if (!('Notification' in window)) return;
        if (Notification.permission !== 'granted') return;
        
        try {
            new Notification(title, {
                body: message,
                icon: '/favicon.ico',
                tag: `alert-${Date.now()}`,
                requireInteraction: priority === 'critical',
            });
        } catch (_e) {
            // Notification failed
        }
    }, [settings.browserEnabled]);
    
    // Send to Discord
    const sendDiscordAlert = useCallback(async (
        title: string, 
        message: string, 
        priority: AlertPriority,
        data?: Record<string, any>
    ) => {
        if (!settings.discordEnabled || !settings.discordWebhookUrl) return;
        
        try {
            await fetch(apiUrl('/api/alerts/send'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'discord',
                    webhookUrl: settings.discordWebhookUrl,
                    title,
                    message,
                    priority,
                    symbol: data?.symbol,
                    value: data?.value,
                    mentionRole: settings.discordMentionOnCritical && priority === 'critical' 
                        ? settings.discordMentionRole 
                        : undefined,
                }),
            });
        } catch (_e) {
            console.error('Failed to send Discord alert');
        }
    }, [settings.discordEnabled, settings.discordWebhookUrl, settings.discordMentionRole, settings.discordMentionOnCritical]);
    
    // Send to Telegram
    const sendTelegramAlert = useCallback(async (
        title: string, 
        message: string, 
        priority: AlertPriority,
        data?: Record<string, any>
    ) => {
        if (!settings.telegramEnabled || !settings.telegramBotToken || !settings.telegramChatId) return;
        
        try {
            await fetch(apiUrl('/api/alerts/send'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'telegram',
                    botToken: settings.telegramBotToken,
                    chatId: settings.telegramChatId,
                    title,
                    message,
                    priority,
                    symbol: data?.symbol,
                    value: data?.value,
                    silent: settings.telegramSilent,
                }),
            });
        } catch (_e) {
            console.error('Failed to send Telegram alert');
        }
    }, [settings.telegramEnabled, settings.telegramBotToken, settings.telegramChatId, settings.telegramSilent]);
    
    // Dispatch in-app notification
    const sendInAppNotification = useCallback((title: string, message: string, priority: AlertPriority, data?: Record<string, any>) => {
        if (!settings.inAppEnabled) return;
        
        const typeMap: Record<AlertPriority, string> = {
            low: 'info',
            medium: 'info',
            high: 'warning',
            critical: 'error',
        };
        
        window.dispatchEvent(new CustomEvent('app-notify', {
            detail: {
                type: typeMap[priority],
                title,
                message,
                symbol: data?.symbol,
                duration: priority === 'critical' ? 0 : 5000,
            }
        }));
    }, [settings.inAppEnabled]);
    
    // Add to history
    const addToHistory = useCallback((
        alert: Alert, 
        message: string, 
        channels: AlertChannel[],
        data?: Record<string, any>
    ) => {
        const historyEntry: AlertHistory = {
            id: Math.random().toString(36).substring(2, 11),
            alertId: alert.id,
            alertName: alert.name,
            message,
            timestamp: Date.now(),
            priority: alert.priority,
            channels,
            data,
            acknowledged: false,
        };
        
        setHistory(prev => {
            const updated = [historyEntry, ...prev].slice(0, 200);
            saveAlertHistory(updated);
            return updated;
        });
        // Defer sync event so listener (e.g. NotificationCenter) doesn't setState during our commit
        setTimeout(() => window.dispatchEvent(new CustomEvent(HISTORY_SYNC_EVENT)), 0);

        return historyEntry;
    }, []);
    
    // Main trigger function
    const triggerAlert = useCallback(async (
        alert: Alert,
        data: Record<string, any> = {}
    ) => {
        // Check if in quiet hours (skip for critical)
        if (alert.priority !== 'critical' && isInQuietHours(settings)) {
            return;
        }
        
        // Check cooldown
        if (alert.lastTriggered) {
            const cooldownMs = (alert.cooldown || settings.alertCooldownMinutes) * 60 * 1000;
            if (Date.now() - alert.lastTriggered < cooldownMs) {
                return;
            }
        }
        
        // Check max triggers
        if (alert.maxTriggers && alert.triggerCount >= alert.maxTriggers) {
            return;
        }
        
        // Check expiration
        if (alert.expiresAt && Date.now() > alert.expiresAt) {
            updateAlert(alert.id, { enabled: false });
            return;
        }
        
        const message = formatAlertMessage(alert, data);
        const triggeredChannels: AlertChannel[] = [];
        
        // Send to each enabled channel (browser, sound, discord, telegram run in this tick)
        for (const channel of alert.channels) {
            switch (channel) {
                case 'in_app':
                    if (settings.inAppEnabled) triggeredChannels.push('in_app');
                    break;
                case 'browser':
                    if (settings.browserEnabled) {
                        sendBrowserNotification(alert.name, message, alert.priority);
                        triggeredChannels.push('browser');
                    }
                    break;
                case 'sound':
                    if (settings.soundEnabled) {
                        playSound(alert.priority);
                        triggeredChannels.push('sound');
                    }
                    break;
                case 'discord':
                    if (settings.discordEnabled) {
                        await sendDiscordAlert(alert.name, message, alert.priority, data);
                        triggeredChannels.push('discord');
                    }
                    break;
                case 'telegram':
                    if (settings.telegramEnabled) {
                        await sendTelegramAlert(alert.name, message, alert.priority, data);
                        triggeredChannels.push('telegram');
                    }
                    break;
            }
        }
        
        // Update alert stats
        updateAlert(alert.id, {
            lastTriggered: Date.now(),
            triggerCount: alert.triggerCount + 1,
        });
        
        // Defer in-app notification and addToHistory to next event loop tick so we never
        // update NotificationCenter while another component (e.g. NeuralAlphaFeed) is rendering
        if (triggeredChannels.includes('in_app') || settings.showInNotificationCenter) {
            setTimeout(() => {
                if (triggeredChannels.includes('in_app')) {
                    sendInAppNotification(alert.name, message, alert.priority, data);
                }
                if (settings.showInNotificationCenter) {
                    addToHistory(alert, message, triggeredChannels, data);
                }
            }, 0);
        }
    }, [
        settings,
        updateAlert,
        sendInAppNotification,
        sendBrowserNotification,
        playSound,
        sendDiscordAlert,
        sendTelegramAlert,
        addToHistory,
    ]);
    
    // Check alerts against current prices
    const checkPriceAlerts = useCallback((prices: Record<string, number>) => {
        const prevPrices = lastPricesRef.current;
        
        for (const alert of alerts) {
            if (!alert.enabled) continue;
            
            for (const condition of alert.conditions) {
                const symbol = condition.symbol;
                if (!symbol) continue;
                
                const currentPrice = prices[symbol];
                const prevPrice = prevPrices[symbol];
                
                if (!currentPrice) continue;
                
                let triggered = false;
                
                switch (condition.type) {
                    case 'price_above':
                        triggered = currentPrice >= condition.value;
                        break;
                    case 'price_below':
                        triggered = currentPrice <= condition.value;
                        break;
                    case 'price_cross':
                        if (prevPrice !== undefined) {
                            const crossedAbove = prevPrice < condition.value && currentPrice >= condition.value;
                            const crossedBelow = prevPrice > condition.value && currentPrice <= condition.value;
                            triggered = crossedAbove || crossedBelow;
                        }
                        break;
                }
                
                if (triggered) {
                    triggerAlert(alert, { symbol, price: currentPrice, value: currentPrice });
                    break; // Only trigger once per alert per check
                }
            }
        }
        
        lastPricesRef.current = { ...prices };
    }, [alerts, triggerAlert]);
    
    // Acknowledge history entry
    const acknowledgeHistory = useCallback((id: string) => {
        setHistory(prev => {
            const updated = prev.map(h => h.id === id ? { ...h, acknowledged: true } : h);
            saveAlertHistory(updated);
            return updated;
        });
        setTimeout(() => window.dispatchEvent(new CustomEvent(HISTORY_SYNC_EVENT)), 0);
    }, []);
    
    // Acknowledge all
    const acknowledgeAll = useCallback(() => {
        setHistory(prev => {
            const updated = prev.map(h => ({ ...h, acknowledged: true }));
            saveAlertHistory(updated);
            return updated;
        });
        setTimeout(() => window.dispatchEvent(new CustomEvent(HISTORY_SYNC_EVENT)), 0);
    }, []);
    
    // Clear history
    const clearHistory = useCallback(() => {
        setHistory([]);
        saveAlertHistory([]);
        setTimeout(() => window.dispatchEvent(new CustomEvent(HISTORY_SYNC_EVENT)), 0);
    }, []);
    
    // Test connection
    const testConnection = useCallback(async (type: 'discord' | 'telegram'): Promise<{ success: boolean; error?: string }> => {
        try {
            const payload: any = { type };
            
            if (type === 'discord') {
                payload.webhookUrl = settings.discordWebhookUrl;
            } else {
                payload.botToken = settings.telegramBotToken;
                payload.chatId = settings.telegramChatId;
            }
            
            const response = await fetch(apiUrl('/api/alerts/test'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            
            const data = await response.json();
            return data;
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }, [settings.discordWebhookUrl, settings.telegramBotToken, settings.telegramChatId]);
    
    return {
        // Data
        alerts,
        history,
        settings,
        unreadCount,
        
        // Alert management
        addAlert,
        updateAlert,
        deleteAlert,
        toggleAlert,
        
        // Settings
        updateSettings,
        
        // History
        acknowledgeHistory,
        acknowledgeAll,
        clearHistory,
        
        // Actions
        triggerAlert,
        checkPriceAlerts,
        testConnection,
        
        // Manual notification
        sendNotification: (
            title: string, 
            message: string, 
            priority: AlertPriority = 'medium',
            channels: AlertChannel[] = ['in_app', 'browser', 'sound'],
            data?: Record<string, any>
        ) => {
            // Create a temporary alert for the notification
            const tempAlert: Alert = {
                id: 'manual',
                name: title,
                conditions: [],
                logic: 'AND',
                channels,
                priority,
                enabled: true,
                cooldown: 0,
                createdAt: Date.now(),
                triggerCount: 0,
            };
            triggerAlert(tempAlert, { ...data, message });
        },
    };
}
