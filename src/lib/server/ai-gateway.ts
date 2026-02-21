type AIProvider = "auto" | "openai" | "gemini" | "ollama";
type ConcreteProvider = Exclude<AIProvider, "auto">;
type MessageRole = "system" | "user" | "assistant";

export interface AIMessage {
  role: MessageRole;
  content: string;
}

export interface AIChatInput {
  provider?: AIProvider;
  model?: string;
  messages?: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  feature?: string;
}

export interface AIProviderCredentials {
  openaiKey: string | null;
  geminiKey: string | null;
  ollamaBaseUrl: string;
  ollamaModel: string;
}

export interface ProviderAvailability {
  id: ConcreteProvider;
  available: boolean;
  defaultModel: string;
}

interface ProviderResponse {
  provider: ConcreteProvider;
  model: string;
  content: string;
  usage?: unknown;
}

interface ProviderFailure {
  provider: ConcreteProvider;
  message: string;
  status?: number;
}

interface ChatSuccess {
  ok: true;
  provider: ConcreteProvider;
  model: string;
  content: string;
  usage?: unknown;
  attemptedProviders: ConcreteProvider[];
  fallbackUsed: boolean;
}

interface ChatFailure {
  ok: false;
  error: string;
  attemptedProviders: ConcreteProvider[];
  details: ProviderFailure[];
  status: number;
}

const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-1.5-flash";
const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL?.trim() || "llama3.1:8b";
const DEFAULT_OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL?.trim().replace(/\/+$/, "") || "http://127.0.0.1:11434";
const OLLAMA_MODELS_CACHE_TTL_MS = 60_000;

const ollamaModelsCache = new Map<
  string,
  { ts: number; models: string[] }
>();

class ProviderError extends Error {
  provider: ConcreteProvider;
  status?: number;

  constructor(provider: ConcreteProvider, message: string, status?: number) {
    super(message);
    this.provider = provider;
    this.status = status;
  }
}

function normalizeHeaderValue(
  value: string | null | undefined | string[]
): string | null {
  if (Array.isArray(value)) return value.length ? normalizeHeaderValue(value[0]) : null;
  const normalized = (value || "").trim();
  return normalized ? normalized : null;
}

export function resolveAICredentialsFromHeaders(
  getHeader: (name: string) => string | null | undefined | string[]
): AIProviderCredentials {
  const openaiFromHeader = normalizeHeaderValue(getHeader("x-openai-api-key"));
  const geminiFromHeader =
    normalizeHeaderValue(getHeader("x-gemini-api-key")) ||
    normalizeHeaderValue(getHeader("x-google-api-key"));
  const ollamaBaseFromHeader = normalizeHeaderValue(getHeader("x-ollama-base-url"));
  const ollamaModelFromHeader = normalizeHeaderValue(getHeader("x-ollama-model"));

  const openaiFromEnv = normalizeHeaderValue(process.env.OPENAI_API_KEY || "");
  const geminiFromEnv = normalizeHeaderValue(
    process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ""
  );
  const ollamaBaseFromEnv = normalizeHeaderValue(process.env.OLLAMA_BASE_URL || "");
  const ollamaModelFromEnv = normalizeHeaderValue(process.env.OLLAMA_MODEL || "");

  return {
    openaiKey: openaiFromHeader || openaiFromEnv || null,
    geminiKey: geminiFromHeader || geminiFromEnv || null,
    ollamaBaseUrl:
      (ollamaBaseFromHeader || ollamaBaseFromEnv || DEFAULT_OLLAMA_BASE_URL).replace(
        /\/+$/,
        ""
      ),
    ollamaModel: ollamaModelFromHeader || ollamaModelFromEnv || DEFAULT_OLLAMA_MODEL,
  };
}

export function normalizeProvider(value: unknown): AIProvider {
  if (value === "ollama") return "ollama";
  return "ollama";
}

export function buildProviderOrder(
  _provider: AIProvider,
  _featureHint?: string
): ConcreteProvider[] {
  return ["ollama"];
}

export function sanitizeMessages(raw: unknown): AIMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: AIMessage[] = [];
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

export function sanitizeTemperature(raw: unknown): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 0.35;
  return Math.min(2, Math.max(0, parsed));
}

export function sanitizeMaxTokens(raw: unknown): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 900;
  return Math.min(4000, Math.max(128, Math.round(parsed)));
}

export function defaultModelForProvider(
  provider: ConcreteProvider,
  creds?: AIProviderCredentials
): string {
  if (provider === "openai") return DEFAULT_OPENAI_MODEL;
  if (provider === "gemini") return DEFAULT_GEMINI_MODEL;
  if (provider === "ollama") return creds?.ollamaModel || DEFAULT_OLLAMA_MODEL;
  return DEFAULT_OPENAI_MODEL;
}

function normalizeModelName(name: string): string {
  return name.trim().toLowerCase();
}

function isEmbeddingModel(name: string): boolean {
  const n = normalizeModelName(name);
  return n.includes("embed");
}

function isCloudModel(name: string): boolean {
  const n = normalizeModelName(name);
  return n.endsWith(":cloud") || n.includes("-cloud");
}

function pickBestOllamaModel(preferred: string, models: string[]): string | null {
  if (!models.length) return null;
  const preferredNorm = normalizeModelName(preferred);
  const exact = models.find((m) => normalizeModelName(m) === preferredNorm);
  if (exact) return exact;

  const preferredBase = preferredNorm.split(":")[0];
  const close = models.find((m) => normalizeModelName(m).startsWith(`${preferredBase}:`));
  if (close) return close;

  const localText = models.find((m) => !isEmbeddingModel(m) && !isCloudModel(m));
  if (localText) return localText;

  const nonEmbedding = models.find((m) => !isEmbeddingModel(m));
  if (nonEmbedding) return nonEmbedding;

  return models[0] || null;
}

