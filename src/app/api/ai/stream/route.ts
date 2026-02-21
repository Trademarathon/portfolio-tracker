import {
  resolveOllamaModel,
  resolveAICredentialsFromHeaders,
  sanitizeMaxTokens,
  sanitizeMessages,
  sanitizeTemperature,
} from "@/lib/server/ai-gateway";

type AIMessage = { role: "system" | "user" | "assistant"; content: string };

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
  try {
    const body = (await req.json().catch(() => ({}))) as {
      model?: string;
      messages?: AIMessage[];
      temperature?: number;
      maxTokens?: number;
    };

    const messages = sanitizeMessages(body.messages);
    if (!messages.length) {
      return new Response(
        JSON.stringify({ error: "messages is required and must include at least one message." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const temperature = sanitizeTemperature(body.temperature);
    const maxTokens = sanitizeMaxTokens(body.maxTokens);
    const creds = resolveAICredentialsFromHeaders((name) => req.headers.get(name));
    const ollamaResolved = await resolveOllamaModel(
      body.model ? { ...creds, ollamaModel: body.model } : creds
    );
    if (!ollamaResolved.available) {
      return new Response(
        JSON.stringify({
          error: "No AI provider available",
          attemptedProviders: ["ollama"],
          details: [{ provider: "ollama", message: "Ollama is reachable but no models are installed." }],
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    const chosenModel = ollamaResolved.model;
    const upstream = await openOllamaStream(
      creds.ollamaBaseUrl,
      chosenModel,
      messages,
      temperature,
      maxTokens
    );

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-AI-Provider": "ollama",
        "X-AI-Model": chosenModel,
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "AI stream failed",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
