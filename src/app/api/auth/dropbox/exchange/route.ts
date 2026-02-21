import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-static";

/**
 * Exchange Dropbox OAuth code for tokens. Server-only (has app secret).
 * POST body: { code: string }
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
    (request.headers.get("origin") ?? request.nextUrl.origin) + "/auth/dropbox/callback";
  const basicAuth = Buffer.from(`${appKey}:${appSecret}`).toString("base64");
  const params = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
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