async function fetchOllamaModelNames(
  baseUrl: string,
  timeoutMs = 2000
): Promise<string[]> {
  const cached = ollamaModelsCache.get(baseUrl);
  if (cached && Date.now() - cached.ts < OLLAMA_MODELS_CACHE_TTL_MS) {
    return cached.models;
  }

  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${baseUrl}/api/tags`, {
      method: "GET",
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const json = (await res.json().catch(() => ({}))) as {
      models?: Array<{ name?: string }>;
    };
    const models = Array.isArray(json.models)
      ? json.models
          .map((m) => (typeof m?.name === "string" ? m.name.trim() : ""))
          .filter(Boolean)
      : [];
    ollamaModelsCache.set(baseUrl, { ts: Date.now(), models });
    return models;
  } catch {
    return [];
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function resolveOllamaModel(
  creds: AIProviderCredentials,
  timeoutMs = 2000
): Promise<{ available: boolean; model: string; discovered: string[] }> {
  const discovered = await fetchOllamaModelNames(creds.ollamaBaseUrl, timeoutMs);
  const fallback = creds.ollamaModel || DEFAULT_OLLAMA_MODEL;
  const selected = pickBestOllamaModel(fallback, discovered) || fallback;
  return {
    available: discovered.length > 0,
    model: selected,
    discovered,
  };
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
  apiKey: string,
  messages: AIMessage[],
  temperature: number,
  maxTokens: number,
  modelOverride?: string,
  jsonMode?: boolean
): Promise<ProviderResponse> {
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
  apiKey: string,
  messages: AIMessage[],
  temperature: number,
  maxTokens: number,
  modelOverride?: string,
  jsonMode?: boolean
): Promise<ProviderResponse> {
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
  creds: AIProviderCredentials,
  messages: AIMessage[],
  temperature: number,
  maxTokens: number,
  modelOverride?: string,
  jsonMode?: boolean
): Promise<ProviderResponse> {
  const model = modelOverride?.trim() || creds.ollamaModel || DEFAULT_OLLAMA_MODEL;
  const endpoint = `${creds.ollamaBaseUrl}/api/chat`;

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

export async function executeAIChat(
  input: AIChatInput,
  creds: AIProviderCredentials
): Promise<ChatSuccess | ChatFailure> {
  const provider = normalizeProvider(input.provider);
  const messages = sanitizeMessages(input.messages);
  if (messages.length === 0) {
    return {
      ok: false,
      status: 400,
      error: "messages is required and must include at least one message.",
      attemptedProviders: [],
      details: [],
    };
  }

  const temperature = sanitizeTemperature(input.temperature);
  const maxTokens = sanitizeMaxTokens(input.maxTokens);
  const jsonMode = !!input.jsonMode;
  const providerOrder = buildProviderOrder(provider, input.feature);
  const errors: ProviderFailure[] = [];
  let resolvedOllamaModel: string | null = null;

  for (const current of providerOrder) {
    try {
      const output =
        current === "openai"
          ? creds.openaiKey
            ? await callOpenAI(
                creds.openaiKey,
                messages,
                temperature,
                maxTokens,
                input.model,
                jsonMode
              )
            : (() => {
                throw new ProviderError("openai", "OpenAI API key is not configured.");
              })()
          : current === "gemini"
            ? creds.geminiKey
              ? await callGemini(
                  creds.geminiKey,
                  messages,
                  temperature,
                  maxTokens,
                  input.model,
                  jsonMode
                )
              : (() => {
                  throw new ProviderError("gemini", "Gemini API key is not configured.");
                })()
            : await (async () => {
                if (!resolvedOllamaModel) {
                  const resolved = await resolveOllamaModel(creds);
                  resolvedOllamaModel = resolved.model;
                  if (!resolved.available) {
                    throw new ProviderError(
                      "ollama",
                      "Ollama is reachable but no models are installed."
                    );
                  }
                }
                return callOllama(
                  creds,
                  messages,
                  temperature,
                  maxTokens,
                  input.model || resolvedOllamaModel || undefined,
                  jsonMode
                );
              })();

      return {
        ok: true,
        provider: output.provider,
        model: output.model,
        content: output.content,
        usage: output.usage,
        attemptedProviders: providerOrder.slice(0, errors.length + 1),
        fallbackUsed: provider === "auto" && output.provider !== providerOrder[0],
      };
    } catch (error) {
      const normalized =
        error instanceof ProviderError
          ? error
          : new ProviderError(
              current,
              error instanceof Error ? error.message : "Provider request failed"
            );
      errors.push({
        provider: normalized.provider,
        message: normalized.message,
        status: normalized.status,
      });
    }
  }

  return {
    ok: false,
    status: 503,
    error: "No AI provider is currently available.",
    attemptedProviders: providerOrder,
    details: errors,
  };
}

export async function checkProviderAvailability(
  creds: AIProviderCredentials,
  timeoutMs = 2000
): Promise<ProviderAvailability[]> {
  const ollama = await resolveOllamaModel(creds, timeoutMs);

  return [
    {
      id: "ollama",
      available: ollama.available,
      defaultModel: ollama.model,
    },
  ];
}
