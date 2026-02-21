import { NextResponse } from "next/server";
import {
  executeAIChat,
  resolveAICredentialsFromHeaders,
} from "@/lib/server/ai-gateway";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const creds = resolveAICredentialsFromHeaders((name) => req.headers.get(name));
    const result = await executeAIChat(body, creds);
    return NextResponse.json(result, { status: result.ok ? 200 : result.status });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "AI request failed",
      },
      { status: 500 }
    );
  }
}
