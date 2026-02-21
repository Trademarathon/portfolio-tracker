import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-static";

/**
 * Refresh Google Drive access token using refresh_token. Server-only.
 * POST body: { refresh_token: string }
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
  let body: { refresh_token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const refreshToken = body.refresh_token;
  if (!refreshToken || typeof refreshToken !== "string") {
    return NextResponse.json({ error: "Missing refresh_token" }, { status: 400 });
  }
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    return NextResponse.json(
      { error: "Refresh failed", details: err },
      { status: 502 }
    );
  }
  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  return NextResponse.json({
    access_token: tokenData.access_token,
    expires_in: tokenData.expires_in,
  });
}
