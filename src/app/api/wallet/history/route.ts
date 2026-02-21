import { NextRequest, NextResponse } from "next/server";
import { getChainHistory, ChainType } from "@/lib/api/wallet";

export const revalidate = 3600;

export async function GET(req: NextRequest) {
    if (process.env.NEXT_PHASE === "phase-production-build") {
        return NextResponse.json({ error: "Use standalone API server in production" }, { status: 503 });
    }
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");
    const chain = searchParams.get("chain");

    if (!address || !chain) {
        return NextResponse.json({ error: "Address and chain are required" }, { status: 400 });
    }

    try {
        const data = await getChainHistory(address, chain as ChainType);
        return NextResponse.json(data);
    } catch (error) {
        console.error("History API Error:", error);
        return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
    }
}
