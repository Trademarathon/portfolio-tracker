import type { Request, Response } from "express";

type AIProvider = "auto" | "openai" | "gemini" | "ollama";
type ConcreteProvider = Exclude<AIProvider, "auto">;
type MessageRole = "system" | "user" | "assistant";

interface ChatMessage {
  role: MessageRole;
  content: string;
}

interface ChatRequestBody {
  provider?: AIProvider;
  model?: string;
  messages?: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

interface ProviderResponse {
  provider: ConcreteProvider;
  model: string;
  content: string;
  usage?: unknown;
}

class ProviderError extends Error {
  provider: ConcreteProvider;
  status?: number;

  constructor(provider: ConcreteProvider, message: string, status?: number) {
    super(message);
    this.provider = provider;
    this.status = status;
  }
}

const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-1.5-flash";
const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL?.trim() || "llama3.1:8b";
const DEFAULT_OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL?.trim().replace(/\/+$/, "") || "http://127.0.0.1:11434";

function getOpenAIKey(req: Request): string | null {
  const headerKey = req.headers["x-openai-api-key"] as string | undefined;
  if (headerKey?.trim()) return headerKey.trim();
  const envKey = process.env.OPENAI_API_KEY;
  if (envKey?.trim()) return envKey.trim();
  return null;
}

function getGeminiKey(req: Request): string | null {
  const geminiHeaderKey = req.headers["x-gemini-api-key"] as string | undefined;
  if (geminiHeaderKey?.trim()) return geminiHeaderKey.trim();
  const googleHeaderKey = req.headers["x-google-api-key"] as string | undefined;
  if (googleHeaderKey?.trim()) return googleHeaderKey.trim();
  const envKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (envKey?.trim()) return envKey.trim();
  return null;
}

function getOllamaBaseUrl(req: Request): string {
  const headerBase = req.headers["x-ollama-base-url"] as string | undefined;
  if (headerBase?.trim()) return headerBase.trim().replace(/\/+$/, "");
  return DEFAULT_OLLAMA_BASE_URL;
}

function getOllamaModel(req: Request): string {
  const headerModel = req.headers["x-ollama-model"] as string | undefined;
  if (headerModel?.trim()) return headerModel.trim();
  return DEFAULT_OLLAMA_MODEL;
}

function normalizeProvider(value: unknown): AIProvider {
  if (value === "openai" || value === "gemini" || value === "ollama" || value === "auto") return value;
  return "auto";
}

function sanitizeMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatMessage[] = [];
  for (const msg of raw) {
    if (!msg || typeof msg !== "object") continue;
    const role = (msg as { role?: unknown }).role;
    const content = (msg as { content?: unknown }).content;
    if (role !== "system" && role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") continue;
    const trimmed = content.trim();
    if (!trimmed) continue;
    out.push({ role, content: trimmed });
  }
  return out;
}

function sanitizeTemperature(raw: unknown): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 0.35;
  return Math.min(2, Math.max(0, parsed));
}

function sanitizeMaxTokens(raw: unknown): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 900;
  return Math.min(4000, Math.max(128, Math.round(parsed)));
}

function extractOpenAIText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    const parts = content
      .map((part) => {
        if (!part || typeof part !== "object") return "";
        const maybeText = (part as { text?: unknown }).text;
        return typeof maybeText === "string" ? maybeText : "";
      })
      .filter(Boolean);
    return parts.join("\n").trim();
  }
  return "";
}

async function callOpenAI(
  req: Request,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
  modelOverride?: string,
  jsonMode?: boolean
): Promise<ProviderResponse> {
  const apiKey = getOpenAIKey(req);
  if (!apiKey) {
    throw new ProviderError("openai", "OpenAI API key is not configured.");
  }

  const model = modelOverride?.trim() || DEFAULT_OPENAI_MODEL;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      response_format: jsonMode ? { type: "json_object" } : undefined,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (payload as { error?: { message?: string } })?.error?.message ||
      `OpenAI request failed (${response.status})`;
    throw new ProviderError("openai", message, response.status);
  }

  const choice = (payload as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0];
  const content = extractOpenAIText(choice?.message?.content);
  if (!content) {
    throw new ProviderError("openai", "OpenAI returned an empty response.");
  }

  return {
    provider: "openai",
    model: (payload as { model?: string }).model || model,
    content,
    usage: (payload as { usage?: unknown }).usage,
  };
}

function toGeminiRole(role: MessageRole): "user" | "model" {
  return role === "assistant" ? "model" : "user";
}

