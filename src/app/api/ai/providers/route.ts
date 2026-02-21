import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const headers = req.headers;
  const openaiKey = headers.get("x-openai-api-key") || "";
  const geminiKey = headers.get("x-gemini-api-key") || "";
  const ollamaBase = headers.get("x-ollama-base-url") || "";
  const ollamaModel = headers.get("x-ollama-model") || "llama3.1:8b";

  return NextResponse.json({
    ok: true,
    providers: [
      { id: "openai", available: Boolean(openaiKey), defaultModel: "gpt-4o-mini" },
      { id: "gemini", available: Boolean(geminiKey), defaultModel: "gemini-1.5-pro" },
      { id: "ollama", available: Boolean(ollamaBase), defaultModel: ollamaModel },
    ],
  });
}
