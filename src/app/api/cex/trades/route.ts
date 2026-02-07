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

        // Fetch Trades (MyTrades)
        // Note: Some exchanges need symbol, usually undefined fetches all or recent for spot
        // CCXT 'fetchMyTrades' usually requires a symbol. 
        // fetching WITHOUT symbol is exchange dependent.
        // Binance: requires symbol usually. 
        // We might need to iterate over active assets? Or use a less strict call.

        // For Proof of Concept, providing no symbol to see if it works or catch error.
        // If error, we might skip or hardcode top assets.
        // Binance supports fetching without symbol for margin/futures sometimes, but spot usually needs it.
        // Workaround: We will just return empty for logic structure if it fails, 
        // or user has to rely on WS for *new* trades. 
        // But user asked for history.

        // Let's try fetching with 'BTC/USDT' and 'ETH/USDT' as defaults for now to ensure *some* data shows up if they traded those.
        // Ideally we iterate our 'balance' list but we don't have it here easily.

        const trades = [];
        try {
            // Try generic fetch if supported
            const res = await client.fetchMyTrades(undefined, undefined, 20); // Limit 20
            trades.push(...res);
        } catch (e) {
            // Fallback: Fetch specific common pairs
            // Expanded list to cover more ground
            const pairs = [
                'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT',
                'ADA/USDT', 'DOGE/USDT', 'AVAX/USDT', 'TRX/USDT', 'DOT/USDT',
                'MATIC/USDT', 'LINK/USDT', 'LTC/USDT', 'SHIB/USDT', 'UNI/USDT',
                'OP/USDT', 'ARB/USDT', 'NEAR/USDT', 'ICP/USDT', 'FIL/USDT'
            ];

            // Limit parallelism to avoid ratelimits
            const batchSize = 5;
            for (let i = 0; i < pairs.length; i += batchSize) {
                const batch = pairs.slice(i, i + batchSize);
                await Promise.all(batch.map(async (pair) => {
                    try {
                        const res = await client.fetchMyTrades(pair, undefined, 10);
                        if (res && res.length > 0) trades.push(...res);
                    } catch (ignore) { }
                }));
            }
        }

        const normalize = (items: any[]) => {
            return items.map(item => ({
                id: item.id,
                symbol: item.symbol,
                side: item.side,
                price: item.price,
                amount: item.amount,
                timestamp: item.timestamp,
                exchange: exchange,
                status: 'closed', // filled trades are closed
                pnl: 0 // Fetching PnL is harder, usually 0 for spot
            }));
        };

        return NextResponse.json({ trades: normalize(trades) });

    } catch (error: any) {
        console.error('CEX Trades Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
