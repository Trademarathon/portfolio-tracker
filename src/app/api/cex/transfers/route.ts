import { NextResponse } from 'next/server';
import ccxt from 'ccxt';

export async function POST(req: Request) {
    try {
        const { exchange, apiKey, secret } = await req.json();

        if (!exchange || !apiKey || !secret) {
            return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
        }

        let client;
        if (exchange === 'binance') {
            client = new ccxt.binance({ apiKey, secret });
        } else if (exchange === 'bybit') {
            client = new ccxt.bybit({ apiKey, secret });
        } else {
            return NextResponse.json({ error: 'Unsupported exchange' }, { status: 400 });
        }

        // Fetch Deposits and Withdrawals
        // Note: CCXT fetchDeposits/withdrawals are unified
        const since = new Date().getTime() - (90 * 24 * 60 * 60 * 1000); // 90 days ago

        const [deposits, withdrawals] = await Promise.all([
            client.fetchDeposits(undefined, since),
            client.fetchWithdrawals(undefined, since)
        ]);

        const normalize = (items: any[], type: 'Deposit' | 'Withdraw') => {
            return items.map(item => ({
                id: item.id || item.txid || `${type}-${item.timestamp}`,
                type,
                asset: item.currency,
                amount: item.amount,
                status: item.status,
                timestamp: item.timestamp,
                txHash: item.txid,
                address: item.address
            }));
        };

        const allTransfers = [
            ...normalize(deposits, 'Deposit'),
            ...normalize(withdrawals, 'Withdraw')
        ].sort((a, b) => b.timestamp - a.timestamp);

        return NextResponse.json({ transfers: allTransfers });

    } catch (error: any) {
        console.error('CEX Transfers Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
