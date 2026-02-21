"use client";

import { apiFetch } from "@/lib/api/client";
import { recordAIUsage } from "@/lib/api/ai-usage";

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
export const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
export const DEFAULT_OLLAMA_MODEL = "llama3.1:8b";

export function getAIProvider(): AIProvider {
  if (typeof window === "undefined") return "auto";
  const value = (localStorage.getItem(AI_PROVIDER_KEY) || "auto").trim().toLowerCase();
  if (value === "openai" || value === "gemini" || value === "ollama" || value === "auto") return value;
  return "auto";
}

export function setAIProvider(provider: AIProvider): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AI_PROVIDER_KEY, provider);
  window.dispatchEvent(new Event("ai-provider-changed"));
}

export function getOpenAIKey(): string {
  if (typeof window === "undefined") return "";
  return (localStorage.getItem(OPENAI_API_KEY_STORAGE) || "").trim();
}

export function getGeminiKey(): string {
  if (typeof window === "undefined") return "";
  return (localStorage.getItem(GEMINI_API_KEY_STORAGE) || "").trim();
}

export function getOllamaBaseUrl(): string {
  if (typeof window === "undefined") return DEFAULT_OLLAMA_BASE_URL;
  return (localStorage.getItem(OLLAMA_BASE_URL_STORAGE) || DEFAULT_OLLAMA_BASE_URL).trim();
}

export function getOllamaModel(): string {
  if (typeof window === "undefined") return DEFAULT_OLLAMA_MODEL;
  return (localStorage.getItem(OLLAMA_MODEL_STORAGE) || DEFAULT_OLLAMA_MODEL).trim();
}

export function buildAIHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const openai = getOpenAIKey();
  const gemini = getGeminiKey();
  const ollamaBaseUrl = getOllamaBaseUrl();
  const ollamaModel = getOllamaModel();
  if (openai) headers["x-openai-api-key"] = openai;
  if (gemini) headers["x-gemini-api-key"] = gemini;
  if (ollamaBaseUrl) headers["x-ollama-base-url"] = ollamaBaseUrl;
  if (ollamaModel) headers["x-ollama-model"] = ollamaModel;
  return headers;
}

export async function chatWithAI(payload: AIChatRequest): Promise<AIChatResponse> {
  const body: AIChatRequest = {
    ...payload,
    provider: payload.provider || getAIProvider(),
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
  const body: AIChatRequest = {
    ...payload,
    provider: payload.provider || getAIProvider(),
  };

  const res = await fetch("/api/ai/stream", {
    method: "POST",
    headers: buildAIHeaders(),
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "AI stream failed");
  }

  const provider = (res.headers.get("x-ai-provider") || "gemini") as AIChatResponse["provider"];
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
