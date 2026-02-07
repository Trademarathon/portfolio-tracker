import { NextResponse } from 'next/server';
import ccxt from 'ccxt';

export async function POST(request: Request) {
    try {
        const { exchangeId, apiKey, secret } = await request.json();

        if (!exchangeId || !apiKey || !secret) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        if (!(ccxt as any)[exchangeId]) {
            return NextResponse.json({ error: 'Invalid exchange' }, { status: 400 });
        }

        // @ts-ignore
        const exchange = new (ccxt as any)[exchangeId]({
            apiKey,
            secret,
            options: exchangeId === 'bybit' ? { defaultType: 'unified' } : undefined
        });

        const balance = await exchange.fetchBalance();
        return NextResponse.json(balance);
    } catch (error: any) {
        console.error('CCXT Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
