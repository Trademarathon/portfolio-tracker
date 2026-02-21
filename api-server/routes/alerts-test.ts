import type { Request, Response } from "express";

interface TestPayload {
  type: "discord" | "telegram";
  webhookUrl?: string;
  botToken?: string;
  chatId?: string;
}

async function testDiscordWebhook(webhookUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    const embed = {
      title: "✅ Connection Test Successful",
      description: "Your Discord webhook is configured correctly!",
      color: 0x10b981,
      timestamp: new Date().toISOString(),
      footer: { text: "Trade Marathon® Alert System" },
      fields: [
        { name: "Status", value: "Ready to receive alerts", inline: true },
        { name: "Test Time", value: new Date().toLocaleString(), inline: true },
      ],
    };
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "🔔 **Trade Marathon® Alert Test**", embeds: [embed] }),
    });
    if (!response.ok) {
      const text = await response.text();
      if (response.status === 401 || response.status === 404) {
        return { success: false, error: "Invalid webhook URL. Please check and try again." };
      }
      return { success: false, error: `Discord error: ${response.status} - ${text}` };
    }
    return { success: true };
  } catch (error: any) {
    if (error.message?.includes("fetch")) {
      return { success: false, error: "Could not reach Discord. Check your internet connection." };
    }
    return { success: false, error: error.message || "Failed to test Discord webhook" };
  }
}

async function testTelegramBot(botToken: string, chatId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const meUrl = `https://api.telegram.org/bot${botToken}/getMe`;
    const meResponse = await fetch(meUrl);
    const meData = await meResponse.json();
    if (!meData.ok) return { success: false, error: "Invalid bot token. Please check and try again." };
    const botName = meData.result.username;
    const sendUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const message = [
      "✅ *Connection Test Successful*",
      "",
      `Your Telegram bot (@${botName}) is configured correctly!`,
      "",
      "📊 *Status:* Ready to receive alerts",
      `🕐 *Test Time:* ${new Date().toLocaleString()}`,
      "",
      "_Trade Marathon® Alert System_",
    ].join("\n");
    const response = await fetch(sendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "Markdown" }),
    });
    const data = await response.json();
    if (!data.ok) {
      if (data.description?.includes("chat not found")) {
        return { success: false, error: "Chat not found. Make sure you've started a conversation with the bot first." };
      }
      if (data.description?.includes("bot was blocked")) {
        return { success: false, error: "Bot was blocked by the user. Please unblock the bot first." };
      }
      return { success: false, error: `Telegram error: ${data.description}` };
    }
    return { success: true };
  } catch (error: any) {
    if (error.message?.includes("fetch")) {
      return { success: false, error: "Could not reach Telegram. Check your internet connection." };
    }
    return { success: false, error: error.message || "Failed to test Telegram bot" };
  }
}

export async function testHandler(req: Request, res: Response) {
  try {
    const payload: TestPayload = req.body;
    if (!payload.type) return res.status(400).json({ error: "Type required (discord or telegram)" });
    let result: { success: boolean; error?: string };
    switch (payload.type) {
      case "discord":
        if (!payload.webhookUrl) return res.status(400).json({ error: "Webhook URL required" });
        result = await testDiscordWebhook(payload.webhookUrl);
        break;
      case "telegram":
        if (!payload.botToken || !payload.chatId) {
          return res.status(400).json({ error: "Bot token and chat ID required" });
        }
        result = await testTelegramBot(payload.botToken, payload.chatId);
        break;
      default:
        return res.status(400).json({ error: "Invalid type" });
    }
    if (!result.success) return res.status(200).json({ success: false, error: result.error });
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Alert Test API]", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
}
