import type { Request, Response as ExpressResponse } from "express";

type IntegrationType = "discord" | "telegram";

interface HealthRequestBody {
  type?: IntegrationType;
  webhookUrl?: string;
  botToken?: string;
  chatId?: string;
}

interface HealthResponseBody {
  ok: boolean;
  integration: IntegrationType;
  healthy: boolean;
  statusCode?: number;
  latencyMs: number;
  error?: string;
  detail?: string;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function respond(res: ExpressResponse, payload: HealthResponseBody) {
  return res.json(payload);
}

async function checkDiscordWebhook(webhookUrl: string): Promise<Omit<HealthResponseBody, "ok" | "integration">> {
  const url = webhookUrl.trim();
  if (!url) {
    return {
      healthy: false,
      latencyMs: 0,
      error: "Discord webhook URL is missing.",
    };
  }

  const started = Date.now();
  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      },
      6000
    );
    const latencyMs = Date.now() - started;

    if (!response.ok) {
      return {
        healthy: false,
        statusCode: response.status,
        latencyMs,
        error: `Discord webhook check failed (${response.status}).`,
      };
    }

    return {
      healthy: true,
      statusCode: response.status,
      latencyMs,
      detail: "Webhook reachable.",
    };
  } catch (error) {
    return {
      healthy: false,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : "Discord webhook check failed.",
    };
  }
}

async function checkTelegram(botToken: string, chatId?: string): Promise<Omit<HealthResponseBody, "ok" | "integration">> {
  const token = botToken.trim();
  const chat = (chatId || "").trim();

  if (!token) {
    return {
      healthy: false,
      latencyMs: 0,
      error: "Telegram bot token is missing.",
    };
  }

  const started = Date.now();
  try {
    const meUrl = `https://api.telegram.org/bot${encodeURIComponent(token)}/getMe`;
    const meResponse = await fetchWithTimeout(meUrl, { method: "GET" }, 6000);
    const meJson = await meResponse.json().catch(() => ({} as { ok?: boolean; description?: string }));

    if (!meResponse.ok || (meJson as { ok?: boolean }).ok !== true) {
      return {
        healthy: false,
        statusCode: meResponse.status,
        latencyMs: Date.now() - started,
        error:
          (meJson as { description?: string }).description ||
          `Telegram token check failed (${meResponse.status}).`,
      };
    }

    if (!chat) {
      return {
        healthy: true,
        statusCode: meResponse.status,
        latencyMs: Date.now() - started,
        detail: "Bot token valid. Add Chat ID for full routing checks.",
      };
    }

    const chatUrl = `https://api.telegram.org/bot${encodeURIComponent(token)}/getChat?chat_id=${encodeURIComponent(chat)}`;
    const chatResponse = await fetchWithTimeout(chatUrl, { method: "GET" }, 6000);
    const chatJson = await chatResponse.json().catch(() => ({} as { ok?: boolean; description?: string }));

    if (!chatResponse.ok || (chatJson as { ok?: boolean }).ok !== true) {
      return {
        healthy: false,
        statusCode: chatResponse.status,
        latencyMs: Date.now() - started,
        error:
          (chatJson as { description?: string }).description ||
          `Telegram chat check failed (${chatResponse.status}).`,
      };
    }

    return {
      healthy: true,
      statusCode: chatResponse.status,
      latencyMs: Date.now() - started,
      detail: "Bot token and Chat ID validated.",
    };
  } catch (error) {
    return {
      healthy: false,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : "Telegram health check failed.",
    };
  }
}

export async function integrationsHealthHandler(req: Request, res: ExpressResponse) {
  try {
    const body = (req.body || {}) as HealthRequestBody;
    const type = body.type;

    if (type !== "discord" && type !== "telegram") {
      return res.status(400).json({ ok: false, error: "type must be discord or telegram" });
    }

    if (type === "discord") {
      const result = await checkDiscordWebhook(body.webhookUrl || "");
      return respond(res, { ok: true, integration: "discord", ...result });
    }

    const result = await checkTelegram(body.botToken || "", body.chatId || "");
    return respond(res, { ok: true, integration: "telegram", ...result });
  } catch (error) {
    console.error("[integrations/health]", error);
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Integration health check failed",
    });
  }
}
