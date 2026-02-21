"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { apiFetch } from "@/lib/api/client";
import { loadAlertSettings, saveAlertSettings } from "@/lib/api/alerts";
import { loadSocialSettings, saveSocialSettings, type SocialSettings } from "@/lib/social-settings";
import { loadAIUsageStats } from "@/lib/api/ai-usage";
import { disconnectX, getXStatus } from "@/lib/api/social";
import { cn } from "@/lib/utils";
import { ALL_FEATURES } from "@/lib/ai-orchestrator/registry";
import { isFeatureEnabled, setFeatureEnabled } from "@/lib/ai-orchestrator/orchestrator";
import {
    Shield,
    Eye,
    EyeOff,
    Info,
    RefreshCw,
    Loader2,
    CheckCircle2,
    XCircle,
    ExternalLink,
    Link2,
    Send,
    BarChart3,
} from "lucide-react";
import type { NotificationType } from "@/components/Notifications/NotificationSystem";
import type { AIProvider } from "@/lib/api/ai";

const ALERT_SETTINGS_SYNC_EVENT = "advanced-alerts-settings-synced";
const ALERT_SETTINGS_STORAGE_KEY = "portfolio_alert_settings";
const SOCIAL_SETTINGS_STORAGE_KEY = "social_x_settings";
const HEALTH_POLL_MS = 30000;

type ProviderTab = "openai" | "gemini" | "ollama";
type HealthStatus = "unknown" | "checking" | "healthy" | "error";

interface HealthState {
    status: HealthStatus;
    message: string;
}

interface ProviderAvailability {
    id?: string;
    available?: boolean;
}

interface IntegrationSettings {
    discordEnabled: boolean;
    discordWebhookUrl: string;
    discordMentionOnCritical: boolean;
    discordMentionRole: string;
    telegramEnabled: boolean;
    telegramBotToken: string;
    telegramChatId: string;
    telegramSilent: boolean;
}

interface SecurityTabProps {
    aiProvider: AIProvider;
    setAiProvider: (v: AIProvider) => void;
    openaiApiKey: string;
    setOpenaiApiKey: (v: string) => void;
    geminiApiKey: string;
    setGeminiApiKey: (v: string) => void;
    ollamaBaseUrl: string;
    setOllamaBaseUrl: (v: string) => void;
    ollamaModel: string;
    setOllamaModel: (v: string) => void;
    showOpenaiKey: boolean;
    setShowOpenaiKey: (v: boolean) => void;
    showGeminiKey: boolean;
    setShowGeminiKey: (v: boolean) => void;
    notify: (payload: { type: NotificationType; title: string; message: string }) => void;
}

function HelpHint({ text }: { text: string }) {
    return (
        <TooltipProvider delayDuration={120}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button type="button" className="text-zinc-500 hover:text-zinc-300 transition-colors">
                        <Info className="h-3.5 w-3.5" />
                    </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[280px] bg-zinc-900 border-white/10 text-xs text-zinc-200 leading-relaxed">
                    {text}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

function HealthBadge({ state }: { state: HealthState }) {
    const isChecking = state.status === "checking";
    const isHealthy = state.status === "healthy";
    const isError = state.status === "error";
    return (
        <div
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-bold tracking-wide",
                isChecking && "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
                isHealthy && "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
                isError && "border-rose-500/30 bg-rose-500/10 text-rose-300",
                state.status === "unknown" && "border-zinc-500/30 bg-zinc-500/10 text-zinc-400"
            )}
            title={state.message}
        >
            {isChecking ? (
                <Loader2 className="h-3 w-3 animate-spin" />
            ) : isHealthy ? (
                <CheckCircle2 className="h-3 w-3" />
            ) : isError ? (
                <XCircle className="h-3 w-3" />
            ) : (
                <div className="h-2 w-2 rounded-full bg-zinc-500/70" />
            )}
            {isChecking ? "Checking" : isHealthy ? "Healthy" : isError ? "Error" : "Unknown"}
        </div>
    );
}

