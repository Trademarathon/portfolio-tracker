import { NextResponse } from 'next/server';
import { getEvmHistory, getSolanaHistory, getSuiHistory, getAptosHistory } from '@/lib/api/wallet';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const chain = searchParams.get('chain');
    const type = searchParams.get('type');

    if (!address) {
        return NextResponse.json({ error: 'Missing address' }, { status: 400 });
    }

    try {
        let history = [];
        if (type === 'solana' || chain === 'SOL') {
            history = await getSolanaHistory(address);
        } else if (type === 'sui' || chain === 'SUI') {
            history = await getSuiHistory(address);
        } else if (type === 'aptos' || chain === 'APT') {
            history = await getAptosHistory(address);
        } else {
            // Default to EVM
            history = await getEvmHistory(address, (chain as any) || 'ETH');
        }

        return NextResponse.json(history);
    } catch (error: any) {
        console.error('Wallet History Proxy Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
