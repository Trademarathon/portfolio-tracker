"use client";

import {
    loadAlertHistory,
    saveAlertHistory,
    loadAlertSettings,
    isInQuietHours,
    type AlertHistory,
    type AlertPriority,
} from "@/lib/api/alerts";
import { apiUrl } from "@/lib/api/client";

const HISTORY_SYNC_EVENT = "advanced-alerts-history-synced";

/**
 * Push a screener alert trigger into the main alert history and send via
 * configured channels (browser, Discord, Telegram). Called from AlertsContext
 * when a screener alert fires so it appears in NotificationCenter and delivery.
 */
export function pushScreenerTriggerToMain(
    symbol: string,
    message: string,
    price?: number
): void {
    if (typeof window === "undefined") return;
    try {
        const settings = loadAlertSettings();
        if (isInQuietHours(settings)) return;

        const historyEntry: AlertHistory = {
            id: Math.random().toString(36).substring(2, 11),
            alertId: "screener",
            alertName: "Screener",
            message,
            timestamp: Date.now(),
            priority: "high" as AlertPriority,
            channels: [],
            data: { symbol, price, source: "screener" },
            acknowledged: false,
        };

        const prev = loadAlertHistory();
        const updated = [historyEntry, ...prev].slice(0, 200);
        saveAlertHistory(updated);
        window.dispatchEvent(new CustomEvent(HISTORY_SYNC_EVENT));

        const title = "Screener Alert";
        const priority: AlertPriority = "high" as AlertPriority;

        if (settings.browserEnabled && "Notification" in window && Notification.permission === "granted") {
            try {
                new Notification(title, { body: message });
            } catch (_e) {}
        }

        if (settings.discordEnabled && settings.discordWebhookUrl) {
            fetch(apiUrl("/api/alerts/send"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "discord",
                    webhookUrl: settings.discordWebhookUrl,
                    title,
                    message,
                    priority,
                    symbol,
                    value: price,
                    mentionRole: settings.discordMentionOnCritical && priority === "critical"
                        ? settings.discordMentionRole
                        : undefined,
                }),
            }).catch(() => {});
        }

        if (settings.telegramEnabled && settings.telegramBotToken && settings.telegramChatId) {
            fetch(apiUrl("/api/alerts/send"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "telegram",
                    botToken: settings.telegramBotToken,
                    chatId: settings.telegramChatId,
                    title,
                    message,
                    priority,
                    symbol,
                    value: price,
                    silent: settings.telegramSilent,
                }),
            }).catch(() => {});
        }
    } catch (e) {
        console.warn("[ScreenerAlertsBridge] pushScreenerTriggerToMain failed:", e);
    }
}
