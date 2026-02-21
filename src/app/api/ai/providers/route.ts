import { NextResponse } from "next/server";
import {
  checkProviderAvailability,
  resolveAICredentialsFromHeaders,
} from "@/lib/server/ai-gateway";

export async function GET(req: Request) {
  const creds = resolveAICredentialsFromHeaders((name) => req.headers.get(name));
  const providers = await checkProviderAvailability(creds);
  return NextResponse.json({ ok: true, providers });
}
