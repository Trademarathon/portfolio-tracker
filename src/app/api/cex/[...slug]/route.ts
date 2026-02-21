import { NextRequest, NextResponse } from "next/server";

// Required for static export (output: 'export') - one dummy path so build passes; route is not used at runtime in exported build
export function generateStaticParams() {
    return [{ slug: ['balance'] }];
}

const API_HOST = process.env.API_HOST || process.env.NEXT_PUBLIC_API_HOST || "127.0.0.1";
const API_PORT = process.env.API_PORT || process.env.NEXT_PUBLIC_API_PORT || "35821";
const API_BASE_URL = `http://${API_HOST}:${API_PORT}`;
const API_DOWN_COOLDOWN_MS = 20_000;
let apiUnavailableUntil = 0;

// Dynamic CEX Proxy for api-server to handle CORS and rewrites reliably
// This route catches all POST requests to /api/cex/* and forwards them to the standalone API server
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string[] }> }
) {
    const p = await params;
    const path = p.slug.join('/');
    const targetUrl = `${API_BASE_URL}/api/cex/${path}`;

    if (Date.now() < apiUnavailableUntil) {
        const retryAfterMs = Math.max(0, apiUnavailableUntil - Date.now());
        return NextResponse.json(
            {
                error: "API Server Unreachable",
                details: "CEX API server is cooling down after recent connection failures.",
                hint: `Ensure npm run api-server is running at ${API_BASE_URL}`,
                retryAfterMs,
            },
            { status: 503 }
        );
    }

    console.log(`[CEX Proxy] Forwarding request to: ${targetUrl}`);

    try {
        const body = await req.json();

        // Proxy call to backend
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const contentType = response.headers.get("content-type");

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[CEX Proxy] Backend Error ${response.status}: ${errorText}`);
            if (response.status === 502 || response.status === 503 || response.status === 504) {
                apiUnavailableUntil = Date.now() + API_DOWN_COOLDOWN_MS;
            }
            return NextResponse.json(
                { error: `API Server Error (${response.status})`, details: errorText },
                { status: response.status }
            );
        }

        if (contentType && contentType.includes("application/json")) {
            const data = await response.json();
            return NextResponse.json(data);
        } else {
            const text = await response.text();
            return new NextResponse(text, { status: 200 });
        }

    } catch (e: any) {
        console.error(`[CEX Proxy] Internal Error proxying to ${targetUrl}:`, e);
        // Include specific message to detect connection refused (server down)
        const message = String(e?.message || "");
        const isConnRefused =
            e?.cause?.code === "ECONNREFUSED" ||
            message.includes("ECONNREFUSED") ||
            message.includes("fetch failed");
        if (isConnRefused) {
            apiUnavailableUntil = Date.now() + API_DOWN_COOLDOWN_MS;
        }

        return NextResponse.json(
            {
                error: isConnRefused ? 'API Server Unreachable' : 'Internal Proxy Error',
                details: message,
                hint: isConnRefused ? `Ensure npm run api-server is running at ${API_BASE_URL}` : undefined
            },
            { status: 502 } // Bad Gateway
        );
    }
}
