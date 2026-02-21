import { NextRequest, NextResponse } from "next/server";
import { getChainPortfolio, ChainType } from "@/lib/api/wallet";

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
        const data = await getChainPortfolio(address, chain as ChainType);
        return NextResponse.json(data);
    } catch (error) {
        console.error("Portfolio API Error:", error);
        return NextResponse.json({ error: "Failed to fetch portfolio" }, { status: 500 });
    }
}
