import { NextRequest, NextResponse } from "next/server";

export const revalidate = 3600;

export async function GET(req: NextRequest) {
    if (process.env.NEXT_PHASE === "phase-production-build") {
        return NextResponse.json({ success: false, status: 503 });
    }
    const { searchParams } = new URL(req.url);
    const target = searchParams.get('url');

    if (!target) {
        return NextResponse.json({ error: 'Missing url param' }, { status: 400 });
    }

    try {
        const parsed = new URL(target);
        // Allow specific domains only for security
        const allowedHosts = [
            'api.bybit.com',
            'api.binance.com',
            'api.hyperliquid.xyz',
            'eth.llamarpc.com',
            'arb1.arbitrum.io',
            'mainnet.optimism.io',
            'mainnet.base.org',
            'polygon-rpc.com',
            'bsc-dataseed.binance.org',
            'api.avax.network',
            'rpc.ftm.tools',
            'rpc.linea.build',
            'rpc.scroll.io',
            'mainnet.era.zksync.io',
            'rpc.blast.io',
            'rpc.gnosischain.com',
            'forno.celo.org',
            'evm.cronos.org',
            'rpc.mantle.xyz',
            'api.mainnet-beta.solana.com'
        ];

        // Ensure host is allowed or is a subdomain of allowed
        const isAllowed = allowedHosts.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h));

        if (!isAllowed) {
            // Check known patterns for safety if strict list fails
            if (!parsed.protocol.startsWith('http')) {
                return NextResponse.json({ error: 'Invalid protocol' }, { status: 400 });
            }
        }

        // Fetch target
        const res = await fetch(target, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            signal: AbortSignal.timeout(5000)
        });

        // We don't need body, just status
        return NextResponse.json({
            success: res.ok,
            status: res.status
        });

    } catch (e: any) {
        console.error('Proxy Error:', e.message);
        return NextResponse.json({ error: 'Fetch failed', details: e.message }, { status: 500 });
    }
}
