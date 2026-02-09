import { PortfolioConnection } from '@/lib/api/types';
import { WebSocketConnectionInfo, WebSocketMessage, WebSocketStatus, ReconnectionConfig, DEFAULT_RECONNECT_CONFIG } from './websocket-types';
import { WalletWebSocketManager } from './websocket-wallet';
import CryptoJS from 'crypto-js';

type MessageHandler = (message: WebSocketMessage) => void;
type StatusHandler = (status: Map<string, WebSocketConnectionInfo>) => void;

interface ActiveSocket {
    id: string; // Unique identifier for this WebSocket
    connectionId: string; // Original connection ID from Settings
    ws: WebSocket;
    keepAlive?: NodeJS.Timeout;
    reconnectTimer?: NodeJS.Timeout;
    reconnectAttempts: number;
    lastPingTime?: number;
}

export class EnhancedWebSocketManager {
    private sockets: Map<string, ActiveSocket> = new Map();
    private connectionInfo: Map<string, WebSocketConnectionInfo> = new Map();
    private reconnectConfig: ReconnectionConfig;
    private walletManager: WalletWebSocketManager;

    constructor(
        private connections: PortfolioConnection[],
        private onMessage: MessageHandler,
        private onStatusChange?: StatusHandler,
        reconnectConfig?: Partial<ReconnectionConfig>,
        private universalMode: boolean = false
    ) {
        this.reconnectConfig = { ...DEFAULT_RECONNECT_CONFIG, ...reconnectConfig };
        console.log(`[WS Manager] New Instance Created. Universal: ${this.universalMode}`);

        // Initialize Wallet Manager
        this.walletManager = new WalletWebSocketManager((msg) => {
            // Forward wallet messages to main handler
            this.onMessage(msg);

            // Update status for wallet connections implicitly if we receive data
            if (msg.connectionId) {
                this.updateConnectionStatus(msg.connectionId, 'connected');
            }
        });
    }

    public async initialize() {
        console.log(`[WS Manager] Initializing... (Universal: ${this.universalMode})`);

        // Only connect to enabled connections
        const enabledConnections = this.connections.filter(conn => conn.enabled !== false);

        // Fire and forget individual connections to avoid blocking the main thread/loading state
        enabledConnections.forEach(conn => {
            this.connectConnection(conn).catch(e => {
                console.warn(`[WS Manager] Failed to initiate connection for ${conn.name}:`, e);
            });
        });

        // Universal Mode: Connect to global data feeds
        if (this.universalMode) {
            this.connectHyperliquidUniversal().catch(e => {
                console.warn('[WS Manager] Failed to initiate universal connection:', e);
            });
        }
    }

    private async connectConnection(conn: PortfolioConnection) {
        this.updateConnectionStatus(conn.id, 'connecting');

        try {
            if (conn.type === 'binance' && conn.apiKey && conn.secret) {
                await this.connectBinance(conn);
            } else if (conn.type === 'bybit' && conn.apiKey && conn.secret) {
                await this.connectBybit(conn);
            } else if (conn.type === 'hyperliquid' && conn.walletAddress) {
                await this.connectHyperliquid(conn);
            } else if ((conn.type === 'wallet' || conn.type === 'evm' || conn.type === 'solana') && conn.walletAddress) {
                // Determine chain - default to ETH if not specified or implied by type
                let chain = conn.chain || 'ETH';
                if (conn.type === 'solana') chain = 'SOL';

                await this.walletManager.startMonitoring(conn.walletAddress, chain, conn.name);
                this.updateConnectionStatus(conn.id, 'connected');
            }
        } catch (error: any) {
            console.warn(`[WS Manager] Failed to connect ${conn.name}:`, error);
            this.updateConnectionStatus(conn.id, 'error', error.message);
            this.scheduleReconnect(conn);
        }
    }

