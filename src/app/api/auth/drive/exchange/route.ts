import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-static";

/**
 * Exchange Google OAuth code for tokens. Server-only (has client secret).
 * POST body: { code: string }
 */
export async function POST(request: NextRequest) {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID ?? process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Google Drive OAuth not configured" },
      { status: 503 }
    );
  }
  let body: { code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const code = body.code;
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }
  const redirectUri =
    process.env.NEXT_PUBLIC_APP_URL ||
    (request.headers.get("origin") ?? request.nextUrl.origin) + "/auth/drive/callback";
  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    return NextResponse.json(
      { error: "Token exchange failed", details: err },
      { status: 502 }
    );
  }
  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  return NextResponse.json({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_in: tokenData.expires_in,
  });
}