async function callGemini(
  req: Request,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
  modelOverride?: string,
  jsonMode?: boolean
): Promise<ProviderResponse> {
  const apiKey = getGeminiKey(req);
  if (!apiKey) {
    throw new ProviderError("gemini", "Gemini API key is not configured.");
  }

  const model = modelOverride?.trim() || DEFAULT_GEMINI_MODEL;
  const systemMessages = messages.filter((m) => m.role === "system").map((m) => m.content);
  const dialogMessages = messages.filter((m) => m.role !== "system");
  const contents =
    dialogMessages.length > 0
      ? dialogMessages.map((m) => ({
          role: toGeminiRole(m.role),
          parts: [{ text: m.content }],
        }))
      : [{ role: "user" as const, parts: [{ text: systemMessages.join("\n") || "Hello" }] }];

  const body = {
    systemInstruction:
      systemMessages.length > 0
        ? {
            parts: [{ text: systemMessages.join("\n\n") }],
          }
        : undefined,
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      responseMimeType: jsonMode ? "application/json" : "text/plain",
    },
  };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (payload as { error?: { message?: string } })?.error?.message ||
      `Gemini request failed (${response.status})`;
    throw new ProviderError("gemini", message, response.status);
  }

  const candidate = (payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
    ?.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  const content = parts
    .map((p) => (typeof p?.text === "string" ? p.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();

  if (!content) {
    throw new ProviderError("gemini", "Gemini returned an empty response.");
  }

  return {
    provider: "gemini",
    model: (payload as { modelVersion?: string }).modelVersion || model,
    content,
    usage: (payload as { usageMetadata?: unknown }).usageMetadata,
  };
}

async function callOllama(
  req: Request,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
  modelOverride?: string,
  jsonMode?: boolean
): Promise<ProviderResponse> {
  const baseUrl = getOllamaBaseUrl(req);
  const model = modelOverride?.trim() || getOllamaModel(req);
  const endpoint = `${baseUrl}/api/chat`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      format: jsonMode ? "json" : undefined,
      options: {
        temperature,
        num_predict: maxTokens,
      },
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (payload as { error?: string })?.error || `Ollama request failed (${response.status})`;
    throw new ProviderError("ollama", message, response.status);
  }

  const content =
    (payload as { message?: { content?: string } })?.message?.content?.trim() || "";

  if (!content) {
    throw new ProviderError("ollama", "Ollama returned an empty response.");
  }

  return {
    provider: "ollama",
    model: (payload as { model?: string }).model || model,
    content,
    usage: {
      promptEvalCount: (payload as { prompt_eval_count?: number }).prompt_eval_count,
      evalCount: (payload as { eval_count?: number }).eval_count,
      totalDuration: (payload as { total_duration?: number }).total_duration,
    },
  };
}

function buildProviderOrder(provider: AIProvider): ConcreteProvider[] {
  if (provider === "openai") return ["openai"];
  if (provider === "gemini") return ["gemini"];
  if (provider === "ollama") return ["ollama"];
  return ["openai", "gemini", "ollama"];
}

export async function chatHandler(req: Request, res: Response) {
  try {
    const body = (req.body || {}) as ChatRequestBody;
    const provider = normalizeProvider(body.provider);
    const messages = sanitizeMessages(body.messages);
    if (messages.length === 0) {
      return res.status(400).json({ error: "messages is required and must include at least one message." });
    }

    const temperature = sanitizeTemperature(body.temperature);
    const maxTokens = sanitizeMaxTokens(body.maxTokens);
    const jsonMode = !!body.jsonMode;
    const providerOrder = buildProviderOrder(provider);

    const errors: Array<{ provider: ConcreteProvider; message: string; status?: number }> = [];
    for (const current of providerOrder) {
      try {
        const output =
          current === "openai"
            ? await callOpenAI(req, messages, temperature, maxTokens, body.model, jsonMode)
            : current === "gemini"
              ? await callGemini(req, messages, temperature, maxTokens, body.model, jsonMode)
              : await callOllama(req, messages, temperature, maxTokens, body.model, jsonMode);

        return res.json({
          ok: true,
          provider: output.provider,
          model: output.model,
          content: output.content,
          usage: output.usage,
          attemptedProviders: providerOrder.slice(0, errors.length + 1),
          fallbackUsed: provider === "auto" && output.provider !== providerOrder[0],
        });
      } catch (error) {
        const normalized =
          error instanceof ProviderError
            ? error
            : new ProviderError(current, error instanceof Error ? error.message : "Provider request failed");
        errors.push({ provider: normalized.provider, message: normalized.message, status: normalized.status });
      }
    }

    return res.status(503).json({
      ok: false,
      error: "No AI provider is currently available.",
      attemptedProviders: providerOrder,
      details: errors,
    });
  } catch (error) {
    console.error("[ai/chat]", error);
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "AI request failed",
    });
  }
}

export async function providersHandler(req: Request, res: Response) {
  const openaiAvailable = !!getOpenAIKey(req);
  const geminiAvailable = !!getGeminiKey(req);
  let ollamaAvailable = false;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), 2000);
    const check = await fetch(`${getOllamaBaseUrl(req)}/api/tags`, {
      method: "GET",
      signal: controller.signal,
    });
    ollamaAvailable = check.ok;
  } catch {
    ollamaAvailable = false;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
  res.json({
    ok: true,
    providers: [
      { id: "openai", available: openaiAvailable, defaultModel: DEFAULT_OPENAI_MODEL },
      { id: "gemini", available: geminiAvailable, defaultModel: DEFAULT_GEMINI_MODEL },
      { id: "ollama", available: ollamaAvailable, defaultModel: DEFAULT_OLLAMA_MODEL },
    ],
  });
}
