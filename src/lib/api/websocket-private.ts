import { PortfolioConnection } from '@/lib/api/types';
import CryptoJS from 'crypto-js';

type MessageHandler = (data: any) => void;

interface ActiveSocket {
    id: string; // Connection ID
    ws: WebSocket;
    keepAlive?: NodeJS.Timeout;
}

export class PrivateWebSocketManager {
    private sockets: ActiveSocket[] = [];

    constructor(
        private connections: PortfolioConnection[],
        private onMessage: MessageHandler
    ) { }

    public async connect() {
        for (const conn of this.connections) {
            if (conn.type === 'binance' && conn.apiKey && conn.secret) {
                await this.connectBinance(conn);
            }
            if (conn.type === 'bybit' && conn.apiKey && conn.secret) {
                this.connectBybit(conn);
            }
            if (conn.type === 'hyperliquid' && conn.walletAddress) {
                this.connectHyperliquid(conn);
            }
        }
    }

    public disconnect() {
        this.sockets.forEach(s => {
            s.ws.close();
            if (s.keepAlive) clearInterval(s.keepAlive);
        });
        this.sockets = [];
    }

    // --- BINANCE ---
    private async connectBinance(conn: PortfolioConnection) {
        try {
            // 1. Spot ListenKey
            const spotRes = await fetch('/api/binance/listen-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: conn.apiKey, apiSecret: conn.secret })
            });
            const spotData = await spotRes.json();

            if (spotData.listenKey) {
                const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${spotData.listenKey}`);
                ws.onmessage = (event) => {
                    this.handleBinanceMessage(JSON.parse(event.data), conn.name, 'Spot');
                };

                const keepAlive = setInterval(async () => {
                    await fetch('/api/binance/listen-key', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ apiKey: conn.apiKey, listenKey: spotData.listenKey })
                    });
                }, 1000 * 60 * 30);

                this.sockets.push({ id: conn.id + '_spot', ws, keepAlive });
            }

            // 2. Futures ListenKey
            const futuresRes = await fetch('/api/binance/listen-key-futures', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: conn.apiKey, apiSecret: conn.secret })
            });
            const futuresData = await futuresRes.json();

            if (futuresData.listenKey) {
                const fWs = new WebSocket(`wss://fstream.binance.com/ws/${futuresData.listenKey}`);
                fWs.onmessage = (event) => {
                    this.handleBinanceMessage(JSON.parse(event.data), conn.name, 'Futures');
                };

                const fKeepAlive = setInterval(async () => {
                    await fetch('/api/binance/listen-key-futures', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ apiKey: conn.apiKey, listenKey: futuresData.listenKey })
                    });
                }, 1000 * 60 * 50);

                this.sockets.push({ id: conn.id + '_futures', ws: fWs, keepAlive: fKeepAlive });
            }

        } catch (e) {
            console.warn(`Binance WS Error (${conn.name}):`, e);
        }
    }

    private handleBinanceMessage(msg: any, sourceName: string, marketType: 'Spot' | 'Futures') {
        // Spot: outboundAccountPosition
        // Futures: ACCOUNT_UPDATE

        if (msg.e === 'outboundAccountPosition') {
            const balances = msg.B.map((b: any) => ({
                symbol: b.a,
                free: parseFloat(b.f),
                locked: parseFloat(b.l)
            })).filter((b: any) => b.free > 0 || b.locked > 0);

            this.onMessage({ source: sourceName, type: 'balance', data: balances });
        }
        else if (msg.e === 'ACCOUNT_UPDATE' && marketType === 'Futures') {
            // Binance Futures Account Update
            // Includes Balance and Positions
            const update = msg.a; // Account Update Data
            // B: Balances -> filtered for changed
            // P: Positions -> filtered for changed

            if (update.P && update.P.length > 0) {
                const positions = update.P.map((p: any) => ({
                    symbol: p.s,
                    size: parseFloat(p.pa),
                    entryPrice: parseFloat(p.ep),
                    markPrice: 0, // Need to fetch or get from mark price stream? 
                    // Usually ACCOUNT_UPDATE doesn't have mark price, just entry. 
                    // We might need to merge with ticker stream or just use current price hook in UI.
                    // For now, partial data is better than none.
                    pnl: parseFloat(p.up), // Unrealized PnL
                    side: parseFloat(p.pa) > 0 ? 'long' : 'short', // Logic check
                    leverage: 0 // Not always sent
                })).filter((p: any) => Math.abs(p.size) > 0);

                if (positions.length > 0) {
                    this.onMessage({ source: sourceName, type: 'positions', data: positions });
                }
            }
        }
        // executionReport (Spot Order) or ORDER_TRADE_UPDATE (Futures)
        // Removed for now as per diff
    }

    // --- BYBIT ---
    private connectBybit(conn: PortfolioConnection) {
        const ws = new WebSocket('wss://stream.bybit.com/v5/private');

        ws.onopen = () => {
            // Authenticate
            const expires = Date.now() + 10000;
            const signature = CryptoJS.HmacSHA256(`GET/realtime${expires}`, conn.secret!).toString();

            ws.send(JSON.stringify({
                op: 'auth',
                args: [conn.apiKey, expires, signature]
            }));

            // Subscribe after a brief delay to ensure auth
            setTimeout(() => {
                ws.send(JSON.stringify({
                    op: 'subscribe',
                    args: ['wallet', 'position', 'execution']
                }));
            }, 1000);
        };

        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.op !== 'auth' && msg.op !== 'subscribe') {
                this.handleBybitMessage(msg, conn.name);
            }
        };

        this.sockets.push({ id: conn.id, ws });
    }

    private handleBybitMessage(msg: any, sourceName: string) {
        if (msg.topic === 'wallet') {
            const data = msg.data[0];
            const balances = data.coin.map((c: any) => ({
                symbol: c.coin,
                free: parseFloat(c.walletBalance),
                locked: 0 // Simplification
            }));
            this.onMessage({ source: sourceName, type: 'balance', data: balances });
        }
    }

    // --- HYPERLIQUID ---
    private connectHyperliquid(conn: PortfolioConnection) {
        const ws = new WebSocket('wss://api.hyperliquid.xyz/ws');

        ws.onopen = () => {
            ws.send(JSON.stringify({
                method: 'subscribe',
                subscription: {
                    type: 'clearinghouseState',
                    user: conn.walletAddress
                }
            }));
        };

        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.channel === 'clearinghouseState') {
                // Use our existing parser logic from hyperliquid.ts in the hook/component
                this.onMessage({ source: conn.name, type: 'state', data: msg.data });
            }
        };

        this.sockets.push({ id: conn.id, ws });
    }
}
