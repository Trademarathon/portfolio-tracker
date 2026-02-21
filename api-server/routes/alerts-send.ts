import type { Request, Response } from "express";

interface AlertPayload {
  type: "discord" | "telegram";
  message: string;
  title?: string;
  priority?: "low" | "medium" | "high" | "critical";
  symbol?: string;
  value?: number;
  webhookUrl?: string;
  mentionRole?: string;
  botToken?: string;
  chatId?: string;
  silent?: boolean;
}

const PRIORITY_COLORS: Record<string, number> = {
  low: 0x71717a,
  medium: 0x3b82f6,
  high: 0xf59e0b,
  critical: 0xef4444,
};

function buildDiscordEmbed(payload: AlertPayload) {
  const priority = payload.priority || "medium";
  const color = PRIORITY_COLORS[priority];
  const embed: any = {
    title: payload.title || "🔔 Portfolio Alert",
    description: payload.message,
    color,
    timestamp: new Date().toISOString(),
    footer: { text: "Trade Marathon® Alert System" },
    fields: [],
  };
  if (payload.symbol) embed.fields.push({ name: "Symbol", value: payload.symbol, inline: true });
  if (payload.value !== undefined)
    embed.fields.push({
      name: "Value",
      value: typeof payload.value === "number" ? `$${payload.value.toLocaleString()}` : String(payload.value),
      inline: true,
    });
  embed.fields.push({ name: "Priority", value: priority.toUpperCase(), inline: true });
  return embed;
}

export async function sendDiscordWebhook(payload: AlertPayload): Promise<{ success: boolean; error?: string }> {
  if (!payload.webhookUrl) return { success: false, error: "Discord webhook URL not provided" };
  try {
    const embed = buildDiscordEmbed(payload);
    const body: any = { embeds: [embed] };
    if (payload.priority === "critical" && payload.mentionRole) {
      body.content = `<@&${payload.mentionRole}> 🚨 **CRITICAL ALERT**`;
    }
    const response = await fetch(payload.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `Discord API error: ${response.status} - ${text}` };
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to send Discord webhook" };
  }
}

export async function sendTelegramMessage(payload: AlertPayload): Promise<{ success: boolean; error?: string }> {
  if (!payload.botToken || !payload.chatId) {
    return { success: false, error: "Telegram bot token or chat ID not provided" };
  }
  try {
    const priorityEmoji: Record<string, string> = { low: "ℹ️", medium: "🔔", high: "⚠️", critical: "🚨" };
    const priority = payload.priority || "medium";
    let text = `${priorityEmoji[priority]} *${payload.title || "Portfolio Alert"}*\n\n${payload.message}`;
    if (payload.symbol) text += `\n\n📊 *Symbol:* \`${payload.symbol}\``;
    if (payload.value !== undefined) text += `\n💰 *Value:* $${payload.value.toLocaleString()}`;
    text += `\n\n_Priority: ${priority.toUpperCase}_`;
    const url = `https://api.telegram.org/bot${payload.botToken}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: payload.chatId,
        text,
        parse_mode: "Markdown",
        disable_notification: payload.silent || false,
      }),
    });
    const data = await response.json();
    if (!data.ok) return { success: false, error: `Telegram API error: ${data.description}` };
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to send Telegram message" };
  }
}

export async function sendHandler(req: Request, res: Response) {
  try {
    const payload: AlertPayload = req.body;
    if (!payload.type) return res.status(400).json({ error: "Alert type required" });
    if (!payload.message) return res.status(400).json({ error: "Message required" });
    let result: { success: boolean; error?: string };
    switch (payload.type) {
      case "discord":
        result = await sendDiscordWebhook(payload);
        break;
      case "telegram":
        result = await sendTelegramMessage(payload);
        break;
      default:
        return res.status(400).json({ error: "Invalid alert type" });
    }
    if (!result.success) return res.status(500).json({ error: result.error });
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Alert Send API]", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
}
