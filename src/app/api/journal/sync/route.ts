import { NextResponse } from 'next/server';
import ccxt from 'ccxt';
import { Transaction } from '@/lib/api/types';

// Helper to fetch Hyperliquid fills directly (since ccxt might not have full support or we want specific endpoint)
async function fetchHyperliquidHistory(user: string): Promise<Transaction[]> {
    try {
        const response = await fetch('https://api.hyperliquid.xyz/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'userFills', user })
        });

        if (!response.ok) return [];
        const fills = await response.json();

        // Parse Fills
        return fills.map((f: any) => ({
            id: f.hash || `hl-${f.oid}`,
            symbol: f.coin,
            side: f.side === 'B' ? 'buy' : 'sell',
            price: parseFloat(f.px),
            amount: parseFloat(f.sz),
            timestamp: f.time,
            exchange: 'Hyperliquid',
            pnl: parseFloat(f.closedPnl || '0'),
            status: 'closed', // Fills are executed trades
            notes: f.dir // Use "Open Long" etc as info notes
        }));
    } catch (e) {
        console.error("Hyperliquid Sync Error", e);
        return [];
    }
}

export async function POST(request: Request) {
    try {
        const { keys } = await request.json();
        const trades: Transaction[] = [];

        // 1. Hyperliquid
        if (keys.hyperliquidWallet) {
            const hlTrades = await fetchHyperliquidHistory(keys.hyperliquidWallet);
            trades.push(...hlTrades);
        }

        // 2. Binance
        if (keys.binanceApiKey && keys.binanceSecret) {
            try {
                const binance = new ccxt.binance({
                    apiKey: keys.binanceApiKey,
                    secret: keys.binanceSecret,
                    enableRateLimit: true
                });
                // Fetch recent trades from Spot/Futures? 
                // Getting ALL history is heavy. Let's try to get some major pairs or if user specifies?
                // For MVP, unfortunately fetching "all" without symbol is hard in CCXT for some exchanges.
                // Binance supports `fetchMyTrades` but usually requires symbol.
                // However, `fetchOrders` or `fetchPositions` might be relevant. 
                // A smart journal would track specific symbols.
                // Fallback: Just demonstrate HL for now as it supports global user fills easily.
                // Or try to fetch for top assets: BTC/USDT, ETH/USDT, SOL/USDT.
                const symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT'];

                // Parallel fetch
                await Promise.allSettled(symbols.map(async (sym) => {
                    const myTrades = await binance.fetchMyTrades(sym, undefined, 10);
                    const parsed = myTrades.map(t => ({
                        id: t.id,
                        symbol: t.symbol,
                        side: t.side as 'buy' | 'sell',
                        price: t.price,
                        amount: t.amount,
                        timestamp: t.timestamp,
                        exchange: 'Binance',
                        pnl: 0, // CEX Spot trades don't easily have PnL attached without calculation
                        status: 'closed'
                    }));
                    trades.push(...(parsed as Transaction[]));
                }));

            } catch (e) {
                console.error("Binance Sync Error", e);
            }
        }

        // 3. Bybit
        if (keys.bybitApiKey && keys.bybitSecret) {
            try {
                const bybit = new ccxt.bybit({
                    apiKey: keys.bybitApiKey,
                    secret: keys.bybitSecret,
                });
                // Similar limitation, fetch for top symbols
                const symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];
                await Promise.allSettled(symbols.map(async (sym) => {
                    const myTrades = await bybit.fetchMyTrades(sym, undefined, 10);
                    const parsed = myTrades.map(t => ({
                        id: t.id,
                        symbol: t.symbol,
                        side: t.side as 'buy' | 'sell',
                        price: t.price,
                        amount: t.amount,
                        timestamp: t.timestamp,
                        exchange: 'Bybit',
                        status: 'closed'
                    }));
                    trades.push(...(parsed as Transaction[]));
                }));
            } catch (e) {
                console.error("Bybit Sync Error", e);
            }
        }

        return NextResponse.json({ trades: trades.sort((a, b) => b.timestamp - a.timestamp) });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