    private updateConnectionStatus(
        connectionId: string,
        status: WebSocketStatus,
        error?: string,
        latency?: number
    ) {
        const existing = this.connectionInfo.get(connectionId);
        const conn = this.connections.find(c => c.id === connectionId);

        const info: WebSocketConnectionInfo = {
            id: connectionId,
            connectionId,
            name: conn?.name || 'Unknown',
            type: conn?.type || 'wallet',
            status,
            lastUpdate: new Date(),
            latency,
            error,
            reconnectAttempts: existing?.reconnectAttempts || 0
        };

        this.connectionInfo.set(connectionId, info);

        // Notify status change
        if (this.onStatusChange) {
            this.onStatusChange(new Map(this.connectionInfo));
        }
    }

    private scheduleReconnect(conn: PortfolioConnection) {
        const info = this.connectionInfo.get(conn.id);
        if (!info || info.reconnectAttempts >= this.reconnectConfig.maxAttempts) {
            console.log(`[WS Manager] Max reconnect attempts reached for ${conn.name}`);
            return;
        }

        const attempts = info.reconnectAttempts + 1;
        const delay = Math.min(
            this.reconnectConfig.baseDelay * Math.pow(this.reconnectConfig.backoffMultiplier, attempts - 1),
            this.reconnectConfig.maxDelay
        );

        console.log(`[WS Manager] Scheduling reconnect for ${conn.name} in ${delay}ms (attempt ${attempts})`);

        this.updateConnectionStatus(conn.id, 'reconnecting');
        this.connectionInfo.get(conn.id)!.reconnectAttempts = attempts;

        setTimeout(() => {
            this.connectConnection(conn);
        }, delay);
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
                const socketId = `${conn.id}_spot`;

                ws.onopen = () => {
                    console.log(`[Binance Spot] Connected: ${conn.name}`);
                    this.updateConnectionStatus(conn.id, 'connected');
                    const info = this.connectionInfo.get(conn.id);
                    if (info) info.reconnectAttempts = 0;
                };

                ws.onerror = (error) => {
                    console.warn(`[Binance Spot] Error: ${conn.name}`, error);
                    this.updateConnectionStatus(conn.id, 'error', 'WebSocket error');
                };

                ws.onclose = () => {
                    console.log(`[Binance Spot] Disconnected: ${conn.name}`);
                    this.updateConnectionStatus(conn.id, 'disconnected');
                    this.scheduleReconnect(conn);
                };

                ws.onmessage = (event) => {
                    const startTime = Date.now();
                    this.handleBinanceMessage(JSON.parse(event.data), conn, 'Spot');
                    const latency = Date.now() - startTime;
                    this.updateConnectionStatus(conn.id, 'connected', undefined, latency);
                };

                // ListenKey keepalive
                const keepAlive = setInterval(async () => {
                    try {
                        await fetch('/api/binance/listen-key', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ apiKey: conn.apiKey, listenKey: spotData.listenKey })
                        });
                    } catch (e) {
                        console.error(`[Binance] Failed to refresh ListenKey for ${conn.name}`);
                    }
                }, 1000 * 60 * 30); // 30 minutes

                this.sockets.set(socketId, {
                    id: socketId,
                    connectionId: conn.id,
                    ws,
                    keepAlive,
                    reconnectAttempts: 0
                });
            }

            // 2. Futures ListenKey 
            const futuresRes = await fetch('/api/binance/listen-key-futures', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: conn.apiKey, apiSecret: conn.secret })
            });
            // Note: Assuming API route exists or using generic listen-key with marketType param if supported
            // Reverting to previous robust check or standardizing. 
            // The previous file had 'marketType: futures' body in /api/binance/listen-key. I'll use that.

            /* 
            const futuresRes = await fetch('/api/binance/listen-key', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ apiKey: conn.apiKey, apiSecret: conn.secret, marketType: 'futures' })
            });
            */
            // Actually, let's trust the previous implementation details if I had them. 
            // In the view_file #3010, lines 177-181 showed it using 'marketType: futures' and the same endpoint.

            const futuresRes2 = await fetch('/api/binance/listen-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: conn.apiKey, apiSecret: conn.secret, marketType: 'futures' })
            });

            const futuresData = await futuresRes2.json();

            if (futuresData.listenKey) {
                const wsFutures = new WebSocket(`wss://fstream.binance.com/ws/${futuresData.listenKey}`);
                const socketIdFutures = `${conn.id}_futures`;

                wsFutures.onopen = () => {
                    console.log(`[Binance Futures] Connected: ${conn.name}`);
                    this.updateConnectionStatus(conn.id, 'connected');
                };

                wsFutures.onerror = (error) => {
                    console.warn(`[Binance Futures] Error: ${conn.name}`, error);
                };

                wsFutures.onclose = () => {
                    console.log(`[Binance Futures] Disconnected: ${conn.name}`);
                    this.scheduleReconnect(conn);
                };

                wsFutures.onmessage = (event) => {
                    const startTime = Date.now();
                    this.handleBinanceMessage(JSON.parse(event.data), conn, 'Futures');
                    const latency = Date.now() - startTime;
                    this.updateConnectionStatus(conn.id, 'connected', undefined, latency);
                };

                // ListenKey keepalive
                const keepAlive = setInterval(async () => {
                    try {
                        await fetch('/api/binance/listen-key', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                apiKey: conn.apiKey,
                                marketType: 'futures',
                                listenKey: futuresData.listenKey
                            })
                        });
                    } catch (e) {
                        console.warn(`[Binance Futures] Failed to refresh ListenKey for ${conn.name}`);
                    }
                }, 1000 * 60 * 30);

                this.sockets.set(socketIdFutures, {
                    id: socketIdFutures,
                    connectionId: conn.id,
                    ws: wsFutures,
                    keepAlive,
                    reconnectAttempts: 0
                });
            }

        } catch (e: any) {
            console.warn(`[Binance] Connection error for ${conn.name}:`, e);
            throw e;
        }
    }

    private handleBinanceMessage(msg: any, conn: PortfolioConnection, marketType: 'Spot' | 'Futures') {
        const message: WebSocketMessage = {
            source: conn.name,
            connectionId: conn.id,
            type: 'balance',
            data: null,
            timestamp: Date.now()
        };

        if (msg.e === 'outboundAccountPosition') {
            const balances = msg.B.map((b: any) => ({
                symbol: b.a,
                free: parseFloat(b.f),
                locked: parseFloat(b.l)
            })).filter((b: any) => b.free > 0 || b.locked > 0);

            message.type = 'balance';
            message.data = balances;
            this.onMessage(message);
        }
        else if (msg.e === 'ACCOUNT_UPDATE' && marketType === 'Futures') {
            const update = msg.a;
            if (update.P && update.P.length > 0) {
                const positions = update.P.map((p: any) => ({
                    symbol: p.s,
                    size: parseFloat(p.pa),
                    entryPrice: parseFloat(p.ep),
                    pnl: parseFloat(p.up),
                    side: parseFloat(p.pa) > 0 ? 'long' : 'short'
                })).filter((p: any) => Math.abs(p.size) > 0);

                if (positions.length > 0) {
                    message.type = 'position';
                    message.data = positions;
                    this.onMessage(message);
                }
            }
        }
    }

    // --- BYBIT ---
    private async connectBybit(conn: PortfolioConnection) {
        const ws = new WebSocket('wss://stream.bybit.com/v5/private');
        const socketId = conn.id;

        ws.onopen = () => {
            console.log(`[Bybit] Connected: ${conn.name}`);

            // Authenticate
            const expires = Date.now() + 10000;
            const signature = CryptoJS.HmacSHA256(`GET/realtime${expires}`, conn.secret!).toString();

            ws.send(JSON.stringify({
                op: 'auth',
                args: [conn.apiKey, expires, signature]
            }));

            // Subscribe after auth
            setTimeout(() => {
                ws.send(JSON.stringify({
                    op: 'subscribe',
                    args: ['wallet', 'position', 'execution']
                }));
                this.updateConnectionStatus(conn.id, 'connected');

                // Start Heartbeat (Ping every 20s)
                const heartbeat = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ op: 'ping' }));
                    }
                }, 20000);

                const currentSocket = this.sockets.get(socketId);
                if (currentSocket) {
                    currentSocket.keepAlive = heartbeat;
                }
            }, 1000);
        };

        ws.onerror = (error) => {
            console.warn(`[Bybit] Error: ${conn.name}`, error);
            this.updateConnectionStatus(conn.id, 'error', 'WebSocket error');
        };

        ws.onclose = () => {
            console.log(`[Bybit] Disconnected: ${conn.name}`);
            this.updateConnectionStatus(conn.id, 'disconnected');
            this.scheduleReconnect(conn);
        };

        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.op !== 'auth' && msg.op !== 'subscribe') {
                this.handleBybitMessage(msg, conn);
            }
        };

        this.sockets.set(socketId, {
            id: socketId,
            connectionId: conn.id,
            ws,
            reconnectAttempts: 0
        });
    }

    private handleBybitMessage(msg: any, conn: PortfolioConnection) {
        if (msg.topic === 'wallet') {
            const data = msg.data[0];
            const balances = data.coin.map((c: any) => ({
                symbol: c.coin,
                free: parseFloat(c.walletBalance),
                locked: 0
            }));

            this.onMessage({
                source: conn.name,
                connectionId: conn.id,
                type: 'balance',
                data: balances,
                timestamp: Date.now()
            });
        }
        else if (msg.topic === 'execution') {
            const executions = msg.data.map((exec: any) => ({
                id: exec.execId,
                symbol: exec.symbol,
                side: exec.side.toLowerCase(),
                price: parseFloat(exec.execPrice),
                amount: parseFloat(exec.execQty),
                timestamp: parseInt(exec.execTime),
                exchange: 'Bybit',
                status: 'closed'
            }));

            this.onMessage({
                source: conn.name,
                connectionId: conn.id,
                type: 'trade' as any,
                data: executions,
                timestamp: Date.now()
            });
        }
    }

    // --- HYPERLIQUID ---
    private async connectHyperliquid(conn: PortfolioConnection) {
        const ws = new WebSocket('wss://api.hyperliquid.xyz/ws');
        const socketId = conn.id;

        // Heartbeat timer
        let heartbeat: NodeJS.Timeout | undefined;

        ws.onopen = () => {
            console.log(`[Hyperliquid] Connected: ${conn.name}`);

            // 1. Subscribe to Clearinghouse
            ws.send(JSON.stringify({
                method: 'subscribe',
                subscription: {
                    type: 'clearinghouseState',
                    user: conn.walletAddress
                }
            }));

            // 2. Subscribe to User Fills
            ws.send(JSON.stringify({
                method: 'subscribe',
                subscription: {
                    type: 'userFills',
                    user: conn.walletAddress
                }
            }));

            this.updateConnectionStatus(conn.id, 'connected');

            // 3. Start Heartbeat (Ping every 30s)
            heartbeat = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ method: 'ping' }));
                }
            }, 30000);
        };

        ws.onerror = (error) => {
            console.warn(`[Hyperliquid] Error: ${conn.name}`, error);
            this.updateConnectionStatus(conn.id, 'error', 'WebSocket error');
        };

        ws.onclose = () => {
            console.log(`[Hyperliquid] Disconnected: ${conn.name}`);
            if (heartbeat) clearInterval(heartbeat);
            this.updateConnectionStatus(conn.id, 'disconnected');
            this.scheduleReconnect(conn);
        };

        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);

            if (msg.channel === 'clearinghouseState') {
                this.onMessage({
                    source: conn.name,
                    connectionId: conn.id,
                    type: 'position',
                    data: msg.data,
                    timestamp: Date.now()
                });
            } else if (msg.channel === 'userFills') {
                const fills = msg.data;
                if (fills && fills.isSnapshot) {
                    // Initial snapshot
                } else if (fills && fills.fills) {
                    const transactions = fills.fills.map((f: any) => ({
                        id: f.oid.toString(),
                        symbol: f.coin,
                        side: f.side === 'B' ? 'buy' : 'sell',
                        price: parseFloat(f.px),
                        amount: parseFloat(f.sz),
                        timestamp: f.time,
                        exchange: 'Hyperliquid',
                        status: 'closed'
                    }));

                    this.onMessage({
                        source: conn.name,
                        connectionId: conn.id,
                        type: 'trade' as any,
                        data: transactions,
                        timestamp: Date.now()
                    });
                }
            }
        };

        this.sockets.set(socketId, {
            id: socketId,
            connectionId: conn.id,
            ws,
            keepAlive: heartbeat,
            reconnectAttempts: 0
        });
    }

    // --- UNIVERSAL HYPERLIQUID (Global Data) ---
    private async connectHyperliquidUniversal() {
        const socketId = 'hyperliquid_universal';
        if (this.sockets.has(socketId)) return;

        const ws = new WebSocket('wss://api.hyperliquid.xyz/ws');

        // Heartbeat
        let heartbeat: NodeJS.Timeout | undefined;

        ws.onopen = () => {
            console.log(`[Hyperliquid Universal] Connected`);

            // 1. Subscribe to All Prices (allMids)
            ws.send(JSON.stringify({
                method: 'subscribe',
                subscription: { type: 'allMids' }
            }));

            // 2. Subscribe to Market Stats (webData2 for 24h stats/volume/funding)
            // Note: 'webData2' is an internal channel but often used. 
            // Alternatively use 'activeAssetCtx' for strictly Funding/OI/Impact
            // Let's use 'webData2' as it typically has everything for the UI.
            ws.send(JSON.stringify({
                method: 'subscribe',
                subscription: { type: 'webData2', user: '0x0000000000000000000000000000000000000000' }
            }));

            // Start Heartbeat
            heartbeat = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ method: 'ping' }));
                }
            }, 30000);
        };

        ws.onclose = () => {
            console.log(`[Hyperliquid Universal] Disconnected`);
            if (heartbeat) clearInterval(heartbeat);
            this.sockets.delete(socketId);
            // Auto reconnect universal after 5s
            setTimeout(() => this.connectHyperliquidUniversal(), 5000);
        };

        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            const now = Date.now();

            if (msg.channel === 'allMids') {
                // Format: { "BTC": "65000.5", "ETH": "3500.2", ... }
                this.onMessage({
                    source: 'Hyperliquid',
                    connectionId: 'universal',
                    type: 'allMids',
                    data: msg.data.mids,
                    timestamp: now
                });
            }
            else if (msg.channel === 'webData2') {
                // Contains comprehensive stats
                // We forward it raw or parsed. Let's send raw to hook for processing efficiency.
                this.onMessage({
                    source: 'Hyperliquid',
                    connectionId: 'universal',
                    type: 'marketStats',
                    data: msg.data,
                    timestamp: now
                });
            }
        };

        this.sockets.set(socketId, {
            id: socketId,
            connectionId: 'universal',
            ws,
            keepAlive: heartbeat,
            reconnectAttempts: 0
        });
    }

    public disconnect(connectionId?: string) {
        if (connectionId) {
            // Disconnect specific connection
            for (const [socketId, socket] of this.sockets.entries()) {
                if (socket.connectionId === connectionId) {
                    this.disconnectSocket(socketId);
                }
            }

            // Note: WalletWebSocketManager supports stopMonitoring(unknown args right now). 
            // We assume walletManager handles cleanup if we integration is tighter.
            // For now, let's just assume walletManager stays alive or we could stop specific address.
            // If conn type is wallet, we should call walletManager.stopMonitoring(address, chain).
            // Since we don't have easy map here from connectionId to args, skipping for this quick fix unless essential.
            // But optimal is:
            const conn = this.connections.find(c => c.id === connectionId);
            if (conn && (conn.type === 'wallet' || conn.type === 'evm' || conn.type === 'solana') && conn.walletAddress) {
                this.walletManager.stopMonitoring(conn.walletAddress, conn.chain || 'ETH');
            }

        } else {
            // Disconnect all
            for (const socketId of this.sockets.keys()) {
                this.disconnectSocket(socketId);
            }
            this.walletManager.stopAll();
        }
    }

    private disconnectSocket(socketId: string) {
        const socket = this.sockets.get(socketId);
        if (socket) {
            socket.ws.close();
            if (socket.keepAlive) clearInterval(socket.keepAlive);
            if (socket.reconnectTimer) clearTimeout(socket.reconnectTimer);
            this.sockets.delete(socketId);
            console.log(`[WS Manager] Disconnected socket: ${socketId}`);
        }
    }

    public getConnectionStatus(): Map<string, WebSocketConnectionInfo> {
        return new Map(this.connectionInfo);
    }
}
