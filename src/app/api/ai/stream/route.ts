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

async function openGeminiStream(
  apiKey: string,
  messages: AIMessage[],
  temperature: number,
  maxTokens: number,
  model: string
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
    },
  };
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  if (!res.ok || !res.body) throw new Error(await res.text());
  return res;
}

async function openOpenAIStream(
  apiKey: string,
  messages: AIMessage[],
  temperature: number,
  maxTokens: number,
  model: string
) {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: messages,
      temperature,
      max_output_tokens: maxTokens,
      stream: true,
    }),
  });
  if (!res.ok || !res.body) throw new Error(await res.text());
  return res;
}

async function openOllamaStream(
  baseUrl: string,
  model: string,
  messages: AIMessage[],
  temperature: number,
  maxTokens: number
) {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      num_predict: maxTokens,
      stream: true,
    }),
  });
  if (!res.ok || !res.body) throw new Error(await res.text());
  return res;
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    provider?: Provider;
    model?: string;
    messages: AIMessage[];
    temperature?: number;
    maxTokens?: number;
  };
  const provider = (body.provider || "auto") as Provider;
  const model = body.model;
  const temperature = typeof body.temperature === "number" ? body.temperature : 0.2;
  const maxTokens = typeof body.maxTokens === "number" ? body.maxTokens : 200;

  const headers = req.headers;
  const openaiKey = headers.get("x-openai-api-key") || "";
  const geminiKey = headers.get("x-gemini-api-key") || "";
  const ollamaBase = headers.get("x-ollama-base-url") || "http://127.0.0.1:11434";
  const ollamaModel = headers.get("x-ollama-model") || DEFAULT_MODELS.ollama;

  const providers = resolveProviders(provider);
  for (const p of providers) {
    try {
      let upstream: Response | null = null;
      let chosenModel = model || DEFAULT_MODELS[p];
      if (p === "gemini" && geminiKey) {
        upstream = await openGeminiStream(geminiKey, body.messages, temperature, maxTokens, chosenModel);
      } else if (p === "openai" && openaiKey) {
        upstream = await openOpenAIStream(openaiKey, body.messages, temperature, maxTokens, chosenModel);
      } else if (p === "ollama") {
        upstream = await openOllamaStream(ollamaBase, ollamaModel, body.messages, temperature, maxTokens);
        chosenModel = ollamaModel;
      }

      if (upstream?.body) {
        return new Response(upstream.body, {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-AI-Provider": p,
            "X-AI-Model": chosenModel,
          },
        });
      }
    } catch {
      continue;
    }
  }

  return new Response("No AI provider available", { status: 500 });
}
