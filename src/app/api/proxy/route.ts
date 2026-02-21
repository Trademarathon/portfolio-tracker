import { NextRequest, NextResponse } from "next/server";

export const revalidate = 3600;
let lastLocalProxyFailureAt = 0;
const LOCAL_PROXY_COOLDOWN_MS = 15_000;
const API_HOST = process.env.API_HOST || process.env.NEXT_PUBLIC_API_HOST || "127.0.0.1";
const API_PORT = process.env.API_PORT || process.env.NEXT_PUBLIC_API_PORT || "35821";
const LOCAL_API_BASE = `http://${API_HOST}:${API_PORT}`;

export async function POST(req: NextRequest) {
    if (process.env.NEXT_PHASE === "phase-production-build") {
        return NextResponse.json({ error: "Use standalone API server in production" }, { status: 503 });
    }
    try {
        const { url, method = "GET", headers = {}, body } = await req.json();

        if (!url) {
            return NextResponse.json({ error: "Missing URL" }, { status: 400 });
        }

        const response = await fetch(url, {
            method,
            headers: {
                ...headers,
                // Ensure we don't look like a browser if that helps avoid some blocks, 
                // but usually API keys are the issue.
                // Forwarding generic headers.
            },
            body: body ? JSON.stringify(body) : undefined,
        });

        const contentType = response.headers.get("content-type");
        const responseBody = await response.text();

        return new NextResponse(responseBody, {
            status: response.status,
            headers: {
                "Content-Type": contentType || "application/json",
                "Access-Control-Allow-Origin": "*", // Allow app to read this
            },
        });
    } catch (e: any) {
        const message = e?.message || "Proxy Failed";
        const isConnRefused = e?.cause?.code === 'ECONNREFUSED' || message.includes('ECONNREFUSED');
        const isLocalApi = typeof e?.cause?.address === "string"
            ? e.cause.address === "127.0.0.1"
            : (typeof e?.message === "string" && e.message.includes(LOCAL_API_BASE));
        if (isConnRefused && isLocalApi) {
            const now = Date.now();
            if (now - lastLocalProxyFailureAt > LOCAL_PROXY_COOLDOWN_MS) {
                console.warn(`Proxy Error: API server unreachable at ${LOCAL_API_BASE}`);
                lastLocalProxyFailureAt = now;
            }
            return NextResponse.json(
                { error: "API Server Unreachable", hint: `Start: npm run api-server (${LOCAL_API_BASE})` },
                { status: 503 }
            );
        }
        console.error("Proxy Error:", e);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
