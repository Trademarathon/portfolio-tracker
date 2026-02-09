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

        const orders = await exchange.fetchOpenOrders();

        // Normalize orders to a subset of fields we need
        const normalizedOrders = orders.map((o: any) => ({
            id: o.id,
            symbol: o.symbol,
            type: o.type, // 'limit', 'market' etc.
            side: o.side, // 'buy', 'sell'
            price: o.price,
            amount: o.amount,
            filled: o.filled,
            remaining: o.remaining,
            status: o.status,
            timestamp: o.timestamp,
            datetime: o.datetime,
            exchange: exchangeId
        }));

        return NextResponse.json({ orders: normalizedOrders });
    } catch (error: any) {
        console.error('CCXT Open Orders Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
