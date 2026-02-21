import { NextResponse } from "next/server";

type Provider = "openai" | "gemini" | "ollama" | "auto";

type AIMessage = { role: "system" | "user" | "assistant"; content: string };

const DEFAULT_MODELS = {
  openai: "gpt-4o-mini",
  gemini: "gemini-1.5-pro",
  ollama: "llama3.1:8b",
};

function resolveProviders(preferred: Provider): Array<Exclude<Provider, "auto">> {
  if (preferred === "openai") return ["openai", "gemini", "ollama"];
  if (preferred === "ollama") return ["ollama", "gemini", "openai"];
  return ["gemini", "openai", "ollama"];
}

function extractSystem(messages: AIMessage[]): { system: string; rest: AIMessage[] } {
  const systemParts = messages.filter((m) => m.role === "system").map((m) => m.content);
  const rest = messages.filter((m) => m.role !== "system");
  return { system: systemParts.join("\n"), rest };
}

async function callGemini(
  apiKey: string,
  messages: AIMessage[],
  temperature: number,
  maxTokens: number,
  model: string,
  jsonMode?: boolean
) {
  const { system, rest } = extractSystem(messages);
  const body = {
    contents: rest.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    ...(system
      ? { systemInstruction: { role: "system", parts: [{ text: system }] } }
      : {}),
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      ...(jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  };
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  const text =
    json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") ||
    "";
  return { provider: "gemini" as const, model, content: text, usage: json?.usageMetadata };
}

async function callOpenAI(
  apiKey: string,
  messages: AIMessage[],
  temperature: number,
  maxTokens: number,
  model: string,
  jsonMode?: boolean
) {
  const body = {
    model,
    input: messages,
    temperature,
    max_output_tokens: maxTokens,
    ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
  };
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  const text =
    json?.output_text ||
    json?.output?.[0]?.content?.map((p: { text?: string }) => p.text || "").join("") ||
    "";
  return { provider: "openai" as const, model, content: text, usage: json?.usage };
}

async function callOllama(
  baseUrl: string,
  model: string,
  messages: AIMessage[],
  temperature: number,
  maxTokens: number,
  jsonMode?: boolean
) {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      num_predict: maxTokens,
      ...(jsonMode ? { format: "json" } : {}),
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  const text = json?.message?.content || "";
  return { provider: "ollama" as const, model, content: text, usage: json?.usage };
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    provider?: Provider;
    model?: string;
    messages: AIMessage[];
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
  };

  const provider = (body.provider || "auto") as Provider;
  const model = body.model;
  const temperature = typeof body.temperature === "number" ? body.temperature : 0.2;
  const maxTokens = typeof body.maxTokens === "number" ? body.maxTokens : 200;
  const jsonMode = Boolean(body.jsonMode);
  const providers = resolveProviders(provider);

  const headers = req.headers;
  const openaiKey = headers.get("x-openai-api-key") || "";
  const geminiKey = headers.get("x-gemini-api-key") || "";
  const ollamaBase = headers.get("x-ollama-base-url") || "http://127.0.0.1:11434";
  const ollamaModel = headers.get("x-ollama-model") || DEFAULT_MODELS.ollama;

  for (const p of providers) {
    try {
      if (p === "gemini" && geminiKey) {
        const result = await callGemini(
          geminiKey,
          body.messages,
          temperature,
          maxTokens,
          model || DEFAULT_MODELS.gemini,
          jsonMode
        );
        return NextResponse.json({ ok: true, ...result });
      }
      if (p === "openai" && openaiKey) {
        const result = await callOpenAI(
          openaiKey,
          body.messages,
          temperature,
          maxTokens,
          model || DEFAULT_MODELS.openai,
          jsonMode
        );
        return NextResponse.json({ ok: true, ...result });
      }
      if (p === "ollama") {
        const result = await callOllama(
          ollamaBase,
          ollamaModel,
          body.messages,
          temperature,
          maxTokens,
          jsonMode
        );
        return NextResponse.json({ ok: true, ...result });
      }
    } catch (e) {
      continue;
    }
  }

  return NextResponse.json({ error: "No AI provider available" }, { status: 500 });
}
