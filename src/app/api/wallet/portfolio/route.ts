import { NextResponse } from 'next/server';
import { getEvmPortfolio, getSolanaPortfolio, getBitcoinPortfolio, getHederaPortfolio, getSuiPortfolio, getAptosPortfolio, getTonPortfolio, getTronPortfolio, getXrpPortfolio } from '@/lib/api/wallet';
import { getZerionFullPortfolio } from '@/lib/api/zerion';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const chain = searchParams.get('chain');
    const type = searchParams.get('type');
    const full = searchParams.get('full') === 'true'; // Optional flag if needed, but for zerion we default to full

    if (!address) {
        return NextResponse.json({ error: 'Missing address' }, { status: 400 });
    }

    try {
        let balances: any = [];

        // Zerion provides multi-chain aggregation - use it if type is 'zerion'
        if (type === 'zerion') {
            balances = await getZerionFullPortfolio(address);
        } else if (type === 'solana' || chain === 'SOL') {
            balances = await getSolanaPortfolio(address);
        } else if (type === 'bitcoin' || chain === 'BTC') {
            balances = await getBitcoinPortfolio(address);
        } else if (type === 'hedera' || chain === 'HBAR') {
            balances = await getHederaPortfolio(address);
        } else if (type === 'sui' || chain === 'SUI') {
            balances = await getSuiPortfolio(address);
        } else if (type === 'aptos' || chain === 'APT') {
            balances = await getAptosPortfolio(address);
        } else if (type === 'ton' || chain === 'TON') {
            balances = await getTonPortfolio(address);
        } else if (type === 'tron' || chain === 'TRX' || chain === 'TRON') {
            balances = await getTronPortfolio(address);
        } else if (type === 'xrp' || chain === 'XRP') {
            balances = await getXrpPortfolio(address);
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