export function SecurityTab({
    aiProvider,
    setAiProvider,
    openaiApiKey,
    setOpenaiApiKey,
    geminiApiKey,
    setGeminiApiKey,
    ollamaBaseUrl,
    setOllamaBaseUrl,
    ollamaModel,
    setOllamaModel,
    showOpenaiKey,
    setShowOpenaiKey,
    showGeminiKey,
    setShowGeminiKey,
    notify,
}: SecurityTabProps) {
    const [providerTab, setProviderTab] = useState<ProviderTab>("openai");
    const [providerHealth, setProviderHealth] = useState<Record<ProviderTab, boolean | null>>({
        openai: null,
        gemini: null,
        ollama: null,
    });
    const [providerHealthChecking, setProviderHealthChecking] = useState(false);
    const [aiUsageStats, setAiUsageStats] = useState(() => loadAIUsageStats());
    const [aiFeatureToggles, setAiFeatureToggles] = useState<Record<string, boolean>>(() => {
        const out: Record<string, boolean> = {};
        ALL_FEATURES.forEach((f) => (out[f] = isFeatureEnabled(f)));
        return out;
    });

    const [socialSettings, setSocialSettings] = useState<SocialSettings>(() => loadSocialSettings());
    const [xConnected, setXConnected] = useState(false);
    const [xConnecting, setXConnecting] = useState(false);
    const [showTelegramToken, setShowTelegramToken] = useState(false);
    const [showDiscordWebhook, setShowDiscordWebhook] = useState(false);
    const [copiedEnvSnippet, setCopiedEnvSnippet] = useState(false);
    const [integrationsSavedAt, setIntegrationsSavedAt] = useState<number | null>(null);
    const [testingDiscordDelivery, setTestingDiscordDelivery] = useState(false);
    const [testingTelegramDelivery, setTestingTelegramDelivery] = useState(false);

    const [integrationSettings, setIntegrationSettings] = useState<IntegrationSettings>(() => {
        const base = loadAlertSettings();
        return {
            discordEnabled: !!base.discordEnabled,
            discordWebhookUrl: base.discordWebhookUrl || "",
            discordMentionOnCritical: !!base.discordMentionOnCritical,
            discordMentionRole: base.discordMentionRole || "",
            telegramEnabled: !!base.telegramEnabled,
            telegramBotToken: base.telegramBotToken || "",
            telegramChatId: base.telegramChatId || "",
            telegramSilent: !!base.telegramSilent,
        };
    });

    const [xHealth, setXHealth] = useState<HealthState>({ status: "unknown", message: "Not checked yet." });
    const [discordHealth, setDiscordHealth] = useState<HealthState>({ status: "unknown", message: "Not checked yet." });
    const [telegramHealth, setTelegramHealth] = useState<HealthState>({ status: "unknown", message: "Not checked yet." });
    const [savingIntegrations, setSavingIntegrations] = useState(false);
    const [integrationsSaveMessage, setIntegrationsSaveMessage] = useState("");

    useEffect(() => {
        if (aiProvider === "openai" || aiProvider === "gemini" || aiProvider === "ollama") {
            setProviderTab(aiProvider);
        }
    }, [aiProvider]);

    useEffect(() => {
        const syncAlertSettings = () => {
            const base = loadAlertSettings();
            setIntegrationSettings({
                discordEnabled: !!base.discordEnabled,
                discordWebhookUrl: base.discordWebhookUrl || "",
                discordMentionOnCritical: !!base.discordMentionOnCritical,
                discordMentionRole: base.discordMentionRole || "",
                telegramEnabled: !!base.telegramEnabled,
                telegramBotToken: base.telegramBotToken || "",
                telegramChatId: base.telegramChatId || "",
                telegramSilent: !!base.telegramSilent,
            });
        };

        const syncSocialSettings = () => setSocialSettings(loadSocialSettings());

        const onStorage = (event: StorageEvent) => {
            if (event.key === ALERT_SETTINGS_STORAGE_KEY) syncAlertSettings();
            if (event.key === SOCIAL_SETTINGS_STORAGE_KEY) syncSocialSettings();
        };

        window.addEventListener(ALERT_SETTINGS_SYNC_EVENT, syncAlertSettings as EventListener);
        window.addEventListener("social-settings-changed", syncSocialSettings);
        window.addEventListener("storage", onStorage);
        return () => {
            window.removeEventListener(ALERT_SETTINGS_SYNC_EVENT, syncAlertSettings as EventListener);
            window.removeEventListener("social-settings-changed", syncSocialSettings);
            window.removeEventListener("storage", onStorage);
        };
    }, []);

    const refreshProviderHealth = useCallback(async () => {
        setProviderHealthChecking(true);
        try {
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (openaiApiKey.trim()) headers["x-openai-api-key"] = openaiApiKey.trim();
            if (geminiApiKey.trim()) headers["x-gemini-api-key"] = geminiApiKey.trim();
            if (ollamaBaseUrl.trim()) headers["x-ollama-base-url"] = ollamaBaseUrl.trim();
            if (ollamaModel.trim()) headers["x-ollama-model"] = ollamaModel.trim();

            const res = await apiFetch(
                "/api/ai/providers",
                { method: "GET", headers },
                9000
            );
            const json: { providers?: ProviderAvailability[] } = await res
                .json()
                .catch(() => ({}));
            if (!res.ok || !Array.isArray(json.providers)) {
                setProviderHealth({ openai: null, gemini: null, ollama: null });
                return;
            }
            const next: Record<ProviderTab, boolean | null> = { openai: null, gemini: null, ollama: null };
            for (const provider of json.providers) {
                const id = provider.id;
                if (id === "openai" || id === "gemini" || id === "ollama") {
                    next[id] = !!provider.available;
                }
            }
            setProviderHealth(next);
        } catch {
            setProviderHealth({ openai: null, gemini: null, ollama: null });
        } finally {
            setProviderHealthChecking(false);
        }
    }, [openaiApiKey, geminiApiKey, ollamaBaseUrl, ollamaModel]);

    const refreshXHealth = useCallback(async () => {
        setXHealth({ status: "checking", message: "Checking X connection..." });
        try {
            const status = await getXStatus();
            const connected = !!status.connected;
            setXConnected(connected);
            if (!connected) {
                setXHealth({
                    status: "error",
                    message: "X is not connected. Use Connect to authorize your account.",
                });
                return;
            }
            setXHealth({
                status: "healthy",
                message: "X account is connected and token is active.",
            });
        } catch (error) {
            setXConnected(false);
            setXHealth({
                status: "error",
                message: error instanceof Error ? error.message : "Failed to verify X connection.",
            });
        }
    }, []);

    const refreshDiscordHealth = useCallback(async () => {
        if (!integrationSettings.discordEnabled) {
            setDiscordHealth({ status: "unknown", message: "Discord integration is disabled." });
            return;
        }
        if (!integrationSettings.discordWebhookUrl.trim()) {
            setDiscordHealth({ status: "error", message: "Discord webhook URL is missing." });
            return;
        }

        setDiscordHealth({ status: "checking", message: "Checking Discord webhook..." });
        try {
            const res = await apiFetch(
                "/api/integrations/health",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        type: "discord",
                        webhookUrl: integrationSettings.discordWebhookUrl.trim(),
                    }),
                },
                10000
            );
            const json = await res.json().catch(() => ({} as { healthy?: boolean; error?: string; detail?: string; latencyMs?: number }));
            if (!res.ok || !json.healthy) {
                setDiscordHealth({
                    status: "error",
                    message: json.error || "Discord webhook check failed.",
                });
                return;
            }
            const latency = typeof json.latencyMs === "number" ? ` (${json.latencyMs}ms)` : "";
            setDiscordHealth({
                status: "healthy",
                message: `${json.detail || "Discord webhook reachable."}${latency}`,
            });
        } catch (error) {
            setDiscordHealth({
                status: "error",
                message: error instanceof Error ? error.message : "Discord webhook check failed.",
            });
        }
    }, [integrationSettings.discordEnabled, integrationSettings.discordWebhookUrl]);

    const refreshTelegramHealth = useCallback(async () => {
        if (!integrationSettings.telegramEnabled) {
            setTelegramHealth({ status: "unknown", message: "Telegram integration is disabled." });
            return;
        }
        if (!integrationSettings.telegramBotToken.trim()) {
            setTelegramHealth({ status: "error", message: "Telegram bot token is missing." });
            return;
        }

        setTelegramHealth({ status: "checking", message: "Checking Telegram bot and chat..." });
        try {
            const res = await apiFetch(
                "/api/integrations/health",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        type: "telegram",
                        botToken: integrationSettings.telegramBotToken.trim(),
                        chatId: integrationSettings.telegramChatId.trim(),
                    }),
                },
                10000
            );
            const json = await res.json().catch(() => ({} as { healthy?: boolean; error?: string; detail?: string; latencyMs?: number }));
            if (!res.ok || !json.healthy) {
                setTelegramHealth({
                    status: "error",
                    message: json.error || "Telegram check failed.",
                });
                return;
            }
            const latency = typeof json.latencyMs === "number" ? ` (${json.latencyMs}ms)` : "";
            setTelegramHealth({
                status: "healthy",
                message: `${json.detail || "Telegram integration healthy."}${latency}`,
            });
        } catch (error) {
            setTelegramHealth({
                status: "error",
                message: error instanceof Error ? error.message : "Telegram health check failed.",
            });
        }
    }, [integrationSettings.telegramEnabled, integrationSettings.telegramBotToken, integrationSettings.telegramChatId]);

    const refreshAllHealth = useCallback(async () => {
        await Promise.all([
            refreshProviderHealth(),
            refreshXHealth(),
            refreshDiscordHealth(),
            refreshTelegramHealth(),
        ]);
    }, [refreshProviderHealth, refreshXHealth, refreshDiscordHealth, refreshTelegramHealth]);

    useEffect(() => {
        void refreshAllHealth();
        const id = window.setInterval(() => {
            void refreshAllHealth();
        }, HEALTH_POLL_MS);
        return () => window.clearInterval(id);
    }, [refreshAllHealth]);

    useEffect(() => {
        const handle = () => setAiUsageStats(loadAIUsageStats());
        handle();
        window.addEventListener("ai-usage-changed", handle);
        return () => window.removeEventListener("ai-usage-changed", handle);
    }, []);

    useEffect(() => {
        const handler = () => {
            const next: Record<string, boolean> = {};
            ALL_FEATURES.forEach((f) => (next[f] = isFeatureEnabled(f)));
            setAiFeatureToggles(next);
        };
        window.addEventListener("ai-feature-toggles-changed", handler);
        return () => window.removeEventListener("ai-feature-toggles-changed", handler);
    }, []);

    useEffect(() => {
        try {
            const raw = localStorage.getItem("security_integrations_saved_at");
            if (!raw) return;
            const value = Number(raw);
            if (Number.isFinite(value) && value > 0) setIntegrationsSavedAt(value);
        } catch {
            // ignore
        }
    }, []);

    const resetAiUsage = () => {
        try {
            localStorage.removeItem("ai_usage_stats_v1");
            window.dispatchEvent(new Event("ai-usage-changed"));
        } catch {
            // ignore
        }
    };

    const formatTokens = (value: number) => {
        if (!value) return "0";
        if (value > 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
        if (value > 10_000) return `${(value / 1000).toFixed(1)}k`;
        return value.toLocaleString();
    };

    const saveAiKeys = async () => {
        if (openaiApiKey.trim()) localStorage.setItem("openai_api_key", openaiApiKey.trim());
        else localStorage.removeItem("openai_api_key");

        if (geminiApiKey.trim()) localStorage.setItem("gemini_api_key", geminiApiKey.trim());
        else localStorage.removeItem("gemini_api_key");

        if (ollamaBaseUrl.trim()) localStorage.setItem("ollama_base_url", ollamaBaseUrl.trim());
        else localStorage.removeItem("ollama_base_url");

        if (ollamaModel.trim()) localStorage.setItem("ollama_model", ollamaModel.trim());
        else localStorage.removeItem("ollama_model");

        localStorage.setItem("ai_provider", aiProvider);
        window.dispatchEvent(new Event("openai-api-key-changed"));
        window.dispatchEvent(new Event("gemini-api-key-changed"));
        window.dispatchEvent(new Event("ollama-settings-changed"));
        window.dispatchEvent(new Event("ai-provider-changed"));
        notify({
            type: "success",
            title: "AI Settings Saved",
            message: `Provider set to ${aiProvider.toUpperCase()}. OpenAI/Gemini/Ollama settings updated.`,
        });
        await refreshProviderHealth();
    };

    const saveIntegrationSettings = async () => {
        const discordMissing = integrationSettings.discordEnabled && !integrationSettings.discordWebhookUrl.trim();
        const telegramTokenMissing = integrationSettings.telegramEnabled && !integrationSettings.telegramBotToken.trim();
        const telegramChatMissing = integrationSettings.telegramEnabled && !integrationSettings.telegramChatId.trim();

        if (discordMissing || telegramTokenMissing || telegramChatMissing) {
            notify({
                type: "error",
                title: "Missing integration fields",
                message: "Fill required Discord/Telegram fields before saving.",
            });
            return;
        }

        setSavingIntegrations(true);
        setIntegrationsSaveMessage("");
        try {
            const currentAlerts = loadAlertSettings();
            saveAlertSettings({
                ...currentAlerts,
                discordEnabled: integrationSettings.discordEnabled,
                discordWebhookUrl: integrationSettings.discordWebhookUrl.trim(),
                discordMentionOnCritical: integrationSettings.discordMentionOnCritical,
                discordMentionRole: integrationSettings.discordMentionRole.trim(),
                telegramEnabled: integrationSettings.telegramEnabled,
                telegramBotToken: integrationSettings.telegramBotToken.trim(),
                telegramChatId: integrationSettings.telegramChatId.trim(),
                telegramSilent: integrationSettings.telegramSilent,
            });
            saveSocialSettings(socialSettings);
            window.dispatchEvent(new CustomEvent(ALERT_SETTINGS_SYNC_EVENT));
            window.dispatchEvent(new Event("social-settings-changed"));
            window.dispatchEvent(new Event("settings-changed"));
            const now = Date.now();
            localStorage.setItem("security_integrations_saved_at", String(now));
            setIntegrationsSavedAt(now);
            setIntegrationsSaveMessage("Saved");
            notify({
                type: "success",
                title: "Integrations Saved",
                message: "X / Discord / Telegram configuration saved.",
            });
            await Promise.all([refreshXHealth(), refreshDiscordHealth(), refreshTelegramHealth()]);
        } catch (error) {
            setIntegrationsSaveMessage("Save failed");
            notify({
                type: "error",
                title: "Save failed",
                message: error instanceof Error ? error.message : "Failed to save integration settings.",
            });
        } finally {
            setSavingIntegrations(false);
        }
    };

    const connectX = async () => {
        try {
            setXConnecting(true);
            const res = await apiFetch("/api/social/x/auth?json=1", { method: "GET" }, 10000);
            const body = await res
                .json()
                .catch(() => ({} as { url?: string; error?: string }));
            const url = typeof body.url === "string" ? body.url : "";
            if (!res.ok || !url) {
                const serverError = body.error || "Failed to generate auth URL.";
                notify({
                    type: "error",
                    title: "X Connect Failed",
                    message: `${serverError} Add X_CLIENT_ID, X_CLIENT_SECRET, and X_REDIRECT_URI in /portfolio-tracker/.env then restart api-server.`,
                });
                return;
            }
            window.open(url, "_blank", "width=540,height=720");
            notify({
                type: "info",
                title: "Complete X Login",
                message: "After approving OAuth, click Refresh Health to verify connection.",
            });
        } finally {
            setXConnecting(false);
        }
    };

    const copyXEnvSnippet = async () => {
        const snippet = [
            "# X OAuth (used by /api/social/x/* in api-server)",
            "X_CLIENT_ID=your_x_client_id",
            "X_CLIENT_SECRET=your_x_client_secret",
            "X_REDIRECT_URI=http://127.0.0.1:35821/api/social/x/callback",
            "X_SUCCESS_REDIRECT=http://localhost:3000/settings?tab=security",
        ].join("\n");
        try {
            await navigator.clipboard.writeText(snippet);
            setCopiedEnvSnippet(true);
            window.setTimeout(() => setCopiedEnvSnippet(false), 1400);
        } catch {
            notify({
                type: "error",
                title: "Copy failed",
                message: "Could not copy env snippet. Paste values manually in /portfolio-tracker/.env.",
            });
        }
    };

    const sendDiscordTest = async () => {
        if (!integrationSettings.discordWebhookUrl.trim()) {
            notify({ type: "error", title: "Discord webhook missing", message: "Add webhook URL first." });
            return;
        }
        setTestingDiscordDelivery(true);
        try {
            const res = await apiFetch(
                "/api/alerts/test",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        type: "discord",
                        webhookUrl: integrationSettings.discordWebhookUrl.trim(),
                    }),
                },
                12000
            );
            const json = await res.json().catch(() => ({} as { success?: boolean; error?: string }));
            if (!res.ok || !json.success) {
                notify({
                    type: "error",
                    title: "Discord test failed",
                    message: json.error || "Failed to send Discord test message.",
                });
                return;
            }
            notify({ type: "success", title: "Discord test sent", message: "Check your Discord channel for the test alert." });
            await refreshDiscordHealth();
        } finally {
            setTestingDiscordDelivery(false);
        }
    };

    const sendTelegramTest = async () => {
        if (!integrationSettings.telegramBotToken.trim() || !integrationSettings.telegramChatId.trim()) {
            notify({ type: "error", title: "Telegram fields missing", message: "Add bot token and chat ID first." });
            return;
        }
        setTestingTelegramDelivery(true);
        try {
            const res = await apiFetch(
                "/api/alerts/test",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        type: "telegram",
                        botToken: integrationSettings.telegramBotToken.trim(),
                        chatId: integrationSettings.telegramChatId.trim(),
                    }),
                },
                12000
            );
            const json = await res.json().catch(() => ({} as { success?: boolean; error?: string }));
            if (!res.ok || !json.success) {
                notify({
                    type: "error",
                    title: "Telegram test failed",
                    message: json.error || "Failed to send Telegram test message.",
                });
                return;
            }
            notify({ type: "success", title: "Telegram test sent", message: "Check your Telegram chat for the test alert." });
            await refreshTelegramHealth();
        } finally {
            setTestingTelegramDelivery(false);
        }
    };

    const disconnectXAccount = async () => {
        await disconnectX();
        setXConnected(false);
        setXHealth({ status: "error", message: "X disconnected." });
        notify({ type: "success", title: "X Disconnected", message: "X integration has been disconnected." });
    };

    const providerIndicatorClass = (provider: ProviderTab) =>
        cn(
            "h-2 w-2 rounded-full",
            providerHealthChecking && "bg-cyan-400/80 animate-pulse",
            !providerHealthChecking && providerHealth[provider] === true && "bg-emerald-400/80",
            !providerHealthChecking && providerHealth[provider] === false && "bg-rose-400/80",
            !providerHealthChecking && providerHealth[provider] === null && "bg-zinc-500/80"
        );

    const integrationValidationIssues: string[] = [];
    if (integrationSettings.discordEnabled && !integrationSettings.discordWebhookUrl.trim()) {
        integrationValidationIssues.push("Discord is enabled but webhook URL is empty.");
    }
    if (integrationSettings.telegramEnabled && !integrationSettings.telegramBotToken.trim()) {
        integrationValidationIssues.push("Telegram is enabled but bot token is empty.");
    }
    if (integrationSettings.telegramEnabled && !integrationSettings.telegramChatId.trim()) {
        integrationValidationIssues.push("Telegram is enabled but chat ID is empty.");
    }

    return (
        <Card className="bg-card/50 backdrop-blur-xl border-border">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Shield className="h-4 w-4 text-zinc-400" />
                    Account Security
                </CardTitle>
                <CardDescription>Manage your account security settings and API key permissions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="p-4 bg-amber-500/5 rounded-xl border border-amber-500/20">
                    <h4 className="font-bold text-amber-400 text-sm mb-2">API Key Best Practices</h4>
                    <ul className="text-xs text-zinc-400 space-y-1 list-disc list-inside">
                        <li>
                            Use <strong className="text-zinc-300">Read-Only</strong> keys when possible (no trading)
                        </li>
                        <li>
                            Enable <strong className="text-zinc-300">IP Whitelist</strong> on your exchange
                        </li>
                        <li>
                            Enable <strong className="text-zinc-300">Allow Trading</strong> only for connections you use to trade
                        </li>
                        <li>Enable Trading PIN for extra protection when placing orders</li>
                    </ul>
                </div>

                <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-white text-sm">AI Provider Gateway</h4>
                        <button
                            type="button"
                            onClick={() => void refreshProviderHealth()}
                            className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-zinc-300 hover:bg-white/10"
                        >
                            <RefreshCw className={cn("h-3 w-3", providerHealthChecking && "animate-spin")} />
                            Refresh Health
                        </button>
                    </div>

                    <p className="text-xs text-zinc-500">
                        Configure multi-provider AI routing for chat/copilot features. Use <strong className="text-zinc-300">AUTO</strong> to fallback between OpenAI, Gemini, and Ollama.
                    </p>

                    <div className="space-y-3">
                        <label className="text-[11px] font-bold uppercase tracking-wide text-zinc-400 flex items-center gap-2">
                            Preferred Provider
                            <HelpHint text="AUTO tries OpenAI first, then Gemini, then Ollama local model if available." />
                        </label>
                        <select
                            value={aiProvider}
                            onChange={(e) => setAiProvider((e.target.value as AIProvider) || "auto")}
                            className="w-full bg-black/40 border border-white/10 rounded p-3 text-white text-sm focus:border-primary/50 outline-none"
                        >
                            <option value="auto">Auto (OpenAI → Gemini → Ollama fallback)</option>
                            <option value="openai">OpenAI</option>
                            <option value="gemini">Gemini</option>
                            <option value="ollama">Ollama</option>
                        </select>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">Provider Settings</label>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => setProviderTab("openai")}
                                className={cn(
                                    "px-3 py-2 rounded-lg border text-xs font-bold tracking-wide transition-colors flex items-center justify-between",
                                    providerTab === "openai"
                                        ? "border-cyan-400/35 bg-cyan-500/15 text-cyan-100"
                                        : "border-white/10 bg-black/30 text-zinc-400 hover:text-zinc-300 hover:bg-white/5"
                                )}
                            >
                                <span>OpenAI</span>
                                <span className={providerIndicatorClass("openai")} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setProviderTab("gemini")}
                                className={cn(
                                    "px-3 py-2 rounded-lg border text-xs font-bold tracking-wide transition-colors flex items-center justify-between",
                                    providerTab === "gemini"
                                        ? "border-cyan-400/35 bg-cyan-500/15 text-cyan-100"
                                        : "border-white/10 bg-black/30 text-zinc-400 hover:text-zinc-300 hover:bg-white/5"
                                )}
                            >
                                <span>Gemini</span>
                                <span className={providerIndicatorClass("gemini")} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setProviderTab("ollama")}
                                className={cn(
                                    "px-3 py-2 rounded-lg border text-xs font-bold tracking-wide transition-colors flex items-center justify-between",
                                    providerTab === "ollama"
                                        ? "border-cyan-400/35 bg-cyan-500/15 text-cyan-100"
                                        : "border-white/10 bg-black/30 text-zinc-400 hover:text-zinc-300 hover:bg-white/5"
                                )}
                            >
                                <span>Ollama</span>
                                <span className={providerIndicatorClass("ollama")} />
                            </button>
                        </div>
                    </div>

                    {providerTab === "openai" && (
                        <div className="space-y-2 rounded-lg border border-white/10 bg-black/25 p-3">
                            <label className="text-[11px] font-bold uppercase tracking-wide text-zinc-400 flex items-center gap-2">
                                OpenAI API Key
                                <HelpHint text="Create a key in platform.openai.com, then paste it here. Use a low-cost model such as gpt-4o-mini for routine signals." />
                            </label>
                            <div className="flex gap-2">
                                <div className="flex-1 relative">
                                    <input
                                        type={showOpenaiKey ? "text" : "password"}
                                        placeholder="sk-..."
                                        className="w-full bg-black/40 border border-white/10 rounded p-3 pr-10 text-white text-sm focus:border-primary/50 outline-none"
                                        value={openaiApiKey}
                                        onChange={(e) => setOpenaiApiKey(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-400 p-1"
                                    >
                                        {showOpenaiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {providerTab === "gemini" && (
                        <div className="space-y-2 rounded-lg border border-white/10 bg-black/25 p-3">
                            <label className="text-[11px] font-bold uppercase tracking-wide text-zinc-400 flex items-center gap-2">
                                Gemini API Key
                                <HelpHint text="Generate key in Google AI Studio. Many accounts have starter no-cost quota, but limits can change." />
                            </label>
                            <div className="flex gap-2">
                                <div className="flex-1 relative">
                                    <input
                                        type={showGeminiKey ? "text" : "password"}
                                        placeholder="AIza..."
                                        className="w-full bg-black/40 border border-white/10 rounded p-3 pr-10 text-white text-sm focus:border-primary/50 outline-none"
                                        value={geminiApiKey}
                                        onChange={(e) => setGeminiApiKey(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowGeminiKey(!showGeminiKey)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-400 p-1"
                                    >
                                        {showGeminiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {providerTab === "ollama" && (
                        <div className="space-y-3 rounded-lg border border-white/10 bg-black/25 p-3">
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold uppercase tracking-wide text-zinc-400 flex items-center gap-2">
                                    Ollama Base URL
                                    <HelpHint text="Default local endpoint is http://127.0.0.1:11434. Keep Ollama running in background to pass health checks." />
                                </label>
                                <input
                                    type="text"
                                    placeholder="http://127.0.0.1:11434"
                                    className="w-full bg-black/40 border border-white/10 rounded p-3 text-white text-sm focus:border-primary/50 outline-none"
                                    value={ollamaBaseUrl}
                                    onChange={(e) => setOllamaBaseUrl(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold uppercase tracking-wide text-zinc-400 flex items-center gap-2">
                                    Ollama Model
                                    <HelpHint text="Recommended local models: llama3.1:8b (balanced), qwen2.5:7b (strong reasoning), mistral:7b (fast). Choose based on your RAM/VRAM." />
                                </label>
                                <input
                                    type="text"
                                    placeholder="llama3.1:8b"
                                    className="w-full bg-black/40 border border-white/10 rounded p-3 text-white text-sm focus:border-primary/50 outline-none"
                                    value={ollamaModel}
                                    onChange={(e) => setOllamaModel(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => void saveAiKeys()}
                            className="px-4 py-2 rounded-lg bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 text-sm font-medium"
                        >
                            Save AI Provider Settings
                        </button>
                    </div>

                    <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-zinc-300 space-y-2">
                        <div className="font-bold text-cyan-300">Quick Cost + Model Guide</div>
                        <p>For low-cost cloud inference use OpenAI `gpt-4o-mini` or Gemini Flash variants.</p>
                        <p>For fully local/no API fees use Ollama with `llama3.1:8b` as default starting point.</p>
                        <p>Free tiers and limits can change, so monitor provider dashboards before scaling usage.</p>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-black/30 p-3 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-bold text-white">
                                <BarChart3 className="h-4 w-4 text-cyan-300" />
                                AI Usage Stats
                            </div>
                            <button
                                type="button"
                                onClick={resetAiUsage}
                                className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold text-zinc-300 hover:bg-white/10"
                            >
                                Reset
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
                            {(["openai", "gemini", "ollama"] as const).map((provider) => {
                                const totals = aiUsageStats.providers[provider];
                                return (
                                    <div key={provider} className="rounded-lg border border-white/10 bg-black/40 p-2 space-y-1">
                                        <div className="text-xs font-bold uppercase tracking-wide text-zinc-300">{provider}</div>
                                        <div className="text-zinc-400">Calls: <span className="text-white">{totals.count}</span></div>
                                        <div className="text-zinc-400">Tokens: <span className="text-white">{formatTokens(totals.totalTokens)}</span></div>
                                        <div className="text-zinc-500">Last: {totals.lastUsed ? new Date(totals.lastUsed).toLocaleString() : "—"}</div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="space-y-1">
                            <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">Top features</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                                {Object.entries(aiUsageStats.features)
                                    .sort((a, b) => (b[1]?.count || 0) - (a[1]?.count || 0))
                                    .slice(0, 4)
                                    .map(([feature, totals]) => (
                                        <div key={feature} className="flex items-center justify-between rounded-md border border-white/10 bg-black/40 px-2 py-1">
                                            <span className="text-zinc-300">{feature}</span>
                                            <span className="text-zinc-400">{totals.count} calls</span>
                                        </div>
                                    ))}
                                {Object.keys(aiUsageStats.features).length === 0 && (
                                    <div className="text-zinc-500">No AI usage recorded yet.</div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-black/30 p-3 space-y-3">
                        <div className="text-sm font-bold text-white">AI Feature Toggles</div>
                        <p className="text-[11px] text-zinc-500">Enable or disable AI insights per feature to control noise and cost.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                            {ALL_FEATURES.map((feature) => (
                                <div key={feature} className="flex items-center justify-between rounded-md border border-white/10 bg-black/40 px-2 py-2">
                                    <span className="text-zinc-300">{feature.replace(/_/g, " ")}</span>
                                    <Switch
                                        checked={aiFeatureToggles[feature] !== false}
                                        onCheckedChange={(v) => {
                                            setFeatureEnabled(feature, v);
                                            setAiFeatureToggles((prev) => ({ ...prev, [feature]: v }));
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-white text-sm">Integrations Hub (X / Discord / Telegram)</h4>
                        <button
                            type="button"
                            onClick={() => void refreshAllHealth()}
                            className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-zinc-300 hover:bg-white/10"
                        >
                            <RefreshCw className="h-3 w-3" />
                            Refresh All Health
                        </button>
                    </div>
                    <p className="text-xs text-zinc-500">
                        Live status checks run every 30 seconds and show setup errors directly in this panel.
                    </p>

                    <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-bold uppercase tracking-wide text-cyan-300">Where to add each API</div>
                            <button
                                type="button"
                                onClick={() => void copyXEnvSnippet()}
                                className="rounded-md border border-cyan-500/30 bg-cyan-500/15 px-2 py-1 text-[10px] font-bold text-cyan-100 hover:bg-cyan-500/20"
                            >
                                {copiedEnvSnippet ? "Copied" : "Copy X .env snippet"}
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
                            <div className="rounded-lg border border-white/10 bg-black/30 p-2.5">
                                <div className="font-bold text-white mb-1">X OAuth</div>
                                <p className="text-zinc-400">Add in <code className="text-zinc-300">/portfolio-tracker/.env</code>, then restart <code className="text-zinc-300">npm run api-server</code>.</p>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-black/30 p-2.5">
                                <div className="font-bold text-white mb-1">Discord</div>
                                <p className="text-zinc-400">Paste webhook URL in the Discord card below, click <span className="text-zinc-300">Check</span>, then <span className="text-zinc-300">Send Test</span>.</p>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-black/30 p-2.5">
                                <div className="font-bold text-white mb-1">Telegram</div>
                                <p className="text-zinc-400">Paste bot token + chat ID in the Telegram card, then run health and delivery test.</p>
                            </div>
                        </div>
                        <pre className="overflow-x-auto rounded-md border border-white/10 bg-black/40 p-2 text-[10px] leading-relaxed text-zinc-300">
{`X_CLIENT_ID=your_x_client_id
X_CLIENT_SECRET=your_x_client_secret
X_REDIRECT_URI=http://127.0.0.1:35821/api/social/x/callback
X_SUCCESS_REDIRECT=http://localhost:3000/settings?tab=security`}
                        </pre>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                        <div className="rounded-xl border border-white/10 bg-black/25 p-3 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <Link2 className="h-4 w-4 text-cyan-300" />
                                    <span className="text-sm font-bold text-white">X (Twitter)</span>
                                </div>
                                <HealthBadge state={xHealth} />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="text-xs text-zinc-400 flex items-center gap-2">
                                    Enable Social Feed
                                    <HelpHint text="When enabled, X posts can enrich AI feed signals in Overview/Markets/Spot/Balances." />
                                </div>
                                <Switch
                                    checked={socialSettings.enabled}
                                    onCheckedChange={(v) => setSocialSettings((prev) => ({ ...prev, enabled: v }))}
                                />
                            </div>

                            <div className="text-xs text-zinc-400">
                                Status: {xConnected ? <span className="text-emerald-300">Connected</span> : <span className="text-rose-300">Disconnected</span>}
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => void connectX()}
                                    disabled={xConnecting}
                                    className="inline-flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/15 px-2.5 py-1 text-[11px] font-bold text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-60"
                                >
                                    {xConnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
                                    {xConnected ? "Reconnect" : "Connect"}
                                </button>
                                {xConnected && (
                                    <button
                                        type="button"
                                        onClick={() => void disconnectXAccount()}
                                        className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-bold text-rose-300 hover:bg-rose-500/15"
                                    >
                                        Disconnect
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => void refreshXHealth()}
                                    className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-zinc-300 hover:bg-white/10"
                                >
                                    Check
                                </button>
                            </div>

                            <p className="text-[11px] text-zinc-500">{xHealth.message}</p>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-black/25 p-3 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <Send className="h-4 w-4 text-indigo-300" />
                                    <span className="text-sm font-bold text-white">Discord</span>
                                </div>
                                <HealthBadge state={discordHealth} />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="text-xs text-zinc-400">Enable Discord Alerts</div>
                                <Switch
                                    checked={integrationSettings.discordEnabled}
                                    onCheckedChange={(v) => setIntegrationSettings((prev) => ({ ...prev, discordEnabled: v }))}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-bold uppercase tracking-wide text-zinc-400 flex items-center gap-2">
                                    Webhook URL
                                    <HelpHint text="In Discord: Server Settings → Integrations → Webhooks → New Webhook → Copy URL." />
                                </label>
                                <div className="relative">
                                    <input
                                        type={showDiscordWebhook ? "text" : "password"}
                                        placeholder="https://discord.com/api/webhooks/..."
                                        className="w-full bg-black/40 border border-white/10 rounded p-2.5 pr-10 text-white text-sm focus:border-primary/50 outline-none"
                                        value={integrationSettings.discordWebhookUrl}
                                        onChange={(e) => setIntegrationSettings((prev) => ({ ...prev, discordWebhookUrl: e.target.value }))}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowDiscordWebhook((v) => !v)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-400 p-1"
                                    >
                                        {showDiscordWebhook ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">Mention Role ID (optional)</label>
                                <input
                                    type="text"
                                    placeholder="123456789012345678"
                                    className="w-full bg-black/40 border border-white/10 rounded p-2.5 text-white text-sm focus:border-primary/50 outline-none"
                                    value={integrationSettings.discordMentionRole}
                                    onChange={(e) => setIntegrationSettings((prev) => ({ ...prev, discordMentionRole: e.target.value }))}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="text-xs text-zinc-400">Mention on critical alerts</div>
                                <Switch
                                    checked={integrationSettings.discordMentionOnCritical}
                                    onCheckedChange={(v) => setIntegrationSettings((prev) => ({ ...prev, discordMentionOnCritical: v }))}
                                />
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => void refreshDiscordHealth()}
                                    className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-zinc-300 hover:bg-white/10"
                                >
                                    Check
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void sendDiscordTest()}
                                    disabled={testingDiscordDelivery}
                                    className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-bold text-indigo-200 hover:bg-indigo-500/15 disabled:opacity-60"
                                >
                                    {testingDiscordDelivery ? "Sending..." : "Send Test"}
                                </button>
                            </div>
                            <p className="text-[11px] text-zinc-500">{discordHealth.message}</p>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-black/25 p-3 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <Send className="h-4 w-4 text-sky-300" />
                                    <span className="text-sm font-bold text-white">Telegram</span>
                                </div>
                                <HealthBadge state={telegramHealth} />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="text-xs text-zinc-400">Enable Telegram Alerts</div>
                                <Switch
                                    checked={integrationSettings.telegramEnabled}
                                    onCheckedChange={(v) => setIntegrationSettings((prev) => ({ ...prev, telegramEnabled: v }))}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-bold uppercase tracking-wide text-zinc-400 flex items-center gap-2">
                                    Bot Token
                                    <HelpHint text="Create bot with @BotFather and copy token. Start a chat with your bot before testing." />
                                </label>
                                <div className="relative">
                                    <input
                                        type={showTelegramToken ? "text" : "password"}
                                        placeholder="123456:ABCDEF..."
                                        className="w-full bg-black/40 border border-white/10 rounded p-2.5 pr-10 text-white text-sm focus:border-primary/50 outline-none"
                                        value={integrationSettings.telegramBotToken}
                                        onChange={(e) => setIntegrationSettings((prev) => ({ ...prev, telegramBotToken: e.target.value }))}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowTelegramToken((v) => !v)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-400 p-1"
                                    >
                                        {showTelegramToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-bold uppercase tracking-wide text-zinc-400 flex items-center gap-2">
                                    Chat ID
                                    <HelpHint text="Send /start to bot, then obtain chat_id (bot API or helper bots). Use a channel/group ID if routing there." />
                                </label>
                                <input
                                    type="text"
                                    placeholder="-1001234567890"
                                    className="w-full bg-black/40 border border-white/10 rounded p-2.5 text-white text-sm focus:border-primary/50 outline-none"
                                    value={integrationSettings.telegramChatId}
                                    onChange={(e) => setIntegrationSettings((prev) => ({ ...prev, telegramChatId: e.target.value }))}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="text-xs text-zinc-400">Silent messages</div>
                                <Switch
                                    checked={integrationSettings.telegramSilent}
                                    onCheckedChange={(v) => setIntegrationSettings((prev) => ({ ...prev, telegramSilent: v }))}
                                />
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => void refreshTelegramHealth()}
                                    className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-zinc-300 hover:bg-white/10"
                                >
                                    Check
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void sendTelegramTest()}
                                    disabled={testingTelegramDelivery}
                                    className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-bold text-indigo-200 hover:bg-indigo-500/15 disabled:opacity-60"
                                >
                                    {testingTelegramDelivery ? "Sending..." : "Send Test"}
                                </button>
                            </div>
                            <p className="text-[11px] text-zinc-500">{telegramHealth.message}</p>
                        </div>
                    </div>

                    {integrationValidationIssues.length > 0 && (
                        <div className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200 space-y-1">
                            <div className="font-bold uppercase tracking-wide text-[10px]">Fix before save</div>
                            {integrationValidationIssues.map((issue) => (
                                <div key={issue}>- {issue}</div>
                            ))}
                        </div>
                    )}

                    <button
                        onClick={() => void saveIntegrationSettings()}
                        disabled={savingIntegrations || integrationValidationIssues.length > 0}
                        className="px-4 py-2 rounded-lg bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 hover:bg-indigo-500/30 text-sm font-medium disabled:opacity-60 inline-flex items-center gap-2"
                    >
                        {savingIntegrations && <Loader2 className="h-4 w-4 animate-spin" />}
                        Save Integration Settings
                    </button>
                    <div className="text-[11px] text-zinc-500">
                        {integrationsSavedAt ? `Last integration save: ${new Date(integrationsSavedAt).toLocaleString()}` : "No integration save recorded yet."}
                        {integrationsSaveMessage ? ` • ${integrationsSaveMessage}` : ""}
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-white/5">
                    <h4 className="font-bold text-white text-sm">Voice Transcription (Whisper)</h4>
                    <p className="text-xs text-zinc-500 mt-1">
                        Voice transcription uses local Whisper in-browser. It automatically reuses the OpenAI key above as optional server fallback.
                    </p>
                </div>

                <div className="mt-4 pt-4 border-t border-white/5">
                    <p className="text-zinc-500 text-xs">Security note: credentials are stored locally (and in Supabase only if Cloud Sync full mode is enabled).</p>
                </div>
            </CardContent>
        </Card>
    );
}
