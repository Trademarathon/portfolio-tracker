/**
 * Server-side screener alert checker.
 * Runs periodically when Supabase is configured; evaluates alerts and sends to Discord/Telegram
 * so users get alerts even when the app is closed.
 */

const BINANCE_TICKER_URL = "https://api.binance.com/api/v3/ticker/24hr";
const COOLDOWN_MS = 5 * 60 * 1000; // 5 min per alert

interface ScreenerAlertCondition {
  type: string;
  target: number;
  targetMin?: number;
  targetMax?: number;
  operator?: "gt" | "lt" | "outside";
}

interface ScreenerAlert {
  id: string;
  symbol: string;
  symbols?: string[];
  conditions: ScreenerAlertCondition[];
  logic: "AND" | "OR";
  active: boolean;
  repeat?: boolean;
}

interface AlertSettingsPayload {
  discordEnabled?: boolean;
  discordWebhookUrl?: string;
  telegramEnabled?: boolean;
  telegramBotToken?: string;
  telegramChatId?: string;
  telegramSilent?: boolean;
  discordMentionOnCritical?: boolean;
  discordMentionRole?: string;
}

export interface TickerRow {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  volume: string;
}

export async function fetchBinanceTickers(): Promise<{
  prices: Record<string, number>;
  metrics: Record<string, { price?: number; change24h?: number; volume24h?: number }>;
}> {
  const res = await fetch(BINANCE_TICKER_URL);
  if (!res.ok) throw new Error("Binance ticker failed");
  const rows: TickerRow[] = await res.json();
  const prices: Record<string, number> = {};
  const metrics: Record<string, { price?: number; change24h?: number; volume24h?: number }> = {};
  for (const r of rows) {
    if (!r.symbol?.endsWith("USDT")) continue;
    const base = r.symbol.replace("USDT", "");
    const price = parseFloat(r.lastPrice);
    const change24h = parseFloat(r.priceChangePercent || "0");
    const volume24h = parseFloat(r.volume || "0");
    prices[base] = price;
    metrics[base] = { price, change24h, volume24h };
  }
  return { prices, metrics };
}

function evaluateCondition(
  cond: ScreenerAlertCondition,
  price: number,
  m: { price?: number; change24h?: number; volume24h?: number } | undefined
): boolean {
  const op = cond.operator || "gt";
  const isOutside = (v: number, lo: number, hi: number) => v < lo || v > hi;
  if (cond.type === "price_above") return price >= cond.target;
  if (cond.type === "price_below") return price <= cond.target;
  if (!m) return false;
  if (cond.type === "chg_15m" || cond.type === "chg_5m") {
    const v = m.change24h ?? 0;
    return op === "gt" ? v >= cond.target : op === "lt" ? v <= cond.target : isOutside(v, cond.targetMin ?? -999, cond.targetMax ?? 999);
  }
  if (cond.type === "rvol" && m.volume24h != null) return m.volume24h >= cond.target;
  return false;
}

export function evaluateAlert(
  alert: ScreenerAlert,
  prices: Record<string, number>,
  metrics: Record<string, { price?: number; change24h?: number; volume24h?: number }>
): { triggered: boolean; symbol?: string; message?: string; price?: number } {
  if (!alert.active || !alert.conditions?.length) return { triggered: false };
  const targets =
    alert.symbols?.length
      ? alert.symbols.map((s) => s.replace("USDT", ""))
      : alert.symbol === "GLOBAL"
        ? Object.keys(prices)
        : [alert.symbol];
  for (const sym of targets) {
    const price = prices[sym];
    if (price == null) continue;
    const m = metrics[sym];
    const results = alert.conditions.map((c) => evaluateCondition(c, price, m));
    const triggered =
      alert.logic === "AND" ? results.every(Boolean) : results.some(Boolean);
    if (triggered) {
      const msg =
        alert.symbol === "GLOBAL"
          ? `Global Alert (${sym}) triggered!`
          : `${alert.symbol} triggered!`;
      return { triggered: true, symbol: sym, message: msg, price };
    }
  }
  return { triggered: false };
}

const lastTriggered = new Map<string, number>();

function shouldThrottle(alertId: string): boolean {
  const t = lastTriggered.get(alertId);
  if (!t) return false;
  return Date.now() - t < COOLDOWN_MS;
}

export async function runServerSideAlertCheck(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;

  let supabase: any;
  try {
    const { createClient } = await import("@supabase/supabase-js");
    supabase = createClient(url, serviceKey);
  } catch (_e) {
    return;
  }

  const { prices, metrics } = await fetchBinanceTickers();

  const { data: alertsRows } = await supabase
    .from("user_data")
    .select("user_id, payload")
    .eq("key", "portfolio_alerts");
  if (!alertsRows?.length) return;

  const { sendDiscordWebhook, sendTelegramMessage } = await import("./alerts-send");

  for (const row of alertsRows) {
    const userId = row.user_id;
    const payload = row.payload;
    const alerts: ScreenerAlert[] = Array.isArray(payload) ? payload : [];
    if (!alerts.length) continue;

    const { data: settingsRows } = await supabase
      .from("user_data")
      .select("payload")
      .eq("user_id", userId)
      .eq("key", "portfolio_alert_settings")
      .maybeSingle();
    const settings: AlertSettingsPayload = settingsRows?.payload ?? {};
    if (!settings.discordEnabled && !settings.telegramEnabled) continue;

    for (const alert of alerts) {
      if (shouldThrottle(alert.id)) continue;
      const result = evaluateAlert(alert, prices, metrics);
      if (!result.triggered || !result.message) continue;

      lastTriggered.set(alert.id, Date.now());

      const title = "Screener Alert";
      const priority = "high" as const;
      const shouldMention = settings.discordMentionOnCritical === true;

      if (settings.discordEnabled && settings.discordWebhookUrl) {
        await sendDiscordWebhook({
          type: "discord",
          webhookUrl: settings.discordWebhookUrl,
          title,
          message: result.message,
          priority,
          symbol: result.symbol,
          value: result.price,
          mentionRole: shouldMention ? settings.discordMentionRole : undefined,
        }).catch(() => {});
      }
      if (
        settings.telegramEnabled &&
        settings.telegramBotToken &&
        settings.telegramChatId
      ) {
        await sendTelegramMessage({
          type: "telegram",
          botToken: settings.telegramBotToken,
          chatId: settings.telegramChatId,
          title,
          message: result.message,
          priority,
          symbol: result.symbol,
          value: result.price,
          silent: settings.telegramSilent,
        }).catch(() => {});
      }
    }
  }
}
