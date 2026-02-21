import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-static";

/**
 * Refresh Dropbox access token. Server-only.
 * POST body: { refresh_token: string }
 */
export async function POST(request: NextRequest) {
  const appKey = process.env.DROPBOX_APP_KEY ?? process.env.NEXT_PUBLIC_DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;
  if (!appKey || !appSecret) {
    return NextResponse.json(
      { error: "Dropbox OAuth not configured" },
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
  const basicAuth = Buffer.from(`${appKey}:${appSecret}`).toString("base64");
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const tokenRes = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
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
