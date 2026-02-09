import { NextResponse } from 'next/server';
import { getEvmPortfolio, getSolanaPortfolio, getBitcoinPortfolio, getHederaPortfolio, getSuiPortfolio, getAptosPortfolio } from '@/lib/api/wallet';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const chain = searchParams.get('chain');
    const type = searchParams.get('type');

    if (!address) {
        return NextResponse.json({ error: 'Missing address' }, { status: 400 });
    }

    try {
        let balances = [];
        if (type === 'solana' || chain === 'SOL') {
            balances = await getSolanaPortfolio(address);
        } else if (type === 'bitcoin' || chain === 'BTC') {
            balances = await getBitcoinPortfolio(address);
        } else if (type === 'hedera' || chain === 'HBAR') {
            balances = await getHederaPortfolio(address);
        } else if (type === 'sui' || chain === 'SUI') {
            balances = await getSuiPortfolio(address);
        } else if (type === 'aptos' || chain === 'APT') {
            balances = await getAptosPortfolio(address);
        } else {
            // Default to EVM
            balances = await getEvmPortfolio(address, (chain as any) || 'ETH');
        }

        return NextResponse.json(balances);
    } catch (error: any) {
        console.error('Wallet Proxy Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
