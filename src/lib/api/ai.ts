"use client";

import { apiFetch, getApiCandidates } from "@/lib/api/client";
import { recordAIUsage } from "@/lib/api/ai-usage";
import {
  AI_RUNTIME_DISABLED_MESSAGE,
  isAIRuntimeEnabled,
} from "@/lib/ai-runtime";

export type AIProvider = "auto" | "openai" | "gemini" | "ollama";
export type AIMessageRole = "system" | "user" | "assistant";

export interface AIMessage {
  role: AIMessageRole;
  content: string;
}

export interface AIChatRequest {
  provider?: AIProvider;
  model?: string;
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  feature?: string;
}

export interface AIChatResponse {
  ok: boolean;
  provider: Exclude<AIProvider, "auto">;
  model: string;
  content: string;
  usage?: unknown;
  attemptedProviders?: string[];
  fallbackUsed?: boolean;
}

export const AI_PROVIDER_KEY = "ai_provider";
export const OPENAI_API_KEY_STORAGE = "openai_api_key";
export const GEMINI_API_KEY_STORAGE = "gemini_api_key";
export const OLLAMA_BASE_URL_STORAGE = "ollama_base_url";
export const OLLAMA_MODEL_STORAGE = "ollama_model";
export const DEFAULT_AI_PROVIDER: AIProvider = "ollama";
export const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
export const DEFAULT_OLLAMA_MODEL = "llama3.1:8b";

function normalizeStoredSetting(value: string | null | undefined, fallback: string): string {
  const raw = (value || "").trim();
  if (!raw) return fallback;
  if (raw.startsWith("{") && raw.endsWith("}")) {
    try {
      const parsed = JSON.parse(raw) as { _raw?: unknown; value?: unknown };
      if (typeof parsed._raw === "string" && parsed._raw.trim()) return parsed._raw.trim();
      if (typeof parsed.value === "string" && parsed.value.trim()) return parsed.value.trim();
    } catch {
      // ignore malformed JSON-like values
    }
  }
  return raw;
}

export function getAIProvider(): AIProvider {
  return DEFAULT_AI_PROVIDER;
}

export function setAIProvider(_provider: AIProvider): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(OPENAI_API_KEY_STORAGE);
  localStorage.removeItem(GEMINI_API_KEY_STORAGE);
  localStorage.setItem(AI_PROVIDER_KEY, DEFAULT_AI_PROVIDER);
  window.dispatchEvent(new Event("ai-provider-changed"));
}

export function getOpenAIKey(): string {
  return "";
}

export function getGeminiKey(): string {
  return "";
}

export function getOllamaBaseUrl(): string {
  if (typeof window === "undefined") return DEFAULT_OLLAMA_BASE_URL;
  return normalizeStoredSetting(localStorage.getItem(OLLAMA_BASE_URL_STORAGE), DEFAULT_OLLAMA_BASE_URL);
}

export function getOllamaModel(): string {
  if (typeof window === "undefined") return DEFAULT_OLLAMA_MODEL;
  return normalizeStoredSetting(localStorage.getItem(OLLAMA_MODEL_STORAGE), DEFAULT_OLLAMA_MODEL);
}

export function buildAIHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const ollamaBaseUrl = getOllamaBaseUrl();
  const ollamaModel = getOllamaModel();
  if (ollamaBaseUrl) headers["x-ollama-base-url"] = ollamaBaseUrl;
  if (ollamaModel) headers["x-ollama-model"] = ollamaModel;
  return headers;
}

export async function chatWithAI(payload: AIChatRequest): Promise<AIChatResponse> {
  if (!isAIRuntimeEnabled()) {
    return {
      ok: true,
      provider: "ollama",
      model: "runtime-disabled",
      content: AI_RUNTIME_DISABLED_MESSAGE,
      attemptedProviders: ["ollama"],
      fallbackUsed: true,
    };
  }

  const body: AIChatRequest = {
    ...payload,
    provider: "ollama",
  };

  const res = await apiFetch(
    "/api/ai/chat",
    {
      method: "POST",
      headers: buildAIHeaders(),
      body: JSON.stringify(body),
    },
    45_000
  );

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (json as { error?: string }).error ||
      (json as { details?: Array<{ message?: string }> }).details?.[0]?.message ||
      "AI request failed";
    throw new Error(message);
  }

  const result = json as AIChatResponse;
  try {
    recordAIUsage({
      provider: result.provider,
      model: result.model,
      feature: payload.feature || "chat",
      usage: result.usage,
    });
  } catch {
    // ignore
  }
  return result;
}

type StreamOptions = {
  onDelta: (delta: string) => void;
  signal?: AbortSignal;
};

export async function streamWithAI(payload: AIChatRequest, options: StreamOptions): Promise<AIChatResponse> {
  if (!isAIRuntimeEnabled()) {
    options.onDelta(AI_RUNTIME_DISABLED_MESSAGE);
    return {
      ok: true,
      provider: "ollama",
      model: "runtime-disabled",
      content: AI_RUNTIME_DISABLED_MESSAGE,
      attemptedProviders: ["ollama"],
      fallbackUsed: true,
    };
  }

  const body: AIChatRequest = {
    ...payload,
    provider: "ollama",
  };

  const candidates = getApiCandidates("/api/ai/stream");
  let res: Response | null = null;
  let lastError = "AI stream failed";
  for (const url of candidates) {
    try {
      const attempt = await fetch(url, {
        method: "POST",
        headers: buildAIHeaders(),
        body: JSON.stringify(body),
        signal: options.signal,
      });
      if (attempt.ok && attempt.body) {
        res = attempt;
        break;
      }
      const maybeJson = await attempt.json().catch(() => null);
      if (maybeJson && typeof maybeJson.error === "string") {
        lastError = maybeJson.error;
      } else {
        const text = await attempt.text().catch(() => "");
        if (text) lastError = text;
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : "AI stream failed";
    }
  }

  if (!res || !res.body) {
    throw new Error(lastError || "AI stream failed");
  }

  const provider = (res.headers.get("x-ai-provider") || "ollama") as AIChatResponse["provider"];
  const model = res.headers.get("x-ai-model") || payload.model || "unknown";

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";

  const flushLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let payload = trimmed;
    if (payload.startsWith("data:")) payload = payload.slice(5).trim();
    if (payload === "[DONE]") return;
    try {
      const json = JSON.parse(payload);
      const delta =
        json?.delta ||
        json?.message?.content ||
        json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") ||
        (json?.type === "response.output_text.delta" ? json?.delta : "") ||
        "";
      if (delta) {
        content += delta;
        options.onDelta(delta);
      }
    } catch {
      // ignore parse failures
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) flushLine(line);
  }

  return {
    ok: true,
    provider,
    model,
    content,
  };
}

export async function getAIProviders(): Promise<{
  ok: boolean;
  providers: Array<{ id: Exclude<AIProvider, "auto">; available: boolean; defaultModel: string }>;
}> {
  const res = await apiFetch(
    "/api/ai/providers",
    {
      method: "GET",
      headers: buildAIHeaders(),
    },
    10_000
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || "Failed to load AI providers");
  return json as {
    ok: boolean;
    providers: Array<{ id: Exclude<AIProvider, "auto">; available: boolean; defaultModel: string }>;
  };
}
